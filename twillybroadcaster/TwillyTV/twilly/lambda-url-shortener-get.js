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
    console.log('Item longUrl:', item.longUrl);
    console.log('Item creator:', item.creator);
    console.log('Item series:', item.series);
    
    // Check if this is a direct channel URL (like /username/channel-slug) - redirect directly
    if (item.longUrl && !item.longUrl.includes('/menu/') && !item.longUrl.includes('/collaborator/') && 
        !item.longUrl.includes('/casting-director/') && !item.longUrl.includes('/talent-request/') &&
        !item.longUrl.includes('/collaborator-request/') && !item.longUrl.includes('/channel/')) {
      console.log('Detected direct channel URL, redirecting directly to longUrl');
      return {
        statusCode: 302,
        headers: {
          'Location': item.longUrl,
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }
    
    // Check if this is a collaborator URL, series share URL, or collaborator request URL by looking at the longUrl
    if (item.longUrl && (item.longUrl.includes('/collaborator/') || item.longUrl.includes('/channel/collab/') || item.longUrl.includes('/collaborator-request/'))) {
      console.log('Detected collaborator, series share, or collaborator request URL, redirecting directly to longUrl');
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
      console.log('Detected casting director URL, redirecting directly to casting director page');
      // Redirect directly to the casting director page - the page has useHead implementation
      return {
        statusCode: 302,
        headers: {
          'Location': item.longUrl,
          'Access-Control-Allow-Origin': '*'
        },
        body: ''
      };
    }
    
    // Handle talent request URLs - redirect to page like other URLs
    if (item.longUrl && item.longUrl.includes('/talent-request/')) {
      console.log('Detected talent request URL, redirecting to talent request page');
      console.log('Item data:', { creator: item.creator, series: item.series, title: item.title, description: item.description });
      console.log('Original longUrl:', item.longUrl);
      console.log('Checking for rid parameter in longUrl...');
      
      // Define domain for talent request redirects
      const domain = 'https://twilly.app';
      
      // Extract creator and series from the stored data
      const rawCreator = item.creator || '';
      const creator = rawCreator.includes('@') ? rawCreator.split('@')[0] : rawCreator;
      const series = item.series;
      
      // Check if we have the required data
      if (!creator || !series) {
        console.log('Missing creator or series for talent request URL');
        console.log('Item full data:', item);
        
        // Fallback: try to extract from the longUrl itself
        const urlParts = item.longUrl.split('/talent-request/');
        if (urlParts.length > 1) {
          const slug = urlParts[1].split('?')[0]; // Remove query parameters
          console.log('Extracted slug from longUrl:', slug);
          
          if (slug && slug.includes('/')) {
            const [extractedCreator, extractedSeries] = slug.split('/');
            console.log('Extracted from URL:', { extractedCreator, extractedSeries });
            
            // Use extracted values if stored values are missing
            const finalCreator = creator || extractedCreator;
            const finalSeries = series || extractedSeries;
            
            if (finalCreator && finalSeries) {
              // Use the stored title and description if available
              const title = item.title || finalSeries;
              const description = item.description || `Submit your interest in collaborating on ${finalSeries}`;
              
                    // Extract rid from the original URL if present
      let rid = null;
      if (item.longUrl && item.longUrl.includes('rid=')) {
        const urlObj = new URL(item.longUrl);
        rid = urlObj.searchParams.get('rid');
      }
      
      // Build the query parameters - include rid if available
      const encodedTitle = encodeURIComponent ? encodeURIComponent(title) : title;
      const encodedDescription = encodeURIComponent ? encodeURIComponent(description) : description;
      let queryParams = `title=${encodedTitle}&description=${encodedDescription}`;
      
      // CRITICAL: Always include rid if available for proper talent request loading
      if (rid) {
        queryParams += `&rid=${encodeURIComponent(rid)}`;
        console.log('Including rid in query params:', rid);
      } else {
        console.log('No rid found in original URL');
      }
      
      // Redirect to the talent request page with the slug
      const sanitizedCreator = (finalCreator || '').includes('@') ? finalCreator.split('@')[0] : finalCreator;
      const encodedCreator = encodeURIComponent(sanitizedCreator);
      const encodedSeries = encodeURIComponent(finalSeries);
      
      // Use the same structure as regular share URLs: /talent-request/{creator}/{series}/{poster}?{queryParams}
      // Get the channel poster URL for consistent branding
      let posterUrl = 'default';
      if (item.originalPosterUrl) {
        posterUrl = item.originalPosterUrl;
        // Fix the poster URL to use the working CloudFront domain
        posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
        // Ensure it has the /public/ prefix like the working URL
        if (!posterUrl.includes('/public/')) {
          posterUrl = posterUrl.replace('/series-posters/', '/public/series-posters/');
        }
        posterUrl = encodeURIComponent(posterUrl);
        console.log('Using poster URL for talent request redirect:', posterUrl);
      }
      
      // Build redirect URL with poster in path (same structure as menu/share URLs)
      let redirectUrl;
      if (posterUrl !== 'default') {
        redirectUrl = `${domain}/talent-request/${encodedCreator}/${encodedSeries}/${posterUrl}?${queryParams}`;
      } else {
        redirectUrl = `${domain}/talent-request/${encodedCreator}/${encodedSeries}?${queryParams}`;
      }
              
                    console.log('Redirecting talent request to:', redirectUrl);
      console.log('Final query params:', queryParams);
      console.log('RID included:', rid ? 'YES' : 'NO');
      
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
            }
          }
        }
        
        // If we still can't extract the data, redirect to default page
        console.log('Could not extract creator/series, redirecting to default page');
        const defaultUrl = `${domain}/talent-request/default/${slug || 'unknown'}`;
        return {
          statusCode: 302,
          headers: {
            'Location': defaultUrl,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: ''
        };
      }
      
      // Use the stored title and description if available
      const title = item.title || series;
      const description = item.description || `Submit your interest in collaborating on ${series}`;
      
      // Extract rid from the original URL if present
      let rid = null;
      if (item.longUrl && item.longUrl.includes('rid=')) {
        const urlObj = new URL(item.longUrl);
        rid = urlObj.searchParams.get('rid');
      }
      
      // Build the query parameters - include rid if available
      const encodedTitle = encodeURIComponent ? encodeURIComponent(title) : title;
      const encodedDescription = encodeURIComponent ? encodeURIComponent(description) : description;
      let queryParams = `title=${encodedTitle}&description=${encodedDescription}`;
      
      // CRITICAL: Always include rid if available for proper talent request loading
      if (rid) {
        queryParams += `&rid=${encodeURIComponent(rid)}`;
        console.log('Including rid in query params:', rid);
      } else {
        console.log('No rid found in original URL');
      }
      
      // Redirect to the talent request page with the slug
      const encodedCreator = encodeURIComponent(creator);
      const encodedSeries = encodeURIComponent(series);
      
      // Use the same structure as regular share URLs: /talent-request/{creator}/{series}/{poster}?{queryParams}
      // Get the channel poster URL for consistent branding
      let posterUrl = 'default';
      if (item.originalPosterUrl) {
        posterUrl = item.originalPosterUrl;
        // Fix the poster URL to use the working CloudFront domain
        posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
        // Ensure it has the /public/ prefix like the working URL
        if (!posterUrl.includes('/public/')) {
          posterUrl = posterUrl.replace('/series-posters/', '/public/series-posters/');
        }
        posterUrl = encodeURIComponent(posterUrl);
        console.log('Using poster URL for talent request redirect:', posterUrl);
      }
      
      // Build redirect URL with poster in path (same structure as menu/share URLs)
      let redirectUrl;
      if (posterUrl !== 'default') {
        redirectUrl = `${domain}/talent-request/${encodedCreator}/${encodedSeries}/${posterUrl}?${queryParams}`;
      } else {
        redirectUrl = `${domain}/talent-request/${encodedCreator}/${encodedSeries}?${queryParams}`;
      }
      
      console.log('Redirecting talent request to:', redirectUrl);
      console.log('Final query params:', queryParams);
      console.log('RID included:', rid ? 'YES' : 'NO');
      console.log('🔍 Lambda: Poster URL check:', { posterUrl, hasPoster: posterUrl !== 'default' });
      
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
    }
    
    // For talent request URLs, casting director URLs, and direct channel URLs, we don't need the creator field since we handle them specially
    // For other URLs (like menu/share URLs), check if creator exists
    if (!item.longUrl.includes('/talent-request/') && 
        !item.longUrl.includes('/casting-director/') && 
        !item.longUrl.includes('/menu/share/') &&
        !item.creator) {
      console.log('No creator found in item');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<h1>Invalid Link</h1><p>This link is missing required information.</p>'
      };
    }
    
    const creator = item.creator;
    const originalSeries = item.series;

    console.log('Found mapping:', { creator, originalSeries });
    console.log('Full item from DynamoDB:', item);
    console.log('Series field value:', item.series);
    console.log('OriginalSeries field value:', item.originalSeries);
    console.log('OriginalPosterUrl field value:', item.originalPosterUrl);
    console.log('🔍 Lambda: Item keys:', Object.keys(item));

    // Redirect to the old URL format with poster in the path (like the working version)
    // Use production domain
    const domain = 'https://twilly.app';
    
    // Determine the email to use in the URL
    let emailForUrl = null;
    
    // If the creator is already an email, use it
    if (creator.includes('@')) {
      emailForUrl = creator;
      console.log('Using creator as email (backward compatibility):', emailForUrl);
    } else {
      // Try to get the email from the stored email field
      if (item.email && item.email.includes('@')) {
        emailForUrl = item.email;
        console.log('Using stored email field:', emailForUrl);
      } else {
        // Fallback: try to query DynamoDB to find the user record
        try {
          // Query for user record by username
          const userParams = {
            TableName: 'Twilly',
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :gsi1sk',
            ExpressionAttributeValues: {
              ':gsi1pk': 'USERNAME',
              ':gsi1sk': creator
            }
          };
          
          const userResult = await dynamoDb.query(userParams).promise();
          console.log('User query result:', userResult);
          
          if (userResult.Items && userResult.Items.length > 0) {
            const userRecord = userResult.Items[0];
            emailForUrl = userRecord.PK.replace('USER#', '');
            console.log('Found email from user record:', emailForUrl);
          } else {
            // If no user record found, use the creator as fallback
            emailForUrl = creator;
            console.log('No user record found, using creator as fallback:', emailForUrl);
          }
        } catch (error) {
          console.error('Error querying for user email:', error);
          emailForUrl = creator;
          console.log('Error occurred, using creator as fallback:', emailForUrl);
        }
      }
    }
    
    const series = item.series || originalSeries;
    
    // Use the stored poster URL directly - this should be the full CloudFront URL
    let posterUrl = item.originalPosterUrl || 'default';
    console.log('Using poster URL from database:', posterUrl);
    
    // Fix the poster URL to use the working CloudFront domain
    if (posterUrl !== 'default') {
      // Replace the broken CloudFront domain with the working one
      posterUrl = posterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
      
      // Ensure it has the /public/ prefix like the working URL
      if (!posterUrl.includes('/public/')) {
        posterUrl = posterUrl.replace('/series-posters/', '/public/series-posters/');
      }
      
      console.log('Fixed poster URL to use working domain:', posterUrl);
      posterUrl = encodeURIComponent(posterUrl);
      console.log('URL-encoded poster URL:', posterUrl);
    }
    
    // Use the stored title and description if available, otherwise use series name
    const title = item.title || series;
    const description = item.description || `Check out this series from ${creator}`;
    
    // Build the query parameters - use simple encoding
    const encodedTitle = encodeURIComponent ? encodeURIComponent(title) : title;
    const encodedDescription = encodeURIComponent ? encodeURIComponent(description) : description;
    const queryParams = `title=${encodedTitle}&description=${encodedDescription}`;
    
    // Use the URL format with poster in the path (like the working version)
    let redirectUrl;
    if (posterUrl !== 'default') {
      redirectUrl = `${domain}/menu/share/${creator}/${series}/${posterUrl}?${queryParams}`;
    } else {
      redirectUrl = `${domain}/menu/share/${creator}/${series}?${queryParams}`;
    }
    
    console.log('Redirecting to:', redirectUrl);
    
    // Use HTTP 302 redirect instead of HTML page for better meta image handling
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