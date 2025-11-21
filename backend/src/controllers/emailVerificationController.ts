import { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { sendVerificationEmail, sendEmailVerifiedEmail } from '../services/emailService';

// Token expiration: 24 hours
const TOKEN_EXPIRY_HOURS = 24;

// Rate limiting: 1 resend per 5 minutes per user
const RESEND_COOLDOWN_MINUTES = 5;

/**
 * Generate a secure verification token
 */
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get user details
    const userResult = await query(
      'SELECT id, email, name, email_verified FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Rate limiting check - prevent spam
    const recentTokenResult = await query(
      `SELECT created_at FROM email_verification_tokens
       WHERE user_id = $1
       AND created_at > NOW() - INTERVAL '${RESEND_COOLDOWN_MINUTES} minutes'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (recentTokenResult.rows.length > 0) {
      const nextAllowed = new Date(recentTokenResult.rows[0].created_at);
      nextAllowed.setMinutes(nextAllowed.getMinutes() + RESEND_COOLDOWN_MINUTES);

      return res.status(429).json({
        error: `Please wait ${RESEND_COOLDOWN_MINUTES} minutes before requesting another verification email`,
        nextAllowedAt: nextAllowed.toISOString(),
      });
    }

    // Invalidate old tokens
    await query(
      'UPDATE email_verification_tokens SET is_valid = false WHERE user_id = $1 AND is_valid = true',
      [userId]
    );

    // Generate new token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    // Store token
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, token);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({
      message: 'Verification email sent successfully',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Verify email with token
 * GET /api/auth/verify-email/:token
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find valid token
    const tokenResult = await query(
      `SELECT t.*, u.email, u.name
       FROM email_verification_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1
       AND t.is_valid = true
       AND t.used_at IS NULL
       AND t.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired verification token',
        errorCode: 'TOKEN_INVALID',
      });
    }

    const tokenData = tokenResult.rows[0];
    const userId = tokenData.user_id;

    // Check if user is already verified
    const userResult = await query(
      'SELECT email_verified FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows[0]?.email_verified) {
      return res.status(400).json({
        error: 'Email is already verified',
        errorCode: 'ALREADY_VERIFIED',
      });
    }

    // Mark token as used
    await query(
      'UPDATE email_verification_tokens SET used_at = NOW(), is_valid = false WHERE id = $1',
      [tokenData.id]
    );

    // Verify user email
    await query(
      'UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE id = $1',
      [userId]
    );

    // Send confirmation email
    try {
      await sendEmailVerifiedEmail(tokenData.email, tokenData.name);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the verification if confirmation email fails
    }

    res.json({
      message: 'Email verified successfully',
      email: tokenData.email,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get verification status
 * GET /api/auth/verification-status
 */
export const getVerificationStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const userResult = await query(
      'SELECT email_verified, email_verified_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    res.json({
      emailVerified: user.email_verified,
      verifiedAt: user.email_verified_at,
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
