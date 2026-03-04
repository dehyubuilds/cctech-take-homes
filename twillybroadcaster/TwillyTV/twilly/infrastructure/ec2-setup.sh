#!/bin/bash

# Twilly Streaming Infrastructure Setup Script
# This script sets up an EC2 instance for RTMP to HLS streaming

set -e

echo "🚀 Setting up Twilly Streaming Infrastructure..."

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install required packages
echo "📦 Installing required packages..."
sudo yum install -y \
    nginx \
    ffmpeg \
    git \
    wget \
    unzip \
    python3 \
    python3-pip \
    htop \
    nload \
    iotop

# Install NGINX-RTMP module
echo "📦 Installing NGINX-RTMP module..."
cd /tmp
wget https://github.com/arut/nginx-rtmp-module/archive/master.zip
unzip master.zip
wget http://nginx.org/download/nginx-1.24.0.tar.gz
tar -zxvf nginx-1.24.0.tar.gz

cd nginx-1.24.0
./configure --with-http_ssl_module --add-module=../nginx-rtmp-module-master
make
sudo make install

# Create NGINX configuration
echo "⚙️ Creating NGINX configuration..."
sudo tee /usr/local/nginx/conf/nginx.conf > /dev/null <<'EOF'
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
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods GET,POST,OPTIONS;
        add_header Access-Control-Allow-Headers DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range;
        
        # HLS stream location
        location /hls {
            root /var/www;
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
            
            # HLS specific headers
            add_header Cache-Control "public, no-cache";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range";
            add_header Access-Control-Expose-Headers "Content-Length,Content-Range";
            
            # Handle HLS requests
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
        
        # Status page (optional)
        location /status {
            rtmp_stat all;
            rtmp_stat_stylesheet stat.xsl;
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
        
        application live {
            live on;
            record off;
            
            # HLS
            hls on;
            hls_path /var/www/hls;
            hls_fragment 3;
            hls_playlist_length 60;
            hls_nested on;
            
            # HLS variants for different qualities
            hls_variant _720p2628kbs resolution=1280x720 bandwidth=2628000;
            hls_variant _480p1128kbs resolution=854x480 bandwidth=1128000;
            hls_variant _360p878kbs resolution=640x360 bandwidth=878000;
            hls_variant _240p528kbs resolution=426x240 bandwidth=528000;
            
            # Only allow publishing from trusted sources
            allow publish all;
            deny publish all;
            
            # Allow all clients to play
            allow play all;
            
            # On publish hook for stream management
            on_publish http://localhost:3000/api/streams/start;
            on_publish_done http://localhost:3000/api/streams/stop;
            
            # Enable recording for clips
            record_path /var/www/recordings;
            record_suffix .flv;
            record_unique on;
            
            # Auto-record all streams
            record all;
        }
        
        # NEW: Landscape streams application (separate path to keep isolated from portrait)
        application live-landscape {
            live on;
            record off;
            
            # HLS
            hls on;
            hls_path /var/www/hls-landscape;
            hls_fragment 3;
            hls_playlist_length 60;
            hls_nested on;
            
            # HLS variants for different qualities (same as portrait)
            hls_variant _720p2628kbs resolution=1280x720 bandwidth=2628000;
            hls_variant _480p1128kbs resolution=854x480 bandwidth=1128000;
            hls_variant _360p878kbs resolution=640x360 bandwidth=878000;
            hls_variant _240p528kbs resolution=426x240 bandwidth=528000;
            
            # Only allow publishing from trusted sources
            allow publish all;
            deny publish all;
            
            # Allow all clients to play
            allow play all;
            
            # On publish hook for stream management (same endpoints - EC2 server handles both)
            on_publish http://localhost:3000/api/streams/start;
            on_publish_done http://localhost:3000/api/streams/stop;
            
            # Enable recording for clips (separate directory to keep isolated)
            record_path /var/www/recordings-landscape;
            record_suffix .flv;
            record_unique on;
            
            # Auto-record all streams
            record all;
        }
    }
}
EOF

