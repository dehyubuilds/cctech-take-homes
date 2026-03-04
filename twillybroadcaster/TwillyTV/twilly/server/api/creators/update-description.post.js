import AWS from "aws-sdk";

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, series, description, trailerUrl } = body;

    if (!username || !series) {
      return {
        success: false,
        message: 'Missing required fields: username and series are required'
      };
    }

    console.log('🔍 [update-description] Updating description for:', { username, series, description });

    // 1) Resolve email by username (same logic as get-share-params)
    let email = username;
    let resolvedUsername = username;
    
    if (!username.includes('@')) {
      try {
        const userScanParams = {
          TableName: 'Twilly',
          FilterExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': 'USER' }
        };
        const userResult = await dynamodb.scan(userScanParams).promise();
        if (userResult.Items && userResult.Items.length > 0) {
          const target = String(username || '').toLowerCase();
          const match = userResult.Items.find(u => String(u.username || '').toLowerCase() === target);
          if (match) {
            email = match.email;
            resolvedUsername = match.username;
            console.log(`✅ [update-description] Resolved username ${username} to email: ${email}`);
          } else {
            console.log(`⚠️ [update-description] No user found for username: ${username}`);
          }
        }
      } catch (err) {
        console.error('[update-description] Error finding user by username:', err);
      }
    }

    // First, try to find the series record using the same logic as get-share-params
    // Look for SERIES# records in the SERIES partition
    // Use the SAME key structure: SERIES#${email}-${seriesName}
    const seriesQueryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `SERIES#${email}-${series}` // Use resolved email for consistency
      }
    };

    console.log('🔍 [update-description] Querying for series record:', seriesQueryParams);

    const seriesResult = await dynamodb.query(seriesQueryParams).promise();
    
    if (seriesResult.Items && seriesResult.Items.length > 0) {
      // Found series record, update it
      const seriesRecord = seriesResult.Items[0];
      console.log('✅ [update-description] Found series record:', seriesRecord.SK);
      
      // Build update expression dynamically
      let updateExpression = 'SET updatedAt = :updatedAt, trailerUrl = :trailerUrl';
      let expressionAttributeValues = {
        ':updatedAt': new Date().toISOString(),
        ':trailerUrl': trailerUrl || null
      };
      
      // Only update description if provided
      if (description !== null && description !== undefined) {
        updateExpression += ', description = :description';
        expressionAttributeValues[':description'] = description;
      }
      
      const updateParams = {
        TableName: 'Twilly',
        Key: {
          PK: seriesRecord.PK,
          SK: seriesRecord.SK
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues
      };

      await dynamodb.update(updateParams).promise();
      console.log('✅ [update-description] Successfully updated series record');
      
      return {
        success: true,
        message: 'Description updated successfully'
      };
    }

    // If no series record found, try to find it in the USER partition as a COLLAB# record
    console.log('🔍 [update-description] No series record found, trying USER partition...');
    
    // Use the already resolved email from above
    const resolvedEmail = email;

    // Now look for COLLAB# records in the USER partition
    const collabQueryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${resolvedEmail}`
      }
    };

    console.log('🔍 [update-description] Querying for COLLAB records:', collabQueryParams);

    const collabResult = await dynamodb.query(collabQueryParams).promise();
    
    if (collabResult.Items && collabResult.Items.length > 0) {
      // Find the COLLAB# record for this series
      const collabRecord = collabResult.Items.find(item => 
        item.SK && item.SK.startsWith('COLLAB#') && 
        (item.folderName === series || item.name === series)
      );
      
      if (collabRecord) {
        console.log('✅ [update-description] Found COLLAB record:', collabRecord.SK);
        
        const updateParams = {
          TableName: 'Twilly',
          Key: {
            PK: collabRecord.PK,
            SK: collabRecord.SK
          },
          UpdateExpression: 'SET description = :description, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':description': description,
            ':updatedAt': new Date().toISOString()
          }
        };

        await dynamodb.update(updateParams).promise();
        console.log('✅ [update-description] Successfully updated COLLAB record');
        
        return {
          success: true,
          message: 'Description updated successfully'
        };
      }
    }

    // If still no record found, create a new SERIES# record
    console.log('🔍 [update-description] No existing record found, creating new SERIES record...');
    
    const newSeriesRecord = {
      PK: `SERIES#${email}-${series}`,
      SK: 'METADATA',
      title: series,
      description: description,
      creatorUsername: resolvedUsername, // Use resolved username for display
      creatorEmail: email, // Store email for consistency
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const putParams = {
      TableName: 'Twilly',
      Item: newSeriesRecord
    };

    await dynamodb.put(putParams).promise();
    console.log('✅ [update-description] Successfully created new SERIES record');
    
    return {
      success: true,
      message: 'Description created successfully'
    };

  } catch (error) {
    console.error('❌ [update-description] Error:', error);
    return {
      success: false,
      message: error.message || 'Failed to update description'
    };
  }
});
