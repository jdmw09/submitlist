import pool from '../config/database';
import fs from 'fs';
import path from 'path';
import { isBillingEnabled } from './billingService';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour

// Delete files that have exceeded retention period
export const cleanupExpiredFiles = async (): Promise<{ deleted: number; errors: number }> => {
  let deleted = 0;
  let errors = 0;

  try {
    // Query files that have exceeded their retention period
    // Join with organizations to get their plan's retention days
    const result = await pool.query(`
      SELECT
        tc.id,
        tc.file_path,
        tc.file_size_bytes,
        tc.completed_at,
        t.organization_id,
        u.id as user_id,
        COALESCE(sp.file_retention_days, 7) as retention_days
      FROM task_completions tc
      JOIN tasks t ON tc.task_id = t.id
      JOIN users u ON tc.user_id = u.id
      LEFT JOIN organization_subscriptions os ON t.organization_id = os.organization_id
      LEFT JOIN subscription_plans sp ON os.plan_id = sp.id
      WHERE tc.file_path IS NOT NULL
        AND sp.file_retention_days IS NOT NULL
        AND tc.completed_at < CURRENT_TIMESTAMP - (COALESCE(sp.file_retention_days, 7) || ' days')::INTERVAL
    `);

    for (const row of result.rows) {
      try {
        const filePath = path.join(UPLOAD_DIR, row.file_path);

        // Check if file exists
        if (fs.existsSync(filePath)) {
          // Delete the file
          fs.unlinkSync(filePath);
          console.log(`Deleted expired file: ${filePath}`);
        }

        // Update the task completion record
        await pool.query(
          `UPDATE task_completions SET file_path = NULL, file_size_bytes = 0 WHERE id = $1`,
          [row.id]
        );

        // Update storage tracking
        if (row.file_size_bytes && row.file_size_bytes > 0) {
          // Update org storage
          await pool.query(
            `UPDATE organization_storage
             SET storage_used_bytes = GREATEST(0, storage_used_bytes - $1),
                 last_calculated_at = CURRENT_TIMESTAMP
             WHERE organization_id = $2`,
            [row.file_size_bytes, row.organization_id]
          );

          // Update user storage contribution
          await pool.query(
            `UPDATE user_storage_contributions
             SET storage_bytes = GREATEST(0, storage_bytes - $1),
                 file_count = GREATEST(0, file_count - 1)
             WHERE organization_id = $2 AND user_id = $3`,
            [row.file_size_bytes, row.organization_id, row.user_id]
          );
        }

        deleted++;
      } catch (fileError) {
        console.error(`Error deleting file ${row.file_path}:`, fileError);
        errors++;
      }
    }

    if (deleted > 0) {
      console.log(`File retention cleanup: ${deleted} files deleted, ${errors} errors`);
    }
  } catch (error) {
    console.error('Error in file retention cleanup:', error);
  }

  return { deleted, errors };
};

// Start the file retention service
export const startFileRetentionService = () => {
  // Only run if billing is enabled
  if (!isBillingEnabled()) {
    console.log('File retention service disabled (billing not enabled)');
    return;
  }

  console.log('Starting file retention service...');

  // Run immediately on startup
  cleanupExpiredFiles();

  // Then run periodically
  setInterval(() => {
    cleanupExpiredFiles();
  }, CHECK_INTERVAL);
};

// Manual trigger for cleanup (admin use)
export const triggerFileRetentionCleanup = async (): Promise<{ deleted: number; errors: number }> => {
  return cleanupExpiredFiles();
};

// Get files approaching expiration for an organization
export const getExpiringFiles = async (
  orgId: number,
  daysUntilExpiry: number = 3
): Promise<Array<{ file_path: string; expires_at: Date; task_title: string }>> => {
  const result = await pool.query(`
    SELECT
      tc.file_path,
      tc.completed_at + (COALESCE(sp.file_retention_days, 7) || ' days')::INTERVAL as expires_at,
      t.title as task_title
    FROM task_completions tc
    JOIN tasks t ON tc.task_id = t.id
    LEFT JOIN organization_subscriptions os ON t.organization_id = os.organization_id
    LEFT JOIN subscription_plans sp ON os.plan_id = sp.id
    WHERE t.organization_id = $1
      AND tc.file_path IS NOT NULL
      AND sp.file_retention_days IS NOT NULL
      AND tc.completed_at + (COALESCE(sp.file_retention_days, 7) || ' days')::INTERVAL
          BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + ($2 || ' days')::INTERVAL
    ORDER BY expires_at ASC
  `, [orgId, daysUntilExpiry]);

  return result.rows;
};
