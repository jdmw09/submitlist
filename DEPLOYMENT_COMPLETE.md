# TaskManager - Complete Deployment Guide

**Last Updated**: November 20, 2025  
**Production URL**: https://submitlist.space  
**Version**: 2.0.0 (With Admin Features & Organization Management)

---

## Quick Start Deployment

```bash
# 1. Build locally
cd backend && npm run build
cd ../web && REACT_APP_API_URL=https://submitlist.space/api npm run build

# 2. Package
cd ..
tar -czf backend-dist.tar.gz backend/dist backend/package.json backend/package-lock.json backend/src/database/migrations
tar -czf web-build.tar.gz web/build

# 3. Deploy
scp -i ~/.ssh/taskmanager_rsa backend-dist.tar.gz web-build.tar.gz root@submitlist.space:/tmp/
ssh -i ~/.ssh/taskmanager_rsa root@submitlist.space

# 4. On server
cd /home/taskmanager/TaskManager
tar -xzf /tmp/backend-dist.tar.gz
tar -xzf /tmp/web-build.tar.gz
chown -R taskmanager:taskmanager backend/ web/
sudo -u taskmanager bash -c 'cd backend && npm install --production'
sudo -u taskmanager pm2 restart taskmanager-backend
```

---

## Server Access

### SSH Connection
```bash
ssh -i ~/.ssh/taskmanager_rsa root@submitlist.space
```

### Server Details
- **Domain**: submitlist.space
- **OS**: Ubuntu/Debian
- **Users**: root, taskmanager (UID:1000)
- **Application**: /home/taskmanager/TaskManager/

### Key Files
```
/home/taskmanager/
├── db_password.txt          # Database password
├── jwt_secret.txt           # JWT secret
├── TaskManager/
│   ├── backend/
│   │   ├── dist/           # Compiled backend
│   │   ├── .env            # Environment variables
│   │   └── node_modules/
│   └── web/
│       └── build/          # Production frontend
├── backups/                # Database backups
├── logs/                   # Application logs
└── uploads/                # User uploads
```

---

## Environment Variables

**File**: `/home/taskmanager/TaskManager/backend/.env`

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=taskmanager
DB_PASSWORD=taskmanager_prod_pass_2024

# JWT
JWT_SECRET=uzdImQJ7euulOCHCKJuEww2U22B0o38dxozV8yQW+iw=
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=production

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Mailgun
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=submitlist.space
FROM_EMAIL=noreply@submitlist.space
FROM_NAME=TaskManager
APP_URL=https://submitlist.space
```

---

## Database Management

### Backup
```bash
ssh -i ~/.ssh/taskmanager_rsa root@submitlist.space "
  sudo -u taskmanager bash -c '
    PGPASSWORD=\$(cat ~/db_password.txt) \
    pg_dump -U taskmanager taskmanager > \
    ~/backups/backup-\$(date +%Y%m%d-%H%M%S).sql
  '
"
```

### Restore
```bash
ssh -i ~/.ssh/taskmanager_rsa root@submitlist.space "
  sudo -u taskmanager pm2 stop taskmanager-backend
  PGPASSWORD='taskmanager_prod_pass_2024' \
  psql -U taskmanager taskmanager < /home/taskmanager/backups/backup-YYYYMMDD.sql
  sudo -u taskmanager pm2 start taskmanager-backend
"
```

### Create Super Admin
```bash
ssh -i ~/.ssh/taskmanager_rsa root@submitlist.space
sudo -u postgres psql -d taskmanager
```

```sql
UPDATE users SET
  role = 'super_admin',
  email_verified = true,
  email_verified_at = NOW()
WHERE email = 'admin@submitlist.space';
```

---

## Service Management

### PM2 (Backend Process Manager)
```bash
# Status
pm2 status

# Restart
pm2 restart taskmanager-backend

# Logs (live)
pm2 logs taskmanager-backend

# Logs (last 100 lines)
pm2 logs taskmanager-backend --lines 100
```

### Nginx (Web Server)
```bash
# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx

# Status
sudo systemctl status nginx

