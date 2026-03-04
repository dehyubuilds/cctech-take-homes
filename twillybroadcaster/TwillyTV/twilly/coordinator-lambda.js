const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');

const sqs = new SQSClient({ region: 'us-east-1' });

const COORDINATOR_QUEUE_URL = process.env.COORDINATOR_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/142770202579/streaming-coordinator-queue';
const AGGREGATOR_QUEUE_URL = process.env.AGGREGATOR_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/142770202579/twilly-aggregator';

exports.handler = async (event) => {
  console.log('Coordinator Lambda triggered:', JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      const message = JSON.parse(record.body);
      const { streamId, inputUrl, outputUrl, variants, action } = message;

      if (action === 'start') {
        console.log(`Starting stream processing for: ${streamId}`);
        
        // Send messages to variant processors (same queue)
        for (const variant of variants) {
          const variantMessage = {
            streamId,
            inputUrl,
            outputUrl,
            variant,
            action: 'process'
          };

          await sqs.send(new SendMessageCommand({
            QueueUrl: COORDINATOR_QUEUE_URL,
            MessageBody: JSON.stringify(variantMessage)
          }));

          console.log(`Sent variant ${variant.bitrate}k to processor for stream: ${streamId}`);
        }

        // Send completion message to aggregator (separate queue)
        const aggregatorMessage = {
          streamId,
          variants: variants.length,
          action: 'aggregate'
        };

        await sqs.send(new SendMessageCommand({
          QueueUrl: AGGREGATOR_QUEUE_URL,
          MessageBody: JSON.stringify(aggregatorMessage)
        }));

        console.log(`Sent to aggregator for stream: ${streamId}`);

      } else if (action === 'stop') {
        console.log(`Stopping stream processing for: ${streamId}`);
        
        // Send stop messages for all variants
        const stopMessage = {
          streamId,
          action: 'stop'
        };

        await sqs.send(new SendMessageCommand({
          QueueUrl: COORDINATOR_QUEUE_URL,
          MessageBody: JSON.stringify(stopMessage)
        }));

        console.log(`Stream ${streamId} stop requested`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Processing completed successfully' })
    };

  } catch (error) {
    console.error('Coordinator error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Processing failed', details: error.message })
    };
  }
}; 