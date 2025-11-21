# Next Steps: Enhanced Access Control

Comprehensive plan for implementing advanced task access control and multi-assignee functionality.

## Current State

**Existing Access Control:**
- Organization-level access (members can see all organization tasks)
- Role-based permissions (admin vs member)
- Task assignment to single user
- Organization membership verification

**Limitations:**
- All organization members can see all tasks
- Tasks can only be assigned to one person
- No group task functionality
- No task-level privacy controls

## Planned Features

### 0. User Onboarding Improvements (NEW REQUIREMENT)

**Rule:** Allow new users to select existing organization or create a new one during onboarding

**Decision:** ✅ Support BOTH auto-join (invite code) AND admin approval workflows

**Changes Required:**
- Onboarding flow that offers two options:
  1. Join existing organization (via invite code, email, or request)
  2. Create new organization (become admin)
- Organization invite code system:
  - Auto-join: Valid invite code grants immediate access
  - Request to join: Requires admin approval (for organizations without public invites)
- Organization invite link generation and management
- Join request approval workflow for admins
- Updated registration flow to include organization selection
- Organization settings: Toggle public/private joining

**Implementation:**
- New onboarding screen/modal after registration
- Organization invite code system with auto-join
- Email-based organization invites
- Join request approval workflow for private organizations
- Organization settings: Allow/disallow public join requests
- Mobile and web implementation required

**Workflow:**
1. User completes registration
2. Onboarding screen presents:
   - "Join with invite code" → Auto-joins if valid
   - "Request to join organization" → Browse and request access
   - "Create new organization" → Become admin
3. If request to join: Admin receives notification and approves/rejects
4. If invite code: Immediate access granted
5. If create: User becomes organization admin

### 1. Task-Level Access Control

**Rule:** Only task owner and task assignees can see a task

**Changes Required:**
- Tasks visible only to:
  - Task creator (created_by_id)
  - Assigned users (assigned_user_id or new assignees table)
  - Organization admins (override for management)
- Task list filtering by access permissions
- Task detail access validation

### 2. Multiple Assignees per Task

**Rule:** Task creator can assign a task to multiple people

**Changes Required:**
- New `task_assignees` table (many-to-many relationship)
- Task assignment UI supports multiple user selection
- All assignees receive notifications
- All assignees can complete task requirements
- Task shows as "in progress" until ALL assignees complete it

### 3. Group Task Creation

**Rule:** Task creator can create group tasks

**Changes Required:**
- New `task_groups` or use existing organization structure
- Ability to assign task to entire group/team
- Automatic assignment to all group members
- Group-level progress tracking
- Individual completion tracking within group

### 4. Organization Task Isolation

**Rule:** No one outside organization can see any tasks

**Current Status:** ✅ Already implemented
- Verified in existing code
- Organization membership checked on all task endpoints
- No changes needed (already secure)

## Database Schema Changes

### New Table: organization_invites (For Onboarding)

```sql
CREATE TABLE organization_invites (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    created_by_id INTEGER REFERENCES users(id),
    email VARCHAR(255), -- Optional: specific email invite
    role VARCHAR(20) DEFAULT 'member',
    expires_at TIMESTAMP,
    used_by_id INTEGER REFERENCES users(id),
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0
);

CREATE INDEX idx_organization_invites_code ON organization_invites(invite_code);
CREATE INDEX idx_organization_invites_org ON organization_invites(organization_id);
CREATE INDEX idx_organization_invites_email ON organization_invites(email);
```

### New Table: organization_join_requests (Optional)

```sql
CREATE TABLE organization_join_requests (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    message TEXT,
    reviewed_by_id INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_join_requests_org ON organization_join_requests(organization_id);
CREATE INDEX idx_join_requests_user ON organization_join_requests(user_id);
CREATE INDEX idx_join_requests_status ON organization_join_requests(status);
```

### New Table: task_assignees

```sql
CREATE TABLE task_assignees (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed
    completed_at TIMESTAMP,
    UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_assignees_status ON task_assignees(status);
```

### New Table: task_groups (Optional - for group tasks)

```sql
CREATE TABLE task_groups (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE task_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_task_groups_org ON task_groups(organization_id);
CREATE INDEX idx_task_group_members_group ON task_group_members(group_id);
CREATE INDEX idx_task_group_members_user ON task_group_members(user_id);
```

### Modified Table: tasks

```sql
-- Add new columns to tasks table
ALTER TABLE tasks ADD COLUMN is_private BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN group_id INTEGER REFERENCES task_groups(id);

-- Keep assigned_user_id for backward compatibility
-- New tasks will use task_assignees table
-- assigned_user_id becomes deprecated but not removed
```

### Migration Script

```sql
-- Migration: Multiple Assignees and Access Control
-- Version: 2.0.0
-- Date: November 20, 2025

BEGIN;

-- 1. Create task_assignees table
CREATE TABLE IF NOT EXISTS task_assignees (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMP,
    UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_task_assignees_status ON task_assignees(status);

-- 2. Migrate existing assigned_user_id to task_assignees
INSERT INTO task_assignees (task_id, user_id, assigned_by_id, assigned_at)
SELECT id, assigned_user_id, created_by_id, created_at
FROM tasks
WHERE assigned_user_id IS NOT NULL;

-- 3. Create task_groups table
CREATE TABLE IF NOT EXISTS task_groups (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_groups_org ON task_groups(organization_id);

-- 4. Create task_group_members table
CREATE TABLE IF NOT EXISTS task_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_task_group_members_group ON task_group_members(group_id);
CREATE INDEX idx_task_group_members_user ON task_group_members(user_id);

-- 5. Add new columns to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES task_groups(id);

-- 6. Update audit log
INSERT INTO audit_logs (table_name, action, description, performed_by_id)
VALUES ('tasks', 'schema_update', 'Added multi-assignee and access control support', NULL);

COMMIT;
```

## API Changes

### Task Endpoints - Access Control Updates

#### GET /api/tasks/organization/:organizationId

**Before:**
```typescript
// Returns all tasks in organization
SELECT * FROM tasks WHERE organization_id = $1
```

**After:**
```typescript
// Returns only tasks user has access to
SELECT DISTINCT t.*
FROM tasks t
LEFT JOIN task_assignees ta ON t.id = ta.task_id
LEFT JOIN organization_members om ON t.organization_id = om.organization_id
WHERE t.organization_id = $1
  AND (
    t.created_by_id = $2                    -- Task creator
    OR ta.user_id = $2                       -- Assigned to user
    OR (om.user_id = $2 AND om.role = 'admin') -- Org admin
  )
ORDER BY t.created_at DESC
```

#### GET /api/tasks/:taskId

**Before:**
```typescript
// Check organization membership
SELECT t.* FROM tasks t
INNER JOIN organization_members om ON t.organization_id = om.organization_id
WHERE t.id = $1 AND om.user_id = $2
```

**After:**
```typescript
// Check task-level access
SELECT t.* FROM tasks t
LEFT JOIN task_assignees ta ON t.id = ta.task_id
LEFT JOIN organization_members om ON t.organization_id = om.organization_id
WHERE t.id = $1
  AND (
    t.created_by_id = $2                    -- Task creator
    OR ta.user_id = $2                       -- Assigned to user
    OR (om.user_id = $2 AND om.role = 'admin') -- Org admin
  )
```

