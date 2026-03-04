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
  const { shortId } = body;

  if (!shortId) {
    return {
      error: 'Short ID is required'
    };
  }

  console.log('[Share Content API] Loading content for shortId:', shortId);

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
    console.log('[Share Content API] DynamoDB result:', result);

    if (!result.Item) {
      return {
        error: 'Content not found'
      };
    }

    const item = result.Item;
    const { longUrl, creator, series, email, originalEmail, originalSeries, originalPosterUrl, title: storedTitle, description: storedDescription } = item;

    console.log('[Share Content API] Found mapping:', { longUrl, creator, series, email, originalEmail, originalSeries });

    // Use the stored metadata or fallback values
    let title = storedTitle || series || 'Exclusive Content';
    let description = storedDescription || `Check out this menu from ${series}`;
    let posterUrl = originalPosterUrl || 'https://d4idc5cmwxlpy.cloudfront.net/Screenshot+2025-07-04+at+10.13.36%E2%80%AFPM.png';
    let userEmail = email || originalEmail;

    // If we have user email and series, load the menu content
    if (userEmail && series) {
      try {
        console.log('[Share Content API] Using email:', userEmail);

        // Call the menu-items API to get the content
        const menuItemsUrl = `/api/menu-items?email=${encodeURIComponent(userEmail)}&series=${encodeURIComponent(series)}`;
        console.log('[Share Content API] Calling menu items API:', menuItemsUrl);
        
        const menuResponse = await fetch(menuItemsUrl);
        
        if (!menuResponse.ok) {
          throw new Error('Failed to fetch menu items');
        }

        const menuData = await menuResponse.json();
        console.log('[Share Content API] Menu data:', menuData);

        // Filter out .jpg/.jpeg files
        const filteredItems = menuData.filter(item => {
          const url = item.url || '';
          const fileName = item.fileName || item.title || '';
          
          if (url.includes('.jpg') || url.includes('.jpeg') || 
              fileName.includes('.jpg') || fileName.includes('.jpeg')) {
            return false;
          }
          return true;
        });

        console.log('[Share Content API] Filtered items:', filteredItems.length);

        return {
          title,
          description,
          posterUrl,
          items: filteredItems,
          longUrl: longUrl
        };

      } catch (error) {
        console.error('[Share Content API] Error loading menu content:', error);
        return {
          error: 'Failed to load menu content',
          details: error.message
        };
      }
    } else {
      // Return basic metadata even if no menu items
      return {
        title,
        description,
        posterUrl,
        items: [],
        longUrl: longUrl
      };
    }

  } catch (error) {
    console.error('[Share Content API] Error:', error);
    return {
      error: 'Failed to load content',
      details: error.message
    };
  }
}); 