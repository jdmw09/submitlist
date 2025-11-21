import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  updateRequirement,
  submitTask,
  reviewTask,
  getAuditLogs,
  // Phase 1: Multi-assignee
  addTaskAssignees,
  getTaskAssignees,
  removeTaskAssignee,
  completeTaskByAssignee,
} from '../controllers/taskController';
import {
  addCompletion,
  getCompletions,
  deleteCompletion,
} from '../controllers/completionController';
import {
  importTasks,
  downloadTemplate,
} from '../controllers/importController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.use(authenticateToken);

// Task routes
router.post('/', createTask);
router.get('/organization/:organizationId', getTasks);
router.get('/:taskId', getTask);
router.put('/:taskId', updateTask);
router.delete('/:taskId', deleteTask);
router.post('/:taskId/submit', submitTask);
router.post('/:taskId/review', reviewTask);

// Phase 1: Multi-assignee routes
router.post('/:taskId/assignees', addTaskAssignees);
router.get('/:taskId/assignees', getTaskAssignees);
router.delete('/:taskId/assignees/:assigneeId', removeTaskAssignee);
router.put('/:taskId/assignees/:assigneeId/complete', completeTaskByAssignee);

// Requirement routes
router.put('/requirements/:requirementId', updateRequirement);

// Completion routes
router.post('/:taskId/completions', upload.array('files', 10), addCompletion);
router.get('/:taskId/completions', getCompletions);
router.delete('/completions/:completionId', deleteCompletion);

// Audit log routes
router.get('/:taskId/audit-logs', getAuditLogs);

// Phase 1: CSV Import routes
router.post('/import', upload.single('file'), importTasks);
router.get('/import/template', downloadTemplate);

export default router;
