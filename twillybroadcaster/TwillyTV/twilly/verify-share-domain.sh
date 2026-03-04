#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying share.twilly.app configuration...${NC}\n"

DOMAIN_NAME="share.twilly.app"
REGION="us-east-1"

# Test DNS resolution
echo -e "${YELLOW}1. Testing DNS resolution...${NC}"
DNS_RESULT=$(dig +short $DOMAIN_NAME @8.8.8.8 2>/dev/null | head -1)

if [ -n "$DNS_RESULT" ]; then
    echo -e "${GREEN}✅ DNS resolves to: $DNS_RESULT${NC}"
else
    echo -e "${RED}❌ DNS does not resolve${NC}"
    echo -e "${YELLOW}   DNS may still be propagating (can take up to 48 hours)${NC}"
fi
echo ""

# Test HTTPS connection
echo -e "${YELLOW}2. Testing HTTPS connection...${NC}"
HTTPS_TEST=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$DOMAIN_NAME/test123" 2>/dev/null)

if [ "$HTTPS_TEST" == "000" ]; then
    echo -e "${RED}❌ Cannot connect to $DOMAIN_NAME${NC}"
    echo -e "${YELLOW}   This could mean:${NC}"
    echo -e "   - DNS is not resolving yet"
    echo -e "   - SSL certificate is not valid"
    echo -e "   - Domain is not properly configured"
elif [ "$HTTPS_TEST" == "404" ] || [ "$HTTPS_TEST" == "302" ] || [ "$HTTPS_TEST" == "301" ]; then
    echo -e "${GREEN}✅ HTTPS connection successful (HTTP $HTTPS_TEST)${NC}"
    echo -e "${GREEN}   Domain is reachable and SSL is working!${NC}"
elif [ "$HTTPS_TEST" == "502" ] || [ "$HTTPS_TEST" == "503" ]; then
    echo -e "${YELLOW}⚠️  Server error (HTTP $HTTPS_TEST)${NC}"
    echo -e "${YELLOW}   Domain is reachable but backend may have issues${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected response: HTTP $HTTPS_TEST${NC}"
fi
echo ""

# Test SSL certificate
echo -e "${YELLOW}3. Testing SSL certificate...${NC}"
CERT_INFO=$(echo | openssl s_client -servername $DOMAIN_NAME -connect $DOMAIN_NAME:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$CERT_INFO" ]; then
    echo -e "${GREEN}✅ SSL certificate is valid${NC}"
    echo "$CERT_INFO" | while IFS= read -r line; do
        echo -e "   $line"
    done
else
    echo -e "${RED}❌ Could not verify SSL certificate${NC}"
    echo -e "${YELLOW}   This may be normal if DNS is not yet resolving${NC}"
fi
echo ""

# Check API Gateway domain status
echo -e "${YELLOW}4. Checking API Gateway domain status...${NC}"
DOMAIN_STATUS=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].DomainNameStatus' --output text 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$DOMAIN_STATUS" ]; then
    if [ "$DOMAIN_STATUS" == "AVAILABLE" ]; then
        echo -e "${GREEN}✅ Domain status: $DOMAIN_STATUS${NC}"
    else
        echo -e "${YELLOW}⚠️  Domain status: $DOMAIN_STATUS${NC}"
    fi
else
    echo -e "${RED}❌ Could not get domain status${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$HTTPS_TEST" == "404" ] || [ "$HTTPS_TEST" == "302" ] || [ "$HTTPS_TEST" == "301" ]; then
    echo -e "${GREEN}✅ Domain appears to be working correctly!${NC}"
    echo -e "${GREEN}   You can test with a real short ID from your DynamoDB${NC}"
else
    echo -e "${YELLOW}⚠️  Domain setup may need more time or configuration${NC}"
    echo -e "${YELLOW}   If DNS just propagated, wait a few more minutes${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

