# Phase 0: Onboarding Improvements - Implementation Guide

**Duration:** 2-3 days
**Priority:** HIGH - Start Immediately
**Status:** Ready to Begin

---

## Overview

Implement a comprehensive onboarding flow that allows new users to:
1. **Join existing organization** (via invite code - auto-join)
2. **Request to join organization** (browse organizations, requires admin approval)
3. **Create new organization** (become admin)

**Approved Decision:** Support BOTH auto-join (invite code) AND admin approval workflows

---

## Database Changes

### 1. Organization Invites Table

```sql
CREATE TABLE organization_invites (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    created_by_id INTEGER REFERENCES users(id),
    email VARCHAR(255), -- Optional: restrict invite to specific email
    role VARCHAR(20) DEFAULT 'member',
    expires_at TIMESTAMP,
    used_by_id INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    max_uses INTEGER DEFAULT 1, -- Allow multiple uses if needed
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_organization_invites_code ON organization_invites(invite_code);
CREATE INDEX idx_organization_invites_org ON organization_invites(organization_id);
CREATE INDEX idx_organization_invites_email ON organization_invites(email);
CREATE INDEX idx_organization_invites_active ON organization_invites(is_active);
```

### 2. Organization Join Requests Table

```sql
CREATE TABLE organization_join_requests (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    message TEXT, -- User's message to admins
    response_message TEXT, -- Admin's response
    reviewed_by_id INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_join_requests_org ON organization_join_requests(organization_id);
CREATE INDEX idx_join_requests_user ON organization_join_requests(user_id);
CREATE INDEX idx_join_requests_status ON organization_join_requests(status);
```

### 3. Update Organizations Table

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS allow_join_requests BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;

-- Add indexes
CREATE INDEX idx_organizations_public ON organizations(is_public);
```

### 4. Migration Script

```sql
-- File: backend/src/migrations/004_onboarding_improvements.sql

BEGIN;

-- Create organization_invites table
CREATE TABLE IF NOT EXISTS organization_invites (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    created_by_id INTEGER REFERENCES users(id),
    email VARCHAR(255),
    role VARCHAR(20) DEFAULT 'member',
    expires_at TIMESTAMP,
    used_by_id INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_organization_invites_code ON organization_invites(invite_code);
CREATE INDEX idx_organization_invites_org ON organization_invites(organization_id);
CREATE INDEX idx_organization_invites_email ON organization_invites(email);
CREATE INDEX idx_organization_invites_active ON organization_invites(is_active);

-- Create organization_join_requests table
CREATE TABLE IF NOT EXISTS organization_join_requests (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    message TEXT,
    response_message TEXT,
    reviewed_by_id INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_join_requests_org ON organization_join_requests(organization_id);
CREATE INDEX idx_join_requests_user ON organization_join_requests(user_id);
CREATE INDEX idx_join_requests_status ON organization_join_requests(status);

-- Update organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS allow_join_requests BOOLEAN DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX idx_organizations_public ON organizations(is_public);

-- Audit log
INSERT INTO audit_logs (table_name, action, description, performed_by_id)
VALUES ('organizations', 'schema_update', 'Added onboarding improvements: invites and join requests', NULL);

COMMIT;
```

---

## Backend API Implementation

### 1. Organization Invite Endpoints

**File:** `backend/src/controllers/organizationController.ts`

#### Generate Invite Code/Link

```typescript
// POST /api/organizations/:organizationId/invites
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
    const inviteCode = generateInviteCode(); // 16-char alphanumeric

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

    // Log audit
    await logAudit({
      user_id: userId,
      action: 'create_invite',
      entity_type: 'organization',
      entity_id: parseInt(organizationId),
      metadata: { invite_code: inviteCode, email }
    });

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

// Helper function
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar chars
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
    if ((i + 1) % 4 === 0 && i < 15) code += '-'; // Add dashes for readability
  }
  return code; // Format: XXXX-XXXX-XXXX-XXXX
}
```

#### Get Invite Details

```typescript
// GET /api/invites/:inviteCode
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
```

#### Accept Invite

```typescript
// POST /api/invites/:inviteCode/accept
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

    // Log audit
    await logAudit({
      user_id: userId,
      action: 'accept_invite',
      entity_type: 'organization',
      entity_id: invite.organization_id,
      metadata: { invite_code: inviteCode }
    });

    res.json({
      message: 'Successfully joined organization',
      organization: orgResult.rows[0]
    });

  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

