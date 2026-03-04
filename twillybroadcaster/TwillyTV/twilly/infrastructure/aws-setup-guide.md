# Twilly AWS Streaming Infrastructure Setup Guide

## Overview
This guide sets up a cost-effective AWS infrastructure for RTMP to HLS streaming, allowing you to stream from your iPhone using Larix Broadcaster and watch on your iPad via HLS.

## Architecture
```
iPhone (Larix) → RTMP → EC2 (NGINX-RTMP) → HLS → iPad/Browser
                ↓
            S3 (Clips) → CloudFront → Global Delivery
```

## Step 1: EC2 Instance Setup

### 1.1 Launch EC2 Instance
- **AMI**: Amazon Linux 2 (free tier eligible)
- **Instance Type**: 
  - **Development**: t3.medium (2 vCPU, 4GB RAM) - ~$30/month
  - **Production**: t3.large (2 vCPU, 8GB RAM) - ~$60/month
  - **High Performance**: c5.large (2 vCPU, 4GB RAM) - ~$70/month
- **Storage**: 20GB GP3 SSD (sufficient for streaming)
- **Security Group**: Create new (see Step 1.2)

### 1.2 Security Group Configuration
Create a security group with these rules:

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| HTTP | TCP | 80 | 0.0.0.0/0 | Web access |
| HTTPS | TCP | 443 | 0.0.0.0/0 | Secure web access |
| RTMP | TCP | 1935 | 0.0.0.0/0 | RTMP streaming |
| SSH | TCP | 22 | Your IP | SSH access |
| Custom | TCP | 3000 | 0.0.0.0/0 | Streaming API |

### 1.3 Instance Setup
```bash
# Connect to your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Download and run the setup script
wget https://raw.githubusercontent.com/your-repo/twilly/main/infrastructure/ec2-setup.sh
chmod +x ec2-setup.sh
sudo ./ec2-setup.sh
```

## Step 2: S3 Bucket Setup

### 2.1 Create S3 Bucket
```bash
# Using AWS CLI
aws s3 mb s3://twilly-clips-$(date +%s)
aws s3api put-bucket-cors --bucket twilly-clips-$(date +%s) --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'
```

### 2.2 S3 Lifecycle Policy (Cost Optimization)
```json
{
  "Rules": [
    {
      "ID": "DeleteOldClips",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "clips/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

## Step 3: CloudFront Distribution

### 3.1 Create CloudFront Distribution
- **Origin Domain**: Your S3 bucket
- **Origin Path**: /clips
- **Viewer Protocol Policy**: Redirect HTTP to HTTPS
- **Cache Policy**: CachingOptimized
- **Price Class**: Use Only North America and Europe (cheaper)

### 3.2 CloudFront Settings
```bash
# Create CloudFront distribution via AWS CLI
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "'$(date +%s)'",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-twilly-clips",
        "DomainName": "twilly-clips-xxx.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-twilly-clips",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0
  },
  "Enabled": true
}'
```

## Step 4: Domain and SSL Setup

### 4.1 Route 53 Setup (Optional)
```bash
# Create hosted zone
aws route53 create-hosted-zone --name yourdomain.com --caller-reference $(date +%s)

# Add A record pointing to your EC2 instance
aws route53 change-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --change-batch '{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "stream.yourdomain.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "YOUR_EC2_IP"
          }
        ]
      }
    }
  ]
}'
```

### 4.2 SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d stream.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Step 5: Environment Configuration

### 5.1 Set Environment Variables
```bash
# Create environment file
sudo tee /opt/twilly-streaming/.env > /dev/null <<EOF
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=twilly-clips-xxx
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
DOMAIN=stream.yourdomain.com
EOF

