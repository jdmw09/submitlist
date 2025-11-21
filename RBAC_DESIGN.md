# Enhanced RBAC Design for TaskManager

## Overview

This document outlines the enhanced Role-Based Access Control (RBAC) system with resource-level permissions for the TaskManager SaaS application.

## Current State

**Existing Role System:**
- Global roles: `member`, `admin`, `super_admin`
- Organization roles: `admin`, `member`
- Simple middleware-based authorization

**Limitations:**
- No resource-level permissions (task ownership)
- No granular control (view vs edit vs delete)
- No custom permission structures per organization
- No team/group-based access within organizations

---

## Design Goals

1. **Resource-Level Access Control**: Control who can access specific tasks, not just organization-wide
2. **Permission Granularity**: Separate view/edit/delete/assign permissions
3. **Flexible Relationships**: Support creator, assignee, observer, and admin relationships to tasks
4. **Organization Customization**: Allow different permission schemes per organization
5. **Scalable**: Support future features like teams, projects, custom roles
6. **Backward Compatible**: Maintain existing auth middleware patterns

---

## Permission Model

### Core Concepts

**Resource Types:**
- `task` - A task and its core properties
- `task_attachment` - Files attached to task completions
- `task_completion` - Completion records (text/image/video)
- `organization` - Organization settings and members
- `user` - User profiles and settings

**Action Types:**
- `view` - Read access to resource
- `edit` - Modify resource properties
- `delete` - Remove resource
- `assign` - Assign task to users
- `comment` - Add comments/notes
- `complete` - Submit completions

**Relationship Types (Task Context):**
- `creator` - User who created the task
- `assignee` - User assigned to the task
- `admin` - Organization admin
- `observer` - User with read-only access to task

---

## Task Access Rules

Based on your requirements, here's the permission matrix:

### Task Visibility (View)

| Relationship | Can View Task | Rationale |
|--------------|---------------|-----------|
| Creator      | ✅ Yes        | Created the task |
| Assignee     | ✅ Yes        | Responsible for completing it |
| Admin        | ✅ Yes        | Organization oversight |
| Observer     | ✅ Yes        | Explicitly granted view access |
| Other Member | ❌ No         | No relationship to task |

### Task Modification (Edit/Delete)

| Relationship | Can Edit | Can Delete | Rationale |
|--------------|----------|------------|-----------|
| Creator      | ✅ Yes   | ✅ Yes     | Task ownership |
| Assignee     | ❌ No    | ❌ No      | Can only complete, not modify |
| Admin        | ✅ Yes   | ✅ Yes     | Organization oversight |
| Observer     | ❌ No    | ❌ No      | Read-only access |
| Other Member | ❌ No    | ❌ No      | No access |

### Task Assignment

| Relationship | Can Assign Users | Rationale |
|--------------|------------------|-----------|
| Creator      | ✅ Yes           | Task ownership |
| Assignee     | ❌ No            | Cannot reassign |
| Admin        | ✅ Yes           | Organization oversight |
| Observer     | ❌ No            | Read-only |
| Other Member | ❌ No            | No access |

### Attachment/Completion Visibility

| Relationship | Can View Attachments | Can View Completions | Rationale |
|--------------|---------------------|----------------------|-----------|
| Creator      | ✅ Yes              | ✅ Yes               | Task ownership |
| Assignee     | ✅ Yes              | ✅ Yes               | Need to see/submit work |
| Admin        | ✅ Yes              | ✅ Yes               | Organization oversight |
| Observer     | ❌ No               | ❌ No                | Sensitive data protection |
| Other Member | ❌ No               | ❌ No                | No access |

### Submission Rights

| Relationship | Can Submit Completion | Rationale |
|--------------|----------------------|-----------|
| Creator      | ❌ No*               | Typically shouldn't complete own task |
| Assignee     | ✅ Yes               | Primary responsibility |
| Admin        | ✅ Yes               | Can complete on behalf of assignee |
| Observer     | ❌ No                | Read-only |
| Other Member | ❌ No                | No access |

