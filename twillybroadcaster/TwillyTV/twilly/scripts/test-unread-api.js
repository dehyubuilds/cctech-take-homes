const AWS = require('aws-sdk');
const https = require('https');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

async function testUnreadAPI() {
  const videoId = 'file-upload-1768146193473-vfjgo9s';
  const viewerEmail = 'dehyu.sinyan@gmail.com';
  
  const body = JSON.stringify({
    videoIds: [videoId],
    viewerEmail: viewerEmail
  });
  
  const options = {
    hostname: 'twilly.app',
    path: '/api/comments/unread-count',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length
    }
  };
  
  console.log(`🔍 Testing unread count API...`);
  console.log(`   Video ID: ${videoId}`);
  console.log(`   Viewer: ${viewerEmail}`);
  console.log(`   URL: https://${options.hostname}${options.path}\n`);
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📊 Response Status: ${res.statusCode}`);
        console.log(`📊 Response Body:\n${data}\n`);
        
        try {
          const json = JSON.parse(data);
          console.log(`✅ Parsed Response:`);
          console.log(JSON.stringify(json, null, 2));
          
          if (json.success && json.unreadCounts) {
            const count = json.unreadCounts[videoId];
            if (typeof count === 'number') {
              console.log(`\n📊 Unread count: ${count}`);
            } else if (count && count.total) {
              console.log(`\n📊 Unread count: ${count.total}`);
              console.log(`📊 Thread counts: ${JSON.stringify(count.threads, null, 2)}`);
            }
          }
        } catch (e) {
          console.error('❌ Failed to parse JSON:', e.message);
        }
        
        resolve();
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    req.write(body);
    req.end();
  });
}

testUnreadAPI()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
