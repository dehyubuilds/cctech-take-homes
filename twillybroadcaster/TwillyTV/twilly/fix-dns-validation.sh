#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 The issue: share.twilly.app is a separate hosted zone but not properly delegated${NC}"
echo -e "${YELLOW}The validation record needs to be in the zone that actually resolves.${NC}\n"

echo -e "${YELLOW}Since share.twilly.app resolves to API Gateway, let's check if there's a parent zone...${NC}\n"

# The validation record that needs to be added
VALIDATION_NAME="_ed93fc1c93ad65f99b34be9fa0eccec4.share.twilly.app."
VALIDATION_VALUE="_b8401da580364176362bc344c46e7195.djqtsrsxkq.acm-validations.aws."
VALIDATION_TYPE="CNAME"

echo -e "${BLUE}Validation record details:${NC}"
echo -e "Name: $VALIDATION_NAME"
echo -e "Type: $VALIDATION_TYPE"
echo -e "Value: $VALIDATION_VALUE\n"

echo -e "${YELLOW}Since share.twilly.app is managed externally (likely via nsone.net),${NC}"
echo -e "${YELLOW}you need to add this CNAME record to wherever share.twilly.app DNS is actually managed.${NC}\n"

echo -e "${BLUE}Options:${NC}"
echo -e "1. If share.twilly.app DNS is managed in Netlify/nsone.net, add the record there"
echo -e "2. If there's a parent twilly.app zone in Route53, we can try adding it there"
echo -e "3. Create the record in the share.twilly.app Route53 zone AND set up NS delegation\n"

# Check if we can find where share.twilly.app DNS is actually managed
echo -e "${YELLOW}Checking where share.twilly.app DNS is managed...${NC}"
PARENT_NS=$(dig +short NS twilly.app @8.8.8.8 | head -1)
echo -e "Parent zone (twilly.app) uses: $PARENT_NS\n"

echo -e "${RED}⚠️  The validation record exists in Route53 but DNS queries don't reach it${NC}"
echo -e "${RED}because share.twilly.app subdomain zone isn't properly delegated.${NC}\n"

echo -e "${YELLOW}Quick fix: Add the validation record where share.twilly.app DNS is actually managed${NC}"
echo -e "${YELLOW}(likely in Netlify/nsone.net DNS management)${NC}\n"

