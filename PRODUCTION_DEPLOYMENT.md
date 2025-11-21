# Production Deployment Guide - submitlist.space

Complete documentation of the DigitalOcean production deployment completed on November 20, 2025.

## Deployment Overview

**Live Site:** https://submitlist.space
**Server IP:** 165.22.46.130
**Region:** NYC3
**Droplet Size:** s-1vcpu-2gb ($17/month)
**Domain Registrar:** Namecheap
**DNS Provider:** DigitalOcean
**SSL:** Let's Encrypt (auto-renews)

## Architecture

```
Internet
    ↓
DigitalOcean DNS (ns1/ns2/ns3.digitalocean.com)
    ↓
submitlist.space → 165.22.46.130
    ↓
Nginx (Port 443/HTTPS)
    ├─ / → React App (/home/taskmanager/TaskManager/web/build)
    ├─ /api/ → Node.js Backend (localhost:3000)
    └─ /uploads/ → Static Files (/home/taskmanager/uploads)
         ↓
Node.js/Express Backend (PM2)
    ↓
PostgreSQL Database (localhost:5432)
```

## Deployment Process

### 1. Prerequisites Setup

```bash
# Install DigitalOcean CLI
brew install doctl

# Authenticate
doctl auth init
# Token: claude

# Verify authentication
doctl account get
```

### 2. Initial Deployment

```bash
./deploy-fixed.sh
```

**What the script does:**
1. Creates SSH key pair (`~/.ssh/taskmanager_rsa`)
2. Uploads SSH key to DigitalOcean
3. Creates Ubuntu 22.04 droplet (s-1vcpu-2gb, NYC3)
4. Configures DNS records (A records for @ and www)
5. Installs dependencies:
   - Node.js 18 (via NodeSource)
   - PostgreSQL 14
   - Nginx
   - FFmpeg (for video compression)
   - Certbot (for SSL)
6. Creates `taskmanager` user with sudo privileges
7. Uploads application files via rsync
8. Builds and deploys backend
9. Builds and deploys web app with production API URL
10. Configures Nginx reverse proxy
11. Sets up SSL certificates (after DNS propagates)

### 3. DNS Configuration

**Domain:** submitlist.space (registered at Namecheap)

**DNS Setup Process:**
1. DNS records created in DigitalOcean
2. Nameservers updated at Namecheap using API:
   ```bash
   ./update-nameservers.sh
   # API Username: jwinwood
   # API Key: 91175436f88a4b02ae2e871971909c0b
   ```
3. Nameservers updated to:
   - ns1.digitalocean.com
   - ns2.digitalocean.com
   - ns3.digitalocean.com
4. DNS propagation: ~20 minutes

**DNS Records (in DigitalOcean):**
```
submitlist.space      A    165.22.46.130   TTL: 300
www.submitlist.space  A    165.22.46.130   TTL: 300
```

### 4. SSL Certificate Setup

**Automated Setup:**
```bash
# Automatic via monitoring script
./wait-for-dns-and-ssl.sh
```

**Manual Setup (if needed):**
```bash
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 \
  'certbot --nginx -d submitlist.space -d www.submitlist.space \
   --non-interactive --agree-tos --email joseph.winwood@gmail.com --redirect'
```

**Certificate Details:**
- Issued by: Let's Encrypt
- Expires: February 18, 2026
- Auto-renewal: Enabled via certbot systemd timer
- Location: `/etc/letsencrypt/live/submitlist.space/`

## Critical Fixes Applied

### Issue 1: API URL Configuration

**Problem:** Web app was hardcoded to `http://localhost:3000/api`

**Fix:**
```typescript
// web/src/services/api.ts
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
```

**Build Command:**
```bash
REACT_APP_API_URL=https://submitlist.space/api npm run build
```

### Issue 2: File Upload Paths

**Problem:** Hardcoded `http://localhost:3000` for uploaded files

**Files Fixed:**
- `web/src/pages/TaskDetailPage.tsx`
- `web/src/pages/TaskCompletionsPage.tsx`

**Fix:** Changed from absolute URLs to relative paths:
```tsx
// Before
src={`http://localhost:3000${path}`}

