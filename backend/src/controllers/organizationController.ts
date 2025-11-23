import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';

export const createOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, allowJoinRequests, isPublic } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // Create organization
    const orgResult = await query(
      `INSERT INTO organizations (name, description, allow_join_requests, is_public)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description || null, allowJoinRequests !== false, isPublic === true]
    );

    const organization = orgResult.rows[0];

    // Add creator as admin
    await query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [organization.id, userId, 'admin']
    );

    res.status(201).json({
      message: 'Organization created successfully',
      organization,
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserOrganizations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT o.*, om.role, om.joined_at
       FROM organizations o
       INNER JOIN organization_members om ON o.id = om.organization_id
       WHERE om.user_id = $1
       ORDER BY om.joined_at DESC`,
      [userId]
    );

    res.json({ organizations: result.rows });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getOrganizationDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.id;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Get organization details
    const orgResult = await query(
      'SELECT * FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get members
    const membersResult = await query(
      `SELECT u.id as user_id, u.email, u.name as user_name, om.role, om.joined_at
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.joined_at ASC`,
      [organizationId]
    );

    res.json({
      organization: orgResult.rows[0],
      members: membersResult.rows,
      userRole: memberCheck.rows[0].role,
    });
  } catch (error) {
    console.error('Get organization details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.id;

    // Check if user is a member
    const memberCheck = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Get members
    const membersResult = await query(
      `SELECT u.id as user_id, u.email, u.name as user_name, om.role, om.joined_at
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.joined_at ASC`,
      [organizationId]
    );

    res.json({ members: membersResult.rows });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addMember = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { email, role = 'member' } = req.body;
    const userId = req.user!.id;

    // Check if requester is admin
    const adminCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    // Find user by email
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newMemberId = userResult.rows[0].id;

    // Check if already a member
    const existingMember = await query(
      'SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, newMemberId]
    );

    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this organization' });
    }

    // Add member
    await query(
      'INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)',
      [organizationId, newMemberId, role]
    );

    res.status(201).json({ message: 'Member added successfully' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user!.id;

    // Check if requester is admin
    const adminCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update member roles' });
    }

    // Update role
    await query(
      'UPDATE organization_members SET role = $1 WHERE organization_id = $2 AND user_id = $3',
      [role, organizationId, memberId]
    );

    res.json({ message: 'Member role updated successfully' });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, memberId } = req.params;
    const userId = req.user!.id;

    // Check if requester is admin
    const adminCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    // Remove member
    await query(
      'DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, memberId]
    );

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== PHASE 0: ONBOARDING - HELPER FUNCTIONS =====

/**
 * Generate a unique invite code in format: XXXX-XXXX-XXXX-XXXX
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i < 15) code += '-';
  }
  return code;
}

/**
 * Create a notification for a user
 */
async function createNotification(data: {
  user_id: number;
  type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: number;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, task_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [data.user_id, data.type, data.title, data.message, data.entity_id || null]
    );
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Notify all admins of an organization
 */
async function notifyOrganizationAdmins(
  organizationId: number,
  notification: { type: string; userId: number; message: string }
): Promise<void> {
  try {
    const adminsResult = await query(
      `SELECT user_id FROM organization_members
       WHERE organization_id = $1 AND role = 'admin'`,
      [organizationId]
    );

    for (const admin of adminsResult.rows) {
      await createNotification({
        user_id: admin.user_id,
        type: notification.type,
        title: 'New Join Request',
        message: notification.message,
        entity_type: 'organization',
        entity_id: organizationId,
      });
    }
  } catch (error) {
    console.error('Failed to notify organization admins:', error);
  }
}

// ===== PHASE 0: ORGANIZATION INVITE ENDPOINTS =====

/**
 * POST /api/organizations/:organizationId/invites
 * Generate invite code/link
 */
export const createInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { email, role, expiresInDays, maxUses } = req.body;
    const userId = req.user!.id;

    // Verify user is admin of organization
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only organization admins can create invites' });
    }

    // Generate unique invite code
    const inviteCode = generateInviteCode();

    // Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Create invite
    const result = await query(
      `INSERT INTO organization_invites
       (organization_id, invite_code, created_by_id, email, role, expires_at, max_uses)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [organizationId, inviteCode, userId, email || null, role || 'member', expiresAt, maxUses || 1]
    );

    const invite = result.rows[0];
    const inviteLink = `${process.env.APP_URL}/join/${inviteCode}`;

    res.json({
      invite,
      inviteLink,
      message: 'Invite created successfully'
    });

  } catch (error) {
    console.error('Create invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/invites/:inviteCode
 * Get invite details (public endpoint)
 */
export const getInviteDetails = async (req: Request, res: Response) => {
  try {
    const { inviteCode } = req.params;

    const result = await query(
      `SELECT oi.*, o.name as organization_name, o.description as organization_description,
              u.name as created_by_name
       FROM organization_invites oi
       INNER JOIN organizations o ON oi.organization_id = o.id
       LEFT JOIN users u ON oi.created_by_id = u.id
       WHERE oi.invite_code = $1 AND oi.is_active = true`,
      [inviteCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found or expired' });
    }

    const invite = result.rows[0];

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // Check if max uses reached
    if (invite.use_count >= invite.max_uses) {
      return res.status(400).json({ error: 'Invite has reached maximum uses' });
    }

    // Return public info (don't expose sensitive data)
    res.json({
      organizationName: invite.organization_name,
      organizationDescription: invite.organization_description,
      role: invite.role,
      createdBy: invite.created_by_name,
      expiresAt: invite.expires_at,
      isValid: true
    });

  } catch (error) {
    console.error('Get invite details error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/invites/:inviteCode/accept
 * Accept invite and join organization
 */
export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user!.id;

    // Get invite details
    const inviteResult = await query(
      `SELECT * FROM organization_invites
       WHERE invite_code = $1 AND is_active = true`,
      [inviteCode]
    );

    if (inviteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    const invite = inviteResult.rows[0];

    // Validate invite
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invite has expired' });
    }

    if (invite.use_count >= invite.max_uses) {
      return res.status(400).json({ error: 'Invite has reached maximum uses' });
    }

    // Check if email-restricted
    if (invite.email) {
      const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows[0].email !== invite.email) {
        return res.status(403).json({ error: 'This invite is for a different email address' });
      }
    }

    // Check if already a member
    const memberCheck = await query(
      'SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [invite.organization_id, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member of this organization' });
    }

    // Add user to organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [invite.organization_id, userId, invite.role]
    );

    // Update invite usage
    await query(
      `UPDATE organization_invites
       SET use_count = use_count + 1,
           used_by_id = $1,
           used_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, invite.id]
    );

    // Get organization details
    const orgResult = await query(
      'SELECT * FROM organizations WHERE id = $1',
      [invite.organization_id]
    );

    res.json({
      message: 'Successfully joined organization',
      organization: orgResult.rows[0]
    });

  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== PHASE 0: JOIN REQUEST ENDPOINTS =====