### 2. Join Request Endpoints

#### Request to Join Organization

```typescript
// POST /api/organizations/:organizationId/join-requests
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

    // Log audit
    await logAudit({
      user_id: userId,
      action: 'create_join_request',
      entity_type: 'organization',
      entity_id: parseInt(organizationId)
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
```

#### Review Join Request (Admin)

```typescript
// PUT /api/organizations/join-requests/:requestId
export const reviewJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action, responseMessage } = req.body; // action: 'approved' | 'rejected'
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

    // Log audit
    await logAudit({
      user_id: adminId,
      action: `${action}_join_request`,
      entity_type: 'organization',
      entity_id: joinRequest.organization_id,
      metadata: { request_id: requestId, user_id: joinRequest.user_id }
    });

    res.json({
      message: `Join request ${action} successfully`
    });

  } catch (error) {
    console.error('Review join request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
```

#### List Join Requests (Admin)

```typescript
// GET /api/organizations/:organizationId/join-requests
export const getJoinRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user!.id;
    const { status } = req.query; // pending, approved, rejected, or all

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
```

### 3. Browse Public Organizations

```typescript
// GET /api/organizations/public
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
```

### 4. Update Routes

**File:** `backend/src/routes/organizationRoutes.ts`

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  // ... existing imports
  createInvite,
  getInviteDetails,
  acceptInvite,
  createJoinRequest,
  reviewJoinRequest,
  getJoinRequests,
  getPublicOrganizations
} from '../controllers/organizationController';

const router = Router();

// ... existing routes

// Invite routes
router.post('/:organizationId/invites', authenticate, createInvite);
router.get('/invites/:inviteCode', getInviteDetails); // Public
router.post('/invites/:inviteCode/accept', authenticate, acceptInvite);

// Join request routes
router.post('/:organizationId/join-requests', authenticate, createJoinRequest);
router.get('/:organizationId/join-requests', authenticate, getJoinRequests);
router.put('/join-requests/:requestId', authenticate, reviewJoinRequest);

// Public organizations
router.get('/public', getPublicOrganizations);

export default router;
```

---

## Frontend Implementation

### Web Implementation

#### 1. OnboardingModal Component

**File:** `web/src/components/OnboardingModal.tsx`

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { organizationAPI } from '../services/api';
import './OnboardingModal.css';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'choice' | 'invite' | 'browse' | 'create'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Accept invite
      await organizationAPI.acceptInvite(inviteCode);
      alert('Successfully joined organization!');
      onClose();
      navigate('/organizations');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await organizationAPI.create(orgName);
      localStorage.setItem('selectedOrganization', JSON.stringify(response.data.organization));
      alert('Organization created successfully!');
      onClose();
      navigate('/organizations');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content onboarding-modal">
        <h2>Welcome! Let's Get Started</h2>

        {step === 'choice' && (
          <div className="onboarding-choice">
            <p>Choose how you'd like to proceed:</p>

            <div className="choice-cards">
              <div className="choice-card" onClick={() => setStep('invite')}>
                <h3>📬 Join with Invite Code</h3>
                <p>Have an invite code? Join an existing organization instantly.</p>
              </div>

              <div className="choice-card" onClick={() => setStep('browse')}>
                <h3>🔍 Browse Organizations</h3>
                <p>Find and request to join public organizations.</p>
              </div>

              <div className="choice-card" onClick={() => setStep('create')}>
                <h3>➕ Create New Organization</h3>
                <p>Start your own organization and invite others.</p>
              </div>
            </div>

            <button onClick={onClose} className="btn-skip">Skip for Now</button>
          </div>
        )}

        {step === 'invite' && (
          <div className="onboarding-invite">
            <button onClick={() => setStep('choice')} className="btn-back">← Back</button>
            <h3>Join with Invite Code</h3>
            <p>Enter the invite code you received:</p>

            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="invite-code-input"
              maxLength={19}
            />

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button onClick={handleJoinWithCode} disabled={loading} className="btn-primary">
                {loading ? 'Joining...' : 'Join Organization'}
              </button>
            </div>
          </div>
        )}

        {step === 'browse' && (
          <div className="onboarding-browse">
            <button onClick={() => setStep('choice')} className="btn-back">← Back</button>
            <h3>Browse Organizations</h3>
            <BrowseOrganizations onJoin={() => { onClose(); navigate('/organizations'); }} />
          </div>
        )}

        {step === 'create' && (
          <div className="onboarding-create">
            <button onClick={() => setStep('choice')} className="btn-back">← Back</button>
            <h3>Create New Organization</h3>
            <p>Choose a name for your organization:</p>

            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="My Organization"
              className="org-name-input"
              maxLength={100}
            />

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button onClick={handleCreateOrganization} disabled={loading} className="btn-primary">
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 2. Update RegisterPage

```typescript
// Add to RegisterPage.tsx
import { OnboardingModal } from '../components/OnboardingModal';

