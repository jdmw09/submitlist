import { Router } from 'express';
import {
  getTaskComments,
  addComment,
  updateComment,
  deleteComment,
} from '../controllers/commentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Task comments
router.get('/tasks/:taskId/comments', getTaskComments);
router.post('/tasks/:taskId/comments', addComment);

// Individual comment operations
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

export default router;
