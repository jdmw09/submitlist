-- Migration 006: Organization Settings and Task Archive
-- Adds organization-level settings for task display and auto-archive functionality

-- Organization settings table
CREATE TABLE IF NOT EXISTS organization_settings (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,

  -- Task display settings
  default_task_sort VARCHAR(20) NOT NULL DEFAULT 'due_date', -- 'due_date' | 'priority'
  hide_completed_tasks BOOLEAN NOT NULL DEFAULT false,

  -- Archive settings
  auto_archive_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_archive_after_days INTEGER DEFAULT 7, -- Days after completion to auto-archive (null = manual only)
  archive_schedule VARCHAR(20) NOT NULL DEFAULT 'daily', -- 'daily' | 'weekly_sunday' | 'weekly_monday'

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add archived_at column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NULL;

-- Index for efficient archive queries
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at);
CREATE INDEX IF NOT EXISTS idx_tasks_not_archived ON tasks(organization_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(organization_id, archived_at) WHERE archived_at IS NOT NULL;

-- Index for organization settings lookup
CREATE INDEX IF NOT EXISTS idx_organization_settings_org ON organization_settings(organization_id);

-- Create default settings for existing organizations
INSERT INTO organization_settings (organization_id)
SELECT id FROM organizations
WHERE id NOT IN (SELECT organization_id FROM organization_settings)
ON CONFLICT (organization_id) DO NOTHING;

-- Function to auto-create settings when organization is created
CREATE OR REPLACE FUNCTION create_org_settings_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organization_settings (organization_id)
  VALUES (NEW.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create settings for new organizations
DROP TRIGGER IF EXISTS trigger_create_org_settings ON organizations;
CREATE TRIGGER trigger_create_org_settings
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_org_settings_on_insert();

-- Add comment for documentation
COMMENT ON TABLE organization_settings IS 'Organization-level settings for task display and archive behavior';
COMMENT ON COLUMN organization_settings.default_task_sort IS 'Default sort order: due_date (by end_date) or priority (by status then due date)';
COMMENT ON COLUMN organization_settings.hide_completed_tasks IS 'If true, completed tasks are hidden from default task list view';
COMMENT ON COLUMN organization_settings.auto_archive_enabled IS 'If true, completed tasks are automatically archived';
COMMENT ON COLUMN organization_settings.auto_archive_after_days IS 'Number of days after completion before auto-archiving';
COMMENT ON COLUMN organization_settings.archive_schedule IS 'When to run auto-archive: daily, weekly_sunday, or weekly_monday';
COMMENT ON COLUMN tasks.archived_at IS 'Timestamp when task was archived, null if not archived';