# Restart streaming service
sudo systemctl restart twilly-streaming
```

### 5.2 Update NGINX for SSL
```bash
# Update NGINX config for SSL
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
    
    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$server_name$request_uri;
    }
    
    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name _;
        
        ssl_certificate /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem;
        
        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods GET,POST,OPTIONS;
        add_header Access-Control-Allow-Headers DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range;
        
        # HLS streaming
        location /hls {
            root /var/www;
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
            
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
        
        # Status page
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
            
            # HLS variants
            hls_variant _720p2628kbs resolution=1280x720 bandwidth=2628000;
            hls_variant _480p1128kbs resolution=854x480 bandwidth=1128000;
            hls_variant _360p878kbs resolution=640x360 bandwidth=878000;
            hls_variant _240p528kbs resolution=426x240 bandwidth=528000;
            
            # Stream management
            allow publish all;
            allow play all;
            
            on_publish http://localhost:3000/api/streams/start;
            on_publish_done http://localhost:3000/api/streams/stop;
            
            # Recording
            record_path /var/www/recordings;
            record_suffix .flv;
            record_unique on;
            record all;
        }
    }
}
EOF

# Reload NGINX
sudo systemctl reload nginx
```

## Step 6: Testing and Monitoring

### 6.1 Test RTMP Stream
```bash
# Test with FFmpeg
ffmpeg -re -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=10 -c:v libx264 -c:a aac -f flv rtmp://your-ec2-ip/live/test

# Check HLS playlist
curl http://your-ec2-ip/hls/test/playlist.m3u8
```

### 6.2 Monitor System
```bash
# Check services
sudo systemctl status nginx
sudo systemctl status twilly-streaming

# Monitor resources
htop
nload
df -h

# Check logs
sudo tail -f /var/log/nginx/access.log
sudo journalctl -u twilly-streaming -f
```

### 6.3 Larix Broadcaster Settings
- **Server**: `rtmp://your-ec2-ip/live`
- **Stream Key**: `your-stream-key`
- **Video**: 720p, 30fps, 2500kbps
- **Audio**: AAC, 128kbps

### 6.4 iPad HLS Player
Use any HLS-compatible player with URL:
```
https://your-ec2-ip/hls/your-stream-key/playlist.m3u8
```

## Cost Optimization

### Monthly Cost Breakdown
- **EC2 t3.medium**: ~$30/month
- **S3 Storage**: ~$5/month (100GB)
- **CloudFront**: ~$10/month (1TB transfer)
- **Route 53**: ~$1/month (if using custom domain)
- **Total**: ~$46/month

### Cost Reduction Tips
1. **Use Spot Instances** for non-critical workloads
2. **S3 Lifecycle Policies** to delete old clips
3. **CloudFront Price Class** optimization
4. **Reserved Instances** for 1-3 year commitments
5. **Monitor usage** with AWS Cost Explorer

### Scaling Considerations
- **Auto Scaling Group** for multiple instances
- **Load Balancer** for high availability
- **Multi-region** for global distribution
- **CDN** for better performance

## Security Best Practices

1. **IAM Roles** instead of access keys
2. **Security Groups** with minimal access
3. **SSL/TLS** encryption
4. **Regular updates** and patches
5. **Backup strategy** for configurations

## Troubleshooting

### Common Issues
1. **RTMP connection failed**: Check security group port 1935
2. **HLS not playing**: Verify NGINX configuration
3. **High latency**: Optimize HLS fragment settings
4. **Storage full**: Implement cleanup scripts

### Useful Commands
```bash
# Check NGINX configuration
sudo /usr/local/nginx/sbin/nginx -t

# Restart services
sudo systemctl restart nginx
sudo systemctl restart twilly-streaming

# Check disk space
df -h /var/www

# Monitor network
nload -t 1000

# View active streams
curl http://localhost:3000/api/streams/status
```

## Next Steps

1. **Set up monitoring** with CloudWatch
2. **Implement backup** strategy
3. **Add authentication** for stream access
4. **Optimize video quality** settings
5. **Set up alerts** for system health

This infrastructure provides a solid foundation for your streaming platform while keeping costs manageable for a startup. 