# TaskManager - Development Setup Guide

**Version**: 2.0.0
**Last Updated**: November 20, 2025

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker)](#quick-start-docker)
3. [Manual Setup](#manual-setup)
4. [Environment Configuration](#environment-configuration)
5. [Database Setup](#database-setup)
6. [Running the Application](#running-the-application)
7. [Development Workflow](#development-workflow)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

**Docker Setup (Recommended)**:
- Docker Desktop 4.0+ ([Download](https://www.docker.com/products/docker-desktop))
- Docker Compose 2.0+ (included with Docker Desktop)

**Manual Setup**:
- Node.js 18.x or 20.x ([Download](https://nodejs.org/))
- npm 9.x+ (comes with Node.js)
- PostgreSQL 15.x ([Download](https://www.postgresql.org/download/))
- Git ([Download](https://git-scm.com/downloads))

**Optional**:
- VS Code with extensions:
  - ESLint
  - Prettier
  - PostgreSQL (for database management)
  - Docker (if using Docker)
- Postman or Insomnia (for API testing)
- pgAdmin 4 (for database GUI)

### System Requirements
- **OS**: macOS 10.15+, Ubuntu 20.04+, Windows 10+
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB free space

---

## Quick Start (Docker)

### 1. Clone Repository
```bash
git clone <repository-url>
cd TaskManager
```

### 2. Start All Services
```bash
docker-compose up -d
```

This command will:
- Pull PostgreSQL 15 Alpine image
- Build backend Docker image
- Build frontend Docker image
- Create network and volumes
- Start all services

### 3. Verify Services
```bash
docker-compose ps
```

Expected output:
```
NAME                  IMAGE                    STATUS
taskmanager_db        postgres:15-alpine       Up (healthy)
taskmanager_backend   taskmanager-backend      Up
taskmanager_web       taskmanager-web          Up
```

### 4. Access Application
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000/api
- **Database**: localhost:5432

### 5. View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f web
docker-compose logs -f postgres
```

### 6. Stop Services
```bash
docker-compose down
```

### 7. Reset Everything (Clean Slate)
```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove all build caches
docker system prune -a --volumes

# Restart
docker-compose up -d
```

---

## Manual Setup

### 1. Install Dependencies

**Backend**:
```bash
cd backend
npm install
```

**Frontend**:
```bash
cd web
npm install
```

### 2. Install PostgreSQL

**macOS (Homebrew)**:
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows**:
Download installer from [postgresql.org](https://www.postgresql.org/download/windows/)

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE taskmanager;
CREATE USER taskmanager WITH PASSWORD 'taskmanager_dev';
GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager;

# Exit
\q
```

### 4. Run Migrations

```bash
cd backend

# Option 1: Run schema file
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager -f src/database/schema.sql

# Option 2: Run migration script (if available)
npm run db:migrate
```

### 5. Run Migrations (Admin Features)

```bash
cd backend/src/database/migrations

# Apply admin and verification migration
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager -f 003_admin_and_verification.sql
```

---

## Environment Configuration

### Backend Environment (.env)

Create `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=taskmanager
DB_PASSWORD=taskmanager_dev

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=development

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Email Configuration (Mailgun)
# Optional for local development - emails will be logged to console
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.com
FROM_EMAIL=noreply@your-domain.com
FROM_NAME=TaskManager
APP_URL=http://localhost:3001

# CORS Configuration
CORS_ORIGIN=http://localhost:3001
```

### Frontend Environment

Create `web/.env`:

```env
REACT_APP_API_URL=http://localhost:3000/api
```

**Note**: Changes to `.env` files require restarting the development server.

---

## Database Setup

### Database Schema

The schema consists of 17 tables:
- **Core**: users, organizations, organization_members
- **Tasks**: tasks, task_assignees, task_requirements, task_completions, task_reviews
- **Groups**: task_groups, task_group_members
- **Onboarding**: organization_invites, organization_join_requests
- **Auth**: email_verification_tokens, password_reset_tokens
- **Audit**: admin_audit_logs, task_audit_logs
- **Notifications**: notifications

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete schema documentation.

### Sample Data (Optional)

Create a seed file `backend/src/database/seed.ts` or use the seed script:

```bash
cd backend
npm run db:seed
```

### Create First Super Admin

```bash
# Connect to database
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager

# Create admin user (after registering via UI or API)
UPDATE users SET
  role = 'super_admin',
  email_verified = true,
  email_verified_at = NOW()
WHERE email = 'your@email.com';

# Verify
SELECT id, email, name, role FROM users WHERE role = 'super_admin';

# Exit
\q
```

---

## Running the Application

### Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Manual (Separate Terminals)

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

Output:
```
Server running on port 3000
Database connected successfully
```

**Terminal 2 - Frontend**:
```bash
cd web
npm start
```

Output:
```
Compiled successfully!
Local:            http://localhost:3001
```

### Verify Installation

1. **Backend Health Check**:
```bash
curl http://localhost:3000/api/health
```

Expected: `{"status":"ok"}`

2. **Frontend**: Open http://localhost:3001 in browser

3. **Database Connection**:
```bash
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager -c "SELECT version();"
```

---

## Development Workflow

### Code Structure

```
TaskManager/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Request handlers
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth, validation
│   │   ├── database/         # Schema, migrations
│   │   ├── services/         # Email, file upload
│   │   ├── types/            # TypeScript types
│   │   └── index.ts          # Entry point
│   ├── uploads/              # User uploads
│   ├── .env                  # Environment config
│   ├── package.json
│   └── tsconfig.json
│
├── web/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── contexts/         # React contexts (Auth, etc.)
│   │   ├── services/         # API service
│   │   ├── App.tsx           # Main app component
│   │   └── index.tsx         # Entry point
│   ├── public/
│   ├── .env                  # Environment config
│   └── package.json
│
├── docker-compose.yml        # Docker orchestration
├── FEATURES.md               # Feature documentation
├── DEPLOYMENT_COMPLETE.md    # Deployment guide
├── DATABASE_SCHEMA.md        # Database documentation
└── DEV_SETUP.md              # This file
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push to remote
git push origin feature/your-feature-name

# Create pull request
```

**Commit Message Convention**:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

### Hot Reload

Both backend and frontend support hot reload:

- **Backend**: Changes to `src/` files automatically restart server (nodemon)
- **Frontend**: Changes to `src/` files automatically reload browser (webpack)

### API Testing

**Using curl**:
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "username": "testuser"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Get profile (with JWT token)
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Using Postman**:
1. Import API collection (if available)
2. Set environment variable: `API_URL=http://localhost:3000/api`
3. Set authorization type: Bearer Token

---

## Testing

### Backend Tests (Future)

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd web
npm test
```

### Integration Tests (Future)

```bash
npm run test:integration
```

### Manual Testing Checklist

- [ ] User registration
- [ ] Email verification (check console logs)
- [ ] User login
- [ ] Password reset flow
- [ ] Admin dashboard access
- [ ] Create organization
- [ ] Create task
- [ ] Assign task to user
- [ ] Submit task completion
- [ ] Review task
- [ ] Notifications

---

## Troubleshooting

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port in .env
PORT=3001
```

### Database Connection Failed

**Error**: `ECONNREFUSED 127.0.0.1:5432`

**Solutions**:
```bash
# Check PostgreSQL is running
# macOS
brew services list

# Ubuntu/Debian
sudo systemctl status postgresql

# Start PostgreSQL
# macOS
brew services start postgresql@15

# Ubuntu/Debian
sudo systemctl start postgresql

# Check connection
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager -c "SELECT 1"
```

### Docker Container Won't Start

**Error**: Container exits immediately

**Solutions**:
```bash
# Check logs
docker-compose logs backend

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check database health
docker-compose ps
```

### Frontend Build Errors

**Error**: `Module not found` or `Cannot resolve`

**Solutions**:
```bash
cd web

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear React cache
rm -rf node_modules/.cache
```

### Migration Errors

**Error**: `relation already exists`

**Solutions**:
```bash
# Check which migrations have been run
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager \
  -c "\dt"

# Drop and recreate database (WARNING: deletes all data)
PGPASSWORD=postgres psql -U postgres -c "DROP DATABASE taskmanager"
PGPASSWORD=postgres psql -U postgres -c "CREATE DATABASE taskmanager"
PGPASSWORD=postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager"

# Re-run migrations
cd backend
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager -f src/database/schema.sql
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager -f src/database/migrations/003_admin_and_verification.sql
```

### JWT Token Errors

**Error**: `Invalid token` or `Token expired`

**Solutions**:
1. Check JWT_SECRET matches between backend and token generation
2. Clear browser localStorage: `localStorage.clear()`
3. Re-login to get new token
4. Check token expiration in backend .env: `JWT_EXPIRES_IN=7d`

### CORS Errors

**Error**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Solutions**:
1. Check CORS_ORIGIN in backend .env matches frontend URL
2. Verify frontend API URL in web/.env
3. Restart backend server after .env changes

### Email Not Sending (Development)

**Expected**: Emails logged to console in development mode

**Check**:
```bash
# Backend logs should show email details
docker-compose logs backend | grep -i email
```

**Note**: Mailgun integration only works with valid API key. In development, emails are logged instead of sent.

---

## Development Tips

### Database GUI Tools

**pgAdmin 4**:
```bash
# Install
brew install --cask pgadmin4

# Connect
Host: localhost
Port: 5432
Database: taskmanager
Username: taskmanager
Password: taskmanager_dev
```

**VS Code PostgreSQL Extension**:
1. Install "PostgreSQL" extension
2. Add connection:
   - Host: localhost
   - User: taskmanager
   - Password: taskmanager_dev
   - Database: taskmanager

### Code Formatting

**Backend (TypeScript)**:
```bash
cd backend

# Install prettier
npm install --save-dev prettier

# Format all files
npx prettier --write "src/**/*.ts"
```

**Frontend (React)**:
```bash
cd web

# Format all files
npx prettier --write "src/**/*.{ts,tsx,css}"
```

### Debugging

**Backend (VS Code)**:
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/backend",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Frontend (Chrome DevTools)**:
1. Open http://localhost:3001
2. Press F12 to open DevTools
3. Use Sources tab to set breakpoints
4. Use React DevTools extension for component inspection

### Performance Monitoring

**Backend**:
```bash
# Check memory usage
docker stats taskmanager_backend

# Check database connections
PGPASSWORD=taskmanager_dev psql -U taskmanager -d taskmanager \
  -c "SELECT * FROM pg_stat_activity WHERE datname='taskmanager';"
```

**Frontend**:
- Use Chrome Lighthouse for performance audit
- Check Network tab for slow API calls
- Monitor bundle size: `npm run build` shows bundle sizes

---

## Environment-Specific Notes

### macOS

- Use Homebrew for package management
- PostgreSQL listens on localhost by default
- Docker Desktop includes Docker Compose

### Linux (Ubuntu/Debian)

- Use apt for package management
- May need to adjust PostgreSQL pg_hba.conf for local connections
- Install Docker Compose separately if needed

### Windows

- Use WSL2 for better Docker performance
- Install PostgreSQL via official installer
- Use PowerShell or Git Bash for commands

---

## Next Steps

After successful setup:

1. **Read Documentation**:
   - [FEATURES.md](./FEATURES.md) - Complete feature list
   - [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database structure
   - [DEPLOYMENT_COMPLETE.md](./DEPLOYMENT_COMPLETE.md) - Production deployment

2. **Create Test User**:
   ```bash
   # Register via UI or API
   # Then promote to super_admin via SQL (see above)
   ```

3. **Explore API**:
   - Try all authentication endpoints
   - Create organizations and tasks
   - Test admin features

4. **Start Development**:
   - Pick a feature from planned features
   - Create feature branch
   - Implement and test
   - Submit pull request

---

## Additional Resources

- **Node.js Documentation**: https://nodejs.org/docs/
- **React Documentation**: https://react.dev/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Express.js Documentation**: https://expressjs.com/
- **Docker Documentation**: https://docs.docker.com/
- **TypeScript Documentation**: https://www.typescriptlang.org/docs/

---

## Getting Help

If you encounter issues not covered here:

1. Check existing documentation files
2. Review error logs carefully
3. Search for similar issues online
4. Ask team members or create an issue

**Common Log Locations**:
- Backend: `docker-compose logs backend` or terminal output
- Frontend: Browser console (F12)
- Database: `docker-compose logs postgres`
- Nginx (production): `/var/log/nginx/error.log`