*Note: Consider making this configurable per organization

---

## Additional Roles & Permutations

### 1. Observer Role
**Use Case:** Stakeholders who need visibility without ability to modify

**Permissions:**
- ✅ View task details (title, description, dates, status)
- ✅ View task assignee and creator
- ❌ View attachments/completions (sensitive)
- ❌ Edit or delete task
- ❌ Assign users
- ❌ Submit completions

**Implementation:** Add observers via task permissions table

### 2. Team Lead / Manager Role
**Use Case:** Supervise multiple tasks without org admin privileges

**Permissions:**
- ✅ View all tasks in their team/group
- ✅ Edit tasks in their team
- ✅ Assign tasks to team members
- ✅ View all completions in team
- ❌ Delete tasks (admin only)
- ❌ Manage organization settings

**Implementation:** Introduce team/group hierarchy

### 3. Auditor Role
**Use Case:** Compliance review without modification rights

**Permissions:**
- ✅ View all tasks in organization
- ✅ View all completions and attachments
- ✅ View audit logs
- ❌ Edit anything
- ❌ Delete anything
- ❌ Create tasks

**Implementation:** Organization-level role, read-only everywhere

### 4. Limited Member
**Use Case:** Contractors or temporary workers with restricted access

**Permissions:**
- ✅ View only assigned tasks
- ✅ Submit completions for assigned tasks
- ❌ View other tasks
- ❌ Create new tasks
- ❌ View organization member list

**Implementation:** Organization role with restricted base permissions

### 5. Template Manager
**Use Case:** Create task templates without managing live tasks

**Permissions:**
- ✅ Create/edit/delete task templates
- ✅ View task templates
- ❌ Create actual tasks from templates
- ❌ View live tasks (unless assigned)

**Implementation:** Separate `task_template` resource type

---

## Database Schema Design

### New Tables

#### 1. `permissions` Table
Global permission definitions

```sql
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL,  -- 'task', 'organization', 'user', etc.
  action VARCHAR(50) NOT NULL,          -- 'view', 'edit', 'delete', 'assign', etc.
  name VARCHAR(100) NOT NULL,           -- 'view_task', 'edit_task', etc.
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource_type, action)
);
```

