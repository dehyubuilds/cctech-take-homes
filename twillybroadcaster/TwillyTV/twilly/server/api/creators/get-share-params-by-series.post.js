import AWS from 'aws-sdk';

// Use hardcoded credentials for production compatibility (SOC2 note: replace with IAM role in runtime)
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
  region: 'us-east-1'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { seriesSlug, series } = body || {};

    if (!seriesSlug && !series) {
      throw createError({ statusCode: 400, statusMessage: 'seriesSlug or series is required' });
    }

    const deslugify = (value) => {
      if (!value) return '';
      try {
        return decodeURIComponent(String(value)).replace(/-/g, ' ');
      } catch (_) {
        return String(value).replace(/-/g, ' ');
      }
    };

    const seriesName = series || deslugify(seriesSlug);
    const normalizedSlug = seriesName.toLowerCase().trim();

    // Master account email - check this first for efficiency
    const MASTER_EMAIL = 'dehyu.sinyan@gmail.com';
    const categories = ['Mixed', 'Videos', 'Images', 'Audios', 'Docs'];
    let foundFolder = null;

    // Helper function to normalize folder names for comparison (remove emojis, lowercase)
    const normalizeFolderName = (name) => {
      if (!name) return '';
      // Remove emojis and normalize
      return name.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE00}-\u{FE0F}]/gu, '').toLowerCase().trim();
    };

    // First, try exact match in master account
    for (const category of categories) {
      const desiredSk = `FOLDER#${category}#${seriesName}`;
      try {
        const folderParams = {
          TableName: 'Twilly',
          Key: {
            PK: `USER#${MASTER_EMAIL}`,
            SK: desiredSk
          }
        };
        const result = await dynamoDb.get(folderParams).promise();
        if (result.Item) {
          foundFolder = result.Item;
          console.log(`[get-share-params-by-series] Found folder in master account (exact match): ${desiredSk}`);
          break;
        }
      } catch (err) {
        console.error(`[get-share-params-by-series] Error querying master account for ${category}:`, err);
      }
    }

    // If not found, scan master account folders and match case-insensitively (handles emojis)
    if (!foundFolder) {
      console.log('[get-share-params-by-series] Not found with exact match, scanning master account folders...');
      try {
        const scanParams = {
          TableName: 'Twilly',
          FilterExpression: 'PK = :pk AND begins_with(SK, :folderPrefix)',
          ExpressionAttributeValues: {
            ':pk': `USER#${MASTER_EMAIL}`,
            ':folderPrefix': 'FOLDER#'
          }
        };
        const scanResult = await dynamoDb.scan(scanParams).promise();
        
        if (scanResult.Items && scanResult.Items.length > 0) {
          // Find folder where normalized name matches
          foundFolder = scanResult.Items.find(item => {
            const sk = item.SK || '';
            const folderName = sk.split('#').pop() || '';
            const normalizedFolderName = normalizeFolderName(folderName);
            const match = normalizedFolderName === normalizedSlug;
            if (match) {
              console.log(`[get-share-params-by-series] Found folder by normalized match: "${folderName}" matches "${seriesName}"`);
            }
            return match;
          });
        }
      } catch (err) {
        console.error('[get-share-params-by-series] Error scanning master account folders:', err);
      }
    }

    // If still not found, scan all users (fallback)
    if (!foundFolder) {
      console.log('[get-share-params-by-series] Not found in master account, scanning all users...');
      try {
        const scanParams = {
          TableName: 'Twilly',
          FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :folderPrefix)',
          ExpressionAttributeValues: {
            ':pk': 'USER#',
            ':folderPrefix': 'FOLDER#'
          },
          Limit: 100
        };
        const scanResult = await dynamoDb.scan(scanParams).promise();
        
        if (scanResult.Items && scanResult.Items.length > 0) {
          // Find folder where normalized name matches
          foundFolder = scanResult.Items.find(item => {
            const sk = item.SK || '';
            const folderName = sk.split('#').pop() || '';
            const normalizedFolderName = normalizeFolderName(folderName);
            return normalizedFolderName === normalizedSlug;
          });
          
          if (foundFolder) {
            console.log(`[get-share-params-by-series] Found folder in all users scan`);
          }
        }
      } catch (err) {
        console.error('[get-share-params-by-series] Scan error:', err);
      }
    }

    if (!foundFolder) {
      // Not found; return defaults to allow page to still SSR meta
      return {
        success: true,
        username: null,
        series: seriesName,
        originalPosterUrl: 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg',
        title: seriesName,
        description: `Check out this series on Twilly`
      };
    }

    // Extract email from PK format USER#<email>
    const pk = foundFolder.PK || '';
    const email = pk.startsWith('USER#') ? pk.slice('USER#'.length) : null;

    // Resolve username by email (optional; if we have user profile item with username)
    let username = null;
    if (email) {
      try {
        const userScanParams = {
          TableName: 'Twilly',
          FilterExpression: 'PK = :pk AND email = :e',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':e': email
          },
          Limit: 5
        };
        const userResult = await dynamoDb.scan(userScanParams).promise();
        if (userResult.Items && userResult.Items.length > 0) {
          username = userResult.Items[0].username || null;
        }
      } catch (err) {
        console.error('[get-share-params-by-series] Error resolving username:', err);
      }
    }

    // Extract the exact series name from the folder SK (preserves emojis and exact casing)
    // Format: FOLDER#<category>#<seriesName>
    const folderSk = foundFolder.SK || '';
    const exactSeriesName = folderSk.split('#').pop() || seriesName;
    console.log(`[get-share-params-by-series] Exact series name from folder: "${exactSeriesName}"`);

    // Determine poster URL
    let originalPosterUrl = foundFolder.seriesPosterUrl || foundFolder.MenuPoster || null;
    if (!originalPosterUrl) {
      originalPosterUrl = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
    }
    if (originalPosterUrl.includes('d4idc5cmwxlpy.cloudfront.net')) {
      originalPosterUrl = originalPosterUrl.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
    }
    if (originalPosterUrl.includes('/series-posters/') && !originalPosterUrl.includes('/public/series-posters/')) {
      originalPosterUrl = originalPosterUrl.replace('/series-posters/', '/public/series-posters/');
    }

    // Get trailer URL if available
    let trailerUrl = null;
    if (foundFolder.trailerUrl) {
      trailerUrl = foundFolder.trailerUrl;
      console.log(`[get-share-params-by-series] Found trailerUrl: ${trailerUrl}`);
    }

    const result = {
      success: true,
      username,
      email, // Include email so channel page can fetch menu items
      series: exactSeriesName, // Use exact series name from folder (preserves emojis)
      originalPosterUrl,
      title: exactSeriesName, // Use exact series name for title too
      description: username ? `Check out this series from ${username}` : `Check out this series on Twilly`,
      trailerUrl
    };

    return result;

  } catch (error) {
    console.error('[get-share-params-by-series] Error:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to get share params by series' });
  }
});


