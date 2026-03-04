#!/bin/bash

# Fix NGINX HLS Configuration on EC2 Server
# This script fixes NGINX configuration to properly generate and serve HLS streams

set -e

EC2_IP="100.24.103.57"
EC2_USER="ec2-user"
SSH_KEY="${HOME}/.ssh/twilly-streaming-key-1750894315.pem"

# Try to find SSH key if default doesn't exist
if [ ! -f "$SSH_KEY" ]; then
    echo "🔍 Looking for SSH key..."
    if [ -f "${HOME}/.ssh/id_rsa" ]; then
        SSH_KEY="${HOME}/.ssh/id_rsa"
    elif [ -f "${HOME}/.ssh/twilly.pem" ]; then
        SSH_KEY="${HOME}/.ssh/twilly.pem"
    else
        echo "❌ SSH key not found. Please set SSH_KEY variable or add key to ~/.ssh/"
        exit 1
    fi
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true

echo "🔧 Fixing NGINX HLS Configuration on EC2 Server..."
echo "📡 Connecting to: $EC2_USER@$EC2_IP"

# Create fix script to run on EC2
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'EOFSCRIPT'
set -e

echo "🔍 Checking NGINX installation..."
NGINX_PATH=$(which nginx 2>/dev/null || echo "/usr/local/nginx/sbin/nginx")
NGINX_CONF=$(if [ -f "/etc/nginx/nginx.conf" ]; then echo "/etc/nginx/nginx.conf"; elif [ -f "/usr/local/nginx/conf/nginx.conf" ]; then echo "/usr/local/nginx/conf/nginx.conf"; else echo ""; fi)

if [ -z "$NGINX_CONF" ]; then
    echo "❌ NGINX configuration not found!"
    exit 1
fi

echo "✅ Found NGINX config: $NGINX_CONF"

# Check if NGINX RTMP module is installed
echo "🔍 Checking NGINX RTMP module..."
if $NGINX_PATH -V 2>&1 | grep -q "rtmp"; then
    echo "✅ NGINX RTMP module is installed"
else
    echo "⚠️  NGINX RTMP module not found in binary"
    echo "   However, we'll try to fix the config anyway"
fi

# Create backup of current config
echo "📦 Creating backup of NGINX config..."
sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

# Determine NGINX config directory
NGINX_CONF_DIR=$(dirname "$NGINX_CONF")
NGINX_ROOT=$(if [ "$NGINX_CONF_DIR" == "/etc/nginx" ]; then echo "/etc/nginx"; elif [ "$NGINX_CONF_DIR" == "/usr/local/nginx/conf" ]; then echo "/usr/local/nginx"; else echo "/usr/local/nginx"; fi)

echo "📝 Creating fixed NGINX configuration..."

# Create fixed NGINX config
sudo tee "$NGINX_CONF" > /dev/null << 'NGINXCONF'
worker_processes auto;
rtmp_auto_push on;

events {
    worker_connections 1024;
}

http {
    include mime.types;
    default_type application/octet-stream;
    
    sendfile on;
    keepalive_timeout 65;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # HLS streaming server
    server {
        listen 80;
        server_name _;
        
        # CORS headers for web players
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods GET,POST,OPTIONS always;
        add_header Access-Control-Allow-Headers DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range always;
        
        # HLS stream location - CRITICAL: Use alias instead of root for proper path resolution
        location /hls {
            alias /var/www/hls;
            add_header Cache-Control no-cache always;
            add_header Access-Control-Allow-Origin * always;
            
            # HLS specific headers
            add_header Cache-Control "public, no-cache" always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range" always;
            add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
            
            # Handle HLS requests
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            
            # Allow directory listing for debugging (optional)
            autoindex on;
            autoindex_exact_size off;
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain always;
        }
        
        # Status page for RTMP monitoring
        location /status {
            rtmp_stat all;
            rtmp_stat_stylesheet /stat.xsl;
        }
        
        location /stat.xsl {
            root /usr/local/nginx/html;
        }
    }
}

rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        ping 30s;
        notify_method get;
        
        application live {
            live on;
            
            # CRITICAL: Enable HLS with proper settings
            hls on;
            hls_path /var/www/hls;
            hls_fragment 3s;
            hls_playlist_length 60s;
            hls_nested on;
            hls_continuous on;
            hls_cleanup on;
            hls_fragment_naming sequential;
            
            # HLS variants for different qualities (if needed)
            # Commented out for now - using single quality for simplicity
            # hls_variant _720p2628kbs resolution=1280x720 bandwidth=2628000;
            # hls_variant _480p1128kbs resolution=854x480 bandwidth=1128000;
            # hls_variant _360p878kbs resolution=640x360 bandwidth=878000;
            # hls_variant _240p528kbs resolution=426x240 bandwidth=528000;
            
            # Allow all to publish and play (for now)
            allow publish all;
            allow play all;
            
            # On publish hook for stream management
            on_publish http://localhost:3000/api/streams/start;
            on_publish_done http://localhost:3000/api/streams/stop;
            
            # Enable recording for clips (creates .flv files)
            record all;
            record_path /var/www/recordings;
            record_suffix .flv;
            record_unique on;
            record_append off;
        }
    }
}
NGINXCONF

echo "✅ NGINX configuration updated"

# Create necessary directories
echo "📁 Creating necessary directories..."
sudo mkdir -p /var/www/hls
sudo mkdir -p /var/www/recordings
sudo mkdir -p /var/log/nginx

# Set proper permissions
echo "🔐 Setting permissions..."
sudo chown -R nginx:nginx /var/www 2>/dev/null || sudo chown -R www-data:www-data /var/www 2>/dev/null || true
sudo chmod -R 755 /var/www

# Test NGINX configuration
echo "🧪 Testing NGINX configuration..."
if sudo $NGINX_PATH -t; then
    echo "✅ NGINX configuration is valid"
else
    echo "❌ NGINX configuration test failed!"
    echo "   Restoring backup..."
    sudo cp "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONF" 2>/dev/null || true
    exit 1
fi

# Reload NGINX
echo "🔄 Reloading NGINX..."
if systemctl is-active --quiet nginx; then
    sudo systemctl reload nginx 2>/dev/null || sudo $NGINX_PATH -s reload || sudo systemctl restart nginx
else
    sudo systemctl start nginx 2>/dev/null || sudo $NGINX_PATH || echo "⚠️  Could not start NGINX - check manually"
fi

echo "✅ NGINX reloaded"

# Check if NGINX is running
sleep 2
if systemctl is-active --quiet nginx || pgrep -x nginx > /dev/null; then
    echo "✅ NGINX is running"
else
    echo "⚠️  NGINX might not be running - check status manually"
fi

# Test health endpoint
echo "🧪 Testing health endpoint..."
sleep 1
if curl -s http://localhost/health | grep -q "healthy"; then
    echo "✅ Health endpoint is working"
else
    echo "⚠️  Health endpoint test failed"
fi

# List HLS directory to see current state
echo "📂 Checking HLS directory..."
sudo ls -la /var/www/hls/ 2>/dev/null | head -10 || echo "   Directory is empty or doesn't exist"

echo ""
echo "✅ NGINX HLS configuration fix complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start streaming from your iOS app"
echo "   2. Wait 10-15 seconds for HLS segments to generate"
echo "   3. Check: http://$EC2_IP/hls/YOUR_STREAM_KEY/playlist.m3u8"
echo "   4. Monitor logs: sudo tail -f /var/log/nginx/error.log"

EOFSCRIPT

echo ""
echo "✅ Fix script executed on EC2 server"
echo ""
echo "🧪 Testing from local machine..."
sleep 2

# Test health endpoint
if curl -s --max-time 5 "http://$EC2_IP/health" | grep -q "healthy"; then
    echo "✅ Health endpoint is working!"
else
    echo "⚠️  Health endpoint not responding yet (might need a moment)"
fi

# Test HLS directory listing
echo "📂 Testing HLS directory access..."
curl -s --max-time 5 "http://$EC2_IP/hls/" 2>&1 | head -5 || echo "   Directory listing might not be enabled (this is OK)"

echo ""
echo "🎉 NGINX HLS fix complete!"
echo ""
echo "💡 To test live streaming:"
echo "   1. Start streaming from iOS app (stream key: sk_ewiph5kq7mbcr4rb)"
echo "   2. Wait 15-20 seconds"
echo "   3. Try: http://$EC2_IP/hls/sk_ewiph5kq7mbcr4rb/playlist.m3u8"
echo "   4. Or use the test page: https://twilly.app/stream-test"
