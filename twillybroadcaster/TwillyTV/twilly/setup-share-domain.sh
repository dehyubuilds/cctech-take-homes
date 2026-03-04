#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up share.twilly.app custom domain...${NC}\n"

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

# Step 1: Get API Gateway ID
echo -e "${YELLOW}1. Getting API Gateway ID...${NC}"
API_ID=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?Name=='$API_NAME'].ApiId" --output text 2>/dev/null)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    echo -e "${RED}❌ API Gateway '$API_NAME' not found!${NC}"
    echo -e "${YELLOW}💡 Run deploy-url-shortener-api.sh first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ API Gateway ID: $API_ID${NC}\n"

# Get stage name
STAGE_NAME=$(aws apigatewayv2 get-stages --api-id $API_ID --region $REGION --query 'Items[0].StageName' --output text 2>/dev/null)
STAGE_NAME=${STAGE_NAME:-default}
echo -e "${GREEN}   Stage: $STAGE_NAME${NC}\n"

# Step 2: Check/Create SSL Certificate
echo -e "${YELLOW}2. Checking SSL Certificate...${NC}"
CERT_ARN=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" --output text 2>/dev/null)

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
    echo -e "${YELLOW}📝 Requesting new certificate for $DOMAIN_NAME...${NC}"
    
    # Request certificate
    CERT_REQUEST=$(aws acm request-certificate \
        --domain-name $DOMAIN_NAME \
        --validation-method DNS \
        --region $REGION \
        --query 'CertificateArn' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$CERT_REQUEST" ]; then
        CERT_ARN=$CERT_REQUEST
        echo -e "${GREEN}✅ Certificate requested: $CERT_ARN${NC}"
        echo -e "${YELLOW}⏳ Certificate is pending validation. You need to add DNS records.${NC}\n"
        
        # Get validation records
        echo -e "${BLUE}📋 DNS Validation Records:${NC}"
        sleep 3  # Wait a moment for validation records to be available
        
        VALIDATION=$(aws acm describe-certificate \
            --certificate-arn "$CERT_ARN" \
            --region $REGION \
            --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
            --output json 2>/dev/null)
        
        if [ -n "$VALIDATION" ] && [ "$VALIDATION" != "null" ]; then
            VAL_NAME=$(echo "$VALIDATION" | jq -r '.Name')
            VAL_TYPE=$(echo "$VALIDATION" | jq -r '.Type')
            VAL_VALUE=$(echo "$VALIDATION" | jq -r '.Value')
            
            echo -e "${YELLOW}   Add this CNAME record to your Route53 hosted zone:${NC}"
            echo -e "${GREEN}   Name:  $VAL_NAME${NC}"
            echo -e "${GREEN}   Type:  $VAL_TYPE${NC}"
            echo -e "${GREEN}   Value: $VAL_VALUE${NC}\n"
            
            echo -e "${YELLOW}   ⚠️  IMPORTANT: Certificate validation must complete before continuing!${NC}"
            echo -e "${YELLOW}   Wait a few minutes, then check status with:${NC}"
            echo -e "${BLUE}   aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.Status'${NC}\n"
            
            read -p "Press Enter after you've added the DNS record and certificate is validated..."
        else
            echo -e "${YELLOW}   ⚠️  Validation records not yet available. Check AWS Console.${NC}\n"
        fi
    else
        echo -e "${RED}❌ Failed to request certificate${NC}"
        exit 1
    fi
else
    # Check certificate status
    CERT_STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)
    echo -e "${GREEN}✅ Certificate found: $CERT_ARN${NC}"
    echo -e "   Status: $CERT_STATUS"
    
    if [ "$CERT_STATUS" != "ISSUED" ]; then
        echo -e "${RED}   ⚠️  Certificate is not ISSUED yet. Status: $CERT_STATUS${NC}"
        echo -e "${YELLOW}   Please wait for validation to complete before continuing.${NC}\n"
        read -p "Press Enter when certificate status is ISSUED..."
    fi
fi

# Step 3: Create/Update API Gateway Custom Domain
echo -e "\n${YELLOW}3. Creating/Updating API Gateway Custom Domain...${NC}"
DOMAIN_EXISTS=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION 2>/dev/null)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Custom domain already exists${NC}"
    echo -e "${YELLOW}   Updating certificate...${NC}"
    
    # Update domain with certificate
    aws apigatewayv2 update-domain-name \
        --domain-name $DOMAIN_NAME \
        --domain-name-configurations CertificateArn=$CERT_ARN \
        --region $REGION > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Domain updated with certificate${NC}"
    else
        echo -e "${YELLOW}   Update may have failed or certificate already in use${NC}"
    fi
else
    echo -e "${YELLOW}   Creating new custom domain...${NC}"
    
    # Create custom domain
    DOMAIN_CREATE=$(aws apigatewayv2 create-domain-name \
        --domain-name $DOMAIN_NAME \
        --domain-name-configurations CertificateArn=$CERT_ARN \
        --region $REGION \
        --query 'DomainName' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$DOMAIN_CREATE" ]; then
        echo -e "${GREEN}✅ Custom domain created${NC}"
    else
        echo -e "${RED}❌ Failed to create custom domain${NC}"
        exit 1
    fi
fi

# Get target domain name
TARGET_DOMAIN=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].TargetDomainName' --output text 2>/dev/null)
echo -e "${GREEN}   Target Domain: $TARGET_DOMAIN${NC}\n"

