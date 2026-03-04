#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Checking share.twilly.app infrastructure...${NC}\n"

# Configuration
REGION="us-east-1"
DOMAIN_NAME="share.twilly.app"
API_NAME="twilly-url-shortener-api"
URL_REDIRECT_FUNCTION="UrlRedirectFunction"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Error: Could not get AWS account ID. Make sure AWS CLI is configured.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS Account ID: $ACCOUNT_ID${NC}\n"

# Step 1: Check API Gateway
echo -e "${YELLOW}1. Checking API Gateway...${NC}"
API_ID=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?Name=='$API_NAME'].ApiId" --output text 2>/dev/null)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    echo -e "${RED}❌ API Gateway '$API_NAME' not found!${NC}"
    echo -e "${YELLOW}💡 Run deploy-url-shortener-api.sh first to create the API Gateway.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ API Gateway found: $API_ID${NC}"
fi

# Get stage name
STAGE_NAME=$(aws apigatewayv2 get-stages --api-id $API_ID --region $REGION --query 'Items[0].StageName' --output text 2>/dev/null)
echo -e "${GREEN}   Stage: ${STAGE_NAME:-default}${NC}\n"

# Step 2: Check Lambda function
echo -e "${YELLOW}2. Checking Lambda function...${NC}"
LAMBDA_EXISTS=$(aws lambda get-function --function-name $URL_REDIRECT_FUNCTION --region $REGION 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda function '$URL_REDIRECT_FUNCTION' exists${NC}"
else
    echo -e "${RED}❌ Lambda function '$URL_REDIRECT_FUNCTION' not found!${NC}"
    echo -e "${YELLOW}💡 Run deploy-url-shortener-api.sh first to create the Lambda function.${NC}"
    exit 1
fi
echo ""

# Step 3: Check ACM Certificate
echo -e "${YELLOW}3. Checking SSL Certificate...${NC}"
CERT_ARN=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" --output text 2>/dev/null)

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
    # Check for wildcard or alternative names
    CERT_ARN=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?contains(SubjectAlternativeNameList, '$DOMAIN_NAME')].CertificateArn" --output text 2>/dev/null)
fi

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
    echo -e "${RED}❌ No certificate found for $DOMAIN_NAME${NC}"
    echo -e "${YELLOW}📝 We'll need to request a new certificate.${NC}"
    CERT_ARN=""
else
    echo -e "${GREEN}✅ Certificate found: $CERT_ARN${NC}"
    
    # Check certificate status
    CERT_STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)
    CERT_EXPIRY=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.NotAfter' --output text 2>/dev/null)
    
    echo -e "   Status: $CERT_STATUS"
    
    if [ "$CERT_STATUS" != "ISSUED" ]; then
        echo -e "${RED}   ⚠️  Certificate status is not ISSUED - validation may be pending${NC}"
    fi
    
    if [ -n "$CERT_EXPIRY" ]; then
        EXPIRY_DATE=$(date -d "$CERT_EXPIRY" +%Y-%m-%d 2>/dev/null || echo "$CERT_EXPIRY")
        echo -e "   Expires: $EXPIRY_DATE"
        
        # Check if expired
        EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null)
        CURRENT_EPOCH=$(date +%s)
        if [ -n "$EXPIRY_EPOCH" ] && [ "$EXPIRY_EPOCH" -lt "$CURRENT_EPOCH" ]; then
            echo -e "${RED}   ⚠️  Certificate has EXPIRED!${NC}"
            CERT_ARN=""  # Mark for renewal
        fi
    fi
fi
echo ""

# Step 4: Check API Gateway Custom Domain
echo -e "${YELLOW}4. Checking API Gateway Custom Domain...${NC}"
DOMAIN_EXISTS=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Custom domain '$DOMAIN_NAME' exists${NC}"
    
    # Get domain configuration
    DOMAIN_CERT_ARN=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].CertificateArn' --output text 2>/dev/null)
    TARGET_DOMAIN=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].TargetDomainName' --output text 2>/dev/null)
    
    echo -e "   Certificate ARN: $DOMAIN_CERT_ARN"
    echo -e "   Target Domain: $TARGET_DOMAIN"
    
    if [ "$DOMAIN_CERT_ARN" != "$CERT_ARN" ] && [ -n "$CERT_ARN" ]; then
        echo -e "${YELLOW}   ⚠️  Domain is using different certificate - may need update${NC}"
    fi
    
    # Check API mappings
    MAPPINGS=$(aws apigatewayv2 get-api-mappings --domain-name $DOMAIN_NAME --region $REGION --query 'Items' --output json 2>/dev/null)
    if [ -n "$MAPPINGS" ] && [ "$MAPPINGS" != "[]" ]; then
        echo -e "${GREEN}   ✅ API mappings exist${NC}"
    else
        echo -e "${YELLOW}   ⚠️  No API mappings found - domain not connected to API${NC}"
    fi
