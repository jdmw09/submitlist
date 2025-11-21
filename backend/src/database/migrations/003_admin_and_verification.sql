-- Migration: Admin Roles, Email Verification, and Password Reset
-- Created: 2025-11-20
-- Purpose: Add admin functionality, email verification, and password reset system

-- ==================== USERS TABLE MODIFICATIONS ====================

-- Add role column for admin functionality
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';
-- Possible values: 'member', 'admin', 'super_admin'

-- Add email verification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;

-- Add password management columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add account status column
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';
-- Possible values: 'active', 'suspended', 'deleted'

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

-- ==================== EMAIL VERIFICATION TOKENS ====================

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP,
  is_valid BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);

-- ==================== PASSWORD RESET TOKENS ====================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP,
  is_valid BOOLEAN DEFAULT true,
  created_by_admin_id INTEGER REFERENCES users(id), -- NULL if user-initiated
  ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ==================== ADMIN AUDIT LOG ====================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  -- Possible actions: 'reset_password', 'transfer_org_ownership', 'delete_user',
  -- 'verify_email', 'suspend_user', 'unsuspend_user', 'change_user_role',
  -- 'force_add_member', 'force_remove_member'
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  details JSONB, -- Additional action details
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

-- ==================== DATA MIGRATION ====================

-- Auto-verify all existing users (as per decision)
UPDATE users
SET email_verified = true,
    email_verified_at = NOW()
WHERE email_verified = false;

-- Set last_password_change for existing users to their created_at date
UPDATE users
SET last_password_change = created_at
WHERE last_password_change IS NULL;

-- ==================== COMMENTS ====================

COMMENT ON TABLE email_verification_tokens IS 'Stores email verification tokens for new user signups';
COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for both user-initiated and admin-initiated resets';
COMMENT ON TABLE admin_audit_logs IS 'Comprehensive audit log for all admin actions';

COMMENT ON COLUMN users.role IS 'User role: member (default), admin, super_admin';
COMMENT ON COLUMN users.email_verified IS 'Whether user has verified their email address';
COMMENT ON COLUMN users.force_password_change IS 'User must change password on next login';
COMMENT ON COLUMN users.account_status IS 'Account status: active, suspended, deleted';
