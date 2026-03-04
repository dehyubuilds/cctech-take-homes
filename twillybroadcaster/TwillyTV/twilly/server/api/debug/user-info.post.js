export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { email } = body

    console.log('Debug user info request for email:', email)

    // Return user info for debugging
    return {
      success: true,
      message: 'User info retrieved',
      userInfo: {
        email: email,
        // Add any other user info you need for debugging
      }
    }

  } catch (error) {
    console.error('Error in debug user info:', error)
    return {
      success: false,
      message: 'Internal server error'
    }
  }
}) 