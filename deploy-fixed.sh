#!/bin/bash
set -e

# TaskManager Fixed Deployment Script
# Handles Node.js conflicts and DNS propagation
# For: submitlist.space

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DROPLET_NAME="taskmanager-prod"
DOMAIN="submitlist.space"
REGION="nyc3"
SIZE="s-1vcpu-2gb"
EMAIL="joseph.winwood@gmail.com"
LOCAL_PATH="/Volumes/Adrian/TaskManager"

echo -e "${GREEN}🚀 TaskManager Deployment (Fixed)${NC}"
echo "===================================="

# Check prerequisites
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ doctl not found. Install: brew install doctl${NC}"
    exit 1
fi

if ! doctl account get &> /dev/null; then
    echo -e "${RED}❌ Not authenticated. Run: doctl auth init${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites met${NC}"

# SSH key setup
if [ ! -f ~/.ssh/taskmanager_rsa ]; then
    ssh-keygen -t rsa -b 4096 -C "submitlist.space" -f ~/.ssh/taskmanager_rsa -N ""
fi

if ! doctl compute ssh-key list | grep -q "taskmanager-key"; then
    doctl compute ssh-key import taskmanager-key --public-key-file ~/.ssh/taskmanager_rsa.pub
fi

SSH_KEY_ID=$(doctl compute ssh-key list --format ID,Name --no-header | grep taskmanager-key | awk '{print $1}')
echo -e "${GREEN}✅ SSH Key: $SSH_KEY_ID${NC}"

# Create or use existing droplet
if ! doctl compute droplet list | grep -q "$DROPLET_NAME"; then
    echo -e "${YELLOW}📦 Creating Droplet...${NC}"
    doctl compute droplet create $DROPLET_NAME \
        --size $SIZE \
        --image ubuntu-22-04-x64 \
        --region $REGION \
        --ssh-keys $SSH_KEY_ID \
        --enable-monitoring \
        --wait
    sleep 10
fi

DROPLET_IP=$(doctl compute droplet list --format PublicIPv4 --no-header $DROPLET_NAME)
echo -e "${GREEN}📍 Droplet IP: $DROPLET_IP${NC}"

# Configure DNS
echo -e "${YELLOW}🌐 Configuring DNS...${NC}"
if ! doctl compute domain list | grep -q "$DOMAIN"; then
    doctl compute domain create $DOMAIN || true
fi

# Update or create DNS records
EXISTING_ROOT=$(doctl compute domain records list $DOMAIN --format ID,Name --no-header 2>/dev/null | grep "^[0-9]* @$" | awk '{print $1}' || true)
if [ ! -z "$EXISTING_ROOT" ]; then
    doctl compute domain records delete $DOMAIN $EXISTING_ROOT --force
fi

doctl compute domain records create $DOMAIN \
    --record-type A \
    --record-name @ \
    --record-data $DROPLET_IP \
    --record-ttl 300

EXISTING_WWW=$(doctl compute domain records list $DOMAIN --format ID,Name --no-header 2>/dev/null | grep "^[0-9]* www$" | awk '{print $1}' || true)
if [ ! -z "$EXISTING_WWW" ]; then
    doctl compute domain records delete $DOMAIN $EXISTING_WWW --force
fi

doctl compute domain records create $DOMAIN \
    --record-type A \
    --record-name www \
    --record-data $DROPLET_IP \
    --record-ttl 300

echo -e "${GREEN}✅ DNS records created${NC}"

# Wait for SSH
echo -e "${YELLOW}⏳ Waiting for SSH...${NC}"
for i in {1..30}; do
    if ssh -i ~/.ssh/taskmanager_rsa -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@$DROPLET_IP 'echo Ready' &>/dev/null; then
        break
    fi
    sleep 10
done

# Server setup with Node.js conflict fix
echo -e "${YELLOW}🔧 Setting up server...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'SERVEREOF'
set -e
export DEBIAN_FRONTEND=noninteractive

# Update system
apt update && apt upgrade -y

# Remove old Node.js cleanly
apt remove -y --purge libnode72 nodejs nodejs-doc 2>/dev/null || true
apt autoremove -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install dependencies
apt install -y postgresql postgresql-contrib nginx git ffmpeg certbot python3-certbot-nginx rsync

# Install PM2
npm install -g pm2

# Create user
if ! id taskmanager &>/dev/null; then
    adduser --disabled-password --gecos "" taskmanager
    usermod -aG sudo taskmanager
    echo "taskmanager ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/taskmanager
fi

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# PostgreSQL
DB_PASSWORD=$(openssl rand -base64 32)
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE taskmanager;" 2>/dev/null || true
sed -i 's/local   all             postgres                                peer/local   all             postgres                                md5/' /etc/postgresql/14/main/pg_hba.conf
systemctl restart postgresql

# Directories
mkdir -p /home/taskmanager/{TaskManager,uploads,backups}
chown -R taskmanager:taskmanager /home/taskmanager
chmod 755 /home/taskmanager/uploads

# Save credentials
echo "$DB_PASSWORD" > /home/taskmanager/db_password.txt
JWT_SECRET=$(openssl rand -base64 32)
echo "$JWT_SECRET" > /home/taskmanager/jwt_secret.txt
chown taskmanager:taskmanager /home/taskmanager/{db_password.txt,jwt_secret.txt}
chmod 600 /home/taskmanager/{db_password.txt,jwt_secret.txt}

