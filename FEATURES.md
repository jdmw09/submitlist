# TaskManager - Complete Feature Documentation

**Version**: 2.2.0
**Last Updated**: November 22, 2025

---

## Table of Contents
1. [Authentication & User Management](#authentication--user-management)
2. [Admin Features](#admin-features)
3. [Organization Management](#organization-management)
4. [Task Management](#task-management)
5. [Email System](#email-system)
6. [Notifications](#notifications)
7. [File Management](#file-management)
8. [Security Features](#security-features)

---

## Authentication & User Management

### User Registration
- **Endpoint**: `POST /api/auth/register`
- **Features**:
  - Email validation
  - Password hashing (bcrypt)
  - Automatic email verification email sent
  - JWT token generation
  - Default role: member
- **Fields**:
  - email (required, unique)
  - password (required, min 6 chars)
  - name (required)
  - username (required, unique)

### User Login
- **Endpoint**: `POST /api/auth/login`
- **Features**:
  - Email OR username login
  - Password verification
  - JWT token generation (7-day expiration)
  - Includes user role in token
  - Returns email_verified status
- **Response** includes:
  - JWT token
  - User object (id, email, username, name, role, email_verified)

### Email Verification
- **Flow**:
  1. User registers → Verification email sent
  2. User clicks link in email → Token validated
  3. Email marked as verified
  4. Verification banner removed from UI

- **Endpoints**:
  - `POST /api/auth/resend-verification` - Resend verification email
  - `GET /api/auth/verify-email/:token` - Verify email with token
  - `GET /api/auth/verification-status` - Check verification status

- **Features**:
  - Crypto-secure 32-byte tokens
  - 24-hour token expiration
  - Rate limiting: 1 resend per 5 minutes per user
  - Single-use tokens

### Password Reset

**User-Initiated Reset**:
- **Flow**:
  1. User clicks "Forgot Password"
  2. Enters email → Reset link sent
  3. Clicks link → Validates token
  4. Sets new password
  5. Confirmation email sent

- **Endpoints**:
  - `POST /api/auth/forgot-password` - Request reset
  - `GET /api/auth/validate-reset-token/:token` - Validate token
  - `POST /api/auth/reset-password` - Reset with token

- **Features**:
  - Email enumeration protection (generic responses)
  - 1-hour token expiration
  - Rate limiting: 3 attempts per hour per user
  - Single-use tokens
  - IP address logging

**Admin-Initiated Reset**:
- Admin can force password reset for any user
- 24-hour token expiration
- Sets `force_password_change` flag
- Sends email to user with admin's name

### User Profile
- **Endpoint**: `GET /api/auth/profile`
- **Returns**:
  - Full user information
  - Email verification status
  - Account status
  - Role

---

## Admin Features

### Role-Based Access Control (RBAC)

**Roles** (hierarchical):
1. **member** - Standard user
2. **admin** - Organization admin, can manage members
3. **super_admin** - System admin, can manage everyone

**Permissions**:
- **Admin** can:
  - View all users
  - Suspend/activate members
  - Delete members (soft delete)
  - Promote members to admin
  - Force password reset for members
  - Manage user organizations
  - View audit logs

- **Admin CANNOT**:
  - Manage super_admins
  - Promote to super_admin
  - Modify their own role/status
  - Delete themselves

- **Super Admin** can:
  - All admin permissions
  - Manage other admins
  - Promote to super_admin
  - Full system access

### Admin Dashboard
- **Route**: `/admin`
- **Features**:
  - User list with pagination (20 per page)
  - Search by email, username, or name
  - Filter by role (member/admin/super_admin)
  - Filter by status (active/suspended/deleted)
  - User actions per row:
    - **Manage** - View/edit user details and organizations
    - **Suspend/Activate** - Toggle account status
    - **Reset PW** - Force password reset
    - **Delete** - Soft delete user
  - Link to audit logs
  - Role badges with color coding
  - Status indicators
  - Email verification status

### User Management Endpoints

**GET /api/admin/users**
- List all users with filtering and pagination
- Query params: search, role, status, page, limit
- Returns: users array, pagination metadata

**GET /api/admin/users/:id**
- Get user details by ID
- Returns: user info, organizations, recent admin actions

**PUT /api/admin/users/:id/role**
- Update user role (member/admin/super_admin)
- Permission checks enforced
- Logged in audit logs

**PUT /api/admin/users/:id/status**
- Update account status (active/suspended)
- Prevents self-suspension
- Logged in audit logs

**DELETE /api/admin/users/:id**
- Soft delete (sets account_status='deleted')
- Prevents self-deletion
- Logged in audit logs

**POST /api/admin/users/:id/force-password-reset**
- Force user to reset password
- Sends email to user
- Sets force_password_change flag
- Logged in audit logs

### Organization Management (Admin)

**GET /api/admin/organizations**
- List all organizations
- Returns: org list with member counts

**GET /api/admin/users/:id/organizations**
- Get user's organization memberships
- Returns: orgs with roles, join dates, member counts

**POST /api/admin/users/:id/organizations**
- Add user to organization
- Set role (member/admin)
- Prevents duplicate memberships
- Logged in audit logs

**DELETE /api/admin/users/:id/organizations/:orgId**
- Remove user from organization
- Logged in audit logs

**PUT /api/admin/users/:id/organizations/:orgId/role**
- Update user's role in organization
- Toggle between member and admin
- Logged in audit logs

### Admin User Detail Page
- **Route**: `/admin/users/:id`
- **Features**:
  - Complete user information
  - Organization memberships list
  - Add to organization (modal)
  - Promote/demote in organizations
  - Remove from organizations
  - Shows member counts and join dates
  - Back link to admin dashboard

### Audit Logs
- **Route**: `/admin/audit-logs`
- **Endpoint**: `GET /api/admin/audit-logs`
- **Features**:
  - Chronological list of all admin actions
  - Pagination (50 logs per page)
  - Shows:
    - Timestamp
    - Admin who performed action
    - Action type
    - Target user
    - IP address
    - Detailed action info (JSON)
  - Filterable by admin, target user, action type

**Logged Actions**:
- update_user_role
- active_user / suspended_user
- delete_user
- force_password_reset
- add_user_to_organization
- remove_user_from_organization
- update_user_organization_role

---

## Organization Management

### Organization Features
- Users can be members of multiple organizations
- Each organization has independent member list
- Role per organization (member/admin)
- Organization admins can manage organization members

### Organization Endpoints

**POST /api/organizations**
- Create new organization
- Fields: name, description, allowJoinRequests, isPublic

**GET /api/organizations**
- List user's organizations

**GET /api/organizations/:id**
- Get organization details
- Returns: org info, member count, creator

**GET /api/organizations/:id/members**
- List organization members
- Shows roles and join dates

**POST /api/organizations/:id/members**
- Add member to organization (by email)
- Org admin only

**PUT /api/organizations/:id/members/:memberId**
- Update member role
- Org admin only

**DELETE /api/organizations/:id/members/:memberId**
- Remove member from organization
- Org admin only

**PUT /api/organizations/:id**
- Update organization settings
- Org admin only

**DELETE /api/organizations/:id**
- Delete organization
- Creator only

### Join Requests
- Users can request to join organizations
- Org admins can approve/reject requests
- Endpoints: requests, approve, reject

---

## Task Management

### Task Creation
- **Endpoint**: `POST /api/tasks`
- **Features**:
  - Rich task details with markdown support
  - Multiple requirements (checkboxes)
  - File attachments
  - Video links (YouTube/Vimeo)
  - Assign to organization
  - Set task groups
  - Multiple assignees
  - Recurring tasks support

### Task Lifecycle
1. **Draft** - Created, not submitted
2. **Pending Review** - Submitted by assignee
3. **Approved** - Reviewed and approved
4. **Rejected** - Needs revision
5. **Completed** - Final state

### Task Features

**Requirements**:
- Multiple requirements per task
- Checkbox tracking
- Completion percentage
- Individual requirement status

**Completions**:
- Submit task completion
- Add proof (files, links, notes)
- Review system (approve/reject)
- Comments on completions

**Assignees**:
- Multiple users can be assigned
- Track individual progress
- Notification on assignment

**Task Groups**:
- Organize related tasks
- Group members auto-assigned
- Bulk operations

**Recurring Tasks**:
- Daily, weekly, monthly schedules
- Auto-generation
- Independent completion tracking

### Task Endpoints

**POST /api/tasks** - Create task
**GET /api/tasks** - List tasks (filtered by org, status)
**GET /api/tasks/:id** - Get task details
**PUT /api/tasks/:id** - Update task
**DELETE /api/tasks/:id** - Delete task
**PUT /api/tasks/requirements/:id** - Mark requirement complete
**POST /api/tasks/:id/completions** - Submit completion
**GET /api/tasks/:id/completions** - List completions
**DELETE /api/tasks/completions/:id** - Delete completion
**POST /api/tasks/:id/submit** - Submit for review
**POST /api/tasks/:id/review** - Review task (approve/reject)
**GET /api/tasks/:id/audit-logs** - View task history
**POST /api/tasks/:id/copy** - Copy task to create new task
**POST /api/tasks/:id/archive** - Archive task
**POST /api/tasks/:id/unarchive** - Unarchive task
**GET /api/tasks/organization/:orgId/archived** - Get archived tasks

---

## Task Sorting & Display (NEW - v2.2.0)

### Task Sorting
- **Sort by Due Date** (default): Tasks ordered by end_date ascending, null dates last
- **Sort by Priority**: Tasks ordered by status priority (overdue → in_progress → pending → submitted → completed)
- User can toggle between sort modes on task list
- Organization admins can set default sort order in settings

### Hide Completed Tasks
- Toggle to hide/show completed tasks on task list
- Reduces visual clutter when focusing on active work
- Setting persists per session, with org-level default

### Task Filtering
- **All Tasks**: View all organization tasks
- **My Tasks**: View only tasks assigned to current user
- **Archived**: Toggle to show archived tasks section

---

## Task Archive (NEW - v2.2.0)

### Manual Archive
- Any task can be archived by organization members
- Archived tasks are hidden from main task list
- Archived tasks can be unarchived at any time
- Archive status tracked via `archived_at` timestamp

### Auto-Archive
- Organization admins can enable automatic archiving
- **Archive After**: 1, 3, 7, 14, or 30 days after completion
- **Schedule Options**:
  - **Daily**: Runs at 1 AM every day
  - **Weekly (Sunday)**: Runs at 2 AM every Sunday
  - **Weekly (Monday)**: Runs at 2 AM every Monday
- Only archives tasks with `status = 'completed'`
- Cron-based background service (`archiveTaskService.ts`)

### Archive Endpoints
**POST /api/tasks/:id/archive** - Archive a task
**POST /api/tasks/:id/unarchive** - Restore archived task
**GET /api/tasks/organization/:orgId/archived** - List archived tasks

---

## Organization Settings (NEW - v2.2.0)

### Task Display Settings
Organization admins can configure default task display preferences:

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| default_task_sort | due_date, priority | due_date | Default sort order for task list |
| hide_completed_tasks | true, false | false | Hide completed tasks by default |
| auto_archive_enabled | true, false | false | Enable automatic task archiving |
| auto_archive_after_days | 1, 3, 7, 14, 30 | 7 | Days after completion to archive |
| archive_schedule | daily, weekly_sunday, weekly_monday | daily | When auto-archive runs |

### Settings Endpoints
**GET /api/organizations/:id/settings** - Get organization settings
**PUT /api/organizations/:id/settings** - Update settings (admin only)

### Settings UI
- Web: Organization Settings page with Task Settings section
- Mobile: Organization Settings screen with Task Settings section
- Only visible to organization admins

---

## Task Copy (NEW - v2.2.0)

### Copy Task Feature
- Create a new task from an existing task
- Copies: title, details, requirements, schedule settings
- Optional: new title, new due date, new assignees, new group
- Useful for recurring workflows and task templates

### Copy Endpoint
**POST /api/tasks/:id/copy**
```json
{
  "title": "New Task Title (optional)",
  "endDate": "2025-12-31 (optional)",
  "assignedUserIds": [1, 2, 3] (optional),
  "groupId": 5 (optional)
}
```

---

## Email System

### Email Service (Mailgun)
- **Provider**: Mailgun
- **Domain**: submitlist.space
- **From**: noreply@submitlist.space
- **API Key**: Configured in .env
- **Limit**: 1,000 emails/month (free tier, first 3 months)

### Email Templates

**1. Email Verification**
- Sent on user registration
- Contains verification link with 24-hour token
- HTML and plain text versions

**2. Password Reset (User-Initiated)**
- Sent when user requests reset
- Contains reset link with 1-hour token
- Generic messaging (email enumeration protection)

**3. Password Reset (Admin-Initiated)**
- Sent when admin forces reset
- Includes admin's name
- Contains reset link with 24-hour token

**4. Password Changed Confirmation**
- Sent after successful password change
- Security notification
- No action required

**5. Email Verified Confirmation**
- Sent after email verification
- Welcome message
- Instructions for next steps

### Email Features
- HTML + Plain text fallback
- Branded templates
- Tracking (opens, clicks) via Mailgun
- Delivery status monitoring
- Async sending (non-blocking)
- Error logging

---

## Notifications

### Notification System
- **Endpoint**: `GET /api/notifications`
- **Features**:
  - Real-time in-app notifications
  - Mark as read/unread
  - Bulk mark all as read
  - Delete notifications
  - Filter by read status

### Notification Types
- Task assignment
- Task completion
- Task approval/rejection
- Organization invitation
- Join request (pending approval)
- Join request (approved/rejected)
- Role change in organization
- Admin actions (suspension, etc.)

### Notification Endpoints
**GET /api/notifications** - List notifications  
**PUT /api/notifications/:id/read** - Mark as read  
**PUT /api/notifications/read-all** - Mark all as read  
**DELETE /api/notifications/:id** - Delete notification

---

## File Management

### File Upload
- **Max Size**: 10MB per file
- **Location**: `./uploads/`
- **Supported**: Images, documents, videos
- **Security**: 
  - File type validation
  - Size limits
  - Secure file names
  - Access control

### File Features
- Attach to tasks
- Attach to task completions
- Compression for images
- Auto-generated thumbnails
- Secure downloads
- Deletion on task/completion delete

---

## Security Features

### Authentication Security
- ✅ Bcrypt password hashing (10 rounds)
- ✅ JWT tokens with expiration (7 days)
- ✅ Secure token generation (crypto.randomBytes)
- ✅ Single-use verification/reset tokens
- ✅ Token expiration enforcement

### Authorization
- ✅ Role-based access control (RBAC)
- ✅ Middleware authentication checks
- ✅ Permission validation per endpoint
- ✅ Self-modification prevention
- ✅ Organization-level permissions

### Rate Limiting
- ✅ Password reset: 3 attempts/hour per user
- ✅ Email verification resend: 1 per 5 minutes
- ✅ Login attempts: Standard rate limits

### Data Protection
- ✅ Email enumeration protection
- ✅ Soft deletion (account_status='deleted')
- ✅ Audit logging with IP addresses
- ✅ HTTPS/SSL enforcement
- ✅ Secure headers (HSTS, X-Frame-Options, etc.)

### Audit Trail
- ✅ All admin actions logged
- ✅ IP address tracking
- ✅ Detailed action metadata (JSON)
- ✅ Immutable log entries
- ✅ Queryable audit history

### Security Headers (Nginx)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

---

## UI/UX Features

### Design System
- **Themes**: Light mode, Dark mode
- **Colors**: CSS variables for consistency
- **Typography**: System fonts, accessible
- **Spacing**: 8px grid system
- **Components**: Reusable buttons, forms, cards

### Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation
- Screen reader support
- Color contrast ratios
- ARIA labels

### Responsive Design
- Mobile-first approach
- Breakpoints: 768px, 1024px, 1440px
- Touch-friendly interactions
- Adaptive layouts

### User Experience
- Loading states
- Error messages
- Success confirmations
- Empty states
- Pagination
- Search and filters
- Modal dialogs
- Toast notifications

---

## Feature Status

### ✅ Fully Implemented
- User authentication (register, login)
- Email verification
- Password reset (user + admin)
- Admin dashboard
- User management (roles, status, deletion)
- Organization management (admin)
- Multi-organization membership
- Task creation and management
- Task completions and reviews
- **Task sorting (due date/priority)** (v2.2.0)
- **Task archive (manual + auto)** (v2.2.0)
- **Task copy** (v2.2.0)
- **Organization task settings** (v2.2.0)
- Audit logging
- Email system (Mailgun)
- Notifications
- File uploads
- SSL/HTTPS
- Dark mode
- Responsive design

### 🚧 In Development
- None (v2.2.0 complete)

### 📋 Planned Features
- Two-factor authentication (2FA)
- Advanced task analytics
- Task templates
- Bulk operations
- Export data (CSV, PDF)
- Advanced search
- Custom user roles
- Webhooks
- API rate limiting
- Activity feed
- Task priority levels (high/medium/low)
