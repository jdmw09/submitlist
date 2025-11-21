import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { isBillingEnabled } from '../services/billingService';

// Stub: Verify Apple receipt and activate subscription
export const verifyAppleReceipt = async (req: AuthRequest, res: Response) => {
  try {
    if (!isBillingEnabled()) {
      return res.status(400).json({ error: 'Billing is not enabled' });
    }

    const userId = req.user!.id;
    const { transactionId, productId, receipt } = req.body;

    if (!transactionId || !productId) {
      return res.status(400).json({ error: 'transactionId and productId are required' });
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

    // TODO: Implement Apple receipt validation
    // 1. Verify receipt with App Store Server API
    // 2. Validate the JWT signature
    // 3. Check bundle ID matches our app
    // 4. Extract subscription details (product, expiry, status)
    // 5. Map product ID to plan (paid/premium)
    // 6. Update organization_subscriptions table

    // For now, return stub response
    res.status(501).json({
      error: 'Not implemented',
      message: 'Apple receipt validation not yet implemented. See IAP_IMPLEMENTATION_PLAN.md',
      stub: true,
      received: { transactionId, productId, orgId },
    });
  } catch (error) {
    console.error('Apple verification error:', error);
    res.status(500).json({ error: 'Failed to verify Apple receipt' });
  }
};

// Stub: Verify Google purchase and activate subscription
export const verifyGooglePurchase = async (req: AuthRequest, res: Response) => {
  try {
    if (!isBillingEnabled()) {
      return res.status(400).json({ error: 'Billing is not enabled' });
    }

    const userId = req.user!.id;
    const { purchaseToken, productId } = req.body;

    if (!purchaseToken || !productId) {
      return res.status(400).json({ error: 'purchaseToken and productId are required' });
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

    // TODO: Implement Google purchase validation
    // 1. Call Google Play Developer API with service account
    // 2. Verify purchase token is valid
    // 3. Check package name matches our app
    // 4. Extract subscription details (product, expiry, auto-renew)
    // 5. Map product ID to plan (paid/premium)
    // 6. Update organization_subscriptions table

    // For now, return stub response
    res.status(501).json({
      error: 'Not implemented',
      message: 'Google purchase validation not yet implemented. See IAP_IMPLEMENTATION_PLAN.md',
      stub: true,
      received: { purchaseToken, productId, orgId },
    });
  } catch (error) {
    console.error('Google verification error:', error);
    res.status(500).json({ error: 'Failed to verify Google purchase' });
  }
};

// Stub: Handle Apple App Store Server Notifications (webhook)
export const handleAppleWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const { signedPayload } = req.body;

    if (!signedPayload) {
      return res.status(400).json({ error: 'signedPayload is required' });
    }

    // TODO: Implement Apple webhook handling
    // 1. Decode JWS (JSON Web Signature)
    // 2. Verify signature using Apple's public key
    // 3. Parse notification type (SUBSCRIBED, DID_RENEW, EXPIRED, etc.)
    // 4. Extract transaction info
    // 5. Find organization by original_transaction_id
    // 6. Update subscription status accordingly:
    //    - SUBSCRIBED: Activate subscription
    //    - DID_RENEW: Extend period
    //    - EXPIRED: Downgrade to free
    //    - REFUND: Immediate downgrade
    //    - DID_CHANGE_RENEWAL_STATUS: Update auto_renew flag

    console.log('Apple webhook received (stub):', { signedPayload: signedPayload.substring(0, 50) + '...' });

    // Apple expects 200 OK to acknowledge receipt
    res.status(200).json({
      message: 'Webhook received (stub - not processed)',
      stub: true,
    });
  } catch (error) {
    console.error('Apple webhook error:', error);
    // Still return 200 to prevent Apple from retrying
    res.status(200).json({ error: 'Webhook processing failed' });
  }
};

