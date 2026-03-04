import crypto from 'crypto'

// Transloadit configuration
const TRANSLOADIT_ACCOUNT_ID = 'twillyapp'
const TRANSLOADIT_API_KEY = 'be12be84f2614f06afd78081e9a529cd'
const TRANSLOADIT_SECRET = 'your-secret-here' // Replace with your actual secret

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { filename, contentType, creatorUsername } = body

    if (!filename || !contentType || !creatorUsername) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required parameters'
      })
    }

    // Generate unique request ID
    const requestId = crypto.randomUUID()
    
    // Create Transloadit assembly parameters
    const params = {
      auth: {
        key: TRANSLOADIT_API_KEY,
        expires: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      },
      template_id: 'your-s3-template', // We'll create this template
      notify_url: 'https://twilly.app/api/collaborations/transloadit-webhook',
      fields: {
        creatorUsername,
        requestId,
        filename,
        contentType
      }
    }

    // Create signature
    const signature = crypto
      .createHmac('sha1', TRANSLOADIT_SECRET)
      .update(JSON.stringify(params))
      .digest('hex')

    // Return upload configuration
    return {
      success: true,
      accountId: TRANSLOADIT_ACCOUNT_ID,
      params: {
        ...params,
        signature
      },
      requestId,
      uploadUrl: 'https://api2.transloadit.com/assemblies'
    }

  } catch (error) {
    console.error('Transloadit config error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create upload configuration'
    })
  }
}) 