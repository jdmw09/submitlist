# Subscription Billing System Design

## Overview

Three-tier subscription model with fixed pricing, compatible with both Stripe and App Store IAP.

---

## Subscription Tiers

| | Free | Paid | Premium |
|---|---|---|---|
| **Price** | $0 | $20/year | $99/year |
| **Storage** | 250 MB | 5 GB | 100 GB |
| **File Retention** | 7 days | 30 days | Forever |
| **Features** | All | All | All |

---

### Free Tier
**Price:** $0

- 250 MB storage max
- Files auto-deleted after 7 days
- All features included

---

### Paid Tier
**Price:** $20/year

- 5 GB storage max
- Files auto-deleted after 30 days
- All features included

---

### Premium Tier
**Price:** $99/year

- 100 GB storage max
- Files never auto-deleted
- All features included

---

## Why This Works for IAP

| Requirement | Status |
|-------------|--------|
| Fixed pricing | ✅ $20/yr and $99/yr |
| No metered/usage billing | ✅ Hard storage limits |
| Annual subscriptions | ✅ Supported by IAP |
| Auto-renewal | ✅ Handled by App Store |

**Revenue comparison:**

| Tier | Price | Stripe (97%) | IAP (70%) | IAP Small Biz (85%) |
|------|-------|--------------|-----------|---------------------|
| Paid | $20/yr | $19.40 | $14.00 | $17.00 |
| Premium | $99/yr | $96.00 | $69.30 | $84.15 |

*Small Business Program: <$1M annual revenue = 15% fee instead of 30%*

---

## Key Policies

| Policy | Decision |
|--------|----------|
| Trial length | 14 days (Premium features) |
| Payment upfront | Yes |
| Downgrade enforcement | Hard - at period end |
| Grace period | None |
| Refunds | None (App Store handles) |

---

## Storage & Retention Enforcement

### Hard Storage Limits

```typescript
async function canUpload(orgId: number, fileSize: number): Promise<boolean> {
  const storage = await getStorageUsage(orgId);
  const plan = await getOrgPlan(orgId);

  if (storage.used_bytes + fileSize > plan.max_storage_bytes) {
    const planNames = { free: 'Free', paid: 'Paid', premium: 'Premium' };
    const upgradeTo = plan.slug === 'free' ? 'Paid' : 'Premium';

    throw new StorageLimitError(
      `Storage limit reached (${formatBytes(plan.max_storage_bytes)}). ` +
      `Upgrade to ${upgradeTo} for more storage.`
    );
  }
  return true;
}
```

### Auto-Delete Cron (Daily at 2 AM)

```typescript
cron.schedule('0 2 * * *', async () => {
  // Free tier: delete files older than 7 days
  await deleteExpiredFiles('free', 7);

  // Paid tier: delete files older than 30 days
  await deleteExpiredFiles('paid', 30);

  // Premium tier: no auto-delete
});

async function deleteExpiredFiles(planSlug: string, retentionDays: number) {
  const result = await db.query(`
    DELETE FROM task_completions tc
    USING tasks t, organizations o
    LEFT JOIN organization_subscriptions os ON o.id = os.organization_id
    LEFT JOIN subscription_plans sp ON os.plan_id = sp.id
    WHERE tc.task_id = t.id
    AND t.organization_id = o.id
    AND tc.file_path IS NOT NULL
    AND tc.completed_at < CURRENT_TIMESTAMP - INTERVAL '${retentionDays} days'
    AND (
      (sp.slug IS NULL AND '${planSlug}' = 'free') OR
      sp.slug = '${planSlug}'
    )
    RETURNING tc.file_path, t.organization_id
  `);

  // Delete actual files and update storage
  for (const row of result.rows) {
    await deleteFileFromDisk(row.file_path);
    await recalculateStorage(row.organization_id);
  }

  console.log(`Deleted ${result.rowCount} expired files for ${planSlug} tier`);
}
```

---

## Database Schema

### 1. `subscription_plans` Table

```sql
CREATE TABLE subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,              -- 'Free', 'Paid', 'Premium'
  slug VARCHAR(20) UNIQUE NOT NULL,       -- 'free', 'paid', 'premium'
  price_cents INTEGER NOT NULL,           -- 0, 2000, 9900
  billing_interval VARCHAR(20),           -- NULL, 'year', 'year'
  max_storage_bytes BIGINT NOT NULL,
  file_retention_days INTEGER,            -- 7, 30, NULL (forever)

  -- Platform-specific IDs
  stripe_price_id VARCHAR(255),
  apple_product_id VARCHAR(255),
  google_product_id VARCHAR(255),

  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO subscription_plans
(name, slug, price_cents, billing_interval, max_storage_bytes, file_retention_days, display_order)
VALUES
('Free', 'free', 0, NULL, 262144000, 7, 1),           -- 250 MB
('Paid', 'paid', 2000, 'year', 5368709120, 30, 2),    -- 5 GB
('Premium', 'premium', 9900, 'year', 107374182400, NULL, 3);  -- 100 GB
```

