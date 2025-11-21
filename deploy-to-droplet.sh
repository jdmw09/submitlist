#!/bin/bash

# TaskManager - Automated Digital Ocean Deployment Script
# This script automates the actual deployment process used for production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SSH_KEY="${SSH_KEY:-$HOME/.ssh/taskmanager_rsa}"
DROPLET_IP="${DROPLET_IP}"
DROPLET_DOMAIN="${DROPLET_DOMAIN}"  # e.g., submitlist.space
DROPLET_USER="root"
APP_USER="taskmanager"
APP_DIR="/home/${APP_USER}/TaskManager"

# Function to print colored messages
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if [ -z "$DROPLET_IP" ]; then
        print_error "DROPLET_IP environment variable is not set"
        echo "Usage:"
        echo "  With domain (HTTPS): DROPLET_IP=1.2.3.4 DROPLET_DOMAIN=yourdomain.com ./deploy-to-droplet.sh"
        echo "  IP only (HTTP):      DROPLET_IP=1.2.3.4 ./deploy-to-droplet.sh"
        exit 1
    fi

    if [ ! -f "$SSH_KEY" ]; then
        print_error "SSH key not found at: $SSH_KEY"
        echo "Set SSH_KEY environment variable or create key at default location"
        exit 1
    fi

    if ! command -v rsync &> /dev/null; then
        print_error "rsync is not installed"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Test SSH connection
test_connection() {
    print_status "Testing SSH connection to $DROPLET_IP..."

    if ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes "$DROPLET_USER@$DROPLET_IP" 'echo "Connection successful"' &> /dev/null; then
        print_success "SSH connection successful"
    else
        print_error "Failed to connect to droplet"
        exit 1
    fi
}

# Transfer code
transfer_code() {
    print_status "Transferring code to droplet..."

    # Transfer backend
    print_status "Transferring backend code..."
    rsync -avz --exclude 'node_modules' \
      --exclude 'dist' \
      --exclude '.env' \
      --exclude '.git' \
      -e "ssh -i $SSH_KEY" \
      ./backend/ "$DROPLET_USER@$DROPLET_IP:$APP_DIR/backend/"
    print_success "Backend code transferred"

    # Transfer web
    print_status "Transferring web code..."
    rsync -avz --exclude 'node_modules' \
      --exclude 'build' \
      --exclude '.git' \
      -e "ssh -i $SSH_KEY" \
      ./web/ "$DROPLET_USER@$DROPLET_IP:$APP_DIR/web/"
    print_success "Web code transferred"
}

# Fix permissions
fix_permissions() {
    print_status "Fixing file permissions..."

    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "chown -R ${APP_USER}:${APP_USER} $APP_DIR"

    print_success "Permissions fixed"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."

    # Backend dependencies
    print_status "Installing backend dependencies..."
    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "cd $APP_DIR/backend && sudo -u $APP_USER npm install"
    print_success "Backend dependencies installed"

    # Web dependencies
    print_status "Installing web dependencies..."
    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "cd $APP_DIR/web && sudo -u $APP_USER npm install"
    print_success "Web dependencies installed"
}

# Build applications
build_applications() {
    print_status "Building applications..."

    # Build backend
    print_status "Building backend..."
    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "cd $APP_DIR/backend && sudo -u $APP_USER npm run build"
    print_success "Backend built successfully"

    # Build web with HTTPS API URL
    print_status "Building web frontend..."
    if [ -n "$DROPLET_DOMAIN" ]; then
        API_URL="https://$DROPLET_DOMAIN/api"
    else
        print_warning "DROPLET_DOMAIN not set, using IP (not recommended for production)"
        API_URL="http://$DROPLET_IP:3000"
    fi

    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "cd $APP_DIR/web && REACT_APP_API_URL=$API_URL sudo -u $APP_USER npm run build"
    print_success "Web built successfully with API URL: $API_URL"
}

