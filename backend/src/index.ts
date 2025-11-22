import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import organizationRoutes from './routes/organizationRoutes';
import groupRoutes from './routes/groupRoutes';
import taskRoutes from './routes/taskRoutes';
import notificationRoutes from './routes/notificationRoutes';
import processingRoutes from './routes/processingRoutes';
import billingRoutes from './routes/billingRoutes';
import iapRoutes from './routes/iapRoutes';
import { startScheduledTaskService } from './services/scheduledTaskService';
import { startFileRetentionService } from './services/fileRetentionService';
import { startArchiveTaskService } from './services/archiveTaskService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());

// Debug middleware for file uploads - logs before any parsing
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path.includes('completions')) {
    const contentLength = req.headers['content-length'];
    const contentType = req.headers['content-type'];
    const userAgent = req.headers['user-agent'];
    console.log(`[Upload Debug] POST ${req.path}`);
    console.log(`[Upload Debug] Content-Length: ${contentLength} bytes (${Math.round(parseInt(contentLength || '0') / 1024 / 1024 * 100) / 100} MB)`);
    console.log(`[Upload Debug] Content-Type: ${contentType}`);
    console.log(`[Upload Debug] User-Agent: ${userAgent?.substring(0, 100)}`);
    console.log(`[Upload Debug] Is iOS Safari: ${userAgent?.includes('Safari') && (userAgent?.includes('iPhone') || userAgent?.includes('iPad'))}`);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/iap', iapRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Task Manager API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      organizations: '/api/organizations',
      groups: '/api/groups',
      tasks: '/api/tasks',
      notifications: '/api/notifications',
      billing: '/api/billing',
      iap: '/api/iap',
    },
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start scheduled task service
  startScheduledTaskService();

  // Start file retention service (for billing-based file cleanup)
  startFileRetentionService();

  // Start archive task service (for auto-archiving completed tasks)
  startArchiveTaskService();
});

export default app;
