import Joi from "joi";
import AWS from "aws-sdk";

const schema = Joi.object({
    id: Joi.string().required(),
    reminder: Joi.string().required(),
    title: Joi.string().optional(),
    schedulerId: Joi.string().required(),
    isFav: Joi.boolean().required(),
    timestamp: Joi.string().required(),
    phoneNumber: Joi.string().required()
});

AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { error, value } = await schema.validate(body);

    if (error) {
        throw createError({
            statusCode: 412,
            statusMessage: error.message
        });
    }

    const { id, reminder, title, schedulerId, isFav,timestamp, phoneNumber } = value;

    // Define the parameters for the DynamoDB put operation
    const params = {
        TableName: "Twilly",
        Item: {
            id,
            reminder,
            title,
            schedulerId,
            isFav,
            timestamp,
            phoneNumber
        }
    };

    try {
        await dynamodb.put(params).promise();
        return { message: "Reminder posted to DynamoDB" };
    } catch (err) {
        console.error("Error posting to DynamoDB:", err);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error"
        });
    }
});