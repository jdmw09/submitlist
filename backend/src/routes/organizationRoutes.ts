import { Router } from 'express';
import {
  createOrganization,
  getUserOrganizations,
  getOrganizationDetails,
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
  // Phase 0: Invites
  createInvite,
  getInviteDetails,
  acceptInvite,
  // Phase 0: Join Requests
  createJoinRequest,
  getJoinRequests,
  reviewJoinRequest,
  // Phase 0: Public Organizations
  getPublicOrganizations,
  // Phase 1: Task Groups
  createTaskGroup,
  getTaskGroups,
  getTaskGroupDetails,
  updateTaskGroup,
  deleteTaskGroup,
  addGroupMembers,
  removeGroupMember,
  // Organization Settings
  getOrganizationSettings,
  updateOrganizationSettings,
} from '../controllers/organizationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.get('/public', getPublicOrganizations);
router.get('/invites/:inviteCode', getInviteDetails);

// All other routes require authentication
router.use(authenticateToken);

// Organization management
router.post('/', createOrganization);
router.get('/', getUserOrganizations);
router.get('/:organizationId', getOrganizationDetails);

// Member management
router.get('/:organizationId/members', getMembers);
router.post('/:organizationId/members', addMember);
router.put('/:organizationId/members/:memberId', updateMemberRole);
router.delete('/:organizationId/members/:memberId', removeMember);

// Phase 0: Invite management
router.post('/:organizationId/invites', createInvite);
router.post('/invites/:inviteCode/accept', acceptInvite);

// Phase 0: Join request management
router.post('/:organizationId/join-requests', createJoinRequest);
router.get('/:organizationId/join-requests', getJoinRequests);
router.put('/join-requests/:requestId', reviewJoinRequest);

// Phase 1: Task group management
router.post('/:organizationId/groups', createTaskGroup);
router.get('/:organizationId/groups', getTaskGroups);
router.get('/:organizationId/groups/:groupId', getTaskGroupDetails);
router.put('/:organizationId/groups/:groupId', updateTaskGroup);
router.delete('/:organizationId/groups/:groupId', deleteTaskGroup);
router.post('/:organizationId/groups/:groupId/members', addGroupMembers);
router.delete('/:organizationId/groups/:groupId/members/:userId', removeGroupMember);

// Organization settings
router.get('/:organizationId/settings', getOrganizationSettings);
router.put('/:organizationId/settings', updateOrganizationSettings);

export default router;