### New Endpoints

#### POST /api/tasks/:taskId/assignees

**Assign multiple users to a task**

```typescript
// Request body
{
  "userIds": [123, 456, 789],
  "notifyUsers": true
}

// Response
{
  "message": "Users assigned successfully",
  "assignees": [
    {
      "id": 1,
      "taskId": 10,
      "userId": 123,
      "assignedAt": "2025-11-20T...",
      "status": "pending"
    },
    // ...
  ]
}
```

**Implementation:**
```typescript
export const assignMultipleUsers = async (req: AuthRequest, res: Response) => {
  const { taskId } = req.params;
  const { userIds, notifyUsers } = req.body;
  const userId = req.user!.id;

  // 1. Verify user is task creator or org admin
  const task = await getTaskWithPermissions(taskId, userId);
  if (!task || (task.created_by_id !== userId && !task.isAdmin)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // 2. Verify all users are in the organization
  const validUsers = await verifyOrganizationMembers(task.organization_id, userIds);

  // 3. Insert assignees
  const assignees = await Promise.all(
    validUsers.map(id =>
      query(
        `INSERT INTO task_assignees (task_id, user_id, assigned_by_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (task_id, user_id) DO NOTHING
         RETURNING *`,
        [taskId, id, userId]
      )
    )
  );

  // 4. Send notifications
  if (notifyUsers) {
    await sendAssignmentNotifications(taskId, validUsers);
  }

  res.json({ assignees });
};
```

#### DELETE /api/tasks/:taskId/assignees/:userId

**Remove user from task assignment**

```typescript
export const removeAssignee = async (req: AuthRequest, res: Response) => {
  const { taskId, userId: assigneeId } = req.params;
  const userId = req.user!.id;

  // Only task creator or org admin can remove assignees
  const task = await getTaskWithPermissions(taskId, userId);
  if (!task || (task.created_by_id !== userId && !task.isAdmin)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  await query(
    'DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2',
    [taskId, assigneeId]
  );

  res.json({ message: 'Assignee removed' });
};
```

#### GET /api/tasks/:taskId/assignees

**Get all assignees for a task**

```typescript
export const getTaskAssignees = async (req: AuthRequest, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user!.id;

  // Verify access
  const hasAccess = await checkTaskAccess(taskId, userId);
  if (!hasAccess) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const result = await query(
    `SELECT ta.*, u.name, u.email, u.username
     FROM task_assignees ta
     INNER JOIN users u ON ta.user_id = u.id
     WHERE ta.task_id = $1
     ORDER BY ta.assigned_at ASC`,
    [taskId]
  );

  res.json({ assignees: result.rows });
};
```

#### POST /api/groups

**Create a task group**

```typescript
{
  "name": "Engineering Team",
  "description": "All engineering team members",
  "organizationId": 1,
  "memberIds": [123, 456, 789]
}
```

#### POST /api/tasks (Updated)

**Create task with multiple assignees or group**

```typescript
{
  "organizationId": 1,
  "title": "Review Pull Request",
  "description": "Review and approve PR #123",
  "assigneeIds": [123, 456], // Multiple assignees
  // OR
  "groupId": 5, // Assign to entire group
  "isPrivate": true, // Optional: only assignees can see
  "requirements": [...]
}
```

## Mobile Development Considerations

### Cross-Platform Feature Parity

**Critical:** Mobile app must maintain feature parity with web at all times.

**Development Strategy:**
1. **Parallel Development:** Mobile and web teams work simultaneously on same features
2. **Shared API Contract:** Both platforms consume identical API responses
3. **Design System Alignment:** Mobile UI follows web design patterns but optimized for touch
4. **Testing Synchronization:** Both platforms tested together before release

### Mobile-Specific Requirements

**UI/UX Adaptations:**
- **Touch Targets:** Minimum 44x44 points (iOS) / 48x48 dp (Android)
- **Gestures:** Swipe-to-delete, pull-to-refresh, long-press menus
- **Bottom Sheets:** Use for multi-select instead of dropdowns
- **Native Pickers:** Use platform-native pickers for group selection
- **Haptic Feedback:** Provide tactile feedback for actions
- **Loading States:** Show skeleton screens, not just spinners

**Performance Requirements:**
- **App Launch:** < 2 seconds cold start
- **List Rendering:** Smooth 60fps scrolling
- **API Response:** Handle slow networks gracefully
- **Offline Support:** Cache tasks for offline viewing
- **Sync Strategy:** Background sync when network available

**Platform-Specific Features:**
- **iOS:** Siri Shortcuts, 3D Touch, Face ID, widgets
- **Android:** Home screen shortcuts, biometric auth, widgets
- **Push Notifications:** Both platforms for task assignments
- **Deep Linking:** Open specific tasks from notifications

### Mobile API Considerations

**Response Optimization:**
```typescript
// Include mobile-specific flags
{
  "task": {
    "id": 123,
    "title": "Task title",
    // ... other fields
    "assigneeCount": 5,  // For mobile badge display
    "hasUnreadUpdates": true,  // For mobile notification dot
    "isAccessibleOffline": true  // For offline mode
  }
}
```

**Versioning:**
- Support API versioning for mobile client compatibility
- Mobile apps must specify API version in headers
- Backend maintains backward compatibility for 2 previous versions

**Data Pagination:**
- Mobile: Return 20 items per page (not 50 like web)
- Include `hasMore` flag in responses
- Support cursor-based pagination for better performance

### Mobile Testing Requirements

**Device Coverage:**
- **iOS:** Test on iPhone SE (small), iPhone 14 (standard), iPad (tablet)
- **Android:** Test on Pixel (standard), Samsung (manufacturer variant), Tablet
- **OS Versions:** iOS 13+, Android 9+

**Test Scenarios:**
1. **Network Conditions:**
   - WiFi (fast)
   - 4G (normal)
   - 3G (slow)
   - Offline
   - Network switch (WiFi ↔ Cellular)

2. **App States:**
   - Fresh install
   - After app update
   - After OS update
   - Backgrounded/foregrounded
   - Killed and restarted

3. **Permissions:**
   - Notifications enabled/disabled
   - Background refresh on/off
   - File access permissions
   - Biometric permissions

### Mobile Release Strategy

**Staged Rollout:**
1. **Week 1:** Deploy to TestFlight/Internal testing (10% of users)
2. **Week 2:** Expand to beta testers (25% of users)
3. **Week 3:** Public release (100% of users)

**App Store Requirements:**
- Update screenshots for all new features
- Update app description highlighting new capabilities
- Prepare release notes for app stores
- Include privacy policy updates if needed

**Monitoring:**
- Track crash-free rate (target: > 99.5%)
- Monitor app store ratings
- Track feature adoption rates
- Monitor API error rates from mobile

## Frontend Changes

### Task List Component

**Before:**
```typescript
// Show all organization tasks
const tasks = await taskAPI.getAll(organizationId);
```

**After:**
```typescript
// Show only accessible tasks (filtered by backend)
const tasks = await taskAPI.getAll(organizationId);
// Backend now returns filtered list

// Add visual indicators
<TaskCard>
  {task.isPrivate && <PrivateIcon />}
  {task.assigneeCount > 1 && <MultipleAssigneesIcon count={task.assigneeCount} />}
  {task.groupId && <GroupIcon />}
</TaskCard>
```

### Task Creation Form

**New Features:**
- Multi-select dropdown for assignees
- Group selection dropdown
- "Private task" checkbox
- Assignee chips with remove button

```typescript
const [selectedAssignees, setSelectedAssignees] = useState<number[]>([]);
const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
const [isPrivate, setIsPrivate] = useState(false);

// Multi-select component
<MultiSelect
  label="Assign to Users"
  options={organizationMembers}
  selected={selectedAssignees}
  onChange={setSelectedAssignees}
  placeholder="Select one or more users"
/>

// Group selector
<Select
  label="Or Assign to Group"
  options={taskGroups}
  selected={selectedGroup}
  onChange={setSelectedGroup}
  placeholder="Select a group"
/>

// Private task toggle
<Checkbox
  label="Private Task"
  checked={isPrivate}
  onChange={setIsPrivate}
  helpText="Only assignees can see this task"
/>
```

### Task Detail Page

**Show all assignees:**

```typescript
const [assignees, setAssignees] = useState<TaskAssignee[]>([]);

useEffect(() => {
  loadAssignees();
}, [taskId]);

const loadAssignees = async () => {
  const result = await taskAPI.getAssignees(taskId);
  setAssignees(result.assignees);
};

// Display assignees
<AssigneeList>
  {assignees.map(assignee => (
    <AssigneeCard key={assignee.id}>
      <Avatar src={assignee.avatar} />
      <span>{assignee.name}</span>
      <StatusBadge status={assignee.status} />
      {canManageTask && (
        <RemoveButton onClick={() => removeAssignee(assignee.userId)} />
      )}
    </AssigneeCard>
  ))}
  {canManageTask && (
    <AddAssigneeButton onClick={openAssigneeModal} />
  )}
</AssigneeList>
```

## Implementation Plan

**IMPORTANT:** Mobile app must be developed in parallel with web to ensure feature parity. Each phase includes mobile development tasks.

### Phase 1: Database & Backend (Week 1)

**Day 1-2: Database Migration**
- [ ] Create migration script
- [ ] Add `task_assignees` table
- [ ] Add `task_groups` and `task_group_members` tables
- [ ] Migrate existing `assigned_user_id` data
- [ ] Add new columns to `tasks` table
- [ ] Test migration on development database
- [ ] Run migration on production (with backup!)

**Day 3-4: Backend API Updates**
- [ ] Update task access control queries
- [ ] Implement multi-assignee endpoints
- [ ] Update task creation endpoint
- [ ] Update task list filtering
- [ ] Add group management endpoints
- [ ] Update notification system for multiple assignees
- [ ] **Ensure all APIs return mobile-friendly responses (compact data)**
- [ ] **Add mobile API versioning support**
- [ ] Write comprehensive tests

**Day 5: Testing & Documentation**
- [ ] Integration tests for access control
- [ ] Test multi-assignee scenarios
- [ ] Test group assignment
- [ ] **Test API responses with mobile clients**
- [ ] Update API documentation
- [ ] **Document mobile-specific API considerations**
- [ ] Performance testing with new queries

### Phase 2: Web & Mobile Frontend (Week 2)

**CRITICAL:** Web and mobile teams work in parallel

**Day 1-2: UI Components (Web & Mobile)**

*Web:*
- [ ] Create MultiSelect component for assignees
- [ ] Create AssigneeList component
- [ ] Create GroupSelector component
- [ ] Add private task indicator icons
- [ ] Update TaskCard component

*Mobile (React Native):*
- [ ] Create multi-select component for assignees (mobile-optimized)
- [ ] Create AssigneeList component (touch-friendly)
- [ ] Create GroupSelector picker (native picker integration)
- [ ] Add private task indicator icons (mobile design)
- [ ] Update TaskCard component with mobile indicators
- [ ] Ensure proper touch targets (min 44x44 points)

**Day 3-4: Task Creation/Editing (Web & Mobile)**

*Web:*
- [ ] Update task creation form
- [ ] Add multi-assignee selection
- [ ] Add group selection
- [ ] Add private task toggle
- [ ] Update task editing UI

*Mobile:*
- [ ] Update task creation screen (mobile layout)
- [ ] Add multi-assignee selection (bottom sheet)
- [ ] Add group selection (native picker)
- [ ] Add private task toggle (switch component)
- [ ] Update task editing screen
- [ ] Handle keyboard dismissal properly
- [ ] Add loading states for all actions

**Day 5: Task Detail & List (Web & Mobile)**

*Web:*
- [ ] Update task detail page with assignee management
- [ ] Add/remove assignee functionality
- [ ] Update task list filtering
- [ ] Show assignee indicators
- [ ] Test all user flows

*Mobile:*
- [ ] Update task detail screen with assignee management
- [ ] Add/remove assignee functionality (swipe actions)
- [ ] Update task list filtering (mobile-friendly filters)
- [ ] Show assignee indicators (badges)
- [ ] Implement pull-to-refresh
- [ ] Add haptic feedback for actions
- [ ] Test all user flows on iOS and Android
- [ ] Test offline mode and sync

### Phase 3: Testing & Deployment (Week 3)

**Day 1-2: Comprehensive Testing (Web & Mobile)**

*Web Testing:*
- [ ] Test all access control scenarios
- [ ] Test multi-user assignment
- [ ] Test group assignment
- [ ] Test private tasks
- [ ] Test notification delivery
- [ ] Test edge cases
- [ ] Cross-browser testing (Chrome, Safari, Firefox, Edge)

*Mobile Testing:*
- [ ] Test all access control scenarios on iOS
- [ ] Test all access control scenarios on Android
- [ ] Test multi-user assignment flows (both platforms)
- [ ] Test group assignment flows (both platforms)
- [ ] Test private task visibility (both platforms)
- [ ] Test push notifications (iOS and Android)
- [ ] Test offline mode and data sync
- [ ] Test app backgrounding/foregrounding
- [ ] Test on various screen sizes (phones, tablets)
- [ ] Test on older OS versions (iOS 13+, Android 9+)
- [ ] Performance testing (list scrolling, navigation speed)
- [ ] Memory leak testing
- [ ] Battery usage testing

**Day 3: Documentation (Web & Mobile)**
- [ ] Update user documentation (web)
- [ ] Create mobile app user guide
- [ ] Create admin guide for groups
- [ ] Update API documentation
- [ ] Create migration guide
- [ ] Document mobile-specific features (swipe actions, haptics)
- [ ] Create mobile app store screenshots
- [ ] Update mobile app store descriptions

**Day 4-5: Deployment (Web & Mobile)**

*Backend & Web:*
- [ ] Deploy backend to staging
- [ ] Run migration on staging
- [ ] Deploy web to staging
- [ ] QA testing on staging
- [ ] Deploy backend to production
- [ ] Run production migration
- [ ] Deploy web to production
- [ ] Monitor for issues

*Mobile:*
- [ ] Build iOS app (TestFlight)
- [ ] Build Android app (internal testing)
- [ ] Deploy to TestFlight for beta testing
- [ ] Deploy to Google Play internal track
- [ ] QA testing on TestFlight/Play Console
- [ ] Monitor crash reports (Firebase Crashlytics)
- [ ] Submit iOS app to App Store review
- [ ] Submit Android app to Play Store review
- [ ] Monitor app store reviews after release
- [ ] Prepare rollback plan for mobile (if needed)

### Phase 4: Mobile-Specific Enhancements (Week 4)

**OPTIONAL:** Mobile-specific optimizations and native features

**Day 1-2: Bulk Import Mobile Support**
- [ ] Add CSV import to mobile app (file picker)
- [ ] Implement file selection from device storage
- [ ] Implement file selection from cloud storage (iCloud, Google Drive)
- [ ] Mobile-optimized validation results display
- [ ] Progress indicator for mobile imports
- [ ] Handle large files gracefully on mobile
- [ ] Test on slow network connections

**Day 3: Native Mobile Features**
- [ ] Add Siri Shortcuts for task creation (iOS)
- [ ] Add widgets for task overview (iOS and Android)
- [ ] Implement 3D Touch quick actions (iOS)
- [ ] Add home screen shortcuts (Android)
- [ ] Implement share extension (share to app)
- [ ] Add Face ID/Touch ID for sensitive tasks
- [ ] Implement biometric authentication for private tasks

**Day 4: Mobile Performance Optimization**
- [ ] Implement list virtualization for large task lists
- [ ] Add image caching for user avatars
- [ ] Optimize API calls (batch requests where possible)
- [ ] Implement incremental loading (pagination)
- [ ] Add network request caching
- [ ] Optimize app bundle size
- [ ] Add code splitting for faster startup

**Day 5: Mobile Polish**
- [ ] Add animations for assignee changes
- [ ] Implement skeleton screens for loading states
- [ ] Add empty states for all screens
- [ ] Implement error retry mechanisms
- [ ] Add contextual help tooltips
- [ ] Implement dark mode (if not already present)
- [ ] Final QA pass on both platforms

## Access Control Matrix

| User Type | Can See Task | Can Edit Task | Can Delete Task | Can Assign Users | Can Complete |
|-----------|-------------|---------------|-----------------|------------------|--------------|
| Task Creator | ✅ Always | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Assignee | ✅ Yes | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Org Admin | ✅ Yes* | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Org Member | ❌ No** | ❌ No | ❌ No | ❌ No | ❌ No |
| Non-member | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

\* Org admins can see all tasks (admin override)
\*\* Org members can only see tasks they created or are assigned to

## Testing Scenarios

### Scenario 1: Multi-Assignee Task

```
1. User A creates task assigned to Users B, C, D
2. Verify:
   - Users B, C, D can see the task
   - User E (org member) cannot see the task
   - User F (non-member) cannot see the task
   - All assignees receive notifications
   - Task shows in each assignee's task list
```

### Scenario 2: Private Task

```
1. User A creates private task assigned to User B
2. Verify:
   - Only User A and B can see the task
   - Org admin can see the task
   - Other org members cannot see it
   - Task has "private" indicator in UI
```

### Scenario 3: Group Task

```
1. Admin creates group "Engineering" with Users A, B, C
2. User D creates task assigned to "Engineering" group
3. Verify:
   - Users A, B, C automatically assigned
   - All group members can see task
   - Task shows group name in UI
   - Individual completion tracking works
```

### Scenario 4: Assignee Removal

```
1. Task creator removes assignee
2. Verify:
   - Removed user can no longer see task
   - Removed user's completions remain (audit trail)
   - Other assignees unaffected
   - Notification sent to removed user
```

### Scenario 5: Access Control Enforcement

```
1. User A tries to access task they're not assigned to
2. Verify:
   - API returns 403 Forbidden
   - UI doesn't show task in list
   - Direct URL access is blocked
   - Error logged for security monitoring
```

## Security Considerations

### SQL Injection Prevention

All queries use parameterized statements:
```typescript
// ✅ Good
query('SELECT * FROM tasks WHERE id = $1', [taskId]);

// ❌ Bad
query(`SELECT * FROM tasks WHERE id = ${taskId}`);
```

### Authorization Checks

Every endpoint must verify:
1. User is authenticated
2. User is organization member
3. User has task-level access
4. User has required permissions for action

```typescript
// Standard check pattern
const hasAccess = await checkTaskAccess(taskId, userId);
if (!hasAccess) {
  return res.status(403).json({ error: 'Unauthorized' });
}
```

### Audit Logging

Log all access control changes:
- Task assignments/removals
- Group membership changes
- Access denials (for security monitoring)
- Admin overrides

```typescript
await logAuditEvent({
  action: 'task_assignee_added',
  taskId,
  performedBy: userId,
  targetUser: assigneeId,
  timestamp: new Date()
});
```

## Performance Considerations

### Query Optimization

**Index Requirements:**
```sql
-- Critical indexes for performance
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX idx_tasks_creator ON tasks(created_by_id);
CREATE INDEX idx_tasks_org ON tasks(organization_id);
```

**Query Performance:**
- Task list query: < 100ms (with indexes)
- Access check: < 50ms (cached in memory)
- Assignee lookup: < 50ms

### Caching Strategy

```typescript
// Cache task access permissions (5 minutes)
const cacheKey = `task_access:${taskId}:${userId}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const hasAccess = await checkDatabaseAccess(taskId, userId);
await cache.set(cacheKey, hasAccess, 300); // 5 min TTL
return hasAccess;
```

### Database Connection Pool

Increase pool size for additional queries:
```typescript
// backend/src/config/database.ts
const pool = new Pool({
  max: 20, // Increase from 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Backwards Compatibility

### Deprecation Strategy

**Phase 1: Dual Support (3 months)**
- Support both `assigned_user_id` and `task_assignees`
- New tasks use `task_assignees` only
- Old tasks continue to work with `assigned_user_id`

**Phase 2: Migration Encouragement (3 months)**
- Show deprecation warnings in UI
- Offer one-click migration for old tasks
- Send email notifications to admins

**Phase 3: Full Migration (after 6 months)**
- Automatically migrate remaining tasks
- Remove `assigned_user_id` dependency
- Update all queries to use only `task_assignees`

### API Versioning

```typescript
// Support old API format
POST /api/tasks
{
  "assignedUserId": 123  // Old format - still works
}

// New API format
POST /api/tasks
{
  "assigneeIds": [123, 456]  // New format - preferred
}

// Backend handles both
const assigneeIds = req.body.assigneeIds ||
  (req.body.assignedUserId ? [req.body.assignedUserId] : []);
```

## Rollout Plan

### Development Environment

1. Create feature branch: `feature/access-control`
2. Run migrations on dev database
3. Implement backend changes
4. Implement frontend changes
5. Write tests
6. Code review

### Staging Environment

1. Deploy to staging
2. Run migration script
3. Seed test data
4. Manual QA testing
5. Performance testing
6. Security testing

### Production Deployment

**Pre-deployment:**
- [ ] Database backup completed
- [ ] Migration script tested on staging
- [ ] Rollback plan prepared
- [ ] Team notified of deployment window

**Deployment Steps:**
1. Maintenance mode ON (2-5 minutes)
2. Backup production database
3. Run migration script
4. Deploy new backend code
5. Deploy new frontend build
6. Smoke tests
7. Maintenance mode OFF
8. Monitor for 1 hour

**Post-deployment:**
- [ ] Verify access control working
- [ ] Check error logs
- [ ] Monitor performance metrics
- [ ] Test critical user flows
- [ ] Send completion notification

## Success Metrics

Track these metrics to measure success:

1. **Adoption Rate**
   - % of tasks using multi-assignee feature
   - % of tasks marked as private
   - % of organizations creating groups

2. **Performance**
   - Task list load time (target: < 500ms)
   - Task detail load time (target: < 300ms)
   - Access check latency (target: < 50ms)

3. **User Satisfaction**
   - User feedback on new features
   - Support tickets related to access control
   - Feature usage analytics

4. **Security**
   - # of unauthorized access attempts blocked
   - # of access control violations
   - Time to detect security issues

## Future Enhancements

### Post-MVP Features

1. **Advanced Permissions**
   - Custom roles beyond admin/member
   - Fine-grained task permissions
   - Read-only task access

2. **Task Templates**
   - Save assignee groups as templates
   - Recurring group tasks
   - Default privacy settings

3. **Enhanced Groups**
   - Nested groups (sub-teams)
   - Dynamic groups (auto-add based on criteria)
   - Group permissions inheritance

4. **Notifications**
   - Configurable notification preferences
   - Digest emails for group tasks
   - In-app notification center

5. **Analytics**
   - Task completion by assignee
   - Group performance metrics
   - Access control audit reports

6. **Bulk Task Import**
   - CSV file import for bulk task creation
   - Support for multiple assignees per task
   - Template-based task creation
   - Import validation and error reporting
   - Progress tracking during import

## Bulk Task Import Feature

### Overview

Allow task creators to import multiple tasks at once via CSV file upload. This feature enables efficient bulk task creation for recurring workflows, project templates, and large-scale task assignments.

### CSV File Format

#### Column Structure

**Required Columns:**
- `title` - Task title (max 255 characters)
- `organization_id` - Organization ID or name

**Optional Columns:**
- `details` - Task description/details (text)
- `assigned_user_emails` - Comma-separated list of assignee email addresses
- `assigned_user_ids` - Comma-separated list of assignee user IDs (alternative to emails)
- `start_date` - Task start date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
- `end_date` - Task end date (ISO 8601 format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
- `schedule_type` - one_time, daily, weekly, monthly (default: one_time)
- `schedule_frequency` - Number for frequency (default: 1)
- `is_private` - true/false (default: false)
- `group_id` - ID of group to assign (if using group assignment)
- `group_name` - Name of group to assign (alternative to group_id)
- `requirements` - Pipe-separated list of requirement descriptions (e.g., "Req 1|Req 2|Req 3")
- `status` - pending, in_progress, submitted, completed (default: pending)

#### Example CSV Format

```csv
title,organization_id,details,assigned_user_emails,start_date,end_date,schedule_type,is_private,requirements
"Review Q1 Reports",1,"Review and approve all Q1 financial reports","john@example.com,jane@example.com",2025-11-21,2025-11-30,one_time,false,"Review revenue report|Review expense report|Submit approval"
"Weekly Team Sync",1,"Conduct weekly team synchronization meeting","team-lead@example.com",2025-11-21,2025-11-21,weekly,false,"Prepare agenda|Send calendar invite|Document action items"
"Security Audit",1,"Perform security audit of production systems","security@example.com,devops@example.com",2025-11-25,2025-12-15,one_time,true,"Scan for vulnerabilities|Review access logs|Generate report|Submit findings"
"Client Onboarding",2,"Onboard new client - Acme Corp","sales@example.com,support@example.com",2025-11-22,,one_time,false,"Send welcome email|Schedule kickoff call|Create project workspace"
```

#### CSV with Group Assignment

```csv
title,organization_id,details,group_name,start_date,end_date,requirements
"Code Review Sprint",1,"Review all pending pull requests","Engineering Team",2025-11-21,2025-11-22,"Review PR #123|Review PR #124|Review PR #125"
"Marketing Campaign",1,"Launch Q4 marketing campaign","Marketing Team",2025-12-01,2025-12-31,"Create content|Design graphics|Schedule posts|Track analytics"
```

### API Endpoints

#### POST /api/tasks/import

**Upload CSV file for bulk task creation**

**Request:**
```typescript
// Multipart form data
Content-Type: multipart/form-data

{
  organizationId: number,
  file: File, // CSV file
  validateOnly: boolean, // If true, only validate without creating tasks
  notifyAssignees: boolean // Send notifications to assignees (default: true)
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,
  stats: {
    totalRows: number,
    validRows: number,
    invalidRows: number,
    tasksCreated: number,
    errors: Array<{
      row: number,
      column?: string,
      error: string,
      data: object
    }>
  },
  tasks?: Task[], // Created tasks (if not validateOnly)
  validationErrors?: Array<ValidationError> // If validateOnly=true
}
```

**Example Success Response:**
```json
{
  "success": true,
  "message": "Successfully imported 15 tasks",
  "stats": {
    "totalRows": 16,
    "validRows": 15,
    "invalidRows": 1,
    "tasksCreated": 15,
    "errors": [
      {
        "row": 8,
        "column": "assigned_user_emails",
        "error": "User with email 'invalid@example.com' not found in organization",
        "data": {
          "title": "Task Title",
          "assigned_user_emails": "invalid@example.com"
        }
      }
    ]
  },
  "tasks": [...]
}
```

#### GET /api/tasks/import/template

**Download CSV template file**

**Response:**
```typescript
Content-Type: text/csv
Content-Disposition: attachment; filename="task_import_template.csv"

// Returns CSV template with headers and example rows
```

#### POST /api/tasks/import/validate

**Validate CSV file without creating tasks**

Same as POST /api/tasks/import but with validateOnly=true automatically set.

### Backend Implementation

#### Import Service

```typescript
// backend/src/services/taskImportService.ts

interface ImportRow {
  title: string;
  organization_id: string | number;
  details?: string;
  assigned_user_emails?: string;
  assigned_user_ids?: string;
  start_date?: string;
  end_date?: string;
  schedule_type?: string;
  schedule_frequency?: string | number;
  is_private?: string | boolean;
  group_id?: string | number;
  group_name?: string;
  requirements?: string;
  status?: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    tasksCreated: number;
    errors: ImportError[];
  };
  tasks?: any[];
}

interface ImportError {
  row: number;
  column?: string;
  error: string;
  data: any;
}

export class TaskImportService {

  // Parse CSV file
  async parseCSV(filePath: string): Promise<ImportRow[]> {
    // Use csv-parser library
    const rows: ImportRow[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  // Validate row data
  async validateRow(
    row: ImportRow,
    rowIndex: number,
    orgId: number,
    userId: number
  ): Promise<{ valid: boolean; errors: ImportError[] }> {
    const errors: ImportError[] = [];

    // Required fields
    if (!row.title || row.title.trim() === '') {
      errors.push({
        row: rowIndex,
        column: 'title',
        error: 'Title is required',
        data: row
      });
    }

    // Validate dates
    if (row.start_date && !this.isValidDate(row.start_date)) {
      errors.push({
        row: rowIndex,
        column: 'start_date',
        error: 'Invalid date format. Use YYYY-MM-DD',
        data: row
      });
    }

    // Validate assignees
    if (row.assigned_user_emails) {
      const emails = row.assigned_user_emails.split(',').map(e => e.trim());
      const invalidEmails = await this.validateUserEmails(emails, orgId);

      if (invalidEmails.length > 0) {
        errors.push({
          row: rowIndex,
          column: 'assigned_user_emails',
          error: `Users not found: ${invalidEmails.join(', ')}`,
          data: row
        });
      }
    }

    // Validate group
    if (row.group_name) {
      const groupExists = await this.validateGroup(row.group_name, orgId);
      if (!groupExists) {
        errors.push({
          row: rowIndex,
          column: 'group_name',
          error: `Group '${row.group_name}' not found`,
          data: row
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Import tasks from CSV
  async importTasks(
    filePath: string,
    organizationId: number,
    userId: number,
    options: {
      validateOnly?: boolean;
      notifyAssignees?: boolean;
    } = {}
  ): Promise<ImportResult> {

    const rows = await this.parseCSV(filePath);
    const result: ImportResult = {
      success: false,
      message: '',
      stats: {
        totalRows: rows.length,
        validRows: 0,
        invalidRows: 0,
        tasksCreated: 0,
        errors: []
      },
      tasks: []
    };

    // Validate all rows first
    for (let i = 0; i < rows.length; i++) {
      const validation = await this.validateRow(rows[i], i + 2, organizationId, userId); // +2 for header row

      if (validation.valid) {
        result.stats.validRows++;
      } else {
        result.stats.invalidRows++;
        result.stats.errors.push(...validation.errors);
      }
    }

    // If validateOnly, return validation results
    if (options.validateOnly) {
      result.success = result.stats.invalidRows === 0;
      result.message = result.success
        ? `All ${result.stats.validRows} rows are valid`
        : `${result.stats.invalidRows} rows have validation errors`;
      return result;
    }

    // Create tasks for valid rows
    for (let i = 0; i < rows.length; i++) {
      const validation = await this.validateRow(rows[i], i + 2, organizationId, userId);

      if (!validation.valid) {
        continue; // Skip invalid rows
      }

      try {
        const task = await this.createTaskFromRow(
          rows[i],
          organizationId,
          userId,
          options.notifyAssignees
        );

        result.tasks!.push(task);
        result.stats.tasksCreated++;

      } catch (error: any) {
        result.stats.errors.push({
          row: i + 2,
          error: error.message || 'Failed to create task',
          data: rows[i]
        });
      }
    }

    result.success = result.stats.tasksCreated > 0;
    result.message = `Successfully imported ${result.stats.tasksCreated} tasks`;

    if (result.stats.errors.length > 0) {
      result.message += `, ${result.stats.errors.length} errors`;
    }

    return result;
  }

  // Create task from CSV row
  private async createTaskFromRow(
    row: ImportRow,
    organizationId: number,
    userId: number,
    notifyAssignees: boolean = true
  ): Promise<any> {

    // Parse requirements
    const requirements = row.requirements
      ? row.requirements.split('|').map(r => r.trim()).filter(r => r !== '')
      : [];

    // Parse assignee emails
    let assigneeIds: number[] = [];
    if (row.assigned_user_emails) {
      const emails = row.assigned_user_emails.split(',').map(e => e.trim());
      assigneeIds = await this.getUserIdsByEmails(emails, organizationId);
    } else if (row.assigned_user_ids) {
      assigneeIds = row.assigned_user_ids.split(',').map(id => parseInt(id.trim()));
    }

    // Get group ID if group name provided
    let groupId = row.group_id ? parseInt(String(row.group_id)) : null;
    if (!groupId && row.group_name) {
      groupId = await this.getGroupIdByName(row.group_name, organizationId);
    }

    // Create task
    const taskData = {
      organizationId,
      title: row.title,
      details: row.details || '',
      startDate: row.start_date || null,
      endDate: row.end_date || null,
      scheduleType: row.schedule_type || 'one_time',
      scheduleFrequency: row.schedule_frequency ? parseInt(String(row.schedule_frequency)) : 1,
      status: row.status || 'pending',
      assigneeIds,
      groupId,
      isPrivate: this.parseBoolean(row.is_private),
      requirements,
      notifyAssignees
    };

    // Use existing task creation logic
    return await createTaskWithAssignees(taskData, userId);
  }

  // Helper methods
  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return false;
  }

  private async validateUserEmails(
    emails: string[],
    orgId: number
  ): Promise<string[]> {
    const result = await query(
      `SELECT u.email
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 AND u.email = ANY($2)`,
      [orgId, emails]
    );

    const validEmails = result.rows.map((r: any) => r.email);
    return emails.filter(email => !validEmails.includes(email));
  }

  private async getUserIdsByEmails(
    emails: string[],
    orgId: number
  ): Promise<number[]> {
    const result = await query(
      `SELECT u.id
       FROM users u
       INNER JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1 AND u.email = ANY($2)`,
      [orgId, emails]
    );

    return result.rows.map((r: any) => r.id);
  }

  private async validateGroup(
    groupName: string,
    orgId: number
  ): Promise<boolean> {
    const result = await query(
      'SELECT id FROM task_groups WHERE organization_id = $1 AND name = $2',
      [orgId, groupName]
    );

    return result.rows.length > 0;
  }

  private async getGroupIdByName(
    groupName: string,
    orgId: number
  ): Promise<number | null> {
    const result = await query(
      'SELECT id FROM task_groups WHERE organization_id = $1 AND name = $2',
      [orgId, groupName]
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  }
}

// Controller
export const importTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId, validateOnly, notifyAssignees } = req.body;
    const userId = req.user!.id;
    const file = req.file; // Uploaded CSV file

    if (!file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    // Verify organization membership
    const memberCheck = await query(
      'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
      [organizationId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    // Import tasks
    const importService = new TaskImportService();
    const result = await importService.importTasks(
      file.path,
      parseInt(organizationId),
      userId,
      {
        validateOnly: validateOnly === 'true' || validateOnly === true,
        notifyAssignees: notifyAssignees !== 'false' && notifyAssignees !== false
      }
    );

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Log audit entry
    await logAudit({
      user_id: userId,
      action: 'bulk_import',
      entity_type: 'task',
      metadata: {
        organization_id: organizationId,
        tasks_created: result.stats.tasksCreated,
        errors: result.stats.errors.length
      }
    });

    res.json(result);

  } catch (error) {
    console.error('Import tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Download template
export const downloadTemplate = async (req: AuthRequest, res: Response) => {
  const template = `title,organization_id,details,assigned_user_emails,start_date,end_date,schedule_type,is_private,requirements
"Example Task 1",1,"This is a sample task description","user1@example.com,user2@example.com",2025-11-21,2025-11-30,one_time,false,"Requirement 1|Requirement 2|Requirement 3"
"Example Task 2",1,"Another sample task","user3@example.com",2025-11-25,2025-12-01,weekly,true,"Step 1|Step 2"`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="task_import_template.csv"');
  res.send(template);
};
```

### Frontend Implementation

#### Import Component

```typescript
// web/src/components/TaskImport.tsx

import React, { useState } from 'react';

interface ImportResult {
  success: boolean;
  message: string;
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    tasksCreated: number;
    errors: Array<{
      row: number;
      column?: string;
      error: string;
      data: any;
    }>;
  };
}

export const TaskImport: React.FC<{ organizationId: number }> = ({ organizationId }) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleValidate = async () => {
    if (!file) return;

    setValidating(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', String(organizationId));
    formData.append('validateOnly', 'true');

    try {
      const response = await fetch('/api/tasks/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Validation error:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('organizationId', String(organizationId));
    formData.append('validateOnly', 'false');
    formData.append('notifyAssignees', 'true');

    try {
      const response = await fetch('/api/tasks/import', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Refresh task list or redirect
        window.location.reload();
      }
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    window.location.href = '/api/tasks/import/template';
  };

  return (
    <div className="task-import">
      <h2>Bulk Task Import</h2>

      <div className="instructions">
        <p>Upload a CSV file to create multiple tasks at once.</p>
        <button onClick={downloadTemplate}>Download CSV Template</button>
      </div>

      <div className="file-upload">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="actions">
          <button
            onClick={handleValidate}
            disabled={validating || importing}
          >
            {validating ? 'Validating...' : 'Validate CSV'}
          </button>

          <button
            onClick={handleImport}
            disabled={validating || importing}
          >
            {importing ? 'Importing...' : 'Import Tasks'}
          </button>
        </div>
      )}

      {result && (
        <div className={`result ${result.success ? 'success' : 'error'}`}>
          <h3>{result.message}</h3>

          <div className="stats">
            <p>Total Rows: {result.stats.totalRows}</p>
            <p>Valid Rows: {result.stats.validRows}</p>
            <p>Invalid Rows: {result.stats.invalidRows}</p>
            {result.stats.tasksCreated > 0 && (
              <p>Tasks Created: {result.stats.tasksCreated}</p>
            )}
          </div>

          {result.stats.errors.length > 0 && (
            <div className="errors">
              <h4>Errors:</h4>
              <ul>
                {result.stats.errors.map((error, index) => (
                  <li key={index}>
                    Row {error.row}
                    {error.column && ` - ${error.column}`}: {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Validation Rules

1. **Required Fields**
   - title: Must be non-empty, max 255 characters
   - organization_id: Must be valid organization ID or name

2. **Date Validation**
   - Must be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
   - end_date must be after start_date if both provided

3. **Assignee Validation**
   - All email addresses must exist in the organization
   - All user IDs must be valid organization members
   - Maximum 50 assignees per task

4. **Group Validation**
   - Group must exist in the specified organization
   - Group cannot be used with individual assignees (mutually exclusive)

5. **Schedule Validation**
   - schedule_type must be: one_time, daily, weekly, or monthly
   - schedule_frequency must be positive integer

6. **Status Validation**
   - Must be: pending, in_progress, submitted, or completed

7. **Requirements Validation**
   - Maximum 50 requirements per task
   - Each requirement max 500 characters

### Error Handling

**Common Errors:**

1. **Invalid CSV Format**
   ```json
   {
     "error": "Invalid CSV file format",
     "details": "Missing required column: title"
   }
   ```

2. **User Not Found**
   ```json
   {
     "row": 5,
     "column": "assigned_user_emails",
     "error": "User with email 'unknown@example.com' not found in organization"
   }
   ```

3. **Invalid Date**
   ```json
   {
     "row": 8,
     "column": "start_date",
     "error": "Invalid date format. Use YYYY-MM-DD"
   }
   ```

4. **Group Not Found**
   ```json
   {
     "row": 12,
     "column": "group_name",
     "error": "Group 'Unknown Team' not found in organization"
   }
   ```

### Testing Scenarios

1. **Valid Import**
   - Upload CSV with 10 valid rows
   - Verify 10 tasks created
   - Verify assignees assigned correctly
   - Verify requirements created

2. **Partial Errors**
   - Upload CSV with 10 rows, 3 invalid
   - Verify 7 tasks created
   - Verify error details for 3 failed rows

3. **All Invalid**
   - Upload CSV with all invalid rows
   - Verify no tasks created
   - Verify all errors reported

4. **Validation Only**
   - Upload CSV with validateOnly=true
   - Verify no tasks created
   - Verify validation results returned

5. **Large File**
   - Upload CSV with 1000 rows
   - Verify performance (< 30 seconds)
   - Verify memory usage stable

### Dependencies

**Backend:**
```bash
npm install csv-parser multer
npm install --save-dev @types/multer
```

**Frontend:**
```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

### Implementation Checklist

**Backend:**
- [ ] Install dependencies (csv-parser, multer)
- [ ] Create TaskImportService class
- [ ] Implement CSV parsing
- [ ] Implement row validation
- [ ] Implement task creation from row
- [ ] Add import endpoint
- [ ] Add validation endpoint
- [ ] Add template download endpoint
- [ ] Write unit tests
- [ ] Write integration tests

**Frontend:**
- [ ] Install dependencies (papaparse)
- [ ] Create TaskImport component
- [ ] Add file upload UI
- [ ] Implement validation flow
- [ ] Implement import flow
- [ ] Add progress indicator
- [ ] Display results and errors
- [ ] Add template download button
- [ ] Style component
- [ ] Write component tests

**Documentation:**
- [ ] API documentation
- [ ] CSV format documentation
- [ ] User guide with examples
- [ ] Error handling guide

## Questions & Decisions

### Open Questions

1. ✅ **Group Task Completion Logic** - DECIDED
   - Q: Should task complete when ANY assignee completes OR ALL assignees complete?
   - ✅ Decision: **ANY assignee finishing completes the task**
   - Implementation: First assignee to complete marks task as completed
   - Note: Individual completion tracking still maintained in task_assignees table

2. ✅ **Admin Override Visibility** - DECIDED
   - Q: Should org admins be able to see private tasks?
   - ✅ Decision: **Yes, admins can see all private tasks**
   - Implementation: Log admin access to private tasks for audit trail
   - Privacy note: Indicated in UI when admin is viewing private task

3. **Assignee Limit** - APPROVED
   - Q: Maximum number of assignees per task?
   - ✅ Decision: **50 assignees** (prevent abuse and ensure performance)

4. **Group Size Limit** - APPROVED
   - Q: Maximum group size?
   - ✅ Decision: **100 members** (scale consideration)

### Decisions Made

1. ✅ Keep `assigned_user_id` for backwards compatibility (6-month deprecation)
2. ✅ Org admins can see all tasks (management requirement)
3. ✅ Private tasks visible to creator, assignees, and org admins only
4. ✅ Task assignees table uses soft deletes (audit trail)
5. ✅ Notifications sent to all assignees (can be configured per user later)
6. ✅ **Onboarding: Support BOTH auto-join (invite code) AND admin approval workflows**
7. ✅ **Task completion: ANY assignee finishing completes the task (not ALL)**
8. ✅ **Org admins CAN see private tasks (logged for audit)**
9. ✅ **Team resources: Available for 4-week implementation**
10. ✅ **Priority: Start with Phase 0 (onboarding), then continue sequentially**

## Resources Needed

### Development

**Backend Team:**
- Backend Developer: 40 hours
- Database Engineer: 8 hours (migration)

**Frontend Team:**
- Web Developer: 40 hours
- **iOS Developer: 40 hours**
- **Android Developer: 40 hours**

**Quality Assurance:**
- **Web QA Engineer: 16 hours**
- **Mobile QA Engineer (iOS/Android): 24 hours**

**Design:**
- **UI/UX Designer (mobile adaptations): 16 hours**

**Total Effort:** ~3-4 weeks with full team (5-6 developers + QA + designer)

**IMPORTANT:** See `MOBILE_PARITY_REVIEW.md` for detailed mobile implementation requirements and current parity status.

**Team Structure Recommendation:**
- 1 Backend Developer
- 1 Web Frontend Developer
- 1 React Native Developer (covers both iOS/Android) OR 2 separate iOS/Android developers
- 1 QA Engineer (cross-platform)
- 0.5 UI/UX Designer (part-time for mobile design)

### Infrastructure

**Backend:**
- Database storage: +5-10GB for new tables
- Memory: +256MB for query caching
- No additional servers needed

**Mobile:**
- Apple Developer Program: $99/year (if not already enrolled)
- Google Play Console: $25 one-time (if not already enrolled)
- Firebase/Crashlytics: Free tier or existing plan
- TestFlight distribution: Included with Apple Developer
- Beta testing service: Use built-in TestFlight/Play Console
- Push notification service: Firebase Cloud Messaging (free)

### Documentation

- User guide updates (web): 4 hours
- **Mobile app user guide: 6 hours**
- API documentation: 4 hours
- Admin guide: 4 hours
- Video tutorials (web + mobile): 12 hours
- **App store assets (screenshots, descriptions): 4 hours**

**Total Documentation:** 34 hours

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|---------|------------|
| Migration fails | Low | High | Thorough testing, backup, rollback plan |
| Performance degradation | Medium | Medium | Indexes, caching, load testing |
| User confusion | Medium | Low | Clear UI, documentation, tooltips |
| Breaking changes | Low | High | Backwards compatibility, API versioning |
| Security vulnerabilities | Low | High | Security review, penetration testing |
| **Mobile app rejection** | **Low** | **High** | **Follow app store guidelines, test thoroughly** |
| **Mobile-web feature gap** | **Medium** | **High** | **Parallel development, shared checklist** |
| **Device fragmentation issues** | **Medium** | **Medium** | **Test on multiple devices, use responsive design** |
| **Offline sync conflicts** | **Medium** | **Medium** | **Implement conflict resolution, last-write-wins** |
| **Push notification failures** | **Low** | **Medium** | **Graceful degradation, in-app notifications** |

## Mobile Development Checklist

### Pre-Development
- [ ] Review existing mobile codebase architecture
- [ ] Set up mobile development environments (Xcode, Android Studio)
- [ ] Configure TestFlight and Google Play Console access
- [ ] Set up Firebase/Crashlytics for mobile
- [ ] Create mobile design mockups for all new features
- [ ] Define API contracts with backend team
- [ ] Set up mobile CI/CD pipeline

### Core Features Parity
- [ ] Task-level access control (both platforms)
- [ ] Multiple assignees per task (both platforms)
- [ ] Group task management (both platforms)
- [ ] Private task indicator (both platforms)
- [ ] Assignee badges and counts (both platforms)
- [ ] CSV bulk import (both platforms)

### Mobile-Specific Features
- [ ] Swipe actions for assignee management
- [ ] Pull-to-refresh on task lists
- [ ] Haptic feedback for actions
- [ ] Push notifications for assignments
- [ ] Offline mode and sync
- [ ] Bottom sheets for multi-select
- [ ] Native pickers for groups
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Error states with retry

### Platform-Specific Features (Optional)

**iOS:**
- [ ] Siri Shortcuts for quick task creation
- [ ] iOS Widgets for task overview
- [ ] 3D Touch quick actions
- [ ] Face ID for private tasks
- [ ] Share extension

**Android:**
- [ ] Android Widgets for task overview
- [ ] Home screen shortcuts
- [ ] Biometric auth for private tasks
- [ ] Share intent support

### Testing & QA
- [ ] Unit tests for all new features
- [ ] Integration tests with API
- [ ] UI/snapshot tests
- [ ] Test on multiple devices (3+ per platform)
- [ ] Test on multiple OS versions (iOS 13+, Android 9+)
- [ ] Test offline mode thoroughly
- [ ] Test push notifications
- [ ] Performance testing (scrolling, navigation)
- [ ] Memory leak testing
- [ ] Battery usage testing

### App Store Submission
- [ ] Update app screenshots (all required sizes)
- [ ] Update app store descriptions
- [ ] Create release notes
- [ ] Update privacy policy if needed
- [ ] Submit for TestFlight beta
- [ ] Collect beta tester feedback
- [ ] Submit for App Store review (iOS)
- [ ] Submit for Play Store review (Android)
- [ ] Monitor reviews and ratings

### Post-Launch
- [ ] Monitor crash reports daily
- [ ] Track feature adoption rates
- [ ] Gather user feedback
- [ ] Plan mobile-specific optimizations
- [ ] Regular sync meetings with web team

## Mobile Development Success Criteria

**Must Have (MVP):**
- ✅ 100% feature parity with web for core access control features
- ✅ < 2% crash rate
- ✅ < 2 second app launch time
- ✅ Works offline (view tasks, sync when online)
- ✅ Push notifications working on both platforms
- ✅ Passes App Store and Play Store review

**Should Have:**
- ✅ Swipe actions for common operations
- ✅ Pull-to-refresh
- ✅ Haptic feedback
- ✅ Skeleton loading screens
- ✅ 60fps scrolling performance

**Nice to Have (Phase 4):**
- Siri Shortcuts / Google Assistant integration
- Widgets
- 3D Touch / Long-press shortcuts
- Biometric auth for sensitive data
- Share extensions

## Contact & Support

**Feature Owner:** Engineering Team
**Technical Lead:** TBD
**Mobile Lead:** TBD
**Questions:** Submit issue with `access-control` or `mobile` label

---

*Last Updated: November 20, 2025*
*Status: Planning Phase*
*Target Start Date: TBD*
*Target Completion: TBD*
*Mobile Parity: REQUIRED for all phases*
