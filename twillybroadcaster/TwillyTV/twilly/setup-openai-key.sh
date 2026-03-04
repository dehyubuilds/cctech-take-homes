#!/bin/bash
# Setup OpenAI API Key on EC2 Server
# Run this script on your EC2 instance

OPENAI_API_KEY="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"

echo "🔐 Setting up OpenAI API Key for twilly-streaming service..."

# Find the systemd service file
SERVICE_FILE="/etc/systemd/system/twilly-streaming.service"

if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Service file not found at $SERVICE_FILE"
    echo "   Please check the service file location"
    exit 1
fi

# Check if Environment line already exists
if grep -q "OPENAI_API_KEY" "$SERVICE_FILE"; then
    echo "⚠️  OPENAI_API_KEY already exists in service file"
    echo "   Updating existing key..."
    sudo sed -i "s|Environment=\"OPENAI_API_KEY=.*\"|Environment=\"OPENAI_API_KEY=$OPENAI_API_KEY\"|" "$SERVICE_FILE"
else
    echo "✅ Adding OPENAI_API_KEY to service file..."
    # Find the [Service] section and add the environment variable
    sudo sed -i '/\[Service\]/a Environment="OPENAI_API_KEY='"$OPENAI_API_KEY"'"' "$SERVICE_FILE"
fi

# Reload systemd and restart service
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "🔄 Restarting twilly-streaming service..."
sudo systemctl restart twilly-streaming

# Verify the service is running
sleep 2
if sudo systemctl is-active --quiet twilly-streaming; then
    echo "✅ Service is running successfully!"
    echo ""
    echo "📋 To verify the key is set, check service status:"
    echo "   sudo systemctl status twilly-streaming"
    echo ""
    echo "📋 To view logs:"
    echo "   sudo journalctl -u twilly-streaming -f"
else
    echo "❌ Service failed to start. Check logs:"
    echo "   sudo journalctl -u twilly-streaming -n 50"
    exit 1
fi

echo ""
echo "⚠️  SECURITY WARNING:"
echo "   This API key was exposed in chat. After testing, regenerate it at:"
echo "   https://platform.openai.com/api-keys"
echo "   Then update the service file with the new key."