// After
src={path}  // Nginx serves /uploads/ directly
```

### Issue 3: Node.js Package Conflicts

**Problem:** Ubuntu 22.04 had conflicting libnode72 package

**Fix:**
```bash
apt remove -y --purge libnode72 nodejs nodejs-doc 2>/dev/null || true
apt autoremove -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

### Issue 4: File Permissions

**Problem:** Nginx couldn't read web build files (permission denied)

**Fix:**
```bash
usermod -a -G taskmanager www-data
chmod -R 755 /home/taskmanager/TaskManager/web/build
systemctl restart nginx
```

### Issue 5: Test Credentials on Login Page

**Problem:** Login page displayed test credentials in production

**Fix:** Removed test credentials div from `LoginPage.tsx`

## Server Configuration

### Backend Environment (.env)

```env
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=postgres
DB_PASSWORD=[generated secure password]
JWT_SECRET=[generated secure secret]
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
```

**Credentials stored in:**
- Database password: `/home/taskmanager/db_password.txt`
- JWT secret: `/home/taskmanager/jwt_secret.txt`

### Nginx Configuration

**Location:** `/etc/nginx/sites-available/taskmanager`

```nginx
server {
    server_name submitlist.space www.submitlist.space;
    client_max_body_size 10M;

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

    location /uploads/ {
        alias /home/taskmanager/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        root /home/taskmanager/TaskManager/web/build;
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/submitlist.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/submitlist.space/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name submitlist.space www.submitlist.space;
    return 301 https://$host$request_uri;
}
```

### PM2 Process Management

**Backend process:**
```bash
pm2 start dist/index.js --name taskmanager-api
pm2 save
pm2 startup systemd -u taskmanager --hp /home/taskmanager
```

**Process details:**
- Name: taskmanager-api
- User: taskmanager
- Script: /home/taskmanager/TaskManager/backend/dist/index.js
- Auto-restart: Enabled
- Startup on boot: Enabled

## Management Commands

### Server Access

```bash
# SSH into server
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130

# View backend logs (live)
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 logs'

# View backend logs (saved)
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 logs --lines 100'
```

### Backend Management

```bash
# Check status
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 status'

# Restart backend
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 restart taskmanager-api'

# Stop backend
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 stop taskmanager-api'

# Start backend
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 start taskmanager-api'

# View detailed info
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 info taskmanager-api'
```

### Database Management

```bash
# Access PostgreSQL
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130
sudo -u postgres psql -d taskmanager

# Backup database
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 \
  'sudo -u postgres pg_dump taskmanager | gzip > /home/taskmanager/backups/db_$(date +%Y%m%d_%H%M%S).sql.gz'

# Restore database
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130
gunzip < backup.sql.gz | sudo -u postgres psql taskmanager
```

### Nginx Management

```bash
# Restart Nginx
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'systemctl restart nginx'

# Check Nginx status
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'systemctl status nginx'

# Test Nginx config
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'nginx -t'

# View Nginx error logs
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'tail -f /var/log/nginx/error.log'

# View Nginx access logs
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'tail -f /var/log/nginx/access.log'
```

## Updating the Application

### Quick Update (Code Changes Only)

```bash
# Upload updated files
rsync -avz --progress \
  -e "ssh -i ~/.ssh/taskmanager_rsa -o StrictHostKeyChecking=no" \
  --exclude 'node_modules' --exclude '.git' --exclude 'build' \
  web/src/ root@165.22.46.130:/home/taskmanager/TaskManager/web/src/

# Rebuild and restart
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 bash << 'EOF'
chown -R taskmanager:taskmanager /home/taskmanager/TaskManager/web/src
sudo -u taskmanager bash << 'USEREOF'
cd /home/taskmanager/TaskManager/web
REACT_APP_API_URL=https://submitlist.space/api npm run build
USEREOF
systemctl restart nginx
EOF
```

### Backend Update

```bash
# Upload backend files
rsync -avz --progress \
  -e "ssh -i ~/.ssh/taskmanager_rsa -o StrictHostKeyChecking=no" \
  --exclude 'node_modules' --exclude 'dist' \
  backend/src/ root@165.22.46.130:/home/taskmanager/TaskManager/backend/src/

# Rebuild and restart
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 bash << 'EOF'
chown -R taskmanager:taskmanager /home/taskmanager/TaskManager/backend/src
sudo -u taskmanager bash << 'USEREOF'
cd /home/taskmanager/TaskManager/backend
npm install
npm run build
pm2 restart taskmanager-api
USEREOF
EOF
```

