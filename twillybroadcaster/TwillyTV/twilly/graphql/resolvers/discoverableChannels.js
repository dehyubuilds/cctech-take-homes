// Resolver for discoverableChannels query
// Returns public and searchable channels
// This is a Lambda resolver - deploy as Lambda function and use as AppSync data source

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  console.log('discoverableChannels resolver:', JSON.stringify(event, null, 2));
  
  const { limit = 50, nextToken } = event.arguments || {};
  const tableName = 'Twilly';
  
  try {
    // Scan for channels with METADATA SK
    const params = {
      TableName: tableName,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'CHANNEL#',
        ':sk': 'METADATA'
      },
      Limit: limit
    };
    
    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }
    
    const result = await dynamodb.scan(params).promise();
    
    // Filter for public and searchable channels
    const channels = (result.Items || [])
      .filter(channel => {
        const visibility = channel.visibility || 'private';
        return visibility === 'public' || visibility === 'searchable';
      })
      .map(channel => {
        const channelId = channel.PK.replace('CHANNEL#', '');
        const channelIdParts = channelId.split('-');
        const creatorEmail = channelIdParts[0];
        
        return {
          channelId: channelId,
          channelName: channel.channelName || '',
          creatorEmail: channel.creatorEmail || creatorEmail,
          creatorUsername: channel.creatorUsername || creatorEmail.split('@')[0],
          description: channel.description || '',
          posterUrl: channel.posterUrl || '',
          visibility: channel.visibility || 'private',
          isPublic: channel.isPublic || (channel.visibility === 'public'),
          subscriptionPrice: channel.subscriptionPrice || null,
          contentType: channel.category || null
        };
      });
    
    // Get next token if there are more items
    let nextTokenResult = null;
    if (result.LastEvaluatedKey) {
      nextTokenResult = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }
    
    return {
      channels: channels,
      nextToken: nextTokenResult
    };
  } catch (error) {
    console.error('Error in discoverableChannels resolver:', error);
    throw error;
  }
};
