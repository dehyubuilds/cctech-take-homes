#!/bin/bash
# Setup HTTPS directly on EC2 for HLS streaming
# This allows HLS to be served directly over HTTPS, eliminating the proxy issue

EC2_IP="100.24.103.57"
EC2_USER="ec2-user"

# Find SSH key
SSH_KEY=""
if [ -f "${HOME}/.ssh/twilly-streaming-key-1750894315.pem" ]; then
    SSH_KEY="${HOME}/.ssh/twilly-streaming-key-1750894315.pem"
elif [ -f "${HOME}/.ssh/twilly.pem" ]; then
    SSH_KEY="${HOME}/.ssh/twilly.pem"
elif [ -f "${HOME}/.ssh/id_rsa" ]; then
    SSH_KEY="${HOME}/.ssh/id_rsa"
else
    echo "❌ SSH key not found. Please specify SSH_KEY environment variable."
    exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true

echo "🔐 Setting up HTTPS on EC2 NGINX for HLS streaming..."
echo "📡 Using SSH key: $SSH_KEY"
echo "📡 Connecting to: $EC2_USER@$EC2_IP"

# Execute setup on EC2
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" << 'EOF'
set -e

echo "🔍 Checking NGINX installation..."
NGINX_PATH=$(which nginx 2>/dev/null || echo "/usr/local/nginx/sbin/nginx")
NGINX_CONF=$(if [ -f "/etc/nginx/nginx.conf" ]; then echo "/etc/nginx/nginx.conf"; elif [ -f "/usr/local/nginx/conf/nginx.conf" ]; then echo "/usr/local/nginx/conf/nginx.conf"; else echo ""; fi)

if [ -z "$NGINX_CONF" ]; then
    echo "❌ NGINX configuration not found!"
    exit 1
fi

echo "✅ Found NGINX config: $NGINX_CONF"

# Backup current config
echo "📦 Creating backup..."
sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

# Create SSL directory
echo "📁 Creating SSL directory..."
sudo mkdir -p /etc/nginx/ssl

# Generate self-signed certificate
echo "🔑 Generating self-signed certificate..."
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/hls.key \
    -out /etc/nginx/ssl/hls.crt \
    -subj "/C=US/ST=State/L=City/O=Twilly/CN=100.24.103.57" 2>/dev/null

# Set permissions
sudo chmod 600 /etc/nginx/ssl/hls.key
sudo chmod 644 /etc/nginx/ssl/hls.crt

echo "✅ Certificate generated"

# Read current config and add HTTPS server block
echo "📝 Adding HTTPS server block to NGINX..."

# Create new config with HTTPS server
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
    
    # HTTP server (redirect to HTTPS for HLS)
    server {
        listen 80;
        server_name _;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods GET,POST,OPTIONS always;
        
        # HLS location on HTTP (still available for compatibility)
        location /hls {
            alias /var/www/hls;
            add_header Cache-Control no-cache always;
            add_header Access-Control-Allow-Origin * always;
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            autoindex on;
        }
        
        # RTMP status on HTTP
        location /status {
            rtmp_stat all;
            rtmp_stat_stylesheet /stat.xsl;
        }
        
        location /stat.xsl {
            root /usr/local/nginx/html;
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain always;
        }
    }
    
    # HTTPS server for HLS (CRITICAL: Direct HTTPS access)
    server {
        listen 443 ssl http2;
        server_name 100.24.103.57;
        
        # SSL configuration
        ssl_certificate /etc/nginx/ssl/hls.crt;
        ssl_certificate_key /etc/nginx/ssl/hls.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods GET,HEAD,OPTIONS always;
        add_header Access-Control-Allow-Headers DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range always;
        add_header Access-Control-Expose-Headers Content-Length,Content-Range always;
        
        # HLS location - CRITICAL: Serve HLS directly over HTTPS
        location /hls {
            alias /var/www/hls;
            add_header Cache-Control no-cache always;
            add_header Access-Control-Allow-Origin * always;
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range" always;
            add_header Access-Control-Expose-Headers "Content-Length,Content-Range" always;
            
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            
            # Enable range requests for video segments
            add_header Accept-Ranges bytes always;
        }
        
        # RTMP status on HTTPS
        location /status {
            rtmp_stat all;
            rtmp_stat_stylesheet /stat.xsl;
        }
        
        location /stat.xsl {
            root /usr/local/nginx/html;
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain always;
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
            
            # Enable HLS
            hls on;
            hls_path /var/www/hls;
            hls_fragment 3s;
            hls_playlist_length 60s;
            hls_nested on;
            hls_continuous on;
            hls_cleanup on;
            hls_fragment_naming sequential;
            
            allow publish all;
            allow play all;
            
            on_publish http://localhost:3000/api/streams/start;
            on_publish_done http://localhost:3000/api/streams/stop;
            
            record all;
            record_path /var/www/recordings;
            record_suffix .flv;
            record_unique on;
        }
        
        # NEW: Landscape streams application (separate path to keep isolated from portrait)
        application live-landscape {
            live on;
            
            # Enable HLS
            hls on;
            hls_path /var/www/hls-landscape;
            hls_fragment 3s;
            hls_playlist_length 60s;
            hls_nested on;
            hls_continuous on;
            hls_cleanup on;
            hls_fragment_naming sequential;
            
            allow publish all;
            allow play all;
            
            on_publish http://localhost:3000/api/streams/start;
            on_publish_done http://localhost:3000/api/streams/stop;
            
            record all;
            record_path /var/www/recordings-landscape;
            record_suffix .flv;
            record_unique on;
        }
    }
}
NGINXCONF

echo "✅ NGINX configuration updated"

# Create directories
sudo mkdir -p /var/www/hls
sudo mkdir -p /var/www/recordings
sudo mkdir -p /var/www/hls-landscape
sudo mkdir -p /var/www/recordings-landscape
sudo chmod -R 755 /var/www

# Test NGINX configuration
echo "🧪 Testing NGINX configuration..."
if sudo $NGINX_PATH -t; then
    echo "✅ NGINX configuration is valid"
    
    # Reload NGINX
    echo "🔄 Reloading NGINX..."
    sudo $NGINX_PATH -s reload 2>/dev/null || sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || echo "⚠️  Please reload NGINX manually"
    
    echo "✅ NGINX reloaded with HTTPS configuration"
else
    echo "❌ NGINX configuration test failed!"
    exit 1
fi

# Test HTTPS endpoint
echo "🧪 Testing HTTPS endpoint..."
sleep 2
if curl -k -s https://localhost/health | grep -q "healthy"; then
    echo "✅ HTTPS endpoint is working"
else
    echo "⚠️  HTTPS endpoint test failed (might need moment to start)"
fi

echo ""
echo "✅ HTTPS setup complete!"
echo "📺 HLS is now available at: https://100.24.103.57/hls/{streamKey}/index.m3u8"
echo ""
echo "⚠️  Note: Self-signed certificate will show browser warning. Accept it to continue."
EOF

echo ""
echo "✅ HTTPS setup script executed on EC2"
echo ""
echo "🧪 Testing from local machine..."
sleep 3

# Test HTTPS endpoint (with -k to accept self-signed cert)
if curl -k -s --max-time 5 "https://$EC2_IP/health" | grep -q "healthy"; then
    echo "✅ HTTPS endpoint is accessible!"
else
    echo "⚠️  HTTPS endpoint not responding yet (may need a moment)"
fi

echo ""
echo "🎉 Setup complete! Now update the app to use HTTPS URLs directly."
