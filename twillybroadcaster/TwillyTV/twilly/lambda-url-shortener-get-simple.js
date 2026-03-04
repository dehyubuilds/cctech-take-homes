const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const shortId = event.pathParameters.shortId;
  
  console.log('Looking up shortId:', shortId);
  
  try {
    // Get the short URL mapping from DynamoDB
    const params = {
      TableName: 'Twilly',
      Key: {
        PK: 'SHORT_URL',
        SK: shortId
      }
    };

    const result = await dynamoDb.get(params).promise();
    console.log('DynamoDB result:', result);

    if (!result.Item) {
      console.log('No item found for shortId:', shortId);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<h1>Link not found</h1><p>The requested link does not exist or has expired.</p>'
      };
    }

    const item = result.Item;
    console.log('Found item:', item);
    
    // Check if this is a collaborator URL by looking at the longUrl
    if (item.longUrl && (item.longUrl.includes('/collaborator/') || item.longUrl.includes('/collaborator-request/'))) {
      console.log('Detected collaborator URL, redirecting directly to longUrl');
      return {
        statusCode: 302,
        headers: {
          'Location': item.longUrl,
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }
    
    // Check if this is a casting director URL by looking at the longUrl
    if (item.longUrl && item.longUrl.includes('/casting-director/')) {
      console.log('Detected casting director URL, redirecting directly to longUrl (same as collaborator)');
      // Redirect directly to the casting director page (same as collaborator URLs)
      // The casting director page now has proper useHead implementation
      return {
        statusCode: 302,
        headers: {
          'Location': item.longUrl,
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }
    
    // Simply redirect to the longUrl that's already stored with the correct format
    console.log('Redirecting to longUrl:', item.longUrl);
    
    // Replace localhost with production domain if needed
    let redirectUrl = item.longUrl;
    if (redirectUrl.includes('localhost:3000')) {
      redirectUrl = redirectUrl.replace('http://localhost:3000', 'https://twilly.app');
    }
    
    return {
      statusCode: 302,
      headers: {
        'Location': redirectUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: ''
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      },
      body: '<h1>Error</h1><p>An error occurred while processing your request.</p>'
    };
  }
}; 