const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkRequests() {
  try {
    // First, find Twilly TV's email using the same method as request-follow
    console.log('🔍 Searching for Twilly TV user...');
    
    // Use UsernameLookupIndex GSI (same as backend)
    const gsiParams = {
      TableName: table,
      IndexName: 'UsernameLookupIndex',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': 'Twilly TV'
      }
    };
    
    let userResult;
    try {
      userResult = await dynamodb.query(gsiParams).promise();
    } catch (gsiError) {
      console.log(`⚠️ GSI query failed: ${gsiError.message}`);
      console.log('   Trying scan instead...');
      
      // Fallback: scan for PROFILE items
      const scanParams = {
        TableName: table,
        FilterExpression: 'SK = :sk AND username = :username',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':username': 'Twilly TV'
        }
      };
      userResult = await dynamodb.scan(scanParams).promise();
    }
    
    console.log(`📋 Found ${userResult.Items.length} users with username "Twilly TV"`);
    
    if (userResult.Items.length === 0) {
      console.log('❌ Twilly TV user not found!');
      return;
    }
    
    const twillyTVUser = userResult.Items[0];
    const twillyTVEmail = twillyTVUser.PK?.replace('USER#', '') || twillyTVUser.email || twillyTVUser.userEmail;
    console.log(`✅ Twilly TV email: ${twillyTVEmail}`);
    
    // Now check for follow requests
    console.log('\n🔍 Checking for follow requests to Twilly TV...');
    const requestParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail.toLowerCase()}`,
        ':skPrefix': 'FOLLOW_REQUEST#'
      }
    };
    
    const requestsResult = await dynamodb.query(requestParams).promise();
    console.log(`📬 Found ${requestsResult.Items.length} follow requests for Twilly TV`);
    
    if (requestsResult.Items.length > 0) {
      console.log('\n📋 Follow Requests:');
      requestsResult.Items.forEach((req, index) => {
        console.log(`\n  Request ${index + 1}:`);
        console.log(`    SK: ${req.SK}`);
        console.log(`    Requester Email: ${req.requesterEmail}`);
        console.log(`    Requester Username: ${req.requesterUsername || 'N/A'}`);
        console.log(`    Requested Username: ${req.requestedUsername || 'N/A'}`);
        console.log(`    Status: ${req.status}`);
        console.log(`    Requested At: ${req.requestedAt || 'N/A'}`);
        console.log(`    Is Private Stream Request: ${req.isPrivateStreamRequest || false}`);
      });
    } else {
      console.log('❌ No follow requests found!');
      
      // Check if there are any with different email casing
      console.log('\n🔍 Checking with original email (not lowercased)...');
      const requestParams2 = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${twillyTVEmail}`,
          ':skPrefix': 'FOLLOW_REQUEST#'
        }
      };
      
      const requestsResult2 = await dynamodb.query(requestParams2).promise();
      console.log(`📬 Found ${requestsResult2.Items.length} follow requests (with original casing)`);
    }
    
    // Also check for dehyuusername's sent requests
    console.log('\n🔍 Checking for dehyuusername user...');
    const dehyuGSI = {
      TableName: table,
      IndexName: 'UsernameLookupIndex',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': 'dehyuusername'
      }
    };
    
    let dehyuResult;
    try {
      dehyuResult = await dynamodb.query(dehyuGSI).promise();
    } catch (gsiError) {
      console.log(`⚠️ GSI query failed: ${gsiError.message}`);
      // Fallback: scan for PROFILE items
      const scanParams = {
        TableName: table,
        FilterExpression: 'SK = :sk AND username = :username',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':username': 'dehyuusername'
        }
      };
      dehyuResult = await dynamodb.scan(scanParams).promise();
    }
    if (dehyuResult.Items.length > 0) {
      const dehyuUser = dehyuResult.Items[0];
      const dehyuEmail = dehyuUser.PK?.replace('USER#', '') || dehyuUser.email || dehyuUser.userEmail;
      console.log(`✅ dehyuusername email: ${dehyuEmail}`);
      
      // Check sent-follow-requests GSI
      console.log('\n🔍 Checking sent follow requests from dehyuusername...');
      const sentRequestsParams = {
        TableName: table,
        IndexName: 'FollowRequestsByRequesterIndex',
        KeyConditionExpression: 'requesterEmail = :requesterEmail',
        FilterExpression: 'begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':requesterEmail': dehyuEmail.toLowerCase(),
          ':skPrefix': 'FOLLOW_REQUEST#'
        }
      };
      
      try {
        const sentRequestsResult = await dynamodb.query(sentRequestsParams).promise();
        console.log(`📤 Found ${sentRequestsResult.Items.length} sent requests from dehyuusername`);
        
        if (sentRequestsResult.Items.length > 0) {
          sentRequestsResult.Items.forEach((req, index) => {
            console.log(`\n  Sent Request ${index + 1}:`);
            console.log(`    PK: ${req.PK}`);
            console.log(`    SK: ${req.SK}`);
            console.log(`    Requested Username: ${req.requestedUsername || 'N/A'}`);
            console.log(`    Status: ${req.status}`);
          });
        }
      } catch (gsiError) {
        console.log(`⚠️ GSI query failed: ${gsiError.message}`);
        console.log('   Trying scan instead...');
        
        // Fallback to scan
        const scanParams = {
          TableName: table,
          FilterExpression: 'begins_with(SK, :skPrefix) AND requesterEmail = :requesterEmail',
          ExpressionAttributeValues: {
            ':skPrefix': 'FOLLOW_REQUEST#',
            ':requesterEmail': dehyuEmail.toLowerCase()
          }
        };
        
        const scanResult = await dynamodb.scan(scanParams).promise();
        console.log(`📤 Found ${scanResult.Items.length} sent requests (via scan)`);
        
        if (scanResult.Items.length > 0) {
          scanResult.Items.forEach((req, index) => {
            console.log(`\n  Sent Request ${index + 1}:`);
            console.log(`    PK: ${req.PK}`);
            console.log(`    SK: ${req.SK}`);
            console.log(`    Requested Username: ${req.requestedUsername || 'N/A'}`);
            console.log(`    Status: ${req.status}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRequests();
