import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    console.log('🔍 Testing collaborator roles for user "gaga"...\n');
    
    // First, find the userId/email for 'gaga'
    console.log('Step 1: Finding userId/email for username "gaga"...');
    
    // Try to find user by username
    const usernameScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': 'gaga'
      }
    }).promise();
    
    console.log(`Found ${usernameScan.Items.length} records with username "gaga"`);
    
    let userId = null;
    let userEmail = null;
    
    if (usernameScan.Items.length > 0) {
      const userRecord = usernameScan.Items[0];
      console.log('User record:', JSON.stringify(userRecord, null, 2));
      
      // Extract userId and email from the record
      if (userRecord.PK && userRecord.PK.startsWith('USER#')) {
        userId = userRecord.PK.replace('USER#', '');
      } else if (userRecord.PK === 'USER') {
        userId = userRecord.SK;
      }
      
      userEmail = userRecord.email || userRecord.userEmail;
      
      console.log(`\nExtracted userId: ${userId}`);
      console.log(`Extracted email: ${userEmail}\n`);
    }
    
    // Now query for collaborator roles
    // Try both userId and email as PK
    const possibleKeys = [];
    if (userId) possibleKeys.push(`USER#${userId}`);
    if (userEmail) possibleKeys.push(`USER#${userEmail}`);
    if (!userId && !userEmail) {
      // Fallback: try 'gaga' as userId
      possibleKeys.push('USER#gaga');
    }
    
    console.log('Step 2: Querying collaborator roles...');
    console.log(`Trying PKs: ${possibleKeys.join(', ')}\n`);
    
    const allRoles = [];
    
    for (const pk of possibleKeys) {
      try {
        const queryParams = {
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':sk': 'COLLABORATOR_ROLE#'
          }
        };
        
        const result = await dynamodb.query(queryParams).promise();
        const roles = result.Items || [];
        
        console.log(`\n📊 Results for PK: ${pk}`);
        console.log(`Found ${roles.length} collaborator roles`);
        
        if (roles.length > 0) {
          roles.forEach((role, index) => {
            console.log(`\n  Role ${index + 1}:`);
            console.log(`    Channel ID: ${role.channelId || 'N/A'}`);
            console.log(`    Channel Name: ${role.channelName || 'N/A'}`);
            console.log(`    Stream Key: ${role.streamKey ? 'Yes' : 'No'}`);
            console.log(`    Status: ${role.status || 'N/A'}`);
            console.log(`    Joined At: ${role.joinedAt || 'N/A'}`);
            console.log(`    SK: ${role.SK}`);
          });
          
          allRoles.push(...roles);
        }
      } catch (error) {
        console.log(`❌ Error querying ${pk}: ${error.message}`);
      }
    }
    
    // Also check CHANNEL# records
    console.log('\n' + '='.repeat(60));
    console.log('Step 3: Checking CHANNEL# records for "gaga" as collaborator...');
    console.log('='.repeat(60));
    
    const channelScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'CHANNEL#',
        ':skPrefix': 'COLLABORATOR#'
      }
    }).promise();
    
    console.log(`Found ${channelScan.Items.length} COLLABORATOR records on channels`);
    
    const gagaChannels = channelScan.Items.filter(item => {
      const collaboratorId = item.SK?.replace('COLLABORATOR#', '');
      return collaboratorId === 'gaga' || collaboratorId === userId || collaboratorId === userEmail;
    });
    
    const channelDetails = [];
    if (gagaChannels.length > 0) {
      console.log(`\nFound ${gagaChannels.length} channels with "gaga" as collaborator:`);
      gagaChannels.forEach((item, index) => {
        const channelId = item.PK?.replace('CHANNEL#', '');
        console.log(`  ${index + 1}. Channel ID: ${channelId}`);
        console.log(`     Channel Name: ${item.channelName || 'N/A'}`);
        console.log(`     SK: ${item.SK}`);
        channelDetails.push({
          channelId,
          channelName: item.channelName || channelId
        });
      });
    }
    
    // Summary
    const summary = {
      userId,
      userEmail,
      collaboratorRolesFromUserTable: allRoles.map(r => ({
        channelId: r.channelId || r.channelName,
        channelName: r.channelName,
        streamKey: !!r.streamKey,
        status: r.status
      })),
      channelsFromChannelTable: channelDetails,
      totalChannels: allRoles.length + channelDetails.length
    };
    
    return {
      success: true,
      message: `Found ${summary.totalChannels} channels for user "gaga"`,
      summary
    };
    
  } catch (error) {
    console.error('Error checking gaga roles:', error);
    return {
      success: false,
      message: error.message,
      error: error.toString()
    };
  }
});
