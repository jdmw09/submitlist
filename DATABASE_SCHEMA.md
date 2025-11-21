# TaskManager - Database Schema Documentation

**Version**: 2.0.0
**Database**: PostgreSQL 15
**Last Updated**: November 20, 2025

---

## Table of Contents
1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Tables](#tables)
4. [Indexes](#indexes)
5. [Relationships](#relationships)
6. [Migrations](#migrations)

---

## Overview

The TaskManager database uses PostgreSQL with a normalized relational schema. It supports:
- Multi-organization membership (users can belong to multiple organizations)
- Role-based access control (RBAC) at both system and organization levels
- Task management with multi-assignee support
- Audit logging for both admin actions and task operations
- Email verification and password reset workflows

**Total Tables**: 17
**Total Indexes**: 40+

---

## Entity Relationship Diagram

```
┌─────────────┐
│   users     │──┐
└─────────────┘  │
      │          │
      │ (1:N)    │
      │          │
┌─────────────────────────┐       ┌──────────────────┐
│ organization_members    │───────│  organizations   │
└─────────────────────────┘ (N:1) └──────────────────┘
      │                                   │
      │                                   │ (1:N)
      │                            ┌──────┴──────┐
      │                            │             │
      │                     ┌──────────┐  ┌──────────┐
      │                     │  tasks   │  │  groups  │
      │                     └──────────┘  └──────────┘
      │                            │
      │                     ┌──────┴──────┬──────────┐
      │                     │             │          │
      │              ┌─────────────┐ ┌────────┐ ┌────────┐
      │              │ task_       │ │ task_  │ │ task_  │
      │              │ assignees   │ │ reqs   │ │ comps  │
      │              └─────────────┘ └────────┘ └────────┘
      │
┌─────────────────────┐
│ notifications       │
│ admin_audit_logs    │
│ task_audit_logs     │
│ email_verification  │
│ password_reset      │
└─────────────────────┘
```

---

## Tables

### 1. users

**Purpose**: Stores all user accounts with authentication credentials and profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing user ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User's email address (login) |
| username | VARCHAR(50) | UNIQUE | Optional username (login) |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| name | VARCHAR(255) | NOT NULL | User's display name |
| role | VARCHAR(20) | DEFAULT 'member' | System role: member, admin, super_admin |
| email_verified | BOOLEAN | DEFAULT false | Email verification status |
| email_verified_at | TIMESTAMP | NULL | When email was verified |
| force_password_change | BOOLEAN | DEFAULT false | User must reset password on next login |
| last_password_change | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last password change date |
| account_status | VARCHAR(20) | DEFAULT 'active' | Account status: active, suspended, deleted |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |

**Indexes**:
- `idx_users_username` ON username
- `idx_users_role` ON role
- `idx_users_email_verified` ON email_verified
- `idx_users_account_status` ON account_status

**Notes**:
- Email and username are both unique and can be used for login
- Password is hashed with bcrypt (10 rounds)
- Soft deletion via `account_status='deleted'`

---

### 2. organizations

**Purpose**: Organization/workspace entities that group users and tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing org ID |
| name | VARCHAR(255) | NOT NULL | Organization name |
| description | TEXT | NULL | Optional description |
| allow_join_requests | BOOLEAN | DEFAULT true | Allow users to request membership |
| is_public | BOOLEAN | DEFAULT false | Public organizations visible to all |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Organization creation timestamp |

**Indexes**:
- `idx_organizations_public` ON is_public

**Notes**:
- Organizations are the top-level entity for task management
- Users can belong to multiple organizations
- No explicit creator_id (determined by first admin member)

---

### 3. organization_members

**Purpose**: Junction table linking users to organizations with roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing membership ID |
| organization_id | INTEGER | FK(organizations.id), NOT NULL | Reference to organization |
| user_id | INTEGER | FK(users.id), NOT NULL | Reference to user |
| role | VARCHAR(50) | NOT NULL, DEFAULT 'member' | Org role: admin or member |
| joined_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Membership creation timestamp |
| UNIQUE(organization_id, user_id) | | UNIQUE CONSTRAINT | Prevent duplicate memberships |

**Indexes**:
- `idx_organization_members_org_id` ON organization_id
- `idx_organization_members_user_id` ON user_id

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting organization removes all memberships
- ON DELETE CASCADE: Deleting user removes all their memberships

**Notes**:
- UNIQUE constraint allows users to be in multiple orgs
- Each user can only be in each org once
- Org admins can manage org members (not system-level permission)

---

### 4. organization_invites

**Purpose**: Invite codes for joining organizations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing invite ID |
| organization_id | INTEGER | FK(organizations.id), NOT NULL | Reference to organization |
| invite_code | VARCHAR(32) | UNIQUE, NOT NULL | Unique invite code |
| created_by_id | INTEGER | FK(users.id) | User who created invite |
| email | VARCHAR(255) | NULL | Optional specific email restriction |
| role | VARCHAR(20) | DEFAULT 'member' | Role granted on join |
| expires_at | TIMESTAMP | NULL | Optional expiration |
| used_by_id | INTEGER | FK(users.id) | User who used invite |
| used_at | TIMESTAMP | NULL | When invite was used |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Invite creation timestamp |
| max_uses | INTEGER | DEFAULT 1 | Maximum times invite can be used |
| use_count | INTEGER | DEFAULT 0 | Times invite has been used |
| is_active | BOOLEAN | DEFAULT true | Invite active status |

**Indexes**:
- `idx_organization_invites_code` ON invite_code
- `idx_organization_invites_org` ON organization_id
- `idx_organization_invites_email` ON email
- `idx_organization_invites_active` ON is_active

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting organization removes all invites

---

### 5. organization_join_requests

**Purpose**: User requests to join organizations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing request ID |
| organization_id | INTEGER | FK(organizations.id), NOT NULL | Reference to organization |
| user_id | INTEGER | FK(users.id), NOT NULL | User requesting to join |
| status | VARCHAR(20) | DEFAULT 'pending' | pending, approved, rejected |
| message | TEXT | NULL | User's join request message |
| response_message | TEXT | NULL | Admin's response message |
| reviewed_by_id | INTEGER | FK(users.id) | Admin who reviewed |
| reviewed_at | TIMESTAMP | NULL | When request was reviewed |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Request creation timestamp |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |
| UNIQUE(organization_id, user_id) | | UNIQUE CONSTRAINT | One pending request per user/org |

**Indexes**:
- `idx_join_requests_org` ON organization_id
- `idx_join_requests_user` ON user_id
- `idx_join_requests_status` ON status

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting organization removes all requests
- ON DELETE CASCADE: Deleting user removes their requests

---

### 6. task_groups

**Purpose**: Groups of users within organizations for task assignment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing group ID |
| organization_id | INTEGER | FK(organizations.id), NOT NULL | Reference to organization |
| name | VARCHAR(255) | NOT NULL | Group name |
| description | TEXT | NULL | Optional description |
| created_by_id | INTEGER | FK(users.id) | User who created group |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Group creation timestamp |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_task_groups_org` ON organization_id

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting organization removes all groups

---

### 7. task_group_members

**Purpose**: Junction table linking users to task groups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing membership ID |
| group_id | INTEGER | FK(task_groups.id), NOT NULL | Reference to group |
| user_id | INTEGER | FK(users.id), NOT NULL | Reference to user |
| added_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Membership creation timestamp |
| UNIQUE(group_id, user_id) | | UNIQUE CONSTRAINT | Prevent duplicate memberships |

**Indexes**:
- `idx_task_group_members_group` ON group_id
- `idx_task_group_members_user` ON user_id

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting group removes all memberships
- ON DELETE CASCADE: Deleting user removes their group memberships

---

### 8. tasks

**Purpose**: Core task entity with scheduling and assignment information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing task ID |
| organization_id | INTEGER | FK(organizations.id), NOT NULL | Reference to organization |
| title | VARCHAR(255) | NOT NULL | Task title |
| details | TEXT | NULL | Detailed task description |
| assigned_user_id | INTEGER | FK(users.id) | DEPRECATED: Single assignee |
| created_by_id | INTEGER | FK(users.id), NOT NULL | User who created task |
| start_date | TIMESTAMP | NULL | Task start date |
| end_date | TIMESTAMP | NULL | Task due date |
| schedule_type | VARCHAR(50) | NOT NULL, DEFAULT 'one_time' | one_time, daily, weekly, monthly |
| schedule_frequency | INTEGER | DEFAULT 1 | Frequency (e.g., every 2 days) |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'pending' | pending, in_progress, submitted, completed, overdue |
| parent_template_id | INTEGER | FK(tasks.id) | For recurring task instances |
| is_private | BOOLEAN | DEFAULT false | Private tasks visible to creator only |
| group_id | INTEGER | FK(task_groups.id) | Optional group assignment |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Task creation timestamp |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_tasks_organization_id` ON organization_id
- `idx_tasks_assigned_user_id` ON assigned_user_id
- `idx_tasks_status` ON status
- `idx_tasks_schedule_type` ON schedule_type
- `idx_tasks_creator` ON created_by_id
- `idx_tasks_group` ON group_id
- `idx_tasks_private` ON is_private

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting organization removes all tasks
- ON DELETE CASCADE: Deleting task creator removes tasks
- ON DELETE SET NULL: Deleting assigned user sets field to NULL
- ON DELETE SET NULL: Deleting parent template removes link

**Notes**:
- `assigned_user_id` is deprecated; use task_assignees table instead
- Recurring tasks reference parent template via `parent_template_id`
- Status flow: pending → in_progress → submitted → completed

---

### 9. task_assignees

**Purpose**: Multi-assignee support for tasks (replaces single assigned_user_id).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing assignment ID |
| task_id | INTEGER | FK(tasks.id), NOT NULL | Reference to task |
| user_id | INTEGER | FK(users.id), NOT NULL | Reference to assignee |
| assigned_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Assignment timestamp |
| assigned_by_id | INTEGER | FK(users.id) | User who assigned |
| status | VARCHAR(20) | DEFAULT 'pending' | Individual assignee status |
| completed_at | TIMESTAMP | NULL | When assignee completed task |
| UNIQUE(task_id, user_id) | | UNIQUE CONSTRAINT | User can only be assigned once |

**Indexes**:
- `idx_task_assignees_task` ON task_id
- `idx_task_assignees_user` ON user_id
- `idx_task_assignees_status` ON status

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting task removes all assignments
- ON DELETE CASCADE: Deleting user removes their assignments

---

### 10. task_requirements

**Purpose**: Checklist items/requirements for task completion.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing requirement ID |
| task_id | INTEGER | FK(tasks.id), NOT NULL | Reference to task |
| description | TEXT | NOT NULL | Requirement description |
| order_index | INTEGER | NOT NULL, DEFAULT 0 | Display order |
| completed | BOOLEAN | DEFAULT false | Completion status |
| completed_at | TIMESTAMP | NULL | When requirement was completed |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Requirement creation timestamp |

**Indexes**:
- `idx_task_requirements_task_id` ON task_id

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting task removes all requirements

---

### 11. task_completions

**Purpose**: Stores evidence of task completion (files, text, videos).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing completion ID |
| task_id | INTEGER | FK(tasks.id), NOT NULL | Reference to task |
| requirement_id | INTEGER | FK(task_requirements.id) | Optional requirement link |
| user_id | INTEGER | FK(users.id), NOT NULL | User submitting completion |
| completion_type | VARCHAR(50) | NOT NULL | text, image, video |
| text_content | TEXT | NULL | Text proof/notes |
| file_path | VARCHAR(500) | NULL | Path to uploaded file |
| completed_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Completion submission timestamp |

**Indexes**:
- `idx_task_completions_task_id` ON task_id

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting task removes all completions
- ON DELETE CASCADE: Deleting user removes their completions
- ON DELETE SET NULL: Deleting requirement removes link

---

### 12. task_reviews

**Purpose**: Task creator feedback on submitted tasks (approve/reject).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing review ID |
| task_id | INTEGER | FK(tasks.id), NOT NULL | Reference to task |
| reviewer_id | INTEGER | FK(users.id), NOT NULL | User reviewing task |
| action | VARCHAR(50) | NOT NULL | approved or rejected |
| comments | TEXT | NULL | Reviewer comments |
| reviewed_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Review timestamp |

**Indexes**:
- `idx_task_reviews_task_id` ON task_id
- `idx_task_reviews_reviewer_id` ON reviewer_id

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting task removes all reviews
- ON DELETE CASCADE: Deleting reviewer removes their reviews

---

### 13. notifications

**Purpose**: In-app notifications for task and organization events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing notification ID |
| user_id | INTEGER | FK(users.id), NOT NULL | Recipient user |
| type | VARCHAR(50) | NOT NULL | Notification type (see below) |
| title | VARCHAR(255) | NOT NULL | Notification title |
| message | TEXT | NULL | Notification message |
| task_id | INTEGER | FK(tasks.id) | Optional task reference |
| read | BOOLEAN | DEFAULT false | Read status |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Notification creation timestamp |

**Notification Types**:
- task_assigned
- task_due_soon
- task_completed
- task_overdue
- task_submitted
- task_approved
- task_rejected

**Indexes**:
- `idx_notifications_user_id` ON user_id
- `idx_notifications_read` ON read

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting user removes all their notifications
- ON DELETE CASCADE: Deleting task removes related notifications

---

### 14. task_audit_logs

**Purpose**: Audit trail for all task-related actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing log ID |
| task_id | INTEGER | FK(tasks.id), NOT NULL | Reference to task |
| user_id | INTEGER | FK(users.id), NOT NULL | User performing action |
| action | VARCHAR(100) | NOT NULL | Action type (see below) |
| entity_type | VARCHAR(50) | NULL | task, requirement, completion, review |
| entity_id | INTEGER | NULL | ID of affected entity |
| changes | JSONB | NULL | Before/after values for updates |
| metadata | JSONB | NULL | Additional context (IP, user agent) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Log entry timestamp |

**Action Types**:
- created
- updated
- deleted
- assigned
- status_changed
- submitted
- approved
- rejected
- requirement_added
- requirement_completed
- completion_added
- completion_deleted

**Indexes**:
- `idx_audit_logs_task_id` ON task_id
- `idx_audit_logs_user_id` ON user_id
- `idx_audit_logs_action` ON action
- `idx_audit_logs_created_at` ON created_at DESC

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting task removes all audit logs
- ON DELETE CASCADE: Deleting user removes their audit logs

---

### 15. email_verification_tokens

**Purpose**: Stores email verification tokens for new user signups.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing token ID |
| user_id | INTEGER | FK(users.id), NOT NULL | Reference to user |
| token | VARCHAR(64) | UNIQUE, NOT NULL | Crypto-secure token (32 bytes hex) |
| expires_at | TIMESTAMP | NOT NULL | Token expiration (24 hours) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Token creation timestamp |
| used_at | TIMESTAMP | NULL | When token was used |
| is_valid | BOOLEAN | DEFAULT true | Token validity status |

**Indexes**:
- `idx_email_verification_tokens_token` ON token
- `idx_email_verification_tokens_user` ON user_id
- `idx_email_verification_tokens_expires` ON expires_at

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting user removes their verification tokens

**Notes**:
- Tokens are crypto-secure 32-byte random values
- 24-hour expiration window
- Single-use tokens (marked invalid after use)
- Rate limiting: 1 resend per 5 minutes

---

### 16. password_reset_tokens

**Purpose**: Stores password reset tokens for user and admin-initiated resets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing token ID |
| user_id | INTEGER | FK(users.id), NOT NULL | Reference to user |
| token | VARCHAR(64) | UNIQUE, NOT NULL | Crypto-secure token (32 bytes hex) |
| expires_at | TIMESTAMP | NOT NULL | Token expiration (1 hour user, 24 hours admin) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Token creation timestamp |
| used_at | TIMESTAMP | NULL | When token was used |
| is_valid | BOOLEAN | DEFAULT true | Token validity status |
| created_by_admin_id | INTEGER | FK(users.id) | NULL if user-initiated |
| ip_address | VARCHAR(45) | NULL | IP address of requester |

**Indexes**:
- `idx_password_reset_tokens_token` ON token
- `idx_password_reset_tokens_user` ON user_id
- `idx_password_reset_tokens_expires` ON expires_at

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting user removes their reset tokens

**Notes**:
- User-initiated: 1-hour expiration, rate limit 3/hour
- Admin-initiated: 24-hour expiration, no rate limit
- Single-use tokens
- IP address logged for security auditing

---

### 17. admin_audit_logs

**Purpose**: Comprehensive audit log for all admin actions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing log ID |
| admin_id | INTEGER | FK(users.id), NOT NULL | Admin performing action |
| action | VARCHAR(100) | NOT NULL | Action type (see below) |
| target_user_id | INTEGER | FK(users.id) | Target user (if applicable) |
| target_organization_id | INTEGER | FK(organizations.id) | Target org (if applicable) |
| details | JSONB | NULL | Additional action details |
| ip_address | VARCHAR(45) | NULL | Admin's IP address |
| user_agent | TEXT | NULL | Admin's user agent |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Log entry timestamp |

**Action Types**:
- update_user_role
- active_user
- suspended_user
- delete_user
- force_password_reset
- add_user_to_organization
- remove_user_from_organization
- update_user_organization_role
- verify_email
- transfer_org_ownership

**Indexes**:
- `idx_admin_audit_logs_admin` ON admin_id
- `idx_admin_audit_logs_action` ON action
- `idx_admin_audit_logs_target_user` ON target_user_id
- `idx_admin_audit_logs_created` ON created_at DESC

**Cascade Behavior**:
- ON DELETE CASCADE: Deleting admin removes their audit logs
- ON DELETE SET NULL: Deleting target user/org preserves log

**Notes**:
- Immutable logs (no updates or deletes)
- JSONB details field stores action-specific context
- IP address and user agent for security tracking

---

## Indexes

### Performance Indexes
All foreign keys have indexes for efficient JOIN operations.

### Lookup Indexes
- `users.username` - Login lookups
- `users.email` - Implicit via UNIQUE constraint
- `users.role` - Admin dashboard filtering
- `users.account_status` - Active user queries
- `organizations.is_public` - Public org discovery

### Query Optimization Indexes
- `notifications.read` - Unread notification queries
- `tasks.status` - Task filtering by status
- `tasks.schedule_type` - Recurring task queries
- `task_assignees.status` - Individual assignee progress

### Audit Indexes
- `admin_audit_logs.created_at DESC` - Recent logs first
- `task_audit_logs.created_at DESC` - Recent logs first
- `admin_audit_logs.action` - Action type filtering
- `task_audit_logs.action` - Action type filtering

---

## Relationships

### One-to-Many (1:N)
- users → tasks (created_by_id)
- users → task_reviews (reviewer_id)
- users → notifications
- users → task_audit_logs
- users → admin_audit_logs
- organizations → tasks
- organizations → task_groups
- organizations → organization_invites
- organizations → organization_join_requests
- tasks → task_requirements
- tasks → task_completions
- tasks → task_reviews
- tasks → task_audit_logs
- task_groups → task_group_members

### Many-to-Many (N:M)
- users ↔ organizations (via organization_members)
- users ↔ tasks (via task_assignees)
- users ↔ task_groups (via task_group_members)

### Self-Referential
- tasks → tasks (parent_template_id for recurring tasks)

### Optional References
- tasks.assigned_user_id → users (deprecated)
- tasks.group_id → task_groups
- task_completions.requirement_id → task_requirements
- password_reset_tokens.created_by_admin_id → users

---

## Migrations

### Migration History

#### 001_initial_schema.sql (Base Schema)
**Date**: Initial deployment
**Tables Created**:
- organizations
- users
- organization_members
- organization_invites
- organization_join_requests
- task_groups
- task_group_members
- tasks
- task_assignees
- task_requirements
- task_completions
- notifications
- task_audit_logs

#### 002_add_task_reviews.sql
**Date**: Early development
**Tables Created**:
- task_reviews

**Changes**:
- Added task review/approval workflow
- Added indexes for task_reviews

#### 003_admin_and_verification.sql
**Date**: November 20, 2025
**Tables Created**:
- email_verification_tokens
- password_reset_tokens
- admin_audit_logs

**Columns Added to users**:
- role (member/admin/super_admin)
- email_verified
- email_verified_at
- force_password_change
- last_password_change
- account_status

**Data Migration**:
- Auto-verified all existing users
- Set last_password_change to created_at for existing users

#### 004_create_super_admin.sql
**Date**: November 20, 2025
**Purpose**: Template for promoting first super admin
**Note**: Contains commented SQL for manual execution

---

## Database Best Practices

### Security
- All passwords stored as bcrypt hashes (10 rounds)
- Tokens use crypto-secure random generation (32 bytes)
- Soft deletion prevents accidental data loss
- Audit logs are immutable
- IP address tracking for security events

### Performance
- Foreign keys indexed for JOIN performance
- Composite UNIQUE constraints prevent duplicates
- JSONB for flexible metadata storage
- Timestamps with indexes for time-based queries
- CASCADE deletes for referential integrity

### Data Integrity
- NOT NULL constraints on required fields
- UNIQUE constraints on email, username, invite codes
- Foreign key constraints with appropriate CASCADE rules
- Default values for boolean and timestamp fields
- Check constraints via application logic

### Scalability Considerations
- Indexed foreign keys for large datasets
- JSONB for extensible metadata
- Soft deletion preserves audit trail
- Partition-ready timestamp fields
- Minimal table locking (SERIAL vs. UUID trade-off)

---

## Common Queries

### Get User's Organizations
```sql
SELECT o.*, om.role, om.joined_at,
       (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id) as member_count
FROM organizations o
JOIN organization_members om ON o.id = om.organization_id
WHERE om.user_id = $1
ORDER BY om.joined_at DESC;
```

### Get User's Tasks (Multi-assignee)
```sql
SELECT DISTINCT t.*
FROM tasks t
LEFT JOIN task_assignees ta ON t.id = ta.task_id
WHERE t.organization_id = $1
  AND (ta.user_id = $2 OR t.created_by_id = $2)
ORDER BY t.created_at DESC;
```

### Get Admin Audit Logs
```sql
SELECT aal.*,
       u_admin.name as admin_name,
       u_admin.email as admin_email,
       u_target.name as target_user_name,
       u_target.email as target_user_email
FROM admin_audit_logs aal
JOIN users u_admin ON aal.admin_id = u_admin.id
LEFT JOIN users u_target ON aal.target_user_id = u_target.id
ORDER BY aal.created_at DESC
LIMIT 50;
```

### Get Task Completion Progress
```sql
SELECT t.id, t.title,
       COUNT(tr.id) as total_requirements,
       COUNT(tr.id) FILTER (WHERE tr.completed = true) as completed_requirements,
       ROUND(100.0 * COUNT(tr.id) FILTER (WHERE tr.completed = true) / NULLIF(COUNT(tr.id), 0), 2) as completion_percentage
FROM tasks t
LEFT JOIN task_requirements tr ON t.id = tr.task_id
WHERE t.id = $1
GROUP BY t.id;
```

---

## Connection Details

### Development
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=taskmanager
DB_PASSWORD=taskmanager_dev
```

### Production
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=taskmanager
DB_PASSWORD=taskmanager_prod_pass_2024
```

### Connection String Format
```
postgresql://taskmanager:password@localhost:5432/taskmanager
```

---

## Backup and Restore

### Backup
```bash
PGPASSWORD='password' pg_dump -U taskmanager taskmanager > backup.sql
```

### Restore
```bash
PGPASSWORD='password' psql -U taskmanager taskmanager < backup.sql
```

### Automated Backups
Production server has automated daily backups in `/home/taskmanager/backups/`