else
    echo -e "${RED}❌ Custom domain '$DOMAIN_NAME' does not exist${NC}"
    TARGET_DOMAIN=""
fi
echo ""

# Step 5: Check Route53 DNS
echo -e "${YELLOW}5. Checking Route53 DNS...${NC}"
HOSTED_ZONES=$(aws route53 list-hosted-zones --query "HostedZones[?contains(Name, 'twilly.app') || contains(Name, 'twilly')]" --output json 2>/dev/null)

if [ -n "$HOSTED_ZONES" ] && [ "$HOSTED_ZONES" != "[]" ]; then
    echo -e "${GREEN}✅ Found hosted zones for twilly.app${NC}"
    
    # Find the correct zone (should contain twilly.app)
    ZONE_ID=$(echo "$HOSTED_ZONES" | jq -r '.[0].Id' | sed 's|/hostedzone/||')
    ZONE_NAME=$(echo "$HOSTED_ZONES" | jq -r '.[0].Name' | sed 's/\.$//')
    echo -e "   Zone: $ZONE_NAME ($ZONE_ID)"
    
    # Check for existing record
    RECORD=$(aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID --query "ResourceRecordSets[?Name=='$DOMAIN_NAME.']" --output json 2>/dev/null)
    
    if [ -n "$RECORD" ] && [ "$RECORD" != "[]" ]; then
        echo -e "${GREEN}   ✅ DNS record exists for $DOMAIN_NAME${NC}"
        RECORD_TYPE=$(echo "$RECORD" | jq -r '.[0].Type')
        echo -e "   Type: $RECORD_TYPE"
    else
        echo -e "${RED}   ❌ No DNS record found for $DOMAIN_NAME${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No hosted zones found for twilly.app${NC}"
    echo -e "${YELLOW}   You may need to set up Route53 manually${NC}"
    ZONE_ID=""
fi
echo ""

# Summary and next steps
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ISSUES=0

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
    echo -e "${RED}❌ Certificate: MISSING or EXPIRED${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ Certificate: OK${NC}"
fi

if [ $? -ne 0 ] || [ -z "$DOMAIN_EXISTS" ]; then
    echo -e "${RED}❌ Custom Domain: NOT CONFIGURED${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✅ Custom Domain: EXISTS${NC}"
fi

if [ -z "$ZONE_ID" ]; then
    echo -e "${YELLOW}⚠️  Route53: NEEDS MANUAL SETUP${NC}"
else
    echo -e "${GREEN}✅ Route53: CONFIGURED${NC}"
fi

echo ""

if [ $ISSUES -gt 0 ]; then
    echo -e "${YELLOW}🔧 Next steps to fix:${NC}"
    echo -e "${YELLOW}   Run: ./setup-share-domain.sh${NC}"
    echo ""
    echo -e "${BLUE}This will:${NC}"
    
    if [ -z "$CERT_ARN" ]; then
        echo -e "   1. Request new SSL certificate for $DOMAIN_NAME"
        echo -e "   2. Provide DNS validation records to add to Route53"
    fi
    
    if [ -z "$DOMAIN_EXISTS" ]; then
        echo -e "   3. Create API Gateway custom domain"
        echo -e "   4. Map custom domain to API Gateway"
    fi
    
    if [ -z "$ZONE_ID" ]; then
        echo -e "   5. Set up Route53 DNS record (manual step)"
    fi
else
    echo -e "${GREEN}✅ All infrastructure appears to be configured correctly!${NC}"
    echo -e "${YELLOW}If share.twilly.app still doesn't work, check:${NC}"
    echo -e "   - Certificate validation status"
    echo -e "   - DNS propagation (may take up to 48 hours)"
    echo -e "   - API Gateway route configuration"
fi

echo ""