#### 2. `roles` Table
Custom roles per organization

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,           -- 'Team Lead', 'Observer', 'Auditor'
  description TEXT,
  is_system_role BOOLEAN DEFAULT FALSE, -- true for built-in roles
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, name)
);
```

#### 3. `role_permissions` Table
Maps roles to permissions

```sql
CREATE TABLE role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)
);
```

#### 4. `user_roles` Table
Assigns roles to users within organizations

```sql
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER REFERENCES users(id),
  UNIQUE(user_id, role_id, organization_id)
);
```

#### 5. `task_permissions` Table
Resource-level task permissions (creator, assignee, observer)

```sql
CREATE TABLE task_permissions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL,  -- 'creator', 'assignee', 'observer'
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(task_id, user_id, permission_type)
);
```

#### 6. `team_groups` Table (Optional - Future Enhancement)
Teams/groups within organizations

```sql
CREATE TABLE team_groups (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  parent_group_id INTEGER REFERENCES team_groups(id), -- For nested groups
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);
```

#### 7. `group_members` Table (Optional)
Team membership

```sql
CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES team_groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50),  -- 'member', 'lead'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);
```

---

## Permission Checking Logic

### Algorithm: Check Task Access

```typescript
async function canAccessTask(
  userId: number,
  taskId: number,
  action: 'view' | 'edit' | 'delete' | 'assign' | 'complete'
): Promise<boolean> {

  // 1. Check if user is super_admin (global access)
  const user = await getUserById(userId);
  if (user.role === 'super_admin') return true;

  // 2. Get task and organization
  const task = await getTaskById(taskId);
  const orgId = task.organization_id;

  // 3. Check if user is organization admin
  const orgMember = await getOrgMembership(userId, orgId);
  if (orgMember?.role === 'admin') {
    // Admins can do everything except maybe 'complete' (configurable)
    if (action === 'complete') {
      // Check org settings: allow_admin_complete
      return await getOrgSetting(orgId, 'allow_admin_complete');
    }
    return true;
  }

  // 4. Check task-level permissions
  const taskPerms = await getTaskPermissions(taskId, userId);

  // Permission matrix based on relationship type
  const permissionMatrix = {
    creator: {
      view: true,
      edit: true,
      delete: true,
      assign: true,
      complete: false  // or check org setting
    },
    assignee: {
      view: true,
      edit: false,
      delete: false,
      assign: false,
      complete: true
    },
    observer: {
      view: true,
      edit: false,
      delete: false,
      assign: false,
      complete: false
    }
  };

  // Check each permission type user has for this task
  for (const perm of taskPerms) {
    const permType = perm.permission_type; // 'creator', 'assignee', 'observer'
    if (permissionMatrix[permType]?.[action]) {
      return true;
    }
  }

  // 5. Check role-based permissions (future: custom roles)
  const userRoles = await getUserRoles(userId, orgId);
  for (const role of userRoles) {
    const hasPermission = await roleHasPermission(
      role.role_id,
      `${action}_task`
    );
    if (hasPermission) return true;
  }

  // 6. No access
  return false;
}
```

### Attachment/Completion Access

```typescript
async function canViewAttachments(
  userId: number,
  taskId: number
): Promise<boolean> {

  // 1. Super admin
  const user = await getUserById(userId);
  if (user.role === 'super_admin') return true;

  // 2. Org admin
  const task = await getTaskById(taskId);
  const orgMember = await getOrgMembership(userId, task.organization_id);
  if (orgMember?.role === 'admin') return true;

  // 3. Task permissions: creator or assignee only (NOT observer)
  const taskPerms = await getTaskPermissions(taskId, userId);
  const allowedTypes = ['creator', 'assignee'];

  return taskPerms.some(p => allowedTypes.includes(p.permission_type));
}
```

---

## API Middleware Implementation

### New Middleware Functions

```typescript
// backend/src/middleware/taskPermissions.ts

import { AuthRequest } from './auth';
import { Response, NextFunction } from 'express';

export const requireTaskAccess = (
  action: 'view' | 'edit' | 'delete' | 'assign' | 'complete'
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const taskId = parseInt(req.params.taskId || req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await canAccessTask(userId, taskId, action);

    if (!hasAccess) {
      return res.status(403).json({
        error: `You don't have permission to ${action} this task`
      });
    }

    next();
  };
};

// Usage in routes:
router.get('/tasks/:id',
  authenticateToken,
  requireTaskAccess('view'),
  taskController.getTask
);

router.put('/tasks/:id',
  authenticateToken,
  requireTaskAccess('edit'),
  taskController.updateTask
);

router.delete('/tasks/:id',
  authenticateToken,
  requireTaskAccess('delete'),
  taskController.deleteTask
);
```

---

## Migration Strategy

### Phase 1: Foundation (Week 1)
- Create new permission tables
- Seed basic permissions (view_task, edit_task, etc.)
- Create system roles (observer, auditor)
- Migrate existing data:
  - Task creators → `task_permissions` with type 'creator'
  - Task assignees → `task_permissions` with type 'assignee'

### Phase 2: Task Access Control (Week 2)
- Implement `canAccessTask()` function
- Add task permission middleware
- Update all task routes to use new middleware
- Add observer functionality to UI
- Test thoroughly

### Phase 3: Custom Roles (Week 3)
- Implement role management UI (admin dashboard)
- Allow creating custom roles per organization
- Role-permission assignment interface
- Test role-based access

### Phase 4: Teams/Groups (Future)
- Implement team hierarchy
- Team-based permissions
- Bulk task assignment to teams

---

## Configuration Options

Add to organization settings:

```typescript
interface OrganizationSettings {
  // ... existing settings

