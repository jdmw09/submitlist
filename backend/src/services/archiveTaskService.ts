import cron from 'node-cron';
import { query } from '../config/database';

export function startArchiveTaskService() {
  // Run every day at 1 AM (after scheduled task service at midnight)
  cron.schedule('0 1 * * *', async () => {
    console.log('Running daily archive task check...');
    await archiveCompletedTasks('daily');
  });

  // Run every Sunday at 2 AM
  cron.schedule('0 2 * * 0', async () => {
    console.log('Running weekly (Sunday) archive task check...');
    await archiveCompletedTasks('weekly_sunday');
  });

  // Run every Monday at 2 AM
  cron.schedule('0 2 * * 1', async () => {
    console.log('Running weekly (Monday) archive task check...');
    await archiveCompletedTasks('weekly_monday');
  });

  console.log('Archive task service started');
}

/**
 * Archive completed tasks based on organization settings
 * @param scheduleType - 'daily', 'weekly_sunday', or 'weekly_monday'
 */
async function archiveCompletedTasks(scheduleType: string) {
  try {
    const now = new Date();

    // Get all organizations with auto-archive enabled and matching schedule
    const orgsResult = await query(
      `SELECT os.*, o.name as organization_name
       FROM organization_settings os
       INNER JOIN organizations o ON os.organization_id = o.id
       WHERE os.auto_archive_enabled = true
         AND os.archive_schedule = $1`,
      [scheduleType]
    );

    let totalArchived = 0;

    for (const orgSettings of orgsResult.rows) {
      const archivedCount = await archiveOrgTasks(orgSettings, now);
      totalArchived += archivedCount;

      if (archivedCount > 0) {
        console.log(`Archived ${archivedCount} tasks for organization: ${orgSettings.organization_name}`);
      }
    }

    console.log(`Archive task service completed. Total tasks archived: ${totalArchived}`);
  } catch (error) {
    console.error('Error in archive task service:', error);
  }
}

/**
 * Archive tasks for a specific organization based on its settings
 */
async function archiveOrgTasks(orgSettings: any, now: Date): Promise<number> {
  try {
    const { organization_id, auto_archive_after_days } = orgSettings;

    // Calculate the cutoff date
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - auto_archive_after_days);

    // Find completed tasks older than the cutoff that aren't already archived
    const tasksToArchive = await query(
      `SELECT id, title FROM tasks
       WHERE organization_id = $1
         AND status = 'completed'
         AND archived_at IS NULL
         AND updated_at < $2`,
      [organization_id, cutoffDate]
    );

    if (tasksToArchive.rows.length === 0) {
      return 0;
    }

    // Archive the tasks
    const taskIds = tasksToArchive.rows.map((t: any) => t.id);

    await query(
      `UPDATE tasks
       SET archived_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1)`,
      [taskIds]
    );

    // Log audit entries for archived tasks
    for (const task of tasksToArchive.rows) {
      await query(
        `INSERT INTO task_audit_logs (task_id, user_id, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          task.id,
          0, // System action (no user)
          'auto_archived',
          'task',
          task.id,
          JSON.stringify({
            auto_archive_after_days,
            schedule_type: orgSettings.archive_schedule,
          }),
        ]
      );
    }

    return tasksToArchive.rows.length;
  } catch (error) {
    console.error(`Error archiving tasks for org ${orgSettings.organization_id}:`, error);
    return 0;
  }
}

/**
 * Manually trigger archive check for an organization (useful for testing)
 */
export async function manualArchiveCheck(organizationId: number): Promise<{ archived: number }> {
  try {
    const settingsResult = await query(
      `SELECT os.*, o.name as organization_name
       FROM organization_settings os
       INNER JOIN organizations o ON os.organization_id = o.id
       WHERE os.organization_id = $1
         AND os.auto_archive_enabled = true`,
      [organizationId]
    );

    if (settingsResult.rows.length === 0) {
      return { archived: 0 };
    }

    const archived = await archiveOrgTasks(settingsResult.rows[0], new Date());
    return { archived };
  } catch (error) {
    console.error('Error in manual archive check:', error);
    return { archived: 0 };
  }
}

export { archiveCompletedTasks };
