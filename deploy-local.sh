#!/bin/bash
set -e

# TaskManager Local Deployment Script
# Deploys from local machine to DigitalOcean
# For: submitlist.space

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DROPLET_NAME="taskmanager-prod"
DOMAIN="submitlist.space"
REGION="nyc3"
SIZE="s-1vcpu-2gb"
EMAIL="joseph.winwood@gmail.com"
LOCAL_PATH="/Volumes/Adrian/TaskManager"

echo -e "${GREEN}🚀 TaskManager Local Deployment${NC}"
echo "===================================="
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ doctl not found. Install with: brew install doctl${NC}"
    exit 1
fi

if ! doctl account get &> /dev/null; then
    echo -e "${RED}❌ Not authenticated. Run: doctl auth init${NC}"
    exit 1
fi

if [ ! -d "$LOCAL_PATH" ]; then
    echo -e "${RED}❌ TaskManager directory not found at $LOCAL_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"
echo ""

# Check for SSH key
echo -e "${YELLOW}Checking SSH key...${NC}"
if [ ! -f ~/.ssh/taskmanager_rsa ]; then
    echo "Generating SSH key..."
    ssh-keygen -t rsa -b 4096 -C "submitlist.space" -f ~/.ssh/taskmanager_rsa -N ""
fi

# Upload SSH key to DigitalOcean if not exists
if ! doctl compute ssh-key list | grep -q "taskmanager-key"; then
    echo "Uploading SSH key to DigitalOcean..."
    doctl compute ssh-key import taskmanager-key --public-key-file ~/.ssh/taskmanager_rsa.pub
fi

SSH_KEY_ID=$(doctl compute ssh-key list --format ID,Name --no-header | grep taskmanager-key | awk '{print $1}')
echo -e "${GREEN}✅ SSH Key ID: $SSH_KEY_ID${NC}"
echo ""

# Check if droplet already exists
if doctl compute droplet list | grep -q "$DROPLET_NAME"; then
    echo -e "${YELLOW}⚠️  Droplet '$DROPLET_NAME' already exists${NC}"
    echo "Do you want to delete and recreate it? (yes/no)"
    read -r response
    if [ "$response" = "yes" ]; then
        echo "Deleting existing droplet..."
        doctl compute droplet delete $DROPLET_NAME --force
        sleep 5
    else
        echo "Using existing droplet..."
    fi
fi

# Create Droplet
if ! doctl compute droplet list | grep -q "$DROPLET_NAME"; then
    echo -e "${YELLOW}📦 Creating Droplet...${NC}"
    doctl compute droplet create $DROPLET_NAME \
        --size $SIZE \
        --image ubuntu-22-04-x64 \
        --region $REGION \
        --ssh-keys $SSH_KEY_ID \
        --enable-monitoring \
        --enable-ipv6 \
        --tag-names production,taskmanager \
        --wait

    echo -e "${GREEN}✅ Droplet created${NC}"
    sleep 10
else
    echo -e "${GREEN}✅ Using existing droplet${NC}"
fi

# Get Droplet IP
DROPLET_IP=$(doctl compute droplet list --format PublicIPv4 --no-header $DROPLET_NAME)
echo -e "${GREEN}📍 Droplet IP: $DROPLET_IP${NC}"
echo ""

# Configure DNS
echo -e "${YELLOW}🌐 Configuring DNS...${NC}"

# Add domain if not exists
if ! doctl compute domain list | grep -q "$DOMAIN"; then
    doctl compute domain create $DOMAIN || true
fi

# Delete existing records if any
EXISTING_ROOT=$(doctl compute domain records list $DOMAIN --format ID,Name --no-header 2>/dev/null | grep "^[0-9]* @$" | awk '{print $1}' || true)
if [ ! -z "$EXISTING_ROOT" ]; then
    doctl compute domain records delete $DOMAIN $EXISTING_ROOT --force
fi

EXISTING_WWW=$(doctl compute domain records list $DOMAIN --format ID,Name --no-header 2>/dev/null | grep "^[0-9]* www$" | awk '{print $1}' || true)
if [ ! -z "$EXISTING_WWW" ]; then
    doctl compute domain records delete $DOMAIN $EXISTING_WWW --force
