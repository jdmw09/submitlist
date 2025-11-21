# TaskManager Deployment Guide - Admin Features Update

## Overview
This guide covers deploying the new admin features, email verification, and password reset functionality to production.

## What's New

### Backend Changes
- **Admin Role System**: JWT now includes user role, middleware for admin access control
- **Email Verification**: Complete backend with token generation, validation, and rate limiting
- **Password Reset**: User-initiated and admin-initiated password reset flows
- **Admin User Management**: Full CRUD operations for user management
- **Audit Logging**: All admin actions are logged with IP addresses
- **Mailgun Integration**: Switched from SendGrid to Mailgun for email delivery

### Frontend Changes
- **Email Verification UI**: Verification page and banner for unverified users
- **Password Reset UI**: Forgot password and reset password pages
- **Admin Dashboard**: Complete admin panel with user management
- **Audit Logs Page**: View all admin actions
- **Admin Navigation**: Admin link in navbar (visible only to admin users)
- **UI Fix**: Requirements textarea now matches details textarea styling

### Database Changes
- New columns in `users` table: `role`, `email_verified`, `account_status`, etc.
- New tables: `email_verification_tokens`, `password_reset_tokens`, `admin_audit_logs`
- Migration file: `003_admin_and_verification.sql`

## Deployment Steps

### Step 1: Backup Current Database

```bash
ssh root@submitlist.space
PGPASSWORD='taskmanager123' pg_dump -U taskmanager taskmanager > /root/backup-$(date +%Y%m%d-%H%M%S).sql
```

### Step 2: Transfer Files to Server

From your local machine (from the TaskManager directory):

```bash
# Transfer backend dist files
scp -r backend/dist root@submitlist.space:/root/TaskManager/backend/

# Transfer backend dependencies
scp backend/package.json backend/package-lock.json root@submitlist.space:/root/TaskManager/backend/

# Transfer migration files
scp -r backend/src/database/migrations root@submitlist.space:/root/TaskManager/backend/src/database/

# Transfer frontend build
scp -r web/build/* root@submitlist.space:/var/www/submitlist.space/html/
```

### Step 3: Install Backend Dependencies

```bash
ssh root@submitlist.space
cd /root/TaskManager/backend
npm install
```

### Step 4: Run Database Migration

```bash
# On the server
cd /root/TaskManager/backend
PGPASSWORD='taskmanager123' psql -U taskmanager -d taskmanager -f src/database/migrations/003_admin_and_verification.sql
```

Expected output: The migration will add new columns and tables. Ignore "already exists" errors if re-running.

### Step 5: Update Environment Variables

```bash
# On the server
cat > /root/TaskManager/backend/.env << 'EOF'
# Database
DATABASE_URL=postgresql://taskmanager:taskmanager123@localhost:5432/taskmanager

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=submitlist.space
FROM_EMAIL=noreply@submitlist.space
FROM_NAME=TaskManager
APP_URL=https://submitlist.space
EOF
```

### Step 6: Restart Backend Service

```bash
# On the server
cd /root/TaskManager/backend
pm2 restart taskmanager-backend

# Or if not running, start it
pm2 start dist/index.js --name taskmanager-backend

# Save PM2 configuration
pm2 save
```

### Step 7: Verify Deployment

```bash
# Check backend health
curl http://localhost:3000/health

# Check PM2 status
pm2 status

# View logs
pm2 logs taskmanager-backend --lines 50
```

### Step 8: Create Super Admin User

After deployment, promote your first user to super_admin:

```bash
# On the server
PGPASSWORD='taskmanager123' psql -U taskmanager -d taskmanager

# In psql prompt:
UPDATE users SET role = 'super_admin' WHERE email = 'your-email@example.com';
\q
```

Replace `your-email@example.com` with your actual email address.

### Step 9: Test Admin Features

1. **Log in** to https://submitlist.space
2. **Check Admin Link**: You should see "Admin" in the navigation bar
3. **Access Admin Dashboard**: Click Admin to view all users
4. **Test Email Features**:
   - Register a new user - should receive verification email
   - Click "Forgot Password" - should receive reset email
   - Admin → Force Password Reset - user should receive admin reset email

## Verification Checklist

- [ ] Backend is running: `curl http://localhost:3000/health`
- [ ] Frontend loads: https://submitlist.space
- [ ] Login works
- [ ] Admin link appears for admin users
- [ ] Admin dashboard accessible at https://submitlist.space/admin
- [ ] Email verification emails are being sent
- [ ] Password reset emails are being sent
- [ ] Audit logs are recording admin actions

## Troubleshooting

### Backend won't start
```bash
# Check PM2 logs
pm2 logs taskmanager-backend

# Check for syntax errors
cd /root/TaskManager/backend
node dist/index.js
```

### Emails not sending
```bash
# Check backend logs for Mailgun errors
pm2 logs taskmanager-backend | grep -i mailgun

# Verify environment variables
cat /root/TaskManager/backend/.env | grep MAILGUN

# Test Mailgun connection
curl -s --user 'api:your_mailgun_api_key_here' \
  https://api.mailgun.net/v3/submitlist.space/messages \
  -F from='noreply@submitlist.space' \
  -F to='your-email@example.com' \
  -F subject='Test' \
  -F text='Test message'
```

### Migration errors
```bash
# View migration file
cat /root/TaskManager/backend/src/database/migrations/003_admin_and_verification.sql

# Run migration manually with error output
PGPASSWORD='taskmanager123' psql -U taskmanager -d taskmanager -f src/database/migrations/003_admin_and_verification.sql 2>&1
```

### Database connection issues
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
PGPASSWORD='taskmanager123' psql -U taskmanager -d taskmanager -c "SELECT version();"
```

## Rollback Plan

If deployment fails:

1. **Stop backend**: `pm2 stop taskmanager-backend`
2. **Restore database**: `PGPASSWORD='taskmanager123' psql -U taskmanager -d taskmanager < /root/backup-YYYYMMDD-HHMMSS.sql`
3. **Restore old frontend**: Copy old frontend build back to `/var/www/submitlist.space/html/`
4. **Restart backend**: `pm2 restart taskmanager-backend`

## Post-Deployment Tasks

1. **Monitor logs** for the first 24 hours: `pm2 logs taskmanager-backend --lines 100`
2. **Test all email flows** to ensure Mailgun is working
3. **Create additional admin users** if needed via SQL or admin dashboard
4. **Review audit logs** regularly at https://submitlist.space/admin/audit-logs
5. **Set up email notifications** for failed admin actions (optional)

## Mailgun Configuration

**Current Settings**:
- API Key: `your_mailgun_api_key_here`
- Domain: `submitlist.space`
- From Email: `noreply@submitlist.space`

**Mailgun Dashboard**: https://app.mailgun.com/
- View sent emails
- Check delivery status
- Monitor usage (1,000 emails/month free for first 3 months)

## Security Notes

1. **Verify DNS Records**: Ensure SPF and DKIM records are set up in your DNS for `submitlist.space`
2. **JWT Secret**: Consider changing `JWT_SECRET` in production `.env` file
3. **Super Admin Access**: Only grant super_admin role to trusted users
4. **Audit Logs**: Review regularly for suspicious activity
5. **Rate Limiting**: Password reset is rate-limited to 3 attempts per hour per user

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs taskmanager-backend`
2. Check Nginx logs: `tail -f /var/log/nginx/error.log`
3. Check Mailgun logs: https://app.mailgun.com/app/sending/domains/submitlist.space/logs
4. Review this deployment guide for troubleshooting steps
