# How to Test the Trailer Queue + Lambda

## What’s already done

- **SQS:** `twilly-trailer-queue` and `twilly-trailer-dlq` created (us-east-1)
- **Lambda:** `twilly-trailer-worker` created, 15 min timeout, 3008 MB, wired to the queue
- **IAM:** Lambda role has SQS (trailer queue), DynamoDB (Twilly Get/Update), S3 (theprivatecollection)

---

## Step 1: Add the FFmpeg layer (required for real runs)

Without this, the Lambda will run but fail as soon as it tries to run FFmpeg.

1. **Deploy the public FFmpeg layer** (one-time):
   - Open: https://serverlessrepo.aws.amazon.com/applications/us-east-1/145266761615/ffmpeg-lambda-layer  
   - Click **Deploy**, choose your account/region (us-east-1), deploy.
   - In **CloudFormation → Stacks → the new stack → Outputs**, copy the **LayerArn** (or in **Lambda → Layers** copy the new layer’s ARN).

2. **Attach the layer to the function:**
   ```bash
   aws lambda update-function-configuration \
     --function-name twilly-trailer-worker \
     --layers "YOUR_FFMPEG_LAYER_ARN" \
     --region us-east-1
   ```

Replace `YOUR_FFMPEG_LAYER_ARN` with the ARN from step 1 (e.g. `arn:aws:lambda:us-east-1:145266761615:layer:ffmpeg:1` or the ARN in your account after deploying the SAR app).

---

## Step 2: Create a trailer record in DynamoDB

The worker expects an item with `PK = USER#<creatorEmail>` and `SK = TRAILER#<trailerId>`. Create it **before** sending the SQS message.

Use a real creator email and a drop that has an `hlsUrl`. Example (replace values):

```bash
TRAILER_ID="trl_test_$(date +%s)"
DROP_ID="file-upload-1234567890-abc"   # use a real drop/fileId from your DB
OWNER_EMAIL="your@email.com"            # creator who owns the drop
# Use a real HLS URL from a processed drop (e.g. from get-content or the FILE item’s hlsUrl)
HLS_URL="https://d4idc5cmwxlpy.cloudfront.net/clips/sk_xxx/uploadId/master.m3u8"

aws dynamodb put-item \
  --table-name Twilly \
  --item '{
    "PK": {"S": "USER#'"$OWNER_EMAIL"'"},
    "SK": {"S": "TRAILER#'"$TRAILER_ID"'"},
    "trailerId": {"S": "'"$TRAILER_ID"'"},
    "dropId": {"S": "'"$DROP_ID"'"},
    "ownerEmail": {"S": "'"$OWNER_EMAIL"'"},
    "status": {"S": "REQUESTED"},
    "startTimeSec": {"N": "5"},
    "endTimeSec": {"N": "15"},
    "durationSec": {"N": "10"},
    "sourceVideoUrl": {"S": "'"$HLS_URL"'"},
    "overlayTemplateVersion": {"S": "v1"},
    "createdAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"},
    "updatedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"},
    "requestedAt": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"'"}
  }' \
  --region us-east-1
```

Keep `TRAILER_ID`, `DROP_ID`, `OWNER_EMAIL`, `HLS_URL` for the next step.

---

## Step 3: Send a message to the trailer queue

This triggers the Lambda. Use the **same** `TRAILER_ID`, `OWNER_EMAIL`, and a valid `HLS_URL` (start/end within the video length).

```bash
aws sqs send-message \
  --queue-url "https://sqs.us-east-1.amazonaws.com/142770202579/twilly-trailer-queue" \
  --message-body '{
    "trailerId": "'"$TRAILER_ID"'",
    "dropId": "'"$DROP_ID"'",
    "ownerEmail": "'"$OWNER_EMAIL"'",
    "sourceVideoUrl": "'"$HLS_URL"'",
    "startTimeSec": 5,
    "endTimeSec": 15,
    "durationSec": 10,
    "username": "yourusername",
    "scheduledDropDate": null
  }' \
  --region us-east-1
```

---

## Step 4: Check the result

1. **Lambda logs**  
   **CloudWatch → Log groups → /aws/lambda/twilly-trailer-worker**  
   - You should see “Trailer worker invoked” and then either “Set status PROCESSING” and “Trailer READY” or an FFmpeg/DynamoDB error.

2. **DynamoDB**  
   Get the trailer item:
   ```bash
   aws dynamodb get-item \
     --table-name Twilly \
     --key '{"PK":{"S":"USER#'"$OWNER_EMAIL"'"},"SK":{"S":"TRAILER#'"$TRAILER_ID"'"}}' \
     --region us-east-1
   ```
   - **Success:** `status` = `READY`, `outputUrl` set (S3 or CloudFront), `outputWidth`/`outputHeight`/`fileSizeBytes` present.
   - **Failure:** `status` = `FAILED`, `errorMessage` set.

3. **S3**  
   If status is READY, open `outputUrl` or check:
   ```text
   s3://theprivatecollection/trailers/<dropId>/<trailerId>.mp4
   ```

---

## Quick smoke test (without FFmpeg layer)

To confirm the Lambda is triggered and fails at FFmpeg (so queue → Lambda wiring works):

1. Create a trailer item in DynamoDB (Step 2) with any valid-looking `sourceVideoUrl`.
2. Send the SQS message (Step 3).
3. In CloudWatch logs you should see “Set status PROCESSING” and then an error like “FFmpeg exited” or “spawn ffmpeg ENOENT”.  
4. Add the FFmpeg layer (Step 1), then repeat with a real HLS URL to get a READY trailer.

---

## Queue / Lambda reference

| Item        | Value |
|------------|--------|
| Queue URL  | `https://sqs.us-east-1.amazonaws.com/142770202579/twilly-trailer-queue` |
| Lambda     | `twilly-trailer-worker` |
| Table      | `Twilly` |
| S3 prefix  | `trailers/{dropId}/{trailerId}.mp4` |
