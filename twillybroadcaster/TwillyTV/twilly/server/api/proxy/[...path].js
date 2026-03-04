

export default defineEventHandler(async (event) => {
  const path = event.context.params.path;
  const targetUrl = decodeURIComponent(path.join('/'));

  // Set CORS headers
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
  });

  // Handle OPTIONS request
  if (event.method === 'OPTIONS') {
    return { statusCode: 200 };
  }

  try {
    // Fetch the content from the target URL
    const response = await fetch(targetUrl);
    
    // Get the content type
    const contentType = response.headers.get('content-type');
    
    // Set response headers
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });

    // Return the response body
    return response.body;
  } catch (error) {
    console.error('Proxy error:', error);
    throw createError({
      statusCode: 500,
      message: 'Error proxying request'
    });
  }
}); 