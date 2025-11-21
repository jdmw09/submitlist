import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import path from 'path';
import fs from 'fs';
import { compressImage, shouldCompressImage } from '../utils/imageCompressor';
import { shouldCompressVideo } from '../utils/videoCompressor';
import { processVideoInBackground } from '../services/processingJobService';
import { isBillingEnabled, canUploadFile, trackFileUpload, trackFileDelete } from '../services/billingService';

export const addCompletion = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { requirementId, textContent, completionType } = req.body;
    const userId = req.user!.id;

    // Get task
    const taskResult = await query(
      'SELECT organization_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Check storage limit if billing is enabled and files are uploaded
    const files = req.files as Express.Multer.File[];
    let totalFileSize = 0;

    if (files && files.length > 0 && isBillingEnabled()) {
      totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
      const uploadCheck = await canUploadFile(task.organization_id, totalFileSize);

      if (!uploadCheck.allowed) {
        // Delete uploaded files since we can't accept them
        for (const file of files) {
          const filePath = path.join(__dirname, '../../uploads', file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        return res.status(402).json({
          error: 'Storage limit exceeded',
          message: uploadCheck.message,
          upgrade_required: true,
        });
      }
    }

    // Handle file uploads (multiple files supported)
    let filePath = null;
    const videoJobIds: string[] = [];

    if (files && files.length > 0) {
      const processedFilePaths: string[] = [];

      for (const file of files) {
        const fullPath = path.join(__dirname, '../../uploads', file.filename);

        if (shouldCompressImage(file.mimetype)) {
          // Compress image synchronously
          try {
            const result = await compressImage(fullPath);
            // Update path if extension changed
            const relativePath = result.newPath.replace(/^.*\/uploads/, '/uploads');
            processedFilePaths.push(relativePath);
          } catch (error) {
            console.error('Image compression failed:', error);
            processedFilePaths.push(`/uploads/${file.filename}`);
          }
        } else if (shouldCompressVideo(file.mimetype)) {
          // Store original path for now - will be updated after completion insert
          processedFilePaths.push(`/uploads/${file.filename}`);
        } else {
          // No compression needed
          processedFilePaths.push(`/uploads/${file.filename}`);
        }
      }

      filePath = JSON.stringify(processedFilePaths);
    }

    // Determine completion type
    let finalCompletionType = completionType || 'text';
    if (files && files.length > 0) {
      const ext = path.extname(files[0].filename).toLowerCase();
      // Image formats including Apple HEIC/HEIF
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.tiff', '.tif'].includes(ext)) {
        finalCompletionType = 'image';
      }
      // Video formats including Apple MOV and M4V
      else if (['.mp4', '.mov', '.m4v', '.avi', '.webm'].includes(ext)) {
        finalCompletionType = 'video';
      }
      // Document formats
      else if (['.pdf', '.doc', '.docx'].includes(ext)) {
        finalCompletionType = 'document';
      }
    }

    // Create completion
    const completionResult = await query(
      `INSERT INTO task_completions (task_id, requirement_id, user_id, completion_type, text_content, file_path, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [taskId, requirementId, userId, finalCompletionType, textContent, filePath, totalFileSize]
    );

    const completionId = completionResult.rows[0].id;

    // Track file upload for billing if files were uploaded
    if (totalFileSize > 0 && isBillingEnabled()) {
      await trackFileUpload(task.organization_id, userId, totalFileSize);
    }

    // Start background video compression for video files
    if (files && files.length > 0) {
      for (const file of files) {
        if (shouldCompressVideo(file.mimetype)) {
          const fullPath = path.join(__dirname, '../../uploads', file.filename);
          const jobId = processVideoInBackground(parseInt(taskId), completionId, fullPath);
          videoJobIds.push(jobId);
        }
      }
    }

    // If requirement specified, mark it as completed
    if (requirementId) {
      await query(
        `UPDATE task_requirements
         SET completed = true, completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [requirementId]
      );
    }

    // Check if all requirements are completed
    const requirementsCheck = await query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN completed = true THEN 1 END) as completed
       FROM task_requirements
       WHERE task_id = $1`,
      [taskId]
    );

    const { total, completed } = requirementsCheck.rows[0];

    // If all requirements completed, update task status
    if (total > 0 && parseInt(total) === parseInt(completed)) {
      await query(
        `UPDATE tasks SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [taskId]
      );

      // Notify task creator
      const taskInfo = await query('SELECT created_by_id, title FROM tasks WHERE id = $1', [taskId]);
      if (taskInfo.rows.length > 0 && taskInfo.rows[0].created_by_id !== userId) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, task_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            taskInfo.rows[0].created_by_id,
            'task_completed',
            'Task completed',
            `Task "${taskInfo.rows[0].title}" has been completed`,
            taskId,
          ]
        );
      }
    }

    const response: any = {
      message: 'Completion added successfully',
      completion: completionResult.rows[0],
    };

    // Include video job IDs if any videos were uploaded
    if (videoJobIds.length > 0) {
      response.videoJobs = videoJobIds;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Add completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getCompletions = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task
    const taskResult = await query(
      'SELECT organization_id FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Get completions
    const result = await query(
      `SELECT tc.*, u.name as user_name, u.email as user_email,
              tr.description as requirement_description
       FROM task_completions tc
       LEFT JOIN users u ON tc.user_id = u.id
       LEFT JOIN task_requirements tr ON tc.requirement_id = tr.id
       WHERE tc.task_id = $1
       ORDER BY tc.completed_at DESC`,
      [taskId]
    );

    res.json({ completions: result.rows });
  } catch (error) {
    console.error('Get completions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteCompletion = async (req: AuthRequest, res: Response) => {
  try {
    const { completionId } = req.params;
    const userId = req.user!.id;

    // Get completion
    const completionResult = await query(
      `SELECT tc.*, t.organization_id
       FROM task_completions tc
       INNER JOIN tasks t ON tc.task_id = t.id
       WHERE tc.id = $1`,
      [completionId]
    );

    if (completionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Completion not found' });
    }

    const completion = completionResult.rows[0];

    // Check if user is admin or completion owner
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [completion.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this completion' });
    }

    const isAdmin = memberCheck.rows[0].role === 'admin';
    const isOwner = completion.user_id === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Only admins or completion owners can delete completions' });
    }

    // Track file deletion for billing if file was attached
    const fileSize = completion.file_size_bytes || 0;
    if (fileSize > 0 && isBillingEnabled()) {
      await trackFileDelete(completion.organization_id, completion.user_id, fileSize);
    }

    // Delete completion
    await query('DELETE FROM task_completions WHERE id = $1', [completionId]);

    // If it was linked to a requirement, unmark the requirement
    if (completion.requirement_id) {
      await query(
        `UPDATE task_requirements
         SET completed = false, completed_at = NULL
         WHERE id = $1`,
        [completion.requirement_id]
      );
    }

    res.json({ message: 'Completion deleted successfully' });
  } catch (error) {
    console.error('Delete completion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
