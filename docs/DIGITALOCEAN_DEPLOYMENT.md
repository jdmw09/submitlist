# DigitalOcean MVP Deployment Plan

## Executive Summary

This document outlines the complete transition from local development to production deployment on DigitalOcean. It covers architecture, security, deployment, monitoring, and operational procedures for a production-ready TaskManager MVP.

**Timeline**: 2-3 weeks
**Estimated Monthly Cost**: $50-100
**Uptime Target**: 99.9%

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Production Architecture](#production-architecture)
3. [Security Implementation](#security-implementation)
4. [Deployment Strategy](#deployment-strategy)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Monitoring & Logging](#monitoring--logging)
7. [Backup & Recovery](#backup--recovery)
8. [Cost Analysis](#cost-analysis)
9. [Step-by-Step Migration](#step-by-step-migration)
10. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Current State Analysis

### Local Development Setup

```
┌─────────────────────────────────────────┐
│  Developer Machine                      │
├─────────────────────────────────────────┤
│                                         │
│  Web (React)                            │
│  └─ http://localhost:3001               │
│                                         │
│  Mobile (React Native/Expo)             │
│  └─ Metro bundler on :8081              │
│                                         │
│  Backend (Express + TypeScript)         │
│  └─ http://localhost:3000               │
│     Docker Container                    │
│                                         │
│  Database (PostgreSQL)                  │
│  └─ localhost:5432                      │
│     Docker Container                    │
│                                         │
│  File Storage                           │
│  └─ ./backend/uploads/                  │
│     Local filesystem                    │
└─────────────────────────────────────────┘
```

### Limitations
- ❌ No HTTPS/SSL
- ❌ No proper authentication/authorization
- ❌ No rate limiting
- ❌ No backup strategy
- ❌ No monitoring
- ❌ No error tracking
- ❌ Files stored locally (not scalable)
- ❌ Hardcoded localhost URLs
- ❌ No environment separation
- ❌ No load balancing
- ❌ No CDN for static assets

---

## Production Architecture

### DigitalOcean Infrastructure

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│  Cloudflare (DNS + CDN + DDoS)          │
│  └─ taskmanager.com                     │
│     └─ SSL/TLS Termination              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  DigitalOcean Load Balancer             │
│  └─ HTTPS :443 → HTTP :80               │
└─────────────────────────────────────────┘
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Droplet 1  │  │  Droplet 2  │  │  Droplet 3  │
│  (App)      │  │  (App)      │  │  (Standby)  │
│  Backend    │  │  Backend    │  │  Backend    │
│  Web App    │  │  Web App    │  │  Web App    │
└─────────────┘  └─────────────┘  └─────────────┘
    │                  │                  │
    └──────────────────┴──────────────────┘
                       │
                       ▼
           ┌────────────────────────┐
           │  Managed PostgreSQL    │
           │  - Primary + Replica   │
           │  - Automated backups   │
           └────────────────────────┘
                       │
                       ▼
           ┌────────────────────────┐
           │  Spaces (S3-compatible)│
           │  - File uploads        │
           │  - Static assets       │
           │  - CDN-enabled         │
           └────────────────────────┘
```

### Components

#### 1. **App Droplets** (3x)
- **Type**: Basic Droplet
- **Size**: 2 GB RAM / 1 vCPU / 50 GB SSD ($18/mo each)
- **OS**: Ubuntu 22.04 LTS
- **Software**:
  - Docker & Docker Compose
  - Node.js 18+ LTS
  - Nginx (reverse proxy)
  - PM2 (process manager)
  - SSL certificates

#### 2. **Managed PostgreSQL Database**
- **Type**: Managed Database
- **Plan**: Basic ($15/mo)
  - 1 GB RAM
  - 10 GB Storage
  - Automated daily backups
  - High availability option: +$30/mo
- **Features**:
  - Automatic failover
  - Point-in-time recovery
  - Connection pooling
  - SSL required

#### 3. **Spaces Object Storage**
- **Type**: S3-compatible storage
- **Cost**: $5/mo (250 GB storage + 1 TB transfer)
- **Use Cases**:
  - User uploaded files (images, videos, documents)
  - Static web assets
  - Database backups
- **CDN**: Included (optional)

#### 4. **Load Balancer**
- **Cost**: $12/mo
- **Features**:
  - SSL termination
  - Health checks
  - Automatic failover
  - Sticky sessions
  - DDoS protection

#### 5. **Cloudflare** (Optional but recommended)
- **Cost**: Free tier sufficient
- **Features**:
  - DNS management
  - Global CDN
  - DDoS protection
  - Web Application Firewall (WAF)
  - SSL/TLS
  - Page rules
  - Analytics

---

## Security Implementation

### 1. HTTPS/SSL Configuration

**SSL Certificate Options:**

**Option A: Let's Encrypt (Free)**
```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d taskmanager.com -d www.taskmanager.com -d api.taskmanager.com

# Auto-renewal
sudo certbot renew --dry-run
```

**Option B: Cloudflare (Free)**
- Cloudflare provides free SSL certificates
- Easier management through dashboard
- Better performance with CDN

### 2. Environment Variables

**Production .env structure:**
```bash
# Application
NODE_ENV=production
PORT=3000
WEB_URL=https://taskmanager.com
API_URL=https://api.taskmanager.com

# Database
DATABASE_URL=postgresql://user:pass@managed-db.digitalocean.com:25060/taskmanager?sslmode=require
DB_POOL_MIN=2
DB_POOL_MAX=10

# Authentication
JWT_SECRET=<64-char-random-string>
JWT_EXPIRY=7d
REFRESH_TOKEN_SECRET=<64-char-random-string>
REFRESH_TOKEN_EXPIRY=30d

# File Storage (Spaces)
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=taskmanager-uploads
SPACES_KEY=<access-key>
SPACES_SECRET=<secret-key>
SPACES_REGION=nyc3
CDN_URL=https://taskmanager-uploads.nyc3.cdn.digitaloceanspaces.com

# Email (SendGrid or similar)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
EMAIL_FROM=noreply@taskmanager.com

# Monitoring
SENTRY_DSN=<sentry-dsn>
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN=https://taskmanager.com,https://www.taskmanager.com

# Session
SESSION_SECRET=<64-char-random-string>
COOKIE_DOMAIN=.taskmanager.com
```

**Generate secure secrets:**
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Firewall Configuration

**UFW (Uncomplicated Firewall):**
```bash
# Enable firewall
sudo ufw enable

# Allow SSH (port 22)
sudo ufw allow 22/tcp

# Allow HTTP (port 80)
sudo ufw allow 80/tcp

# Allow HTTPS (port 443)
sudo ufw allow 443/tcp

# Allow from Load Balancer only
sudo ufw allow from <load-balancer-ip> to any port 3000

# Deny all other incoming
sudo ufw default deny incoming

# Allow all outgoing
sudo ufw default allow outgoing

# Check status
sudo ufw status verbose
```

### 4. Nginx Reverse Proxy

**`/etc/nginx/sites-available/taskmanager`:**
```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;

# API Server
upstream api_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name taskmanager.com www.taskmanager.com api.taskmanager.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# API Server
server {
    listen 443 ssl http2;
    server_name api.taskmanager.com;

    ssl_certificate /etc/letsencrypt/live/taskmanager.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taskmanager.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting for auth endpoints
    location ~ ^/api/auth/(login|register) {
        limit_req zone=auth_limit burst=5 nodelay;
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate limiting for API
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://api_backend/health;
    }
}

# Web App
server {
    listen 443 ssl http2;
    server_name taskmanager.com www.taskmanager.com;

    ssl_certificate /etc/letsencrypt/live/taskmanager.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/taskmanager.com/privkey.pem;

    # Same SSL config as above

    root /var/www/taskmanager/web/build;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Cache static assets
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. Database Security

**PostgreSQL hardening:**
```sql
-- Create dedicated application user
CREATE USER taskmanager_app WITH PASSWORD '<strong-password>';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE taskmanager TO taskmanager_app;
GRANT USAGE ON SCHEMA public TO taskmanager_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO taskmanager_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO taskmanager_app;

-- Enable SSL/TLS only
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_min_protocol_version = 'TLSv1.2';

-- Set connection limits
ALTER USER taskmanager_app CONNECTION LIMIT 20;

-- Enable logging
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_duration = on;
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log slow queries (>1s)
```

**Connection string with SSL:**
```
postgresql://taskmanager_app:password@host:port/taskmanager?sslmode=require&sslrootcert=/path/to/ca-certificate.crt
```

### 6. Application Security

**Rate Limiting (express-rate-limit):**
```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// General API rate limit
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limit for auth endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many authentication attempts, please try again later.',
});

// File upload rate limit
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Upload limit reached, please try again later.',
});
```

**Helmet.js (Security headers):**
```typescript
// backend/src/app.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://taskmanager-uploads.nyc3.cdn.digitaloceanspaces.com"],
      connectSrc: ["'self'", "https://api.taskmanager.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https://taskmanager-uploads.nyc3.cdn.digitaloceanspaces.com"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
}));
```

**CORS Configuration:**
```typescript
// backend/src/middleware/cors.ts
import cors from 'cors';

const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'https://taskmanager.com',
  'https://www.taskmanager.com',
];

export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
```

---

## Deployment Strategy

### Deployment Options

#### Option A: Docker Compose (Simpler)
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      NODE_ENV: production
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/sites:/etc/nginx/sites-available:ro
      - ./web/build:/var/www/taskmanager/web/build:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend

volumes:
  redis-data:
```

#### Option B: PM2 (More control)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'taskmanager-api',
    script: './dist/server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
  }],
};
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**`.github/workflows/deploy.yml`:**
```yaml
name: Deploy to DigitalOcean

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../web && npm ci

      - name: Run tests
        run: |
          cd backend && npm test
          cd ../web && npm test

      - name: Lint
        run: |
          cd backend && npm run lint
          cd ../web && npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Build backend
        run: |
          cd backend
          npm ci
          npm run build

      - name: Build web
        run: |
          cd web
          npm ci
          npm run build
        env:
          REACT_APP_API_URL: https://api.taskmanager.com

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            backend/dist
            web/build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts

      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: ${{ secrets.DROPLET_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/taskmanager
            git pull origin main

            # Backup current version
            cp -r backend/dist backend/dist.backup
            cp -r web/build web/build.backup

            # Deploy new version
            cd backend
            npm ci --production
            npm run build
            pm2 reload ecosystem.config.js --env production

            cd ../web
            npm ci
            npm run build
            sudo systemctl reload nginx

            # Health check
            sleep 5
            curl -f https://api.taskmanager.com/health || (
              echo "Health check failed, rolling back..."
              cd ../backend
              rm -rf dist
              mv dist.backup dist
              pm2 reload ecosystem.config.js
              exit 1
            )

            # Cleanup backup
            rm -rf backend/dist.backup web/build.backup

      - name: Notify success
        if: success()
        run: echo "Deployment successful!"

      - name: Notify failure
        if: failure()
        run: echo "Deployment failed!"
```

---

## Monitoring & Logging

### 1. Application Monitoring

**Sentry (Error Tracking):**
```typescript
// backend/src/app.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Winston (Logging):**
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### 2. Infrastructure Monitoring

**DigitalOcean Monitoring** (Built-in):
- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Alerts via email/Slack

**UptimeRobot** (Free):
- HTTP(S) monitoring
- Response time tracking
- 50 monitors free
- 5-minute checks
- Email/SMS/Slack alerts

### 3. Database Monitoring

**PostgreSQL Slow Query Log:**
```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1 second

-- View slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### 4. Log Management

**Papertrail (Free tier: 50MB/month):**
```bash
# Install remote_syslog2
wget https://github.com/papertrail/remote_syslog2/releases/download/v0.20/remote_syslog_linux_amd64.tar.gz
tar xzf remote_syslog*.tar.gz
sudo cp remote_syslog/remote_syslog /usr/local/bin

# Configure
sudo nano /etc/log_files.yml
```

```yaml
files:
  - /var/log/nginx/*.log
  - /var/www/taskmanager/backend/logs/*.log
  - /var/log/syslog
destination:
  host: logs.papertrailapp.com
  port: XXXXX
  protocol: tls
```

---

## Backup & Recovery

### 1. Database Backups

**Automated (DigitalOcean Managed Database):**
- Daily automated backups (included)
- 7-day retention
- Point-in-time recovery

**Manual Backups:**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgresql"
FILENAME="taskmanager_$DATE.sql.gz"

# Create backup
pg_dump -h <db-host> -U <user> -d taskmanager | gzip > "$BACKUP_DIR/$FILENAME"

# Upload to Spaces
s3cmd put "$BACKUP_DIR/$FILENAME" s3://taskmanager-backups/db/

# Keep only last 30 days locally
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $FILENAME"
```

**Cron job:**
```bash
# Daily at 2 AM
0 2 * * * /usr/local/bin/backup-db.sh >> /var/log/backup.log 2>&1
```

### 2. File Storage Backups

**Spaces Lifecycle Rules:**
- Enable versioning
- Set lifecycle policies
- Archive old files to Glacier

### 3. Application Code

**Git-based deployment:**
- All code in Git repository
- Tagged releases
- Easy rollback to previous version

### 4. Disaster Recovery Plan

**RTO (Recovery Time Objective)**: 1 hour
**RPO (Recovery Point Objective)**: 24 hours

**Recovery Steps:**
1. Provision new droplet from snapshot
2. Restore latest database backup
3. Update DNS if needed
4. Deploy latest code
5. Verify functionality

---

## Cost Analysis

### Monthly Costs

| Service | Specification | Cost |
|---------|--------------|------|
| **App Droplets (2x)** | 2 GB RAM, 1 vCPU, 50 GB SSD | $36 |
| **Database** | Managed PostgreSQL Basic | $15 |
| **Spaces** | 250 GB storage + 1 TB transfer | $5 |
| **Load Balancer** | Standard | $12 |
| **Backups** | Droplet snapshots | $2 |
| **Domain** | .com registration | $12/year ($1/mo) |
| **SendGrid** | Email (Essentials) | $15 |
| **Sentry** | Error tracking (Developer) | $26 |
| **Cloudflare** | Free plan | $0 |
| **UptimeRobot** | Free plan | $0 |
| **SSL Certificates** | Let's Encrypt | $0 |
| **TOTAL** | | **~$112/month** |

### Scaling Costs

As you grow:
- Add more droplets: +$18/mo each
- Upgrade database: $30/mo (High Availability)
- More storage: +$5/250 GB
- CDN bandwidth: Included with Spaces

**At 1,000 users**: ~$150/month
**At 10,000 users**: ~$300-500/month
**At 100,000+ users**: Consider Kubernetes + managed services

---

## Step-by-Step Migration

### Phase 1: Preparation (Week 1)

**Day 1-2: Infrastructure Setup**
```bash
# 1. Create DigitalOcean account
# 2. Add SSH keys
ssh-keygen -t ed25519 -C "deploy@taskmanager.com"

# 3. Create droplets
doctl compute droplet create taskmanager-app-01 \
  --region nyc3 \
  --size s-2vcpu-2gb \
  --image ubuntu-22-04-x64 \
  --ssh-keys <your-ssh-key-id>

# 4. Create managed database
# (Via DigitalOcean control panel)

# 5. Create Spaces bucket
# (Via DigitalOcean control panel)

# 6. Set up domain
# Add A records pointing to Load Balancer IP
```

**Day 3-4: Server Configuration**
```bash
# Connect to droplet
ssh root@<droplet-ip>

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Install Nginx
apt install -y nginx

# Install certbot
apt install -y certbot python3-certbot-nginx

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

**Day 5-7: Code Preparation**
```bash
# Update environment variables
# Update API URLs in frontend
# Add production build scripts
# Test builds locally
```

### Phase 2: Initial Deployment (Week 2)

**Day 1-2: Database Migration**
```bash
# Export local database
pg_dump -U postgres taskmanager > taskmanager_dump.sql

# Import to managed database
psql -h <managed-db-host> -U doadmin -d taskmanager < taskmanager_dump.sql

# Verify data integrity
psql -h <managed-db-host> -U doadmin -d taskmanager -c "SELECT COUNT(*) FROM users;"
```

**Day 3-4: Application Deployment**
```bash
# Clone repository on droplet
cd /var/www
git clone https://github.com/yourusername/taskmanager.git
cd taskmanager

# Backend deployment
cd backend
npm ci --production
npm run build

# Create .env.production
nano .env.production
# (Paste production environment variables)

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Web deployment
cd ../web
npm ci
REACT_APP_API_URL=https://api.taskmanager.com npm run build

# Copy build to nginx directory
cp -r build /var/www/taskmanager/web/
```

**Day 5: Nginx & SSL Configuration**
```bash
# Configure Nginx
nano /etc/nginx/sites-available/taskmanager
# (Paste Nginx configuration from above)

# Enable site
ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Obtain SSL certificate
certbot --nginx -d taskmanager.com -d www.taskmanager.com -d api.taskmanager.com

# Reload Nginx
systemctl reload nginx
```

**Day 6-7: Testing**
```bash
# Health checks
curl https://api.taskmanager.com/health

# Test API endpoints
curl https://api.taskmanager.com/api/auth/register

# Test web app
open https://taskmanager.com

# Monitor logs
pm2 logs
tail -f /var/log/nginx/access.log
```

### Phase 3: Go Live (Week 3)

**Day 1-2: Final Testing**
- Load testing with Artillery/k6
- Security scan with OWASP ZAP
- Penetration testing
- User acceptance testing

**Day 3: DNS Cutover**
```bash
# Update DNS records
# A record: taskmanager.com → <load-balancer-ip>
# A record: api.taskmanager.com → <load-balancer-ip>
# CNAME: www.taskmanager.com → taskmanager.com

# Wait for DNS propagation (up to 48 hours)
dig taskmanager.com
```

**Day 4-5: Monitoring Setup**
- Configure Sentry
- Set up UptimeRobot
- Configure alerts
- Set up Papertrail

**Day 6-7: Optimization**
- Database query optimization
- CDN configuration
- Caching setup
- Performance tuning

---

## Post-Deployment Checklist

### Security
- [ ] SSL certificates installed and auto-renewing
- [ ] Firewall configured (UFW)
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Security headers added (Helmet.js)
- [ ] Database SSL enforced
- [ ] Secrets rotated
- [ ] Admin accounts secured with strong passwords
- [ ] SSH key-only authentication enabled
- [ ] Root login disabled

### Monitoring
- [ ] Sentry configured for error tracking
- [ ] UptimeRobot monitoring all endpoints
- [ ] Log aggregation set up (Papertrail)
- [ ] Database monitoring enabled
- [ ] Disk space alerts configured
- [ ] Memory alerts configured
- [ ] CPU alerts configured

### Backups
- [ ] Automated database backups enabled
- [ ] Manual backup script tested
- [ ] Backup restoration tested
- [ ] Backup retention policy set
- [ ] Offsite backup storage configured

### Performance
- [ ] CDN configured for static assets
- [ ] Gzip compression enabled
- [ ] Database connection pooling configured
- [ ] Caching strategy implemented
- [ ] Image optimization in place

### Documentation
- [ ] Deployment process documented
- [ ] Runbook created for common issues
- [ ] Rollback procedure documented
- [ ] Team trained on deployment process
- [ ] Contact information for emergencies

### Testing
- [ ] All features tested in production
- [ ] Mobile app tested against production API
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] User acceptance testing passed

---

## Rollback Plan

### If deployment fails:

**1. Identify the issue:**
```bash
# Check application logs
pm2 logs --err

# Check Nginx logs
tail -f /var/log/nginx/error.log

# Check system logs
journalctl -xe
```

**2. Rollback application:**
```bash
# Restore previous version
cd /var/www/taskmanager/backend
rm -rf dist
mv dist.backup dist
pm2 reload ecosystem.config.js

# Restore web app
cd ../web
rm -rf build
mv build.backup build
systemctl reload nginx
```

**3. Rollback database (if needed):**
```bash
# Restore from backup
psql -h <db-host> -U doadmin -d taskmanager < backup.sql
```

**4. Verify:**
```bash
# Health check
curl https://api.taskmanager.com/health

# Smoke test critical endpoints
```

**5. Communicate:**
- Notify team
- Update status page
- Post-mortem after incident

---

## Maintenance Procedures

### Weekly Tasks
- [ ] Review error logs
- [ ] Check disk space
- [ ] Review slow queries
- [ ] Check SSL certificate expiry
- [ ] Review security alerts

### Monthly Tasks
- [ ] Update dependencies
- [ ] Security patches
- [ ] Review and optimize database
- [ ] Test backup restoration
- [ ] Review costs and optimize

### Quarterly Tasks
- [ ] Security audit
- [ ] Performance review
- [ ] Capacity planning
- [ ] Disaster recovery drill
- [ ] Update documentation

---

## Conclusion

This deployment plan provides a production-ready infrastructure for TaskManager MVP on DigitalOcean with:
- ✅ High availability (load balanced)
- ✅ Security (HTTPS, rate limiting, firewalls)
- ✅ Scalability (horizontal scaling ready)
- ✅ Monitoring (errors, uptime, performance)
- ✅ Backups (automated, tested)
- ✅ CI/CD (automated deployments)
- ✅ Cost-effective (~$112/month)

**Total timeline**: 2-3 weeks from start to production
**Monthly cost**: ~$112 (scales with usage)
**Expected uptime**: 99.9%+

**Next Steps:**
1. Create DigitalOcean account
2. Set up domain name
3. Follow Phase 1 preparation steps
4. Deploy following this guide
5. Monitor and optimize
