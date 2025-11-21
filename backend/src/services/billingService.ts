import pool from '../config/database';
import { SubscriptionPlan, OrganizationSubscription, BillingStatus, StorageBreakdown } from '../types';

// Feature flag check
export const isBillingEnabled = (): boolean => {
  return process.env.BILLING_ENABLED === 'true';
};

// Plan constants
export const PLAN_LIMITS = {
  free: { storage: 262144000, retention: 7 },      // 250 MB, 7 days
  paid: { storage: 5368709120, retention: 30 },    // 5 GB, 30 days
  premium: { storage: 107374182400, retention: null }, // 100 GB, forever
};

// Get all active plans
export const getPlans = async (): Promise<SubscriptionPlan[]> => {
  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY display_order`
  );
  return result.rows;
};

// Get plan by slug
export const getPlanBySlug = async (slug: string): Promise<SubscriptionPlan | null> => {
  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] || null;
};

// Get organization's subscription
export const getOrgSubscription = async (orgId: number): Promise<OrganizationSubscription & { plan: SubscriptionPlan } | null> => {
  const result = await pool.query(
    `SELECT os.*, sp.name as plan_name, sp.slug as plan_slug, sp.price_cents,
            sp.max_storage_bytes, sp.file_retention_days, sp.billing_interval
     FROM organization_subscriptions os
     JOIN subscription_plans sp ON os.plan_id = sp.id
     WHERE os.organization_id = $1`,
    [orgId]
  );

  if (!result.rows[0]) return null;

  const row = result.rows[0];
  return {
    ...row,
    plan: {
      id: row.plan_id,
      name: row.plan_name,
      slug: row.plan_slug,
      price_cents: row.price_cents,
      max_storage_bytes: row.max_storage_bytes,
      file_retention_days: row.file_retention_days,
      billing_interval: row.billing_interval,
    } as SubscriptionPlan,
  };
};

// Get organization's current plan (defaults to free if no subscription)
export const getOrgPlan = async (orgId: number): Promise<SubscriptionPlan> => {
  const subscription = await getOrgSubscription(orgId);

  if (subscription && subscription.status === 'active') {
    return subscription.plan;
  }

  // Return free plan as default
  const freePlan = await getPlanBySlug('free');
  return freePlan!;
};

// Get organization's storage usage
export const getOrgStorage = async (orgId: number): Promise<{ used_bytes: number; last_calculated_at: Date }> => {
  const result = await pool.query(
    `SELECT storage_used_bytes, last_calculated_at FROM organization_storage WHERE organization_id = $1`,
    [orgId]
  );

  if (!result.rows[0]) {
    // Initialize storage record if doesn't exist
    await pool.query(
      `INSERT INTO organization_storage (organization_id, storage_used_bytes) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [orgId]
    );
    return { used_bytes: 0, last_calculated_at: new Date() };
  }

  return {
    used_bytes: parseInt(result.rows[0].storage_used_bytes) || 0,
    last_calculated_at: result.rows[0].last_calculated_at,
  };
};

// Get billing status for organization
export const getBillingStatus = async (orgId: number): Promise<BillingStatus> => {
  const subscription = await getOrgSubscription(orgId);
  const storage = await getOrgStorage(orgId);
  const plan = subscription?.plan || (await getPlanBySlug('free'))!;

  return {
    plan: {
      name: plan.name,
      slug: plan.slug,
      price_cents: plan.price_cents,
      max_storage_bytes: plan.max_storage_bytes,
      file_retention_days: plan.file_retention_days,
    },
    status: subscription?.status || 'free',
    trial_ends: subscription?.trial_end,
    period_ends: subscription?.current_period_end,
    payment_platform: subscription?.payment_platform,
    storage: {
      used_bytes: storage.used_bytes,
      max_bytes: plan.max_storage_bytes,
      percentage: (storage.used_bytes / plan.max_storage_bytes) * 100,
    },
  };
};

// Get storage breakdown by user (admin only)
export const getStorageBreakdown = async (orgId: number): Promise<StorageBreakdown> => {
  const storage = await getOrgStorage(orgId);
  const plan = await getOrgPlan(orgId);

  const result = await pool.query(
    `SELECT
       u.id as user_id,
       u.name as user_name,
       u.email,
       usc.storage_bytes,
       usc.file_count,
       usc.last_upload_at,
       ROUND(usc.storage_bytes * 100.0 / NULLIF($2::bigint, 0), 1) as percentage
     FROM user_storage_contributions usc
     JOIN users u ON usc.user_id = u.id
     WHERE usc.organization_id = $1
     ORDER BY usc.storage_bytes DESC`,
    [orgId, storage.used_bytes]
  );

  return {
    total: {
      used_bytes: storage.used_bytes,
      max_bytes: plan.max_storage_bytes,
      percentage: (storage.used_bytes / plan.max_storage_bytes) * 100,
    },
    by_user: result.rows.map(row => ({
      user_id: row.user_id,
      user_name: row.user_name,
      email: row.email,
      storage_bytes: parseInt(row.storage_bytes) || 0,
      file_count: row.file_count,
      last_upload_at: row.last_upload_at,
      percentage: parseFloat(row.percentage) || 0,
    })),
  };
};

