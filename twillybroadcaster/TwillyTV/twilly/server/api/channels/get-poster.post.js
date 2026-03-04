import AWS from 'aws-sdk';

// Configure AWS with hardcoded credentials
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { channelName, creatorUsername } = body;

    if (!channelName) {
      return {
        success: false,
        message: 'Missing required field: channelName'
      };
    }

    let creatorEmail = creatorUsername;

    // If creatorUsername is a username (not email), look up the email
    if (creatorUsername && !creatorUsername.includes('@')) {
      try {
        const userResult = await dynamodb.get({
          TableName: 'Twilly',
          Key: {
            PK: `USER#${creatorUsername}`,
            SK: 'PROFILE'
          }
        }).promise();

        if (userResult.Item && userResult.Item.email) {
          creatorEmail = userResult.Item.email;
        }
      } catch (error) {
        console.error('Error looking up user email:', error);
      }
    }

    // Look for the series record
    let seriesRecord = null;
    
    if (creatorEmail) {
      // Try to find by creator email and channel name
      const seriesId = `${creatorEmail}-${channelName}`;
      try {
        const seriesResult = await dynamodb.get({
          TableName: 'Twilly',
          Key: {
            PK: `SERIES#${seriesId}`,
            SK: 'METADATA'
          }
        }).promise();
        
        if (seriesResult.Item) {
          seriesRecord = seriesResult.Item;
        }
      } catch (error) {
        console.error('Error fetching series metadata:', error);
      }
    }

    // If no series record found, try to find by channel name in files
    if (!seriesRecord) {
      try {
        // Query for files with this channel name
        const filesResult = await dynamodb.query({
          TableName: 'Twilly',
          IndexName: 'folderName-index', // You might need to create this GSI
          KeyConditionExpression: 'folderName = :folderName',
          ExpressionAttributeValues: {
            ':folderName': channelName
          },
          Limit: 1
        }).promise();

        if (filesResult.Items && filesResult.Items.length > 0) {
          const file = filesResult.Items[0];
          // Extract creator email from PK
          if (file.PK && file.PK.startsWith('USER#')) {
            creatorEmail = file.PK.replace('USER#', '');
          }
        }
      } catch (error) {
        console.error('Error querying files by folder name:', error);
      }
    }

    // Try to get poster from series metadata or files
    let posterUrl = null;
    
    if (seriesRecord && seriesRecord.posterUrl) {
      posterUrl = seriesRecord.posterUrl;
    } else if (creatorEmail) {
      // Look for poster files in the channel folder
      try {
        const posterResult = await dynamodb.query({
          TableName: 'Twilly',
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: 'folderName = :folderName AND (contains(fileName, :poster) OR contains(fileName, :thumbnail))',
          ExpressionAttributeValues: {
            ':pk': `USER#${creatorEmail}`,
            ':folderName': channelName,
            ':poster': 'poster',
            ':thumbnail': 'thumb'
          }
        }).promise();

        if (posterResult.Items && posterResult.Items.length > 0) {
          // Find the best poster/thumbnail
          const posterFile = posterResult.Items.find(item => 
            item.fileName && (item.fileName.includes('poster') || item.fileName.includes('thumb'))
          );
          
          if (posterFile && posterFile.url) {
            posterUrl = posterFile.url;
          }
        }
      } catch (error) {
        console.error('Error querying poster files:', error);
      }
    }

    // If still no poster, try to construct a default poster path
    if (!posterUrl && creatorEmail) {
      // This would be the same logic as your getChannelPosterUrlWithLocalAsset function
      posterUrl = `https://twillyinputbucket.s3.us-east-1.amazonaws.com/${creatorEmail}/videos/${encodeURIComponent(channelName)}/poster.jpg`;
    }

    return {
      success: true,
      message: 'Channel poster retrieved successfully',
      posterUrl,
      channelName,
      creatorEmail
    };

  } catch (error) {
    console.error('Error getting channel poster:', error);
    return {
      success: false,
      message: 'Failed to get channel poster',
      error: error.message
    };
  }
});