echo "✅ Server ready!"
SERVEREOF

echo -e "${GREEN}✅ Server setup complete${NC}"

# Upload application
echo -e "${YELLOW}📤 Uploading application...${NC}"
rsync -avz --progress \
    -e "ssh -i ~/.ssh/taskmanager_rsa -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' --exclude '.git' --exclude 'build' \
    --exclude 'dist' --exclude 'uploads' --exclude '*.log' \
    "$LOCAL_PATH/" root@$DROPLET_IP:/home/taskmanager/TaskManager/

ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP "chown -R taskmanager:taskmanager /home/taskmanager/TaskManager"
echo -e "${GREEN}✅ Files uploaded${NC}"

# Deploy backend
echo -e "${YELLOW}🚀 Deploying backend...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'BACKENDEOF'
sudo -u taskmanager bash << 'USEREOF'
set -e
cd /home/taskmanager/TaskManager/backend

npm install

DB_PASSWORD=$(cat /home/taskmanager/db_password.txt)
JWT_SECRET=$(cat /home/taskmanager/jwt_secret.txt)

cat > .env << ENVEOF
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskmanager
DB_USER=postgres
DB_PASSWORD=$DB_PASSWORD
JWT_SECRET=$JWT_SECRET
UPLOAD_DIR=/home/taskmanager/uploads
MAX_FILE_SIZE=10485760
ENABLE_IMAGE_COMPRESSION=true
ENABLE_VIDEO_COMPRESSION=true
MAX_IMAGE_WIDTH=1920
IMAGE_QUALITY=90
MAX_VIDEO_HEIGHT=1080
VIDEO_BITRATE=2500k
ENVEOF

npm run db:migrate
npm run build

pm2 delete taskmanager-api 2>/dev/null || true
pm2 start dist/index.js --name taskmanager-api
pm2 save
USEREOF

sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u taskmanager --hp /home/taskmanager
BACKENDEOF

echo -e "${GREEN}✅ Backend deployed${NC}"

# Build web app
echo -e "${YELLOW}🌐 Building web app...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'WEBEOF'
sudo -u taskmanager bash << 'BUILDEOF'
cd /home/taskmanager/TaskManager/web
npm install
REACT_APP_API_URL=https://submitlist.space/api npm run build
BUILDEOF
WEBEOF

echo -e "${GREEN}✅ Web app built${NC}"

# Configure Nginx
echo -e "${YELLOW}🌐 Configuring Nginx...${NC}"
ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << 'NGINXEOF'
cat > /etc/nginx/sites-available/taskmanager << 'CONF'
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
CONF

ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
NGINXEOF

echo -e "${GREEN}✅ Nginx configured${NC}"

# Check DNS and attempt SSL
echo ""
echo -e "${YELLOW}🔒 Checking DNS for SSL...${NC}"
CURRENT_IP=$(dig +short $DOMAIN | head -n 1)

if [ "$CURRENT_IP" = "$DROPLET_IP" ]; then
    echo -e "${GREEN}✅ DNS propagated! Setting up SSL...${NC}"
    ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP bash << SSLEOF
certbot --nginx -d $DOMAIN -d www.$DOMAIN \
    --non-interactive --agree-tos --email $EMAIL --redirect
systemctl restart nginx
SSLEOF
    echo -e "${GREEN}✅ SSL configured!${NC}"
else
    echo -e "${YELLOW}⏳ DNS not propagated yet${NC}"
    echo -e "${YELLOW}Current IP: $CURRENT_IP (should be $DROPLET_IP)${NC}"
    echo ""
    echo -e "${YELLOW}Action Required:${NC}"
    echo "1. Update nameservers at your domain registrar to:"
    echo "   - ns1.digitalocean.com"
    echo "   - ns2.digitalocean.com"
    echo "   - ns3.digitalocean.com"
    echo ""
    echo "2. Wait for DNS propagation (15-60 minutes)"
    echo ""
    echo "3. Run SSL setup manually:"
    echo "   ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP \\"
    echo "     'certbot --nginx -d $DOMAIN -d www.$DOMAIN \\"
    echo "      --non-interactive --agree-tos --email $EMAIL --redirect'"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${GREEN}Your application:${NC}"
echo -e "  🌐 HTTP: http://$DROPLET_IP"
if [ "$CURRENT_IP" = "$DROPLET_IP" ]; then
    echo -e "  🔒 HTTPS: https://$DOMAIN"
else
    echo -e "  ⏳ HTTPS: Pending DNS propagation"
fi
echo ""
echo -e "${GREEN}Server:${NC}"
echo -e "  📍 IP: $DROPLET_IP"
echo -e "  🔐 SSH: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP"
echo ""
echo -e "${GREEN}Manage:${NC}"
echo -e "  📊 Logs: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'sudo -u taskmanager pm2 logs'"
echo -e "  🔄 Restart: ssh -i ~/.ssh/taskmanager_rsa root@$DROPLET_IP 'sudo -u taskmanager pm2 restart taskmanager-api'"
echo ""
echo -e "${GREEN}Monthly cost: \$17${NC}"
