# TaskManager - Actual Digital Ocean Deployment Guide

This document reflects the **actual deployment process** used to deploy TaskManager to Digital Ocean at 165.22.46.130.

## Deployment Architecture

This deployment uses a **non-containerized** approach:
- **Backend**: Node.js with PM2 process manager
- **Frontend**: React build served by Nginx
- **Database**: PostgreSQL 14 (system installation)
- **Reverse Proxy**: Nginx

## Prerequisites

- Digital Ocean droplet (Ubuntu 22.04)
- SSH key configured: `~/.ssh/taskmanager_rsa`
- Droplet hostname: `taskmanager-prod`

## Deployment Steps

### 1. SSH Key Configuration

The deployment uses a specific SSH key (not the default):
```bash
# SSH key location
~/.ssh/taskmanager_rsa

# Connect to droplet
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP
```

### 2. Transfer Code to Droplet

Using rsync for efficient file transfer:

```bash
# Transfer backend code
rsync -avz --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  -e "ssh -i ~/.ssh/taskmanager_rsa" \
  ./backend/ root@YOUR_DROPLET_IP:/home/taskmanager/TaskManager/backend/

# Transfer web code
rsync -avz --exclude 'node_modules' \
  --exclude 'build' \
  -e "ssh -i ~/.ssh/taskmanager_rsa" \
  ./web/ root@YOUR_DROPLET_IP:/home/taskmanager/TaskManager/web/
```

### 3. Fix File Permissions

After transferring files as root, ownership must be changed:

```bash
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'chown -R taskmanager:taskmanager /home/taskmanager/TaskManager'
```

**Important**: This step is critical - npm install will fail with permission errors if files are owned by root.

### 4. Install Dependencies

```bash
# Backend dependencies
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager npm install'

# Web dependencies
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/web && sudo -u taskmanager npm install'
```

### 5. Configure Environment Variables

Create production `.env` file:

```bash
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP "cat > /home/taskmanager/TaskManager/backend/.env << 'EOF'
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=taskmanager
DB_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# JWT Configuration (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_SECURE_JWT_SECRET_HERE
JWT_EXPIRES_IN=7d

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
EOF"
```

**Generate secure secrets:**
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 32
```

### 6. Configure PostgreSQL

#### Fix PostgreSQL Authentication

The default configuration requires a password for the postgres user. Change to peer authentication:

```bash
# Edit pg_hba.conf
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'sed -i "s/^local   all             postgres                                md5/local   all             postgres                                peer/" /etc/postgresql/14/main/pg_hba.conf'

# Reload PostgreSQL
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'systemctl reload postgresql'
```

#### Create Database and User

```bash
# Start PostgreSQL if not running
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'systemctl start postgresql && systemctl enable postgresql'

# Create user
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "sudo -u postgres psql -c \"CREATE USER taskmanager WITH PASSWORD 'YOUR_PASSWORD';\""

# Create database
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "sudo -u postgres psql -c \"CREATE DATABASE taskmanager OWNER taskmanager;\""

# Grant privileges
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager;\""
```

#### Handle Existing Tables

If database already exists with tables owned by postgres:

```bash
# Transfer ownership to taskmanager user
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "sudo -u postgres psql -d taskmanager -c \"
    ALTER TABLE notifications OWNER TO taskmanager;
    ALTER TABLE organization_members OWNER TO taskmanager;
    ALTER TABLE organizations OWNER TO taskmanager;
    ALTER TABLE task_audit_logs OWNER TO taskmanager;
    ALTER TABLE task_completions OWNER TO taskmanager;
    ALTER TABLE task_requirements OWNER TO taskmanager;
    ALTER TABLE task_reviews OWNER TO taskmanager;
    ALTER TABLE tasks OWNER TO taskmanager;
    ALTER TABLE users OWNER TO taskmanager;
  \""
```

### 7. Build Applications

```bash
# Build backend TypeScript
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager npm run build'

# Build web frontend with HTTPS API URL
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/web && REACT_APP_API_URL=https://yourdomain.com/api sudo -u taskmanager npm run build'
```

### 8. Run Database Migrations

```bash
# Run schema migration
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager PGPASSWORD=YOUR_PASSWORD psql -h localhost -U taskmanager -d taskmanager -f src/database/schema.sql'

