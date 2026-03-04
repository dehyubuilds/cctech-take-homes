#!/bin/bash
# Setup HTTPS on EC2 NGINX for HLS streaming
# This allows HLS to be served directly over HTTPS, eliminating the need for proxy

EC2_IP="100.24.103.57"
EC2_USER="ubuntu"
KEY_PATH="$HOME/.ssh/twilly-key.pem"

echo "🔐 Setting up HTTPS on EC2 NGINX for HLS streaming..."

# Check if certbot is installed
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << 'EOF'
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    fi
EOF

# For now, let's use a self-signed certificate (we can upgrade to Let's Encrypt later with a domain)
# Or use the EC2's public DNS name for Let's Encrypt

echo "🔑 Generating self-signed certificate for HLS..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << 'EOF'
    # Create cert directory if it doesn't exist
    sudo mkdir -p /etc/nginx/ssl
    
    # Generate self-signed certificate (valid for 1 year)
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/hls.key \
        -out /etc/nginx/ssl/hls.crt \
        -subj "/C=US/ST=State/L=City/O=Twilly/CN=100.24.103.57"
    
    # Set proper permissions
    sudo chmod 600 /etc/nginx/ssl/hls.key
    sudo chmod 644 /etc/nginx/ssl/hls.crt
EOF

echo "📝 Updating NGINX configuration for HTTPS..."
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_IP" << 'EOF'
    # Backup current config
    sudo cp /usr/local/nginx/conf/nginx.conf /usr/local/nginx/conf/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # Get current config
    NGINX_CONF="/usr/local/nginx/conf/nginx.conf"
    
    # Check if HTTPS server block already exists
    if ! grep -q "listen 443 ssl" "$NGINX_CONF"; then
        echo "➕ Adding HTTPS server block to NGINX config..."
        
        # Add HTTPS server block after HTTP server block
        sudo sed -i '/listen 80;/a\\n    # HTTPS server block for HLS\n    server {\n        listen 443 ssl http2;\n        server_name 100.24.103.57;\n        \n        ssl_certificate /etc/nginx/ssl/hls.crt;\n        ssl_certificate_key /etc/nginx/ssl/hls.key;\n        \n        ssl_protocols TLSv1.2 TLSv1.3;\n        ssl_ciphers HIGH:!aNULL:!MD5;\n        \n        # HLS location\n        location /hls/ {\n            alias /var/www/hls/;\n            types {\n                application/vnd.apple.mpegurl m3u8;\n                video/mp2t ts;\n            }\n            add_header Cache-Control no-cache;\n            add_header Access-Control-Allow-Origin *;\n            add_header Access-Control-Allow-Methods GET, HEAD, OPTIONS;\n        }\n        \n        # NGINX RTMP status\n        location /status {\n            rtmp_stat all;\n            rtmp_stat_stylesheet stat.xsl;\n        }\n        \n        location /stat.xsl {\n            root /usr/local/nginx/html;\n        }\n    }' "$NGINX_CONF"
    else
        echo "✅ HTTPS server block already exists"
    fi
    
    # Test NGINX configuration
    sudo /usr/local/nginx/sbin/nginx -t
    if [ $? -eq 0 ]; then
        echo "✅ NGINX configuration is valid"
        # Reload NGINX
        sudo /usr/local/nginx/sbin/nginx -s reload
        echo "✅ NGINX reloaded with HTTPS configuration"
    else
        echo "❌ NGINX configuration test failed!"
        exit 1
    fi
EOF

echo "✅ HTTPS setup complete!"
echo "📺 HLS is now available at: https://100.24.103.57/hls/{streamKey}/index.m3u8"
echo ""
echo "⚠️  Note: Self-signed certificate will show browser warning. For production, use Let's Encrypt with a domain name."
