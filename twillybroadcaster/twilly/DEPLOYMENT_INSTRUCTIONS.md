# Deployment Instructions - Audio Fix & Instance Downsize

## ✅ Completed Steps

1. **Instance Downsized**: `t3.medium` → `t3.micro`
   - Instance ID: `i-0f4de776143f620d1`
   - IP Address: `100.24.103.57` (Elastic IP - unchanged ✅)
   - Cost Savings: ~$22.50/month

2. **Code Committed**: Audio verification fix pushed to repository

## 🔄 Manual Deployment Steps

Since automatic SSH deployment failed, please run these commands manually:

### Step 1: SSH into the server
```bash
ssh -i ~/.ssh/twilly-streaming-key.pem ec2-user@100.24.103.57
```

### Step 2: Navigate to streaming service directory
```bash
# Try these locations:
cd /opt/twilly-streaming
# OR
cd ~/twilly
# OR
cd /var/www/twilly
```

### Step 3: Update code
```bash
# If it's a git repository:
git pull origin main

# OR download directly:
curl -o streaming-service-server.js https://raw.githubusercontent.com/dehyubuilds/cctech-take-homes/main/twilly/streaming-service-server.js
```

### Step 4: Restart streaming service
```bash
# If using PM2:
pm2 restart streaming-service
pm2 save

# OR if using systemd:
sudo systemctl restart streaming-service

# OR if using init.d:
sudo /etc/init.d/streaming-service restart
```

### Step 5: Restart nginx
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Verify services are running
```bash
# Check PM2 status
pm2 list

# Check systemd status
sudo systemctl status streaming-service

# Check nginx
sudo systemctl status nginx

# Check if port 3000 is listening
sudo netstat -tlnp | grep 3000
```

## 🧪 Testing

After deployment, test a new stream and check logs for:

1. **Audio Detection Messages**:
   - `✅ Audio track found - will encode with audio`
   - `⚠️ No audio track found in input file - encoding without audio`

2. **Service Status**:
   ```bash
   # Check streaming service logs
   pm2 logs streaming-service --lines 50
   # OR
   sudo journalctl -u streaming-service -n 50
   ```

3. **Test RTMP Connection**:
   - Use your mobile app to stream
   - Verify audio is captured
   - Check server logs for audio detection

## 📊 Instance Status

- **Instance Type**: t3.micro (1 vCPU, 1GB RAM)
- **IP Address**: 100.24.103.57 (static)
- **Status**: Running
- **Cost**: ~$7.50/month (down from ~$30/month)

## 🔍 Troubleshooting

If you encounter issues:

1. **Check instance status**:
   ```bash
   aws ec2 describe-instances --instance-ids i-0f4de776143f620d1
   ```

2. **Check Elastic IP**:
   ```bash
   aws ec2 describe-addresses --public-ips 100.24.103.57
   ```

3. **Verify SSH key**:
   ```bash
   chmod 400 ~/.ssh/twilly-streaming-key.pem
   ssh -i ~/.ssh/twilly-streaming-key.pem ec2-user@100.24.103.57
   ```

## 📝 Notes

- The instance has been successfully downsized
- Elastic IP is configured and IP address remains the same
- Heavy processing is done by Lambdas, so t3.micro is sufficient
- Audio verification fix is in the code and will log warnings if audio is missing
