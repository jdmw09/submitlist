#!/bin/bash
set -e

# Quick Update Script for Production
# Based on lessons learned during initial deployment
# Use this for updating code without full redeployment

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DROPLET_IP="165.22.46.130"
DOMAIN="submitlist.space"
SSH_KEY="~/.ssh/taskmanager_rsa"

echo -e "${GREEN}TaskManager Production Update${NC}"
echo "=============================="
echo ""

# Check what to update
echo "What would you like to update?"
echo "1. Web app only"
echo "2. Backend only"
echo "3. Both web app and backend"
read -p "Choice (1-3): " CHOICE

case $CHOICE in
  1)
    echo -e "${YELLOW}Updating web app...${NC}"

    # Upload web source files
    rsync -avz --progress \
      -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
      --exclude 'node_modules' --exclude '.git' --exclude 'build' \
      --exclude 'dist' --exclude '*.log' \
      web/src/ root@$DROPLET_IP:/home/taskmanager/TaskManager/web/src/

    # Rebuild web app
    ssh -i $SSH_KEY root@$DROPLET_IP bash << 'EOF'
echo "Fixing permissions..."
chown -R taskmanager:taskmanager /home/taskmanager/TaskManager/web/src

echo "Rebuilding web app with production API URL..."
sudo -u taskmanager bash << 'USEREOF'
cd /home/taskmanager/TaskManager/web
REACT_APP_API_URL=https://submitlist.space/api npm run build
USEREOF

echo "Restarting Nginx..."
systemctl restart nginx

echo "✅ Web app updated!"
EOF
    ;;

  2)
    echo -e "${YELLOW}Updating backend...${NC}"

    # Upload backend source files
    rsync -avz --progress \
      -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
      --exclude 'node_modules' --exclude 'dist' --exclude '*.log' \
      backend/src/ root@$DROPLET_IP:/home/taskmanager/TaskManager/backend/src/

    # Rebuild and restart backend
    ssh -i $SSH_KEY root@$DROPLET_IP bash << 'EOF'
echo "Fixing permissions..."
chown -R taskmanager:taskmanager /home/taskmanager/TaskManager/backend/src

echo "Rebuilding backend..."
sudo -u taskmanager bash << 'USEREOF'
cd /home/taskmanager/TaskManager/backend
npm install
npm run build
pm2 restart taskmanager-api
USEREOF

echo "✅ Backend updated!"
EOF
    ;;

  3)
    echo -e "${YELLOW}Updating both web app and backend...${NC}"

    # Upload all source files
    rsync -avz --progress \
      -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
      --exclude 'node_modules' --exclude '.git' --exclude 'build' \
      --exclude 'dist' --exclude 'uploads' --exclude '*.log' \
      web/src/ backend/src/ root@$DROPLET_IP:/home/taskmanager/TaskManager/

    # Rebuild everything
    ssh -i $SSH_KEY root@$DROPLET_IP bash << 'EOF'
echo "Fixing permissions..."
chown -R taskmanager:taskmanager /home/taskmanager/TaskManager

echo "Rebuilding backend..."
sudo -u taskmanager bash << 'USEREOF'
cd /home/taskmanager/TaskManager/backend
npm install
npm run build
pm2 restart taskmanager-api

cd /home/taskmanager/TaskManager/web
REACT_APP_API_URL=https://submitlist.space/api npm run build
USEREOF

echo "Restarting services..."
systemctl restart nginx

echo "✅ Full update complete!"
EOF
    ;;

  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Update complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Test the site: https://$DOMAIN"
echo "2. Check logs: ssh -i $SSH_KEY root@$DROPLET_IP 'sudo -u taskmanager pm2 logs'"
echo "3. Clear browser cache (Cmd+Shift+R)"
