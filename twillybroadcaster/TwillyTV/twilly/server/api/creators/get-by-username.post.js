import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { username } = body;

  if (!username) {
    return {
      error: 'Username is required'
    };
  }

  console.log('[Get By Username API] Loading user details for username:', username);

  try {
    // OPTIMIZED: Use GSI for fast username lookup
    // GSI: UsernameSearchIndex
    let user = null;
    let useGSI = true;
    
    try {
      // Query both public and private partitions
      for (const visibility of ['public', 'private']) {
        const queryParams = {
          TableName: 'Twilly',
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
          ExpressionAttributeValues: {
            ':visibility': visibility,
            ':username': username // Exact match (case-sensitive)
          },
          Limit: 1
        };
        
        const result = await dynamoDb.query(queryParams).promise();
        if (result.Items && result.Items.length > 0) {
          // Check for case-insensitive match
          const foundUser = result.Items.find(item => 
            item.username && item.username.toLowerCase() === username.toLowerCase()
          );
          if (foundUser) {
            user = foundUser;
            break;
          }
        }
      }
      
      // If exact match didn't work, scan the GSI for case-insensitive match
      if (!user) {
        for (const visibility of ['public', 'private']) {
          const queryParams = {
            TableName: 'Twilly',
            IndexName: 'UsernameSearchIndex',
            KeyConditionExpression: 'usernameVisibility = :visibility',
            ExpressionAttributeValues: {
              ':visibility': visibility
            }
          };
          
          let lastEvaluatedKey = null;
          do {
            if (lastEvaluatedKey) {
              queryParams.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const result = await dynamoDb.query(queryParams).promise();
            const foundUser = result.Items.find(item => 
              item.username && item.username.toLowerCase() === username.toLowerCase()
            );
            if (foundUser) {
              user = foundUser;
              break;
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
          } while (lastEvaluatedKey && !user);
          
          if (user) break;
        }
      }
      
      if (user) {
        console.log('[Get By Username API] Found user via GSI');
      }
    } catch (error) {
      // If GSI doesn't exist yet, fall back to scan
      if (error.code === 'ResourceNotFoundException' || 
          error.message.includes('index') || 
          error.message.includes('UsernameSearchIndex')) {
        console.log('[Get By Username API] GSI not available, falling back to scan...');
        useGSI = false;
      } else {
        throw error;
      }
    }
    
    // Fallback to scan if GSI not available
    if (!useGSI || !user) {
    const params = {
      TableName: 'Twilly',
      FilterExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER'
      }
    };

    const result = await dynamoDb.scan(params).promise();
    console.log('[Get By Username API] DynamoDB result:', result);

    if (!result.Items || result.Items.length === 0) {
      return {
        error: 'User not found'
      };
    }

    // Find user with case-insensitive username match
      user = result.Items.find(item => 
      item.username && item.username.toLowerCase() === username.toLowerCase()
    );
    }

    if (!user) {
      return {
        error: 'User not found'
      };
    }
    console.log('[Get By Username API] Found user:', user);
    
    return {
      userId: user.SK,
      email: user.email,
      username: user.username,
      name: user.name || ''
    };

  } catch (error) {
    console.error('[Get By Username API] Error:', error);
    return {
      error: 'Failed to load user details',
      details: error.message
    };
  }
}); 