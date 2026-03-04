import { defineEventHandler, readBody } from 'h3'
import { Auth } from 'aws-amplify'
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider"
import awsExports from '~/aws-exports'
import { useAuthStore } from '~/stores/auth'

// Create a separate configuration for phone-based auth
const phoneAuthConfig = {
  ...awsExports,
  userPoolId: 'us-east-1_ydIfTK3KE',
  userPoolWebClientId: '4qo9vei7nefgirb9059tov4qd',
  authenticationFlowType: 'USER_PASSWORD_AUTH'
}

// Configure Amplify with phone auth settings
Auth.configure(phoneAuthConfig)

// Create Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region: 'us-east-1' })

const USER_POOL_ID = 'us-east-1_ydIfTK3KE'
const DEFAULT_PASSWORD = 'Twilly@123'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    console.log('Received create request:', body)

    // Get phone number from the request
    const phoneNumber = body.phoneNumber
    if (!phoneNumber) {
      throw new Error('Phone number is required')
    }

    // Check if user exists in Cognito
    try {
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: phoneNumber
      })
      
      await cognitoClient.send(getUserCommand)
      
      // User exists, return success with isExistingUser true
      return {
        success: true,
        phoneNumber: phoneNumber,
        isExistingUser: true
      }
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        // User doesn't exist, create them
        const createUserCommand = new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: phoneNumber,
          UserAttributes: [
            { Name: 'phone_number', Value: phoneNumber }
          ],
          MessageAction: 'SUPPRESS',
          TemporaryPassword: DEFAULT_PASSWORD
        })
        
        await cognitoClient.send(createUserCommand)
        
        // Set permanent password
        const setPasswordCommand = new AdminSetUserPasswordCommand({
          UserPoolId: USER_POOL_ID,
          Username: phoneNumber,
          Password: DEFAULT_PASSWORD,
          Permanent: true
        })
        
        await cognitoClient.send(setPasswordCommand)
        
        return {
          success: true,
          phoneNumber: phoneNumber,
          isExistingUser: false
        }
      }
      throw error
    }
  } catch (error) {
    console.error('Create error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}) 