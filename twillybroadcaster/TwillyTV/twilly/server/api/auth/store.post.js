import { defineEventHandler, readBody, setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const { user } = await readBody(event)
    
    if (!user) {
      return {
        success: false,
        error: 'No user data provided'
      }
    }

    // Store user data in cookies
    setCookie(event, 'user', JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })

    return {
      success: true,
      user: user
    }
  } catch (error) {
    console.error('Error storing user state:', error)
    return {
      success: false,
      error: error.message || 'Failed to store user state'
    }
  }
}) 