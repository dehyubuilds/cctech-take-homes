// Resolver for myChannels query
// Returns channels owned by a specific user
// This is a Lambda resolver - deploy as Lambda function and use as AppSync data source

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  console.log('myChannels resolver:', JSON.stringify(event, null, 2));
  
  const { creatorEmail } = event.arguments || {};
  
  if (!creatorEmail) {
    throw new Error('Missing required field: creatorEmail');
  }
  
  const tableName = 'Twilly';
  
  try {
    // Scan for channels owned by this user
    const params = {
      TableName: tableName,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'CHANNEL#',
        ':sk': 'OWNER'
      }
    };
    
    const result = await dynamodb.scan(params).promise();
    
    // Filter for channels owned by this user
    const userChannels = (result.Items || [])
      .filter(channel => {
        const channelId = channel.PK.replace('CHANNEL#', '');
        return channelId.startsWith(`${creatorEmail}-`);
      });
    
    // Get metadata for each channel
    const channelsWithMetadata = await Promise.all(
      userChannels.map(async (channel) => {
        const channelId = channel.PK.replace('CHANNEL#', '');
        
        // Get metadata
        const metadataResult = await dynamodb.get({
          TableName: tableName,
          Key: {
            PK: channel.PK,
            SK: 'METADATA'
          }
        }).promise();
        
        const metadata = metadataResult.Item || {};
        
        // Get latest video for poster (if available) - query files in this channel
        let posterUrl = null;
        try {
          // Query for videos in this channel (matching folderName or seriesName)
          const channelName = channel.channelName || channel.series;
          if (channelName) {
            const videosResult = await dynamodb.query({
              TableName: tableName,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
              FilterExpression: '(folderName = :channelName OR seriesName = :channelName) AND category = :category AND isVisible <> :false',
              ExpressionAttributeValues: {
                ':pk': `USER#${creatorEmail}`,
                ':sk': 'FILE#',
                ':channelName': channelName,
                ':category': 'Videos',
                ':false': false
              },
              Limit: 1,
              ScanIndexForward: false // Get most recent
            }).promise();
            
            if (videosResult.Items && videosResult.Items.length > 0) {
              const latestVideo = videosResult.Items[0];
              posterUrl = latestVideo.thumbnailUrl || null;
            }
          }
        } catch (error) {
          console.error('Error fetching poster for channel:', channelId, error);
        }
        
        return {
          channelId: channelId,
          channelName: channel.channelName || channel.series,
          visibility: metadata.visibility || 'private',
          subscriptionPrice: metadata.subscriptionPrice || 0,
          description: metadata.description || '',
          category: metadata.category || channel.category || 'Mixed',
          posterUrl: posterUrl,
          createdAt: channel.createdAt || metadata.createdAt,
          updatedAt: channel.updatedAt || metadata.updatedAt,
          creatorUsername: metadata.creatorUsername || channel.creatorUsername || creatorEmail
        };
      })
    );
    
    // Sort by updatedAt (most recent first)
    channelsWithMetadata.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return channelsWithMetadata;
  } catch (error) {
    console.error('Error in myChannels resolver:', error);
    throw error;
  }
};