// Check if organization can upload file
export const canUploadFile = async (
  orgId: number,
  fileSize: number
): Promise<{ allowed: boolean; message?: string }> => {
  // If billing is disabled, allow all uploads
  if (!isBillingEnabled()) {
    return { allowed: true };
  }

  const storage = await getOrgStorage(orgId);
  const plan = await getOrgPlan(orgId);

  if (storage.used_bytes + fileSize > plan.max_storage_bytes) {
    const usedGB = (storage.used_bytes / 1073741824).toFixed(2);
    const maxGB = (plan.max_storage_bytes / 1073741824).toFixed(2);
    const upgradeTo = plan.slug === 'free' ? 'Paid' : 'Premium';

    return {
      allowed: false,
      message: `Organization storage limit reached (${usedGB} GB / ${maxGB} GB). Upgrade to ${upgradeTo} for more storage.`,
    };
  }

  return { allowed: true };
};

// Track file upload (updates both org total and user contribution)
export const trackFileUpload = async (
  orgId: number,
  userId: number,
  fileSize: number
): Promise<void> => {
  // Update org total
  await pool.query(
    `UPDATE organization_storage
     SET storage_used_bytes = storage_used_bytes + $1,
         last_calculated_at = CURRENT_TIMESTAMP
     WHERE organization_id = $2`,
    [fileSize, orgId]
  );

  // Update user's contribution
  await pool.query(
    `INSERT INTO user_storage_contributions (organization_id, user_id, storage_bytes, file_count, last_upload_at)
     VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (organization_id, user_id)
     DO UPDATE SET
       storage_bytes = user_storage_contributions.storage_bytes + $3,
       file_count = user_storage_contributions.file_count + 1,
       last_upload_at = CURRENT_TIMESTAMP`,
    [orgId, userId, fileSize]
  );
};

// Track file deletion
export const trackFileDelete = async (
  orgId: number,
  userId: number,
  fileSize: number
): Promise<void> => {
  // Update org total
  await pool.query(
    `UPDATE organization_storage
     SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1),
         last_calculated_at = CURRENT_TIMESTAMP
     WHERE organization_id = $2`,
    [fileSize, orgId]
  );

  // Update user's contribution
  await pool.query(
    `UPDATE user_storage_contributions
     SET storage_bytes = GREATEST(0, storage_bytes - $1),
         file_count = GREATEST(0, file_count - 1)
     WHERE organization_id = $2 AND user_id = $3`,
    [fileSize, orgId, userId]
  );
};

// Recalculate storage for an organization (run periodically to fix drift)
export const recalculateOrgStorage = async (orgId: number): Promise<void> => {
  const result = await pool.query(
    `SELECT COALESCE(SUM(tc.file_size_bytes), 0) as total_bytes
     FROM task_completions tc
     JOIN tasks t ON tc.task_id = t.id
     WHERE t.organization_id = $1
     AND tc.file_path IS NOT NULL`,
    [orgId]
  );

  const totalBytes = parseInt(result.rows[0]?.total_bytes) || 0;

  await pool.query(
    `UPDATE organization_storage
     SET storage_used_bytes = $1, last_calculated_at = CURRENT_TIMESTAMP
     WHERE organization_id = $2`,
    [totalBytes, orgId]
  );
};

// Initialize subscription for a new organization
export const initializeOrgSubscription = async (orgId: number): Promise<void> => {
  const freePlan = await getPlanBySlug('free');
  if (!freePlan) return;

  // Create subscription record
  await pool.query(
    `INSERT INTO organization_subscriptions (organization_id, plan_id, status)
     VALUES ($1, $2, 'free')
     ON CONFLICT (organization_id) DO NOTHING`,
    [orgId, freePlan.id]
  );

  // Create storage record
  await pool.query(
    `INSERT INTO organization_storage (organization_id, storage_used_bytes)
     VALUES ($1, 0)
     ON CONFLICT (organization_id) DO NOTHING`,
    [orgId]
  );
};

// Initialize user storage contribution when joining org
export const initializeUserStorage = async (orgId: number, userId: number): Promise<void> => {
  await pool.query(
    `INSERT INTO user_storage_contributions (organization_id, user_id, storage_bytes, file_count)
     VALUES ($1, $2, 0, 0)
     ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [orgId, userId]
  );
};

// Get file retention days for organization
export const getFileRetentionDays = async (orgId: number): Promise<number | null> => {
  const plan = await getOrgPlan(orgId);
  return plan.file_retention_days;
};

// Check if subscription is active (paid or premium)
export const hasActiveSubscription = async (orgId: number): Promise<boolean> => {
  const subscription = await getOrgSubscription(orgId);
  return subscription?.status === 'active' || subscription?.status === 'trialing';
};
