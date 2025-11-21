# TaskManager - Quick Start Deployment

## TL;DR - Deploy in 5 Minutes

This is a condensed deployment guide. For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

### 1. Create Digital Ocean Droplet

```bash
# Minimum specs: Ubuntu 22.04, 2GB RAM, $12/month
# Recommended: 4GB RAM, $24/month
```

### 2. Initial Server Setup (One-time)

SSH into your droplet and run:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install -y docker-compose-plugin

# Configure firewall
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Create app directory
mkdir -p /root/taskmanager
cd /root/taskmanager
```

### 3. Deploy Application

```bash
# Clone repository (replace with your repo URL)
git clone YOUR_REPOSITORY_URL .

# Configure environment
cp .env.example .env
nano .env  # Edit with your values

# Generate secure credentials
echo "DB_PASSWORD=$(openssl rand -base64 32)" >> .env
echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env

# Update URLs in .env
# APP_URL=http://YOUR_DROPLET_IP
# REACT_APP_API_URL=http://YOUR_DROPLET_IP/api

# Deploy
chmod +x deploy.sh
./deploy.sh
```

### 4. Access Your Application

Open in browser: `http://YOUR_DROPLET_IP`

## Essential Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart application
docker compose -f docker-compose.prod.yml restart

# Stop application
docker compose -f docker-compose.prod.yml down

# Update application
git pull
./deploy.sh
```

## Quick SSL Setup (Optional)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Point your domain to droplet IP first, then:
certbot --nginx -d yourdomain.com

# Update .env with HTTPS URLs
# APP_URL=https://yourdomain.com
# REACT_APP_API_URL=https://yourdomain.com/api

# Redeploy
./deploy.sh
```

## Troubleshooting

**Backend won't start?**
```bash
docker compose -f docker-compose.prod.yml logs backend
```

**Can't connect to database?**
```bash
docker compose -f docker-compose.prod.yml logs postgres
```

**Web app not loading?**
```bash
docker compose -f docker-compose.prod.yml logs web
```

## Default Admin Account

After first deployment, register a new account at `/register`. The first registered user becomes an admin.

## Backups

Set up automatic backups:
```bash
# Create backup script
cat > /root/taskmanager/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/taskmanager/backups"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
docker exec taskmanager_db_prod pg_dump -U $DB_USER $DB_NAME | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /root/taskmanager/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/taskmanager/backup.sh") | crontab -
```

## Next Steps

- [ ] Set up domain name with SSL
- [ ] Configure email notifications (optional)
- [ ] Set up monitoring (optional)
- [ ] Configure automated backups
- [ ] Review security settings

For detailed configuration and advanced features, see [DEPLOYMENT.md](./DEPLOYMENT.md).
