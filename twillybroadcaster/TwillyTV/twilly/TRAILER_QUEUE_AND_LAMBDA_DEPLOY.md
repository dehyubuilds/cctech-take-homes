# Trailer Queue + Lambda Deployment

This guide deploys the **separate SQS queue** and **trailer-worker Lambda** for Twilly TV trailer generation.

## Prerequisites

- AWS CLI configured (region `us-east-1` recommended)
- Node.js 18+ (for packaging Lambda)
- FFmpeg Lambda layer (see below)

---

## 1. Create the SQS queue

From the `twilly` directory:

```bash
cd infrastructure
chmod +x create-trailer-queue.sh
./create-trailer-queue.sh us-east-1
```

This creates:

- **twilly-trailer-dlq** – dead-letter queue (messages after 3 failed receives)
- **twilly-trailer-queue** – main queue (use this URL when sending trailer jobs)

Note the **Main queue URL** (e.g. `https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/twilly-trailer-queue`) for the API and for the Lambda event source.

---

## 2. FFmpeg Lambda layer

The trailer worker needs FFmpeg and FFprobe at `/opt/bin/ffmpeg` and `/opt/bin/ffprobe`.

**Option A – Serverless Application Repository (recommended)**

1. Open [AWS SAR – ffmpeg-lambda-layer](https://serverlessrepo.aws.amazon.com/applications/us-east-1/145266761615/ffmpeg-lambda-layer).
2. Deploy the application to your account (creates a layer in your account).
3. Copy the **Layer ARN** from the stack output or from **Lambda → Layers** in the console.

**Option B – Build from GitHub**

- [serverlesspub/ffmpeg-aws-lambda-layer](https://github.com/serverlesspub/ffmpeg-aws-lambda-layer): build and publish a layer that provides `/opt/bin/ffmpeg` and `/opt/bin/ffprobe`, then note the layer ARN.

---

## 3. Package and create the Lambda function

From the project root (e.g. `TwillyTV/twilly`):

```bash
cd twilly

# Install SDK deps for Lambda (if not already in package.json)
npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb --save

# Create deployment package (handler + node_modules)
mkdir -p dist/trailer-worker
cp lambda/trailer-worker.js dist/trailer-worker/
cd dist/trailer-worker
npm init -y
npm install @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
zip -r ../trailer-worker.zip .
cd ..
# trailer-worker.zip is at dist/trailer-worker.zip
```

Create the function (replace `YOUR_ACCOUNT_ID`, `YOUR_FFMPEG_LAYER_ARN`, `YOUR_TRAILER_QUEUE_ARN`):

```bash
aws lambda create-function \
  --function-name twilly-trailer-worker \
  --runtime nodejs18.x \
  --handler trailer-worker.handler \
  --zip-file fileb://dist/trailer-worker.zip \
  --timeout 900 \
  --memory-size 3008 \
  --layers "YOUR_FFMPEG_LAYER_ARN" \
  --environment "Variables={DYNAMODB_TABLE=Twilly,TRAILER_BUCKET=theprivatecollection,REGION=us-east-1}" \
  --region us-east-1
```

To get the queue ARN for the next step:

```bash
aws sqs get-queue-attributes \
  --queue-url "https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/twilly-trailer-queue" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' --output text
```

---

## 4. Permissions

**Execution role** (created automatically by `create-function` has basic Lambda logs). Add:

- **SQS:** receive message, delete message, get queue attributes on `twilly-trailer-queue`
- **DynamoDB:** GetItem, UpdateItem on table `Twilly` (for trailer items keyed by `USER#email` and `SK=TRAILER#trailerId`)
- **S3:** PutObject on bucket `theprivatecollection` (or your `TRAILER_BUCKET`), prefix `trailers/`

Example policy (attach to the Lambda execution role):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:us-east-1:YOUR_ACCOUNT_ID:twilly-trailer-queue"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/Twilly"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::theprivatecollection/trailers/*"
    }
  ]
}
```

---

## 5. Wire SQS as event source

So that each message on `twilly-trailer-queue` invokes the Lambda:

```bash
aws lambda create-event-source-mapping \
  --function-name twilly-trailer-worker \
  --event-source-arn "arn:aws:sqs:us-east-1:YOUR_ACCOUNT_ID:twilly-trailer-queue" \
  --batch-size 1 \
  --region us-east-1
```

Use `batch-size 1` so one trailer job runs per invocation (FFmpeg is CPU-heavy).

---

## 6. Environment variables (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `DYNAMODB_TABLE` | Twilly | DynamoDB table name |
| `TRAILER_BUCKET` | theprivatecollection | S3 bucket for trailer MP4s |
| `TRAILER_BASE_URL` | (none) | Base URL for `outputUrl` (e.g. CloudFront); if empty, S3 URL is used |
| `REGION` | us-east-1 | AWS region |
| `TWILLY_LOGO_URL` | (CloudFront logo URL) | Optional logo PNG for overlay |

---

## 7. Sending a trailer job (from your API)

When creating a trailer (e.g. in `POST /api/drops/:dropId/trailers`), after writing the trailer item to DynamoDB with status `REQUESTED`, send a message to the queue:

```javascript
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqs = new SQSClient({ region: 'us-east-1' });
const TRAILER_QUEUE_URL = process.env.TRAILER_QUEUE_URL || 'https://sqs.us-east-1.amazonaws.com/ACCOUNT_ID/twilly-trailer-queue';

await sqs.send(new SendMessageCommand({
  QueueUrl: TRAILER_QUEUE_URL,
  MessageBody: JSON.stringify({
    trailerId,
    dropId,
    ownerEmail,
    sourceVideoUrl: drop.hlsUrl,
    startTimeSec,
    endTimeSec,
    durationSec,
    username: creatorUsername,
    scheduledDropDate: drop.scheduledDropDate || null,
  }),
}));
```

---

## 8. Updating the Lambda (after code changes)

```bash
cd twilly
# Repackage (see step 3)
cd dist/trailer-worker && zip -r ../trailer-worker.zip . && cd ..
aws lambda update-function-code \
  --function-name twilly-trailer-worker \
  --zip-file fileb://dist/trailer-worker.zip \
  --region us-east-1
```

---

## Summary

| Resource | Name / Path |
|----------|-------------|
| SQS main queue | `twilly-trailer-queue` |
| SQS DLQ | `twilly-trailer-dlq` |
| Lambda | `twilly-trailer-worker` |
| Lambda handler | `lambda/trailer-worker.js` |
| S3 trailer path | `trailers/{dropId}/{trailerId}.mp4` |
| DynamoDB | Table `Twilly`, items `PK=USER#email`, `SK=TRAILER#trailerId` |
