-- Migration: Create First Super Admin
-- Created: 2025-11-20
-- Purpose: Promote the first user to super_admin role

-- ==================== INSTRUCTIONS ====================
-- Replace 'your_email@example.com' with the email of the user you want to promote
-- This script is safe to run multiple times - it will only update if the user exists

-- ==================== PROMOTE USER ====================

-- Option 1: Promote by email (RECOMMENDED)
-- UPDATE users
-- SET role = 'super_admin'
-- WHERE email = 'your_email@example.com'
-- AND role != 'super_admin';

-- Option 2: Promote first user created (fallback)
-- UPDATE users
-- SET role = 'super_admin'
-- WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
-- AND role != 'super_admin';

-- ==================== VERIFY SUPER ADMIN ====================

-- Run this query to see current super admins:
-- SELECT id, email, username, name, role, created_at
-- FROM users
-- WHERE role = 'super_admin';

-- ==================== NOTES ====================
-- IMPORTANT: Uncomment ONE of the UPDATE statements above before running
-- After running, verify the super admin was created successfully
-- You can manually promote additional admins using:
--   UPDATE users SET role = 'super_admin' WHERE email = 'another@example.com';
