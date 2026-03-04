import Joi from "joi";
import AWS from "aws-sdk";

const schema = Joi.object({
    id: Joi.string().required(),
    channelName: Joi.string().required(),
    image: Joi.string().optional(),
    schedulerId: Joi.string().required(),
    hashedSchedulerId: Joi.string().required(),
    approveAccepts: Joi.boolean().required(),
    subscriberPublish: Joi.boolean().required(),
    timestamp: Joi.string().required(),
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

    const { id, channelName, image, schedulerId, approveAccepts, subscriberPublish, timestamp, hashedSchedulerId } = value;

    // Retrieve the existing item for the specified schedulerId
    const existingItem = await dynamodb.get({
        TableName: "Twilly",
        Key: {
            schedulerId: schedulerId,
            id: "None", // Assuming "id" is the sort key and "None" is the desired value
        },
    }).promise();

    const existingChannels = existingItem.Item?.Channels || {};

    // Check if the current channelName already exists in the Channels list
    const channelExists = existingChannels.hasOwnProperty(channelName);

    // If the current channelName does not exist, add it to the Channels list
    if (!channelExists) {
        // Create a new empty Subscribers list for the new channelName
        existingChannels[channelName] = { Subscribers: [], CollaboratorTo: [] };
    }

    // Set image to "none" if it doesn't exist
    const updatedImage = image || "none";

    // Define the parameters for the DynamoDB update operation
    const updateParams = {
        TableName: "Twilly",
        Key: { schedulerId: schedulerId, id: "None" }, // Assuming "id" is the primary key
        UpdateExpression: 'SET image = :updatedImage, approveAccepts = :approveAccepts, subscriberPublish = :subscriberPublish, #ts = :timestamp, hashedSchedulerId = :hashedSchedulerId, Channels = :updatedChannels',
        ExpressionAttributeValues: {
            ':updatedImage': updatedImage,
            ':approveAccepts': approveAccepts,
            ':subscriberPublish': subscriberPublish,
            ':timestamp': timestamp,
            ':hashedSchedulerId': hashedSchedulerId,
            ':updatedChannels': existingChannels,
        },
        ExpressionAttributeNames: {
            '#ts': 'timestamp',
        },
    };

    try {
        await dynamodb.update(updateParams).promise();
        return { message: "Channel posted to DynamoDB" };
    } catch (err) {
        console.error("Error posting channel to DynamoDB:", err);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error"
        });
    }
});
