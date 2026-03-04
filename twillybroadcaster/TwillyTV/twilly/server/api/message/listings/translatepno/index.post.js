import Joi from "joi";
import AWS from "aws-sdk";

const schema = Joi.object({
    reminder: Joi.string().required(),
});

AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1',
});

const lambda = new AWS.Lambda();

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { error, value } = await schema.validate(body);

    if (error) {
        throw createError({
            statusCode: 412,
            statusMessage: error.message
        });
    }

    const pythonLambdaFunctionName = 'twillypno';
    const pythonLambdaParams = {
        FunctionName: pythonLambdaFunctionName,
        InvocationType: 'RequestResponse', // Synchronous invocation
        Payload: JSON.stringify(body)
    };

    try {
        const pythonLambdaResponse = await lambda.invoke(pythonLambdaParams).promise();
   

        const responsePayload = JSON.parse(pythonLambdaResponse.Payload);

        // Access the "body" property
        const responseBody = responsePayload.body;
    
        return {
            message: "Successfully invoked Python Lambda",
            responseBody
        };
    } catch (err) {
        console.error("Error invoking Python Lambda:", err);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error"
        });
    }
});
