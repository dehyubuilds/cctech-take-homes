/**
 * Release scheduled drops (premiere) when scheduledDropDate has passed.
 * Run on a schedule (e.g. EventBridge every 15 min).
 *
 * Uses GSI "ReleaseSchedule" (PK=releaseStatus, SK=scheduledDropDate) to Query
 * only HELD items due for release — no table Scan.
 * Sets isVisible=true, status=PUBLISHED, airdate=scheduledDropDate and REMOVEs
 * releaseStatus/scheduledDropDate so the drop becomes playable.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const dynamodb = DynamoDBDocumentClient.from(client);
const TableName = 'Twilly';
const ReleaseScheduleIndex = 'ReleaseSchedule'; // GSI: PK=releaseStatus, SK=scheduledDropDate

exports.handler = async (event) => {
  const now = new Date().toISOString();
  console.log('Release scheduled drops: querying GSI for releaseStatus=HELD, scheduledDropDate <=', now);

  try {
    const queryParams = {
      TableName,
      IndexName: ReleaseScheduleIndex,
      KeyConditionExpression: 'releaseStatus = :held AND scheduledDropDate <= :now',
      ExpressionAttributeValues: { ':held': 'HELD', ':now': now }
    };

    const queryResult = await dynamodb.send(new QueryCommand(queryParams));
    const items = queryResult.Items || [];
    console.log(`Found ${items.length} scheduled drop(s) due for release`);

    const results = { released: 0, errors: [] };

    for (const item of items) {
      const scheduledDropDate = item.scheduledDropDate;
      if (!scheduledDropDate || new Date(scheduledDropDate) > new Date()) continue;

      const pk = item.PK;
      const sk = item.SK;
      if (!pk || !sk) {
        results.errors.push({ pk, sk, reason: 'Missing PK or SK' });
        continue;
      }

      try {
        await dynamodb.send(new UpdateCommand({
          TableName,
          Key: { PK: pk, SK: sk },
          UpdateExpression: 'SET isVisible = :vis, #status = :pub, airdate = :air, updatedAt = :upd REMOVE scheduledDropDate, releaseStatus',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':vis': true,
            ':pub': 'PUBLISHED',
            ':air': scheduledDropDate,
            ':upd': now
          }
        }));
        results.released++;
        console.log(`Released: ${pk} ${sk} (scheduledDropDate=${scheduledDropDate})`);
      } catch (err) {
        console.error(`Error releasing ${pk} ${sk}:`, err.message);
        results.errors.push({ pk, sk, reason: err.message });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Released ${results.released} scheduled drop(s)`,
        released: results.released,
        errors: results.errors.length ? results.errors : undefined
      })
    };
  } catch (error) {
    console.error('Release scheduled drops error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Release scheduled drops failed', error: error.message })
    };
  }
};
