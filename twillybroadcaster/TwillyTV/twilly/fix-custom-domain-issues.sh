#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fixing share.twilly.app custom domain issues...${NC}\n"

# Configuration
REGION="us-east-1"
DOMAIN_NAME="share.twilly.app"
API_NAME="twilly-url-shortener-api"
API_ID="x31lvs6wy6"

# Step 1: Check certificate status properly
echo -e "${YELLOW}1. Checking certificate status...${NC}"
CERT_ARNS=$(aws acm list-certificates --region $REGION --query "CertificateSummaryList[?contains(DomainName, 'share.twilly.app') || contains(SubjectAlternativeNameList, 'share.twilly.app')].CertificateArn" --output text 2>/dev/null)

# Convert to array and check each certificate
CERT_ARRAY=($CERT_ARNS)
VALID_CERT_ARN=""

for CERT_ARN in "${CERT_ARRAY[@]}"; do
    if [ -n "$CERT_ARN" ] && [ "$CERT_ARN" != "None" ]; then
        STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)
        DOMAIN=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.DomainName' --output text 2>/dev/null)
        
        echo -e "   Certificate: ${CERT_ARN:0:50}..."
        echo -e "   Domain: $DOMAIN"
        echo -e "   Status: $STATUS"
        
        if [ "$STATUS" == "ISSUED" ] && [ "$DOMAIN" == "$DOMAIN_NAME" ]; then
            VALID_CERT_ARN="$CERT_ARN"
            echo -e "${GREEN}   ✅ Found valid ISSUED certificate${NC}"
            break
        elif [ "$STATUS" == "ISSUED" ]; then
            echo -e "${YELLOW}   ⚠️  Certificate is ISSUED but for different domain${NC}"
        else
            echo -e "${YELLOW}   ⚠️  Certificate status: $STATUS (not ISSUED)${NC}"
        fi
        echo ""
    fi
done

if [ -z "$VALID_CERT_ARN" ]; then
    # Check the certificate currently attached to the domain
    CURRENT_CERT=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].CertificateArn' --output text 2>/dev/null)
    
    if [ -n "$CURRENT_CERT" ] && [ "$CURRENT_CERT" != "None" ]; then
        STATUS=$(aws acm describe-certificate --certificate-arn "$CURRENT_CERT" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)
        echo -e "${YELLOW}   Current domain certificate: $CURRENT_CERT${NC}"
        echo -e "   Status: $STATUS"
        
        if [ "$STATUS" == "ISSUED" ]; then
            VALID_CERT_ARN="$CURRENT_CERT"
            echo -e "${GREEN}   ✅ Using current certificate${NC}"
        else
            echo -e "${RED}   ❌ Current certificate is not ISSUED${NC}"
        fi
    fi
fi

if [ -z "$VALID_CERT_ARN" ]; then
    echo -e "${RED}❌ No valid ISSUED certificate found for $DOMAIN_NAME${NC}"
    echo -e "${YELLOW}   You may need to request a new certificate or validate existing ones${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    # Use the first certificate we found
    VALID_CERT_ARN="${CERT_ARRAY[0]}"
fi

# Step 2: Check and fix custom domain configuration
echo -e "\n${YELLOW}2. Checking custom domain configuration...${NC}"
DOMAIN_INFO=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION 2>/dev/null)

if [ $? -eq 0 ]; then
    TARGET_DOMAIN=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].TargetDomainName' --output text 2>/dev/null)
    DOMAIN_STATUS=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].DomainNameStatus' --output text 2>/dev/null)
    
    echo -e "   Target Domain: ${TARGET_DOMAIN:-'None (PROBLEM!)'}"
    echo -e "   Domain Status: $DOMAIN_STATUS"
    
    if [ -z "$TARGET_DOMAIN" ] || [ "$TARGET_DOMAIN" == "None" ]; then
        echo -e "${RED}   ❌ Target domain is missing - this is the main issue!${NC}"
        echo -e "${YELLOW}   Updating domain configuration...${NC}"
        
        # Update the domain with the certificate (this should generate the target domain)
        UPDATE_RESULT=$(aws apigatewayv2 update-domain-name \
            --domain-name $DOMAIN_NAME \
            --domain-name-configurations CertificateArn=$VALID_CERT_ARN \
            --region $REGION 2>&1)
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}   ✅ Domain configuration updated${NC}"
            sleep 3  # Wait a moment for target domain to be generated
            
            # Get updated target domain
            TARGET_DOMAIN=$(aws apigatewayv2 get-domain-name --domain-name $DOMAIN_NAME --region $REGION --query 'DomainNameConfigurations[0].TargetDomainName' --output text 2>/dev/null)
            echo -e "${GREEN}   New Target Domain: $TARGET_DOMAIN${NC}"
        else
            echo -e "${RED}   ❌ Failed to update domain: $UPDATE_RESULT${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}   ✅ Target domain exists: $TARGET_DOMAIN${NC}"
    fi
