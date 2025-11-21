# Subscription Billing System Design (Simplified)

## Overview

Simple two-tier subscription model with storage-based pricing.

---

## Subscription Tiers

### Free Tier
**Price:** $0

**Limits:**
- 250 MB storage max
- Files auto-deleted after 7 days
- All features included (no feature gating)

**Use Case:** Try the app, small personal use

---

### Paid Tier
**Price:** $20/year (billed annually)

**Includes:**
- 5 GB storage included
- Files never auto-deleted
- All features included

**Overage:**
- Storage over 5 GB: $0.05/GB/month
- Always rounded UP to next GB
- Example: 5.1 GB used = 1 GB overage = $0.05/month

**Use Case:** Teams, organizations, long-term use

---

## Storage Calculation

```
Overage GB = CEILING(current_storage_bytes / 1073741824) - 5
Overage charge = MAX(0, Overage GB) * $0.05/month
```

**Examples:**
| Storage Used | Included | Overage | Monthly Charge |
|--------------|----------|---------|----------------|
| 2.5 GB | 5 GB | 0 GB | $0 |
| 5.0 GB | 5 GB | 0 GB | $0 |
| 5.1 GB | 5 GB | 1 GB | $0.05 |
| 7.3 GB | 5 GB | 3 GB | $0.15 |
| 12.0 GB | 5 GB | 7 GB | $0.35 |
| 25.8 GB | 5 GB | 21 GB | $1.05 |

---

## Trial Period

- **Duration:** 14 days
- **Access:** Full Paid tier features
- **Payment required:** Yes, upfront (card on file)
- **At trial end:** Auto-converts to Paid ($20 charged)
- **Cancel before trial ends:** No charge

---

## Key Policies

| Policy | Decision |
|--------|----------|
| Trial length | 14 days |
| Payment upfront | Yes (required for trial) |
| Downgrade enforcement | Hard - at end of paid period |
| Free tier | Truly free (no card required) |
| Billing cycle | Annual only ($20/year) |
| Grace period | None |
| Refunds | None |

---

## Downgrade Flow (Paid → Free)

**When user cancels or doesn't renew:**

1. Subscription ends at period end
2. Account converts to Free tier
3. **Hard enforcement:**
   - If storage > 250 MB: User must delete files
   - Files over 7 days old: Auto-deleted
   - Cannot upload new files until under 250 MB
4. Email notification 7 days before expiry
5. Email notification on downgrade day

**Storage cleanup for downgrade:**
```sql
-- Auto-delete files older than 7 days for free users
DELETE FROM task_completions
WHERE organization_id IN (
  SELECT organization_id FROM organization_subscriptions
  WHERE status != 'active'
)
AND file_path IS NOT NULL
AND completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
```

---

## File Auto-Delete (Free Tier)

**Daily cron job:**
```typescript
// Runs daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  // Get all free-tier organizations
  const freeOrgs = await db.query(`
    SELECT o.id FROM organizations o
    LEFT JOIN organization_subscriptions os ON o.id = os.organization_id
    WHERE os.id IS NULL OR os.status != 'active'
  `);

  for (const org of freeOrgs.rows) {
    // Delete files older than 7 days
    const deleted = await db.query(`
      DELETE FROM task_completions
      WHERE task_id IN (SELECT id FROM tasks WHERE organization_id = $1)
      AND file_path IS NOT NULL
      AND completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
      RETURNING file_path
    `, [org.id]);

    // Delete actual files from storage
    for (const file of deleted.rows) {
      await deleteFile(file.file_path);
    }

    // Update storage usage
    await recalculateStorage(org.id);
  }
});
```

---

## Database Schema

### 1. `subscription_plans` Table (Simplified)

```sql
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,           -- 'Free', 'Paid'
  slug VARCHAR(20) UNIQUE NOT NULL,    -- 'free', 'paid'
  price_cents INTEGER NOT NULL,        -- 0 or 2000
  billing_interval VARCHAR(20),        -- NULL for free, 'year' for paid
  max_storage_bytes BIGINT NOT NULL,   -- 262144000 (250MB) or 5368709120 (5GB)
  file_retention_days INTEGER,         -- 7 for free, NULL for paid (forever)
  overage_per_gb_cents INTEGER,        -- NULL for free, 5 for paid
  stripe_price_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO subscription_plans (name, slug, price_cents, billing_interval, max_storage_bytes, file_retention_days, overage_per_gb_cents) VALUES
('Free', 'free', 0, NULL, 262144000, 7, NULL),
('Paid', 'paid', 2000, 'year', 5368709120, NULL, 5);
```

### 2. `organization_subscriptions` Table

```sql
CREATE TABLE organization_subscriptions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id INTEGER REFERENCES subscription_plans(id),

  -- Status
  status VARCHAR(30) NOT NULL,         -- 'trialing', 'active', 'canceled', 'expired'

  -- Dates
  trial_end TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,

  -- Stripe
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255) UNIQUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_sub_org ON organization_subscriptions(organization_id);
CREATE INDEX idx_org_sub_status ON organization_subscriptions(status);
```

### 3. `organization_storage` Table

