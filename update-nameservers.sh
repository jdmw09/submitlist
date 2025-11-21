#!/bin/bash
set -e

# Namecheap API Nameserver Update Script
# Updates nameservers to DigitalOcean for submitlist.space

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Namecheap Nameserver Update${NC}"
echo "============================"
echo ""

# Configuration
DOMAIN_SLD="submitlist"
DOMAIN_TLD="space"
NAMESERVERS="ns1.digitalocean.com,ns2.digitalocean.com,ns3.digitalocean.com"

# Required: Set these environment variables or pass as arguments
# NAMECHEAP_API_USER="your_api_username"
# NAMECHEAP_API_KEY="your_api_key"
# NAMECHEAP_USERNAME="your_username"  # Usually same as API_USER

# Check if credentials are provided
if [ -z "$NAMECHEAP_API_USER" ] || [ -z "$NAMECHEAP_API_KEY" ] || [ -z "$NAMECHEAP_USERNAME" ]; then
    echo -e "${YELLOW}Please provide Namecheap API credentials:${NC}"
    echo ""
    read -p "API Username: " NAMECHEAP_API_USER
    read -p "API Key: " NAMECHEAP_API_KEY
    read -p "Username (usually same as API Username): " NAMECHEAP_USERNAME
    echo ""
fi

# Get current public IP (must be whitelisted in Namecheap)
CLIENT_IP=$(curl -s https://api.ipify.org)
echo -e "${GREEN}Your IP: $CLIENT_IP${NC}"
echo -e "${YELLOW}Make sure this IP is whitelisted in Namecheap API settings${NC}"
echo ""

# Confirm update
echo -e "Domain: ${GREEN}${DOMAIN_SLD}.${DOMAIN_TLD}${NC}"
echo -e "New Nameservers:"
echo "  - ns1.digitalocean.com"
echo "  - ns2.digitalocean.com"
echo "  - ns3.digitalocean.com"
echo ""
read -p "Proceed with nameserver update? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Make API call
echo ""
echo -e "${YELLOW}Updating nameservers...${NC}"

RESPONSE=$(curl -s "https://api.namecheap.com/xml.response" \
    --data-urlencode "ApiUser=$NAMECHEAP_API_USER" \
    --data-urlencode "ApiKey=$NAMECHEAP_API_KEY" \
    --data-urlencode "UserName=$NAMECHEAP_USERNAME" \
    --data-urlencode "ClientIp=$CLIENT_IP" \
    --data-urlencode "Command=namecheap.domains.dns.setCustom" \
    --data-urlencode "SLD=$DOMAIN_SLD" \
    --data-urlencode "TLD=$DOMAIN_TLD" \
    --data-urlencode "Nameservers=$NAMESERVERS")

# Check for success
if echo "$RESPONSE" | grep -q 'Status="OK"'; then
    echo -e "${GREEN}✅ Nameservers updated successfully!${NC}"
    echo ""
    echo -e "${YELLOW}DNS propagation will take 15-60 minutes${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Wait for DNS to propagate"
    echo "2. Check propagation: dig +short NS submitlist.space"
    echo "3. Once propagated, run SSL setup:"
    echo "   ssh -i ~/.ssh/taskmanager_rsa root@165.22.46.130 \\"
    echo "     'certbot --nginx -d submitlist.space -d www.submitlist.space \\"
    echo "      --non-interactive --agree-tos --email joseph.winwood@gmail.com --redirect'"
elif echo "$RESPONSE" | grep -q "Error"; then
    echo -e "${RED}❌ API Error:${NC}"
    ERROR_MSG=$(echo "$RESPONSE" | grep -oP '(?<=<Error Number=")[^"]*' | head -1)
    ERROR_DESC=$(echo "$RESPONSE" | grep -oP '(?<=<Error Number="[0-9]+">)[^<]*' | head -1)
    echo "Error $ERROR_MSG: $ERROR_DESC"
    echo ""
    echo "Common issues:"
    echo "- IP not whitelisted: Add $CLIENT_IP to API whitelist in Namecheap"
    echo "- Invalid API key: Check credentials in Namecheap dashboard"
    echo "- API not enabled: Enable API access in Profile > Tools > API Access"
else
    echo -e "${RED}❌ Unknown response:${NC}"
    echo "$RESPONSE"
fi

echo ""
echo "Full API Response:"
echo "$RESPONSE"
