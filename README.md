# Task Manager MVP

A full-stack task management system with scheduled tasks, team collaboration, and file uploads.

## Features

### Core Functionality
- User authentication (email/password with JWT)
- Organization/team management with role-based access (admin/member)
- Task creation with customizable requirements (checklist items)
- One-time and scheduled tasks (daily, weekly, monthly)
- **Media compression** - Auto-compress images (50-70% smaller) and videos (40-60% smaller)
- File uploads for task completion (images, videos, documents)
- In-app notifications
- Real-time task progress tracking
- Comprehensive audit logging
- **WCAG 2.1 Level AA accessibility** (93% compliant)
- Dark mode support (web and mobile)

### Subscription Billing (NEW - v2.1.0)
- Three-tier subscription model:
  - **Free**: 250MB storage, 7-day file retention
  - **Paid**: $20/year, 5GB storage, 30-day file retention
  - **Premium**: $99/year, 100GB storage, unlimited retention
- Organization-level storage pooling with per-user tracking
- Automatic file retention cleanup (cron-based)
- Feature flag support (BILLING_ENABLED)
- IAP-ready endpoints for Apple App Store and Google Play

### Technical Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL database
- JWT authentication
- Multer for file uploads
- **Sharp** for image compression (sync)
- **FFmpeg** for video compression (async)
- Docker containerization
- Comprehensive audit logging

**Web:**
- React 18 with TypeScript
- React Router for navigation
- Axios for API calls
- Modern CSS with responsive design

**Mobile:**
- React Native with Expo
- TypeScript
- React Navigation
- Axios for API calls
- Expo Image Picker for file uploads

## Project Structure

```
TaskManager/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Auth & file upload middleware
│   │   ├── services/       # Business logic (scheduled tasks)
│   │   ├── database/       # Schema & migrations
│   │   └── index.ts        # Server entry point
│   ├── uploads/            # File storage
│   ├── Dockerfile
│   └── package.json
├── web/                     # React web app
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # Auth context
│   │   ├── services/       # API service
│   │   └── types/          # TypeScript types
│   ├── public/
│   └── package.json
├── mobile/                  # React Native Expo app
│   ├── src/
│   │   ├── screens/        # App screens
│   │   ├── components/     # Reusable components
│   │   ├── navigation/     # Navigation setup
│   │   ├── contexts/       # Auth context
│   │   ├── services/       # API service
│   │   └── types/          # TypeScript types
│   ├── App.tsx
│   └── package.json
└── docker-compose.yml       # Docker orchestration
```

## Quick Start

**Fastest way to test the MVP:**

```bash
# 1. Start backend with Docker
docker-compose up -d

# 2. Start web app
cd web
npm install
npm start
```

Then open `http://localhost:3001` and login with:
- Email: `admin@test.com`
- Password: `password123`

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Expo CLI (for mobile development - optional)
- iOS Simulator or Android Emulator (for mobile - optional)

### 1. Backend Setup with Docker

```bash
# Clone or navigate to the project directory
cd TaskManager

# Start PostgreSQL and Backend API
docker-compose up -d

# Check if services are running
docker-compose ps
```

The backend API will be available at `http://localhost:3000`

**Note:** The docker-compose configuration automatically:
- Creates the PostgreSQL database
- Runs database migrations
- Seeds test data
- Starts the API server

### 2. Manual Backend Setup (Alternative)

If you prefer running locally without Docker:

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your database credentials
# Then start PostgreSQL manually

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed

# Start development server
npm run dev
```

### 3. Web App Setup (Recommended for Testing)

The web app is the easiest way to test the MVP:

```bash
cd web

# Install dependencies
npm install

# Start development server
npm start
```

The web app will open automatically at `http://localhost:3001` (or next available port).

**Features:**
- Full task management interface
- Organization management
- File uploads
- Notifications
- Responsive design

### 4. Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Start Expo development server
npm start

# Press 'i' for iOS simulator
# Press 'a' for Android emulator
# Or scan QR code with Expo Go app on your phone
```

**Important:** Update the API URL in `mobile/src/services/api.ts` if needed:
- For iOS Simulator: `http://localhost:3000/api`
- For Android Emulator: `http://10.0.2.2:3000/api`
- For physical device: Use your computer's local IP address

## Default Test Credentials

After seeding the database, you can login with:

**Admin User:**
- Email: `admin@test.com`
- Password: `password123`

**Member User:**
- Email: `member@test.com`
- Password: `password123`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile (requires auth)

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - Get user's organizations
- `GET /api/organizations/:id` - Get organization details
- `POST /api/organizations/:id/members` - Add member
- `PUT /api/organizations/:id/members/:memberId` - Update member role
- `DELETE /api/organizations/:id/members/:memberId` - Remove member

### Tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/organization/:orgId` - Get organization tasks
- `GET /api/tasks/:id` - Get task details
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `PUT /api/tasks/requirements/:id` - Update requirement status
- `POST /api/tasks/:id/completions` - Add completion (with file upload)
- `GET /api/tasks/:id/completions` - Get completions
- `DELETE /api/tasks/completions/:id` - Delete completion

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Media Compression
- `POST /api/tasks/:id/completions` - Upload with auto-compression (returns video job IDs)
- `GET /api/processing/jobs/:jobId` - Check video compression status
- `GET /api/processing/jobs/stats` - System statistics

### Billing
- `GET /api/billing/status` - Get billing/storage status
- `GET /api/billing/plans` - List subscription plans
- `GET /api/billing/storage/breakdown` - Per-user storage breakdown (admin)
- `POST /api/billing/storage/check-upload` - Check if upload allowed