### Full Redeployment

```bash
# Use the deployment script
./deploy-fixed.sh
```

## Monitoring and Maintenance

### Health Checks

```bash
# API health check
curl https://submitlist.space/api/health

# Check SSL certificate
curl -vI https://submitlist.space 2>&1 | grep -i "expire"

# Check DNS
dig +short submitlist.space
dig +short NS submitlist.space
```

### SSL Certificate Renewal

**Automatic:** Certbot renews automatically via systemd timer

**Manual renewal (if needed):**
```bash
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'certbot renew'
```

**Check renewal timer:**
```bash
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'systemctl status certbot.timer'
```

### Disk Space Management

```bash
# Check disk usage
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'df -h'

# Check upload directory size
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'du -sh /home/taskmanager/uploads'

# Clean PM2 logs
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 flush'
```

## Troubleshooting

### Backend Not Responding

```bash
# Check PM2 status
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 status'

# View logs
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 logs --lines 50'

# Restart backend
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u taskmanager pm2 restart taskmanager-api'
```

### Web App Not Loading

```bash
# Check Nginx status
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'systemctl status nginx'

# Check Nginx errors
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'tail -50 /var/log/nginx/error.log'

# Verify build files exist
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'ls -la /home/taskmanager/TaskManager/web/build'
```

### Database Connection Issues

```bash
# Check PostgreSQL status
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'systemctl status postgresql'

# Test database connection
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'sudo -u postgres psql -d taskmanager -c "SELECT 1;"'

# Check database logs
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'tail -50 /var/log/postgresql/postgresql-14-main.log'
```

### SSL Certificate Issues

```bash
# Check certificate validity
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'certbot certificates'

# Test renewal
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'certbot renew --dry-run'

# Force renewal
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'certbot renew --force-renewal'
```

## Security Considerations

### Firewall (UFW)

```bash
# Current rules
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'ufw status'

# Expected output:
# Status: active
# To                         Action      From
# --                         ------      ----
# OpenSSH                    ALLOW       Anywhere
# Nginx Full                 ALLOW       Anywhere
```

### Credentials

**Never commit these files:**
- `/home/taskmanager/db_password.txt`
- `/home/taskmanager/jwt_secret.txt`
- `~/.ssh/taskmanager_rsa` (local)
- `~/.ssh/taskmanager_rsa.pub` (local)

**Backup credentials securely:**
```bash
# From local machine
scp -i ~/.ssh/taskmanager_rsa root@165.22.46.130:/home/taskmanager/db_password.txt ~/secure-backup/
scp -i ~/.ssh/taskmanager_rsa root@165.22.46.130:/home/taskmanager/jwt_secret.txt ~/secure-backup/
```

## Cost Breakdown

**Monthly Costs:**
- Droplet (s-1vcpu-2gb): $12/month
- Bandwidth (1TB included): $0
- Backups (if enabled): ~$2.40/month
- **Total: ~$17/month** (without backups: $12/month)

**Included Resources:**
- 2GB RAM
- 1 vCPU
- 50GB SSD
- 2TB transfer

## Scaling Recommendations

### When to Upgrade

**Upgrade to s-2vcpu-4gb ($24/month) when:**
- RAM usage consistently > 80%
- CPU usage consistently > 80%
- More than 100 concurrent users

**Add Managed PostgreSQL ($15/month) when:**
- Database size > 20GB
- Need high availability
- Complex queries causing performance issues

**Add Load Balancer ($12/month) when:**
- Need to run multiple droplets
- Require zero-downtime deployments

### Monitoring Metrics

```bash
# Check resource usage
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'htop'

# Memory usage
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'free -h'

# CPU usage
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'top -bn1 | head -20'

# Network usage
ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 'vnstat'
```

## Backup Strategy

### Automated Backups

