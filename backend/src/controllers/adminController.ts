import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendAdminPasswordResetEmail, sendWelcomeEmail } from '../services/emailService';

/**
 * Create a new user (admin-initiated)
 * POST /api/admin/users
 */
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, username, password, role = 'member', organizationId, organizationRole = 'member' } = req.body;
    const adminId = req.user!.id;
    const adminRole = req.user!.role;

    // Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate role
    if (!['member', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Only super_admin can create super_admin users
    if (role === 'super_admin' && adminRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can create super admin users' });
    }

    // Check if email already exists
    const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Check if username already exists (if provided)
    if (username) {
      const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username.toLowerCase()]);
      if (existingUsername.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user - marked as verified since admin created
    const userResult = await query(
      `INSERT INTO users (email, username, name, password_hash, role, email_verified, email_verified_at, account_status)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), 'active')
       RETURNING id, email, username, name, role, email_verified, account_status, created_at`,
      [email.toLowerCase(), username?.toLowerCase() || null, name, passwordHash, role]
    );

    const newUser = userResult.rows[0];

    // If organizationId provided, add user to organization
    if (organizationId) {
      // Validate organization role
      if (!['member', 'admin'].includes(organizationRole)) {
        return res.status(400).json({ error: 'Invalid organization role. Must be member or admin' });
      }

      // Verify organization exists
      const orgResult = await query('SELECT id, name FROM organizations WHERE id = $1', [organizationId]);
      if (orgResult.rows.length === 0) {
        return res.status(400).json({ error: 'Organization not found' });
      }

      // Add user to organization
      await query(
        'INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1, $2, $3)',
        [newUser.id, organizationId, organizationRole]
      );

      newUser.organization = {
        id: organizationId,
        name: orgResult.rows[0].name,
        role: organizationRole,
      };
    }

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'create_user',
        newUser.id,
        JSON.stringify({
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          organization_id: organizationId || null,
          organization_role: organizationId ? organizationRole : null,
        }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    // Send welcome email (optional, don't fail if it doesn't work)
    try {
      await sendWelcomeEmail(newUser.email, newUser.name, password);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail the request, user was created successfully
    }

    res.status(201).json({
      message: 'User created successfully',
      user: newUser,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all users with optional filtering
 * GET /api/admin/users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryStr = `
      SELECT
        id, email, username, name, role, account_status,
        email_verified, email_verified_at, last_password_change,
        force_password_change, created_at
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Search filter
    if (search) {
      queryStr += ` AND (email ILIKE $${paramIndex} OR name ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Role filter
    if (role && ['member', 'admin', 'super_admin'].includes(role as string)) {
      queryStr += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    // Status filter
    if (status && ['active', 'suspended', 'deleted'].includes(status as string)) {
      queryStr += ` AND account_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(
      queryStr.replace('SELECT id, email, username, name, role, account_status, email_verified, email_verified_at, last_password_change, force_password_change, created_at', 'SELECT COUNT(*) as total'),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    queryStr += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.json({
      users: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user details by ID
 * GET /api/admin/users/:id
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
        id, email, username, name, role, account_status,
        email_verified, email_verified_at, last_password_change,
        force_password_change, created_at
      FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's organizations
    const orgsResult = await query(
      `SELECT o.id, o.name, om.role, om.joined_at
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1`,
      [id]
    );

    // Get recent admin actions on this user
    const actionsResult = await query(
      `SELECT
        al.id, al.action, al.details, al.created_at,
        u.name as admin_name, u.email as admin_email
       FROM admin_audit_logs al
       JOIN users u ON al.admin_id = u.id
       WHERE al.target_user_id = $1
       ORDER BY al.created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      user: result.rows[0],
      organizations: orgsResult.rows,
      recentActions: actionsResult.rows,
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user role
 * PUT /api/admin/users/:id/role
 */
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.user!.id;
    const adminRole = req.user!.role;

    // Validate role
    if (!['member', 'admin', 'super_admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Get target user
    const userResult = await query('SELECT id, role, name, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins can only manage members, super_admins can manage everyone
    if (adminRole === 'admin') {
      if (targetUser.role === 'super_admin') {
        return res.status(403).json({ error: 'Cannot modify super admin' });
      }
      if (role === 'super_admin') {
        return res.status(403).json({ error: 'Cannot promote to super admin' });
      }
    }

    // Prevent self-demotion
    if (adminId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    // Update role
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'update_user_role',
        id,
        JSON.stringify({ old_role: targetUser.role, new_role: role }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: 'User role updated successfully',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role,
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user account status (suspend/activate)
 * PUT /api/admin/users/:id/status
 */
export const updateUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user!.id;
    const adminRole = req.user!.role;

    // Validate status
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get target user
    const userResult = await query('SELECT id, role, name, email, account_status FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins cannot suspend super_admins
    if (adminRole === 'admin' && targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify super admin' });
    }

    // Prevent self-suspension
    if (adminId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot change your own status' });
    }

    // Update status
    await query('UPDATE users SET account_status = $1 WHERE id = $2', [status, id]);

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        `${status}_user`,
        id,
        JSON.stringify({ old_status: targetUser.account_status, new_status: status }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: `User ${status === 'suspended' ? 'suspended' : 'activated'} successfully`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        status,
      },
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete user (soft delete)
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const adminRole = req.user!.role;

    // Get target user
    const userResult = await query('SELECT id, role, name, email, account_status FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Permission check: admins cannot delete super_admins
    if (adminRole === 'admin' && targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    // Prevent self-deletion
    if (adminId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Soft delete (mark as deleted)
    await query('UPDATE users SET account_status = $1 WHERE id = $2', ['deleted', id]);

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'delete_user',
        id,
        JSON.stringify({ name: targetUser.name, email: targetUser.email }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Force password reset for user (admin-initiated)
 * POST /api/admin/users/:id/force-password-reset
 */
export const forcePasswordReset = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    // Get admin info
    const adminResult = await query('SELECT name FROM users WHERE id = $1', [adminId]);
    const adminName = adminResult.rows[0]?.name || 'Administrator';

    // Get target user
    const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Prevent forcing password reset on yourself
    if (adminId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot force password reset on your own account' });
    }

    // Set force_password_change flag
    await query('UPDATE users SET force_password_change = true WHERE id = $1', [id]);

    // Generate password reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration for admin resets

    // Store token
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_by_admin_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, token, expiresAt, adminId, req.ip || req.socket.remoteAddress || 'unknown']
    );

    // Send reset email
    try {
      await sendAdminPasswordResetEmail(targetUser.email, targetUser.name, token, adminName);
    } catch (emailError) {
      console.error('Failed to send admin password reset email:', emailError);
      return res.status(500).json({ error: 'Failed to send password reset email' });
    }

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'force_password_reset',
        id,
        JSON.stringify({ user_email: targetUser.email }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: 'Password reset email sent to user',
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (error) {
    console.error('Force password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get admin audit logs
 * GET /api/admin/audit-logs
 */
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, adminId, targetUserId, action } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let queryStr = `
      SELECT
        al.id, al.action, al.details, al.ip_address, al.created_at,
        admin.id as admin_id, admin.name as admin_name, admin.email as admin_email,
        target.id as target_user_id, target.name as target_user_name, target.email as target_user_email
      FROM admin_audit_logs al
      JOIN users admin ON al.admin_id = admin.id
      LEFT JOIN users target ON al.target_user_id = target.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Admin filter
    if (adminId) {
      queryStr += ` AND al.admin_id = $${paramIndex}`;
      params.push(adminId);
      paramIndex++;
    }

    // Target user filter
    if (targetUserId) {
      queryStr += ` AND al.target_user_id = $${paramIndex}`;
      params.push(targetUserId);
      paramIndex++;
    }

    // Action filter
    if (action) {
      queryStr += ` AND al.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(
      queryStr.replace(/SELECT.*FROM/s, 'SELECT COUNT(*) as total FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    queryStr += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    res.json({
      logs: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user's organization memberships
 * GET /api/admin/users/:id/organizations
 */
export const getUserOrganizations = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's organizations
    const orgsResult = await query(
      `SELECT 
        o.id, 
        o.name, 
        o.description,
        om.role, 
        om.joined_at,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1
       ORDER BY om.joined_at DESC`,
      [id]
    );

    res.json({
      organizations: orgsResult.rows,
    });
  } catch (error) {
    console.error('Get user organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Add user to organization
 * POST /api/admin/users/:id/organizations
 */
export const addUserToOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { organizationId, role = 'member' } = req.body;
    const adminId = req.user!.id;

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be member or admin' });
    }

    // Verify user exists
    const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify organization exists
    const orgResult = await query('SELECT id, name FROM organizations WHERE id = $1', [organizationId]);
    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user is already in the organization
    const existingResult = await query(
      'SELECT id FROM organization_members WHERE user_id = $1 AND organization_id = $2',
      [id, organizationId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this organization' });
    }

    // Add user to organization
    await query(
      'INSERT INTO organization_members (user_id, organization_id, role) VALUES ($1, $2, $3)',
      [id, organizationId, role]
    );

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'add_user_to_organization',
        id,
        JSON.stringify({
          organization_id: organizationId,
          organization_name: orgResult.rows[0].name,
          role,
        }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: 'User added to organization successfully',
      organization: {
        id: organizationId,
        name: orgResult.rows[0].name,
        role,
      },
    });
  } catch (error) {
    console.error('Add user to organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Remove user from organization
 * DELETE /api/admin/users/:id/organizations/:orgId
 */
export const removeUserFromOrganization = async (req: AuthRequest, res: Response) => {
  try {
    const { id, orgId } = req.params;
    const adminId = req.user!.id;

    // Verify user exists
    const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get organization info before deleting
    const orgResult = await query(
      `SELECT o.id, o.name, om.role
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [id, orgId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a member of this organization' });
    }

    // Remove user from organization
    await query(
      'DELETE FROM organization_members WHERE user_id = $1 AND organization_id = $2',
      [id, orgId]
    );

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'remove_user_from_organization',
        id,
        JSON.stringify({
          organization_id: orgId,
          organization_name: orgResult.rows[0].name,
          role: orgResult.rows[0].role,
        }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: 'User removed from organization successfully',
    });
  } catch (error) {
    console.error('Remove user from organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user's role in organization
 * PUT /api/admin/users/:id/organizations/:orgId/role
 */
export const updateUserOrganizationRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id, orgId } = req.params;
    const { role } = req.body;
    const adminId = req.user!.id;

    // Validate role
    if (!['member', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be member or admin' });
    }

    // Verify membership exists
    const memberResult = await query(
      `SELECT om.role as old_role, o.name as org_name
       FROM organization_members om
       JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [id, orgId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'User is not a member of this organization' });
    }

    const oldRole = memberResult.rows[0].old_role;

    // Update role
    await query(
      'UPDATE organization_members SET role = $1 WHERE user_id = $2 AND organization_id = $3',
      [role, id, orgId]
    );

    // Log action
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        adminId,
        'update_user_organization_role',
        id,
        JSON.stringify({
          organization_id: orgId,
          organization_name: memberResult.rows[0].org_name,
          old_role: oldRole,
          new_role: role,
        }),
        req.ip || req.socket.remoteAddress || 'unknown',
      ]
    );

    res.json({
      message: 'User role in organization updated successfully',
      role,
    });
  } catch (error) {
    console.error('Update user organization role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all organizations (for admin to select from)
 * GET /api/admin/organizations
 */
export const getAllOrganizations = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        o.id, 
        o.name, 
        o.description,
        o.created_at,
        (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
       FROM organizations o
       ORDER BY o.name ASC`
    );

    res.json({
      organizations: result.rows,
    });
  } catch (error) {
    console.error('Get all organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
