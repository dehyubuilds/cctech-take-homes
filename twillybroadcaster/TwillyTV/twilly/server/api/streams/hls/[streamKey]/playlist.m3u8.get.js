// Proxy HLS playlist through Nuxt server to avoid mixed content issues
// Browser makes HTTPS request to Nuxt, Nuxt fetches HTTP from EC2, returns to browser
export default defineEventHandler(async (event) => {
  try {
    const streamKey = getRouterParam(event, 'streamKey')
    
    if (!streamKey) {
      throw createError({
        statusCode: 400,
        message: 'Stream key is required'
      })
    }
    
    const EC2_IP = '100.24.103.57'
    // NGINX RTMP with hls_nested creates index.m3u8, not playlist.m3u8
    // Try both index.m3u8 and playlist.m3u8
    const hlsUrls = [
      `http://${EC2_IP}/hls/${streamKey}/index.m3u8`,
      `http://${EC2_IP}/hls/${streamKey}/playlist.m3u8`
    ]
    
    console.log(`[HLS Proxy] Proxying HLS playlist for stream key: ${streamKey}`)
    
    let playlistContent = null
    let lastError = null
    
    // Try both URLs
    for (const hlsUrl of hlsUrls) {
      console.log(`[HLS Proxy] Trying: ${hlsUrl}`)
      try {
        const response = await fetch(hlsUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout per attempt
        })
        
        if (response.ok) {
          playlistContent = await response.text()
          console.log(`[HLS Proxy] Successfully fetched from: ${hlsUrl}`)
          break
        } else {
          console.log(`[HLS Proxy] ${hlsUrl} returned status ${response.status}`)
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (fetchError) {
        console.log(`[HLS Proxy] Error fetching ${hlsUrl}: ${fetchError.message}`)
        lastError = fetchError
      }
    }
    
    if (!playlistContent) {
      console.error(`[HLS Proxy] Failed to fetch playlist from both URLs. Last error: ${lastError?.message}`)
      throw createError({
        statusCode: 404,
        message: `HLS playlist not found. Possible reasons: 1) Stream just started - wait 15-20 seconds for HLS to generate, 2) NGINX HTTP server not serving HLS files correctly, 3) Stream stopped or not actually publishing video data. Check if stream is active and wait 15-20 seconds after starting.`
      })
    }
    
    // Replace any HTTP references to the EC2 server with our proxied HTTPS URLs
    // Convert relative segment paths to absolute proxied URLs for better compatibility
    const baseUrl = `https://twilly.app/api/streams/hls/${streamKey}`
    
    // Replace absolute EC2 URLs first
    let proxiedContent = playlistContent.replace(
      new RegExp(`http://${EC2_IP.replace(/\./g, '\\.')}/hls/${streamKey}/`, 'g'),
      `${baseUrl}/`
    )
    
    // Convert relative segment paths (e.g., "4.ts", "segment.ts") to absolute URLs
    // This ensures HLS.js can properly resolve segments regardless of how the playlist is loaded
    // Match lines that are just segment filenames (not starting with #, and ending with .ts)
    proxiedContent = proxiedContent.replace(/^([^#\s][^\s]*\.ts)$/gm, (match) => {
      // If already an absolute URL, don't modify it
      if (match.startsWith('http://') || match.startsWith('https://') || match.startsWith('/')) {
        return match
      }
      // Otherwise, make it absolute
      return `${baseUrl}/${match.trim()}`
    })
    
    // Set proper headers for HLS content
    setHeader(event, 'Content-Type', 'application/vnd.apple.mpegurl')
    setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
    setHeader(event, 'Access-Control-Allow-Origin', '*')
    setHeader(event, 'Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    
    return proxiedContent
  } catch (error) {
    console.error('[HLS Proxy] Error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Failed to proxy HLS playlist'
    })
  }
})
