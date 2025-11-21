import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as billingController from '../controllers/billingController';

const router = Router();

// All billing routes require authentication
router.use(authenticateToken);

// Get available subscription plans
router.get('/plans', billingController.getPlans);

// Get billing status for current organization
router.get('/status', billingController.getBillingStatus);

// Get storage breakdown by user (admin only)
router.get('/storage/breakdown', billingController.getStorageBreakdown);

// Check if upload is allowed (pre-flight check)
router.post('/storage/check-upload', billingController.checkUploadAllowed);

// Recalculate storage (admin only)
router.post('/storage/recalculate', billingController.recalculateStorage);

export default router;
