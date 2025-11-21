import { query } from '../config/database';

export interface AuditLogEntry {
  task_id: number;
  user_id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Creates an audit log entry for task-related actions
 */
export const logAudit = async (entry: AuditLogEntry): Promise<void> => {
  try {
    await query(
      `INSERT INTO task_audit_logs
       (task_id, user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.task_id,
        entry.user_id,
        entry.action,
        entry.entity_type || null,
        entry.entity_id || null,
        entry.changes ? JSON.stringify(entry.changes) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break normal operations
  }
};

/**
 * Helper to create changes object for updates
 */
export const createChangesObject = (before: Record<string, any>, after: Record<string, any>): Record<string, any> => {
  const changes: Record<string, any> = {};

  // Find all changed fields
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changes[key] = {
        before: before[key],
        after: after[key],
      };
    }
  }

  return changes;
};

/**
 * Get audit logs for a specific task
 */
export const getTaskAuditLogs = async (taskId: number) => {
  const result = await query(
    `SELECT
       tal.*,
       u.name as user_name,
       u.email as user_email
     FROM task_audit_logs tal
     LEFT JOIN users u ON tal.user_id = u.id
     WHERE tal.task_id = $1
     ORDER BY tal.created_at DESC`,
    [taskId]
  );

  return result.rows;
};
