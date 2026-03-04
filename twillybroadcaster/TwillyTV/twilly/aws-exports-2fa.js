const awsmobile = {
    Auth: {
        region: 'us-east-1',
        userPoolId: 'us-east-1_uBLoZgofg',
        userPoolWebClientId: '7ite2sfc8rt6vusdbdp8pu42t0',
        authenticationFlowType: 'CUSTOM_AUTH',
        oauth: {
            domain: 'twilly-2fa.auth.us-east-1.amazoncognito.com',
            scope: ['email', 'openid', 'profile'],
            redirectSignIn: process.env.NODE_ENV === 'production' ? 'https://twilly.app' : 'http://localhost:3000',
            redirectSignOut: process.env.NODE_ENV === 'production' ? 'https://twilly.app' : 'http://localhost:3000',
            responseType: 'code'
        }
    }
};

export default awsmobile; 