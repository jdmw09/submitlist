#!/bin/bash

# TaskManager Deployment Script for Digital Ocean
# This script automates the deployment process

set -e  # Exit on error

echo "======================================"
echo "TaskManager Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create a .env file based on .env.example"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo -e "${GREEN}Environment variables loaded${NC}"

# Check if required variables are set
required_vars=("DB_USER" "DB_PASSWORD" "DB_NAME" "JWT_SECRET" "APP_URL" "REACT_APP_API_URL")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: Required variable $var is not set in .env${NC}"
        exit 1
    fi
done

echo -e "${GREEN}All required environment variables are set${NC}"

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down || true

# Remove old images (optional - uncomment to clean up)
# echo -e "${YELLOW}Removing old images...${NC}"
# docker system prune -af

# Build new images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start containers
echo -e "${YELLOW}Starting containers...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for backend to be healthy
echo -e "${YELLOW}Waiting for backend to be healthy...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker exec taskmanager_backend_prod node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" 2>/dev/null; then
        echo -e "${GREEN}Backend is healthy!${NC}"
        break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for backend... (attempt $attempt/$max_attempts)"
    sleep 5
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}Backend failed to become healthy${NC}"
    docker-compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# Show container status
echo -e "${GREEN}Deployment successful!${NC}"
echo ""
echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}======================================"
echo "Deployment completed successfully!"
echo "======================================${NC}"
echo ""
echo "Application is running at: $APP_URL"
echo ""
echo "Useful commands:"
echo "  - View logs:    docker-compose -f docker-compose.prod.yml logs -f"
echo "  - Stop app:     docker-compose -f docker-compose.prod.yml down"
echo "  - Restart app:  docker-compose -f docker-compose.prod.yml restart"
echo ""
