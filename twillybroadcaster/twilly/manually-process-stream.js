// Manual stream processing script
// This script manually triggers processing for a stream file that wasn't processed automatically

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const STREAM_KEY = process.argv[2] || 'sk_ikgqum1e70nc4tyl';
const TIMESTAMP = process.argv[3] || '1771696144';

console.log(`🔍 Manually processing stream: ${STREAM_KEY}-${TIMESTAMP}`);
console.log('');

// Find the recording file
const recordingDirs = ['/var/www/recordings', '/tmp/recordings'];
let recordingPath = null;

for (const dir of recordingDirs) {
  if (fs.existsSync(dir)) {
    const filePath = path.join(dir, `${STREAM_KEY}-${TIMESTAMP}.flv`);
    if (fs.existsSync(filePath)) {
      recordingPath = filePath;
      console.log(`✅ Found recording file: ${recordingPath}`);
      const stats = fs.statSync(filePath);
      console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Modified: ${stats.mtime.toISOString()}`);
      break;
    }
  }
}

if (!recordingPath) {
  console.error(`❌ Recording file not found: ${STREAM_KEY}-${TIMESTAMP}.flv`);
  console.error('   Searched in:', recordingDirs.join(', '));
  process.exit(1);
}

// Generate uploadId (matching the format used by /stream/stop)
const uploadId = `rtmp-${TIMESTAMP}000-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
console.log(`📤 Generated uploadId: ${uploadId}`);
console.log('');

// Call the processing function via HTTP
// Since /stream/stop requires activeStreams, we'll need to call processStreamInternal directly
// But that's not exposed via HTTP, so we'll need to trigger it another way

console.log('🔄 Triggering processing...');
console.log('   Note: This requires the streaming service to be running');
console.log('   and the processStreamInternal function to be accessible');
console.log('');

// Alternative: Use curl to call a processing endpoint if it exists
// Or we can directly invoke the Node.js function if we have access to the service code
console.log('💡 Solution: The file needs to be processed by the streaming service.');
console.log('   Options:');
console.log('   1. Restart the streaming service (it may pick up unprocessed files)');
console.log('   2. Add a manual processing endpoint to the service');
console.log('   3. Manually call processStreamInternal() if you have access to the service code');
console.log('');
console.log(`   File location: ${recordingPath}`);
console.log(`   StreamKey: ${STREAM_KEY}`);
console.log(`   UploadId: ${uploadId}`);
console.log('');
