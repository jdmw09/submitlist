-- Add task reviews table for task creator feedback
CREATE TABLE IF NOT EXISTS task_reviews (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'approved', 'rejected'
  comments TEXT,
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_reviewer_id ON task_reviews(reviewer_id);

-- Update notification types comment to include new types
COMMENT ON COLUMN notifications.type IS 'task_assigned, task_due_soon, task_completed, task_overdue, task_submitted, task_approved, task_rejected';
