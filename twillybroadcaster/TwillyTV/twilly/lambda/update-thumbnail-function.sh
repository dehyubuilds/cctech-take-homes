#!/bin/bash

# SSH into the server and update the generateThumbnail function
ssh -i ~/.ssh/twilly-streaming-key-1750894315.pem ec2-user@54.167.109.72 << 'EOF'

# Create the new Lambda-based generateThumbnail function
cat > /tmp/new-generateThumbnail.js << 'NEWFUNCTION'
async function generateThumbnail(inputPath, outputDir, streamName) {
  console.log(`🖼️ generateThumbnail called with:`, { inputPath, outputDir, streamName });
  
  try {
    // Extract the unique prefix from the output directory files (same logic as before)
    const files = fs.readdirSync(outputDir);
    console.log(`📁 Files found in output directory:`, files);
    
    // Look for any m3u8 file to get the unique prefix
    const m3u8Files = files.filter(file => file.endsWith('.m3u8'));
    console.log(`📄 Found m3u8 files:`, m3u8Files);
    
    if (m3u8Files.length === 0) {
      console.log(`⚠️ No m3u8 files found for thumbnail generation`);
      return;
    }
    
    // Use the first m3u8 file to extract the unique prefix
    const m3u8File = m3u8Files[0];
    
    // Extract the unique prefix from the m3u8 filename
    // m3u8File format: "deh1_2025-07-16T20-34-59-561Z_gqx58f42_1080p.m3u8" or "deh1_2025-07-16T20-34-59-561Z_gqx58f42_master.m3u8"
    // We want to extract: "deh1_2025-07-16T20-34-59-561Z_gqx58f42"
    const uniquePrefix = m3u8File.replace(/_(1080p|720p|480p|360p|master)\.m3u8$/, '');
    
    console.log(`🖼️ Triggering Lambda thumbnail generation for stream: ${streamName}`);
    console.log(`📝 Unique prefix for thumbnail: ${uniquePrefix}`);
    
    // Call Lambda directly
    const AWS = require('aws-sdk');
    const lambda = new AWS.Lambda({ region: 'us-east-1' });
    
    const result = await lambda.invoke({
      FunctionName: 'twilly-thumbnail-generator',
      InvocationType: 'Event', // Asynchronous
      Payload: JSON.stringify({
        streamKey: streamName,
        schedulerId: streamName, // You might need to extract this from streamName
        flvPath: inputPath,
        uniquePrefix: uniquePrefix
      })
    }).promise();
    
    console.log(`✅ Lambda thumbnail generation triggered for stream: ${streamName}`);
    console.log(`📝 Lambda response:`, result);
    
  } catch (error) {
    console.error(`❌ Error triggering Lambda thumbnail generation:`, error);
  }
}
NEWFUNCTION

# Replace the function in the streaming service file
cd /home/ec2-user/streaming-service

# Find the line numbers for the generateThumbnail function
START_LINE=$(grep -n "async function generateThumbnail" streaming-service-server.js | cut -d: -f1)
END_LINE=$(sed -n "${START_LINE},\$p" streaming-service-server.js | grep -n "^}" | head -1 | cut -d: -f1)
END_LINE=$((START_LINE + END_LINE - 1))

echo "Replacing generateThumbnail function from line ${START_LINE} to ${END_LINE}"

# Create the updated file
sed "${START_LINE},${END_LINE}d" streaming-service-server.js > /tmp/streaming-service-server-updated.js
sed "${START_LINE}i\\$(cat /tmp/new-generateThumbnail.js)" /tmp/streaming-service-server-updated.js > streaming-service-server.js

echo "✅ generateThumbnail function updated to use Lambda"

# Restart the streaming service
echo "🔄 Restarting streaming service..."
pkill -f "streaming-service-server.js"
sleep 2
nohup node streaming-service-server.js > server.log 2>&1 &
echo "✅ Streaming service restarted"

EOF 