const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugTwillyTVFiltering() {
  const viewerEmail = 'dehyubuilds@gmail.com';
  const normalizedViewerEmail = viewerEmail.toLowerCase();
  
  console.log(`\n🔍 Debugging Twilly TV content filtering for: ${normalizedViewerEmail}\n`);
  
  try {
    // 1. Check what usernames are in addedUsernamesPublic
    console.log('1️⃣ Checking ADDED_USERNAME entries...\n');
    const addedParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedViewerEmail}`,
        ':skPrefix': 'ADDED_USERNAME#',
        ':status': 'active'
      }
    };
    
    const addedResult = await dynamodb.query(addedParams).promise();
    const addedItems = addedResult.Items || [];
    
    console.log(`   Found ${addedItems.length} active ADDED_USERNAME entries:\n`);
    const addedUsernamesPublic = new Set();
    const addedUsernamesPrivate = new Set();
    
    addedItems.forEach((item, idx) => {
      console.log(`   [${idx + 1}] Entry:`);
      console.log(`       SK: ${item.SK}`);
      console.log(`       streamerUsername: "${item.streamerUsername || 'MISSING'}"`);
      console.log(`       streamerVisibility: "${item.streamerVisibility || 'public'}"`);
      
      if (item.streamerUsername) {
        // Same normalization as in get-content.post.js line 105
        const normalizedUsername = item.streamerUsername.trim().toLowerCase();
        const visibility = item.streamerVisibility || 'public';
        
        if (visibility.toLowerCase() === 'private') {
          addedUsernamesPrivate.add(normalizedUsername);
          console.log(`       → Added to PRIVATE set: "${normalizedUsername}"`);
        } else {
          addedUsernamesPublic.add(normalizedUsername);
          console.log(`       → Added to PUBLIC set: "${normalizedUsername}"`);
        }
      }
      console.log('');
    });
    
    console.log(`\n📋 Final sets:`);
    console.log(`   PUBLIC: [${Array.from(addedUsernamesPublic).map(u => `"${u}"`).join(', ')}]`);
    console.log(`   PRIVATE: [${Array.from(addedUsernamesPrivate).map(u => `"${u}"`).join(', ')}]`);
    
    // 2. Check what content exists for Twilly TV
    console.log(`\n2️⃣ Checking Twilly TV content...\n`);
    const contentParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `CHANNEL#dehyu.sinyan@gmail.com-Twilly TV`,
        ':skPrefix': 'FILE#'
      },
      Limit: 20
    };
    
    const contentResult = await dynamodb.query(contentParams).promise();
    const contentItems = contentResult.Items || [];
    
    console.log(`   Found ${contentItems.length} content items:\n`);
    
    contentItems.forEach((item, idx) => {
      console.log(`   [${idx + 1}] Content:`);
      console.log(`       SK: ${item.SK}`);
      console.log(`       fileName: "${item.fileName || 'MISSING'}"`);
      console.log(`       creatorUsername: "${item.creatorUsername || 'MISSING'}"`);
      console.log(`       streamerEmail: "${item.streamerEmail || 'MISSING'}"`);
      console.log(`       isPrivateUsername: ${item.isPrivateUsername || false}`);
      
      if (item.creatorUsername) {
        // Same normalization as in get-content.post.js line 1391 and 1510
        const rawUsername = item.creatorUsername;
        const itemUsername = rawUsername.toLowerCase().trim();
        const normalizedItemUsername = itemUsername.trim().toLowerCase();
        
        console.log(`       Normalization:`);
        console.log(`         raw: "${rawUsername}"`);
        console.log(`         itemUsername: "${itemUsername}"`);
        console.log(`         normalizedItemUsername: "${normalizedItemUsername}"`);
        
        // Check if it would match
        const hasAddedForPublic = addedUsernamesPublic.has(normalizedItemUsername);
        const hasAddedForPrivate = addedUsernamesPrivate.has(normalizedItemUsername);
        
        console.log(`       Match check:`);
        console.log(`         In PUBLIC set: ${hasAddedForPublic}`);
        console.log(`         In PRIVATE set: ${hasAddedForPrivate}`);
        
        if (!hasAddedForPublic && !hasAddedForPrivate) {
          console.log(`       ⚠️  This content would be FILTERED OUT (not in either set)`);
          
          // Check for close matches
          const closeMatchPublic = Array.from(addedUsernamesPublic).find(u => {
            const uNormalized = u.trim().toLowerCase();
            return uNormalized === normalizedItemUsername;
          });
          const closeMatchPrivate = Array.from(addedUsernamesPrivate).find(u => {
            const uNormalized = u.trim().toLowerCase();
            return uNormalized === normalizedItemUsername;
          });
          
          if (closeMatchPublic) {
            console.log(`       ⚠️  Found close match in PUBLIC: "${closeMatchPublic}"`);
          }
          if (closeMatchPrivate) {
            console.log(`       ⚠️  Found close match in PRIVATE: "${closeMatchPrivate}"`);
          }
        } else {
          console.log(`       ✅ This content would be SHOWN`);
        }
      } else {
        console.log(`       ⚠️  No creatorUsername - would be filtered out`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugTwillyTVFiltering();
