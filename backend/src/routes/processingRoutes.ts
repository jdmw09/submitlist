import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { getJob, getJobStats } from '../services/processingJobService';

const router = express.Router();

// Get job status by ID
router.get('/jobs/:jobId', authenticateToken, (req, res) => {
  const { jobId } = req.params;

  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({ job });
});

// Get job statistics (admin endpoint)
router.get('/jobs/stats', authenticateToken, (req, res) => {
  const stats = getJobStats();
  res.json({ stats });
});

export default router;
