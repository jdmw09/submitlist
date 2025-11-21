# Deploy with DigitalOcean CLI (doctl)

Automated deployment using the DigitalOcean command-line tool.

**Benefits:**
- 🚀 Faster setup (infrastructure in minutes)
- 🤖 Automated and repeatable
- 📝 Infrastructure as code
- ⚡ No clicking through dashboards

**Time:** ~30 minutes (vs 2 hours manual)

---

## Prerequisites

- [ ] DigitalOcean account
- [ ] DigitalOcean API token ([Generate here](https://cloud.digitalocean.com/account/api/tokens))
- [ ] Domain name (submitlist.space)
- [ ] Local machine with terminal access

---

## Part 1: Install and Setup doctl

### Install doctl

**macOS:**
```bash
brew install doctl
```

**Linux:**
```bash
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf ~/doctl-1.98.1-linux-amd64.tar.gz
sudo mv ~/doctl /usr/local/bin
```

**Windows:**
```bash
# Using Chocolatey
choco install doctl

# Or download from: https://github.com/digitalocean/doctl/releases
```

Verify installation:
```bash
doctl version
```

### Authenticate doctl

```bash
# Initialize with your API token
doctl auth init

# Enter your DigitalOcean API token when prompted
# Get token from: https://cloud.digitalocean.com/account/api/tokens

# Verify authentication
doctl account get
```

---

## Part 2: Create Infrastructure with CLI

### Option 1: Minimal Setup ($17/month)

**1. Create SSH Key (if you don't have one):**

```bash
# Generate SSH key
ssh-keygen -t rsa -b 4096 -C "your_email@example.com" -f ~/.ssh/taskmanager_rsa

# Add to DigitalOcean
doctl compute ssh-key import taskmanager-key --public-key-file ~/.ssh/taskmanager_rsa.pub

# Get SSH key ID
doctl compute ssh-key list
# Note the ID (e.g., 12345678)
```

**2. Create Droplet:**

```bash
# Create 2GB Droplet in NYC3
doctl compute droplet create taskmanager-prod \
  --size s-1vcpu-2gb \
  --image ubuntu-22-04-x64 \
  --region nyc3 \
  --ssh-keys YOUR_SSH_KEY_ID \
  --enable-monitoring \
  --enable-ipv6 \
  --tag-names production,taskmanager \
  --wait

# Get Droplet info
doctl compute droplet list

# Note your Droplet IP
DROPLET_IP=$(doctl compute droplet list --format PublicIPv4 --no-header taskmanager-prod)
echo "Your Droplet IP: $DROPLET_IP"
```

**Available sizes:**
- `s-1vcpu-2gb` - $12/month (2GB RAM, 1 vCPU, 50GB SSD)
- `s-2vcpu-4gb` - $24/month (4GB RAM, 2 vCPUs, 80GB SSD)
- `s-4vcpu-8gb` - $48/month (8GB RAM, 4 vCPUs, 160GB SSD)

**Available regions:**
- `nyc3` - New York
- `sfo3` - San Francisco
- `ams3` - Amsterdam
- `sgp1` - Singapore
- `lon1` - London
- `fra1` - Frankfurt

**3. Create Spaces:**

```bash
# Create Space (250GB = $5/month)
# Note: Spaces creation via CLI requires additional setup
# For now, create via dashboard or use:

# Install s3cmd for Spaces management
brew install s3cmd  # macOS
# or
sudo apt install s3cmd  # Linux

# We'll create the Space via web for now, then manage with CLI
```

**4. Configure Firewall:**

```bash
# Create firewall
doctl compute firewall create \
  --name taskmanager-firewall \
  --inbound-rules "protocol:tcp,ports:22,sources:addresses:0.0.0.0/0,sources:addresses:::/0 protocol:tcp,ports:80,sources:addresses:0.0.0.0/0,sources:addresses:::/0 protocol:tcp,ports:443,sources:addresses:0.0.0.0/0,sources:addresses:::/0" \
  --outbound-rules "protocol:tcp,ports:all,destinations:addresses:0.0.0.0/0,destinations:addresses:::/0 protocol:udp,ports:all,destinations:addresses:0.0.0.0/0,destinations:addresses:::/0" \
  --droplet-ids $(doctl compute droplet list --format ID --no-header taskmanager-prod)
```

**5. Configure DNS:**

```bash
# Add domain to DigitalOcean (if not already added)
doctl compute domain create submitlist.space

# Add A record for root domain
doctl compute domain records create submitlist.space \
  --record-type A \
  --record-name @ \
  --record-data $DROPLET_IP \
  --record-ttl 300

# Add A record for www
doctl compute domain records create submitlist.space \
  --record-type A \
  --record-name www \
  --record-data $DROPLET_IP \
  --record-ttl 300

# Verify DNS records
doctl compute domain records list submitlist.space
```

### Option 2: Managed Setup ($47/month)

**Everything from Option 1, plus:**

**6. Create Managed PostgreSQL:**

```bash
# Create managed database (1GB = $15/month)
doctl databases create taskmanager-db \
  --engine pg \
  --version 14 \
  --size db-s-1vcpu-1gb \
  --region nyc3 \
  --num-nodes 1

# Wait for database to be ready (5-10 minutes)
doctl databases list

# Get database connection info
doctl databases connection taskmanager-db --format URI

# Get database ID
DB_ID=$(doctl databases list --format ID --no-header taskmanager-db)

# Add Droplet to trusted sources
doctl databases firewalls append $DB_ID \
  --rule ip_addr:$DROPLET_IP
```

**Database sizes:**
- `db-s-1vcpu-1gb` - $15/month (1GB RAM, 1 vCPU, 10GB disk)
- `db-s-2vcpu-4gb` - $60/month (4GB RAM, 2 vCPUs, 38GB disk)
- `db-s-4vcpu-8gb` - $120/month (8GB RAM, 4 vCPUs, 115GB disk)

---

## Part 3: Automated Server Setup Script

Create a deployment script to run on the Droplet:

**1. Create deployment script locally:**

```bash
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting TaskManager deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL (Option 1 only)
echo "📦 Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

# Install other dependencies
echo "📦 Installing dependencies..."
sudo apt install -y nginx git ffmpeg

# Install PM2
sudo npm install -g pm2

# Setup non-root user
echo "👤 Setting up taskmanager user..."
if ! id taskmanager &>/dev/null; then
    sudo adduser --disabled-password --gecos "" taskmanager
    echo "taskmanager:taskmanager123" | sudo chpasswd
    sudo usermod -aG sudo taskmanager
fi

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Setup PostgreSQL (Option 1 only)
echo "🗄️  Configuring PostgreSQL..."
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'taskmanager_secure_pass_123';"
sudo -u postgres psql -c "CREATE DATABASE taskmanager;"

# Update pg_hba.conf
sudo sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' /etc/postgresql/14/main/pg_hba.conf
sudo systemctl restart postgresql

# Create uploads directory
sudo mkdir -p /home/taskmanager/uploads
sudo chown -R taskmanager:taskmanager /home/taskmanager/uploads
sudo chmod 755 /home/taskmanager/uploads

echo "✅ Server setup complete!"
echo "Next steps:"
echo "1. Clone your repository to /home/taskmanager/TaskManager"
echo "2. Configure .env file"
echo "3. Run database migrations"
echo "4. Configure Nginx"
echo "5. Setup SSL with Certbot"
EOF

chmod +x deploy.sh
```

**2. Copy and run on Droplet:**

```bash
# Copy script to Droplet
scp -i ~/.ssh/taskmanager_rsa deploy.sh root@$DROPLET_IP:/tmp/

# SSH and run
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'bash /tmp/deploy.sh'
```

---

## Part 4: Deploy Application

**1. SSH into Droplet:**

```bash
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP
su - taskmanager
```

**2. Clone and setup application:**

```bash
# Clone repository
cd /home/taskmanager
git clone https://github.com/YOUR_USERNAME/TaskManager.git
cd TaskManager/backend

# Install dependencies
npm install

# Create .env
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=postgres
DB_PASSWORD=taskmanager_secure_pass_123

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# File Upload
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760

# Spaces (update with your keys)
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=taskmanager-uploads
SPACES_KEY=YOUR_SPACES_KEY
SPACES_SECRET=YOUR_SPACES_SECRET
SPACES_REGION=nyc3

# Compression
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
EOF

# Run migrations
npm run db:migrate

# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name taskmanager-api
pm2 startup
pm2 save
```

**3. Configure Nginx:**

```bash
sudo tee /etc/nginx/sites-available/taskmanager << 'EOF'
server {
    listen 80;
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
}
EOF

sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**4. Setup SSL:**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d submitlist.space -d www.submitlist.space --non-interactive --agree-tos --email your@email.com
```

**5. Build and deploy web app:**

```bash
cd /home/taskmanager/TaskManager/web
npm install
REACT_APP_API_URL=https://submitlist.space/api npm run build
sudo systemctl restart nginx
```

---

## Part 5: CLI Management Commands

### Droplet Management

```bash
# List droplets
doctl compute droplet list

# Get droplet info
doctl compute droplet get taskmanager-prod

# Reboot droplet
doctl compute droplet-action reboot taskmanager-prod

# Resize droplet (upgrade)
doctl compute droplet-action resize taskmanager-prod --size s-2vcpu-4gb

# Create snapshot (backup)
doctl compute droplet-action snapshot taskmanager-prod --snapshot-name taskmanager-backup-$(date +%Y%m%d)

# List snapshots
doctl compute snapshot list --resource droplet

# Delete droplet (careful!)
doctl compute droplet delete taskmanager-prod
```

### Database Management

```bash
# List databases
doctl databases list

# Get database connection info
doctl databases connection taskmanager-db

# Create database backup
doctl databases backups list taskmanager-db

# Resize database
doctl databases resize taskmanager-db --size db-s-2vcpu-4gb

# List database users
doctl databases user list taskmanager-db

# Create new database user
doctl databases user create taskmanager-db app_user
```

### DNS Management

```bash
# List domains
doctl compute domain list

# List domain records
doctl compute domain records list submitlist.space

# Update A record
doctl compute domain records update submitlist.space \
  --record-id RECORD_ID \
  --record-data NEW_IP

# Delete record
doctl compute domain records delete submitlist.space RECORD_ID
```

### Monitoring

```bash
# Get droplet bandwidth
doctl monitoring bandwidth get taskmanager-prod

# Get CPU metrics
doctl monitoring cpu get taskmanager-prod

# List alerts
doctl monitoring alert list
```

---

## Part 6: Complete Automation Script

Create a fully automated deployment:

```bash
cat > auto-deploy.sh << 'EOF'
#!/bin/bash
set -e

# Configuration
DROPLET_NAME="taskmanager-prod"
DOMAIN="submitlist.space"
REGION="nyc3"
SIZE="s-1vcpu-2gb"
SSH_KEY_ID="YOUR_SSH_KEY_ID"  # Update this

echo "🚀 TaskManager Automated Deployment"
echo "===================================="

# Create droplet
echo "📦 Creating Droplet..."
doctl compute droplet create $DROPLET_NAME \
  --size $SIZE \
  --image ubuntu-22-04-x64 \
  --region $REGION \
  --ssh-keys $SSH_KEY_ID \
  --enable-monitoring \
  --wait

# Get droplet IP
DROPLET_IP=$(doctl compute droplet list --format PublicIPv4 --no-header $DROPLET_NAME)
echo "✅ Droplet created: $DROPLET_IP"

# Configure DNS
echo "🌐 Configuring DNS..."
doctl compute domain records create $DOMAIN \
  --record-type A \
  --record-name @ \
  --record-data $DROPLET_IP \
  --record-ttl 300

doctl compute domain records create $DOMAIN \
  --record-type A \
  --record-name www \
  --record-data $DROPLET_IP \
  --record-ttl 300

echo "✅ DNS configured"

# Wait for droplet to be accessible
echo "⏳ Waiting for droplet to be ready..."
sleep 30

# Run deployment script
echo "🔧 Running server setup..."
scp deploy.sh root@$DROPLET_IP:/tmp/
ssh root@$DROPLET_IP 'bash /tmp/deploy.sh'

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. SSH to server: ssh root@$DROPLET_IP"
echo "2. Clone repository and configure application"
echo "3. Access at: http://$DROPLET_IP (or https://$DOMAIN after SSL)"
EOF

chmod +x auto-deploy.sh
```

Run complete automation:

```bash
./auto-deploy.sh
```

---

## Quick Reference

### Essential Commands

```bash
# Check droplet status
doctl compute droplet list

# Get droplet IP
doctl compute droplet list --format PublicIPv4 --no-header taskmanager-prod

# SSH to droplet
ssh -i ~/.ssh/taskmanager_rsa root@$(doctl compute droplet list --format PublicIPv4 --no-header taskmanager-prod)

# View monitoring
doctl monitoring cpu get taskmanager-prod

# Create snapshot backup
doctl compute droplet-action snapshot taskmanager-prod --snapshot-name backup-$(date +%Y%m%d)

# List backups
doctl compute snapshot list --resource droplet
```

### Cost Estimation

```bash
# Check current month's usage
doctl invoice list

# Get invoice summary
doctl invoice summary
```

---

## Troubleshooting

**Authentication failed:**
```bash
# Re-authenticate
doctl auth init
doctl auth list
```

**Droplet creation failed:**
```bash
# Check available sizes
doctl compute size list

# Check available regions
doctl compute region list

# Check SSH keys
doctl compute ssh-key list
```

**DNS not working:**
```bash
# Verify domain records
doctl compute domain records list submitlist.space

# Check DNS propagation
dig submitlist.space
nslookup submitlist.space
```

---

## Benefits of CLI Deployment

✅ **Speed:** Infrastructure in 5 minutes vs 30 minutes manual
✅ **Repeatability:** Same commands work every time
✅ **Automation:** Script entire deployment
✅ **Version Control:** Store infrastructure as code
✅ **Testing:** Easily create/destroy test environments
✅ **Scaling:** Quickly spin up multiple droplets

---

## Next Steps

1. Run infrastructure setup with doctl
2. Follow deployment steps in Part 4
3. Configure application
4. Setup monitoring and backups
5. Go live!

**Documentation:**
- [doctl GitHub](https://github.com/digitalocean/doctl)
- [DigitalOcean API Docs](https://docs.digitalocean.com/reference/api/)
- [Full Deployment Guide](DEPLOY_MINIMAL.md)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-20
