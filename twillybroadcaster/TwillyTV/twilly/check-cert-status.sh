#!/bin/bash

# Quick certificate status checker
CERT_ARN="arn:aws:acm:us-east-1:142770202579:certificate/67b6c2c0-d173-4d0a-9294-6b07901629c0"
REGION="us-east-1"

STATUS=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region $REGION --query 'Certificate.Status' --output text 2>/dev/null)

echo "Certificate Status: $STATUS"

if [ "$STATUS" == "ISSUED" ]; then
    echo "✅ Certificate is ISSUED! You can now run: ./fix-custom-domain-issues.sh"
else
    echo "⏳ Still waiting for validation... (this can take 10-30 minutes)"
fi

