import crypto from 'crypto';
import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  // Read and parse the request body
  const body = await readBody(event);

  // Extract the URL and optional creator/series from the request body
  const originalUrl = body.url; // Access the URL directly
  const creator = body.creator || null;
  const series = body.series || null;
  const userEmail = body.userEmail || null; // Get user email from frontend

  if (!originalUrl) {
    console.error('URL not found in request body');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL not found' })
    };
  }

  console.log('=== NUXT API START ===');
  console.log('Received request:', { originalUrl, creator, series, userEmail });
  console.log('Body received:', body);
  console.log('Series parameter:', series);
  console.log('Creator parameter:', creator);
  console.log('User email parameter:', userEmail);

  try {
    // Generate a short ID
    const shortId = crypto.randomBytes(4).toString('hex');
    console.log('Generated short ID:', shortId);
    
    // Generate the short URL - use API Gateway URL like it was working before
    const shortUrl = `https://share.twilly.app/${shortId}`;
    console.log('Created short URL:', shortUrl);
    
    // Extract all parameters from the original URL if it's a menu share URL
    let email = null;
    let originalEmail = null;
    let originalSeries = null;
    let originalPosterUrl = null;
    let title = null;
    let description = null;
    
    // Check if this is a casting director URL and extract poster from query params
    if (originalUrl.includes('/casting-director/')) {
      try {
        console.log('=== CASTING DIRECTOR URL DETECTED ===');
        console.log('Original URL:', originalUrl);
        
        const urlObj = new URL(originalUrl);
        console.log('URL object:', urlObj);
        console.log('Search params:', urlObj.searchParams.toString());
        
        const posterParam = urlObj.searchParams.get('poster');
        console.log('Poster param from URL:', posterParam);
        
        if (posterParam) {
          originalPosterUrl = decodeURIComponent(posterParam);
          console.log('Extracted poster from casting director URL query params:', originalPosterUrl);
        } else {
          console.log('No poster parameter found in casting director URL');
        }
        
        title = urlObj.searchParams.get('title') || series;
        description = urlObj.searchParams.get('description') || `Join as a casting director for ${series}`;
        console.log('Extracted casting director query params:', { title, description, originalPosterUrl });
        console.log('=== END CASTING DIRECTOR URL PROCESSING ===');
      } catch (error) {
        console.error('Error parsing casting director URL:', error);
      }
    }
    
    // If we have creator and series, try to get the poster URL from the folder data
    // But only if we don't already have a poster URL from query parameters (e.g., casting director URLs)
    if (creator && series && userEmail && !originalPosterUrl) {
      try {
        console.log('Using user email from frontend for database query:', userEmail);
        
        // Now query for the folder data using the email - use the same logic as managefiles.vue
        // Try different category combinations since we don't know the exact category
        const categories = ['Mixed', 'Videos', 'Images', 'Audios', 'Docs'];
        let folderFound = false;
        
        for (const category of categories) {
          const folderParams = {
            TableName: 'Twilly',
            KeyConditionExpression: 'PK = :pk AND SK = :sk',
            ExpressionAttributeValues: {
              ':pk': `USER#${userEmail}`,
              ':sk': `FOLDER#${category}#${series}`
            }
          };
          
          console.log(`Trying category ${category} with SK: FOLDER#${category}#${series}`);
          
          const folderResult = await dynamoDb.query(folderParams).promise();
          console.log(`Folder query result for ${category}:`, folderResult);
          
          if (folderResult.Items && folderResult.Items.length > 0) {
            const folder = folderResult.Items[0];
            // Use the exact same field as managefiles.vue: folder.seriesPosterUrl
            originalPosterUrl = folder.seriesPosterUrl || 'default';
            console.log('Found poster URL from folder (same as managefiles.vue):', originalPosterUrl);
            
            // Log the full folder data like managefiles.vue does
            console.log('FULL FOLDER DATA:', folder);
            console.log('SERIES POSTER URL:', folder.seriesPosterUrl);
            folderFound = true;
            break;
          }
        }
        
        if (!folderFound) {
          console.log('No folder found for email:', userEmail, 'series:', series, 'in any category');
          originalPosterUrl = 'default';
        }
      } catch (error) {
        console.error('Error querying for poster URL:', error);
        originalPosterUrl = 'default';
      }
    } else if (!originalPosterUrl) {
      console.log('Missing required parameters for poster lookup:', { creator, series, userEmail });
      originalPosterUrl = 'default';
    }
    
    if (originalUrl.includes('/menu/share/')) {
      try {
        const urlObj = new URL(originalUrl);
        const pathParts = urlObj.pathname.split('/');
        
        // Handle both old and new URL formats
        if (pathParts.length >= 5) {
          const pathPart3 = decodeURIComponent(pathParts[3]);
          const pathPart4 = decodeURIComponent(pathParts[4]);
          
          // Check if pathPart3 looks like an email (contains @)
          if (pathPart3.includes('@')) {
            // Old format: /menu/share/email/series/poster
            originalEmail = pathPart3;
            originalSeries = pathPart4;
            originalPosterUrl = pathParts.slice(5).join('/');
            email = originalEmail;
            console.log('Extracted from old URL format:', { originalEmail, originalSeries, originalPosterUrl });
          } else {
            // New format: /menu/share/username/series
            const username = pathPart3;
            originalSeries = pathPart4;
            
            // Use the series parameter passed to the function, not the one from URL
            originalSeries = series || originalSeries;
            email = creator || username;
            
            console.log('Extracted from new URL format:', { username, originalSeries, email });
          }
        }
        
        // Extract from query parameters
        title = urlObj.searchParams.get('title') || series;
        description = urlObj.searchParams.get('description') || `Check out this series from ${creator}`;
        
        console.log('Extracted query params:', { title, description });
      } catch (error) {
        console.error('Error parsing URL:', error);
      }
    } else if (originalUrl.includes('/talent-request/')) {
      try {
        const urlObj = new URL(originalUrl);
        const pathParts = urlObj.pathname.split('/');
        
        // Handle talent request URL format: /talent-request/username/channel
        if (pathParts.length >= 4) {
          const username = decodeURIComponent(pathParts[2]);
          const channel = decodeURIComponent(pathParts[3]);
          
          console.log('Extracted from talent request URL format:', { username, channel });
          
          // Use the creator and series parameters passed to the function
          originalSeries = series || channel;
          email = creator || username;
          
          // Extract from query parameters
          title = urlObj.searchParams.get('title') || series;
          description = urlObj.searchParams.get('description') || `Submit your interest in collaborating on ${series}`;
          
          console.log('Extracted talent request query params:', { title, description });
        }
      } catch (error) {
        console.error('Error parsing talent request URL:', error);
      }
    }
    
    // Store the mapping in DynamoDB with all necessary data
    // Use the username (creator) for the redirect URL, but store the email for database queries
    const params = {
      TableName: 'Twilly',
      Item: {
        PK: 'SHORT_URL',
        SK: shortId,
        longUrl: originalUrl,
        creator: creator, // This is the username
        series: series,
        email: userEmail, // Store the email for database queries
        originalEmail: originalEmail,
        originalSeries: originalSeries,
        originalPosterUrl: originalPosterUrl,
        title: title,
        description: description,
        createdAt: new Date().toISOString(),
        clicks: 0
      }
    };
    

    
    console.log('=== STORING IN DYNAMODB ===');
    console.log('Series being stored:', series);
    console.log('Creator being stored:', creator);
    console.log('User email being stored:', userEmail);
    console.log('OriginalPosterUrl being stored:', originalPosterUrl);
    console.log('Full item being stored:', params.Item);
    
    try {
      await dynamoDb.put(params).promise();
      console.log('✅ Short URL mapping stored in DynamoDB');
    } catch (dbError) {
      console.error('❌ Error storing in DynamoDB:', dbError);
      // Continue even if DynamoDB storage fails
    }
    
    console.log('✅ Success! Returning short URL:', shortUrl);
    console.log('=== NUXT API END ===');
    return { returnResult: shortUrl };
    
  } catch (error) {
    console.error('❌ Error generating short URL:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.log('❌ Returning fallback URL:', originalUrl);
    console.log('=== NUXT API END ===');
    return {
      returnResult: originalUrl // Return original URL as fallback
    };
  }
});
