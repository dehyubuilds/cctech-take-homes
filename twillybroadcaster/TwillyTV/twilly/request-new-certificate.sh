#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📜 Requesting new SSL certificate for share.twilly.app...${NC}\n"

REGION="us-east-1"
DOMAIN_NAME="share.twilly.app"

# Request new certificate
echo -e "${YELLOW}Requesting certificate...${NC}"
CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN_NAME \
    --validation-method DNS \
    --region $REGION \
    --query 'CertificateArn' \
    --output text 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$CERT_ARN" ]; then
    echo -e "${GREEN}✅ Certificate requested: $CERT_ARN${NC}\n"
    
    # Wait a moment for validation records to be available
    echo -e "${YELLOW}Waiting for validation records...${NC}"
    sleep 5
    
    # Get validation records
    VALIDATION=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region $REGION \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
        --output json 2>/dev/null)
    
    if [ -n "$VALIDATION" ] && [ "$VALIDATION" != "null" ]; then
        VAL_NAME=$(echo "$VALIDATION" | jq -r '.Name')
        VAL_TYPE=$(echo "$VALIDATION" | jq -r '.Type')
        VAL_VALUE=$(echo "$VALIDATION" | jq -r '.Value')
        
        echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}📋 DNS Validation Record Required:${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Add this CNAME record to Route53:${NC}\n"
        echo -e "${YELLOW}Name:${NC}  $VAL_NAME"
        echo -e "${YELLOW}Type:${NC}  $VAL_TYPE"
        echo -e "${YELLOW}Value:${NC} $VAL_VALUE\n"
        
        # Find hosted zone
        ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?contains(Name, 'share.twilly.app')].Id" --output text 2>/dev/null | head -1 | sed 's|/hostedzone/||')
        
        if [ -n "$ZONE_ID" ]; then
            echo -e "${BLUE}Found hosted zone: $ZONE_ID${NC}"
            echo -e "${YELLOW}Automatically adding DNS validation record...${NC}"
            
            # Automatically add the record
            if true; then
                CHANGE_BATCH=$(cat <<EOF
{
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": "$VAL_NAME",
            "Type": "$VAL_TYPE",
            "TTL": 300,
            "ResourceRecords": [{
                "Value": "$VAL_VALUE"
            }]
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
                    echo -e "${GREEN}✅ DNS validation record added: $CHANGE_ID${NC}"
                    echo -e "${YELLOW}⏳ Certificate validation may take a few minutes...${NC}\n"
                    
                    echo -e "${BLUE}To check validation status:${NC}"
                    echo -e "aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION --query 'Certificate.Status'\n"
                    
                    echo -e "${YELLOW}Once certificate is ISSUED, run:${NC}"
                    echo -e "${BLUE}./fix-custom-domain-issues.sh${NC}\n"
                else
                    echo -e "${RED}❌ Failed to add DNS record${NC}"
                    echo -e "${YELLOW}Please add the record manually in Route53${NC}\n"
                fi
            else
                echo -e "${YELLOW}Please add the DNS validation record manually in Route53${NC}\n"
            fi
        else
            echo -e "${YELLOW}⚠️  Hosted zone not found automatically${NC}"
            echo -e "${YELLOW}Please add the DNS validation record manually in Route53${NC}\n"
        fi
        
        echo -e "${BLUE}Certificate ARN to use later:${NC}"
        echo -e "$CERT_ARN\n"
    else
        echo -e "${YELLOW}⚠️  Validation records not yet available${NC}"
        echo -e "${YELLOW}Check AWS Console or run:${NC}"
        echo -e "aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION\n"
    fi
else
    echo -e "${RED}❌ Failed to request certificate${NC}"
    exit 1
fi

