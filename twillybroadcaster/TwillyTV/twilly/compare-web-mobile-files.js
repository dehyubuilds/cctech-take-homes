const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function compareWebMobileFiles() {
  console.log('🔍 Comparing files between web app and mobile app...\n');
  
  try {
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const channelName = 'Twilly TV';
    
    // Get all files from admin account (what web app sees)
    const filesParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`
      }
    };
    
    const filesResult = await dynamodb.query(filesParams).promise();
    const allFiles = filesResult.Items || [];
    
    console.log(`📁 Total files in admin account: ${allFiles.length}\n`);
    
    // Filter for Twilly TV videos (web app logic)
    const twillyTVFiles = allFiles.filter(file => {
      if (!file || !file.fileName) return false;
      if (file.fileName.includes('_thumb.jpg')) return false;
      if (file.fileName.endsWith('.gif') && !file.fileName.includes('_0.gif')) return false;
      if (file.category !== 'Videos') return false;
      
      const hasHlsUrl = !!file.hlsUrl;
      const hasStreamKey = !!file.streamKey;
      const fileChannelName = file.folderName || file.seriesName;
      const folderMatch = fileChannelName === channelName || 
                         (fileChannelName && fileChannelName.toLowerCase() === channelName.toLowerCase());
      
      return hasHlsUrl && hasStreamKey && folderMatch;
    });
    
    console.log('📹 WEB APP FILTERED FILES (managefiles.vue logic):');
    console.log('='.repeat(60));
    console.log(`Count: ${twillyTVFiles.length}`);
    twillyTVFiles.forEach((file, index) => {
      console.log(`\n${index + 1}. ${file.fileName}`);
      console.log(`   SK: ${file.SK}`);
      console.log(`   streamKey: ${file.streamKey || 'MISSING'}`);
      console.log(`   hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
      console.log(`   thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
      console.log(`   isVisible: ${file.isVisible}`);
      console.log(`   creatorId: ${file.creatorId || 'MISSING'}`);
      console.log(`   creatorUsername: ${file.creatorUsername || 'MISSING'}`);
      console.log(`   isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log(`   createdAt: ${file.createdAt || file.timestamp || 'MISSING'}`);
    });
    console.log('');
    
    // Now check what mobile app would see (get-content API logic)
    console.log('📱 MOBILE APP FILTERED FILES (get-content API logic):');
    console.log('='.repeat(60));
    
    // Mobile app uses get-content which:
    // 1. Queries by collaborator emails
    // 2. Filters by isVisible !== false
    // 3. Filters out invalid usernames
    // 4. Filters out empty thumbnails
    // 5. Filters out test videos
    
    const mobileFiles = twillyTVFiles.filter(file => {
      // Check isVisible (mobile filters out isVisible === false)
      if (file.isVisible === false) {
        console.log(`   🚫 Filtered out: ${file.fileName} - isVisible: false`);
        return false;
      }
      
      // Check thumbnail (mobile filters out empty thumbnails)
      const thumbnailUrl = file.thumbnailUrl;
      const hasValidThumbnail = thumbnailUrl && 
                                typeof thumbnailUrl === 'string' && 
                                thumbnailUrl.trim() !== '' && 
                                thumbnailUrl !== 'null' && 
                                thumbnailUrl !== 'undefined' &&
                                (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
      
      if (!hasValidThumbnail) {
        console.log(`   🚫 Filtered out: ${file.fileName} - invalid thumbnail`);
        return false;
      }
      
      // Check username (mobile filters out invalid usernames)
      const invalidUsernames = ['googoogaga', 'yess', 'dehyuusername'];
      if (file.creatorUsername && invalidUsernames.includes(file.creatorUsername.toLowerCase())) {
        console.log(`   🚫 Filtered out: ${file.fileName} - invalid username: ${file.creatorUsername}`);
        return false;
      }
      
      // Check for test videos
      const fileName = file.fileName || '';
      const fileNameLower = fileName.toLowerCase();
      if (fileNameLower.includes('test') || fileNameLower.includes('sample')) {
        console.log(`   🚫 Filtered out: ${file.fileName} - test video`);
        return false;
      }
      
      return true;
    });
    
    console.log(`Count: ${mobileFiles.length}`);
    mobileFiles.forEach((file, index) => {
      console.log(`\n${index + 1}. ${file.fileName}`);
      console.log(`   SK: ${file.SK}`);
      console.log(`   streamKey: ${file.streamKey || 'MISSING'}`);
      console.log(`   creatorUsername: ${file.creatorUsername || 'MISSING'}`);
    });
    console.log('');
    
    // Find the discrepancy
    if (twillyTVFiles.length !== mobileFiles.length) {
      console.log('⚠️ DISCREPANCY FOUND:');
      console.log('='.repeat(60));
      console.log(`Web app shows: ${twillyTVFiles.length} files`);
      console.log(`Mobile app shows: ${mobileFiles.length} files`);
      console.log(`Difference: ${twillyTVFiles.length - mobileFiles.length} file(s) filtered out by mobile`);
      
      const filteredOut = twillyTVFiles.filter(webFile => 
        !mobileFiles.some(mobileFile => mobileFile.SK === webFile.SK)
      );
      
      if (filteredOut.length > 0) {
        console.log('\n📋 Files shown in web but filtered out in mobile:');
        filteredOut.forEach(file => {
          console.log(`   - ${file.fileName}`);
          console.log(`     isVisible: ${file.isVisible}`);
          console.log(`     thumbnailUrl: ${file.thumbnailUrl ? 'present' : 'missing'}`);
          console.log(`     creatorUsername: ${file.creatorUsername || 'MISSING'}`);
        });
      }
    } else {
      console.log('✅ Both web and mobile show the same number of files');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

compareWebMobileFiles().catch(console.error);