# Create directories
echo "📁 Creating necessary directories..."
sudo mkdir -p /var/www/hls
sudo mkdir -p /var/www/recordings
sudo mkdir -p /var/www/hls-landscape
sudo mkdir -p /var/www/recordings-landscape
sudo mkdir -p /var/log/nginx
sudo chown -R nginx:nginx /var/www
sudo chmod -R 755 /var/www

# Create systemd service for NGINX
echo "🔧 Creating NGINX systemd service..."
sudo tee /etc/systemd/system/nginx.service > /dev/null <<'EOF'
[Unit]
Description=The nginx HTTP and reverse proxy server
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
PIDFile=/usr/local/nginx/logs/nginx.pid
ExecStartPre=/usr/local/nginx/sbin/nginx -t
ExecStart=/usr/local/nginx/sbin/nginx
ExecReload=/bin/kill -s HUP $MAINPID
KillSignal=SIGQUIT
TimeoutStopSec=5
KillMode=process
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Start and enable NGINX
echo "🚀 Starting NGINX service..."
sudo systemctl daemon-reload
sudo systemctl enable nginx
sudo systemctl start nginx

# Configure firewall
echo "🔥 Configuring firewall..."
sudo yum install -y firewalld
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Open required ports
sudo firewall-cmd --permanent --add-port=80/tcp    # HTTP
sudo firewall-cmd --permanent --add-port=1935/tcp  # RTMP
sudo firewall-cmd --permanent --add-port=443/tcp   # HTTPS (if needed)
sudo firewall-cmd --reload

# Install Node.js for the streaming management API
echo "📦 Installing Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Create streaming management service
echo "🔧 Creating streaming management service..."
sudo mkdir -p /opt/twilly-streaming
cd /opt/twilly-streaming

# Create package.json
sudo tee package.json > /dev/null <<'EOF'
{
  "name": "twilly-streaming",
  "version": "1.0.0",
  "description": "Twilly Streaming Management Service",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "aws-sdk": "^2.1450.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF

# Install dependencies
sudo npm install

# Create streaming management server
sudo tee server.js > /dev/null <<'EOF'
const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();

// Stream management
let activeStreams = new Map();

// Routes
app.post('/api/streams/start', (req, res) => {
  const { name, addr } = req.body;
  console.log(`Stream started: ${name} from ${addr}`);
  
  activeStreams.set(name, {
    name,
    addr,
    startTime: new Date(),
    status: 'live'
  });
  
  res.status(200).json({ success: true, message: 'Stream started' });
});

app.post('/api/streams/stop', (req, res) => {
  const { name } = req.body;
  console.log(`Stream stopped: ${name}`);
  
  const stream = activeStreams.get(name);
  if (stream) {
    stream.status = 'ended';
    stream.endTime = new Date();
    
    // Process recording for clips
    processRecording(name);
  }
  
  res.status(200).json({ success: true, message: 'Stream stopped' });
});

app.get('/api/streams/status', (req, res) => {
  const streams = Array.from(activeStreams.values());
  res.json({ streams });
});

app.get('/api/streams/:name/playlist', (req, res) => {
  const { name } = req.params;
  const playlistPath = `/var/www/hls/${name}/playlist.m3u8`;
  
  if (fs.existsSync(playlistPath)) {
    res.sendFile(playlistPath);
  } else {
    res.status(404).json({ error: 'Stream not found' });
  }
});

// Process recording for clip generation
async function processRecording(streamName) {
  const recordingPath = `/var/www/recordings/${streamName}.flv`;
  
  if (fs.existsSync(recordingPath)) {
    try {
      // Generate HLS clips using FFmpeg
      const outputDir = `/var/www/clips/${streamName}`;
      fs.mkdirSync(outputDir, { recursive: true });
      
      // Create HLS master playlist and segments (30-second clips)
      const clipCommand = `ffmpeg -i ${recordingPath} -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -f hls -hls_time 30 -hls_list_size 0 -hls_segment_filename "${outputDir}/segment_%03d.ts" "${outputDir}/playlist.m3u8"`;
      
      // Execute FFmpeg command
      const { exec } = require('child_process');
      exec(clipCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`FFmpeg error: ${error}`);
          return;
        }
        
        console.log(`HLS clips generated for stream: ${streamName}`);
        
        // Upload HLS clips to S3
        uploadHLSClipsToS3(streamName, outputDir);
      });
    } catch (error) {
      console.error(`Error processing recording: ${error}`);
    }
  }
}

