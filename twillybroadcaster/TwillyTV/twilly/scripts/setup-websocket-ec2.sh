#!/bin/bash

# Setup WebSocket EC2 Optimization
# This script configures the EC2 instance for WebSocket connection caching

set -e

# Configuration
WEBSOCKET_ENDPOINT="wss://kwt0i091yd.execute-api.us-east-1.amazonaws.com/dev"
INSTANCE_ID="i-0f4de776143f620d1"
INSTANCE_IP="100.24.103.57"
SSH_KEY="${HOME}/.ssh/twilly-streaming-key.pem"
SSH_USER="ec2-user"

echo "🚀 Setting up WebSocket EC2 Optimization"
echo "Instance: $INSTANCE_ID ($INSTANCE_IP)"
echo ""

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "⚠️  SSH key not found at $SSH_KEY"
    echo "   Please update SSH_KEY variable in this script"
    exit 1
fi

# Test SSH connection
echo "📡 Testing SSH connection..."
if ! ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$SSH_USER@$INSTANCE_IP" "echo 'SSH connection successful'" 2>/dev/null; then
    echo "❌ Cannot connect to EC2 instance via SSH"
    echo "   Please verify:"
    echo "   - Instance is running"
    echo "   - Security group allows SSH (port 22)"
    echo "   - SSH key path is correct: $SSH_KEY"
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

# Set environment variable
echo "🔧 Setting WEBSOCKET_API_ENDPOINT environment variable..."

# Add to .env file if it exists
ssh -i "$SSH_KEY" "$SSH_USER@$INSTANCE_IP" << EOF
    # Add to .env file (if exists in project root)
    if [ -f ~/twilly/.env ]; then
        if ! grep -q "WEBSOCKET_API_ENDPOINT" ~/twilly/.env; then
            echo "WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT" >> ~/twilly/.env
            echo "✅ Added to ~/twilly/.env"
        else
            sed -i "s|WEBSOCKET_API_ENDPOINT=.*|WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT|" ~/twilly/.env
            echo "✅ Updated ~/twilly/.env"
        fi
    fi
    
    # Add to .bashrc for current session
    if ! grep -q "WEBSOCKET_API_ENDPOINT" ~/.bashrc; then
        echo "export WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT" >> ~/.bashrc
        echo "✅ Added to ~/.bashrc"
    fi
    
    # Export for current session
    export WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT
    echo "✅ Environment variable set"
EOF

echo ""

# Restart Nuxt server
echo "🔄 Restarting Nuxt server..."
ssh -i "$SSH_KEY" "$SSH_USER@$INSTANCE_IP" << EOF
    # Try PM2 first
    if command -v pm2 &> /dev/null; then
        echo "   Using PM2..."
        pm2 restart twilly || pm2 restart all || echo "   ⚠️  PM2 restart failed, trying npm..."
    fi
    
    # Try npm if PM2 didn't work
    if [ \$? -ne 0 ] || [ -z "\$(command -v pm2)" ]; then
        if [ -f ~/twilly/package.json ]; then
            cd ~/twilly
            echo "   Using npm..."
            npm run build 2>&1 | tail -5
            npm run start &
            echo "   ✅ Server restarted"
        fi
    fi
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Verification:"
echo "   Check server logs for:"
echo "   ✅ [websocket-cache-init] WebSocket connection cache initialization scheduled"
echo "   ✅ [websocket-cache] Connection cache initialized"
echo ""
echo "   To check logs:"
echo "   ssh -i $SSH_KEY $SSH_USER@$INSTANCE_IP 'pm2 logs twilly --lines 50'"
echo ""


# Setup WebSocket EC2 Optimization
# Run this script on your EC2 instance

set -e

WEBSOCKET_ENDPOINT="wss://kwt0i091yd.execute-api.us-east-1.amazonaws.com/dev"

echo "🚀 Setting up WebSocket EC2 Optimization..."

# Step 1: Add environment variable to .env file
echo "📝 Adding WEBSOCKET_API_ENDPOINT to environment..."

# Find .env file
ENV_FILE=""
if [ -f ".env" ]; then
    ENV_FILE=".env"
elif [ -f "twilly/.env" ]; then
    ENV_FILE="twilly/.env"
elif [ -f "/home/ec2-user/twilly/.env" ]; then
    ENV_FILE="/home/ec2-user/twilly/.env"
fi

if [ -n "$ENV_FILE" ]; then
    # Remove existing WEBSOCKET_API_ENDPOINT if present
    sed -i '/^WEBSOCKET_API_ENDPOINT=/d' "$ENV_FILE"
    # Add new one
    echo "WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT" >> "$ENV_FILE"
    echo "✅ Added to $ENV_FILE"
else
    echo "⚠️  .env file not found, creating one..."
    echo "WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT" > .env
    echo "✅ Created .env file"
fi

# Step 2: Add to bashrc for persistence
echo "📝 Adding to ~/.bashrc for persistence..."
if ! grep -q "WEBSOCKET_API_ENDPOINT" ~/.bashrc; then
    echo "export WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT" >> ~/.bashrc
    echo "✅ Added to ~/.bashrc"
else
    echo "✅ Already in ~/.bashrc"
fi

# Step 3: Export for current session
export WEBSOCKET_API_ENDPOINT=$WEBSOCKET_ENDPOINT
echo "✅ Exported for current session"

# Step 4: Restart Nuxt server
echo "🔄 Restarting Nuxt server..."

if command -v pm2 &> /dev/null; then
    echo "   Using PM2..."
    pm2 restart twilly || pm2 restart all || echo "⚠️  PM2 restart failed, trying to start..."
    pm2 list
    echo "✅ PM2 restarted"
elif [ -f "package.json" ]; then
    echo "   Using npm..."
    npm run build && npm run start &
    echo "✅ Server started with npm"
else
    echo "⚠️  Could not find PM2 or package.json"
    echo "   Please manually restart your Nuxt server"
fi

echo ""
echo "✅ WebSocket EC2 Optimization setup complete!"
echo ""
echo "📊 Verification:"
echo "   Check server logs for:"
echo "   ✅ [websocket-cache-init] WebSocket connection cache initialization"
echo "   ✅ [websocket-cache] Connection cache initialized"
echo ""
echo "🔍 To verify, check logs:"
echo "   pm2 logs twilly"
echo "   OR"
echo "   tail -f /var/log/nuxt.log"