```sql
CREATE TABLE organization_storage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  storage_used_bytes BIGINT DEFAULT 0,
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_storage_org ON organization_storage(organization_id);
```

### 4. `storage_overages` Table (Monthly tracking)

```sql
CREATE TABLE storage_overages (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,      -- '2025-11'
  peak_storage_bytes BIGINT NOT NULL,
  overage_gb INTEGER NOT NULL,
  charge_cents INTEGER NOT NULL,
  stripe_invoice_item_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, month_year)
);
```

### 5. `subscription_invoices` Table

```sql
CREATE TABLE subscription_invoices (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE,
  amount_cents INTEGER NOT NULL,
  status VARCHAR(30) NOT NULL,         -- 'paid', 'open', 'void'
  invoice_date TIMESTAMP NOT NULL,
  paid_at TIMESTAMP,
  invoice_pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Stripe Integration

### Products & Prices

**Create in Stripe Dashboard:**
1. Product: "TaskManager Paid"
2. Price: $20.00 USD / year
3. Enable metered billing for overages (optional add-on)

### Checkout Flow

```typescript
// POST /api/billing/checkout
router.post('/checkout',
  authenticateToken,
  requireOrgAdmin,
  async (req: AuthRequest, res) => {
    const orgId = req.user!.currentOrgId;
    const org = await getOrganization(orgId);

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user!.email,
        metadata: { organization_id: orgId.toString() }
      });
      customerId = customer.id;
      await saveStripeCustomerId(orgId, customerId);
    }

    // Create checkout session with 14-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PAID_PRICE_ID,
        quantity: 1,
      }],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 14,
      },
      success_url: `${process.env.APP_URL}/billing/success`,
      cancel_url: `${process.env.APP_URL}/billing`,
    });

    res.json({ url: session.url });
  }
);
```

### Webhook Events

```typescript
// Handle these Stripe webhook events:
const webhookHandlers = {
  'customer.subscription.created': async (sub) => {
    await createSubscription(sub.metadata.organization_id, {
      status: sub.status,  // 'trialing' or 'active'
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      current_period_start: new Date(sub.current_period_start * 1000),
      current_period_end: new Date(sub.current_period_end * 1000),
      stripe_subscription_id: sub.id,
    });
  },

  'customer.subscription.updated': async (sub) => {
    await updateSubscription(sub.id, {
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000),
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    });
  },

  'customer.subscription.deleted': async (sub) => {
    await expireSubscription(sub.id);
    await scheduleStorageCleanup(sub.metadata.organization_id);
  },

  'invoice.paid': async (invoice) => {
    await saveInvoice(invoice);
  },

  'invoice.payment_failed': async (invoice) => {
    // No grace period - subscription will cancel automatically
    await sendPaymentFailedEmail(invoice.customer);
  },
};
```

### Monthly Overage Billing

```typescript
// Runs on 1st of each month at midnight
cron.schedule('0 0 1 * *', async () => {
  const lastMonth = getLastMonthString(); // '2025-10'

  // Get all active paid subscriptions
  const paidOrgs = await db.query(`
    SELECT os.*, org.storage_used_bytes
    FROM organization_subscriptions os
    JOIN organization_storage org ON os.organization_id = org.organization_id
    WHERE os.status = 'active'
    AND os.plan_id = (SELECT id FROM subscription_plans WHERE slug = 'paid')
  `);

  for (const org of paidOrgs.rows) {
    const usedGB = Math.ceil(org.storage_used_bytes / 1073741824);
    const overageGB = Math.max(0, usedGB - 5);

    if (overageGB > 0) {
      const chargeCents = overageGB * 5; // $0.05/GB

      // Create Stripe invoice item
      const invoiceItem = await stripe.invoiceItems.create({
        customer: org.stripe_customer_id,
        amount: chargeCents,
        currency: 'usd',
        description: `Storage overage: ${overageGB} GB @ $0.05/GB (${lastMonth})`,
      });

      // Record overage
      await db.query(`
        INSERT INTO storage_overages
        (organization_id, month_year, peak_storage_bytes, overage_gb, charge_cents, stripe_invoice_item_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [org.organization_id, lastMonth, org.storage_used_bytes, overageGB, chargeCents, invoiceItem.id]);
    }
  }
});
```

---

## API Endpoints

```typescript
// GET /api/billing/status
// Get current billing status
router.get('/status', authenticateToken, async (req, res) => {
  const orgId = req.user!.currentOrgId;

  const subscription = await getSubscription(orgId);
  const storage = await getStorageUsage(orgId);
  const plan = subscription?.plan || await getFreePlan();

  const usedGB = storage.storage_used_bytes / 1073741824;
  const maxGB = plan.max_storage_bytes / 1073741824;
  const overageGB = Math.max(0, Math.ceil(usedGB) - 5);

  res.json({
    plan: plan.name,
    status: subscription?.status || 'free',
    trial_ends: subscription?.trial_end,
    period_ends: subscription?.current_period_end,
    storage: {
      used_bytes: storage.storage_used_bytes,
      used_gb: usedGB.toFixed(2),
      max_gb: maxGB,
      overage_gb: plan.slug === 'paid' ? overageGB : null,
      overage_charge: plan.slug === 'paid' ? (overageGB * 0.05).toFixed(2) : null,
    },
    file_retention_days: plan.file_retention_days,
  });
});

// POST /api/billing/checkout
// Start checkout for paid plan (see above)

// POST /api/billing/cancel
// Cancel subscription (takes effect at period end)
router.post('/cancel', authenticateToken, requireOrgAdmin, async (req, res) => {
  const orgId = req.user!.currentOrgId;
  const subscription = await getSubscription(orgId);

  if (!subscription?.stripe_subscription_id) {
    return res.status(400).json({ error: 'No active subscription' });
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  await updateSubscription(subscription.id, {
    canceled_at: new Date(),
  });

  res.json({
    success: true,
    message: `Subscription will end on ${subscription.current_period_end.toDateString()}`
  });
});

// GET /api/billing/invoices
// Get invoice history
router.get('/invoices', authenticateToken, requireOrgAdmin, async (req, res) => {
  const orgId = req.user!.currentOrgId;
  const invoices = await db.query(`
    SELECT * FROM subscription_invoices
    WHERE organization_id = $1
    ORDER BY invoice_date DESC
    LIMIT 24
  `, [orgId]);
  res.json(invoices.rows);
});

// POST /api/billing/portal
// Redirect to Stripe billing portal
router.post('/portal', authenticateToken, requireOrgAdmin, async (req, res) => {
  const subscription = await getSubscription(req.user!.currentOrgId);

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${process.env.APP_URL}/billing`,
  });

  res.json({ url: session.url });
});
```

---

## Storage Tracking

### On File Upload

```typescript
async function trackFileUpload(orgId: number, fileSize: number) {
  // Check if can upload
  const storage = await getStorageUsage(orgId);
  const plan = await getOrgPlan(orgId);

  // Free tier: hard limit at 250MB
  if (plan.slug === 'free') {
    if (storage.storage_used_bytes + fileSize > plan.max_storage_bytes) {
      throw new Error('Storage limit reached. Upgrade to Paid plan for more storage.');
    }
  }
  // Paid tier: warn but allow (will be charged overage)

  // Update storage
  await db.query(`
    UPDATE organization_storage
    SET storage_used_bytes = storage_used_bytes + $1,
        last_calculated_at = CURRENT_TIMESTAMP
    WHERE organization_id = $2
  `, [fileSize, orgId]);
}
```

### On File Delete

```typescript
async function trackFileDelete(orgId: number, fileSize: number) {
  await db.query(`
    UPDATE organization_storage
    SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1),
        last_calculated_at = CURRENT_TIMESTAMP
    WHERE organization_id = $2
  `, [fileSize, orgId]);
}
```

---

## Notifications

### Email Triggers

1. **Trial starting** - Welcome + trial info
2. **7 days before trial ends** - Reminder to keep subscription
3. **Trial converted to paid** - Confirmation + receipt
4. **7 days before renewal** - Reminder (annual)
5. **Payment successful** - Receipt
6. **Payment failed** - Urgent action needed
7. **Subscription canceled** - Confirmation + what happens next
8. **Subscription expired** - Now on free tier + storage warning

### In-App Notifications

- Storage usage > 80% of limit
- Storage usage > 100% (paid tier overage warning)
- Free tier: "Files older than 7 days will be deleted"
- Trial ending in 3 days

---

## App Store Billing (If Desired)

**Option A: Stripe only (Recommended)**
- Works everywhere (web + mobile)
- Supports overage billing
- You keep ~95% of revenue

**Option B: IAP for base plan only**
- Use IAP for $20/year subscription
- No overage tracking via IAP
- Convert overage to manual billing or disable for IAP users
- Apple takes 30% (you keep $14/year)

**Option C: Skip mobile subscription**
- Show "Subscribe on web" in mobile app
- Allowed by Apple if digital goods consumed outside app
- TaskManager is arguably a "business tool" exception

**My recommendation:** Start with Stripe. Add IAP later only if mobile conversion is a problem.

---

## Implementation Checklist

### Phase 1: Database & Stripe Setup
- [ ] Create database tables
- [ ] Set up Stripe account
- [ ] Create product and price in Stripe
- [ ] Configure webhook endpoint

### Phase 2: Core Billing
- [ ] Checkout flow
- [ ] Webhook handlers
- [ ] Subscription status tracking
- [ ] Storage tracking

### Phase 3: Enforcement
- [ ] Free tier 250MB limit
- [ ] Free tier 7-day auto-delete cron
- [ ] Overage calculation cron
- [ ] Downgrade enforcement

### Phase 4: UI
- [ ] Billing status page
- [ ] Checkout button
- [ ] Storage usage meter
- [ ] Cancel subscription
- [ ] Invoice history

---

## RBAC Note

Per your direction: **Current RBAC is sufficient.** The `RBAC_DESIGN.md` document is preserved for future enhancements if needed:
- Custom roles
- Observer permissions
- Team-based access
- Granular permissions

For now, the existing member/admin/super_admin roles work fine for both free and paid tiers.
