-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  allow_join_requests BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization members (join table with roles)
CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'admin' or 'member'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

-- Organization invites table (Phase 0: Onboarding)
CREATE TABLE IF NOT EXISTS organization_invites (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invite_code VARCHAR(32) UNIQUE NOT NULL,
  created_by_id INTEGER REFERENCES users(id),
  email VARCHAR(255),
  role VARCHAR(20) DEFAULT 'member',
  expires_at TIMESTAMP,
  used_by_id INTEGER REFERENCES users(id),
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Organization join requests table (Phase 0: Onboarding)
CREATE TABLE IF NOT EXISTS organization_join_requests (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  message TEXT,
  response_message TEXT,
  reviewed_by_id INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  details TEXT,
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Deprecated: use task_assignees
  created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  schedule_type VARCHAR(50) NOT NULL DEFAULT 'one_time', -- 'one_time', 'daily', 'weekly', 'monthly'
  schedule_frequency INTEGER DEFAULT 1, -- e.g., every 2 days, every 3 weeks
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'submitted', 'completed', 'overdue'
  parent_template_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, -- For scheduled task instances
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task assignees table (Phase 1: Multi-assignee)
CREATE TABLE IF NOT EXISTS task_assignees (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMP,
  UNIQUE(task_id, user_id)
);

-- Task requirements (checklist items)
CREATE TABLE IF NOT EXISTS task_requirements (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task completions (stores completion evidence)
CREATE TABLE IF NOT EXISTS task_completions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requirement_id INTEGER REFERENCES task_requirements(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completion_type VARCHAR(50) NOT NULL, -- 'text', 'image', 'video'
  text_content TEXT,
  file_path VARCHAR(500),
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'task_assigned', 'task_due_soon', 'task_completed', 'task_overdue', 'task_submitted', 'task_approved', 'task_rejected'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task reviews table (for task creator feedback)
CREATE TABLE IF NOT EXISTS task_reviews (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'approved', 'rejected'
  comments TEXT,
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

-- Phase 0: Onboarding indexes
CREATE INDEX IF NOT EXISTS idx_organizations_public ON organizations(is_public);
CREATE INDEX IF NOT EXISTS idx_organization_invites_code ON organization_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_organization_invites_org ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_organization_invites_active ON organization_invites(is_active);
CREATE INDEX IF NOT EXISTS idx_join_requests_org ON organization_join_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON organization_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON organization_join_requests(status);

-- Phase 1: Multi-assignee indexes
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_status ON task_assignees(status);

-- Existing task indexes
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user_id ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_type ON tasks(schedule_type);
CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(created_by_id);
CREATE INDEX IF NOT EXISTS idx_tasks_private ON tasks(is_private);
CREATE INDEX IF NOT EXISTS idx_task_requirements_task_id ON task_requirements(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_reviewer_id ON task_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Audit log table for tracking all task-related actions
CREATE TABLE IF NOT EXISTS task_audit_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'deleted', 'assigned', 'status_changed', 'submitted', 'approved', 'rejected', 'requirement_added', 'requirement_completed', 'completion_added', 'completion_deleted'
  entity_type VARCHAR(50), -- 'task', 'requirement', 'completion', 'review'
  entity_id INTEGER, -- ID of the affected entity
  changes JSONB, -- Store before/after values for updates
  metadata JSONB, -- Additional context (IP, user agent, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON task_audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON task_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON task_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON task_audit_logs(created_at DESC);
