import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../services/emailService';

// Token expiration: 1 hour
const TOKEN_EXPIRY_HOURS = 1;

// Rate limiting: 3 requests per hour per email
const MAX_RESET_ATTEMPTS = 3;
const RESET_WINDOW_HOURS = 1;

/**
 * Generate a secure reset token
 */
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Request password reset (user-initiated)
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const userResult = await query(
      'SELECT id, email, name, email_verified FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration attacks
    const successResponse = {
      message: 'If an account exists with this email, you will receive a password reset link shortly',
    };

    if (userResult.rows.length === 0) {
      // Don't reveal that user doesn't exist
      return res.json(successResponse);
    }

    const user = userResult.rows[0];

    // Check if email is verified (optional - you may want to allow resets for unverified emails)
    // For now, we'll allow resets even for unverified emails for better UX

    // Rate limiting check - prevent abuse
    const recentAttemptsResult = await query(
      `SELECT COUNT(*) as count FROM password_reset_tokens
       WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '${RESET_WINDOW_HOURS} hours'`,
      [user.id]
    );

    const attemptCount = parseInt(recentAttemptsResult.rows[0].count);

    if (attemptCount >= MAX_RESET_ATTEMPTS) {
      return res.status(429).json({
        error: `Too many password reset attempts. Please try again in ${RESET_WINDOW_HOURS} hour(s)`,
      });
    }

    // Get client IP address for logging
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Invalidate old tokens for this user
    await query(
      'UPDATE password_reset_tokens SET is_valid = false WHERE user_id = $1 AND is_valid = true',
      [user.id]
    );

    // Generate new token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    // Store token
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [user.id, token, expiresAt, ipAddress]
    );

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, token);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    res.json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Validate reset token
 * GET /api/auth/validate-reset-token/:token
 */
export const validateResetToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    // Find valid token
    const tokenResult = await query(
      `SELECT t.*, u.email
       FROM password_reset_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1
       AND t.is_valid = true
       AND t.used_at IS NULL
       AND t.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        errorCode: 'TOKEN_INVALID',
      });
    }

    const tokenData = tokenResult.rows[0];

    res.json({
      valid: true,
      email: tokenData.email,
    });
  } catch (error) {
    console.error('Validate reset token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find valid token
    const tokenResult = await query(
      `SELECT t.*, u.email, u.name
       FROM password_reset_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1
       AND t.is_valid = true
       AND t.used_at IS NULL
       AND t.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        errorCode: 'TOKEN_INVALID',
      });
    }

    const tokenData = tokenResult.rows[0];
    const userId = tokenData.user_id;

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = $1, last_password_change = NOW(), force_password_change = false WHERE id = $2',
      [passwordHash, userId]
    );

    // Mark token as used
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW(), is_valid = false WHERE id = $1',
      [tokenData.id]
    );

    // Invalidate all other tokens for this user
    await query(
      'UPDATE password_reset_tokens SET is_valid = false WHERE user_id = $1 AND id != $2',
      [userId, tokenData.id]
    );

    // Send confirmation email
    try {
      await sendPasswordChangedEmail(tokenData.email, tokenData.name);
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
      // Don't fail the reset if confirmation email fails
    }

    res.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
