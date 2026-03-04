import AWS from 'aws-sdk';

// Use hardcoded credentials for production compatibility
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  let username, series, trailerUrl = null;
  try {
    const body = await readBody(event);
    ({ username, series } = body || {});

    if (!username || !series) {
      throw createError({ statusCode: 400, statusMessage: 'username and series are required' });
    }

    console.log(`[get-share-params] Looking up share params for username: ${username}, series: ${series}`);

    // 1) Resolve email by username (case-insensitive scan)
    let email = null;
    let resolvedUsername = null;
    try {
      const userScanParams = {
        TableName: 'Twilly',
        FilterExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'USER' }
      };
      const userResult = await dynamoDb.scan(userScanParams).promise();
      if (userResult.Items && userResult.Items.length > 0) {
        const target = String(username || '').toLowerCase();
        const match = userResult.Items.find(u => String(u.username || '').toLowerCase() === target);
        if (match) {
          email = match.email;
          resolvedUsername = match.username;
          console.log(`[get-share-params] Found email for username ${username}: ${email}`);
        } else {
          console.log(`[get-share-params] No user found for username: ${username}`);
        }
      }
    } catch (err) {
      console.error('[get-share-params] Error finding user by username:', err);
    }

    // 2) Find folder for this series to get poster URL (case-insensitive match, preserve exact casing)
    let originalPosterUrl = null;
    let originalEmail = email || null;
    let resolvedSeriesName = series;
    
    if (email) {
      const slugify = (value) => {
        if (!value) return '';
        return String(value)
          .trim()
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };
      const providedSlug = slugify(series);
      console.log(`[get-share-params] Original series: "${series}", providedSlug: "${providedSlug}"`);
      // First try exact match across categories (fast path)
      const categories = ['Mixed', 'Videos', 'Images', 'Audios', 'Docs'];
      let foundFolder = null;
      for (const category of categories) {
        try {
          const folderParams = {
            TableName: 'Twilly',
            KeyConditionExpression: 'PK = :pk AND SK = :sk',
            ExpressionAttributeValues: {
              ':pk': `USER#${email}`,
              ':sk': `FOLDER#${category}#${series}`
            }
          };
          console.log(`[get-share-params] Searching exact folder: PK=${folderParams.ExpressionAttributeValues[':pk']}, SK=${folderParams.ExpressionAttributeValues[':sk']}`);
          const folderResult = await dynamoDb.query(folderParams).promise();
          if (folderResult.Items && folderResult.Items.length > 0) {
            foundFolder = folderResult.Items[0];
            break;
          }
        } catch (err) {
          console.error(`[get-share-params] Error querying category ${category}:`, err);
        }
      }

      // If not found, scan all folders for this user and match series name case-insensitively
      if (!foundFolder) {
        try {
          // First try regular folders
          const folderScanParams = {
            TableName: 'Twilly',
            FilterExpression: 'PK = :pk AND begins_with(SK, :folderPrefix)',
            ExpressionAttributeValues: {
              ':pk': `USER#${email}`,
              ':folderPrefix': 'FOLDER#'
            }
          };
          const folderScanResult = await dynamoDb.scan(folderScanParams).promise();
          if (folderScanResult.Items && folderScanResult.Items.length > 0) {
            foundFolder = folderScanResult.Items.find(item => {
              const sk = item.SK || '';
              const name = sk.split('#').pop();
              // Handle both hyphen and space formats for matching
              const slugifiedName = slugify(name);
              const normalizedProvidedSlug = providedSlug.replace(/\s+/g, '-');
              const normalizedProvidedSlugWithSpaces = providedSlug.replace(/-/g, ' ');
              
              // Try multiple matching strategies
              return slugifiedName === normalizedProvidedSlug || 
                     slugifiedName === providedSlug ||
                     slugify(normalizedProvidedSlugWithSpaces) === slugifiedName ||
                     name.toLowerCase() === providedSlug.toLowerCase() ||
                     name.toLowerCase() === normalizedProvidedSlugWithSpaces.toLowerCase();
            }) || null;
          }
          
          // If still not found, try collaboration folders
          if (!foundFolder) {
            const collabScanParams = {
              TableName: 'Twilly',
              FilterExpression: 'PK = :pk AND begins_with(SK, :folderPrefix)',
              ExpressionAttributeValues: {
                ':pk': `USER#${email}`,
                ':folderPrefix': 'COLLAB#'
              }
            };
            const collabScanResult = await dynamoDb.scan(collabScanParams).promise();
            if (collabScanResult.Items && collabScanResult.Items.length > 0) {
              foundFolder = collabScanResult.Items.find(item => {
                const sk = item.SK || '';
                const name = sk.split('#').pop();
                // Handle both hyphen and space formats for matching
                const slugifiedName = slugify(name);
                const normalizedProvidedSlug = providedSlug.replace(/\s+/g, '-');
                const normalizedProvidedSlugWithSpaces = providedSlug.replace(/-/g, ' ');
                
                // Try multiple matching strategies
                return slugifiedName === normalizedProvidedSlug || 
                       slugifiedName === providedSlug ||
                       slugify(normalizedProvidedSlugWithSpaces) === slugifiedName ||
                       name.toLowerCase() === providedSlug.toLowerCase() ||
                       name.toLowerCase() === normalizedProvidedSlugWithSpaces.toLowerCase();
              }) || null;
              
              if (foundFolder) {
                console.log(`[get-share-params] Found collaboration folder: ${foundFolder.SK}`);
                console.log(`[get-share-params] Collaboration folder seriesPosterUrl: ${foundFolder.seriesPosterUrl}`);
              }
            }
          }
          
          // If still not found, try collaboration folders with undefined category
          if (!foundFolder) {
            const collabUndefinedScanParams = {
              TableName: 'Twilly',
              FilterExpression: 'PK = :pk AND begins_with(SK, :folderPrefix)',
              ExpressionAttributeValues: {
                ':pk': `USER#${email}`,
                ':folderPrefix': 'COLLAB#undefined#'
              }
            };
            const collabUndefinedScanResult = await dynamoDb.scan(collabUndefinedScanParams).promise();
            if (collabUndefinedScanResult.Items && collabUndefinedScanResult.Items.length > 0) {
              console.log(`[get-share-params] Checking ${collabUndefinedScanResult.Items.length} collaboration folders with undefined category`);
              collabUndefinedScanResult.Items.forEach(item => {
                console.log(`[get-share-params] - Checking folder: ${item.SK}, name: "${item.SK.split('#').pop()}"`);
              });
              foundFolder = collabUndefinedScanResult.Items.find(item => {
                const sk = item.SK || '';
                const name = sk.split('#').pop();
                // Handle both hyphen and space formats for matching
                const slugifiedName = slugify(name);
                const normalizedProvidedSlug = providedSlug.replace(/\s+/g, '-');
                const normalizedProvidedSlugWithSpaces = providedSlug.replace(/-/g, ' ');
                
                // Try multiple matching strategies
                return slugifiedName === normalizedProvidedSlug || 
                       slugifiedName === providedSlug ||
                       slugify(normalizedProvidedSlugWithSpaces) === slugifiedName ||
                       name.toLowerCase() === providedSlug.toLowerCase() ||
                       name.toLowerCase() === normalizedProvidedSlugWithSpaces.toLowerCase();
              }) || null;
              
              if (foundFolder) {
                console.log(`[get-share-params] Found collaboration folder with undefined: ${foundFolder.SK}`);
                console.log(`[get-share-params] Collaboration folder seriesPosterUrl: ${foundFolder.seriesPosterUrl}`);
              }
            }
          }
        } catch (err) {
          console.error('[get-share-params] Fallback scan error:', err);
        }
      }

      if (foundFolder) {
        // Preserve the exact series casing from folder SK
        const sk = foundFolder.SK || '';
        resolvedSeriesName = sk.split('#').pop() || series;
        console.log(`[get-share-params] Found folder: ${sk}`);
        console.log(`[get-share-params] Folder fields:`, Object.keys(foundFolder));
        console.log(`[get-share-params] seriesPosterUrl field:`, foundFolder.seriesPosterUrl);
        console.log(`[get-share-params] MenuPoster field:`, foundFolder.MenuPoster);
        
        // Handle both string and DynamoDB attribute object formats
        let seriesPosterUrl = foundFolder.seriesPosterUrl;
        if (seriesPosterUrl && typeof seriesPosterUrl === 'object' && seriesPosterUrl.S) {
          seriesPosterUrl = seriesPosterUrl.S;
        }
        
        let menuPoster = foundFolder.MenuPoster;
        if (menuPoster && typeof menuPoster === 'object' && menuPoster.S) {
          menuPoster = menuPoster.S;
        }
        
        originalPosterUrl = seriesPosterUrl || menuPoster || null;
        if (originalPosterUrl) {
          if (originalPosterUrl.includes('d4idc5cmwxlpy.cloudfront.net')) {
            originalPosterUrl = originalPosterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
          }
          if (!originalPosterUrl.includes('/public/')) {
            originalPosterUrl = originalPosterUrl.replace('/series-posters/', '/public/series-posters/');
          }
          console.log(`[get-share-params] Using poster URL: ${originalPosterUrl}`);
        }
      }
    }

    // If no poster found, use a default
    if (!originalPosterUrl) {
      originalPosterUrl = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
      console.log(`[get-share-params] No poster found, using default: ${originalPosterUrl}`);
    }

    // Try to get the actual description from series metadata
    let description = `Check out this series from ${resolvedUsername || username}`;
    
    if (email && resolvedSeriesName) {
      try {
        // Look for series metadata to get the actual description
        const seriesId = `${email}-${resolvedSeriesName}`;
        const seriesParams = {
          TableName: 'Twilly',
          Key: {
            PK: `SERIES#${seriesId}`,
            SK: 'METADATA'
          }
        };
        
        console.log(`[get-share-params] Looking for series metadata: PK=${seriesParams.Key.PK}, SK=${seriesParams.Key.SK}`);
        const seriesResult = await dynamoDb.get(seriesParams).promise();
        
        if (seriesResult.Item && seriesResult.Item.description) {
          description = seriesResult.Item.description;
          console.log(`[get-share-params] Found actual description: ${description}`);
        } else {
          console.log(`[get-share-params] No description found in metadata, using default`);
        }
        
        // Get trailer URL if available
        if (seriesResult.Item && seriesResult.Item.trailerUrl) {
          trailerUrl = seriesResult.Item.trailerUrl;
          console.log(`[get-share-params] Found trailerUrl: ${trailerUrl}`);
        }
      } catch (err) {
        console.error('[get-share-params] Error fetching series description:', err);
      }
    }
    
    const title = resolvedSeriesName;

    const result = {
      originalEmail,
      originalPosterUrl,
      resolvedUsername,
      title,
      description,
      trailerUrl,
      success: true
    };

    console.log(`[get-share-params] Returning result:`, result);
    return result;

  } catch (error) {
    console.error('[get-share-params] Error:', error);
    
    // Provide more specific error information
    let errorMessage = 'Failed to get share params';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    
    // Return a fallback response instead of throwing an error
    // This allows the page to still render with default values
    return {
      success: false,
      error: errorMessage,
      originalEmail: null,
      originalPosterUrl: 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg',
      resolvedUsername: username || 'Unknown',
      title: series || 'Unknown Series',
      description: `Check out this series from ${username || 'Unknown'}`,
      trailerUrl: null
    };
  }
}); 