// After successful registration:
const [showOnboarding, setShowOnboarding] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  // ... registration logic

  // After successful registration:
  setShowOnboarding(true);
};

return (
  <>
    {/* ... existing registration form ... */}
    <OnboardingModal
      isOpen={showOnboarding}
      onClose={() => { setShowOnboarding(false); navigate('/organizations'); }}
    />
  </>
);
```

#### 3. Update API Services

**File:** `web/src/services/api.ts`

```typescript
// Add to organizationAPI:
export const organizationAPI = {
  // ... existing methods

  // Invite management
  createInvite: (organizationId: number, data: {
    email?: string;
    role?: string;
    expiresInDays?: number;
    maxUses?: number;
  }) => api.post(`/organizations/${organizationId}/invites`, data),

  getInviteDetails: (inviteCode: string) =>
    api.get(`/organizations/invites/${inviteCode}`),

  acceptInvite: (inviteCode: string) =>
    api.post(`/organizations/invites/${inviteCode}/accept`),

  // Join requests
  createJoinRequest: (organizationId: number, message: string) =>
    api.post(`/organizations/${organizationId}/join-requests`, { message }),

  getJoinRequests: (organizationId: number, status?: string) =>
    api.get(`/organizations/${organizationId}/join-requests`, { params: { status } }),

  reviewJoinRequest: (requestId: number, action: 'approved' | 'rejected', responseMessage?: string) =>
    api.put(`/organizations/join-requests/${requestId}`, { action, responseMessage }),

  // Public organizations
  getPublicOrganizations: (search?: string) =>
    api.get('/organizations/public', { params: { search } }),
};
```

---

### Mobile Implementation

#### 1. OnboardingScreen

**File:** `mobile/src/screens/OnboardingScreen.tsx`

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert
} from 'react-native';
import { organizationAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const OnboardingScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [step, setStep] = useState<'choice' | 'invite' | 'browse' | 'create'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      await organizationAPI.acceptInvite(inviteCode);
      Alert.alert('Success', 'Successfully joined organization!');
      navigation.replace('Organizations');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    setLoading(true);
    try {
      const response = await organizationAPI.create(orgName);
      Alert.alert('Success', 'Organization created successfully!');
      navigation.replace('Organizations');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Welcome! Let's Get Started
        </Text>

        {step === 'choice' && (
          <View style={styles.choiceContainer}>
            <TouchableOpacity
              style={[styles.choiceCard, { backgroundColor: colors.cardBg }]}
              onPress={() => setStep('invite')}
            >
              <Text style={styles.choiceIcon}>📬</Text>
              <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                Join with Invite Code
              </Text>
              <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
                Have an invite code? Join instantly.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choiceCard, { backgroundColor: colors.cardBg }]}
              onPress={() => setStep('browse')}
            >
              <Text style={styles.choiceIcon}>🔍</Text>
              <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                Browse Organizations
              </Text>
              <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
                Find and request to join.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.choiceCard, { backgroundColor: colors.cardBg }]}
              onPress={() => setStep('create')}
            >
              <Text style={styles.choiceIcon}>➕</Text>
              <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                Create New Organization
              </Text>
              <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
                Start your own and invite others.
              </Text>
            </TouchableOpacity>

            <Button
              title="Skip for Now"
              onPress={() => navigation.replace('Organizations')}
              variant="secondary"
            />
          </View>
        )}

        {step === 'invite' && (
          <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep('choice')}>
              <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>

            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Join with Invite Code
            </Text>

            <Input
              label="Invite Code"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              autoCapitalize="characters"
            />

            <Button
              title="Join Organization"
              onPress={handleJoinWithCode}
              loading={loading}
            />
          </View>
        )}

        {step === 'create' && (
          <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep('choice')}>
              <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>

            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
              Create New Organization
            </Text>

            <Input
              label="Organization Name"
              value={orgName}
              onChangeText={setOrgName}
              placeholder="My Organization"
              maxLength={100}
            />

            <Button
              title="Create Organization"
              onPress={handleCreateOrganization}
              loading={loading}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  choiceContainer: {
    gap: 16,
  },
  choiceCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  choiceIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  choiceDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  stepContainer: {
    gap: 16,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
});

export default OnboardingScreen;
```