// Stub: Handle Google Real-time Developer Notifications (webhook)
export const handleGoogleWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || !message.data) {
      return res.status(400).json({ error: 'Invalid Pub/Sub message format' });
    }

    // Decode base64 message data
    const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
    let notification;
    try {
      notification = JSON.parse(decodedData);
    } catch {
      return res.status(400).json({ error: 'Invalid notification data' });
    }

    // TODO: Implement Google webhook handling
    // 1. Parse notification type from subscriptionNotification
    // 2. Extract purchaseToken
    // 3. Call Google Play Developer API to get full subscription details
    // 4. Find organization by purchase token
    // 5. Update subscription status:
    //    - SUBSCRIPTION_PURCHASED (1): Activate
    //    - SUBSCRIPTION_RENEWED (2): Extend period
    //    - SUBSCRIPTION_RECOVERED (3): Reactivate from grace period
    //    - SUBSCRIPTION_CANCELED (5): Mark as canceled (access until period end)
    //    - SUBSCRIPTION_ON_HOLD (6): Enter grace period
    //    - SUBSCRIPTION_IN_GRACE_PERIOD (7): Still in grace period
    //    - SUBSCRIPTION_EXPIRED (13): Downgrade to free

    console.log('Google webhook received (stub):', notification);

    // Google expects 200 OK to acknowledge receipt
    res.status(200).json({
      message: 'Webhook received (stub - not processed)',
      stub: true,
    });
  } catch (error) {
    console.error('Google webhook error:', error);
    // Still return 200 to prevent Pub/Sub from retrying excessively
    res.status(200).json({ error: 'Webhook processing failed' });
  }
};

// Stub: Restore purchases from app stores
export const restorePurchases = async (req: AuthRequest, res: Response) => {
  try {
    if (!isBillingEnabled()) {
      return res.status(400).json({ error: 'Billing is not enabled' });
    }

    const userId = req.user!.id;
    const { platform, receipts } = req.body;

    if (!platform || !['apple', 'google'].includes(platform)) {
      return res.status(400).json({ error: 'platform must be "apple" or "google"' });
    }

    // Get user's organization
    const orgResult = await pool.query(
      `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (!orgResult.rows[0]) {
      return res.status(404).json({ error: 'User not in an organization' });
    }

    // TODO: Implement restore purchases
    // For each receipt/purchase token:
    // 1. Validate with respective store
    // 2. Check if subscription is still active
    // 3. Update organization subscription if valid

    res.status(501).json({
      error: 'Not implemented',
      message: 'Restore purchases not yet implemented. See IAP_IMPLEMENTATION_PLAN.md',
      stub: true,
    });
  } catch (error) {
    console.error('Restore purchases error:', error);
    res.status(500).json({ error: 'Failed to restore purchases' });
  }
};

// Get subscription management URL for platform
export const getManagementUrl = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get user's organization subscription
    const result = await pool.query(
      `SELECT os.payment_platform
       FROM organization_subscriptions os
       JOIN organization_members om ON os.organization_id = om.organization_id
       WHERE om.user_id = $1`,
      [userId]
    );

    const platform = result.rows[0]?.payment_platform;

    let url: string;
    switch (platform) {
      case 'apple':
        url = 'https://apps.apple.com/account/subscriptions';
        break;
      case 'google':
        url = 'https://play.google.com/store/account/subscriptions';
        break;
      case 'stripe':
        // TODO: Generate Stripe customer portal URL
        url = 'https://billing.stripe.com/p/login/test';
        break;
      default:
        return res.json({
          url: null,
          message: 'No active subscription or free plan',
        });
    }

    res.json({ url, platform });
  } catch (error) {
    console.error('Get management URL error:', error);
    res.status(500).json({ error: 'Failed to get management URL' });
  }
};

// Get detailed subscription info
export const getSubscriptionDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await pool.query(
      `SELECT
         os.*,
         sp.name as plan_name,
         sp.slug as plan_slug,
         sp.price_cents,
         sp.max_storage_bytes,
         sp.file_retention_days,
         sp.billing_interval
       FROM organization_subscriptions os
       JOIN subscription_plans sp ON os.plan_id = sp.id
       JOIN organization_members om ON os.organization_id = om.organization_id
       WHERE om.user_id = $1`,
      [userId]
    );

    if (!result.rows[0]) {
      return res.json({
        subscription: null,
        message: 'No subscription found (free plan)',
      });
    }

    const sub = result.rows[0];
    res.json({
      subscription: {
        plan: {
          name: sub.plan_name,
          slug: sub.plan_slug,
          price_cents: sub.price_cents,
          billing_interval: sub.billing_interval,
          max_storage_bytes: sub.max_storage_bytes,
          file_retention_days: sub.file_retention_days,
        },
        status: sub.status,
        payment_platform: sub.payment_platform,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        trial_end: sub.trial_end,
        canceled_at: sub.canceled_at,
        auto_renew: true, // TODO: Track this from store notifications
      },
    });
  } catch (error) {
    console.error('Get subscription details error:', error);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
};
