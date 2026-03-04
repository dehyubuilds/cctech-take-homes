# EC2 Instance Management Guide

## Current Configuration
- **Instance ID**: `i-0f4de776143f620d1`
- **Instance Type**: `t3.micro`
- **Current IP**: `100.24.103.57` (Elastic IP - static)
- **Region**: `us-east-1`

## ⚠️ IMPORTANT: IP Address Status

**Your instance does NOT have an Elastic IP configured.**

This means:
- ❌ When you stop/start the instance, the IP address WILL CHANGE
- ❌ You'll need to update RTMP URLs in your mobile app
- ❌ Any hardcoded IPs will break

**Solution**: Run the Elastic IP setup script BEFORE stopping the instance:
```bash
./twilly/scripts/setup-elastic-ip.sh
```

## Cost Breakdown

### Running 24/7:
- **EC2 t3.micro**: ~$7.50/month ($0.25/day)
- **EBS Storage (20GB)**: ~$0.10/month
- **Data Transfer**: ~$5-15/month (varies)
- **Total**: ~$12-23/month

### When Stopped:
- **EC2 Instance**: $0.00 (no charge)
- **EBS Storage**: ~$0.10/month (still charged)
- **Elastic IP** (if configured): $3.60/month (~$0.12/day)
- **Total**: ~$3.70/month when stopped

**Savings**: ~$8-19/month by stopping when not in use

## Get backend changes live for mobile testing

To push your latest EC2 code and restart the streaming service so mobile tests see the changes:

```bash
cd /Users/dehsin365/Desktop/twillybroadcaster
./TwillyTV/twilly/scripts/deploy-backend-for-mobile-test.sh
```

That script runs `deploy-ec2-server.sh`: it copies `streaming-service-server.js` to EC2 and restarts the service (no server reboot, IP unchanged). If you only changed config or want to restart without pushing code, use:

```bash
./TwillyTV/twilly/scripts/restart-ec2-services.sh
```

## Scripts

### 1. Stop Instance
```bash
./twilly/scripts/stop-ec2-streaming.sh
```
- Stops the EC2 instance
- Saves ~$0.25/day in compute costs
- IP will change on restart (unless Elastic IP is set up)

### 2. Start Instance
```bash
./twilly/scripts/start-ec2-streaming.sh
```
- Starts the EC2 instance
- Waits for services to be ready
- Shows the new IP address (if Elastic IP not configured)

### 3. Setup Elastic IP (RECOMMENDED)
```bash
./twilly/scripts/setup-elastic-ip.sh
```
- Allocates an Elastic IP
- Associates it with your instance
- IP address will stay the same when you stop/start
- **FREE** when instance is running
- **$3.60/month** when instance is stopped

### 4. Restart services only (no server reboot, IP unchanged)
```bash
./twilly/scripts/restart-ec2-services.sh
```
- SSHs in and restarts **streaming service** (systemctl / pm2 / or manual) and **nginx**
- No EC2 reboot; IP stays the same; faster than rebooting the whole server
- To skip nginx: `RESTART_NGINX=0 ./twilly/scripts/restart-ec2-services.sh`

### 5. Restart instance (full reboot, IP persists)
```bash
./twilly/scripts/restart-ec2-persist-ip.sh
```
- Ensures Elastic IP is associated, then reboots the instance
- IP stays **100.24.103.57** after restart
- Use only when you need a full server reboot

## Usage Examples

### Stop the server (save money):
```bash
cd /Users/dehsin365/Desktop/twillybroadcaster
./twilly/scripts/stop-ec2-streaming.sh
```

### Start the server:
```bash
cd /Users/dehsin365/Desktop/twillybroadcaster
./twilly/scripts/start-ec2-streaming.sh
```

### Setup Elastic IP (do this first!):
```bash
cd /Users/dehsin365/Desktop/twillybroadcaster
./twilly/scripts/setup-elastic-ip.sh
```

## Recommendations

1. **Set up Elastic IP FIRST** - This ensures your IP stays the same
2. **Stop instance when not streaming** - Saves ~$0.25/day
3. **Monitor costs** - Use AWS Cost Explorer to track spending
4. **Consider Reserved Instances** - Save 30-40% if running 24/7 for 1-3 years

## Notes

- When stopped, you only pay for EBS storage (~$0.10/month)
- Elastic IP is FREE when instance is running
- Elastic IP costs $0.005/hour (~$3.60/month) when instance is stopped
- Starting/stopping takes ~1-2 minutes
- Services need ~30 seconds to initialize after start

