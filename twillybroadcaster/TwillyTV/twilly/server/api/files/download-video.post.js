import AWS from "aws-sdk";

export default defineEventHandler(async (event) => {
    try {
        console.log('=== DOWNLOAD VIDEO API CALLED ===');
        
        const body = await readBody(event);
        console.log('Request body:', JSON.stringify(body, null, 2));
        
        const { hlsUrl, fileName, userId } = body;

        if (!hlsUrl) {
            console.error('Missing required parameters:', { hlsUrl, fileName, userId });
            throw createError({
                statusCode: 400,
                message: 'Missing required parameters: hlsUrl, fileName, userId'
            });
        }

        if (!fileName || !userId) {
            console.error('Missing required parameters:', { fileName, userId });
            throw createError({
                statusCode: 400,
                message: 'Missing required parameters: fileName, userId'
            });
        }

        console.log('Parameters validated successfully');

        // Configure AWS SDK
        AWS.config.update({
            region: 'us-east-1',
            accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
            secretAccessKey: '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'
        });

        // Create Lambda client
        const lambda = new AWS.Lambda({
            region: 'us-east-1'
        });

        console.log('AWS SDK configured, invoking Lambda...');

        // Prepare the payload for HLS stream processing
        const payload = {
            fileName: fileName,
            userId: userId,
            hlsUrl: hlsUrl
        };

        console.log('Using hlsUrl:', hlsUrl);

        console.log('Lambda payload:', JSON.stringify(payload, null, 2));

        // Invoke the Lambda function
        const lambdaParams = {
            FunctionName: 'video-download-converter',
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload)
        };

        console.log('Invoking Lambda with params:', JSON.stringify(lambdaParams, null, 2));

        const lambdaResponse = await lambda.invoke(lambdaParams).promise();
        
        console.log('Lambda response received:', JSON.stringify(lambdaResponse, null, 2));

        if (lambdaResponse.StatusCode !== 200) {
            console.error('Lambda invocation failed with status:', lambdaResponse.StatusCode);
            throw new Error(`Lambda invocation failed with status: ${lambdaResponse.StatusCode}`);
        }

        const responsePayload = JSON.parse(lambdaResponse.Payload);
        console.log('Parsed Lambda response payload:', JSON.stringify(responsePayload, null, 2));
        
        if (responsePayload.errorMessage) {
            console.error('Lambda returned error:', responsePayload.errorMessage);
            throw new Error(responsePayload.errorMessage);
        }

        console.log('Lambda execution successful, returning response');

        return {
            success: true,
            downloadUrl: responsePayload.downloadUrl,
            message: responsePayload.message
        };

    } catch (error) {
        console.error('=== ERROR IN DOWNLOAD VIDEO ENDPOINT ===');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // Return a more detailed error response
        throw createError({
            statusCode: 500,
            message: `Download video failed: ${error.message}`,
            data: {
                originalError: error.message,
                stack: error.stack
            }
        });
    }
}); 