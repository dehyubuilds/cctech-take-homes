#!/bin/bash
# IMMEDIATE FIX: Ensure HTTPS is working on EC2 NGINX
# Fixes port 443 not listening and ensures HTTPS works

EC2_IP="100.24.103.57"
EC2_USER="ec2-user"
SSH_KEY="${HOME}/.ssh/twilly-streaming-key-1750894315.pem"

echo "🔧 IMMEDIATE FIX: Ensuring HTTPS works on EC2..."

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'EOF'
set -e

echo "🔍 Checking current NGINX status..."
NGINX_PATH="/usr/local/nginx/sbin/nginx"
NGINX_CONF="/etc/nginx/nginx.conf"

# Check if HTTPS server exists in config
if ! grep -q "listen 443" "$NGINX_CONF"; then
    echo "❌ HTTPS server block not found! Re-running setup..."
    # Re-run the HTTPS setup
    sudo mkdir -p /etc/nginx/ssl
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/hls.key \
        -out /etc/nginx/ssl/hls.crt \
        -subj "/C=US/ST=State/L=City/O=Twilly/CN=100.24.103.57" 2>/dev/null || true
    
    sudo chmod 600 /etc/nginx/ssl/hls.key 2>/dev/null || true
    sudo chmod 644 /etc/nginx/ssl/hls.crt 2>/dev/null || true
fi

# Ensure port 443 is open in firewall
echo "🔥 Checking firewall..."
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
elif command -v iptables &> /dev/null; then
    sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
    sudo service iptables save 2>/dev/null || true
fi

# Test NGINX config
echo "🧪 Testing NGINX configuration..."
if sudo $NGINX_PATH -t; then
    echo "✅ NGINX config is valid"
    # Force reload NGINX
    echo "🔄 Reloading NGINX..."
    sudo $NGINX_PATH -s reload 2>/dev/null || sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null
    sleep 2
    
    # Check if port 443 is now listening
    if sudo netstat -tlnp | grep -q ":443"; then
        echo "✅ Port 443 is now listening!"
    else
        echo "⚠️  Port 443 still not listening - checking NGINX config..."
        sudo cat "$NGINX_CONF" | grep -A 10 "listen 443" || echo "❌ HTTPS server block missing!"
    fi
else
    echo "❌ NGINX config test failed!"
    sudo $NGINX_PATH -t
    exit 1
fi

# Test HTTPS locally
echo "🧪 Testing HTTPS locally..."
if curl -k -s https://localhost/health 2>&1 | grep -q "healthy"; then
    echo "✅ HTTPS is working locally!"
else
    echo "⚠️  HTTPS not responding locally yet"
fi

echo "✅ HTTPS fix complete!"
EOF

echo ""
echo "🧪 Testing HTTPS from local machine..."
sleep 2

# Test HTTPS endpoint
if curl -k -s --max-time 5 "https://$EC2_IP/health" 2>&1 | grep -q "healthy"; then
    echo "✅ HTTPS is accessible from outside!"
else
    echo "⚠️  HTTPS not accessible yet - checking security group..."
    echo "💡 Make sure AWS security group allows port 443 (HTTPS)"
fi
