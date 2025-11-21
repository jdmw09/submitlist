import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import pool from '../config/database';
import { isBillingEnabled, canUploadFile, getOrgPlan } from '../services/billingService';

// Middleware to check if organization can upload based on storage limits
export const checkStorageLimit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // If billing is disabled, allow all uploads
  if (!isBillingEnabled()) {
    return next();
  }

  try {
    const userId = req.user!.id;

    // Get user's organization
    const orgResult = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!orgResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    const orgId = orgResult.rows[0].organization_id;

    // Get file size from content-length header or estimate
    const contentLength = parseInt(req.headers['content-length'] || '0');

    if (contentLength > 0) {
      const result = await canUploadFile(orgId, contentLength);

      if (!result.allowed) {
        return res.status(402).json({
          error: 'Storage limit exceeded',
          message: result.message,
          upgrade_required: true,
        });
      }
    }

    // Store orgId in request for later use
    (req as any).organizationId = orgId;
    next();
  } catch (error) {
    console.error('Error checking storage limit:', error);
    next(); // Allow upload on error to avoid blocking users
  }
};

// Middleware to require active subscription (paid or premium)
export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // If billing is disabled, allow access
  if (!isBillingEnabled()) {
    return next();
  }

  try {
    const userId = req.user!.id;

    // Get user's organization
    const orgResult = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!orgResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    const orgId = orgResult.rows[0].organization_id;

    // Check subscription status
    const subResult = await pool.query(
      `SELECT status FROM organization_subscriptions WHERE organization_id = $1`,
      [orgId]
    );

    const status = subResult.rows[0]?.status;

    if (status !== 'active' && status !== 'trialing') {
      return res.status(402).json({
        error: 'Active subscription required',
        message: 'This feature requires a paid subscription. Please upgrade your plan.',
        upgrade_required: true,
      });
    }

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    next(); // Allow access on error to avoid blocking users
  }
};

// Middleware to require premium subscription
export const requirePremiumSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // If billing is disabled, allow access
  if (!isBillingEnabled()) {
    return next();
  }

  try {
    const userId = req.user!.id;

    // Get user's organization
    const orgResult = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!orgResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    const orgId = orgResult.rows[0].organization_id;
    const plan = await getOrgPlan(orgId);

    if (plan.slug !== 'premium') {
      return res.status(402).json({
        error: 'Premium subscription required',
        message: 'This feature requires a Premium subscription. Please upgrade your plan.',
        upgrade_required: true,
      });
    }

    next();
  } catch (error) {
    console.error('Error checking premium subscription:', error);
    next(); // Allow access on error to avoid blocking users
  }
};

// Middleware to attach billing info to request
export const attachBillingInfo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!isBillingEnabled()) {
    (req as any).billing = { enabled: false };
    return next();
  }

  try {
    const userId = req.user!.id;

    // Get user's organization
    const orgResult = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!orgResult.rows[0]) {
      (req as any).billing = { enabled: true, hasOrg: false };
      return next();
    }

    const orgId = orgResult.rows[0].organization_id;
    const plan = await getOrgPlan(orgId);

    (req as any).billing = {
      enabled: true,
      hasOrg: true,
      organizationId: orgId,
      plan: {
        slug: plan.slug,
        name: plan.name,
        maxStorageBytes: plan.max_storage_bytes,
        fileRetentionDays: plan.file_retention_days,
      },
    };

    next();
  } catch (error) {
    console.error('Error attaching billing info:', error);
    (req as any).billing = { enabled: true, error: true };
    next();
  }
};
