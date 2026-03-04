const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse the request body
    const body = JSON.parse(event.body);
    const { email, series } = body;
    
    console.log('Request parameters:', { email, series });
    
    if (!email || !series) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Email and series are required'
        })
      };
    }
    
    // Query for menu items by email and folderName (series)
    // Files are stored with SK starting with "FILE#", not category prefixes
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'FILE#'
      }
    };
    
    console.log('Querying for files with params:', JSON.stringify(params));
    
    try {
      const result = await dynamoDb.query(params).promise();
      
      console.log(`Query returned ${result.Items ? result.Items.length : 0} total items`);
      
      if (result.Items && result.Items.length > 0) {
        // Filter for files in this channel and only visible content
        const channelFiles = result.Items.filter(file => {
          const fileChannelName = file.folderName || file.seriesName;
          const matchesChannel = fileChannelName === series;
          const isVisible = file.isVisible === true; // Only show visible content
          const hasContent = file.fileName && !file.isFolder;
          
          // Debug logging for matching files
          if (matchesChannel) {
            console.log(`Found matching channel file: ${file.fileName}, category: ${file.category}, isVisible: ${isVisible}, hasHlsUrl: ${!!file.hlsUrl}, isFolder: ${!!file.isFolder}`);
          }
          
          // For videos, must have HLS URL
          if (file.category === 'Videos' && !file.hlsUrl) {
            if (matchesChannel) {
              console.log(`Excluding video without HLS URL: ${file.fileName}`);
            }
            return false;
          }
          
          return matchesChannel && isVisible && hasContent;
        });
        
        console.log(`Filtered ${channelFiles.length} visible files for channel ${series}`);
        
        // Transform the items to match the expected format
        const menuItems = channelFiles.map(item => ({
          SK: item.SK,
          title: item.title || item.fileName || 'Untitled',
          description: item.description || '',
          url: item.url || item.hlsUrl || '',
          thumbnailUrl: item.thumbnailUrl || '',
          price: item.price || 0,
          category: item.category || 'videos',
          fileName: item.fileName || ''
        }));
        
        // Sort by creation date (newest first)
        menuItems.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        console.log(`Returning ${menuItems.length} menu items`);
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify(menuItems)
        };
      } else {
        console.log('No items found in query result');
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
          },
          body: JSON.stringify([])
        };
      }
    } catch (error) {
      console.error('Error querying files:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error.message
        })
      };
    }
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}; 