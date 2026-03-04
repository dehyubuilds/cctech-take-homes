import AWS from 'aws-sdk';
const cognito = new AWS.CognitoIdentityServiceProvider({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const { phone, password } = await readBody(event);
    
    // Create user with phone number as username
    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: 'us-east-1_hbYWvnY7Q', // Your Cognito User Pool ID
      Username: phone, // Use phone number as username
      UserAttributes: [
        {
          Name: 'phone_number',
          Value: phone
        },
        {
          Name: 'phone_number_verified',
          Value: 'true'
        },
        {
          Name: 'email_verified',
          Value: 'true' // Skip email verification
        }
      ],
      MessageAction: 'SUPPRESS', // Suppress all verification messages
      DesiredDeliveryMediums: ['SMS']
    });

    const createUserResponse = await cognito.send(createUserCommand);

    // Set user password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: 'us-east-1_hbYWvnY7Q',
      Username: phone,
      Password: password,
      Permanent: true
    });

    await cognito.send(setPasswordCommand);

    // Update user attributes to ensure email verification is skipped
    const updateAttributesCommand = new AdminUpdateUserAttributesCommand({
      UserPoolId: 'us-east-1_hbYWvnY7Q',
      Username: phone,
      UserAttributes: [
        {
          Name: 'email_verified',
          Value: 'true'
        }
      ]
    });

    await cognito.send(updateAttributesCommand);

    return {
      success: true,
      user: createUserResponse.User
    };
  } catch (error) {
    console.error('Error creating phone user:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to create user account'
    });
  }
}); 