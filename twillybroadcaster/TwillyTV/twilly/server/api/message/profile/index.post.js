
import Joi from "joi";
import AWS from "aws-sdk";

const schema = Joi.object({
  schedulerId: Joi.string().required(),
  id: Joi.string().required(),
  firstName: Joi.string().allow('', null).optional(),
  lastName: Joi.string().allow('', null).optional(),
  email:Joi.string().allow('', null).optional(),
  phoneNumber: Joi.string().allow('', null).optional(),
  Notifications: Joi.object({
    reminders: Joi.boolean().allow('', null).optional(),
    newServices: Joi.boolean().allow('', null).optional(),
    passwordChanges:Joi.boolean().allow('', null).optional(),
    specialOffers:Joi.boolean().allow('', null).optional(),
  }).optional(),
  avatarUrl: Joi.string().allow('', null).optional(),
});

// Initialize the AWS SDK with your credentials and region
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
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

  const { schedulerId, id, firstName, lastName, email, phoneNumber, Notifications, avatarUrl } = value;

  const params = {
    TableName: "Twilly",
    Item: {
      schedulerId,
      id,
      firstName,
      lastName,
      email,
      phoneNumber,
      Notifications,
      avatarUrl,
    }
  };

  try {
    await dynamodb.put(params).promise();
    return { message: "userData posted to DynamoDB" };
  } catch (err) {
    console.error("Error posting to DynamoDB:", err);
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    });
  }
});