**Database backup script:**
```bash
#!/bin/bash
BACKUP_DIR="/home/taskmanager/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PASSWORD=$(cat /home/taskmanager/db_password.txt)

mkdir -p $BACKUP_DIR

PGPASSWORD=$DB_PASSWORD pg_dump -U postgres -h localhost taskmanager | \
  gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

**Setup cron job:**
```bash
# Daily backup at 2 AM
0 2 * * * /home/taskmanager/backup.sh
```

## API Endpoints

**Base URL:** https://submitlist.space/api

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login
- GET `/api/auth/profile` - Get user profile

### Organizations
- POST `/api/organizations` - Create organization
- GET `/api/organizations` - List organizations
- GET `/api/organizations/:id` - Get organization details
- GET `/api/organizations/:id/members` - List members
- POST `/api/organizations/:id/members` - Add member
- PUT `/api/organizations/:id/members/:memberId` - Update member role
- DELETE `/api/organizations/:id/members/:memberId` - Remove member

### Tasks
- POST `/api/tasks` - Create task
- GET `/api/tasks/organization/:orgId` - List tasks
- GET `/api/tasks/:id` - Get task details
- PUT `/api/tasks/:id` - Update task
- DELETE `/api/tasks/:id` - Delete task
- POST `/api/tasks/:id/completions` - Add completion
- GET `/api/tasks/:id/completions` - List completions
- DELETE `/api/tasks/completions/:id` - Delete completion
- POST `/api/tasks/:id/submit` - Submit task
- POST `/api/tasks/:id/review` - Review task
- GET `/api/tasks/:id/audit-logs` - Get audit logs

### Notifications
- GET `/api/notifications` - List notifications
- PUT `/api/notifications/:id/read` - Mark as read
- PUT `/api/notifications/read-all` - Mark all as read
- DELETE `/api/notifications/:id` - Delete notification

### Processing Jobs
- GET `/api/processing/jobs/:jobId` - Get job status
- GET `/api/processing/jobs/stats` - Get job statistics (admin)

## Lessons Learned

### Critical Issues Found During Deployment

1. **Environment Variable Configuration**
   - Web app needs explicit `REACT_APP_API_URL` during build
   - Can't rely on runtime environment variables in React build

2. **File Path Handling**
   - Don't hardcode protocol/domain for same-origin files
   - Use relative paths for files served by same server

3. **Package Conflicts**
   - Ubuntu 22.04 has conflicting Node.js packages
   - Always clean up old packages before installing new versions

4. **File Permissions**
   - Nginx needs read permissions on web build files
   - Add www-data to taskmanager group instead of changing ownership

5. **DNS Propagation**
   - Nameserver changes can take 15-60 minutes
   - Use monitoring script to automatically configure SSL when ready

6. **Browser Caching**
   - Build hash changes don't always force browser refresh
   - Users need hard refresh (Cmd+Shift+R) after deployments

### Best Practices Established

1. **Deployment Scripts**
   - Always fix file permissions after uploads
   - Include error handling for common issues
   - Provide clear status messages

2. **Environment Configuration**
   - Store sensitive credentials in secure files
   - Use environment variables for configuration
   - Never commit credentials to git

3. **SSL Management**
   - Automate SSL setup with monitoring
   - Enable auto-renewal from the start
   - Test renewal process before expiration

4. **Code Organization**
   - Separate development and production configurations
   - Use environment variables for URLs
   - Avoid hardcoded localhost references

## Support and Maintenance

### Important Contacts

- **Domain Registrar:** Namecheap (support@namecheap.com)
- **Hosting:** DigitalOcean (support@digitalocean.com)
- **SSL:** Let's Encrypt (community.letsencrypt.org)

### Regular Maintenance Tasks

**Weekly:**
- Check PM2 status
- Review application logs
- Monitor disk space

**Monthly:**
- Review SSL certificate status
- Check for security updates
- Review backup integrity
- Monitor resource usage

**Quarterly:**
- Review and optimize database
- Update dependencies
- Review security best practices
- Test disaster recovery procedures

## Conclusion

This deployment successfully moved the TaskManager application from local development to production on DigitalOcean. The application is now:

- ✅ Fully accessible via HTTPS
- ✅ Secured with SSL certificate
- ✅ Running with auto-restart on failure
- ✅ Configured for automatic SSL renewal
- ✅ Optimized for production performance
- ✅ Ready to handle real users

**Production URL:** https://submitlist.space

---

*Last Updated: November 20, 2025*
*Deployment Status: LIVE*
*Next Review: December 20, 2025*
