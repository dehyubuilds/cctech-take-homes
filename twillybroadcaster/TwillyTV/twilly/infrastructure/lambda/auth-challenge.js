const { 
    CognitoIdentityProviderClient, 
    AdminGetUserCommand, 
    AdminCreateUserCommand, 
    AdminSetUserPasswordCommand, 
    AdminConfirmSignUpCommand, 
    AdminInitiateAuthCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-1' });

// Hardcoded values for consistency
const USER_POOL_ID = 'us-east-1_ydIfTK3KE';
const CLIENT_ID = '4qo9vei7nefgirb9059tov4qd';
const DEFAULT_PASSWORD = 'Twilly@123';

exports.handler = async (event) => {
    console.log('Raw Event:', JSON.stringify(event, null, 2));
    
    try {
        // Check if this is an API Gateway request
        if (event.resource && event.path && event.httpMethod) {
            // This is an API Gateway request
            try {
                const body = JSON.parse(event.body);
                console.log('API Gateway Request:', body);
                
                // Handle the request based on the trigger source
                if (body.triggerSource === 'DefineAuthChallenge_Authentication') {
                    const response = await handleDefineAuthChallenge(body);
                    return formatApiGatewayResponse(response);
                } else if (body.triggerSource === 'VerifyAuthChallengeResponse_Authentication') {
                    const response = await handleVerifyAuthChallenge(body);
                    return formatApiGatewayResponse(response);
                } else if (body.triggerSource === 'PreSignUp' || body.triggerSource === 'PreSignUp_AdminCreateUser') {
                    const response = await handlePreSignUp(body);
                    return formatApiGatewayResponse(response);
                } else {
                    return formatApiGatewayResponse({
                        error: 'Invalid trigger source',
                        triggerSource: body.triggerSource
                    }, 400);
                }
            } catch (error) {
                console.error('API Gateway Error:', error);
                return formatApiGatewayResponse({
                    error: error.message,
                    details: error.stack
                }, 500);
            }
        } else {
            // This is a Cognito trigger
            if (event.triggerSource === 'DefineAuthChallenge_Authentication') {
                return handleDefineAuthChallenge(event);
            } else if (event.triggerSource === 'VerifyAuthChallengeResponse_Authentication') {
                return handleVerifyAuthChallenge(event);
            } else if (event.triggerSource === 'PreSignUp' || event.triggerSource === 'PreSignUp_AdminCreateUser') {
                return handlePreSignUp(event);
            }
            
            console.log('Unhandled trigger source:', event.triggerSource);
            return event;
        }
    } catch (error) {
        console.error('Top-level error:', error);
        return formatApiGatewayResponse({
            error: error.message,
            details: error.stack
        }, 500);
    }
};

function formatApiGatewayResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
    };
}

async function handleDefineAuthChallenge(event) {
    try {
        // Use the phone_number from userAttributes which includes the + symbol
        const phoneNumber = event.request?.userAttributes?.phone_number || event.userName;
        console.log('DefineAuthChallenge: Checking if user exists:', phoneNumber);
        
        // Check if user exists
        const getUserCommand = new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: phoneNumber
        });
        await cognito.send(getUserCommand);
        
        console.log('DefineAuthChallenge: User exists, proceeding with auth');
        
        // User exists, proceed with auth
        return {
            challengeName: 'CUSTOM_CHALLENGE',
            issueTokens: false,
            failAuthentication: false
        };
    } catch (error) {
        if (error.name === 'UserNotFoundException') {
            console.log('DefineAuthChallenge: User not found, creating new user:', event.userName);
            
            // Use the phone_number from userAttributes which includes the + symbol
            const phoneNumber = event.request?.userAttributes?.phone_number || event.userName;
            
            try {
                // Create user with phone number and temporary password
                const createUserCommand = new AdminCreateUserCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: phoneNumber,
                    UserAttributes: [
                        { Name: 'phone_number', Value: phoneNumber },
                        { Name: 'custom:user_type', Value: 'buyer' }
                    ],
                    MessageAction: 'SUPPRESS',
                    TemporaryPassword: DEFAULT_PASSWORD
                });
                await cognito.send(createUserCommand);
                console.log('DefineAuthChallenge: User created successfully');
                
                // Small delay to ensure user is fully created
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Set permanent password
                const setPasswordCommand = new AdminSetUserPasswordCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: phoneNumber,
                    Password: DEFAULT_PASSWORD,
                    Permanent: true
                });
                await cognito.send(setPasswordCommand);
                console.log('DefineAuthChallenge: Default password set successfully');
                
                // Try to confirm, but ignore if already confirmed
                try {
                    const confirmSignUpCommand = new AdminConfirmSignUpCommand({
                        UserPoolId: USER_POOL_ID,
                        Username: phoneNumber
                    });
                    await cognito.send(confirmSignUpCommand);
                    console.log('DefineAuthChallenge: User confirmed successfully');
                } catch (confirmError) {
                    if (confirmError.name !== 'NotAuthorizedException' || !confirmError.message.includes('Current status is CONFIRMED')) {
                        throw confirmError;
                    }
                    console.log('DefineAuthChallenge: User already confirmed');
                }
                
                return {
                    challengeName: 'CUSTOM_CHALLENGE',
                    issueTokens: false,
                    failAuthentication: false
                };
            } catch (createError) {
                console.error('DefineAuthChallenge: Error creating user:', createError);
                throw createError;
            }
        }
        console.error('DefineAuthChallenge: Unexpected error:', error);
        throw error;
    }
}

async function handleVerifyAuthChallenge(event) {
    try {
        // Use the phone_number from userAttributes which includes the + symbol
        const phoneNumber = event.request?.userAttributes?.phone_number || event.userName;
        console.log('VerifyAuthChallenge: Verifying user:', phoneNumber);
        
        // Use the hardcoded client ID
        console.log('Using client ID:', CLIENT_ID);
        
        // Use CUSTOM_AUTH flow
        const authCommand = new AdminInitiateAuthCommand({
            UserPoolId: USER_POOL_ID,
            ClientId: CLIENT_ID,
            AuthFlow: 'CUSTOM_AUTH',
            AuthParameters: {
                USERNAME: phoneNumber,
                PASSWORD: DEFAULT_PASSWORD
            }
        });
        
        const authResponse = await cognito.send(authCommand);
        console.log('VerifyAuthChallenge: Authentication successful');
        
        return {
            answerCorrect: true,
            issueTokens: true,
            tokens: authResponse.AuthenticationResult
        };
    } catch (error) {
        console.error('VerifyAuthChallenge: Error:', error);
        console.error('Error details:', error.stack);
        return {
            answerCorrect: false,
            issueTokens: false,
            failAuthentication: true
        };
    }
}

async function handlePreSignUp(event) {
    // Use the phone_number from userAttributes which includes the + symbol
    const phoneNumber = event.request?.userAttributes?.phone_number || event.userName;
    console.log('PreSignUp: Auto-confirming user:', phoneNumber);
    
    // Auto-confirm the user
    event.response = {
        autoConfirmUser: true,
        autoVerifyEmail: true,
        autoVerifyPhone: true
    };
    return event;
} 