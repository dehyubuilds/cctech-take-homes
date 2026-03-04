# FFmpeg Lambda Layer Setup

## Overview
The thumbnail generator Lambda needs FFmpeg to process video files. This document explains how to create the FFmpeg Lambda layer.

## Lambda Layer Creation

### 1. Download FFmpeg Binary
```bash
# Create layer directory
mkdir -p ffmpeg-layer/bin
cd ffmpeg-layer

# Download FFmpeg static binary for Lambda
wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
tar -xf ffmpeg-release-amd64-static.tar.xz

# Copy FFmpeg binary to layer
cp ffmpeg-*-amd64-static/ffmpeg bin/
chmod +x bin/ffmpeg

# Clean up
rm -rf ffmpeg-*-amd64-static*
```

### 2. Create Layer Package
```bash
# Create layer structure
mkdir -p ffmpeg-layer
cd ffmpeg-layer

# Copy FFmpeg binary
cp ../bin/ffmpeg bin/

# Create layer package
zip -r ffmpeg-layer.zip .
```

### 3. Upload to AWS
```bash
# Create Lambda layer
aws lambda publish-layer-version \
  --layer-name ffmpeg-layer \
  --description "FFmpeg for video processing" \
  --content S3Bucket=twilly-lambda-layers,S3Key=ffmpeg-layer.zip \
  --compatible-runtimes nodejs18.x \
  --compatible-architectures x86_64
```

## Lambda Function Configuration

### 1. Environment Variables
```javascript
// Add to Lambda function
process.env.PATH = `/opt/bin:${process.env.PATH}`;
```

### 2. Lambda Function Code
```javascript
// The thumbnail generator will automatically use FFmpeg from /opt/bin
const ffmpeg = spawn('/opt/bin/ffmpeg', thumbnailArgs, {
  stdio: ['pipe', 'pipe', 'pipe']
});
```

## Testing the Layer

### 1. Test FFmpeg Availability
```javascript
// Add this to your Lambda function for testing
const { exec } = require('child_process');

exec('/opt/bin/ffmpeg -version', (error, stdout, stderr) => {
  if (error) {
    console.error('FFmpeg not available:', error);
  } else {
    console.log('FFmpeg version:', stdout);
  }
});
```

## Deployment Steps

### 1. Create the Layer
```bash
# Follow the setup steps above to create ffmpeg-layer.zip
# Upload to S3
aws s3 cp ffmpeg-layer.zip s3://twilly-lambda-layers/

# Create Lambda layer
aws lambda publish-layer-version \
  --layer-name ffmpeg-layer \
  --description "FFmpeg for video processing" \
  --content S3Bucket=twilly-lambda-layers,S3Key=ffmpeg-layer.zip \
  --compatible-runtimes nodejs18.x
```

### 2. Attach Layer to Function
```bash
# Get the layer ARN
LAYER_ARN=$(aws lambda list-layer-versions --layer-name ffmpeg-layer --query 'LayerVersions[0].LayerVersionArn' --output text)

# Update Lambda function with layer
aws lambda update-function-configuration \
  --function-name twilly-thumbnail-generator \
  --layers $LAYER_ARN
```

## Verification

### 1. Test Thumbnail Generation
```bash
# Invoke Lambda function with test event
aws lambda invoke \
  --function-name twilly-thumbnail-generator \
  --payload '{"streamKey":"test","schedulerId":"test","flvPath":"/tmp/test.flv","uniquePrefix":"test_2024"}' \
  response.json
```

### 2. Check S3 for Uploaded Thumbnail
```bash
# Check if thumbnail was uploaded
aws s3 ls s3://theprivatecollection/clips/test/test/
```

## Troubleshooting

### Common Issues:
1. **FFmpeg not found**: Ensure layer is attached and PATH is set
2. **Permission denied**: Check Lambda execution role permissions
3. **Timeout**: Increase Lambda timeout for large video files
4. **Memory issues**: Increase Lambda memory allocation

### Debug Commands:
```bash
# Check Lambda function configuration
aws lambda get-function --function-name twilly-thumbnail-generator

# Check CloudWatch logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/twilly-thumbnail-generator
``` 