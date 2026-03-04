#!/bin/bash
# Monitor stream processing in real-time

echo "Monitoring stream processing (Ctrl+C to stop)..."
echo ""

ssh -i ~/.ssh/twilly-streaming-key-1750894315.pem -o StrictHostKeyChecking=no ec2-user@54.160.229.57 "sudo journalctl -u twilly-streaming -f --no-pager | grep --line-buffered -E 'Stream.*started|Stream.*stopped|Processing stream|FFmpeg.*completed|✅.*FFmpeg|Uploading|✅.*Uploaded|All files uploaded|❌.*Failed|FFmpeg.*failed'"