# Restart services
restart_services() {
    print_status "Restarting services..."

    # Restart PM2
    print_status "Restarting PM2 process..."
    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "cd $APP_DIR/backend && sudo -u $APP_USER pm2 restart ecosystem.config.js || sudo -u $APP_USER pm2 start ecosystem.config.js"

    # Save PM2 configuration
    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "sudo -u $APP_USER pm2 save"

    print_success "Backend restarted"

    # Nginx doesn't need restart (serves new build automatically)
    print_success "Services restarted"
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."

    # Check HTTPS if domain is set
    if [ -n "$DROPLET_DOMAIN" ]; then
        print_status "Checking HTTPS..."
        if curl -s -o /dev/null -w "%{http_code}" "https://$DROPLET_DOMAIN/" | grep -q "200"; then
            print_success "HTTPS is working"
        else
            print_warning "HTTPS check failed, trying HTTP..."
            if curl -s -o /dev/null -w "%{http_code}" "http://$DROPLET_DOMAIN/" | grep -q "200"; then
                print_warning "HTTP works but HTTPS failed - SSL may not be configured"
            else
                print_error "Web frontend is not accessible"
            fi
        fi
    else
        # Check HTTP if only IP is provided
        if curl -s -o /dev/null -w "%{http_code}" "http://$DROPLET_IP/" | grep -q "200"; then
            print_success "Web frontend is accessible (HTTP)"
        else
            print_error "Web frontend is not accessible"
        fi
    fi

    # Check PM2 status
    print_status "Checking PM2 status..."
    ssh -i "$SSH_KEY" "$DROPLET_USER@$DROPLET_IP" \
      "sudo -u $APP_USER pm2 status"

    print_success "Deployment verification complete"
}

# Show deployment info
show_deployment_info() {
    echo ""
    echo -e "${GREEN}======================================"
    echo "Deployment completed successfully!"
    echo "======================================${NC}"
    echo ""
    echo "Application URLs:"
    if [ -n "$DROPLET_DOMAIN" ]; then
        echo "  Web App:  https://$DROPLET_DOMAIN"
        echo "  API:      https://$DROPLET_DOMAIN/api"
        echo "  (HTTP automatically redirects to HTTPS)"
    else
        echo "  Web App:  http://$DROPLET_IP"
        echo "  API:      http://$DROPLET_IP/api"
        echo ""
        echo -e "${YELLOW}WARNING: Using HTTP without SSL. Set DROPLET_DOMAIN for HTTPS.${NC}"
    fi
    echo ""
    echo "Useful commands:"
    echo "  SSH:          ssh -i $SSH_KEY $DROPLET_USER@$DROPLET_IP"
    echo "  PM2 status:   ssh -i $SSH_KEY $DROPLET_USER@$DROPLET_IP 'sudo -u $APP_USER pm2 status'"
    echo "  PM2 logs:     ssh -i $SSH_KEY $DROPLET_USER@$DROPLET_IP 'sudo -u $APP_USER pm2 logs'"
    echo "  PM2 restart:  ssh -i $SSH_KEY $DROPLET_USER@$DROPLET_IP 'sudo -u $APP_USER pm2 restart taskmanager-backend'"
    echo ""
    if [ -n "$DROPLET_DOMAIN" ]; then
        echo "Next steps:"
        echo "  - Verify SSL certificate: curl -I https://$DROPLET_DOMAIN"
        echo "  - Check auto-renewal: ssh -i $SSH_KEY $DROPLET_USER@$DROPLET_IP 'certbot renew --dry-run'"
        echo ""
    fi
}

# Main deployment flow
main() {
    echo -e "${BLUE}"
    echo "======================================"
    echo "TaskManager Deployment Script"
    echo "======================================"
    echo -e "${NC}"
    echo "Deploying to: $DROPLET_IP"
    echo ""

    check_prerequisites
    test_connection
    transfer_code
    fix_permissions
    install_dependencies
    build_applications
    restart_services
    verify_deployment
    show_deployment_info
}

# Run deployment
main
