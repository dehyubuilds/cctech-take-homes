const fs = require('fs');

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
        schedulerId: streamName,
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