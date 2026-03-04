import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials for deployment compatibility
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()
  
  try {
    const body = await readBody(event)
    const { streamKey, userEmail } = body

    if (!streamKey || !userEmail) {
      return {
        success: false,
        message: 'Missing required parameters: streamKey, userEmail'
      }
    }

    console.log('Deleting stream key:', {
      streamKey,
      userEmail
    })

    // First find the stream key record - check both new and old structures
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'streamKey = :streamKey OR begins_with(PK, :pkPrefix)',
      ExpressionAttributeValues: {
        ':streamKey': streamKey,
        ':pkPrefix': `STREAM_KEY#${streamKey}`
      }
    }

    const existingKeys = await dynamodb.scan(scanParams).promise()

    console.log('Delete scan found items:', existingKeys.Items?.length || 0);
    if (existingKeys.Items && existingKeys.Items.length > 0) {
      console.log('First item found:', existingKeys.Items[0]);
    }

    if (!existingKeys.Items || existingKeys.Items.length === 0) {
      return {
        success: false,
        message: 'Stream key not found'
      }
    }

    // Filter out file records and find the actual stream key record
    console.log('Filtering through', existingKeys.Items.length, 'items...');
    
    const streamKeyRecord = existingKeys.Items.find(item => {
      const isStreamKeyRecord = item.PK && item.PK.startsWith('STREAM_KEY#');
      // For old structure: PK = STREAM_KEY#sk_xxxxx, SK = MAPPING
      // For new structure: PK = STREAM_KEY#userEmail, SK = sk_xxxxx
      const isOldStructure = item.PK === `STREAM_KEY#${streamKey}` && item.SK === 'MAPPING';
      const isNewStructure = item.streamKey === streamKey || item.SK === streamKey;
      
      console.log('Checking item:', {
        PK: item.PK,
        SK: item.SK,
        streamKey: item.streamKey,
        isStreamKeyRecord,
        isOldStructure,
        isNewStructure
      });
      
      return isStreamKeyRecord && (isOldStructure || isNewStructure);
    });
    
    if (!streamKeyRecord) {
      console.log('No stream key record found after filtering');
      return {
        success: false,
        message: 'Stream key record not found'
      }
    }
    
    console.log('Found stream key record:', streamKeyRecord);

    // Delete the stream key record
    const deleteParams = {
      TableName: 'Twilly',
      Key: {
        PK: streamKeyRecord.PK,
        SK: streamKeyRecord.SK
      }
    }

    const result = await dynamodb.delete(deleteParams).promise()

    console.log('Stream key deleted successfully:', {
      streamKey,
      userEmail
    })

    return {
      success: true,
      message: 'Stream key deleted successfully',
      data: {
        streamKey,
        deletedAt: new Date().toISOString()
      }
    }

  } catch (error) {
    console.error('Error deleting stream key:', error)
    return {
      success: false,
      message: 'Failed to delete stream key',
      error: error.message
    }
  }
}) 