import cron from 'node-cron';
import { query } from '../config/database';

export function startScheduledTaskService() {
  // Run every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running scheduled task generator...');
    await generateScheduledTasks();
  });

  console.log('Scheduled task service started');
}

async function generateScheduledTasks() {
  try {
    const now = new Date();

    // Find all scheduled tasks that should generate new instances
    const scheduledTasks = await query(
      `SELECT * FROM tasks
       WHERE schedule_type != 'one_time'
       AND (parent_template_id IS NULL OR id = parent_template_id)
       AND start_date <= $1
       AND (end_date IS NULL OR end_date >= $1)`,
      [now]
    );

    for (const template of scheduledTasks.rows) {
      // Check if we need to create a new instance today
      const shouldCreate = await shouldCreateTaskInstance(template, now);

      if (shouldCreate) {
        await createTaskInstance(template, now);
      }
    }

    // Update overdue tasks
    await query(
      `UPDATE tasks
       SET status = 'overdue'
       WHERE status IN ('pending', 'in_progress')
       AND end_date < $1`,
      [now]
    );

    console.log('Scheduled task generation completed');
  } catch (error) {
    console.error('Error generating scheduled tasks:', error);
  }
}

async function shouldCreateTaskInstance(template: any, date: Date): Promise<boolean> {
  // Check if an instance already exists for today
  const existingInstance = await query(
    `SELECT id FROM tasks
     WHERE parent_template_id = $1
     AND DATE(created_at) = DATE($2)`,
    [template.id, date]
  );

  if (existingInstance.rows.length > 0) {
    return false;
  }

  // Check based on schedule type
  switch (template.schedule_type) {
    case 'daily':
      return true;

    case 'weekly':
      const dayOfWeek = date.getDay();
      const templateDayOfWeek = new Date(template.start_date).getDay();
      return dayOfWeek === templateDayOfWeek;

    case 'monthly':
      const dayOfMonth = date.getDate();
      const templateDayOfMonth = new Date(template.start_date).getDate();
      return dayOfMonth === templateDayOfMonth;

    default:
      return false;
  }
}

async function createTaskInstance(template: any, date: Date) {
  try {
    // Calculate end date based on schedule type
    let endDate = new Date(date);
    switch (template.schedule_type) {
      case 'daily':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
    }

    // Create new task instance
    const taskResult = await query(
      `INSERT INTO tasks (
        organization_id, title, details, assigned_user_id, created_by_id,
        start_date, end_date, schedule_type, schedule_frequency, status, parent_template_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        template.organization_id,
        template.title,
        template.details,
        template.assigned_user_id,
        template.created_by_id,
        date,
        endDate,
        template.schedule_type,
        template.schedule_frequency,
        'pending',
        template.id,
      ]
    );

    const newTaskId = taskResult.rows[0].id;

    // Copy requirements from template
    const requirements = await query(
      'SELECT description, order_index FROM task_requirements WHERE task_id = $1',
      [template.id]
    );

    for (const req of requirements.rows) {
      await query(
        'INSERT INTO task_requirements (task_id, description, order_index) VALUES ($1, $2, $3)',
        [newTaskId, req.description, req.order_index]
      );
    }

    // Create notification for assigned user
    if (template.assigned_user_id) {
      await query(
        `INSERT INTO notifications (user_id, type, title, message, task_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          template.assigned_user_id,
          'task_assigned',
          'New scheduled task',
          `A new instance of "${template.title}" has been created`,
          newTaskId,
        ]
      );
    }

    console.log(`Created task instance ${newTaskId} from template ${template.id}`);
  } catch (error) {
    console.error(`Error creating task instance from template ${template.id}:`, error);
  }
}

export { generateScheduledTasks };
