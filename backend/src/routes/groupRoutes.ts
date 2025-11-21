import { Router } from 'express';
import {
  getTaskGroupDetails,
  updateTaskGroup,
  deleteTaskGroup,
  addGroupMembers,
  removeGroupMember,
} from '../controllers/organizationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Group-specific routes
router.get('/:groupId', getTaskGroupDetails);
router.put('/:groupId', updateTaskGroup);
router.delete('/:groupId', deleteTaskGroup);

// Group member management
router.post('/:groupId/members', addGroupMembers);
router.delete('/:groupId/members/:memberId', removeGroupMember);

export default router;
