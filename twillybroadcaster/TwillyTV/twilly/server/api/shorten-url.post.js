import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { url, creator, series } = body;

    console.log('[Shorten URL API] Received request:', { url, creator, series });

    if (!url) {
      throw createError({
        statusCode: 400,
        message: 'URL is required'
      });
    }

    // For clean URLs, we need creator and series
    if (!creator || !series) {
      throw createError({
        statusCode: 400,
        message: 'Creator and series are required for clean URLs'
      });
    }

    // Configure AWS SDK
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamoDb = new AWS.DynamoDB.DocumentClient({
      region: 'us-east-1'
    });

    // Generate a short ID
    const shortId = Math.random().toString(36).substring(2, 8);
    const timestamp = new Date().toISOString();

    // Parse the original URL to extract the parameters we need
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    
    // Check if this is a talent request URL
    const isTalentRequest = url.includes('/talent-request/');
    
    if (isTalentRequest) {
      // Handle talent request URLs
      // Extract parameters from talent request URL structure:
      // /talent-request/{creatorUsername}/{channelName}?rid={id}&title={title}&description={description}
      const creatorUsername = pathParts[2]; // The creator username from the URL
      const channelName = pathParts[3]; // The channel name from the URL
      
      // Get query parameters
      const rid = urlObj.searchParams.get('rid') || '';
      const title = urlObj.searchParams.get('title') || '';
      const description = urlObj.searchParams.get('description') || '';
      
      // Store the mapping in the Twilly DynamoDB table for talent request redirects
      const shortUrlParams = {
        TableName: 'Twilly',
        Item: {
          PK: 'SHORT_URL',
          SK: shortId,
          longUrl: url, // Store the original URL
          creator: creatorUsername, // This is what the lambda needs
          series: channelName, // This is what the lambda needs
          title: title,
          description: description,
          rid: rid, // Store the request ID for direct access
          createdAt: timestamp,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          type: 'short_url',
          urlType: 'talent_request'
        }
      };

      // Store the short URL
      try {
        await dynamoDb.put(shortUrlParams).promise();
        console.log('✅ Talent request short URL stored successfully in DynamoDB');
      } catch (dbError) {
        console.error('❌ DynamoDB error:', dbError);
        throw createError({
          statusCode: 500,
          message: `Database error: ${dbError.message}`
        });
      }
      
      console.log('✅ Talent request short URL stored with:', {
        creator: creatorUsername,
        series: channelName,
        rid: rid,
        shortId: shortId
      });

      // Return the short URL
      return {
        success: true,
        shortId: shortId,
        returnResult: `https://share.twilly.app/s/${shortId}`,
        message: 'Talent request URL shortened successfully'
      };
    } else {
      // Handle regular share URLs (existing logic)
      // Extract parameters from the original URL structure:
      // /menu/share/{email}/{series}/{posterUrl}
      const originalEmail = pathParts[3]; // The email from the original URL
      const originalSeries = pathParts[4]; // The series from the original URL
      const originalPosterUrl = pathParts.slice(5).join('/'); // The poster URL path
      
      // Get query parameters
      const title = urlObj.searchParams.get('title') || '';
      const description = urlObj.searchParams.get('description') || '';
      
      // Store the mapping in the Twilly DynamoDB table
      // We store the original messy URL as the longUrl so the redirect system works
      const cleanUrl = `https://share.twilly.app/c/${creator}/${series}`;
      
      // Convert localhost URLs to production URLs
      let productionUrl = url;
      if (url.includes('localhost:3000')) {
        productionUrl = url.replace('http://localhost:3000', 'https://twilly.app');
      }
      
      // Create the main short URL entry
      const shortUrlParams = {
        TableName: 'Twilly',
        Item: {
          PK: 'SHORT_URL',
          SK: shortId,
          longUrl: productionUrl, // Use production URL for redirects
          originalUrl: url, // Keep the original messy URL for reference
          creator: creator,
          series: series,
          // Store the original parameters for the share page
          originalEmail: originalEmail,
          originalSeries: originalSeries,
          originalPosterUrl: originalPosterUrl,
          title: title,
          description: description,
          createdAt: timestamp,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          type: 'short_url',
          urlType: 'share'
        }
      };

      // Also create a lookup entry by username/series for direct access
      const lookupParams = {
        TableName: 'Twilly',
        Item: {
          PK: 'SHARE_PARAMS',
          SK: `${creator}#${series}`,
          originalEmail: originalEmail,
          originalSeries: originalSeries,
          originalPosterUrl: originalPosterUrl,
          title: title,
          description: description,
          creator: creator,
          series: series,
          createdAt: timestamp,
          type: 'share_params'
        }
      };

      // Store both entries
      try {
        await dynamoDb.put(shortUrlParams).promise();
        await dynamoDb.put(lookupParams).promise();
        console.log('✅ Share URL entries stored successfully in DynamoDB');
      } catch (dbError) {
        console.error('❌ DynamoDB error:', dbError);
        throw createError({
          statusCode: 500,
          message: `Database error: ${dbError.message}`
        });
      }

      // Return the short URL
      return {
        success: true,
        shortId: shortId,
        returnResult: cleanUrl,
        message: 'URL shortened successfully'
      };
    }
  } catch (error) {
    console.error('Error shortening URL:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to shorten URL'
    });
  }
}); 