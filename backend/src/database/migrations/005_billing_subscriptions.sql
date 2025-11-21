-- Migration: 005_billing_subscriptions.sql
-- Description: Add subscription billing tables with storage tracking

-- 1. Subscription Plans Table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(20) UNIQUE NOT NULL,
  price_cents INTEGER NOT NULL,
  billing_interval VARCHAR(20),
  max_storage_bytes BIGINT NOT NULL,
  file_retention_days INTEGER,
  stripe_price_id VARCHAR(255),
  apple_product_id VARCHAR(255),
  google_product_id VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed subscription plans
INSERT INTO subscription_plans (name, slug, price_cents, billing_interval, max_storage_bytes, file_retention_days, display_order)
VALUES
  ('Free', 'free', 0, NULL, 262144000, 7, 1),
  ('Paid', 'paid', 2000, 'year', 5368709120, 30, 2),
  ('Premium', 'premium', 9900, 'year', 107374182400, NULL, 3)
ON CONFLICT (slug) DO NOTHING;

-- 2. Organization Subscriptions Table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  plan_id INTEGER REFERENCES subscription_plans(id),
  status VARCHAR(30) NOT NULL DEFAULT 'free',
  trial_end TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  canceled_at TIMESTAMP,
  payment_platform VARCHAR(20),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  apple_transaction_id VARCHAR(255),
  google_purchase_token TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_sub_status ON organization_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_org_sub_platform ON organization_subscriptions(payment_platform);

-- 3. Organization Storage Table
CREATE TABLE IF NOT EXISTS organization_storage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  storage_used_bytes BIGINT DEFAULT 0,
  last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_storage_org ON organization_storage(organization_id);

-- 4. User Storage Contributions Table
CREATE TABLE IF NOT EXISTS user_storage_contributions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  storage_bytes BIGINT DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  last_upload_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_storage_org ON user_storage_contributions(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_storage_user ON user_storage_contributions(user_id);

-- 5. Subscription Receipts Table
CREATE TABLE IF NOT EXISTS subscription_receipts (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  payment_platform VARCHAR(20) NOT NULL,
  stripe_invoice_id VARCHAR(255),
  apple_transaction_id VARCHAR(255),
  google_order_id VARCHAR(255),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  receipt_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_receipts_org ON subscription_receipts(organization_id);

-- 6. Add file_size column to task_completions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_completions' AND column_name = 'file_size_bytes'
  ) THEN
    ALTER TABLE task_completions ADD COLUMN file_size_bytes BIGINT DEFAULT 0;
  END IF;
END $$;

-- 7. Initialize storage for existing organizations
INSERT INTO organization_storage (organization_id, storage_used_bytes)
SELECT id, 0 FROM organizations
WHERE id NOT IN (SELECT organization_id FROM organization_storage)
ON CONFLICT DO NOTHING;

-- 8. Initialize subscriptions for existing organizations (default to free)
INSERT INTO organization_subscriptions (organization_id, plan_id, status)
SELECT o.id, sp.id, 'free'
FROM organizations o
CROSS JOIN subscription_plans sp
WHERE sp.slug = 'free'
AND o.id NOT IN (SELECT organization_id FROM organization_subscriptions WHERE organization_id IS NOT NULL)
ON CONFLICT DO NOTHING;
