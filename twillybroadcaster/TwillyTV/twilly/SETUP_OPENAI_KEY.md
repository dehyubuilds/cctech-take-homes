# Setup OpenAI API Key on EC2 Server

## ⚠️ SECURITY WARNING

**Your API key was exposed in chat. After setup, regenerate it at:**
https://platform.openai.com/api-keys

## Quick Setup (Option 1: Automated Script)

1. **Copy the setup script to EC2**:
   ```bash
   scp twilly/setup-openai-key.sh ec2-user@your-ec2-ip:~/
   ```

2. **SSH into EC2 and run**:
   ```bash
   ssh ec2-user@your-ec2-ip
   chmod +x ~/setup-openai-key.sh
   sudo ~/setup-openai-key.sh
   ```

## Manual Setup (Option 2: Manual Steps)

1. **SSH into your EC2 instance**:
   ```bash
   ssh ec2-user@your-ec2-ip
   ```

2. **Edit the systemd service file**:
   ```bash
   sudo nano /etc/systemd/system/twilly-streaming.service
   ```

3. **Add the environment variable** in the `[Service]` section:
   ```ini
   [Service]
   Environment="OPENAI_API_KEY=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"
   ```

4. **Reload and restart**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart twilly-streaming
   ```

5. **Verify it's working**:
   ```bash
   sudo systemctl status twilly-streaming
   sudo journalctl -u twilly-streaming -f
   ```

## Verify the Key is Set

Check if the environment variable is loaded:
```bash
sudo systemctl show twilly-streaming | grep OPENAI_API_KEY
```

## Test Episode Segmentation

1. Stream a test video
2. Check logs for episode segmentation:
   ```bash
   sudo journalctl -u twilly-streaming -f | grep "Episode Segmentation"
   ```

## After Testing - Regenerate Key

1. Go to: https://platform.openai.com/api-keys
2. Delete the old key
3. Create a new key
4. Update the service file with the new key
5. Restart the service