# Add missing columns (if needed)
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "sudo -u taskmanager PGPASSWORD=YOUR_PASSWORD psql -h localhost -U taskmanager -d taskmanager -c \"ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;\""

# Run additional migrations
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager PGPASSWORD=YOUR_PASSWORD psql -h localhost -U taskmanager -d taskmanager -f src/database/migrations/002_add_task_reviews.sql'
```

### 9. Configure PM2 for Backend

Create PM2 ecosystem configuration:

```bash
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP "cat > /home/taskmanager/TaskManager/backend/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'taskmanager-backend',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',  // Use fork mode, not cluster
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/taskmanager/logs/backend-error.log',
    out_file: '/home/taskmanager/logs/backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    time: true
  }]
};
EOF"
```

**Important**: Use `fork` mode, not `cluster` mode, to avoid EADDRINUSE errors.

Create logs directory:
```bash
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'mkdir -p /home/taskmanager/logs && chown -R taskmanager:taskmanager /home/taskmanager/logs'
```

Start PM2:
```bash
# Start the application
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager pm2 start ecosystem.config.js'

# Save PM2 configuration
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'sudo -u taskmanager pm2 save'

# Enable PM2 startup on boot
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u taskmanager --hp /home/taskmanager'
```

### 10. Configure SSL Certificate

**IMPORTANT**: Always use HTTPS in production. Install SSL certificate before deploying:

```bash
# Install Certbot
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'apt install -y certbot python3-certbot-nginx'

# Get SSL certificate (replace with your domain)
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com'
```

### 11. Configure Nginx with SSL

Create Nginx configuration with HTTPS:

```bash
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP "cat > /etc/nginx/sites-available/taskmanager << 'EOF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

