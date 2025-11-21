import fs from 'fs';
import csv from 'csv-parser';
import { query } from '../config/database';

interface ImportRow {
  title: string;
  organization_id: string | number;
  details?: string;
  assigned_user_emails?: string;
  assigned_user_ids?: string;
  start_date?: string;
  end_date?: string;
  schedule_type?: string;
  schedule_frequency?: string | number;
  is_private?: string | boolean;
  group_id?: string | number;
  group_name?: string;
  requirements?: string;
  status?: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    tasksCreated: number;
    errors: ImportError[];
  };
  tasks?: any[];
}

interface ImportError {
  row: number;
  column?: string;
  error: string;
  data: any;
}

export class TaskImportService {
  // Parse CSV file
  async parseCSV(filePath: string): Promise<ImportRow[]> {
    const rows: ImportRow[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  // Validate row data
  async validateRow(
    row: ImportRow,
    rowIndex: number,
    orgId: number,
    userId: number
  ): Promise<{ valid: boolean; errors: ImportError[] }> {
    const errors: ImportError[] = [];

    // Required fields
    if (!row.title || row.title.trim() === '') {
      errors.push({
        row: rowIndex,
        column: 'title',
        error: 'Title is required',
        data: row,
      });
    }

    if (row.title && row.title.length > 255) {
      errors.push({
        row: rowIndex,
        column: 'title',
        error: 'Title must be 255 characters or less',
        data: row,
      });
    }

    // Validate dates
    if (row.start_date && !this.isValidDate(row.start_date)) {
      errors.push({
        row: rowIndex,
        column: 'start_date',
        error: 'Invalid date format. Use YYYY-MM-DD',
        data: row,
      });
    }

    if (row.end_date && !this.isValidDate(row.end_date)) {
      errors.push({
        row: rowIndex,
        column: 'end_date',
        error: 'Invalid date format. Use YYYY-MM-DD',
        data: row,
      });
    }

    // Validate end_date is after start_date
    if (row.start_date && row.end_date && this.isValidDate(row.start_date) && this.isValidDate(row.end_date)) {
      if (new Date(row.end_date) < new Date(row.start_date)) {
        errors.push({
          row: rowIndex,
          column: 'end_date',
          error: 'End date must be after start date',
          data: row,
        });
      }
    }

    // Validate schedule_type
    if (row.schedule_type) {
      const validTypes = ['one_time', 'daily', 'weekly', 'monthly'];
      if (!validTypes.includes(row.schedule_type)) {
        errors.push({
          row: rowIndex,
          column: 'schedule_type',
          error: `Schedule type must be one of: ${validTypes.join(', ')}`,
          data: row,
        });
      }
    }

    // Validate status
    if (row.status) {
      const validStatuses = ['pending', 'in_progress', 'submitted', 'completed'];
      if (!validStatuses.includes(row.status)) {
        errors.push({
          row: rowIndex,
          column: 'status',
          error: `Status must be one of: ${validStatuses.join(', ')}`,
          data: row,
        });
      }
    }

    // Validate assignees
    if (row.assigned_user_emails) {
      const emails = row.assigned_user_emails.split(',').map((e) => e.trim());
      if (emails.length > 50) {
        errors.push({
          row: rowIndex,
          column: 'assigned_user_emails',
          error: 'Maximum 50 assignees per task',
          data: row,
        });
      } else {
        const invalidEmails = await this.validateUserEmails(emails, orgId);
        if (invalidEmails.length > 0) {
          errors.push({
            row: rowIndex,
            column: 'assigned_user_emails',
            error: `Users not found: ${invalidEmails.join(', ')}`,
            data: row,
          });
        }
      }
    }

    // Validate group
    if (row.group_name) {
      const groupExists = await this.validateGroup(row.group_name, orgId);
      if (!groupExists) {
        errors.push({
          row: rowIndex,
          column: 'group_name',
          error: `Group '${row.group_name}' not found`,
          data: row,
        });
      }
    }

    if (row.group_id) {
      const groupExists = await this.validateGroupById(parseInt(String(row.group_id)), orgId);
      if (!groupExists) {
        errors.push({
          row: rowIndex,
          column: 'group_id',
          error: `Group with ID ${row.group_id} not found`,
          data: row,
        });
      }
    }

    // Validate requirements
    if (row.requirements) {
      const reqs = row.requirements.split('|').map((r) => r.trim()).filter((r) => r !== '');
      if (reqs.length > 50) {
        errors.push({
          row: rowIndex,
          column: 'requirements',
          error: 'Maximum 50 requirements per task',
          data: row,
        });
      }

      for (const req of reqs) {
        if (req.length > 500) {
          errors.push({
            row: rowIndex,
            column: 'requirements',
            error: 'Each requirement must be 500 characters or less',
            data: row,
          });
          break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Import tasks from CSV
  async importTasks(
    filePath: string,
    organizationId: number,
    userId: number,
    options: {
      validateOnly?: boolean;
      notifyAssignees?: boolean;
    } = {}
  ): Promise<ImportResult> {
    const rows = await this.parseCSV(filePath);
    const result: ImportResult = {
      success: false,
      message: '',
      stats: {
        totalRows: rows.length,
        validRows: 0,
        invalidRows: 0,
        tasksCreated: 0,
        errors: [],
      },
      tasks: [],
    };

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const validation = await this.validateRow(rows[i], i + 2, organizationId, userId); // +2 for header row

      if (validation.valid) {
        result.stats.validRows++;
      } else {
        result.stats.invalidRows++;
        result.stats.errors.push(...validation.errors);
      }
    }

    // If validateOnly, return validation results
    if (options.validateOnly) {
      result.success = result.stats.invalidRows === 0;
      result.message = result.success
        ? `All ${result.stats.validRows} rows are valid`
        : `${result.stats.invalidRows} rows have validation errors`;
      return result;
    }

    // Create tasks for valid rows
    for (let i = 0; i < rows.length; i++) {
      const validation = await this.validateRow(rows[i], i + 2, organizationId, userId);

      if (!validation.valid) {
        continue; // Skip invalid rows
      }

      try {
        const task = await this.createTaskFromRow(
          rows[i],
          organizationId,
          userId,
          options.notifyAssignees
        );

        result.tasks!.push(task);
        result.stats.tasksCreated++;
      } catch (error: any) {
        result.stats.errors.push({
          row: i + 2,
          error: error.message || 'Failed to create task',
          data: rows[i],
        });
      }
    }

    result.success = result.stats.tasksCreated > 0;
    result.message = `Successfully imported ${result.stats.tasksCreated} tasks`;

    if (result.stats.errors.length > 0) {
      result.message += `, ${result.stats.errors.length} errors`;
    }

    return result;
  }

  // Create task from CSV row
  private async createTaskFromRow(
    row: ImportRow,
    organizationId: number,
    userId: number,
    notifyAssignees: boolean = true
  ): Promise<any> {
    // Parse requirements
    const requirements = row.requirements
      ? row.requirements.split('|').map((r) => r.trim()).filter((r) => r !== '')
      : [];

    // Parse assignee emails
    let assigneeIds: number[] = [];
    if (row.assigned_user_emails) {
      const emails = row.assigned_user_emails.split(',').map((e) => e.trim());
      assigneeIds = await this.getUserIdsByEmails(emails, organizationId);
    } else if (row.assigned_user_ids) {
      assigneeIds = row.assigned_user_ids.split(',').map((id) => parseInt(id.trim()));
    }

    // Get group ID if group name provided
    let groupId = row.group_id ? parseInt(String(row.group_id)) : null;
    if (!groupId && row.group_name) {
      groupId = await this.getGroupIdByName(row.group_name, organizationId);
    }

    // If group specified, get all group members as assignees
    if (groupId) {
      const groupMembers = await this.getGroupMembers(groupId);
      assigneeIds = [...new Set([...assigneeIds, ...groupMembers])]; // Merge and dedupe
    }

    // Create task
    const taskResult = await query(
      `INSERT INTO tasks (organization_id, title, details, start_date, end_date, schedule_type, schedule_frequency, status, created_by_id, group_id, is_private)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        organizationId,
        row.title,
        row.details || '',
        row.start_date || null,
        row.end_date || null,
        row.schedule_type || 'one_time',
        row.schedule_frequency ? parseInt(String(row.schedule_frequency)) : 1,
        row.status || 'pending',
        userId,
        groupId,
        this.parseBoolean(row.is_private),
      ]
    );

    const task = taskResult.rows[0];

    // Create requirements
    for (const req of requirements) {
      await query(
        'INSERT INTO task_requirements (task_id, description) VALUES ($1, $2)',
        [task.id, req]
      );
    }

    // Assign users
    for (const assigneeId of assigneeIds) {
      await query(
        `INSERT INTO task_assignees (task_id, user_id, assigned_by_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (task_id, user_id) DO NOTHING`,
        [task.id, assigneeId, userId]
      );

      // Send notifications if enabled
      if (notifyAssignees) {
        await query(
          `INSERT INTO notifications (user_id, type, title, message, task_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            assigneeId,
            'task_assignment',
            'New Task Assigned',
            `You have been assigned to task: ${task.title}`,
            task.id,
          ]
        );
      }
    }

    // Log audit entry
    await query(
      `INSERT INTO task_audit_logs (task_id, user_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [task.id, userId, 'task_created', JSON.stringify({ source: 'csv_import' })]
    );

    return task;
  }

  // Helper methods
  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return false;
  }

  private async validateUserEmails(emails: string[], orgId: number): Promise<string[]> {
    const result = await query(
      `SELECT u.email
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 AND u.email = ANY($2)`,
      [orgId, emails]
    );

    const validEmails = result.rows.map((r: any) => r.email);
    return emails.filter((email) => !validEmails.includes(email));
  }

  private async getUserIdsByEmails(emails: string[], orgId: number): Promise<number[]> {
    const result = await query(
      `SELECT u.id
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 AND u.email = ANY($2)`,
      [orgId, emails]
    );

    return result.rows.map((r: any) => r.id);
  }

  private async validateGroup(groupName: string, orgId: number): Promise<boolean> {
    const result = await query(
      'SELECT id FROM task_groups WHERE organization_id = $1 AND name = $2',
      [orgId, groupName]
    );

    return result.rows.length > 0;
  }

  private async validateGroupById(groupId: number, orgId: number): Promise<boolean> {
    const result = await query(
      'SELECT id FROM task_groups WHERE organization_id = $1 AND id = $2',
      [orgId, groupId]
    );

    return result.rows.length > 0;
  }

  private async getGroupIdByName(groupName: string, orgId: number): Promise<number | null> {
    const result = await query(
      'SELECT id FROM task_groups WHERE organization_id = $1 AND name = $2',
      [orgId, groupName]
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  private async getGroupMembers(groupId: number): Promise<number[]> {
    const result = await query(
      'SELECT user_id FROM task_group_members WHERE group_id = $1',
      [groupId]
    );

    return result.rows.map((r: any) => r.user_id);
  }
}
