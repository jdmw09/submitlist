import cron from 'node-cron';
import { query } from '../config/database';

export function startScheduledTaskService() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[ScheduledTaskService] Running scheduled task generator...');
    await generateScheduledTasks();
  });

  console.log('[ScheduledTaskService] Service started - runs daily at midnight');
}

async function generateScheduledTasks() {
  try {
    const now = new Date();
    let tasksCreated = 0;
    let tasksChecked = 0;

    // Find all recurring task templates (not archived, not one_time)
    const scheduledTasks = await query(
      `SELECT t.*,
              COALESCE(t.last_generated_at, t.start_date) as last_gen
       FROM tasks t
       WHERE t.schedule_type != 'one_time'
       AND t.parent_template_id IS NULL
       AND t.archived_at IS NULL
       AND t.start_date <= $1
       AND (t.end_date IS NULL OR t.end_date >= $1)`,
      [now]
    );

    console.log(`[ScheduledTaskService] Found ${scheduledTasks.rows.length} recurring task templates`);

    for (const template of scheduledTasks.rows) {
      tasksChecked++;

      // Check if we need to create a new instance
      const shouldCreate = await shouldCreateTaskInstance(template, now);

      if (shouldCreate) {
        await createTaskInstance(template, now);
        tasksCreated++;
      }
    }

    // Update overdue tasks
    const overdueResult = await query(
      `UPDATE tasks
       SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
       WHERE status IN ('pending', 'in_progress')
       AND end_date < $1
       AND archived_at IS NULL
       RETURNING id`,
      [now]
    );

    console.log(`[ScheduledTaskService] Completed - Created ${tasksCreated} tasks, Checked ${tasksChecked} templates, Marked ${overdueResult.rows.length} overdue`);
  } catch (error) {
    console.error('[ScheduledTaskService] Error generating scheduled tasks:', error);
  }
}

async function shouldCreateTaskInstance(template: any, date: Date): Promise<boolean> {
  const lastGenerated = new Date(template.last_gen || template.start_date);
  const frequency = template.schedule_frequency || 1;

  // Calculate days since last generation
  const daysSinceLastGen = Math.floor((date.getTime() - lastGenerated.getTime()) / (1000 * 60 * 60 * 24));

  // Check based on schedule type and frequency
  switch (template.schedule_type) {
    case 'daily':
      // Create if enough days have passed based on frequency
      return daysSinceLastGen >= frequency;

    case 'weekly':
      // Check if the right day of week and enough weeks have passed
      const dayOfWeek = date.getDay();
      const templateDayOfWeek = new Date(template.start_date).getDay();
      if (dayOfWeek !== templateDayOfWeek) return false;

      const weeksSinceLastGen = Math.floor(daysSinceLastGen / 7);
      return weeksSinceLastGen >= frequency;

    case 'monthly':
      // Check if the right day of month and enough months have passed
      const dayOfMonth = date.getDate();
      const templateDayOfMonth = new Date(template.start_date).getDate();

      // Handle end-of-month edge cases (e.g., 31st in a 30-day month)
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(templateDayOfMonth, lastDayOfMonth);

      if (dayOfMonth !== targetDay) return false;

      // Calculate months since last generation
      const monthsDiff = (date.getFullYear() - lastGenerated.getFullYear()) * 12
                        + (date.getMonth() - lastGenerated.getMonth());
      return monthsDiff >= frequency;

    default:
      return false;
  }
}

async function createTaskInstance(template: any, date: Date) {
  try {
    // Calculate end date based on schedule type
    let endDate = new Date(date);
    const frequency = template.schedule_frequency || 1;

    switch (template.schedule_type) {
      case 'daily':
        endDate.setDate(endDate.getDate() + frequency);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + (7 * frequency));
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + frequency);
        break;
    }

    // Create new task instance (as one_time - instances don't recurse)
    const taskResult = await query(
      `INSERT INTO tasks (
        organization_id, title, details, created_by_id,
        start_date, end_date, schedule_type, schedule_frequency,
        status, parent_template_id, is_private
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'one_time', 1, 'in_progress', $7, $8)
      RETURNING id`,
      [
        template.organization_id,
        template.title,
        template.details,
        template.created_by_id,
        date,
        endDate,
        template.id,
        template.is_private,
      ]
    );

    const newTaskId = taskResult.rows[0].id;

    // Copy requirements from template
    const requirements = await query(
      'SELECT description, order_index FROM task_requirements WHERE task_id = $1 ORDER BY order_index',
      [template.id]
    );

    for (const req of requirements.rows) {
      await query(
        'INSERT INTO task_requirements (task_id, description, order_index) VALUES ($1, $2, $3)',
        [newTaskId, req.description, req.order_index]
      );
    }

    // Copy assignees from template (multi-assignee support)
    const assignees = await query(
      'SELECT user_id, assigned_by_id FROM task_assignees WHERE task_id = $1',
      [template.id]
    );

    for (const assignee of assignees.rows) {
      await query(
        `INSERT INTO task_assignees (task_id, user_id, assigned_by_id, status)
         VALUES ($1, $2, $3, 'pending')`,
        [newTaskId, assignee.user_id, assignee.assigned_by_id || template.created_by_id]
      );

      // Create notification for each assignee
      await query(
        `INSERT INTO notifications (user_id, type, title, message, task_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          assignee.user_id,
          'task_assigned',
          'New recurring task',
          `A new instance of "${template.title}" has been created`,
          newTaskId,
        ]
      );
    }

    // Also handle legacy assigned_user_id if set and not in assignees
    if (template.assigned_user_id) {
      const existingAssignee = assignees.rows.find((a: any) => a.user_id === template.assigned_user_id);
      if (!existingAssignee) {
        // Update the legacy field for backwards compatibility
        await query(
          'UPDATE tasks SET assigned_user_id = $1 WHERE id = $2',
          [template.assigned_user_id, newTaskId]
        );

        await query(
          `INSERT INTO notifications (user_id, type, title, message, task_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            template.assigned_user_id,
            'task_assigned',
            'New recurring task',
            `A new instance of "${template.title}" has been created`,
            newTaskId,
          ]
        );
      }
    }

    // Update the template's last_generated_at timestamp
    await query(
      'UPDATE tasks SET last_generated_at = $1 WHERE id = $2',
      [date, template.id]
    );

    console.log(`[ScheduledTaskService] Created task #${newTaskId} from template #${template.id} (${template.title})`);
  } catch (error) {
    console.error(`[ScheduledTaskService] Error creating task from template #${template.id}:`, error);
  }
}

// Manual trigger for testing
export async function triggerTaskGeneration() {
  console.log('[ScheduledTaskService] Manual trigger initiated');
  await generateScheduledTasks();
}

export { generateScheduledTasks };
