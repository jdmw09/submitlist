import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import { logAudit } from '../utils/auditLogger';

// Get comments for a task
export const getTaskComments = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Verify user has access to this task (member of organization)
    const taskAccess = await query(
      `SELECT t.id, t.organization_id, t.is_private, t.created_by_id
       FROM tasks t
       JOIN organization_members om ON t.organization_id = om.organization_id
       WHERE t.id = $1 AND om.user_id = $2`,
      [taskId, userId]
    );

    if (taskAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const task = taskAccess.rows[0];

    // Check private task access
    if (task.is_private && task.created_by_id !== userId) {
      const isAssignee = await query(
        'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
        [taskId, userId]
      );
      if (isAssignee.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to private task' });
      }
    }

    // Get all comments with user info, ordered by creation date
    const comments = await query(
      `SELECT c.*, u.name as user_name, u.email as user_email
       FROM task_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    res.json({ comments: comments.rows });
  } catch (error) {
    console.error('Get task comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Add a comment to a task
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user!.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify user has access to this task
    const taskAccess = await query(
      `SELECT t.id, t.organization_id, t.is_private, t.created_by_id, t.title
       FROM tasks t
       JOIN organization_members om ON t.organization_id = om.organization_id
       WHERE t.id = $1 AND om.user_id = $2`,
      [taskId, userId]
    );

    if (taskAccess.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }

    const task = taskAccess.rows[0];

    // Check private task access
    if (task.is_private && task.created_by_id !== userId) {
      const isAssignee = await query(
        'SELECT 1 FROM task_assignees WHERE task_id = $1 AND user_id = $2',
        [taskId, userId]
      );
      if (isAssignee.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to private task' });
      }
    }

    // If parentId provided, verify it exists and belongs to same task
    if (parentId) {
      const parentComment = await query(
        'SELECT id FROM task_comments WHERE id = $1 AND task_id = $2',
        [parentId, taskId]
      );
      if (parentComment.rows.length === 0) {
        return res.status(400).json({ error: 'Parent comment not found' });
      }
    }

    // Insert the comment
    const result = await query(
      `INSERT INTO task_comments (task_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [taskId, userId, content.trim(), parentId || null]
    );

    const comment = result.rows[0];

    // Get user info for response
    const userResult = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    comment.user_name = userResult.rows[0].name;
    comment.user_email = userResult.rows[0].email;

    // Log the action
    await logAudit({
      task_id: parseInt(taskId),
      user_id: userId,
      action: 'comment_added',
      entity_type: 'comment',
      entity_id: comment.id,
      changes: { content: content.trim() }
    });

    // Create notifications for task creator and assignees (except commenter)
    const notifyUsers = await query(
      `SELECT DISTINCT user_id FROM (
        SELECT created_by_id as user_id FROM tasks WHERE id = $1
        UNION
        SELECT user_id FROM task_assignees WHERE task_id = $1
      ) all_users
      WHERE user_id != $2`,
      [taskId, userId]
    );

    const commenterName = userResult.rows[0].name;
    for (const row of notifyUsers.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, task_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          row.user_id,
          'task_comment',
          'New comment on task',
          `${commenterName} commented on "${task.title}"`,
          taskId
        ]
      );
    }

    res.status(201).json({ message: 'Comment added', comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a comment
export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Verify user owns this comment
    const commentResult = await query(
      'SELECT * FROM task_comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    // Update the comment
    const result = await query(
      `UPDATE task_comments
       SET content = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [content.trim(), commentId]
    );

    const updatedComment = result.rows[0];

    // Get user info
    const userResult = await query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    updatedComment.user_name = userResult.rows[0].name;
    updatedComment.user_email = userResult.rows[0].email;

    // Log the action
    await logAudit({
      task_id: comment.task_id,
      user_id: userId,
      action: 'comment_updated',
      entity_type: 'comment',
      entity_id: comment.id,
      changes: { before: comment.content, after: content.trim() }
    });

    res.json({ message: 'Comment updated', comment: updatedComment });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a comment
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user!.id;

    // Get the comment
    const commentResult = await query(
      'SELECT * FROM task_comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    // Check if user owns the comment OR is an org admin
    const isAdmin = await query(
      `SELECT om.role FROM organization_members om
       JOIN tasks t ON t.organization_id = om.organization_id
       WHERE t.id = $1 AND om.user_id = $2 AND om.role = 'admin'`,
      [comment.task_id, userId]
    );

    if (comment.user_id !== userId && isAdmin.rows.length === 0) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Delete the comment (cascades to replies)
    await query('DELETE FROM task_comments WHERE id = $1', [commentId]);

    // Log the action
    await logAudit({
      task_id: comment.task_id,
      user_id: userId,
      action: 'comment_deleted',
      entity_type: 'comment',
      entity_id: comment.id,
      changes: { content: comment.content }
    });

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
