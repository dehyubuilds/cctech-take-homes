import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const USER_POOL_ID = 'us-east-1_ydIfTK3KE';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('Checking user:', body.username);

    // Check if user exists
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.username
    });

    try {
      await cognito.send(getUserCommand);
      return {
        exists: true
      };
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        return {
          exists: false
        };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error checking user:', error);
    return {
      success: false,
      error: error.message
    };
  }
}); 