### In-App Purchases
- `POST /api/iap/verify/apple` - Verify Apple receipt
- `POST /api/iap/verify/google` - Verify Google purchase
- `POST /api/iap/restore` - Restore purchases
- `GET /api/iap/management-url` - Get subscription management URL
- `GET /api/iap/subscription` - Get subscription details

## Usage Guide

### Creating Your First Task

1. **Login/Register** - Open the app and create an account or login
2. **Create Organization** - Tap "Organizations" and create a new organization
3. **Select Organization** - Tap on the organization to set it as active
4. **Create Task:**
   - Navigate to "Tasks" tab
   - Tap "+ New Task"
   - Enter task title and details
   - Add requirement checklist items
   - Choose schedule type (one-time, daily, weekly, monthly)
   - Submit

### Task Completion

1. Open a task from the task list
2. Check off requirements by tapping them
3. Add completion evidence:
   - Text description
   - Take photo
   - Upload image
4. Task automatically marks as complete when all requirements are done

### Scheduled Tasks

Tasks with schedule types will automatically generate new instances:
- **Daily:** Creates a new task every day
- **Weekly:** Creates a new task on the same day each week
- **Monthly:** Creates a new task on the same date each month

The scheduled task service runs at midnight daily (managed by cron job in the backend).

### Team Collaboration

As an **admin**, you can:
- Add members to your organization (via email)
- Assign tasks to team members
- Update member roles
- Remove members

As a **member**, you can:
- View organization tasks
- Complete assigned tasks
- Add completion evidence

## Development

### Backend Development

```bash
cd backend

# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start
```

### Web Development

```bash
cd web

# Start development server with hot reload
npm start

# Build for production
npm run build

# Run production build locally
npx serve -s build
```

### Mobile Development

```bash
cd mobile

# Start with specific platform
npm run ios
npm run android
npm run web
```

### Database Management

```bash
# Access PostgreSQL in Docker
docker exec -it taskmanager_db psql -U postgres -d taskmanager

# View logs
docker-compose logs -f backend
docker-compose logs -f postgres

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Stop and remove volumes (deletes data)
docker-compose down -v
```

## Troubleshooting

### Backend not connecting to database
- Ensure PostgreSQL container is running: `docker-compose ps`
- Check logs: `docker-compose logs postgres`
- Verify database credentials in `.env`

### Web app can't connect to API
- Ensure backend is running on `http://localhost:3000`
- Check browser console for CORS errors
- Verify API URL in `web/src/services/api.ts` is correct
- Try accessing `http://localhost:3000/health` directly

### Mobile app can't connect to API
- Check API URL in `mobile/src/services/api.ts`
- For iOS Simulator, use `localhost`
- For Android Emulator, use `10.0.2.2`
- For physical device, use your computer's local IP address
- Ensure backend is running and accessible

### File uploads not working
- Verify `uploads` directory exists and has write permissions
- Check file size doesn't exceed 10MB limit
- Ensure proper permissions granted in mobile app
- For web app, check browser console for errors

## Documentation

Comprehensive guides available:
- **[ACCESSIBILITY.md](ACCESSIBILITY.md)** - Complete accessibility guide (WCAG AA compliance)
- **[COMPRESSION_SYSTEM.md](COMPRESSION_SYSTEM.md)** - Media compression documentation
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)** - Complete production deployment guide (submitlist.space)
- **[DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md)** - Production deployment options and guides
- **[DIGITALOCEAN_DEPLOYMENT.md](DIGITALOCEAN_DEPLOYMENT.md)** - Detailed DigitalOcean deployment
- **[DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)** - Complete deployment commands reference
- **[SUBSCRIPTION_BILLING_DESIGN.md](SUBSCRIPTION_BILLING_DESIGN.md)** - Billing system design
- **[IAP_IMPLEMENTATION_PLAN.md](IAP_IMPLEMENTATION_PLAN.md)** - In-App Purchase integration guide
- **[UI_DESIGN_REVIEW.md](docs/UI_DESIGN_REVIEW.md)** - Design specifications
- **[AUTH_SERVICE_ARCHITECTURE.md](AUTH_SERVICE_ARCHITECTURE.md)** - Auth service evaluation

## Production Deployment

**Live Production Site:** https://submitlist.space

See [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for the complete production deployment documentation including:
- Full deployment process and architecture
- All issues encountered and solutions
- Management and maintenance commands
- SSL certificate management
- Backup procedures
- Troubleshooting guide

For planning new deployments, see [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md) for two options:

**Option 1: Minimal Setup ($17/month)**
- Perfect for MVP and early stage (50-200 users)
- Self-managed PostgreSQL on Droplet
- 250GB Spaces storage
- Step-by-step setup guide

**Option 2: Managed Setup ($47/month)**
- Production-grade infrastructure (50-500 users)
- Managed PostgreSQL with auto-backups
- 1TB Spaces storage
- Less DevOps overhead

Both options include:
- Ubuntu Droplet setup
- Nginx reverse proxy
- Let's Encrypt SSL certificates
- PM2 process management
- Media compression support
- Monitoring and maintenance guides

## Future Enhancements

Potential features for future versions:
- Task comments and discussions
- Calendar view for tasks
- Task dependencies
- Analytics and reporting
- Real-time collaboration (WebSockets)
- Email notifications
- Push notifications (FCM integration)
- File versioning
- Task templates
- Bulk operations
- Redis job queue for video processing
- CDN integration for file serving

## License

This project is created as an MVP for demonstration purposes.
