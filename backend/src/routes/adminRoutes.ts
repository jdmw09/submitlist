import { Router } from 'express';
import {
  createUser,
  getAllUsers,
  getUserById,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  forcePasswordReset,
  getAuditLogs,
  getUserOrganizations,
  addUserToOrganization,
  removeUserFromOrganization,
  updateUserOrganizationRole,
  getAllOrganizations,
} from '../controllers/adminController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/auth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// User management
router.post('/users', createUser); // Create new user
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/role', updateUserRole); // Admin can promote to admin, super_admin can promote to super_admin
router.put('/users/:id/status', updateUserStatus); // Suspend/activate
router.delete('/users/:id', deleteUser); // Soft delete
router.post('/users/:id/force-password-reset', forcePasswordReset);

// Audit logs
router.get('/audit-logs', getAuditLogs);

// Organization management
router.get('/organizations', getAllOrganizations);
router.get('/users/:id/organizations', getUserOrganizations);
router.post('/users/:id/organizations', addUserToOrganization);
router.delete('/users/:id/organizations/:orgId', removeUserFromOrganization);
router.put('/users/:id/organizations/:orgId/role', updateUserOrganizationRole);

export default router;