# Logs
sudo tail -f /var/log/nginx/error.log
```

### PostgreSQL (Database)
```bash
# Status
sudo systemctl status postgresql

# Connect
sudo -u postgres psql -d taskmanager

# View active connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='taskmanager';"
```

---

## SSL Certificate (Let's Encrypt)

**Auto-renewal enabled via systemd timer**

### Check Certificate
```bash
sudo certbot certificates
```

### Manual Renewal
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Certificate Location
- Cert: `/etc/letsencrypt/live/submitlist.space/fullchain.pem`
- Key: `/etc/letsencrypt/live/submitlist.space/privkey.pem`
- Expires: 90 days (auto-renews)

---

## Nginx Configuration

**File**: `/etc/nginx/sites-available/taskmanager`

```nginx
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name submitlist.space www.submitlist.space;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name submitlist.space www.submitlist.space;

    # SSL
    ssl_certificate /etc/letsencrypt/live/submitlist.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/submitlist.space/privkey.pem;

    # Frontend
    location / {
        root /home/taskmanager/TaskManager/web/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location /static/ {
        root /home/taskmanager/TaskManager/web/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

---

## Troubleshooting

### Backend Won't Start
```bash
# Check logs
pm2 logs taskmanager-backend --lines 100

# Check port
sudo lsof -i :3000

# Reinstall dependencies
cd /home/taskmanager/TaskManager/backend
rm -rf node_modules
npm install --production
pm2 restart taskmanager-backend
```

### Database Connection Failed
```bash
# Test connection
PGPASSWORD='taskmanager_prod_pass_2024' \
psql -U taskmanager -h localhost -d taskmanager -c "SELECT version();"

# Check PostgreSQL
sudo systemctl status postgresql
sudo journalctl -u postgresql -n 50
```

### Frontend 404 Errors
```bash
# Verify build exists
ls -la /home/taskmanager/TaskManager/web/build/

# Check nginx config
sudo nginx -t

# Check nginx logs
sudo tail -50 /var/log/nginx/error.log
```

### Email Not Sending
```bash
# Check mailgun config
cat /home/taskmanager/TaskManager/backend/.env | grep MAILGUN

# Check backend logs
pm2 logs taskmanager-backend | grep -i mailgun

# Test mailgun API
curl -s --user 'api:your_mailgun_api_key_here' \
  https://api.mailgun.net/v3/submitlist.space/messages \
  -F from='noreply@submitlist.space' \
  -F to='test@example.com' \
  -F subject='Test' \
  -F text='Test'
```

---

## Credentials

### Admin User
- **Email**: admin@submitlist.space
- **Password**: DfW16&lHr-2025
- **Role**: super_admin

### Database
- **Host**: localhost:5432
- **Database**: taskmanager
- **User**: taskmanager
- **Password**: See `/home/taskmanager/db_password.txt`

### Mailgun
- **API Key**: your_mailgun_api_key_here
- **Domain**: submitlist.space
- **Dashboard**: https://app.mailgun.com/

---

## Monitoring

### Daily Checks
```bash
# Health check
curl https://submitlist.space/api/health

# Service status
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# Disk space
df -h
```

### Weekly Tasks
```bash
# Review logs
pm2 logs --lines 500
sudo tail -200 /var/log/nginx/error.log

# Check backups
ls -lh /home/taskmanager/backups/

# Clean old logs
pm2 flush
```

### Monthly Tasks
```bash
# SSL certificate check
sudo certbot certificates

# Review audit logs (via admin dashboard)
# Clean old backups (keep last 30 days)
find /home/taskmanager/backups/ -name "*.sql" -mtime +30 -delete
```

---

## Quick Commands

```bash
# Deploy
./scripts/deploy.sh  # (if exists)

# Restart all
pm2 restart all && sudo systemctl reload nginx

# Backup now
PGPASSWORD='taskmanager_prod_pass_2024' pg_dump -U taskmanager taskmanager > backup.sql

# View all logs
pm2 logs && sudo tail /var/log/nginx/error.log

# Emergency stop
pm2 stop all
```