/**
 * POST /api/organizations/:organizationId/join-requests
 * Request to join organization
 */
export const createJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;

    // Check if organization allows join requests
    const orgResult = await query(
      'SELECT allow_join_requests FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!orgResult.rows[0].allow_join_requests) {
      return res.status(403).json({ error: 'This organization does not accept join requests' });
    }

    // Check if already a member
    const memberCheck = await query(
      'SELECT * FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member of this organization' });
    }

    // Check if request already exists
    const existingRequest = await query(
      'SELECT * FROM organization_join_requests WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (existingRequest.rows.length > 0) {
      const status = existingRequest.rows[0].status;
      if (status === 'pending') {
        return res.status(400).json({ error: 'You already have a pending request' });
      } else if (status === 'rejected') {
        // Allow resubmission after rejection
        await query(
          `UPDATE organization_join_requests
           SET status = 'pending', message = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [message, existingRequest.rows[0].id]
        );
        return res.json({ message: 'Join request resubmitted successfully' });
      }
    }

    // Create join request
    const result = await query(
      `INSERT INTO organization_join_requests (organization_id, user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [organizationId, userId, message || '']
    );

    // Notify organization admins
    await notifyOrganizationAdmins(parseInt(organizationId), {
      type: 'join_request',
      userId,
      message: 'New join request from user'
    });

    res.json({
      message: 'Join request submitted successfully',
      request: result.rows[0]
    });

  } catch (error) {
    console.error('Create join request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/organizations/:organizationId/join-requests
 * List join requests (Admin only)
 */
export const getJoinRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.id;
    const { status } = req.query;

    // Verify admin permission
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only organization admins can view join requests' });
    }

    // Build query
    let queryText = `
      SELECT jr.*, u.name as user_name, u.email as user_email, u.username,
             reviewer.name as reviewed_by_name
      FROM organization_join_requests jr
      INNER JOIN users u ON jr.user_id = u.id
      LEFT JOIN users reviewer ON jr.reviewed_by_id = reviewer.id
      WHERE jr.organization_id = $1
    `;
    const params = [organizationId];

    if (status && status !== 'all') {
      queryText += ' AND jr.status = $2';
      params.push(status as string);
    }

    queryText += ' ORDER BY jr.created_at DESC';

    const result = await query(queryText, params);

    res.json({ requests: result.rows });

  } catch (error) {
    console.error('Get join requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/organizations/join-requests/:requestId
 * Review join request (Admin only)
 */
export const reviewJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action, responseMessage } = req.body;
    const adminId = req.user!.id;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be approved or rejected' });
    }

    // Get join request
    const requestResult = await query(
      'SELECT * FROM organization_join_requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    const joinRequest = requestResult.rows[0];

    // Verify admin permission
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [joinRequest.organization_id, adminId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only organization admins can review join requests' });
    }

    // Update request status
    await query(
      `UPDATE organization_join_requests
       SET status = $1, response_message = $2, reviewed_by_id = $3,
           reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [action, responseMessage || '', adminId, requestId]
    );

    // If approved, add user to organization
    if (action === 'approved') {
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES ($1, $2, 'member')`,
        [joinRequest.organization_id, joinRequest.user_id]
      );

      // Notify user of approval
      await createNotification({
        user_id: joinRequest.user_id,
        type: 'join_request_approved',
        title: 'Join Request Approved',
        message: `Your request to join the organization has been approved`,
        entity_type: 'organization',
        entity_id: joinRequest.organization_id
      });
    } else {
      // Notify user of rejection
      await createNotification({
        user_id: joinRequest.user_id,
        type: 'join_request_rejected',
        title: 'Join Request Rejected',
        message: responseMessage || 'Your request to join the organization was not approved',
        entity_type: 'organization',
        entity_id: joinRequest.organization_id
      });
    }

    res.json({
      message: `Join request ${action} successfully`
    });

  } catch (error) {
    console.error('Review join request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== PHASE 0: BROWSE PUBLIC ORGANIZATIONS =====

/**
 * GET /api/organizations/public
 * Browse public organizations
 */
export const getPublicOrganizations = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    let queryText = `
      SELECT id, name, description, created_at,
             (SELECT COUNT(*) FROM organization_members WHERE organization_id = organizations.id) as member_count
      FROM organizations
      WHERE is_public = true
    `;
    const params: any[] = [];

    if (search) {
      queryText += ' AND (name ILIKE $1 OR description ILIKE $1)';
      params.push(`%${search}%`);
    }

    queryText += ' ORDER BY member_count DESC, name ASC LIMIT 50';

    const result = await query(queryText, params);

    res.json({ organizations: result.rows });

  } catch (error) {
    console.error('Get public organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ===== ORGANIZATION SETTINGS =====

/**
 * GET /api/organizations/:organizationId/settings
 * Get organization settings
 */
export const getOrganizationSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.id;

    // Verify user is a member
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Get or create settings
    let settingsResult = await query(
      'SELECT * FROM organization_settings WHERE organization_id = $1',
      [organizationId]
    );

    // Create default settings if they don't exist
    if (settingsResult.rows.length === 0) {
      settingsResult = await query(
        `INSERT INTO organization_settings (organization_id)
         VALUES ($1)
         RETURNING *`,
        [organizationId]
      );
    }

    res.json({ settings: settingsResult.rows[0] });
  } catch (error) {
    console.error('Get organization settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /api/organizations/:organizationId/settings
 * Update organization settings (Admin only)
 */
export const updateOrganizationSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const {
      defaultTaskSort,
      hideCompletedTasks,
      autoArchiveEnabled,
      autoArchiveAfterDays,
      archiveSchedule
    } = req.body;
    const userId = req.user!.id;

    // Verify user is admin
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only organization admins can update settings' });
    }

    // Validate inputs
    if (defaultTaskSort && !['due_date', 'priority'].includes(defaultTaskSort)) {
      return res.status(400).json({ error: 'Invalid sort option. Must be "due_date" or "priority"' });
    }

    if (archiveSchedule && !['daily', 'weekly_sunday', 'weekly_monday'].includes(archiveSchedule)) {
      return res.status(400).json({ error: 'Invalid archive schedule. Must be "daily", "weekly_sunday", or "weekly_monday"' });
    }

    if (autoArchiveAfterDays !== undefined && autoArchiveAfterDays !== null) {
      if (!Number.isInteger(autoArchiveAfterDays) || autoArchiveAfterDays < 1 || autoArchiveAfterDays > 365) {
        return res.status(400).json({ error: 'Auto archive days must be between 1 and 365' });
      }
    }

    // Upsert settings
    const result = await query(
      `INSERT INTO organization_settings (
        organization_id,
        default_task_sort,
        hide_completed_tasks,
        auto_archive_enabled,
        auto_archive_after_days,
        archive_schedule,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (organization_id) DO UPDATE SET
        default_task_sort = COALESCE($2, organization_settings.default_task_sort),
        hide_completed_tasks = COALESCE($3, organization_settings.hide_completed_tasks),
        auto_archive_enabled = COALESCE($4, organization_settings.auto_archive_enabled),
        auto_archive_after_days = COALESCE($5, organization_settings.auto_archive_after_days),
        archive_schedule = COALESCE($6, organization_settings.archive_schedule),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        organizationId,
        defaultTaskSort || 'due_date',
        hideCompletedTasks ?? false,
        autoArchiveEnabled ?? false,
        autoArchiveAfterDays ?? 7,
        archiveSchedule || 'daily'
      ]
    );

    res.json({
      message: 'Settings updated successfully',
      settings: result.rows[0]
    });
  } catch (error) {
    console.error('Update organization settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