else
    echo -e "${RED}❌ Custom domain does not exist${NC}"
    exit 1
fi

# Step 3: Verify API mapping
echo -e "\n${YELLOW}3. Verifying API mapping...${NC}"
MAPPINGS=$(aws apigatewayv2 get-api-mappings --domain-name $DOMAIN_NAME --region $REGION --query "Items[?ApiId=='$API_ID']" --output json 2>/dev/null)

if [ -n "$MAPPINGS" ] && [ "$MAPPINGS" != "[]" ]; then
    echo -e "${GREEN}   ✅ API mapping exists${NC}"
else
    echo -e "${YELLOW}   ⚠️  API mapping not found, creating...${NC}"
    
    # Get stage name
    STAGE_NAME=$(aws apigatewayv2 get-stages --api-id $API_ID --region $REGION --query 'Items[0].StageName' --output text 2>/dev/null)
    STAGE_NAME=${STAGE_NAME:-$default}
    
    # Create API mapping
    aws apigatewayv2 create-api-mapping \
        --domain-name $DOMAIN_NAME \
        --api-id $API_ID \
        --stage "$STAGE_NAME" \
        --api-mapping-key "" \
        --region $REGION > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}   ✅ API mapping created${NC}"
    else
        echo -e "${RED}   ❌ Failed to create API mapping${NC}"
    fi
fi

# Step 4: Fix Route53 DNS record
echo -e "\n${YELLOW}4. Checking Route53 DNS record...${NC}"
if [ -z "$TARGET_DOMAIN" ] || [ "$TARGET_DOMAIN" == "None" ]; then
    echo -e "${RED}   ❌ Cannot fix DNS - target domain is still None${NC}"
else
    # Find hosted zone
    ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?contains(Name, 'share.twilly.app')].Id" --output text 2>/dev/null | head -1 | sed 's|/hostedzone/||')
    
    if [ -n "$ZONE_ID" ]; then
        echo -e "   Found hosted zone: $ZONE_ID"
        
        # Check current record
        CURRENT_RECORD=$(aws route53 list-resource-record-sets \
            --hosted-zone-id $ZONE_ID \
            --query "ResourceRecordSets[?Name=='$DOMAIN_NAME.']" \
            --output json 2>/dev/null)
        
        RECORD_TYPE=$(echo "$CURRENT_RECORD" | jq -r '.[0].Type' 2>/dev/null)
        
        if [ "$RECORD_TYPE" == "A" ]; then
            ALIAS_TARGET=$(echo "$CURRENT_RECORD" | jq -r '.[0].AliasTarget.DNSName' 2>/dev/null)
            echo -e "   Current record type: A (Alias)"
            echo -e "   Current target: $ALIAS_TARGET"
            
            if [[ "$ALIAS_TARGET" != *"$TARGET_DOMAIN"* ]] && [[ "$ALIAS_TARGET" != *"execute-api"* ]]; then
                echo -e "${YELLOW}   ⚠️  DNS record points to wrong target, updating...${NC}"
                
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
                
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}   ✅ DNS record updated: $CHANGE_ID${NC}"
                else
                    echo -e "${RED}   ❌ Failed to update DNS record${NC}"
                fi
            else
                echo -e "${GREEN}   ✅ DNS record is correctly configured${NC}"
            fi
        else
            echo -e "${YELLOW}   ⚠️  Current record type: $RECORD_TYPE (should be A)${NC}"
            echo -e "${YELLOW}   Creating A record...${NC}"
            
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
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}   ✅ DNS A record created: $CHANGE_ID${NC}"
            else
                echo -e "${RED}   ❌ Failed to create DNS record${NC}"
                echo -e "${YELLOW}   Manual setup required:${NC}"
                echo -e "${BLUE}   Type: A (Alias)${NC}"
                echo -e "${BLUE}   Target: $TARGET_DOMAIN${NC}"
                echo -e "${BLUE}   Hosted Zone ID: Z2FDTNDATAQYW2${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}   ⚠️  Hosted zone not found for share.twilly.app${NC}"
    fi
fi

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Fix complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "   1. Wait for DNS propagation (5-60 minutes)"
echo -e "   2. Verify certificate is ISSUED status"
echo -e "   3. Test: curl -I https://$DOMAIN_NAME/test123"
echo ""
echo -e "${BLUE}To verify:${NC}"
echo -e "   ./verify-share-domain.sh"
echo ""

