import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskImportService } from '../services/taskImportService';
import { query } from '../config/database';
import fs from 'fs';

// Import tasks from CSV
export const importTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, validateOnly, notifyAssignees } = req.body;
    const userId = req.user!.id;
    const file = req.file; // Uploaded CSV file

    if (!file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Verify organization membership
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Import tasks
    const importService = new TaskImportService();
    const result = await importService.importTasks(file.path, parseInt(organizationId), userId, {
      validateOnly: validateOnly === 'true' || validateOnly === true,
      notifyAssignees: notifyAssignees !== 'false' && notifyAssignees !== false,
    });

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Log audit entry - Note: This should be a separate audit log table for non-task-specific actions
    // For now, skipping this as task_audit_logs requires a task_id

    res.json(result);
  } catch (error) {
    console.error('Import tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Download CSV template
export const downloadTemplate = async (req: AuthRequest, res: Response) => {
  const template = `title,details,assigned_user_emails,start_date,end_date,schedule_type,schedule_frequency,is_private,group_name,requirements,status
"Weekly Team Report","Prepare and submit weekly status report","manager@example.com",2025-11-25,2025-12-02,weekly,1,false,,"Review completed tasks|Document blockers|Plan next week",in_progress
"Daily Standup Notes","Record daily standup meeting notes","team-lead@example.com,dev@example.com",2025-11-22,,daily,1,false,,"Take attendance|Record updates|Note action items",in_progress
"Monthly Inventory Check","Complete monthly inventory audit",,2025-12-01,2025-12-05,monthly,1,false,Warehouse Team,"Count all items|Update spreadsheet|Report discrepancies",in_progress
"Bi-Weekly Code Review","Review and approve pending pull requests","senior-dev@example.com",2025-11-25,2025-12-09,weekly,2,true,,"Review PRs|Check test coverage|Approve or request changes",in_progress
"One-Time Project Setup","Initial project configuration","admin@example.com",2025-11-22,2025-11-25,one_time,1,false,,"Create repository|Set up CI/CD|Document setup steps",in_progress`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="task_import_template.csv"');
  res.send(template);
};
