const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllCollaboratorVideos() {
  console.log('🔍 Searching for videos from ALL collaborators in Twilly TV...\n');
  
  try {
    // First, find all collaborators for Twilly TV
    const collaboratorScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND (channelId = :channelId OR channelName = :channelName) AND addedViaInvite = :addedViaInvite AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'COLLABORATOR_ROLE#',
        ':channelId': 'Twilly TV',
        ':channelName': 'Twilly TV',
        ':addedViaInvite': true,
        ':status': 'active'
      }
    }).promise();
    
    console.log(`Found ${collaboratorScan.Items?.length || 0} collaborator roles for Twilly TV\n`);
    
    const collaboratorEmails = new Set();
    
    // Map userIds to emails
    for (const role of collaboratorScan.Items || []) {
      const userId = role.PK ? role.PK.replace('USER#', '') : null;
      if (userId) {
        try {
          const userProfile = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${userId}`,
              SK: 'PROFILE'
            }
          }).promise();
          
          if (userProfile.Item) {
            const email = userProfile.Item.email || userProfile.Item.userEmail;
            if (email) {
              collaboratorEmails.add(email);
              console.log(`✅ Collaborator: ${email} (userId: ${userId})`);
            }
          }
        } catch (err) {
          console.log(`⚠️ Error mapping userId ${userId}: ${err.message}`);
        }
      }
    }
    
    // Also check master account
    collaboratorEmails.add('dehyu.sinyan@gmail.com');
    
    console.log(`\n🔍 Checking videos from ${collaboratorEmails.size} accounts:\n`);
    
    // Query videos from all accounts
    for (const email of collaboratorEmails) {
      try {
        const result = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          FilterExpression: 'category = :category AND (folderName = :channelName OR seriesName = :channelName)',
          ExpressionAttributeValues: {
            ':pk': `USER#${email}`,
            ':sk': 'FILE#',
            ':channelName': 'Twilly TV',
            ':category': 'Videos'
          }
        }).promise();
        
        if (result.Items && result.Items.length > 0) {
          console.log(`\n📹 Videos from ${email} (${result.Items.length} videos):\n`);
          
          result.Items.forEach((video, index) => {
            const thumbnailUrl = video.thumbnailUrl || '';
            const hasValidThumbnail = thumbnailUrl && 
                                      typeof thumbnailUrl === 'string' && 
                                      thumbnailUrl.trim() !== '' && 
                                      thumbnailUrl !== 'null' && 
                                      thumbnailUrl !== 'undefined' &&
                                      (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
            
            console.log(`[${index + 1}] ${video.fileName || 'N/A'}`);
            console.log(`   StreamKey: ${video.streamKey || 'MISSING'}`);
            console.log(`   HasValidThumbnail: ${hasValidThumbnail ? 'YES' : 'NO'}`);
            console.log(`   ThumbnailUrl: ${thumbnailUrl || 'MISSING'} (type: ${typeof thumbnailUrl})`);
            console.log(`   HlsUrl: ${video.hlsUrl ? 'PRESENT' : 'MISSING'}`);
            console.log(`   IsVisible: ${video.isVisible}`);
            console.log('');
            
            if (!hasValidThumbnail) {
              console.log(`   ⚠️ THIS VIDEO HAS NO VALID THUMBNAIL - SHOULD BE FILTERED!`);
              console.log(`   ThumbnailUrl value: ${JSON.stringify(video.thumbnailUrl)}`);
              console.log('');
            }
          });
        }
      } catch (error) {
        console.error(`Error querying ${email}:`, error);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllCollaboratorVideos().catch(console.error);
