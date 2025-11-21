# DigitalOcean Production Deployment Guide

Complete guide for deploying the Task Manager application to DigitalOcean with production-grade infrastructure.

**Last Updated:** 2025-11-20
**Estimated Setup Time:** 2-3 hours
**Monthly Cost:** $24-48 (Basic tier)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Web Server Configuration](#web-server-configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Process Management](#process-management)
9. [Backups & Monitoring](#backups--monitoring)
10. [Scaling & Optimization](#scaling--optimization)
11. [Troubleshooting](#troubleshooting)
12. [Cost Breakdown](#cost-breakdown)

---

## Architecture Overview

###Production Stack

```
┌─────────────────────────────────────────────────┐
│                  DigitalOcean                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │          Droplet (Ubuntu 22.04)        │   │
│  │                                         │   │
│  │  ┌──────────┐      ┌──────────────┐   │   │
│  │  │  Nginx   │─────▶│  Node.js API │   │   │
│  │  │(Reverse  │      │   (PM2)      │   │   │
│  │  │ Proxy)   │      │   Port 3000  │   │   │
│  │  └──────────┘      └──────────────┘   │   │
│  │       │                     │          │   │
│  │    Port 80/443         ┌───┴────┐     │   │
│  │                        │Uploads │     │   │
│  │                        │ /var/... │   │   │
│  └─────────────────────────────────────────┘   │
│                           │                     │
│                           ▼                     │
│  ┌─────────────────────────────────────────┐   │
│  │    Managed PostgreSQL Database          │   │
│  │    (2GB RAM, 1 vCPU, 25GB storage)     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │         Spaces Object Storage           │   │
│  │    (Optional: For file uploads)        │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
         │
         ▼
    Cloudflare CDN (Optional)
```

### Components

| Component | Service | Purpose |
|-----------|---------|---------|
| **Compute** | Droplet | Runs Node.js API + Nginx |
| **Database** | Managed PostgreSQL | Data persistence |
| **Storage** | Droplet local or Spaces | File uploads |
| **CDN** | Cloudflare (optional) | Static assets + DDoS protection |
| **DNS** | DigitalOcean DNS | Domain management |
| **SSL** | Let's Encrypt | Free SSL certificates |

---

## Prerequisites

### Required Accounts
- ✅ DigitalOcean account ([Signup](https://www.digitalocean.com/))
- ✅ Domain name (from Namecheap, GoDaddy, etc.)
- ✅ GitHub account (for code repository)

### Local Tools
- ✅ SSH client (Terminal on macOS/Linux, PuTTY on Windows)
- ✅ Git installed locally
- ✅ Node.js 18+ installed (for building frontend)

### Budget
- **Minimum:** $24/month (Basic Droplet + Managed DB)
- **Recommended:** $48/month (Includes Spaces storage + backups)

---

## Infrastructure Setup

### Step 1: Create a Droplet

**1.1 Choose Plan:**
```
DigitalOcean Console → Create → Droplets

Distribution: Ubuntu 22.04 LTS
Plan Type: Basic
CPU Options: Regular with SSD
Size: $12/month (2GB RAM, 1 vCPU, 50GB SSD)
```

**1.2 Configure:**
```
Datacenter: Choose closest to your users
Authentication: SSH keys (generate if needed)
Hostname: taskmanager-prod
Tags: production, nodejs, api
```

**1.3 Generate SSH Key (if needed):**
```bash
# On your local machine
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to DigitalOcean: Settings → Security → SSH Keys
```

**1.4 Create Droplet**
- Click "Create Droplet"
- Wait 1-2 minutes for provisioning
- Note the IP address (e.g., `142.93.123.45`)

### Step 2: Initial Server Setup

**2.1 Connect to Droplet:**
```bash
ssh root@YOUR_DROPLET_IP
```

**2.2 Update System:**
```bash
apt update && apt upgrade -y
```

**2.3 Create Non-Root User:**
```bash
# Create user
adduser taskmanager

# Add to sudo group
usermod -aG sudo taskmanager

# Setup SSH for new user
rsync --archive --chown=taskmanager:taskmanager ~/.ssh /home/taskmanager

# Switch to new user
su - taskmanager
```

**2.4 Configure Firewall:**
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### Step 3: Install Dependencies

**3.1 Install Node.js 18:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v18.x
npm --version
```

**3.2 Install Nginx:**
```bash
sudo apt install -y nginx
sudo systemctl status nginx
```

**3.3 Install PM2:**
```bash
sudo npm install -g pm2
pm2 --version
```

**3.4 Install FFmpeg (for video compression):**
```bash
sudo apt install -y ffmpeg
ffmpeg -version
```

**3.5 Install Git:**
```bash
sudo apt install -y git
```

---

## Database Setup

### Option A: Managed PostgreSQL (Recommended)

**A.1 Create Database:**
```
DigitalOcean Console → Databases → Create Database Cluster

Engine: PostgreSQL 15
Plan: Basic ($15/month - 1GB RAM, 10GB storage)
Datacenter: Same as Droplet
Database name: taskmanager
```

**A.2 Configure Firewall:**
```
Database Settings → Trusted Sources
Add: Your Droplet's IP address
```

**A.3 Get Connection Details:**
```
Database → Connection Details

Host: db-postgresql-nyc1-12345.ondigitalocean.com
Port: 25060
Database: taskmanager
User: doadmin
Password: [auto-generated]
```

**A.4 Test Connection:**
```bash
# Install PostgreSQL client on Droplet
sudo apt install -y postgresql-client

# Test connection
psql -h YOUR_DB_HOST -U doadmin -d taskmanager
```

### Option B: Self-Hosted PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE taskmanager;
CREATE USER taskmanager_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager_user;
\q
```

---

## Application Deployment

### Step 1: Clone Repository

```bash
cd /home/taskmanager
git clone https://github.com/YOUR_USERNAME/TaskManager.git
cd TaskManager/backend
```

### Step 2: Configure Environment

**Create production .env:**
```bash
nano .env
```

**Add configuration:**
```env
NODE_ENV=production
PORT=3000

# Database (Managed PostgreSQL)
DB_HOST=db-postgresql-nyc1-12345.ondigitalocean.com
DB_PORT=25060
DB_NAME=taskmanager
DB_USER=doadmin
DB_PASSWORD=YOUR_DB_PASSWORD
DB_SSL=true

# JWT
JWT_SECRET=your_super_secure_random_string_here_min_32_chars
JWT_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=10485760

# Uploads Directory
UPLOADS_DIR=/var/taskmanager/uploads
```

**Generate secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Install Dependencies

```bash
npm install --production
```

### Step 4: Build TypeScript

```bash
npm run build
```

### Step 5: Run Migrations

```bash
npm run db:migrate
```

### Step 6: Seed Database (Optional)

```bash
# Only for testing - skip in production
npm run db:seed
```

### Step 7: Setup Uploads Directory

```bash
sudo mkdir -p /var/taskmanager/uploads
sudo chown -R taskmanager:taskmanager /var/taskmanager
chmod 755 /var/taskmanager/uploads
```

### Step 8: Test Application

```bash
npm start

# In another terminal:
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## Web Server Configuration

### Step 1: Configure Nginx

**Create Nginx config:**
```bash
sudo nano /etc/nginx/sites-available/taskmanager
```

**Add configuration:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # File upload size limit
    client_max_body_size 50M;

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout for video compression
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }

    # Static file uploads
    location /uploads {
        alias /var/taskmanager/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 2: Configure DNS

**In DigitalOcean:**
```
Networking → Domains → Add Domain

Domain: yourdomain.com

Add A Records:
api.yourdomain.com → YOUR_DROPLET_IP
```

**Or in your DNS provider:**
```
Type: A
Name: api
Value: YOUR_DROPLET_IP
TTL: 3600
```

---

## SSL/TLS Setup

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d api.yourdomain.com
```

**Follow prompts:**
- Enter email address
- Agree to terms
- Choose redirect HTTP to HTTPS: Yes

### Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Renewal runs automatically via systemd timer
sudo systemctl status certbot.timer
```

### Verify SSL

```bash
curl https://api.yourdomain.com/health
```

---

## Process Management

### Step 1: Create PM2 Ecosystem

```bash
cd /home/taskmanager/TaskManager/backend
nano ecosystem.config.js
```

**Add configuration:**
```javascript
module.exports = {
  apps: [{
    name: 'taskmanager-api',
    script: 'dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/taskmanager/error.log',
    out_file: '/var/log/taskmanager/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false
  }]
};
```

### Step 2: Setup Logging

```bash
sudo mkdir -p /var/log/taskmanager
sudo chown taskmanager:taskmanager /var/log/taskmanager
```

### Step 3: Start Application

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Copy and run the generated command
```

### Step 4: PM2 Management

```bash
# View logs
pm2 logs

# Restart
pm2 restart taskmanager-api

# Stop
pm2 stop taskmanager-api

# Monitor
pm2 monit

# Status
pm2 status
```

---

## Backups & Monitoring

### Database Backups (Managed PostgreSQL)

**Automatic:**
- Daily backups included (7-day retention)
- Accessible via: Database → Backups → Restore

**Manual Backup:**
```bash
# Export database
pg_dump -h YOUR_DB_HOST -U doadmin -d taskmanager > backup_$(date +%Y%m%d).sql

# Restore
psql -h YOUR_DB_HOST -U doadmin -d taskmanager < backup_YYYYMMDD.sql
```

### File Backups

**Setup Spaces (Object Storage):**
```
DigitalOcean → Spaces → Create Space

Name: taskmanager-uploads
Region: Same as Droplet
CDN: Enabled

Cost: $5/month (250GB storage, 1TB transfer)
```

**Sync uploads to Spaces:**
```bash
# Install s3cmd
sudo apt install -y s3cmd

# Configure
s3cmd --configure
# Enter Space access key and secret from API → Tokens

# Sync command
s3cmd sync /var/taskmanager/uploads/ s3://taskmanager-uploads/

# Add to cron (daily at 2 AM)
crontab -e
0 2 * * * s3cmd sync /var/taskmanager/uploads/ s3://taskmanager-uploads/
```

### Monitoring Setup

**1. PM2 Monitoring (Free):**
```bash
pm2 link YOUR_PM2_KEY YOUR_PM2_SECRET
# Get keys from https://app.pm2.io
```

**2. DigitalOcean Monitoring:**
```
Droplet → Monitoring → Enable

Alerts:
- CPU > 80% for 5 minutes
- Memory > 90% for 5 minutes
- Disk > 90%
```

**3. Log Rotation:**
```bash
sudo nano /etc/logrotate.d/taskmanager
```

```
/var/log/taskmanager/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 taskmanager taskmanager
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Scaling & Optimization

### Vertical Scaling (Upgrade Droplet)

```
Droplet → Resize

Options:
- $24/month: 4GB RAM, 2 vCPU (supports more concurrent users)
- $48/month: 8GB RAM, 4 vCPU (high traffic)
```

### Horizontal Scaling (Load Balancer)

```
Create → Load Balancers

Forwarding Rules: HTTPS → HTTP (port 3000)
Health Checks: /health
Sticky Sessions: Enabled
Droplets: Add multiple Droplets running the API

Cost: $12/month
```

### Database Scaling

```
Database → Resize

Options:
- $30/month: 2GB RAM, 25GB storage
- $55/month: 4GB RAM, 38GB storage
```

### CDN Setup (Cloudflare)

**1. Add domain to Cloudflare (free plan)**

**2. Update DNS:**
```
Cloudflare DNS:
api.yourdomain.com → YOUR_DROPLET_IP (Proxied: ON)
```

**3. Configure SSL:**
```
SSL/TLS → Full (strict)
Edge Certificates → Always Use HTTPS: ON
```

**4. Cache Rules:**
```
/uploads/* → Cache Level: Standard, Edge TTL: 30 days
/api/* → Cache Level: Bypass
```

---

## Troubleshooting

### API Not Responding

```bash
# Check if process is running
pm2 status

# Check logs
pm2 logs

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check port
sudo netstat -tulpn | grep 3000
```

### Database Connection Issues

```bash
# Test connection
psql -h YOUR_DB_HOST -U doadmin -d taskmanager

# Check firewall
sudo ufw status

# Check environment variables
cat /home/taskmanager/TaskManager/backend/.env
```

### File Upload Errors

```bash
# Check permissions
ls -la /var/taskmanager/uploads

# Fix permissions
sudo chown -R taskmanager:taskmanager /var/taskmanager
chmod 755 /var/taskmanager/uploads

# Check disk space
df -h
```

### SSL Certificate Issues

```bash
# Check certificate
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check Nginx config
sudo nginx -t
```

---

## Cost Breakdown

### Monthly Costs

| Component | Plan | Cost |
|-----------|------|------|
| **Droplet** | Basic (2GB RAM) | $12/month |
| **Managed PostgreSQL** | Basic (1GB RAM) | $15/month |
| **Spaces (Optional)** | 250GB storage | $5/month |
| **Backups (Optional)** | Droplet snapshots | $2.40/month |
| **Load Balancer (Optional)** | - | $12/month |
| **Domain** | Annual | $12-15/year |
| | | |
| **Minimum Total** | Droplet + DB | **$27/month** |
| **Recommended** | + Spaces + Backups | **$34/month** |
| **High Availability** | + Load Balancer | **$46/month** |

### Annual Costs

- **Basic:** $324/year + domain
- **Recommended:** $408/year + domain
- **High Availability:** $552/year + domain

---

## Security Checklist

- ✅ SSH key authentication (disable password auth)
- ✅ Firewall configured (UFW)
- ✅ Non-root user created
- ✅ SSL/TLS certificates (Let's Encrypt)
- ✅ Secure JWT secret (32+ characters)
- ✅ Database password rotation (quarterly)
- ✅ Regular updates (`apt update && apt upgrade`)
- ✅ Database firewall (whitelist Droplet IP only)
- ✅ Nginx security headers configured
- ✅ PM2 process isolation
- ✅ Log rotation enabled
- ✅ Backups automated

---

## Deployment Checklist

### Pre-Deployment
- [ ] Code tested locally
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificate obtained
- [ ] DNS configured
- [ ] Monitoring setup

### Deployment
- [ ] Pull latest code
- [ ] Install dependencies
- [ ] Build TypeScript
- [ ] Run migrations
- [ ] Restart PM2
- [ ] Clear Nginx cache
- [ ] Test health endpoint

### Post-Deployment
- [ ] Verify application loads
- [ ] Test user login
- [ ] Test file uploads
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Update documentation

---

## Maintenance Schedule

### Daily
- Review error logs
- Check PM2 status
- Monitor disk space

### Weekly
- Review access logs
- Check backup success
- Update dependencies (patch versions)

### Monthly
- Security updates (`apt upgrade`)
- Database performance review
- Cost analysis

### Quarterly
- Rotate credentials
- Review scaling needs
- Update documentation

---

## Support Resources

- **DigitalOcean Docs:** https://docs.digitalocean.com
- **Community Forum:** https://www.digitalocean.com/community
- **PM2 Docs:** https://pm2.keymetrics.io
- **Nginx Docs:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-20
**Next Review:** 2026-01-20
