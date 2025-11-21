# TaskManager - Digital Ocean Deployment Guide

This guide will walk you through deploying the TaskManager application to a Digital Ocean droplet.

## Prerequisites

- Digital Ocean account
- Domain name (optional but recommended)
- SSH key configured in Digital Ocean

## Step 1: Create a Digital Ocean Droplet

1. Log in to your Digital Ocean account
2. Click "Create" → "Droplets"
3. Choose an image:
   - **Distribution**: Ubuntu 22.04 LTS
4. Choose a plan:
   - **Basic Plan**: $12/month (2 GB RAM, 1 CPU, 50 GB SSD)
   - Recommended for production: $24/month (4 GB RAM, 2 CPUs, 80 GB SSD)
5. Choose a datacenter region (closest to your users)
6. Authentication: Select your SSH key
7. Hostname: `taskmanager-prod`
8. Click "Create Droplet"

## Step 2: Initial Server Setup

SSH into your droplet:
```bash
ssh root@YOUR_DROPLET_IP
```

### Update the system
```bash
apt update && apt upgrade -y
```

### Install Docker
```bash
# Install prerequisites
apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker
```

### Install Docker Compose
```bash
# Docker Compose v2 is included with docker-compose-plugin
# Verify installation
docker compose version
```

### Create a non-root user (recommended)
```bash
adduser taskmanager
usermod -aG sudo taskmanager
usermod -aG docker taskmanager
```

## Step 3: Configure Firewall

```bash
# Enable UFW
ufw --force enable

# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Check status
ufw status
```

## Step 4: Deploy the Application

### Clone the repository
```bash
# Switch to taskmanager user
su - taskmanager

# Create app directory
mkdir -p /home/taskmanager/app
cd /home/taskmanager/app

# Clone your repository (replace with your repo URL)
git clone YOUR_REPOSITORY_URL .
```

### Configure environment variables
```bash
# Copy the example file
cp .env.example .env

# Edit the .env file
nano .env
```

Update these critical values:
```env
# Generate a strong password
DB_PASSWORD=$(openssl rand -base64 32)

# Generate a strong JWT secret
JWT_SECRET=$(openssl rand -base64 64)

# Set your domain
APP_URL=https://yourdomain.com
REACT_APP_API_URL=https://yourdomain.com/api
```

### Deploy the application
```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Step 5: Set Up Domain and SSL (Optional but Recommended)

### Point your domain to the droplet
1. In your domain registrar, create an A record:
   - Host: `@` (or your subdomain)
   - Points to: `YOUR_DROPLET_IP`
   - TTL: 3600

### Install and configure Nginx with SSL
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal
sudo certbot renew --dry-run
```

## Step 6: Configure Nginx as Reverse Proxy

Create nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/taskmanager
```

Add this configuration:
```nginx
upstream backend {
    server localhost:3000;
}

upstream frontend {
    server localhost:80;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL configuration (certbot will add these)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # API backend
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 7: Set Up Automatic Backups

### Database Backup Script
```bash
mkdir -p /home/taskmanager/backups
nano /home/taskmanager/backup.sh
```

Add this content:
```bash
#!/bin/bash
BACKUP_DIR="/home/taskmanager/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec taskmanager_db_prod pg_dump -U taskmanager_user taskmanager | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
```

Make it executable:
```bash
chmod +x /home/taskmanager/backup.sh
```

### Set up cron job for daily backups
```bash
crontab -e
```

Add this line (runs daily at 2 AM):
```cron
0 2 * * * /home/taskmanager/backup.sh
```

## Step 8: Monitoring and Logging

### View application logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Check container status
```bash
docker compose -f docker-compose.prod.yml ps
```

### Monitor resource usage
```bash
docker stats
```

## Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
./deploy.sh
```

## Troubleshooting

### Backend container won't start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check environment variables
docker compose -f docker-compose.prod.yml config

# Rebuild without cache
docker compose -f docker-compose.prod.yml build --no-cache backend
```

### Database connection issues
```bash
# Check if PostgreSQL is running
docker compose -f docker-compose.prod.yml ps postgres

# Check PostgreSQL logs
docker compose -f docker-compose.prod.yml logs postgres

# Access PostgreSQL shell
docker exec -it taskmanager_db_prod psql -U taskmanager_user -d taskmanager
```

### Web app not loading
```bash
# Check nginx logs
docker compose -f docker-compose.prod.yml logs web

# Verify build completed
docker compose -f docker-compose.prod.yml logs web | grep "build"
```

## Security Recommendations

1. **Change default passwords**: Use strong, unique passwords for DB and JWT
2. **Regular updates**: Keep system and Docker images updated
3. **Firewall**: Only open necessary ports
4. **SSL/TLS**: Always use HTTPS in production
5. **Backups**: Set up automated database backups
6. **Monitoring**: Set up monitoring and alerts
7. **Rate limiting**: Configure nginx rate limiting for API endpoints

## Performance Optimization

1. **Database**: Configure PostgreSQL for your server specs
2. **Caching**: Set up Redis for session caching (optional)
3. **CDN**: Use a CDN for static assets (optional)
4. **Gzip**: Already enabled in nginx config
5. **Database indexes**: Already optimized in migrations

## Cost Estimates (Digital Ocean)

- **Droplet** (2GB RAM): $12/month
- **Droplet** (4GB RAM): $24/month (recommended)
- **Backups**: $2.40-$4.80/month (20% of droplet cost)
- **Domain**: $12-15/year (varies by provider)
- **Total**: ~$15-30/month

## Support

For issues or questions:
- Check logs: `docker compose -f docker-compose.prod.yml logs -f`
- Verify environment: `docker compose -f docker-compose.prod.yml config`
- Restart services: `docker compose -f docker-compose.prod.yml restart`
