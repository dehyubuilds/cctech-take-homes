import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { shortId } = body;

    if (!shortId) {
      throw createError({
        statusCode: 400,
        message: 'Short ID is required'
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

    // Get the original URL from DynamoDB
    const params = {
      TableName: 'Twilly',
      Key: {
        PK: 'SHORT_URL',
        SK: shortId
      }
    };

    const result = await dynamoDb.get(params).promise();

    if (!result.Item) {
      throw createError({
        statusCode: 404,
        message: 'Short URL not found'
      });
    }

    const { longUrl, expiresAt, creator, series } = result.Item;

    // Check if the URL has expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      throw createError({
        statusCode: 410,
        message: 'Short URL has expired'
      });
    }

    // Try to convert stored longUrl (or creator/series) into a CLEAN channel URL with compact meta
    const slugify = (v) => String(v || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const toCleanUrl = () => {
      try {
        const url = new URL(longUrl);
        // Handle either /menu/share/:username/:series/:poster?title=...&description=...
        const pathParts = url.pathname.split('/').filter(Boolean);
        let usernameFromPath = null;
        let seriesFromPath = null;
        let posterFromPath = null;
        const title = url.searchParams.get('title') || url.searchParams.get('t');
        const description = url.searchParams.get('description') || url.searchParams.get('d');

        const idx = pathParts.findIndex(p => p === 'menu');
        if (idx !== -1 && pathParts[idx + 1] === 'share') {
          usernameFromPath = pathParts[idx + 2] || creator || '';
          seriesFromPath = decodeURIComponent(pathParts[idx + 3] || series || '');
          posterFromPath = pathParts[idx + 4] ? decodeURIComponent(pathParts[idx + 4]) : '';
        }

        const finalUsername = usernameFromPath || creator || '';
        const finalSeries = seriesFromPath || series || '';
        const finalPoster = posterFromPath || '';

        const slug = slugify(finalSeries);
        const clean = new URL(`https://twilly.app/channel/${encodeURIComponent(finalUsername)}/${encodeURIComponent(slug)}`);
        if (title) clean.searchParams.set('t', title);
        else clean.searchParams.set('t', finalSeries);
        if (description) clean.searchParams.set('d', description);
        else clean.searchParams.set('d', `Check out this series from ${finalUsername}`);
        if (finalPoster) clean.searchParams.set('p', finalPoster);
        return clean.toString();
      } catch (_) {
        return longUrl;
      }
    };

    const redirectUrl = toCleanUrl();

    return { 
      longUrl: redirectUrl,
      success: true
    };
  } catch (error) {
    console.error('Error retrieving original URL:', error);
    
    // Handle specific AWS errors
    if (error.code === 'CredentialsError') {
      throw createError({
        statusCode: 500,
        message: 'AWS credentials error. Please check configuration.'
      });
    } else if (error.code === 'AccessDenied') {
      throw createError({
        statusCode: 403,
        message: 'Access denied. Please check AWS permissions.'
      });
    } else if (error.code === 'ResourceNotFoundException') {
      throw createError({
        statusCode: 404,
        message: 'DynamoDB table not found.'
      });
    }
    
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to retrieve original URL'
    });
  }
}); 