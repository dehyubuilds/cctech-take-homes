import { defineEventHandler, readBody } from 'h3'

// API Gateway endpoint URL
const API_GATEWAY_URL = 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/prod/auth-challenge'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    console.log('Received verify request:', body)

    // Get required fields from the request
    const { phoneNumber, code } = body
    if (!phoneNumber || !code) {
      throw new Error('Phone number and code are required')
    }

    // Call API Gateway endpoint
    const response = await $fetch(API_GATEWAY_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        phoneNumber,
        code,
        triggerSource: 'VerifyAuthChallenge'
      })
    })

    return response
  } catch (error) {
    console.error('Verify error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}) 