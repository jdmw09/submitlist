import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import * as billingService from '../services/billingService';
import pool from '../config/database';

// Get billing status for current user's organization
export const getBillingStatus = async (req: AuthRequest, res: Response) => {
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
    const status = await billingService.getBillingStatus(orgId);

    res.json({
      billing_enabled: billingService.isBillingEnabled(),
      ...status,
    });
  } catch (error) {
    console.error('Error getting billing status:', error);
    res.status(500).json({ error: 'Failed to get billing status' });
  }
};

// Get available subscription plans
export const getPlans = async (req: AuthRequest, res: Response) => {
  try {
    const plans = await billingService.getPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
};

// Get storage breakdown (admin only)
export const getStorageBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's organization and role
    const memberResult = await pool.query(
      `SELECT organization_id, role FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!memberResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    const { organization_id: orgId, role } = memberResult.rows[0];

    // Only admins can see storage breakdown
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view storage breakdown' });
    }

    const breakdown = await billingService.getStorageBreakdown(orgId);
    res.json(breakdown);
  } catch (error) {
    console.error('Error getting storage breakdown:', error);
    res.status(500).json({ error: 'Failed to get storage breakdown' });
  }
};

// Check if organization can upload file (used by frontend before upload)
export const checkUploadAllowed = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { fileSize } = req.body;

    if (!fileSize || typeof fileSize !== 'number') {
      return res.status(400).json({ error: 'fileSize is required' });
    }

    // Get user's organization
    const orgResult = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!orgResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    const orgId = orgResult.rows[0].organization_id;
    const result = await billingService.canUploadFile(orgId, fileSize);

    res.json(result);
  } catch (error) {
    console.error('Error checking upload:', error);
    res.status(500).json({ error: 'Failed to check upload allowance' });
  }
};

// Recalculate storage (admin only, for fixing drift)
export const recalculateStorage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's organization and role
    const memberResult = await pool.query(
      `SELECT organization_id, role FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!memberResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    const { organization_id: orgId, role } = memberResult.rows[0];

    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can recalculate storage' });
    }

    await billingService.recalculateOrgStorage(orgId);
    const storage = await billingService.getOrgStorage(orgId);

    res.json({
      message: 'Storage recalculated successfully',
      storage,
    });
  } catch (error) {
    console.error('Error recalculating storage:', error);
    res.status(500).json({ error: 'Failed to recalculate storage' });
  }
};