#### 2. Update Navigation

**File:** `mobile/src/navigation/AppNavigator.tsx`

```typescript
// Add OnboardingScreen to stack
import OnboardingScreen from '../screens/OnboardingScreen';

// In the stack navigator:
<Stack.Screen
  name="Onboarding"
  component={OnboardingScreen}
  options={{ headerShown: false }}
/>
```

#### 3. Update RegisterScreen

```typescript
// After successful registration, navigate to onboarding:
navigation.replace('Onboarding');
```

---

## Testing Checklist

### Backend Testing
- [ ] Database migration runs successfully
- [ ] All new tables created with proper indexes
- [ ] Invite code generation creates unique codes
- [ ] Invite code validation works (expiry, max uses, email)
- [ ] Auto-join with valid invite code
- [ ] Join request creation and approval workflow
- [ ] Admin permissions enforced
- [ ] Public organization browsing
- [ ] Notifications sent correctly
- [ ] Audit logs created for all actions

### Web Testing
- [ ] OnboardingModal appears after registration
- [ ] Invite code input accepts proper format
- [ ] Join with invite code works
- [ ] Browse organizations displays list
- [ ] Create organization works
- [ ] Skip option navigates correctly
- [ ] Error handling displays properly
- [ ] UI responsive on different screen sizes

### Mobile Testing
- [ ] OnboardingScreen appears after registration
- [ ] All three options (invite, browse, create) work
- [ ] Native keyboard behavior correct
- [ ] Loading states display properly
- [ ] Error alerts show correctly
- [ ] Navigation works smoothly
- [ ] Test on iOS and Android

---

## Deployment Steps

1. **Run database migration**
```bash
cd backend
npm run migrate # or your migration command
```

2. **Deploy backend**
```bash
npm run build
npm run deploy # or your deployment process
```

3. **Deploy web**
```bash
cd web
npm run build
# Deploy to hosting
```

4. **Update mobile app**
```bash
cd mobile
# Update version in package.json and app.json
npm run build:ios
npm run build:android
# Submit to stores
```

---

## Success Criteria

- [ ] Users can join organizations with invite codes
- [ ] Users can request to join organizations
- [ ] Admins can approve/reject join requests
- [ ] Users can create new organizations
- [ ] Onboarding flow completes successfully on all platforms
- [ ] No errors in production logs
- [ ] 90%+ of new users complete onboarding

---

**Status:** Ready to implement
**Estimated Time:** 2-3 days
**Dependencies:** None (can start immediately)
