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

    const payload = {
        body: JSON.stringify({ hashedValue: hashedValue}), // Include 'body' field with JSON data
      };
    
      const params = {
        FunctionName: "hashedValueTranslate",
        Payload: JSON.stringify(payload), 
      };
      const lambda = new AWS.Lambda();
      const translatedschedulerId = await lambda.invoke(params).promise();
      const translated_data = JSON.parse(translatedschedulerId.Payload);
      const scheduler_id = JSON.parse(translated_data.body).scheduler_id;
 
   
    const queryParams = {
        TableName: "Twilly",
        IndexName: "hashedSchedulerId-index",
        KeyConditionExpression: "hashedSchedulerId = :hash",
        ExpressionAttributeValues: {
            ":hash": hashedValue,
        },
        ProjectionExpression: `Channels.#channelName.Subscribers`,
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
                throw createError({
                    statusCode: 404,
                    statusMessage: `Channel '${channelName}' not found`,
                });
            }

            // Check if hashedValue is already in the Subscribers list
            const subscribersList = existingChannel.Channels[channelName].Subscribers;
            if (!subscribersList.includes(schedulerId)) {
                // Channel exists, update the Subscribers list
                const updateParams = {
                    TableName: "Twilly",
                    Key: {
                        schedulerId: scheduler_id,
                        id: 'None'  // Include the partition key
                    },
                    UpdateExpression: `SET Channels.#channelName.Subscribers = list_append(Channels.#channelName.Subscribers, :subscriber)`,
                    ExpressionAttributeNames: {
                        "#channelName": channelName,
                    },
                    ExpressionAttributeValues: {
                        ':subscriber': [schedulerId],
                    },
                };

                await dynamodb.update(updateParams).promise();
                return { message: `Added subscriber to channel '${channelName}' in DynamoDB GSI` };
            } else {
                return { message: `SchedulerId '${schedulerId}' already exists in the Subscribers list for channel '${channelName}'` };
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
