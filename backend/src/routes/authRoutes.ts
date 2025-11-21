import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import {
  resendVerificationEmail,
  verifyEmail,
  getVerificationStatus,
} from '../controllers/emailVerificationController';
import {
  forgotPassword,
  validateResetToken,
  resetPassword,
} from '../controllers/passwordResetController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Authentication routes
router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticateToken, getProfile);

// Email verification routes
router.post('/resend-verification', authenticateToken, resendVerificationEmail);
router.get('/verify-email/:token', verifyEmail);
router.get('/verification-status', authenticateToken, getVerificationStatus);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.get('/validate-reset-token/:token', validateResetToken);
router.post('/reset-password', resetPassword);

export default router;
