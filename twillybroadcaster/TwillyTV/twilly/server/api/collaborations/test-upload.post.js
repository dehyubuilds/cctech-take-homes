export default defineEventHandler(async (event) => {
  try {
    console.log('=== TEST UPLOAD ENDPOINT ===')
    console.log('Headers:', event.headers)
    console.log('Method:', event.method)
    
    const body = await readBody(event)
    console.log('Body type:', typeof body)
    console.log('Body keys:', body ? Object.keys(body) : 'null')
    
    return {
      success: true,
      message: 'Test endpoint working',
      bodyType: typeof body,
      bodyKeys: body ? Object.keys(body) : null
    }
  } catch (error) {
    console.error('Test upload error:', error)
    return {
      success: false,
      message: error.message,
      error: error.toString()
    }
  }
}) 