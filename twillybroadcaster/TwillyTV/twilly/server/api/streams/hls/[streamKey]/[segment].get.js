// Proxy HLS segment files (.ts files) through Nuxt server
// This proxies binary video segments from EC2 HTTP to HTTPS for browser compatibility
// For Netlify serverless: pipe ReadableStream directly to avoid binary corruption
import { sendStream, setResponseHeaders } from 'h3'

export default defineEventHandler(async (event) => {
  const streamKey = getRouterParam(event, 'streamKey')
  const segment = getRouterParam(event, 'segment')
  
  if (!streamKey || !segment) {
    throw createError({
      statusCode: 400,
      message: 'Stream key and segment are required'
    })
  }
  
  const EC2_IP = '100.24.103.57'
  const segmentUrl = `http://${EC2_IP}/hls/${streamKey}/${segment}`
  
  try {
    // Fetch from EC2 with proper headers for binary content
    const response = await fetch(segmentUrl, {
      method: 'GET',
      headers: {
        'Accept': 'video/mp2t, video/MP2T, */*'
      },
      signal: AbortSignal.timeout(15000)
    })
    
    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: `Failed to fetch HLS segment: ${response.statusText}`
      })
    }
    
    // Get headers from EC2 response
    const contentType = response.headers.get('content-type') || 'video/mp2t'
    const contentLength = response.headers.get('content-length')
    
    // Set response headers
    setResponseHeaders(event, {
      'Content-Type': contentType,
      ...(contentLength && { 'Content-Length': contentLength }),
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Accept-Ranges': 'bytes'
    })
    
    // Pipe the ReadableStream directly using sendStream
    // This preserves binary data without serialization issues
    // sendStream is designed for streaming binary data in Nitro
    return sendStream(event, response.body)
  } catch (error) {
    console.error(`[HLS Proxy] Error proxying segment ${streamKey}/${segment}:`, error.message)
    
    // If it's already a createError, rethrow it
    if (error.statusCode) {
      throw error
    }
    
    // Otherwise, wrap it
    throw createError({
      statusCode: 502,
      message: `Failed to fetch HLS segment from EC2: ${error.message}`
    })
  }
})
