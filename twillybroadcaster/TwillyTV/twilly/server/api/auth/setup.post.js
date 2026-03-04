import { defineEventHandler, readBody } from 'h3'

// API Gateway endpoint URL
const API_GATEWAY_URL = 'https://fui33t7q8i.execute-api.us-east-1.amazonaws.com/prod/auth'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    console.log('Received setup request:', body)

    // Get required fields from the request
    const { username, password, email } = body
    if (!username || !password || !email) {
      throw new Error('Username, password, and email are required')
    }

    // Call API Gateway endpoint
    const response = await $fetch(API_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        triggerSource: 'DefineAuthChallenge_Authentication',
        userName: username,
        request: {
          userAttributes: {
            phone_number: username,
            email: email
          }
        }
      })
    })

    // If the response indicates the user exists, return success
    if (response.challengeName === 'CUSTOM_CHALLENGE') {
      return {
        success: true,
        user: {
          username: username,
          userType: 'buyer'
        }
      }
    }

    return response
  } catch (error) {
    console.error('Setup error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}) 