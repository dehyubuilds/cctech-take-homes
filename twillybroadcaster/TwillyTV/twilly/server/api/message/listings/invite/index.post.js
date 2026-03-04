import Joi from "joi";
import AWS from "aws-sdk";

const schema = Joi.object({
    channelName: Joi.string().required(),
    hashedValue: Joi.string().required(),
    schedulerId: Joi.string().required(),
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

    const { channelName, hashedValue, schedulerId } = value;

    console.log(schedulerId)
    console.log(channelName)

    const queryParams = {
        TableName: "Twilly",
        KeyConditionExpression: "schedulerId = :schedulerId AND id = :id",
        ExpressionAttributeValues: {
            ":schedulerId": schedulerId,
            ":id": 'None',  // Replace 'None' with the actual value for id
        },
        ProjectionExpression: `Channels.#channelName.CollaboratorTo`,
        ExpressionAttributeNames: {
            "#channelName": channelName,
        },
    };

    try {
        const queryResult = await dynamodb.query(queryParams).promise();

        // Check if any items were found
        if (queryResult.Items && queryResult.Items.length > 0) {
            const existingChannel = queryResult.Items[0];

            // Check if the channelName already exists
            if (!existingChannel.Channels || !existingChannel.Channels[channelName]) {
                // Channel does not exist, create a new item with the specified schedulerId and id
                const putParams = {
                    TableName: "Twilly",
                    Item: {
                        schedulerId: schedulerId,
                        id: 'None',
                        Channels: {
                            [channelName]: {
                                CollaboratorTo: [hashedValue]

                            },
                        },
                    },
                };

                await dynamodb.put(putParams).promise();
                return { message: `Created channel '${channelName}' in DynamoDB with subscriber '${hashedValue}'` };
            }

            // Check if hashedValue is already in the CollaboratorTo list
            const CollaboratorToList = existingChannel.Channels[channelName].CollaboratorTo;
            if (!CollaboratorToList.includes(hashedValue)) {
                // Channel exists, update the CollaboratorTo list
                const updateParams = {
                    TableName: "Twilly",
                    Key: {
                        schedulerId: schedulerId,
                        id: 'None'  // Include the partition key
                    },
                    UpdateExpression: `SET Channels.#channelName.CollaboratorTo = list_append(Channels.#channelName.CollaboratorTo, :subscriber)`,
                    ExpressionAttributeNames: {
                        "#channelName": channelName,
                    },
                    ExpressionAttributeValues: {
                        ':subscriber': [hashedValue],
                    },
                };

                await dynamodb.update(updateParams).promise();
                return { message: `Added subscriber to channel '${channelName}' in DynamoDB GSI` };
            } else {
                return { message: `SchedulerId '${hashedValue}' already exists in the CollaboratorTo list for channel '${channelName}'` };
            }
        } else {
            throw createError({
                statusCode: 404,
                statusMessage: `Item with hashedSchedulerId '${hashedValue}' not found`,
            });
        }
    } catch (err) {
        console.error("Error querying and updating DynamoDB:", err);
        throw createError({
            statusCode: 500,
            statusMessage: "Internal Server Error"
        });
    }
});
