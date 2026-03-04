#!/bin/bash
# Get EC2 backend changes live so you can test on mobile.
# Run from repo root or from TwillyTV/twilly.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TWILLY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Deploying EC2 backend for mobile testing..."
echo ""

# 1. Deploy streaming service (copies streaming-service-server.js and restarts)
if [ -f "$TWILLY_DIR/streaming-service-server.js" ]; then
    echo "📤 Step 1: Deploy streaming-service-server.js to EC2 and restart service..."
    bash "$TWILLY_DIR/deploy-ec2-server.sh" || {
        echo "⚠️  deploy-ec2-server.sh failed. Try: cd $TWILLY_DIR && ./deploy-ec2-server.sh"
        exit 1
    }
else
    echo "⚠️  streaming-service-server.js not found at $TWILLY_DIR/streaming-service-server.js"
    echo "   Skipping EC2 deploy. To only restart services: ./scripts/restart-ec2-services.sh"
fi

echo ""
echo "✅ Backend deploy done. You can test on mobile now (RTMP / content at 100.24.103.57)."
echo "   Restart services only (no code push): ./TwillyTV/twilly/scripts/restart-ec2-services.sh"
