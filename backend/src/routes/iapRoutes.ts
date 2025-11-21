import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as iapController from '../controllers/iapController';

const router = Router();

// === Authenticated Routes (require user token) ===

// Verify purchases from mobile apps
router.post('/verify/apple', authenticateToken, iapController.verifyAppleReceipt);
router.post('/verify/google', authenticateToken, iapController.verifyGooglePurchase);

// Restore purchases
router.post('/restore', authenticateToken, iapController.restorePurchases);

// Get subscription management URL
router.get('/management-url', authenticateToken, iapController.getManagementUrl);

// Get detailed subscription info
router.get('/subscription', authenticateToken, iapController.getSubscriptionDetails);

// === Webhook Routes (no auth - validated by signature/token) ===

// Apple App Store Server Notifications V2
router.post('/webhooks/apple', iapController.handleAppleWebhook);

// Google Real-time Developer Notifications (via Pub/Sub)
router.post('/webhooks/google', iapController.handleGoogleWebhook);

export default router;
