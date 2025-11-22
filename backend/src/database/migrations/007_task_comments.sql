-- Migration 007: Task Comments
-- Adds task comments/discussion feature with threading support

-- Task comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id INTEGER REFERENCES task_comments(id) ON DELETE CASCADE, -- For threaded replies
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_parent_id ON task_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at DESC);

-- Add comment notification type to existing notifications
-- (The notifications table already supports custom types via VARCHAR)

-- Add last_generated_at to tasks for better recurring task tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP;

-- Create index for recurring task queries
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(schedule_type, parent_template_id)
  WHERE schedule_type != 'one_time';

-- Update existing template tasks to set last_generated_at
UPDATE tasks
SET last_generated_at = created_at
WHERE schedule_type != 'one_time'
  AND parent_template_id IS NULL
  AND last_generated_at IS NULL;
