import { compressVideo, VideoCompressionProgress } from '../utils/videoCompressor';
import path from 'path';

/**
 * Processing Job Service
 * Tracks async video compression jobs
 *
 * Features:
 * - In-memory job tracking (upgrade to Redis/database for production scale)
 * - Progress updates
 * - Error handling
 * - Job status queries
 * - Automatic cleanup after completion
 */

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingJob {
  jobId: string;
  taskId: number;
  completionId: number;
  filePath: string;
  status: JobStatus;
  progress: number;
  error?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  newPath?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// In-memory job store (use Redis in production)
const jobs = new Map<string, ProcessingJob>();

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new processing job
 */
export function createJob(
  taskId: number,
  completionId: number,
  filePath: string
): ProcessingJob {
  const jobId = generateJobId();

  const job: ProcessingJob = {
    jobId,
    taskId,
    completionId,
    filePath,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  jobs.set(jobId, job);

  console.log(`[Job Service] Created job: ${jobId}`);

  return job;
}

/**
 * Get job by ID
 */
export function getJob(jobId: string): ProcessingJob | undefined {
  return jobs.get(jobId);
}

/**
 * Get all jobs for a completion
 */
export function getJobsByCompletion(completionId: number): ProcessingJob[] {
  return Array.from(jobs.values()).filter(
    job => job.completionId === completionId
  );
}

/**
 * Update job status
 */
export function updateJob(jobId: string, updates: Partial<ProcessingJob>): void {
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`[Job Service] Job not found: ${jobId}`);
    return;
  }

  Object.assign(job, updates, { updatedAt: new Date() });
  jobs.set(jobId, job);
}

/**
 * Delete job from memory
 */
export function deleteJob(jobId: string): void {
  jobs.delete(jobId);
  console.log(`[Job Service] Deleted job: ${jobId}`);
}

/**
 * Start video compression job
 */
export async function startVideoCompression(
  jobId: string
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  try {
    // Update status to processing
    updateJob(jobId, { status: 'processing' });

    console.log(`[Job Service] Starting compression: ${jobId}`);

    // Start compression with progress tracking
    const result = await compressVideo(
      job.filePath,
      {},
      (progress: VideoCompressionProgress) => {
        // Update job progress
        updateJob(jobId, {
          progress: Math.round(progress.percent || 0),
        });
      }
    );

    // Update job with results
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      compressionRatio: result.compressionRatio,
      newPath: result.newPath,
      completedAt: new Date(),
    });

    console.log(`[Job Service] Completed: ${jobId}`);
    console.log(`  Saved: ${result.compressionRatio.toFixed(1)}%`);

    // Auto-cleanup after 1 hour
    setTimeout(() => {
      deleteJob(jobId);
    }, 60 * 60 * 1000);
  } catch (error) {
    console.error(`[Job Service] Failed: ${jobId}`, error);

    // Update job with error
    updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: new Date(),
    });

    // Delete failed jobs after 10 minutes
    setTimeout(() => {
      deleteJob(jobId);
    }, 10 * 60 * 1000);
  }
}

/**
 * Process video compression in background
 * Fire and forget - doesn't block the request
 */
export function processVideoInBackground(
  taskId: number,
  completionId: number,
  filePath: string
): string {
  // Create job
  const job = createJob(taskId, completionId, filePath);

  // Start processing asynchronously (don't await)
  startVideoCompression(job.jobId).catch(error => {
    console.error('[Job Service] Background processing error:', error);
  });

  return job.jobId;
}

/**
 * Get job statistics
 */
export function getJobStats(): {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
} {
  const allJobs = Array.from(jobs.values());

  return {
    total: allJobs.length,
    pending: allJobs.filter(j => j.status === 'pending').length,
    processing: allJobs.filter(j => j.status === 'processing').length,
    completed: allJobs.filter(j => j.status === 'completed').length,
    failed: allJobs.filter(j => j.status === 'failed').length,
  };
}

/**
 * Clean up old completed jobs
 * Call this periodically (e.g., via cron)
 */
export function cleanupOldJobs(maxAgeHours: number = 24): number {
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1000;
  let deleted = 0;

  for (const [jobId, job] of jobs.entries()) {
    const age = now - job.createdAt.getTime();

    if (
      (job.status === 'completed' || job.status === 'failed') &&
      age > maxAge
    ) {
      jobs.delete(jobId);
      deleted++;
    }
  }

  if (deleted > 0) {
    console.log(`[Job Service] Cleaned up ${deleted} old jobs`);
  }

  return deleted;
}

// Auto-cleanup every hour
setInterval(() => {
  cleanupOldJobs(24);
}, 60 * 60 * 1000);
