# Task Manager Deployment Options

Complete deployment guide with two setup options for different budgets and operational requirements.

**Last Updated:** 2025-11-20
**Target Scale:** 50-500 active users

---

## Table of Contents

1. [Deployment Options Overview](#deployment-options-overview)
2. [Option 1: Minimal Setup ($17/month)](#option-1-minimal-setup-17month)
3. [Option 2: Managed Setup ($47/month)](#option-2-managed-setup-47month)
4. [Comparison & Recommendations](#comparison--recommendations)
5. [Migration Path (Option 1 → Option 2)](#migration-path-option-1--option-2)

---

## Deployment Options Overview

### Option 1: Minimal Setup ($17/month)

**Best for:**
- MVP testing and early stage
- Budget-conscious deployments
- 50-200 active users
- Developers comfortable with DevOps

**Infrastructure:**
- 1 Droplet (2GB RAM, 1 vCPU)
- PostgreSQL on Droplet (self-managed)
- Spaces 250GB storage
- Let's Encrypt SSL

**Monthly Cost:** $17/month ($204/year)

### Option 2: Managed Setup ($47/month)

**Best for:**
- Production applications
- Less DevOps overhead
- 50-500 active users
- Business-critical operations

**Infrastructure:**
- 1 Droplet (2GB RAM, 1 vCPU)
- Managed PostgreSQL (1GB)
- Spaces 1TB storage
- Let's Encrypt SSL

**Monthly Cost:** $47/month ($564/year)

---

## Option 1: Minimal Setup ($17/month)

### Cost Breakdown

```
DigitalOcean Droplet (2GB RAM, 1 vCPU)   $12/month
Spaces Object Storage (250GB)             $5/month
SSL Certificate (Let's Encrypt)           Free
─────────────────────────────────────────────────
TOTAL:                                   $17/month
```

### Architecture

```
┌─────────────────────────────────────────┐
│    DigitalOcean Droplet (Ubuntu)       │
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │  Nginx   │─────▶│  Node.js API │   │
│  │ (Port 80)│      │   (PM2)      │   │
│  │  + SSL   │      │  Port 3000   │   │
│  └──────────┘      └──────────────┘   │
│       │                    │           │
│       │            ┌───────┴────────┐  │
│       │            │  PostgreSQL    │  │
│       │            │  (Local DB)    │  │
│       │            └────────────────┘  │
│       │                                │
└───────┼────────────────────────────────┘
        │
        ▼
  Spaces (250GB)
  File Storage
```

### Step 1: Create Droplet

**Via DigitalOcean Dashboard:**

1. Go to https://cloud.digitalocean.com/droplets/new
2. **Choose Image:** Ubuntu 22.04 LTS
3. **Choose Plan:**
   - Basic
   - Regular SSD
   - $12/month (2GB RAM / 1 vCPU / 50GB SSD)
4. **Datacenter:** Choose closest to your users
   - New York (US East)
   - San Francisco (US West)
   - Frankfurt (Europe)
   - Singapore (Asia)
5. **Authentication:** SSH Key (recommended) or Password
6. **Hostname:** `taskmanager-prod`
7. Click **Create Droplet**

**Note your Droplet IP:** `123.456.789.101` (example)

### Step 2: Initial Server Setup

Connect to your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

Update system packages:

```bash
apt update && apt upgrade -y
```

Create a non-root user:

```bash
adduser taskmanager
usermod -aG sudo taskmanager
```

Configure firewall:

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Switch to the new user:

```bash
su - taskmanager
```

### Step 3: Install Dependencies

**Install Node.js 18:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**Install PostgreSQL:**

```bash
sudo apt install -y postgresql postgresql-contrib
```

**Install Nginx:**

```bash
sudo apt install -y nginx
```

**Install PM2 globally:**

```bash
sudo npm install -g pm2
```

**Install FFmpeg (for video compression):**

```bash
sudo apt install -y ffmpeg
```

**Install Git:**

```bash
sudo apt install -y git
```

Verify installations:

```bash
node --version    # Should show v18.x.x
npm --version
psql --version
nginx -v
pm2 --version
ffmpeg -version
```

### Step 4: Setup PostgreSQL

**Set PostgreSQL password:**

```bash
sudo -u postgres psql
```

In PostgreSQL prompt:

```sql
ALTER USER postgres WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE taskmanager;
\q
```

**Configure PostgreSQL for local connections:**

Edit `pg_hba.conf`:

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Find the line:
```
local   all             postgres                                peer
```

Change to:
```
local   all             postgres                                md5
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

**Test connection:**

```bash
psql -U postgres -d taskmanager -h localhost
# Enter password when prompted
# Type \q to exit
```

### Step 5: Setup Spaces Storage

**Via DigitalOcean Dashboard:**

1. Go to **Spaces** → **Create a Space**
2. **Region:** Choose same as your Droplet
3. **Name:** `taskmanager-uploads`
4. **File Listing:** Private (Restricted)
5. **CDN:** Enabled
6. Click **Create Space**

**Create Spaces Access Keys:**

1. Go to **API** → **Spaces Keys**
2. Click **Generate New Key**
3. **Name:** `taskmanager-backend`
4. Save the **Key** and **Secret** (you'll need these)

### Step 6: Deploy Backend Application

**Clone repository:**

```bash
cd /home/taskmanager
git clone https://github.com/YOUR_USERNAME/TaskManager.git
cd TaskManager/backend
```

**Install dependencies:**

```bash
npm install
```

**Create environment file:**

```bash
nano .env
```

Add configuration:

```env
# Server
NODE_ENV=production
PORT=3000

# Database (Local PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here_min_32_characters

# File Upload (Local + Spaces)
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760

# DigitalOcean Spaces (Optional - for offloading storage)
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=taskmanager-uploads
SPACES_KEY=your_spaces_key_here
SPACES_SECRET=your_spaces_secret_here
SPACES_REGION=nyc3

# Compression
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
```

**Create uploads directory:**

```bash
mkdir -p /home/taskmanager/uploads
chmod 755 /home/taskmanager/uploads
```

**Run database migrations:**

```bash
npm run db:migrate
```

**Seed initial data (optional):**

```bash
npm run db:seed
```

**Build TypeScript:**

```bash
npm run build
```

**Test the application:**

```bash
npm start
```

Press `Ctrl+C` to stop once verified.

### Step 7: Configure PM2

**Start application with PM2:**

```bash
pm2 start dist/index.js --name taskmanager-api
```

**Configure PM2 to restart on reboot:**

```bash
pm2 startup
# Copy and run the command it outputs
pm2 save
```

**Verify PM2 status:**

```bash
pm2 status
pm2 logs taskmanager-api
```

### Step 8: Configure Nginx

**Create Nginx configuration:**

```bash
sudo nano /etc/nginx/sites-available/taskmanager
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Increase upload size limit
    client_max_body_size 10M;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeout for video uploads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Serve uploaded files
    location /uploads/ {
        alias /home/taskmanager/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Web app (will add later)
    location / {
        root /home/taskmanager/TaskManager/web/build;
        try_files $uri $uri/ /index.html;
    }
}
```

**Enable the site:**

```bash
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 9: Setup SSL with Let's Encrypt

**Install Certbot:**

```bash
sudo apt install -y certbot python3-certbot-nginx
```

**Obtain SSL certificate:**

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow prompts:
- Enter email for renewal notifications
- Agree to Terms of Service
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

**Test auto-renewal:**

```bash
sudo certbot renew --dry-run
```

SSL certificates auto-renew via cron job.

### Step 10: Deploy Web Application

**Build web app locally:**

On your local machine:

```bash
cd /path/to/TaskManager/web

# Update API URL in .env
echo "REACT_APP_API_URL=https://your-domain.com/api" > .env

# Build production bundle
npm install
npm run build
```

**Upload to server:**

```bash
scp -r build taskmanager@YOUR_DROPLET_IP:/home/taskmanager/TaskManager/web/
```

**Or build on server:**

```bash
ssh taskmanager@YOUR_DROPLET_IP
cd /home/taskmanager/TaskManager/web
npm install
REACT_APP_API_URL=https://your-domain.com/api npm run build
```

**Restart Nginx:**

```bash
sudo systemctl restart nginx
```

### Step 11: Configure Backups

**Create backup script:**

```bash
nano /home/taskmanager/backup.sh
```

Add script:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/taskmanager/backups"
DB_NAME="taskmanager"
DB_USER="postgres"

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD='your_secure_password_here' pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/taskmanager/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable:

```bash
chmod +x /home/taskmanager/backup.sh
```

**Schedule daily backups:**

```bash
crontab -e
```

Add line:

```
0 2 * * * /home/taskmanager/backup.sh >> /home/taskmanager/backup.log 2>&1
```

This runs daily at 2 AM.

### Step 12: Verification

**Test the deployment:**

1. Visit `https://your-domain.com`
2. Register a new account
3. Create an organization
4. Create a task
5. Upload an image (test compression)
6. Upload a video (test async compression)
7. Check job status: `GET /api/processing/jobs/stats`

**Check logs:**

```bash
# PM2 logs
pm2 logs taskmanager-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Maintenance Tasks

**Weekly:**
- Check disk space: `df -h`
- Review PM2 logs: `pm2 logs`
- Check backup status: `ls -lh /home/taskmanager/backups`

**Monthly:**
- Update system packages: `sudo apt update && sudo apt upgrade`
- Review PostgreSQL performance
- Clean old log files

**As Needed:**
- Restart API: `pm2 restart taskmanager-api`
- Restart Nginx: `sudo systemctl restart nginx`
- Restart PostgreSQL: `sudo systemctl restart postgresql`

---

## Option 2: Managed Setup ($47/month)

### Cost Breakdown

```
DigitalOcean Droplet (2GB RAM, 1 vCPU)   $12/month
Managed PostgreSQL (Basic 1GB)          $15/month
Spaces Object Storage (1TB)             $20/month
SSL Certificate (Let's Encrypt)          Free
─────────────────────────────────────────────────
TOTAL:                                  $47/month
```

### Architecture

```
┌─────────────────────────────────────────┐
│    DigitalOcean Droplet (Ubuntu)       │
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │  Nginx   │─────▶│  Node.js API │   │
│  │ (Port 80)│      │   (PM2)      │   │
│  │  + SSL   │      │  Port 3000   │   │
│  └──────────┘      └──────────────┘   │
│       │                    │           │
└───────┼────────────────────┼───────────┘
        │                    │
        │                    ▼
        │         ┌──────────────────────┐
        │         │ Managed PostgreSQL   │
        │         │   (1GB RAM)          │
        │         │ - Auto backups       │
        │         │ - High availability  │
        │         └──────────────────────┘
        │
        ▼
  Spaces (1TB)
  File Storage + CDN
```

### Benefits over Option 1

**Managed PostgreSQL:**
- ✅ Automatic daily backups (7-day retention)
- ✅ Point-in-time recovery
- ✅ Automatic updates and patches
- ✅ High availability option
- ✅ Connection pooling
- ✅ Performance monitoring
- ✅ No manual maintenance

**1TB Storage:**
- ✅ Room to grow (vs 250GB)
- ✅ Supports ~333,000 photos (3MB each)
- ✅ Built-in CDN for faster delivery
- ✅ No expansion needed for years

### Deployment Steps (Differences from Option 1)

Follow **Option 1 Steps 1-3** (Droplet creation and dependency installation).

**Skip Step 4 (PostgreSQL setup)** - use Managed Database instead.

### Step 4-ALT: Create Managed PostgreSQL Database

**Via DigitalOcean Dashboard:**

1. Go to **Databases** → **Create a Database Cluster**
2. **Database Engine:** PostgreSQL 14
3. **Plan:**
   - Basic
   - 1 GB RAM / 1 vCPU / 10 GB Disk
   - $15/month
4. **Datacenter:** Same as your Droplet
5. **Database Name:** `taskmanager`
6. **Enable Backups:** Yes (automatic)
7. Click **Create Database Cluster**

**Wait for provisioning** (5-10 minutes)

**Get Connection Details:**

1. Click on your database cluster
2. Go to **Connection Details**
3. Note:
   - Host (e.g., `db-postgresql-nyc3-12345-do-user-67890-0.b.db.ondigitalocean.com`)
   - Port (usually `25060`)
   - Database: `taskmanager`
   - Username: `doadmin`
   - Password: (click to reveal)

**Add Droplet to Trusted Sources:**

1. In database dashboard, go to **Settings**
2. Scroll to **Trusted Sources**
3. Add your Droplet
4. Click **Save**

### Modified .env Configuration

```env
# Server
NODE_ENV=production
PORT=3000

# Managed Database (Updated)
DB_HOST=db-postgresql-nyc3-12345-do-user-67890-0.b.db.ondigitalocean.com
DB_PORT=25060
DB_NAME=taskmanager
DB_USER=doadmin
DB_PASSWORD=your_managed_db_password_here
DB_SSL=true

# JWT Secret
JWT_SECRET=your_jwt_secret_here_min_32_characters

# File Upload (Spaces primary)
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760

# DigitalOcean Spaces (1TB)
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=taskmanager-uploads
SPACES_KEY=your_spaces_key_here
SPACES_SECRET=your_spaces_secret_here
SPACES_REGION=nyc3
USE_SPACES_PRIMARY=true

# Compression
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
```

### Database Connection Update

Update `backend/src/database/index.ts` to support SSL:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export default pool;
```

**Continue with Option 1 Steps 6-12** (deployment, Nginx, SSL, web app).

### Backup Management (Simplified)

**No manual backups needed!** Managed PostgreSQL includes:
- Automatic daily backups
- 7-day retention
- Point-in-time recovery

**Access backups:**
1. Go to your database cluster
2. Click **Backups** tab
3. View/restore any backup

**Still backup uploads:**

```bash
# Create upload backup script
nano /home/taskmanager/backup_uploads.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/taskmanager/backups"

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/taskmanager/uploads
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete

echo "Upload backup completed: $DATE"
```

Schedule weekly:

```bash
crontab -e
```

Add:
```
0 3 * * 0 /home/taskmanager/backup_uploads.sh >> /home/taskmanager/backup.log 2>&1
```

---

## Comparison & Recommendations

### Feature Comparison

| Feature | Option 1 ($17/month) | Option 2 ($47/month) |
|---------|---------------------|---------------------|
| **Droplet** | 2GB RAM, 1 vCPU | 2GB RAM, 1 vCPU |
| **Database** | Self-managed PostgreSQL | Managed PostgreSQL |
| **Storage** | 250GB Spaces | 1TB Spaces |
| **Backups** | Manual scripts | Automatic (DB) |
| **Maintenance** | High (manual) | Low (managed) |
| **High Availability** | No | Optional upgrade |
| **Monitoring** | Manual | Built-in dashboard |
| **Support Capacity** | 50-200 users | 50-500 users |
| **DevOps Skill** | Intermediate | Beginner |
| **Setup Time** | 2-3 hours | 2 hours |
| **Best For** | MVP, tight budget | Production, growth |

### When to Choose Option 1

✅ **Choose Option 1 if:**
- Testing MVP with 50-100 users
- Tight budget ($200/year vs $550/year)
- Comfortable managing PostgreSQL
- Can handle manual backups
- Don't need 24/7 reliability yet
- Willing to migrate later

### When to Choose Option 2

✅ **Choose Option 2 if:**
- Production application
- 50+ active users
- Want peace of mind (auto backups)
- Less DevOps experience
- Need to focus on product, not infrastructure
- Plan to grow to 500+ users
- Business-critical data

### My Recommendation

**For 50 users starting out:**
- Start with **Option 1** if budget is primary concern
- Start with **Option 2** if you want production-grade reliability

**Most teams should choose Option 2** because:
- Only $30/month more ($1/day)
- Eliminates backup headaches
- Room to grow 10x
- Better sleep at night (auto backups)
- Easier to manage

---

## Migration Path (Option 1 → Option 2)

### When to Migrate

Migrate from Option 1 to Option 2 when:
- Approaching 200 active users
- Database exceeds 5GB
- Need better reliability
- Storage approaching 250GB limit
- Tired of manual maintenance

### Migration Steps

**1. Create Managed Database**

Follow "Step 4-ALT" above to create managed PostgreSQL.

**2. Backup Current Database**

```bash
# On your droplet
pg_dump -U postgres -h localhost taskmanager > /tmp/taskmanager_backup.sql
```

**3. Restore to Managed Database**

```bash
# Get managed DB connection string
psql "postgresql://doadmin:PASSWORD@HOST:25060/taskmanager?sslmode=require" < /tmp/taskmanager_backup.sql
```

**4. Update .env**

Update `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and add `DB_SSL=true`.

**5. Restart Application**

```bash
pm2 restart taskmanager-api
pm2 logs
```

**6. Verify**

- Test login
- Create test task
- Upload file
- Check data integrity

**7. Upgrade Spaces (Optional)**

If you need more than 250GB:
1. Go to Spaces dashboard
2. Usage is automatically billed
3. No action needed - scales automatically

**8. Remove Local PostgreSQL (Optional)**

```bash
sudo systemctl stop postgresql
sudo systemctl disable postgresql
```

**Total Downtime:** ~5-10 minutes

---

## Production Checklist

### Pre-Launch

**Option 1:**
- [ ] Droplet created and configured
- [ ] PostgreSQL installed and secured
- [ ] Backup script configured and tested
- [ ] Cron job scheduled for daily backups
- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Application deployed and running
- [ ] PM2 configured for auto-restart
- [ ] Nginx configured and tested
- [ ] Test backup restoration

**Option 2:**
- [ ] Droplet created and configured
- [ ] Managed database created
- [ ] Droplet added to trusted sources
- [ ] Database backups enabled
- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] Application deployed and running
- [ ] PM2 configured for auto-restart
- [ ] Nginx configured and tested
- [ ] Spaces storage configured
- [ ] Verify automatic backups

### Post-Launch

**Weekly:**
- [ ] Review PM2 logs: `pm2 logs`
- [ ] Check disk usage: `df -h`
- [ ] Monitor error logs: `tail -f /var/log/nginx/error.log`
- [ ] Review backup status

**Monthly:**
- [ ] System updates: `sudo apt update && sudo apt upgrade`
- [ ] Review database performance
- [ ] Check storage usage (Spaces)
- [ ] Test backup restoration
- [ ] Review SSL certificate expiry
- [ ] Analyze traffic patterns

**Quarterly:**
- [ ] Review infrastructure costs
- [ ] Consider scaling needs
- [ ] Update dependencies
- [ ] Security audit
- [ ] Performance optimization

---

## Monitoring & Alerts

### Basic Monitoring (Free)

**DigitalOcean Dashboard:**
- Droplet CPU, memory, disk usage
- Database connections, query performance
- Spaces storage usage, bandwidth

**PM2 Monitoring:**

```bash
pm2 monit  # Real-time monitoring
```

### Advanced Monitoring (Optional)

**Install monitoring tools:**

```bash
# Uptime monitoring
sudo npm install -g uptimerobot-cli

# Log aggregation
sudo apt install -y logwatch
```

**Recommended Services:**
- [UptimeRobot](https://uptimerobot.com/) - Free uptime monitoring
- [Sentry](https://sentry.io/) - Error tracking (free tier)
- [LogRocket](https://logrocket.com/) - Session replay

---

## Troubleshooting

### Common Issues

**Issue: Can't connect to managed database**
```bash
# Check trusted sources includes your Droplet
# Check connection string in .env
# Test connection:
psql "postgresql://USER:PASS@HOST:PORT/DB?sslmode=require"
```

**Issue: Uploads failing**
```bash
# Check uploads directory permissions
ls -la /home/taskmanager/uploads
chmod 755 /home/taskmanager/uploads
```

**Issue: API not responding**
```bash
# Check PM2 status
pm2 status
pm2 restart taskmanager-api

# Check logs
pm2 logs taskmanager-api --lines 100
```

**Issue: SSL certificate expired**
```bash
# Renew manually
sudo certbot renew

# Check auto-renewal
sudo systemctl status certbot.timer
```

**Issue: Database backup failed (Option 1)**
```bash
# Check backup script logs
cat /home/taskmanager/backup.log

# Test backup manually
/home/taskmanager/backup.sh
```

**Issue: Out of disk space**
```bash
# Check usage
df -h

# Clean PM2 logs
pm2 flush

# Clean old backups
find /home/taskmanager/backups -mtime +7 -delete

# Clean apt cache
sudo apt clean
```

---

## Cost Projection by User Growth

| Active Users | Option | Monthly Cost | Annual Cost |
|--------------|--------|--------------|-------------|
| 50 | Option 1 | $17 | $204 |
| 50 | Option 2 | $47 | $564 |
| 200 | Option 1 | $17 | $204 |
| 200 | Option 2 | $47 | $564 |
| 500 | Option 2 | $47-75 | $564-900 |
| 1,000 | Upgraded | $128 | $1,536 |
| 5,000 | Enterprise | $400+ | $4,800+ |

**Note:** Costs remain flat until you need to upgrade Droplet/DB tier for performance.

---

## Next Steps

**Getting Started:**

1. **Choose your option** (Option 1 or Option 2)
2. **Sign up for DigitalOcean** (use referral for $200 credit)
3. **Follow deployment steps** for your chosen option
4. **Configure domain and SSL**
5. **Deploy and test**
6. **Set up monitoring**
7. **Launch!**

**Need Help?**
- DigitalOcean Community: https://www.digitalocean.com/community
- Task Manager Docs: See `/README.md`
- Support: Review logs and troubleshooting section

---

**Document Version:** 2.0.0
**Last Updated:** 2025-11-20