  // RBAC settings
  allow_admin_complete: boolean;        // Can admins submit completions?
  allow_creator_complete: boolean;       // Can creators complete own tasks?
  allow_observers: boolean;              // Enable observer role?
  default_task_visibility: 'private' | 'team' | 'organization';
  require_assignment: boolean;           // Must tasks be assigned?
}
```

---

## UI Changes Needed

### 1. Task Detail Page
- Show permission indicators (who can view/edit)
- "Add Observer" button for creators/admins
- Permission badge for current user's role on task

### 2. Task List
- Filter: "My Tasks" (assigned or created)
- Filter: "Observed Tasks"
- Visual indicators: creator icon, assignee icon

### 3. Admin Dashboard
- Role management interface
- Permission template editor
- Audit log for permission changes

### 4. Create Task Page
- "Add Observers" field (autocomplete users)
- Visibility setting (if enabled in org settings)

---

## Security Considerations

1. **Prevent Privilege Escalation**
   - Never let users grant themselves admin permissions
   - Only org admins can assign observers
   - Audit all permission changes

2. **Sensitive Data Protection**
   - Observers cannot see attachments/completions
   - Implement different permission levels for sensitive tasks
   - Add "confidential" flag to tasks

3. **Performance**
   - Cache permission checks (Redis)
   - Batch permission queries
   - Index task_permissions table properly

4. **Audit Trail**
   - Log all permission grants/revokes
   - Track who viewed sensitive completions
   - Maintain history of task access

---

## Edge Cases & Considerations

### 1. What if assignee is changed?
- Previous assignee loses access (unless observer)
- New assignee gains access automatically
- Log the change in audit trail

### 2. What if creator leaves organization?
- Tasks remain, but creator permission becomes "inactive"
- Org admin inherits creator permissions
- Or: reassign to another user

### 3. What if user has multiple roles?
- Check all roles, grant access if ANY role allows
- Union of permissions, not intersection

### 4. Bulk operations
- "Assign 50 tasks to team" - need efficient permission creation
- Use batch inserts for task_permissions

### 5. Cross-organization tasks? (Future)
- Not supported initially
- Would need organization_permissions table

---

## Testing Strategy

### Unit Tests
- Permission checking logic
- Each role's permission matrix
- Edge cases (deleted users, etc.)

### Integration Tests
- API endpoints with different user roles
- Middleware authorization checks
- Task CRUD with various permissions

### Performance Tests
- Permission check latency
- Bulk task creation with observers
- Cache effectiveness

---

## Rollout Plan

1. **Development (Local Docker)**
   - Implement all tables and middleware
   - Test with sample data
   - Ensure backward compatibility

2. **Staging**
   - Deploy to staging environment
   - Run migration scripts
   - Verify existing tasks still work

3. **Production**
   - Low-traffic window deployment
   - Run migrations with database backup
   - Monitor for permission errors
   - Rollback plan ready

---

## What We're NOT Missing

Based on your requirements and this design:

✅ Task visibility control (creator, assignee, admin, observer)
✅ Task modification control (creator, admin only)
✅ Attachment/completion visibility (excluding observers)
✅ Observer role for read-only access
✅ Organization-level roles
✅ Resource-level permissions
✅ Audit trail capability
✅ Flexible permission system for future growth
✅ Team/group support (planned)
✅ Custom roles per organization

## Next Steps

1. Review this design and confirm it meets requirements
2. Create database migration scripts
3. Implement permission checking functions
4. Update API middleware
5. Build admin UI for role management
6. Test thoroughly in Docker local environment
7. Document for future developers

---

**Questions for Consideration:**

1. Should creators be able to complete their own tasks? (currently: no, configurable)
2. Do we need task "visibility levels" (private/team/org-wide)?
3. Should observers be org-wide or per-task?
4. Do we want time-limited permissions (e.g., observer access expires)?
5. Should we support permission inheritance (parent task → subtasks)?
