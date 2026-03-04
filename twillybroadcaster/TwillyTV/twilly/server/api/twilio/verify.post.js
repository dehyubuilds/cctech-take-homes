import { defineEventHandler, readBody } from 'h3'
import twilio from 'twilio'

const accountSid = 'AC51aa42874175a8f9a1f7b95f3a3a5fe6'
const authToken = 'b7fcdf5c6b0a09f106f977b58ffaadc5'

// Create a new Twilio client for each request to ensure fresh initialization
const createTwilioClient = () => {
  return twilio(accountSid, authToken)
}

// Updated Verify Service ID
const verifyServiceId = 'VA4d6b7b83646a2ae33cd23aeacab37041'

// Helper function to format phone number to E.164
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // If number starts with 0, check if it's a US or Nigerian number
  if (digits.startsWith('0')) {
    // If it's a US number (10 digits after removing 0)
    if (digits.length === 10) {
      return `+1${digits.substring(1)}`
    }
    // If it's a Nigerian number
    return `+234${digits.substring(1)}`
  }
  
  // If number starts with 1 (US)
  if (digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // If number starts with 234 (Nigeria)
  if (digits.startsWith('234')) {
    return `+${digits}`
  }
  
  // If number is 10 digits (US)
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // If number has +, return as is
  if (phone.startsWith('+')) {
    return phone
  }
  
  // Default case
  return `+${digits}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { phone, action, code } = body

  try {
    // Format phone number to E.164 format
    const formattedPhone = formatPhoneNumber(phone)
    console.log('Formatted phone number:', formattedPhone)

    // Create a new Twilio client for this request
    const client = createTwilioClient()

    if (action === 'send') {
      // Send verification code via Verify API
      const verification = await client.verify.v2
        .services(verifyServiceId)
        .verifications
        .create({
          to: formattedPhone,
          channel: 'sms'
        })
      
      console.log('Verification sent:', verification.status)
      return {
        success: true,
        status: verification.status
      }

    } else if (action === 'verify') {
      console.log('Verifying code:', code, 'for phone:', formattedPhone)
      
      try {
        // Check verification code
        const verificationCheck = await client.verify.v2
          .services(verifyServiceId)
          .verificationChecks
          .create({
            to: formattedPhone,
            code: code
          })

        console.log('Verification check result:', verificationCheck)

        if (!verificationCheck.valid) {
          return {
            success: false,
            error: 'Invalid verification code'
          }
        }

        return {
          success: true,
          status: verificationCheck.status,
          valid: verificationCheck.valid
        }
      } catch (verifyError) {
        console.error('Verification check error:', verifyError)
        throw verifyError
      }
    }

    return {
      success: false, 
      error: 'Invalid action'
    }

  } catch (error) {
    console.error('Twilio Verify Error:', error)
    
    // Handle specific Twilio errors
    if (error.code === 20404) {
      console.error('Service ID not found:', verifyServiceId)
      return {
        success: false,
        error: 'Verification service not found. Please check your Twilio Verify service configuration.'
      }
    }
    
    if (error.code === 60200) {
      return {
        success: false,
        error: 'Invalid verification code'
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to process verification'
    }
  }
}) 