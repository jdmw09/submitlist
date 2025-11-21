#!/bin/bash
set -e

# DNS Propagation Monitor and Auto-SSL Setup
# Monitors DNS propagation and automatically configures SSL when ready

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN="submitlist.space"
EXPECTED_IP="165.22.46.130"
EMAIL="joseph.winwood@gmail.com"
MAX_WAIT=60  # Maximum wait time in minutes

echo -e "${YELLOW}DNS Propagation Monitor${NC}"
echo "======================="
echo "Domain: $DOMAIN"
echo "Expected IP: $EXPECTED_IP"
echo "Max wait: $MAX_WAIT minutes"
echo ""
echo -e "${YELLOW}Checking DNS every 10 minutes...${NC}"
echo ""

START_TIME=$(date +%s)

while true; do
    CURRENT_IP=$(dig +short $DOMAIN | head -n 1)
    CURRENT_NS=$(dig +short NS $DOMAIN | head -n 1)
    ELAPSED=$(( ($(date +%s) - START_TIME) / 60 ))

    echo "[$(date '+%H:%M:%S')] Check #$((ELAPSED/10 + 1))"
    echo "  NS: $CURRENT_NS"
    echo "  IP: $CURRENT_IP"

    # Check if propagated
    if [[ "$CURRENT_IP" == "$EXPECTED_IP" ]]; then
        echo ""
        echo -e "${GREEN}✅ DNS Propagated!${NC}"
        echo ""
        echo -e "${YELLOW}Setting up SSL...${NC}"

        ssh -i ~/.ssh/taskmanager_rsa root@$EXPECTED_IP bash << 'SSLEOF'
certbot --nginx -d submitlist.space -d www.submitlist.space \
    --non-interactive --agree-tos --email joseph.winwood@gmail.com --redirect
systemctl restart nginx
SSLEOF

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ SSL configured successfully!${NC}"
            echo ""
            echo "Your site is now live:"
            echo "  🔒 https://submitlist.space"
            echo "  🔒 https://www.submitlist.space"
        else
            echo -e "${YELLOW}⚠️  SSL setup encountered an issue${NC}"
            echo "You can retry manually with:"
            echo "ssh -i ~/.ssh/taskmanager_rsa root@$EXPECTED_IP \\"
            echo "  'certbot --nginx -d submitlist.space -d www.submitlist.space \\"
            echo "   --non-interactive --agree-tos --email joseph.winwood@gmail.com --redirect'"
        fi

        exit 0
    fi

    # Check timeout
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo ""
        echo -e "${YELLOW}⏰ Max wait time reached${NC}"
        echo "DNS may take longer than expected."
        echo "Current status: $CURRENT_NS -> $CURRENT_IP"
        echo ""
        echo "You can:"
        echo "1. Run this script again to continue monitoring"
        echo "2. Check DNS manually: dig +short submitlist.space"
        echo "3. Set up SSL manually when DNS is ready"
        exit 1
    fi

    echo "  Waiting 10 minutes..."
    echo ""
    sleep 600
done
