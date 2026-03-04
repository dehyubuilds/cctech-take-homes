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

  console.log('[Share Redirect API] Loading redirect for shortId:', shortId);

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
    console.log('[Share Redirect API] DynamoDB result:', result);

    if (!result.Item) {
      return {
        error: 'Content not found'
      };
    }

    const item = result.Item;
    const rawCreator = item.creator || '';
    const creator = rawCreator.includes('@') ? rawCreator.split('@')[0] : rawCreator;
    const { series } = item;

    console.log('[Share Redirect API] Found mapping:', { creator, series });

    // If we have a longUrl, redirect to it
    if (item.longUrl) {
      let redirectUrl = item.longUrl;
      try {
        const url = new URL(redirectUrl, 'https://twilly.app');
        const parts = url.pathname.split('/').filter(Boolean);
        // Normalize creator segment for known routes
        // talent-request/:creator/:channel
        const trIdx = parts.findIndex(p => p === 'talent-request');
        if (trIdx !== -1 && parts[trIdx + 1]) {
          parts[trIdx + 1] = creator;
          url.pathname = '/' + parts.join('/');
          redirectUrl = url.toString().replace('https://twilly.app', '');
        }
        // menu/share/:creator/:series stays as-is but ensure creator sanitized
        const msIdx = parts.findIndex(p => p === 'menu');
        if (msIdx !== -1 && parts[msIdx + 1] === 'share' && parts[msIdx + 2]) {
          parts[msIdx + 2] = creator;
          url.pathname = '/' + parts.join('/');
          redirectUrl = url.toString().replace('https://twilly.app', '');
        }
      } catch (_) {}

      console.log('[Share Redirect API] Redirecting to:', redirectUrl);
      return { redirectUrl };
    } else if (item.creator && item.series) {
      // Fallback: construct the URL from creator and series
      const redirectUrl = `/menu/share/${creator}/${encodeURIComponent(item.series)}`;
      console.log('[Share Redirect API] Fallback redirecting to:', redirectUrl);
      
      return {
        redirectUrl
      };
    } else {
      return {
        error: 'Invalid content type'
      };
    }

  } catch (error) {
    console.error('[Share Redirect API] Error:', error);
    return {
      error: 'Failed to load redirect'
    };
  }
}); 