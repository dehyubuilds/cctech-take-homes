#!/bin/bash
# Quick script to check if streaming is working

echo "Checking recent stream processing status..."
ssh -i ~/.ssh/twilly-streaming-key-1750894315.pem -o StrictHostKeyChecking=no ec2-user@54.160.229.57 "sudo journalctl -u twilly-streaming --since '10 minutes ago' --no-pager | grep -E '✅.*completed|✅.*uploaded|❌.*Failed|FFmpeg.*failed|Processing stream' | tail -20"