// Upload HLS clips to S3
async function uploadHLSClipsToS3(streamName, clipsDir) {
  try {
    const files = fs.readdirSync(clipsDir);
    
    // Extract user ID from stream name (assuming format: userId_streamId)
    const userId = streamName.split('_')[0] || 'streamer';
    
    for (const file of files) {
      if (file.endsWith('.m3u8') || file.endsWith('.ts')) {
        const filePath = path.join(clipsDir, file);
        const fileContent = fs.readFileSync(filePath);
        
        // Create the key structure that matches your existing Lambda processing
        // Format: userId/folderPath/fileName
        const fileName = `${streamName}_${file}`;
        const s3Key = `${userId}/mixed/${fileName}`;
        
        const uploadParams = {
          Bucket: 'theprivatecollection', // Use your existing bucket
          Key: s3Key,
          Body: fileContent,
          ContentType: file.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T',
          ACL: 'public-read'
        };
        
        await s3.upload(uploadParams).promise();
        console.log(`Uploaded HLS file: ${s3Key}`);
      }
    }
  } catch (error) {
    console.error(`Error uploading HLS clips: ${error}`);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Twilly Streaming Service running on port ${PORT}`);
});
EOF

# Create systemd service for streaming management
sudo tee /etc/systemd/system/twilly-streaming.service > /dev/null <<'EOF'
[Unit]
Description=Twilly Streaming Management Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/twilly-streaming
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=AWS_REGION=us-east-1

[Install]
WantedBy=multi-user.target
EOF

# Start streaming service
echo "🚀 Starting Twilly Streaming Service..."
sudo systemctl daemon-reload
sudo systemctl enable twilly-streaming
sudo systemctl start twilly-streaming

# Create monitoring script
echo "📊 Creating monitoring script..."
sudo tee /opt/twilly-streaming/monitor.sh > /dev/null <<'EOF'
#!/bin/bash

# Twilly Streaming Monitor Script

echo "=== Twilly Streaming Status ==="
echo "Time: $(date)"
echo ""

# NGINX Status
echo "NGINX Status:"
systemctl is-active nginx
echo ""

# Streaming Service Status
echo "Streaming Service Status:"
systemctl is-active twilly-streaming
echo ""

# Active Streams
echo "Active Streams:"
curl -s http://localhost:3000/api/streams/status | jq '.streams[] | select(.status == "live") | .name' 2>/dev/null || echo "No active streams"
echo ""

# Disk Usage
echo "Disk Usage:"
df -h /var/www
echo ""

# Memory Usage
echo "Memory Usage:"
free -h
echo ""

# Network Usage
echo "Network Usage:"
nload -t 1000 -u bytes -U bytes 2>/dev/null || echo "nload not available"
EOF

sudo chmod +x /opt/twilly-streaming/monitor.sh

# Create log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/twilly-streaming > /dev/null <<'EOF'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        /usr/local/nginx/sbin/nginx -s reload
    endscript
}

/opt/twilly-streaming/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF

echo "✅ Twilly Streaming Infrastructure setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your EC2 security group to allow ports 80, 1935, and 443"
echo "2. Set up your domain DNS to point to this EC2 instance"
echo "3. Configure SSL certificates for HTTPS"
echo "4. Set up S3 bucket for clip storage"
echo "5. Configure CloudFront for content delivery"
echo ""
echo "🔗 RTMP URL: rtmp://YOUR_EC2_IP/live"
echo "🔗 HLS URL: http://YOUR_EC2_IP/hls/STREAM_NAME/playlist.m3u8"
echo "🔗 Status Page: http://YOUR_EC2_IP/status"
echo ""
echo "📱 Larix Broadcaster Settings:"
echo "- Server: rtmp://YOUR_EC2_IP/live"
echo "- Stream Key: your-stream-key"
echo ""
echo "📺 iPad HLS Player URL:"
echo "http://YOUR_EC2_IP/hls/your-stream-key/playlist.m3u8" 