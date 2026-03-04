#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CERT_ARN="${1:-arn:aws:acm:us-east-1:142770202579:certificate/67b6c2c0-d173-4d0a-9294-6b07901629c0}"
REGION="us-east-1"
MAX_WAIT=300  # 5 minutes max
INTERVAL=10   # Check every 10 seconds

echo -e "${BLUE}⏳ Waiting for certificate to be issued...${NC}\n"
echo -e "Certificate ARN: $CERT_ARN"
echo -e "Maximum wait time: ${MAX_WAIT}s\n"

ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)
    
    if [ "$STATUS" == "ISSUED" ]; then
        echo -e "\n${GREEN}✅ Certificate is now ISSUED!${NC}"
        echo -e "${BLUE}You can now run: ./fix-custom-domain-issues.sh${NC}\n"
        exit 0
    elif [ "$STATUS" == "VALIDATION_TIMED_OUT" ] || [ "$STATUS" == "FAILED" ]; then
        echo -e "\n${RED}❌ Certificate validation failed or timed out${NC}"
        echo -e "Status: $STATUS"
        exit 1
    else
        echo -e "${YELLOW}Status: $STATUS (waiting... ${ELAPSED}s / ${MAX_WAIT}s)${NC}"
    fi
    
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

echo -e "\n${YELLOW}⏰ Timeout reached. Certificate may still be validating.${NC}"
echo -e "Current status: $(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)"
echo -e "\n${BLUE}You can check status manually with:${NC}"
echo -e "aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.Status'\n"