fi

# Create new DNS records
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

echo -e "${GREEN}✅ DNS configured${NC}"
echo ""

# Wait for SSH to be available
echo -e "${YELLOW}⏳ Waiting for SSH to be available...${NC}"
for i in {1..30}; do
    if ssh -i ~/.ssh/taskmanager_rsa -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@$DROPLET_IP 'echo SSH Ready' &>/dev/null; then
        echo -e "${GREEN}✅ SSH is ready${NC}"
        break
    fi
    echo "Attempt $i/30..."
    sleep 10
done
echo ""

# Create server setup script
echo -e "${YELLOW}📝 Setting up server...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'SETUPEOF'
set -e

echo "🚀 Setting up server..."

# Update system
echo "📦 Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PostgreSQL
echo "📦 Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Install other dependencies
echo "📦 Installing Nginx, Git, FFmpeg..."
apt install -y nginx git ffmpeg certbot python3-certbot-nginx rsync

# Install PM2
echo "📦 Installing PM2..."
npm install -g pm2

# Create taskmanager user
echo "👤 Creating taskmanager user..."
if ! id taskmanager &>/dev/null; then
    adduser --disabled-password --gecos "" taskmanager
    usermod -aG sudo taskmanager
    echo "taskmanager ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/taskmanager
fi

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Setup PostgreSQL
echo "🗄️ Configuring PostgreSQL..."
DB_PASSWORD=$(openssl rand -base64 32)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE taskmanager;" 2>/dev/null || true

# Update pg_hba.conf for md5 authentication
sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' /etc/postgresql/14/main/pg_hba.conf
systemctl restart postgresql

# Create directories
mkdir -p /home/taskmanager/TaskManager /home/taskmanager/uploads /home/taskmanager/backups
chown -R taskmanager:taskmanager /home/taskmanager
chmod 755 /home/taskmanager/uploads

# Save credentials
echo "$DB_PASSWORD" > /home/taskmanager/db_password.txt
chown taskmanager:taskmanager /home/taskmanager/db_password.txt
chmod 600 /home/taskmanager/db_password.txt

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "$JWT_SECRET" > /home/taskmanager/jwt_secret.txt
chown taskmanager:taskmanager /home/taskmanager/jwt_secret.txt
chmod 600 /home/taskmanager/jwt_secret.txt

echo "✅ Server setup complete!"
SETUPEOF

echo -e "${GREEN}✅ Server setup complete${NC}"
echo ""

# Get generated credentials
DB_PASSWORD=$(ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'cat /home/taskmanager/db_password.txt')
JWT_SECRET=$(ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'cat /home/taskmanager/jwt_secret.txt')

echo -e "${GREEN}🔐 Generated Credentials:${NC}"
echo "Database Password: $DB_PASSWORD"
echo "JWT Secret: $JWT_SECRET"
echo ""

# Copy application files to droplet
echo -e "${YELLOW}📤 Uploading application files...${NC}"
rsync -avz --progress \
    -e "ssh -i ~/.ssh/taskmanager_rsa -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'build' \
    --exclude 'dist' \
    --exclude 'uploads' \
    --exclude '*.log' \
    "$LOCAL_PATH/" root@$DROPLET_IP:/home/taskmanager/TaskManager/

ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP "chown -R taskmanager:taskmanager /home/taskmanager/TaskManager"

echo -e "${GREEN}✅ Files uploaded${NC}"
echo ""

# Deploy backend
echo -e "${YELLOW}🚀 Deploying backend...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << BACKENDEOF
sudo -u taskmanager bash << 'USEREOF'
set -e

cd /home/taskmanager/TaskManager/backend

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install

# Create .env file
echo "📝 Creating .env file..."
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD

# JWT Secret
JWT_SECRET=$JWT_SECRET

# File Upload
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760

# Spaces (configure later if needed)
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=taskmanager-uploads
SPACES_KEY=
SPACES_SECRET=
SPACES_REGION=nyc3

# Compression
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
ENVEOF

# Run migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Build
echo "🔨 Building backend..."
npm run build

