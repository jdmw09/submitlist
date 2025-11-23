import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import { logAudit, createChangesObject, getTaskAuditLogs } from '../utils/auditLogger';

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const {
      organizationId,
      title,
      details,
      assignedUserId,
      assignedUserIds,
      isPrivate,
      startDate,
      endDate,
      scheduleType = 'one_time',
      scheduleFrequency = 1,
      requirements = [],
    } = req.body;

    const userId = req.user!.id;

    // Validate required fields
    if (!organizationId || !title) {
      return res.status(400).json({ error: 'Organization ID and title are required' });
    }

    // Check if user is a member of the organization
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Determine assignee user IDs (support both single and multi-assignee)
    let assigneeIds: number[] = [];
    if (assignedUserIds && Array.isArray(assignedUserIds)) {
      assigneeIds = assignedUserIds;
    } else if (assignedUserId) {
      assigneeIds = [assignedUserId];
    }

    // Verify all assignees are members of the organization
    for (const assigneeId of assigneeIds) {
      const assigneeCheck = await query(
        'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [organizationId, assigneeId]
      );

      if (assigneeCheck.rows.length === 0) {
        return res.status(400).json({ error: `User ${assigneeId} is not a member of this organization` });
      }
    }

    // Create task (remove assigned_user_id from insert, use task_assignees table instead)
    const taskResult = await query(
      `INSERT INTO tasks (organization_id, title, details, created_by_id, start_date, end_date, schedule_type, schedule_frequency, status, is_private)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        organizationId,
        title,
        details,
        userId,
        startDate,
        endDate,
        scheduleType,
        scheduleFrequency,
        'in_progress',
        isPrivate || false,
      ]
    );

    const task = taskResult.rows[0];

    // Add requirements if provided
    if (requirements.length > 0) {
      for (let i = 0; i < requirements.length; i++) {
        await query(
          'INSERT INTO task_requirements (task_id, description, order_index) VALUES ($1, $2, $3)',
          [task.id, requirements[i], i]
        );
      }
    }

    // Add assignees to task_assignees table
    for (const assigneeId of assigneeIds) {
      await query(
        `INSERT INTO task_assignees (task_id, user_id, assigned_by_id, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (task_id, user_id) DO NOTHING`,
        [task.id, assigneeId, userId]
      );

      // Create notification for assigned user
      if (assigneeId !== userId) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, task_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            assigneeId,
            'task_assigned',
            'New task assigned',
            `You have been assigned to: ${title}`,
            task.id,
          ]
        );
      }
    }

    // Log audit entry
    await logAudit({
      task_id: task.id,
      user_id: userId,
      action: 'created',
      entity_type: 'task',
      entity_id: task.id,
      metadata: {
        assigned_user_id: assignedUserId,
        schedule_type: scheduleType,
      },
    });

    // Get task with requirements
    const taskWithRequirements = await getTaskById(task.id);

    res.status(201).json({
      message: 'Task created successfully',
      task: taskWithRequirements,
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { status, assignedToMe, sort, hideCompleted } = req.query;
    const userId = req.user!.id;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Get organization settings for default sort
    const settingsResult = await query(
      'SELECT default_task_sort, hide_completed_tasks FROM organization_settings WHERE organization_id = $1',
      [organizationId]
    );
    const orgSettings = settingsResult.rows[0] || { default_task_sort: 'due_date', hide_completed_tasks: false };

    // Build query with private task filtering and exclude archived tasks
    let queryText = `
      SELECT t.*,
             u.name as assigned_user_name,
             c.name as created_by_name,
             COUNT(DISTINCT tr.id) as total_requirements,
             COUNT(DISTINCT CASE WHEN tr.completed = true THEN tr.id END) as completed_requirements
      FROM tasks t
      LEFT JOIN users u ON t.assigned_user_id = u.id
      LEFT JOIN users c ON t.created_by_id = c.id
      LEFT JOIN task_requirements tr ON t.id = tr.task_id
      WHERE t.organization_id = $1
        AND t.archived_at IS NULL
        AND (
          t.is_private = false
          OR t.is_private IS NULL
          OR t.created_by_id = $2
          OR EXISTS (
            SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = $2
          )
        )
    `;

    const params: any[] = [organizationId, userId];
    let paramIndex = 3;

    if (status) {
      queryText += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Hide completed tasks based on query param or org settings
    const shouldHideCompleted = hideCompleted === 'true' || (hideCompleted !== 'false' && orgSettings.hide_completed_tasks);
    if (shouldHideCompleted) {
      queryText += ` AND t.status != 'completed'`;
    }

    if (assignedToMe === 'true') {
      queryText += ` AND (t.assigned_user_id = $${paramIndex} OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $${paramIndex}))`;
      params.push(userId);
      paramIndex++;
    }

    queryText += ` GROUP BY t.id, u.name, c.name`;

    // Determine sort order - use query param or fall back to org settings
    const sortOrder = sort || orgSettings.default_task_sort;

    if (sortOrder === 'priority') {
      // Priority sort: status order (overdue first, then pending, in_progress, submitted, completed last), then by due date
      queryText += `
        ORDER BY
          CASE t.status
            WHEN 'overdue' THEN 0
            WHEN 'pending' THEN 1
            WHEN 'in_progress' THEN 2
            WHEN 'submitted' THEN 3
            WHEN 'completed' THEN 4
            ELSE 5
          END,
          t.end_date ASC NULLS LAST,
          t.created_at DESC
      `;
    } else {
      // Default: due_date sort - upcoming deadlines first, null dates at end
      queryText += `
        ORDER BY
          CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END,
          t.end_date ASC NULLS LAST,
          t.created_at DESC
      `;
    }

    const result = await query(queryText, params);

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    const task = await getTaskById(parseInt(taskId));

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user is a member of the organization
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // If task is private, check if user is creator or assignee
    if (task.is_private) {
      const isCreator = task.created_by_id === userId;

      // Check if user is assigned to this task
      const assigneeCheck = await query(
        'SELECT id FROM task_assignees WHERE task_id = $1 AND user_id = $2',
        [task.id, userId]
      );
      const isAssignee = assigneeCheck.rows.length > 0;

      if (!isCreator && !isAssignee) {
        return res.status(403).json({ error: 'You do not have access to this private task' });
      }
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const {
      title,
      details,
      assignedUserId,
      startDate,
      endDate,
      status,
    } = req.body;
    const userId = req.user!.id;

    // Get existing task
    const existingTask = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);

    if (existingTask.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = existingTask.rows[0];

    // Check if user is a member and get their role
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Only task creator or org admin can edit tasks
    const isTaskCreator = task.created_by_id === userId;
    const isOrgAdmin = memberCheck.rows[0].role === 'admin';

    if (!isTaskCreator && !isOrgAdmin) {
      return res.status(403).json({ error: 'Only the task creator or organization admin can edit this task' });
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (details !== undefined) {
      updates.push(`details = $${paramIndex++}`);
      params.push(details);
    }
    if (assignedUserId !== undefined) {
      updates.push(`assigned_user_id = $${paramIndex++}`);
      params.push(assignedUserId);
    }
    if (startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      params.push(endDate);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(taskId);

    await query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    const updatedTask = await getTaskById(parseInt(taskId));

    // Log audit entry with changes
    const changes = createChangesObject(
      {
        title: task.title,
        details: task.details,
        assigned_user_id: task.assigned_user_id,
        start_date: task.start_date,
        end_date: task.end_date,
        status: task.status,
      },
      {
        title: title !== undefined ? title : task.title,
        details: details !== undefined ? details : task.details,
        assigned_user_id: assignedUserId !== undefined ? assignedUserId : task.assigned_user_id,
        start_date: startDate !== undefined ? startDate : task.start_date,
        end_date: endDate !== undefined ? endDate : task.end_date,
        status: status !== undefined ? status : task.status,
      }
    );

    if (Object.keys(changes).length > 0) {
      await logAudit({
        task_id: parseInt(taskId),
        user_id: userId,
        action: status !== undefined ? 'status_changed' : 'updated',
        entity_type: 'task',
        entity_id: parseInt(taskId),
        changes,
      });
    }

    res.json({
      message: 'Task updated successfully',
      task: updatedTask,
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { deleteFiles } = req.body;
    const userId = req.user!.id;

    // Get task
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is admin or task creator
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const isAdmin = memberCheck.rows[0].role === 'admin';
    const isCreator = task.created_by_id === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only admins or task creators can delete tasks' });
    }

    // Delete associated files if requested
    if (deleteFiles) {
      const completionsResult = await query(
        'SELECT file_path FROM task_completions WHERE task_id = $1 AND file_path IS NOT NULL',
        [taskId]
      );

      let deletedFilesCount = 0;
      let failedFilesCount = 0;

      for (const completion of completionsResult.rows) {
        try {
          // Parse file paths (can be JSON array or single path)
          let filePaths: string[] = [];
          if (completion.file_path) {
            try {
              filePaths = JSON.parse(completion.file_path);
            } catch {
              filePaths = [completion.file_path];
            }
          }

          // Delete each file
          for (const filePath of filePaths) {
            try {
              const fullPath = path.join(__dirname, '../../uploads', path.basename(filePath));
              if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
                deletedFilesCount++;
              }
            } catch (fileError) {
              console.error(`Failed to delete file ${filePath}:`, fileError);
              failedFilesCount++;
            }
          }
        } catch (parseError) {
          console.error('Error parsing file paths:', parseError);
          failedFilesCount++;
        }
      }

      console.log(`Deleted ${deletedFilesCount} files, ${failedFilesCount} failures`);
    }

    // Log audit entry before deleting
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'deleted',
      entity_type: 'task',
      entity_id: parseInt(taskId),
      metadata: {
        files_deleted: deleteFiles || false,
      },
    });

    // Delete task (cascade will handle related records)
    await query('DELETE FROM tasks WHERE id = $1', [taskId]);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { requirementId } = req.params;
    const { completed } = req.body;
    const userId = req.user!.id;

    // Get requirement and task
    const reqResult = await query(
      `SELECT tr.*, t.organization_id
       FROM task_requirements tr
       INNER JOIN tasks t ON tr.task_id = t.id
       WHERE tr.id = $1`,
      [requirementId]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    const requirement = reqResult.rows[0];

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [requirement.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Update requirement
    await query(
      `UPDATE task_requirements
       SET completed = $1, completed_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2`,
      [completed, requirementId]
    );

    // Log audit entry
    await logAudit({
      task_id: requirement.task_id,
      user_id: userId,
      action: 'requirement_completed',
      entity_type: 'requirement',
      entity_id: parseInt(requirementId),
      changes: {
        completed: {
          before: requirement.completed,
          after: completed,
        },
      },
    });

    res.json({ message: 'Requirement updated successfully' });
  } catch (error) {
    console.error('Update requirement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to get task with all related data
async function getTaskById(taskId: number) {
  const taskResult = await query(
    `SELECT t.*,
            u.name as assigned_user_name,
            u.email as assigned_user_email,
            c.name as created_by_name,
            c.email as created_by_email
     FROM tasks t
     LEFT JOIN users u ON t.assigned_user_id = u.id
     LEFT JOIN users c ON t.created_by_id = c.id
     WHERE t.id = $1`,
    [taskId]
  );

  if (taskResult.rows.length === 0) {
    return null;
  }

  const task = taskResult.rows[0];

  // Get requirements
  const requirementsResult = await query(
    'SELECT * FROM task_requirements WHERE task_id = $1 ORDER BY order_index',
    [taskId]
  );

  // Get completions
  const completionsResult = await query(
    `SELECT tc.*, u.name as user_name
     FROM task_completions tc
     LEFT JOIN users u ON tc.user_id = u.id
     WHERE tc.task_id = $1
     ORDER BY tc.completed_at DESC`,
    [taskId]
  );

  return {
    ...task,
    requirements: requirementsResult.rows,
    completions: completionsResult.rows,
  };
}

export const submitTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task details
    const taskResult = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is assigned to this task (multi-assignee support)
    const assigneeCheck = await query(
      'SELECT id FROM task_assignees WHERE task_id = $1 AND user_id = $2',
      [taskId, userId]
    );

    // Also check legacy assigned_user_id for backward compatibility
    const isAssigned = assigneeCheck.rows.length > 0 || task.assigned_user_id === userId;

    if (!isAssigned) {
      return res.status(403).json({ error: 'Only assigned users can submit this task' });
    }

    // Update task status to submitted
    await query(
      'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['submitted', taskId]
    );

    // Create notification for task creator
    await query(
      `INSERT INTO notifications (user_id, type, title, message, task_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        task.created_by_id,
        'task_submitted',
        'Task Submitted for Review',
        `${task.title} has been submitted for review`,
        taskId
      ]
    );

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'submitted',
      entity_type: 'task',
      entity_id: parseInt(taskId),
      changes: {
        status: {
          before: task.status,
          after: 'submitted',
        },
      },
    });

    res.json({ message: 'Task submitted successfully' });
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reviewTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { action, comments } = req.body; // action: 'approved' or 'rejected'
    const userId = req.user!.id;

    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be either "approved" or "rejected"' });
    }

    // Get task details
    const taskResult = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is task creator or org admin
    const isTaskCreator = task.created_by_id === userId;

    // Check if user is org admin
    const orgMemberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    const isOrgAdmin = orgMemberCheck.rows.length > 0 && orgMemberCheck.rows[0].role === 'admin';

    // Only task creator or org admin can review
    if (!isTaskCreator && !isOrgAdmin) {
      return res.status(403).json({ error: 'Only the task creator or organization admin can review this task' });
    }

    // Check if task is in submitted status
    if (task.status !== 'submitted') {
      return res.status(400).json({ error: 'Task must be submitted before it can be reviewed' });
    }

    // Create review record
    await query(
      `INSERT INTO task_reviews (task_id, reviewer_id, action, comments)
       VALUES ($1, $2, $3, $4)`,
      [taskId, userId, action, comments]
    );

    // Update task status based on action
    const newStatus = action === 'approved' ? 'completed' : 'in_progress';
    await query(
      'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newStatus, taskId]
    );

    // Create notification for assigned user
    if (task.assigned_user_id) {
      const notifType = action === 'approved' ? 'task_approved' : 'task_rejected';
      const notifTitle = action === 'approved' ? 'Task Approved' : 'Task Needs Revision';
      const notifMessage = action === 'approved'
        ? `Your submission for "${task.title}" has been approved`
        : `Your submission for "${task.title}" needs revision. ${comments || ''}`;

      await query(
        `INSERT INTO notifications (user_id, type, title, message, task_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [task.assigned_user_id, notifType, notifTitle, notifMessage, taskId]
      );
    }

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: action,
      entity_type: 'review',
      entity_id: parseInt(taskId),
      changes: {
        status: {
          before: 'submitted',
          after: newStatus,
        },
      },
      metadata: {
        comments,
      },
    });

    res.json({
      message: `Task ${action} successfully`,
      newStatus
    });
  } catch (error) {
    console.error('Review task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task to check permissions
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is a member of the organization
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Get audit logs
    const logs = await getTaskAuditLogs(parseInt(taskId));

    res.json({ logs });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== PHASE 1: MULTI-ASSIGNEE TASK MANAGEMENT =====

/**
 * POST /api/tasks/:taskId/assignees
 * Add one or more assignees to a task
 */
export const addTaskAssignees = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userIds } = req.body; // Array of user IDs
    const userId = req.user!.id;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }

    // Get task details
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is task creator or org admin
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const isAdmin = memberCheck.rows[0].role === 'admin';
    const isCreator = task.created_by_id === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only task creator or organization admin can assign users' });
    }

    // Verify all users are members of the organization
    for (const assigneeId of userIds) {
      const assigneeCheck = await query(
        'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [task.organization_id, assigneeId]
      );

      if (assigneeCheck.rows.length === 0) {
        return res.status(400).json({ error: `User ${assigneeId} is not a member of this organization` });
      }
    }

    // Add assignees (ignore duplicates)
    const addedAssignees = [];
    for (const assigneeId of userIds) {
      try {
        const result = await query(
          `INSERT INTO task_assignees (task_id, user_id, assigned_by_id, status)
           VALUES ($1, $2, $3, 'pending')
           ON CONFLICT (task_id, user_id) DO NOTHING
           RETURNING *`,
          [taskId, assigneeId, userId]
        );

        if (result.rows.length > 0) {
          addedAssignees.push(result.rows[0]);

          // Create notification
          await query(
            `INSERT INTO notifications (user_id, type, title, message, task_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [assigneeId, 'task_assigned', 'New task assigned', `You have been assigned to: ${task.title}`, taskId]
          );
        }
      } catch (err) {
        console.error(`Failed to add assignee ${assigneeId}:`, err);
      }
    }

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'assigned',
      entity_type: 'task_assignees',
      metadata: { assigned_users: userIds },
    });

    res.json({
      message: `${addedAssignees.length} assignee(s) added successfully`,
      assignees: addedAssignees,
    });
  } catch (error) {
    console.error('Add task assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/:taskId/assignees
 * Get all assignees for a task
 */
export const getTaskAssignees = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task to check permissions
    const taskResult = await query('SELECT organization_id FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [taskResult.rows[0].organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    // Get assignees with user details
    const result = await query(
      `SELECT ta.*, u.name as user_name, u.email as user_email,
              assigner.name as assigned_by_name
       FROM task_assignees ta
       INNER JOIN users u ON ta.user_id = u.id
       LEFT JOIN users assigner ON ta.assigned_by_id = assigner.id
       WHERE ta.task_id = $1
       ORDER BY ta.assigned_at DESC`,
      [taskId]
    );

    res.json({ assignees: result.rows });
  } catch (error) {
    console.error('Get task assignees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/tasks/:taskId/assignees/:assigneeId
 * Remove an assignee from a task
 */
export const removeTaskAssignee = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, assigneeId } = req.params;
    const userId = req.user!.id;

    // Get task details
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check permissions
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const isAdmin = memberCheck.rows[0].role === 'admin';
    const isCreator = task.created_by_id === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only task creator or organization admin can remove assignees' });
    }

    // Remove assignee
    await query(
      'DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2',
      [taskId, assigneeId]
    );

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'unassigned',
      entity_type: 'task_assignees',
      metadata: { removed_user_id: assigneeId },
    });

    res.json({ message: 'Assignee removed successfully' });
  } catch (error) {
    console.error('Remove task assignee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/tasks/:taskId/assignees/:assigneeId/complete
 * Mark task as completed by an assignee (multi-assignee: ANY assignee completing marks task as done)
 */
export const completeTaskByAssignee = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, assigneeId } = req.params;
    const userId = req.user!.id;

    // Verify user is the assignee
    if (parseInt(assigneeId) !== userId) {
      return res.status(403).json({ error: 'You can only complete tasks assigned to you' });
    }

    // Get task details
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is assigned to this task
    const assigneeCheck = await query(
      'SELECT * FROM task_assignees WHERE task_id = $1 AND user_id = $2',
      [taskId, userId]
    );

    if (assigneeCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not assigned to this task' });
    }

    // Update assignee status to completed
    await query(
      `UPDATE task_assignees
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE task_id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    // Per the decision: ANY assignee finishing completes the task
    await query(
      'UPDATE tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['completed', taskId]
    );

    // Notify task creator
    await query(
      `INSERT INTO notifications (user_id, type, title, message, task_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [task.created_by_id, 'task_completed', 'Task Completed', `${task.title} has been completed`, taskId]
    );

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'completed',
      entity_type: 'task_assignees',
      changes: {
        status: {
          before: task.status,
          after: 'completed',
        },
      },
    });

    res.json({ message: 'Task completed successfully' });
  } catch (error) {
    console.error('Complete task by assignee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== TASK COPY =====

/**
 * POST /api/tasks/:taskId/copy
 * Copy a task to create a new one (useful for re-doing completed tasks)
 */
export const copyTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { title, endDate, assignedUserIds } = req.body;
    const userId = req.user!.id;

    // Get original task
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const originalTask = taskResult.rows[0];

    // Check if user is a member of the organization
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [originalTask.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Create new task with copied data
    const newTaskResult = await query(
      `INSERT INTO tasks (
        organization_id, title, details, created_by_id, start_date, end_date,
        schedule_type, schedule_frequency, status, is_private
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        originalTask.organization_id,
        title || `${originalTask.title} (Copy)`,
        originalTask.details,
        userId,
        null, // Reset start date
        endDate || null, // Use provided end date or null
        originalTask.schedule_type,
        originalTask.schedule_frequency,
        'in_progress', // Always start as in_progress
        originalTask.is_private
      ]
    );

    const newTask = newTaskResult.rows[0];

    // Copy requirements (reset completion status)
    const requirementsResult = await query(
      'SELECT description, order_index FROM task_requirements WHERE task_id = $1 ORDER BY order_index',
      [taskId]
    );

    for (const req of requirementsResult.rows) {
      await query(
        'INSERT INTO task_requirements (task_id, description, order_index, completed) VALUES ($1, $2, $3, false)',
        [newTask.id, req.description, req.order_index]
      );
    }

    // Add assignees if provided
    let assigneeIds: number[] = [];
    if (assignedUserIds && Array.isArray(assignedUserIds)) {
      assigneeIds = assignedUserIds;
    }

    for (const assigneeId of assigneeIds) {
      await query(
        `INSERT INTO task_assignees (task_id, user_id, assigned_by_id, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (task_id, user_id) DO NOTHING`,
        [newTask.id, assigneeId, userId]
      );

      // Notify assignees
      if (assigneeId !== userId) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, task_id)
           VALUES ($1, 'task_assigned', 'New task assigned', $2, $3)`,
          [assigneeId, `You have been assigned to: ${newTask.title}`, newTask.id]
        );
      }
    }

    // Log audit entry
    await logAudit({
      task_id: newTask.id,
      user_id: userId,
      action: 'created',
      entity_type: 'task',
      entity_id: newTask.id,
      metadata: { copied_from_task_id: taskId },
    });

    const taskWithDetails = await getTaskById(newTask.id);

    res.status(201).json({
      message: 'Task copied successfully',
      task: taskWithDetails,
    });
  } catch (error) {
    console.error('Copy task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== TASK ARCHIVE =====

/**
 * POST /api/tasks/:taskId/archive
 * Archive a completed task
 */
export const archiveTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task details
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    // Check if user is admin or creator
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const isAdmin = memberCheck.rows[0].role === 'admin';
    const isCreator = task.created_by_id === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only task creator or organization admin can archive tasks' });
    }

    // Archive the task
    await query(
      'UPDATE tasks SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [taskId]
    );

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'archived',
      entity_type: 'task',
      entity_id: parseInt(taskId),
    });

    res.json({ message: 'Task archived successfully' });
  } catch (error) {
    console.error('Archive task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/tasks/:taskId/unarchive
 * Restore an archived task
 */
export const unarchiveTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task details
    const taskResult = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];

    if (!task.archived_at) {
      return res.status(400).json({ error: 'Task is not archived' });
    }

    // Check if user is admin or creator
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [task.organization_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this task' });
    }

    const isAdmin = memberCheck.rows[0].role === 'admin';
    const isCreator = task.created_by_id === userId;

    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only task creator or organization admin can unarchive tasks' });
    }

    // Unarchive the task
    await query(
      'UPDATE tasks SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [taskId]
    );

    // Log audit entry
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'unarchived',
      entity_type: 'task',
      entity_id: parseInt(taskId),
    });

    res.json({ message: 'Task unarchived successfully' });
  } catch (error) {
    console.error('Unarchive task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/tasks/organization/:organizationId/archived
 * Get archived tasks for an organization
 */
export const getArchivedTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.id;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    const result = await query(
      `SELECT t.*,
              c.name as created_by_name,
              COUNT(DISTINCT tr.id) as total_requirements,
              COUNT(DISTINCT CASE WHEN tr.completed = true THEN tr.id END) as completed_requirements
       FROM tasks t
       LEFT JOIN users c ON t.created_by_id = c.id
       LEFT JOIN task_requirements tr ON t.id = tr.task_id
       WHERE t.organization_id = $1
         AND t.archived_at IS NOT NULL
         AND (
           t.is_private = false
           OR t.is_private IS NULL
           OR t.created_by_id = $2
           OR EXISTS (
             SELECT 1 FROM task_assignees ta
             WHERE ta.task_id = t.id AND ta.user_id = $2
           )
         )
       GROUP BY t.id, c.name
       ORDER BY t.archived_at DESC`,
      [organizationId, userId]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get archived tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
