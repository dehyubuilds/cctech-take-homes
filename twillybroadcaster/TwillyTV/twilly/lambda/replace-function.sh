#!/bin/bash

# SSH into server and replace the function
ssh -i ~/.ssh/twilly-streaming-key-1750894315.pem ec2-user@54.167.109.72 << 'EOF'

cd /home/ec2-user/streaming-service

# Create a simple replacement
cat > /tmp/new-function.js << 'FUNCTION'
async function generateThumbnail(inputPath, outputDir, streamName) {
  console.log("🖼️ generateThumbnail called with:", { inputPath, outputDir, streamName });
  
  try {
    const files = fs.readdirSync(outputDir);
    const m3u8Files = files.filter(file => file.endsWith('.m3u8'));
    
    if (m3u8Files.length === 0) {
      console.log("⚠️ No m3u8 files found for thumbnail generation");
      return;
    }
    
    const m3u8File = m3u8Files[0];
    const uniquePrefix = m3u8File.replace(/_(1080p|720p|480p|360p|master)\.m3u8$/, '');
    
    console.log("🖼️ Triggering Lambda thumbnail generation for stream:", streamName);
    
    const AWS = require('aws-sdk');
    const lambda = new AWS.Lambda({ region: 'us-east-1' });
    
    const result = await lambda.invoke({
      FunctionName: 'twilly-thumbnail-generator',
      InvocationType: 'Event',
      Payload: JSON.stringify({
        streamKey: streamName,
        schedulerId: streamName,
        flvPath: inputPath,
        uniquePrefix: uniquePrefix
      })
    }).promise();
    
    console.log("✅ Lambda thumbnail generation triggered for stream:", streamName);
    
  } catch (error) {
    console.error("❌ Error triggering Lambda thumbnail generation:", error);
  }
}
FUNCTION

# Find the function and replace it
START_LINE=$(grep -n "async function generateThumbnail" streaming-service-server.js | cut -d: -f1)
echo "Function starts at line: $START_LINE"

# Create a new file with the replacement
head -n $((START_LINE - 1)) streaming-service-server.js > /tmp/new-server.js
cat /tmp/new-function.js >> /tmp/new-server.js

# Find where the function ends and add the rest
END_LINE=$(sed -n "${START_LINE},\$p" streaming-service-server.js | grep -n "^}" | head -1 | cut -d: -f1)
END_LINE=$((START_LINE + END_LINE))
echo "Function ends around line: $END_LINE"

tail -n +$((END_LINE + 1)) streaming-service-server.js >> /tmp/new-server.js

# Replace the original file
cp /tmp/new-server.js streaming-service-server.js

echo "✅ Function replaced successfully"

# Restart the service
pkill -f "streaming-service-server.js"
sleep 2
nohup node streaming-service-server.js > server.log 2>&1 &
echo "✅ Streaming service restarted"

EOF 