# Step 4: Create API Mapping
echo -e "${YELLOW}4. Creating API Mapping...${NC}"
EXISTING_MAPPING=$(aws apigatewayv2 get-api-mappings --domain-name $DOMAIN_NAME --region $REGION --query "Items[?ApiId=='$API_ID']" --output json 2>/dev/null)

if [ -n "$EXISTING_MAPPING" ] && [ "$EXISTING_MAPPING" != "[]" ]; then
    echo -e "${GREEN}✅ API mapping already exists${NC}"
else
    echo -e "${YELLOW}   Creating new API mapping...${NC}"
    
    # Create API mapping (empty key means root path)
    MAPPING=$(aws apigatewayv2 create-api-mapping \
        --domain-name $DOMAIN_NAME \
        --api-id $API_ID \
        --stage $STAGE_NAME \
        --api-mapping-key "" \
        --region $REGION \
        --query 'ApiMappingId' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$MAPPING" ]; then
        echo -e "${GREEN}✅ API mapping created${NC}"
    else
        echo -e "${RED}❌ Failed to create API mapping${NC}"
        exit 1
    fi
fi
echo ""

# Step 5: Route53 DNS Setup
echo -e "${YELLOW}5. Route53 DNS Configuration...${NC}"
HOSTED_ZONES=$(aws route53 list-hosted-zones --query "HostedZones[?contains(Name, 'twilly.app') || contains(Name, 'twilly')]" --output json 2>/dev/null)

if [ -n "$HOSTED_ZONES" ] && [ "$HOSTED_ZONES" != "[]" ]; then
    ZONE_ID=$(echo "$HOSTED_ZONES" | jq -r '.[0].Id' | sed 's|/hostedzone/||')
    ZONE_NAME=$(echo "$HOSTED_ZONES" | jq -r '.[0].Name' | sed 's/\.$//')
    
    echo -e "${GREEN}✅ Found hosted zone: $ZONE_NAME ($ZONE_ID)${NC}"
    
    # Check if record exists
    EXISTING_RECORD=$(aws route53 list-resource-record-sets \
        --hosted-zone-id $ZONE_ID \
        --query "ResourceRecordSets[?Name=='$DOMAIN_NAME.']" \
        --output json 2>/dev/null)
    
    if [ -n "$EXISTING_RECORD" ] && [ "$EXISTING_RECORD" != "[]" ]; then
        echo -e "${GREEN}   DNS record already exists${NC}"
        
        # Check if it points to the right target
        RECORD_ALIAS=$(echo "$EXISTING_RECORD" | jq -r '.[0].AliasTarget.DNSName' 2>/dev/null)
        if [[ "$RECORD_ALIAS" == *"execute-api"* ]] || [[ "$RECORD_ALIAS" == *"$TARGET_DOMAIN"* ]]; then
            echo -e "${GREEN}   ✅ Record appears to be correctly configured${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Record exists but may need update${NC}"
        fi
    else
        echo -e "${YELLOW}   Creating DNS record...${NC}"
        
        # Create A record (alias) pointing to API Gateway
        CHANGE_BATCH=$(cat <<EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "$DOMAIN_NAME",
            "Type": "A",
            "AliasTarget": {
                "HostedZoneId": "Z2FDTNDATAQYW2",
                "DNSName": "$TARGET_DOMAIN",
                "EvaluateTargetHealth": false
            }
        }
    }]
}
EOF
)
        
        CHANGE_ID=$(aws route53 change-resource-record-sets \
            --hosted-zone-id $ZONE_ID \
            --change-batch "$CHANGE_BATCH" \
            --query 'ChangeInfo.Id' \
            --output text 2>/dev/null)
        
        if [ $? -eq 0 ] && [ -n "$CHANGE_ID" ]; then
            echo -e "${GREEN}✅ DNS record created: $CHANGE_ID${NC}"
            echo -e "${YELLOW}   ⏳ DNS propagation may take a few minutes${NC}"
        else
            echo -e "${RED}❌ Failed to create DNS record${NC}"
            echo -e "${YELLOW}   You may need to create it manually:${NC}"
            echo -e "${BLUE}   Type: A (Alias)${NC}"
            echo -e "${BLUE}   Alias Target: $TARGET_DOMAIN${NC}"
            echo -e "${BLUE}   Hosted Zone ID: Z2FDTNDATAQYW2${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  No Route53 hosted zone found for twilly.app${NC}"
    echo -e "${YELLOW}   Manual DNS setup required:${NC}"
    echo -e "${BLUE}   Create A record (Alias) for $DOMAIN_NAME${NC}"
    echo -e "${BLUE}   Alias Target: $TARGET_DOMAIN${NC}"
    echo -e "${BLUE}   Hosted Zone ID: Z2FDTNDATAQYW2${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Configuration:${NC}"
echo -e "   Domain: $DOMAIN_NAME"
echo -e "   Certificate: $CERT_ARN"
echo -e "   API Gateway: $API_ID"
echo -e "   Target Domain: $TARGET_DOMAIN"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "   1. Wait for DNS propagation (may take 5-60 minutes)"
echo -e "   2. Test the domain: curl -I https://$DOMAIN_NAME/test123"
echo -e "   3. If certificate was just created, ensure validation is complete"
echo ""
echo -e "${BLUE}To verify everything is working:${NC}"
echo -e "   ./verify-share-domain.sh"
echo ""

