#!/bin/bash
# Script to set up Elastic IP for EC2 instance
# Run this from your local machine with AWS CLI configured

INSTANCE_ID="$1"
REGION="us-east-1"

if [ -z "$INSTANCE_ID" ]; then
  echo "Usage: $0 <instance-id>"
  echo "Example: $0 i-0123456789abcdef0"
  exit 1
fi

echo "Allocating Elastic IP..."
ALLOCATION_ID=$(aws ec2 allocate-address --domain vpc --region $REGION --query 'AllocationId' --output text)

if [ $? -ne 0 ]; then
  echo "Error: Failed to allocate Elastic IP"
  exit 1
fi

echo "Elastic IP allocated: $ALLOCATION_ID"

echo "Associating Elastic IP with instance $INSTANCE_ID..."
aws ec2 associate-address --instance-id "$INSTANCE_ID" --allocation-id "$ALLOCATION_ID" --region $REGION

if [ $? -eq 0 ]; then
  PUBLIC_IP=$(aws ec2 describe-addresses --allocation-ids "$ALLOCATION_ID" --region $REGION --query 'Addresses[0].PublicIp' --output text)
  echo "✅ Success! Elastic IP $PUBLIC_IP is now associated with instance $INSTANCE_ID"
  echo "⚠️  Note: You'll need to update RTMP_SERVER_URL in managefiles.vue if the IP changed"
else
  echo "Error: Failed to associate Elastic IP"
  echo "You can manually associate it later:"
  echo "aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOCATION_ID --region $REGION"
fi