### 2. `organization_subscriptions` Table

```sql
CREATE TABLE organization_subscriptions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id INTEGER REFERENCES subscription_plans(id),

  status VARCHAR(30) NOT NULL,            -- 'trialing', 'active', 'canceled', 'expired'

  -- Dates
  trial_end TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,

  -- Payment platform (only one will be set)
  payment_platform VARCHAR(20),           -- 'stripe', 'apple', 'google'
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  apple_transaction_id VARCHAR(255),
  google_purchase_token TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_sub_status ON organization_subscriptions(status);
CREATE INDEX idx_org_sub_platform ON organization_subscriptions(payment_platform);
```

### 3. `organization_storage` Table

```sql
CREATE TABLE organization_storage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  storage_used_bytes BIGINT DEFAULT 0,
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. `subscription_receipts` Table

```sql
CREATE TABLE subscription_receipts (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  payment_platform VARCHAR(20) NOT NULL,

  -- Platform-specific receipt data
  stripe_invoice_id VARCHAR(255),
  apple_transaction_id VARCHAR(255),
  google_order_id VARCHAR(255),

  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  receipt_date TIMESTAMP NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Payment Platform Integration

### Option 1: Stripe (Web)

```typescript
// POST /api/billing/checkout
router.post('/checkout', authenticateToken, requireOrgAdmin, async (req, res) => {
  const { planSlug } = req.body;  // 'paid' or 'premium'
  const orgId = req.user!.currentOrgId;

  const plan = await getPlanBySlug(planSlug);

  const session = await stripe.checkout.sessions.create({
    customer: await getOrCreateStripeCustomer(orgId, req.user!.email),
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    mode: 'subscription',
    subscription_data: { trial_period_days: 14 },
    success_url: `${APP_URL}/billing/success`,
    cancel_url: `${APP_URL}/billing`,
    metadata: { organization_id: orgId.toString(), plan_slug: planSlug }
  });

  res.json({ url: session.url });
});
```

### Option 2: Apple IAP (iOS)

```typescript
// POST /api/billing/apple/verify
router.post('/apple/verify', authenticateToken, async (req, res) => {
  const { receiptData, productId } = req.body;
  const orgId = req.user!.currentOrgId;

  // Verify with Apple
  const verification = await verifyAppleReceipt(receiptData);

  if (!verification.valid) {
    return res.status(400).json({ error: 'Invalid receipt' });
  }

  const plan = await getPlanByAppleProductId(productId);

  // Create/update subscription
  await upsertSubscription(orgId, {
    plan_id: plan.id,
    status: 'active',
    payment_platform: 'apple',
    apple_transaction_id: verification.transactionId,
    current_period_start: verification.purchaseDate,
    current_period_end: verification.expiresDate,
  });

  res.json({ success: true, plan: plan.name });
});

// Apple Server-to-Server notifications endpoint
router.post('/apple/webhook', async (req, res) => {
  const notification = req.body;

  switch (notification.notificationType) {
    case 'DID_RENEW':
      await renewSubscription(notification);
      break;
    case 'DID_FAIL_TO_RENEW':
    case 'EXPIRED':
      await expireSubscription(notification);
      break;
    case 'DID_CHANGE_RENEWAL_STATUS':
      await handleRenewalStatusChange(notification);
      break;
  }

  res.sendStatus(200);
});
```

### Option 3: Google Play (Android)

```typescript
// POST /api/billing/google/verify
router.post('/google/verify', authenticateToken, async (req, res) => {
  const { purchaseToken, productId } = req.body;
  const orgId = req.user!.currentOrgId;

  // Verify with Google Play
  const verification = await verifyGooglePurchase(productId, purchaseToken);

  if (!verification.valid) {
    return res.status(400).json({ error: 'Invalid purchase' });
  }

  const plan = await getPlanByGoogleProductId(productId);

  // Acknowledge the purchase (required by Google)
  await acknowledgeGooglePurchase(productId, purchaseToken);

  await upsertSubscription(orgId, {
    plan_id: plan.id,
    status: 'active',
    payment_platform: 'google',
    google_purchase_token: purchaseToken,
    current_period_start: new Date(verification.startTimeMillis),
    current_period_end: new Date(verification.expiryTimeMillis),
  });

  res.json({ success: true, plan: plan.name });
});

// Google Real-time Developer Notifications
router.post('/google/webhook', async (req, res) => {
  const message = JSON.parse(
    Buffer.from(req.body.message.data, 'base64').toString()
  );

  switch (message.subscriptionNotification?.notificationType) {
    case 2: // SUBSCRIPTION_RENEWED
      await renewGoogleSubscription(message);
      break;
    case 3: // SUBSCRIPTION_CANCELED
    case 13: // SUBSCRIPTION_EXPIRED
      await expireGoogleSubscription(message);
      break;
  }

  res.sendStatus(200);
});
```

---

## Mobile App Implementation

### iOS (Swift)

```swift
// ProductIDs
let paidProductId = "com.submitlist.paid.yearly"
let premiumProductId = "com.submitlist.premium.yearly"

func purchase(productId: String) async throws {
    let product = try await Product.products(for: [productId]).first!
    let result = try await product.purchase()

    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)

        // Send to backend for verification
        try await API.verifyApplePurchase(
            receiptData: transaction.receiptData,
            productId: productId
        )

        await transaction.finish()

    case .pending:
        // Transaction pending (e.g., parental approval)
        break
    case .userCancelled:
        break
    @unknown default:
        break
    }
}
```

### Android (Kotlin)

```kotlin
val paidProductId = "com.submitlist.paid.yearly"
val premiumProductId = "com.submitlist.premium.yearly"

fun purchase(productId: String) {
    val productList = listOf(
        QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
    )

    billingClient.queryProductDetailsAsync(params) { _, productDetailsList ->
        val productDetails = productDetailsList.firstOrNull() ?: return@queryProductDetailsAsync

        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(productDetails)
                    .build()
            ))
            .build()

        billingClient.launchBillingFlow(activity, flowParams)
    }
}

override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
    if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
        for (purchase in purchases) {
            // Send to backend for verification
            api.verifyGooglePurchase(
                purchaseToken = purchase.purchaseToken,
                productId = purchase.products.first()
            )
        }
    }
}
```

---

## Downgrade Flow

### Paid/Premium → Free (Hard Enforcement)

When subscription expires:

1. **Status changes to 'expired'**
2. **Email sent:** "Your subscription has ended"
3. **Storage check:**
   - If storage > 250MB: Block new uploads
   - Show: "Delete files to continue uploading (Free limit: 250MB)"
4. **Retention starts:**
   - Files begin 7-day countdown
   - Daily cron deletes files older than 7 days

### Premium → Paid (Downgrade)

When user switches plans:

1. **Takes effect at period end**
2. **Storage check:**
   - If storage > 5GB: Block new uploads after switch
   - Show: "Delete files to continue uploading (Paid limit: 5GB)"
3. **Retention changes:**
   - Files now subject to 30-day retention
   - Old files (>30 days) deleted on next cron run

---

## API Endpoints

```typescript
// GET /api/billing/status
router.get('/status', authenticateToken, async (req, res) => {
  const orgId = req.user!.currentOrgId;
  const subscription = await getSubscription(orgId);
  const storage = await getStorageUsage(orgId);
  const plan = subscription?.plan || await getFreePlan();

  res.json({
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
      used_bytes: storage.storage_used_bytes,
      max_bytes: plan.max_storage_bytes,
      percentage: (storage.storage_used_bytes / plan.max_storage_bytes) * 100,
    },
  });
});

// GET /api/billing/plans
router.get('/plans', async (req, res) => {
  const plans = await db.query(`
    SELECT name, slug, price_cents, billing_interval,
           max_storage_bytes, file_retention_days
    FROM subscription_plans
    WHERE is_active = TRUE
    ORDER BY display_order
  `);
  res.json(plans.rows);
});

// POST /api/billing/checkout (Stripe - web)
// POST /api/billing/apple/verify (iOS)
// POST /api/billing/google/verify (Android)
// POST /api/billing/cancel
// GET /api/billing/receipts
```

---

## App Store Setup

### Apple App Store Connect

1. **Create Products:**
   - `com.submitlist.paid.yearly` - $19.99/year
   - `com.submitlist.premium.yearly` - $99.99/year

2. **Configure Server Notifications:**
   - URL: `https://api.submitlist.space/billing/apple/webhook`
   - Version 2 notifications

3. **Enable Subscription Offer Codes** (optional)

### Google Play Console

1. **Create Subscriptions:**
   - `com.submitlist.paid.yearly` - $19.99/year
   - `com.submitlist.premium.yearly` - $99.99/year

2. **Configure Real-time Developer Notifications:**
   - Topic: `projects/submitlist/topics/play-billing`

3. **Set up Cloud Pub/Sub** to forward to webhook

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create/migrate subscription tables
- [ ] Seed plan data
- [ ] Add storage tracking

### Phase 2: Stripe (Web)
- [ ] Create Stripe products/prices
- [ ] Checkout flow
- [ ] Webhook handlers
- [ ] Billing portal

### Phase 3: Storage Enforcement
- [ ] Upload limit checking
- [ ] Auto-delete cron job
- [ ] Storage recalculation

### Phase 4: Apple IAP (iOS)
- [ ] Create App Store products
- [ ] StoreKit 2 integration
- [ ] Receipt verification endpoint
- [ ] Server notifications

### Phase 5: Google Play (Android)
- [ ] Create Play Store subscriptions
- [ ] Billing Library integration
- [ ] Purchase verification endpoint
- [ ] RTDN webhook

### Phase 6: UI
- [ ] Plans comparison page
- [ ] Storage meter
- [ ] Upgrade prompts
- [ ] Receipt history

---

## RBAC Note

Current RBAC (member/admin/super_admin) is sufficient. See `RBAC_DESIGN.md` for future enhancements if needed.