# HTTPS - Main configuration
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Serve React app
    location / {
        root /home/taskmanager/TaskManager/web/build;
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Static files caching
    location /static/ {
        root /home/taskmanager/TaskManager/web/build;
        expires 1y;
        add_header Cache-Control \"public, immutable\";
    }

    # Security headers
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;
    add_header X-Frame-Options \"SAMEORIGIN\" always;
    add_header X-Content-Type-Options \"nosniff\" always;
    add_header X-XSS-Protection \"1; mode=block\" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF"
```

Enable and restart Nginx:

```bash
# Enable site
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/taskmanager && rm -f /etc/nginx/sites-enabled/default'

# Test configuration
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'nginx -t'

# Restart Nginx
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'systemctl restart nginx'
```

### 12. Verify Deployment

```bash
# Check HTTPS is working
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/

# Check HTTP redirects to HTTPS
curl -sI http://yourdomain.com/ | grep -i location

# Check backend status
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'sudo -u taskmanager pm2 status'

# Check backend logs
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'sudo -u taskmanager pm2 logs taskmanager-backend --lines 20 --nostream'

# Check Nginx status
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'systemctl status nginx'

# Check PostgreSQL status
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'systemctl status postgresql'
```

## Common Issues and Solutions

### 1. Permission Denied on npm install

**Problem**: `npm error The operation was rejected by your operating system`

**Solution**: Files are owned by root, change ownership:
```bash
chown -R taskmanager:taskmanager /home/taskmanager/TaskManager
```

### 2. PostgreSQL Authentication Error

**Problem**: `psql: error: connection failed: fe_sendauth: no password supplied`

**Solution**: Change postgres user authentication to peer in `/etc/postgresql/14/main/pg_hba.conf`:
```
# Change this line:
local   all             postgres                                md5
# To:
local   all             postgres                                peer
```

Then reload: `systemctl reload postgresql`

### 3. PM2 Backend Keeps Restarting (EADDRINUSE)

**Problem**: `Error: bind EADDRINUSE null:3000`

**Solution**: Use `fork` mode instead of `cluster` mode in `ecosystem.config.js`:
```javascript
exec_mode: 'fork',  // Not 'cluster'
instances: 1,
```

### 4. Missing Database Columns

**Problem**: `ERROR: column "is_public" does not exist`

**Solution**: Add missing columns manually:
```bash
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
```

### 5. Table Ownership Issues

**Problem**: `ERROR: must be owner of table`

**Solution**: Transfer table ownership:
```bash
ALTER TABLE table_name OWNER TO taskmanager;
```

## Updating the Application

### Update Backend Code

```bash
# Transfer new code
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.env' \
  -e "ssh -i ~/.ssh/taskmanager_rsa" \
  ./backend/ root@YOUR_DROPLET_IP:/home/taskmanager/TaskManager/backend/

# Fix permissions
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'chown -R taskmanager:taskmanager /home/taskmanager/TaskManager/backend'

# Install dependencies and build
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager npm install && sudo -u taskmanager npm run build'

# Restart backend
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/backend && sudo -u taskmanager pm2 restart ecosystem.config.js'
```

### Update Frontend Code

```bash
# Transfer new code
rsync -avz --exclude 'node_modules' --exclude 'build' \
  -e "ssh -i ~/.ssh/taskmanager_rsa" \
  ./web/ root@YOUR_DROPLET_IP:/home/taskmanager/TaskManager/web/

# Fix permissions
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'chown -R taskmanager:taskmanager /home/taskmanager/TaskManager/web'

# Build
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  'cd /home/taskmanager/TaskManager/web && REACT_APP_API_URL=http://YOUR_DROPLET_IP:3000 sudo -u taskmanager npm run build'

# Nginx automatically serves the new build
```

## Monitoring

### PM2 Monitoring

```bash
# Status
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'sudo -u taskmanager pm2 status'

# Logs (real-time)
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'sudo -u taskmanager pm2 logs'

# Logs (last N lines)
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'sudo -u taskmanager pm2 logs --lines 50'

# Resource monitoring
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'sudo -u taskmanager pm2 monit'
```

### System Monitoring

```bash
# Check disk space
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'df -h'

# Check memory usage
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'free -h'

# Check CPU usage
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP 'top -bn1 | head -20'
```

## Backup and Recovery

### Manual Database Backup

```bash
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "sudo -u taskmanager PGPASSWORD=YOUR_PASSWORD pg_dump -h localhost -U taskmanager taskmanager | gzip > /home/taskmanager/backup_\$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Restore Database

```bash
# Copy backup to droplet
scp -i ~/.ssh/taskmanager_rsa backup.sql.gz root@YOUR_DROPLET_IP:/home/taskmanager/

# Restore
ssh -i ~/.ssh/taskmanager_rsa root@YOUR_DROPLET_IP \
  "gunzip < /home/taskmanager/backup.sql.gz | sudo -u taskmanager PGPASSWORD=YOUR_PASSWORD psql -h localhost -U taskmanager taskmanager"
```

## Production Deployment Summary

**What was deployed on submitlist.space (165.22.46.130):**

1. **Backend**: Node.js/Express with PM2 (fork mode, 1 instance)
2. **Frontend**: React production build served by Nginx
3. **Database**: PostgreSQL 14 with all migrations applied
4. **SSL/TLS**: Let's Encrypt certificate (valid until Feb 18, 2026)
5. **Reverse Proxy**: Nginx with HTTPS, HTTP/2, gzip and security headers
6. **Process Manager**: PM2 with auto-start on boot
7. **Environment**: Production with secure JWT secret

**Services Status:**
- ✅ Backend running on port 3000
- ✅ HTTPS accessible on port 443 (with HTTP/2)
- ✅ HTTP redirects to HTTPS (port 80 → 443)
- ✅ PostgreSQL running on port 5432
- ✅ Nginx running with SSL enabled
- ✅ PM2 configured for auto-restart
- ✅ All services start on boot
- ✅ SSL certificate auto-renewal configured

**Access:**
- Web App: https://submitlist.space (HTTPS enforced)
- API: https://submitlist.space/api
- Legacy HTTP redirects to HTTPS automatically

## Next Steps

1. **Configure Domain**: Point your domain to 165.22.46.130
2. **Add SSL**: Install Let's Encrypt certificate with Certbot
3. **Set up Monitoring**: Configure alerts for downtime
4. **Automated Backups**: Set up cron job for daily database backups
5. **Security Hardening**: Configure UFW firewall, fail2ban, etc.