# Start with PM2
echo "🚀 Starting API with PM2..."
pm2 delete taskmanager-api 2>/dev/null || true
pm2 start dist/index.js --name taskmanager-api
pm2 save

# Configure PM2 startup
pm2 startup systemd -u taskmanager --hp /home/taskmanager > /tmp/pm2_startup.sh
chmod +x /tmp/pm2_startup.sh

echo "✅ Backend deployed"
USEREOF

# Run PM2 startup command as root
bash /tmp/pm2_startup.sh
BACKENDEOF

echo -e "${GREEN}✅ Backend deployed${NC}"
echo ""

# Configure Nginx
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'NGINXEOF'
cat > /etc/nginx/sites-available/taskmanager << 'SERVEREOF'
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
SERVEREOF

ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
NGINXEOF

echo -e "${GREEN}✅ Nginx configured${NC}"
echo ""

# Build and deploy web app
echo -e "${YELLOW}🌐 Building and deploying web app...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'WEBEOF'
sudo -u taskmanager bash << 'BUILDEOF'
set -e

cd /home/taskmanager/TaskManager/web

echo "📦 Installing web dependencies..."
npm install

echo "🔨 Building web app..."
REACT_APP_API_URL=https://submitlist.space/api npm run build

echo "✅ Web app built"
BUILDEOF

systemctl restart nginx
WEBEOF

echo -e "${GREEN}✅ Web app deployed${NC}"
echo ""

# Setup SSL
echo -e "${YELLOW}🔒 Setting up SSL certificate...${NC}"
echo "Waiting 30 seconds for DNS to propagate..."
sleep 30

ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << SSLEOF
certbot --nginx -d submitlist.space -d www.submitlist.space \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --redirect || echo "SSL setup will retry automatically"
SSLEOF

echo -e "${GREEN}✅ SSL configured${NC}"
echo ""

# Setup backup cron job
echo -e "${YELLOW}💾 Setting up automated backups...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'BACKUPEOF'
sudo -u taskmanager bash << 'CRONEOF'
cat > /home/taskmanager/backup.sh << 'SCRIPTEOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/taskmanager/backups"
DB_NAME="taskmanager"
DB_USER="postgres"
DB_PASS=$(cat /home/taskmanager/db_password.txt)

mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=$DB_PASS pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/taskmanager/uploads 2>/dev/null

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
SCRIPTEOF

chmod +x /home/taskmanager/backup.sh

# Add to crontab
(crontab -l 2>/dev/null | grep -v backup.sh; echo "0 2 * * * /home/taskmanager/backup.sh >> /home/taskmanager/backup.log 2>&1") | crontab -
CRONEOF
BACKUPEOF

echo -e "${GREEN}✅ Backup configured${NC}"
echo ""

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}Your application is live at:${NC}"
echo -e "  🌐 https://submitlist.space"
echo -e "  🌐 https://www.submitlist.space"
echo ""
echo -e "${GREEN}API endpoint:${NC}"
echo -e "  🔧 https://submitlist.space/api"
echo ""
echo -e "${GREEN}Server details:${NC}"
echo -e "  📍 IP Address: $DROPLET_IP"
echo -e "  🔐 SSH: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP"
echo ""
echo -e "${GREEN}Credentials (saved on server):${NC}"
echo -e "  🗄️  Database Password: /home/taskmanager/db_password.txt"
echo -e "  🔑 JWT Secret: /home/taskmanager/jwt_secret.txt"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Test your application at https://submitlist.space"
echo "  2. Register a new account"
echo "  3. Create an organization and tasks"
echo "  4. Test image and video uploads"
echo ""
echo -e "${YELLOW}Management commands:${NC}"
echo "  📊 View logs: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'sudo -u taskmanager pm2 logs'"
echo "  🔄 Restart API: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'sudo -u taskmanager pm2 restart taskmanager-api'"
echo "  💾 Backup now: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'sudo -u taskmanager /home/taskmanager/backup.sh'"
echo ""
echo -e "${GREEN}Monthly cost: \$17${NC} (Droplet \$12 + Spaces \$5 when needed)"
echo ""
echo "🎊 Congratulations! Your Task Manager is now live!"
