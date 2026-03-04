# Twilly Streaming Infrastructure

This directory contains the AWS infrastructure setup for Twilly's RTMP to HLS streaming platform.

## Quick Start

### Prerequisites
1. **AWS CLI** installed and configured
2. **SSH directory** exists (`~/.ssh/`)

### One-Command Deployment
```bash
# Run the automated deployment script
./infrastructure/deploy.sh
```

This script will:
- Create EC2 key pair and download SSH key automatically
- Create S3 bucket for clip storage
- Launch EC2 instance with streaming infrastructure
- Configure security groups and networking
- Install NGINX-RTMP, FFmpeg, and streaming management
- Set up CloudFront for global content delivery
- Configure SSL certificates (if domain provided)

## Manual Setup

If you prefer manual setup, follow the detailed guide:
```bash
# 1. Launch EC2 instance manually
# 2. Run the EC2 setup script
scp infrastructure/ec2-setup.sh ec2-user@your-ec2-ip:~/
ssh ec2-user@your-ec2-ip
chmod +x ec2-setup.sh
sudo ./ec2-setup.sh
```

## Architecture

```
iPhone (Larix) → RTMP → EC2 (NGINX-RTMP) → HLS → iPad/Browser
                ↓
            S3 (Clips) → CloudFront → Global Delivery
```

### Components
- **EC2 Instance**: t3.medium with NGINX-RTMP module
- **S3 Bucket**: Clip storage with lifecycle policies
- **CloudFront**: Global content delivery network
- **Route 53**: DNS management (optional)
- **Let's Encrypt**: Free SSL certificates

## Configuration

### Larix Broadcaster Settings
- **Server**: `rtmp://your-ec2-ip/live`
- **Stream Key**: `your-stream-key`
- **Video**: 720p, 30fps, 2500kbps
- **Audio**: AAC, 128kbps

### iPad HLS Player
Use any HLS-compatible player with URL:
```
http://your-ec2-ip/hls/your-stream-key/playlist.m3u8
```

### Web Player
```html
<video controls>
  <source src="http://your-ec2-ip/hls/your-stream-key/playlist.m3u8" type="application/x-mpegURL">
</video>
```

## Monitoring

### System Status
```bash
# SSH into your instance
ssh -i ~/.ssh/your-key.pem ec2-user@your-ec2-ip

# Run monitoring script
/opt/twilly-streaming/monitor.sh
```

### Service Status
```bash
# Check NGINX
sudo systemctl status nginx

# Check streaming service
sudo systemctl status twilly-streaming

# View logs
sudo journalctl -u twilly-streaming -f
sudo tail -f /var/log/nginx/access.log
```

### Active Streams
```bash
# Check active streams
curl http://localhost:3000/api/streams/status

# View NGINX status page
curl http://your-ec2-ip/status
```

## Cost Optimization

### Monthly Cost Breakdown
- **EC2 t3.medium**: ~$30/month
- **S3 Storage**: ~$5/month (100GB)
- **CloudFront**: ~$10/month (1TB transfer)
- **Route 53**: ~$1/month (if using domain)
- **Total**: ~$46/month

### Cost Reduction Tips
1. **Use Spot Instances** for non-critical workloads
2. **S3 Lifecycle Policies** to delete old clips
3. **CloudFront Price Class** optimization
4. **Reserved Instances** for 1-3 year commitments
5. **Monitor usage** with AWS Cost Explorer

## Security

### Security Group Rules
| Port | Protocol | Source | Description |
|------|----------|--------|-------------|
| 22 | TCP | Your IP | SSH access |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 1935 | TCP | 0.0.0.0/0 | RTMP |
| 3000 | TCP | 0.0.0.0/0 | API |

### Best Practices
1. **Use IAM roles** instead of access keys
2. **Restrict SSH access** to your IP
3. **Enable SSL/TLS** encryption
4. **Regular updates** and patches
5. **Monitor access logs**

## Troubleshooting

### Common Issues

#### RTMP Connection Failed
```bash
# Check security group
aws ec2 describe-security-groups --group-ids sg-xxx

# Check NGINX status
sudo systemctl status nginx
sudo /usr/local/nginx/sbin/nginx -t
```

#### HLS Not Playing
```bash
# Check HLS files exist
ls -la /var/www/hls/your-stream-key/

# Check NGINX configuration
sudo cat /usr/local/nginx/conf/nginx.conf | grep hls
```

#### High Latency
```bash
# Optimize HLS settings in NGINX config
hls_fragment 2;  # Reduce from 3 to 2
hls_playlist_length 30;  # Reduce from 60 to 30
```

#### Storage Full
```bash
# Check disk usage
df -h /var/www

# Clean up old recordings
sudo find /var/www/recordings -name "*.flv" -mtime +7 -delete
sudo find /var/www/hls -name "*.ts" -mtime +1 -delete
```

### Useful Commands

#### Restart Services
```bash
sudo systemctl restart nginx
sudo systemctl restart twilly-streaming
```

#### Check Logs
```bash
# NGINX logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Streaming service logs
sudo journalctl -u twilly-streaming -f
```

#### Monitor Resources
```bash
# System resources
htop
nload
df -h
free -h

# Network connections
netstat -tulpn | grep :1935
netstat -tulpn | grep :80
```

## Scaling

### Horizontal Scaling
1. **Load Balancer**: Distribute traffic across multiple instances
2. **Auto Scaling Group**: Automatically scale based on demand
3. **Multi-region**: Deploy in multiple AWS regions

### Vertical Scaling
1. **Larger Instance**: Upgrade to t3.large or c5.large
2. **More Storage**: Increase EBS volume size
3. **Better Networking**: Use enhanced networking

## Backup and Recovery

### Configuration Backup
```bash
# Backup NGINX config
sudo cp /usr/local/nginx/conf/nginx.conf /opt/twilly-streaming/backup/

# Backup streaming service
sudo cp /opt/twilly-streaming/server.js /opt/twilly-streaming/backup/
```

### Data Backup
```bash
# Backup recordings to S3
aws s3 sync /var/www/recordings s3://your-bucket/backups/recordings/

# Backup clips to S3
aws s3 sync /var/www/clips s3://your-bucket/backups/clips/
```

## Development

### Local Testing
```bash
# Test RTMP with FFmpeg
ffmpeg -re -f lavfi -i testsrc=duration=10:size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000:duration=10 \
  -c:v libx264 -c:a aac -f flv rtmp://your-ec2-ip/live/test

# Test HLS playback
curl http://your-ec2-ip/hls/test/playlist.m3u8
```

### API Endpoints
```bash
# Stream status
GET http://your-ec2-ip:3000/api/streams/status

# Start stream hook
POST http://your-ec2-ip:3000/api/streams/start
Body: {"name": "stream-name", "addr": "client-ip"}

# Stop stream hook
POST http://your-ec2-ip:3000/api/streams/stop
Body: {"name": "stream-name"}

# Health check
GET http://your-ec2-ip:3000/health
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Check system resource usage
4. Verify network connectivity
5. Review NGINX and application logs

## License

This infrastructure setup is part of the Twilly streaming platform. 