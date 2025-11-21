# Quick Start: Minimal Deployment ($17/month)

Streamlined deployment guide for getting the Task Manager running on DigitalOcean with minimal cost.

**Target:** 50-200 active users
**Monthly Cost:** $17 ($12 Droplet + $5 Spaces)
**Setup Time:** ~2 hours

---

## Prerequisites

- [ ] DigitalOcean account ([Sign up](https://www.digitalocean.com/))
- [ ] Domain name (or use Droplet IP for testing)
- [ ] SSH client (Terminal/PuTTY)
- [ ] Your Task Manager code repository

---

## Quick Setup Checklist

### 1. Create Droplet (5 minutes)

**DigitalOcean Dashboard → Create → Droplet**

- Image: **Ubuntu 22.04 LTS**
- Size: **Basic** → $12/month (2GB RAM, 1 vCPU, 50GB SSD)
- Datacenter: **Closest to your users**
- Authentication: **SSH Key** (recommended) or Password
- Hostname: `taskmanager-prod`

**Save your Droplet IP:** `___.___.___.___`

### 2. Initial Server Setup (10 minutes)

```bash
# Connect to droplet
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Create user
adduser taskmanager
usermod -aG sudo taskmanager

# Configure firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Switch to user
su - taskmanager
```

### 3. Install Dependencies (10 minutes)

```bash
# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# PM2
sudo npm install -g pm2

# FFmpeg (for video compression)
sudo apt install -y ffmpeg

# Git
sudo apt install -y git

# Verify
node --version && npm --version && psql --version
```

### 4. Setup PostgreSQL (5 minutes)

```bash
# Set password
sudo -u postgres psql
```

```sql
ALTER USER postgres WITH PASSWORD 'YourSecurePassword123!';
CREATE DATABASE taskmanager;
\q
```

```bash
# Configure authentication
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Change this line:
```
local   all             postgres                                peer
```
To:
```
local   all             postgres                                md5
```

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Test connection
psql -U postgres -d taskmanager -h localhost
# Enter password, type \q to exit
```

### 5. Create Spaces Storage (5 minutes)

**DigitalOcean Dashboard → Spaces → Create**

- Region: **Same as Droplet**
- Name: `taskmanager-uploads`
- File Listing: **Private**
- CDN: **Enabled**

**Create Access Keys:**
- API → Spaces Keys → Generate New Key
- Name: `taskmanager-backend`
- **Save Key and Secret**

### 6. Deploy Application (15 minutes)

```bash
# Clone your repository
cd /home/taskmanager
git clone https://github.com/YOUR_USERNAME/TaskManager.git
cd TaskManager/backend

# Install dependencies
npm install

# Create .env file
nano .env
```

**Paste this configuration** (update values):

```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=postgres
DB_PASSWORD=YourSecurePassword123!

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=GENERATE_A_RANDOM_32_CHARACTER_STRING_HERE

# File Upload
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760

# Spaces
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=taskmanager-uploads
SPACES_KEY=YOUR_SPACES_KEY_HERE
SPACES_SECRET=YOUR_SPACES_SECRET_HERE
SPACES_REGION=nyc3

# Compression
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
```

```bash
# Create uploads directory
mkdir -p /home/taskmanager/uploads
chmod 755 /home/taskmanager/uploads

# Run migrations
npm run db:migrate

# Optional: Seed test data
npm run db:seed

# Build
npm run build

# Test
npm start
# Press Ctrl+C once verified
```

### 7. Configure PM2 (5 minutes)

```bash
# Start with PM2
pm2 start dist/index.js --name taskmanager-api

# Configure auto-restart on reboot
pm2 startup
# Run the command it outputs (starts with sudo)
pm2 save

# Verify
pm2 status
pm2 logs taskmanager-api
```

### 8. Configure Nginx (10 minutes)

```bash
sudo nano /etc/nginx/sites-available/taskmanager
```

**Paste this configuration** (replace `your-domain.com`):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10M;

    # API
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }

    # Uploaded files
    location /uploads/ {
        alias /home/taskmanager/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Web app
    location / {
        root /home/taskmanager/TaskManager/web/build;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Setup SSL with Let's Encrypt (10 minutes)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts:
# 1. Enter email
# 2. Agree to Terms
# 3. Choose Yes to redirect HTTP to HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

### 10. Deploy Web App (15 minutes)

**Option A: Build on server**

```bash
cd /home/taskmanager/TaskManager/web

# Install dependencies
npm install

# Build (replace with your domain)
REACT_APP_API_URL=https://your-domain.com/api npm run build

# Restart Nginx
sudo systemctl restart nginx
```

**Option B: Build locally and upload**

```bash
# On your local machine
cd /path/to/TaskManager/web

# Create .env
echo "REACT_APP_API_URL=https://your-domain.com/api" > .env

# Build
npm install
npm run build

# Upload to server
scp -r build taskmanager@YOUR_DROPLET_IP:/home/taskmanager/TaskManager/web/
```

### 11. Setup Backups (10 minutes)

```bash
# Create backup script
nano /home/taskmanager/backup.sh
```

**Paste this:**

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/taskmanager/backups"
DB_NAME="taskmanager"
DB_USER="postgres"
DB_PASS="YourSecurePassword123!"

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=$DB_PASS pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/taskmanager/uploads

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /home/taskmanager/backup.sh

# Schedule daily backups (runs at 2 AM)
crontab -e
# Add this line:
0 2 * * * /home/taskmanager/backup.sh >> /home/taskmanager/backup.log 2>&1

# Test backup
/home/taskmanager/backup.sh
ls -lh /home/taskmanager/backups
```

### 12. Verification (5 minutes)

**Test your deployment:**

1. Visit `https://your-domain.com`
2. Register a new account
3. Create an organization
4. Create a task
5. Upload an image (test compression)
6. Upload a video (test async compression)

**Check logs:**

```bash
# API logs
pm2 logs taskmanager-api

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## Post-Deployment

### DNS Configuration

If using a custom domain, point your DNS to the Droplet:

**A Record:**
- Host: `@`
- Value: `YOUR_DROPLET_IP`

**A Record:**
- Host: `www`
- Value: `YOUR_DROPLET_IP`

DNS propagation takes 1-48 hours.

### Security Hardening

**Change SSH port (optional):**

```bash
sudo nano /etc/ssh/sshd_config
# Change Port 22 to Port 2222
sudo systemctl restart sshd
# Update firewall: ufw allow 2222/tcp
```

**Disable root login:**

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

**Enable automatic security updates:**

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### Monitoring

**Check system status:**

```bash
# Disk space
df -h

# Memory usage
free -h

# CPU load
htop

# PM2 status
pm2 status
pm2 monit

# Database connections
psql -U postgres -d taskmanager -c "SELECT count(*) FROM pg_stat_activity;"
```

### Maintenance Schedule

**Daily (Automated):**
- Database + uploads backup (2 AM)

**Weekly:**
- Check disk space: `df -h`
- Review logs: `pm2 logs`
- Verify backups: `ls -lh /home/taskmanager/backups`

**Monthly:**
- System updates: `sudo apt update && sudo apt upgrade`
- Clean old logs: `pm2 flush`
- Review database size: `sudo -u postgres psql -c "\l+"`

---

## Common Commands

```bash
# Restart API
pm2 restart taskmanager-api

# View logs (last 100 lines)
pm2 logs taskmanager-api --lines 100

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check API status
curl http://localhost:3000/health

# Run database migration
cd /home/taskmanager/TaskManager/backend
npm run db:migrate

# Manual backup
/home/taskmanager/backup.sh
```

---

## Troubleshooting

**API not responding:**
```bash
pm2 restart taskmanager-api
pm2 logs taskmanager-api
```

**Database connection error:**
```bash
psql -U postgres -d taskmanager -h localhost
# Verify password in .env matches
```

**Uploads failing:**
```bash
ls -la /home/taskmanager/uploads
chmod 755 /home/taskmanager/uploads
```

**SSL certificate issues:**
```bash
sudo certbot renew
sudo certbot certificates
```

**Out of disk space:**
```bash
# Clean PM2 logs
pm2 flush

# Clean old backups
find /home/taskmanager/backups -mtime +7 -delete

# Clean apt cache
sudo apt clean
```

---

## Upgrade to Managed Setup

When you're ready to upgrade to Option 2 ($47/month with managed database):

1. See [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md) → "Migration Path"
2. Create managed PostgreSQL database
3. Migrate data with `pg_dump` and restore
4. Update `.env` with new database credentials
5. Restart application
6. Total downtime: ~5-10 minutes

---

## Cost Breakdown

```
Monthly Costs:
  Droplet (2GB RAM)          $12
  Spaces (250GB)             $5
  SSL (Let's Encrypt)        $0
  ─────────────────────────────
  Total                      $17/month

Annual Cost:                 $204/year
```

**Capacity:**
- 50-200 active users
- 250GB storage (~83,000 photos at 3MB each)
- Unlimited bandwidth (for typical usage)

**When to upgrade:**
- Database exceeds 5GB
- Need automatic backups
- Approaching 250GB storage
- Want managed services

---

## Next Steps

✅ Your Task Manager is now deployed!

**Recommended:**
1. Set up monitoring ([UptimeRobot](https://uptimerobot.com/))
2. Configure email notifications (future feature)
3. Add custom branding
4. Test backup restoration
5. Share with your team!

**Need help?**
- Full guide: [DEPLOYMENT_OPTIONS.md](DEPLOYMENT_OPTIONS.md)
- Compression docs: [COMPRESSION_SYSTEM.md](COMPRESSION_SYSTEM.md)
- Main README: [README.md](README.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-20
