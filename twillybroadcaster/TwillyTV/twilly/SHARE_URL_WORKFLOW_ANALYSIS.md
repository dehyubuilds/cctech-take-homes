# Share URL Workflow Analysis & Troubleshooting

## Current Workflow

### 1. **URL Shortening (Frontend → Backend → DynamoDB)**

**Frontend Flow:**
- User clicks "Generate Share Link" in `pages/managefiles.vue` or `pages/profile.vue`
- Frontend calls `taskStore.shortenUrl()` from `stores/TaskStore.js`
- This calls `/api/message/shortenUrl` (Nuxt API endpoint)

**Backend Flow (`server/api/message/shortenUrl/index.post.js`):**
1. Receives URL, creator, series, and userEmail
2. Generates a random shortId: `crypto.randomBytes(4).toString('hex')` (8 characters)
3. Creates short URL: `https://share.twilly.app/${shortId}`
4. Stores mapping in DynamoDB:
   - PK: `SHORT_URL`
   - SK: `{shortId}`
   - Fields: `longUrl`, `creator`, `series`, `originalEmail`, `originalSeries`, `originalPosterUrl`, `title`, `description`, etc.
5. Returns `{ returnResult: "https://share.twilly.app/{shortId}" }`

### 2. **URL Redirect (Share Link Click → API Gateway → Lambda → Redirect)**

**When someone visits `https://share.twilly.app/{shortId}`:**

1. **DNS Resolution:**
   - `share.twilly.app` should resolve to API Gateway custom domain
   - **⚠️ POTENTIAL ISSUE: DNS may not be configured correctly**

2. **API Gateway:**
   - Custom domain `share.twilly.app` should be configured
   - Route: `GET /{shortId}` → Lambda function `UrlRedirectFunction`
   - **⚠️ POTENTIAL ISSUE: Custom domain may not exist or certificate expired**

3. **Lambda Function (`lambda-url-shortener-get.js`):**
   - Receives `shortId` from path parameters
   - Queries DynamoDB: PK=`SHORT_URL`, SK=`{shortId}`
   - Determines redirect URL based on URL type (channel, collaborator, talent-request, etc.)
   - Returns HTTP 302 redirect with `Location` header

4. **Redirect:**
   - User is redirected to the full URL (e.g., `https://twilly.app/username/channel-name`)

## AWS Infrastructure Components

### What Was Working:
- ✅ Lambda function `UrlRedirectFunction` exists
- ✅ DynamoDB table `Twilly` with `SHORT_URL` records
- ✅ API Gateway HTTP API (`twilly-url-shortener-api`)
- ✅ Route: `GET /{shortId}` configured

### What's Likely Broken:

#### 1. **Custom Domain Configuration (MOST LIKELY ISSUE)**
The domain `share.twilly.app` needs:
- API Gateway custom domain configured
- SSL/TLS certificate from AWS Certificate Manager (ACM)
- Certificate must be in `us-east-1` region (required for API Gateway)
- DNS record (CNAME or A record) pointing to API Gateway domain

**Check:**
```bash
# Check if custom domain exists
aws apigatewayv2 get-domain-names --region us-east-1

# Check certificate status
aws acm list-certificates --region us-east-1
```

#### 2. **Certificate Expiration**
If certificate expired:
- Certificate must be renewed in ACM
- API Gateway custom domain must be updated to use new certificate
- DNS records may need to be updated

#### 3. **Route53 DNS Configuration**
Check if DNS record exists:
```bash
# Check Route53 hosted zones
aws route53 list-hosted-zones

# Check records for share.twilly.app
aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID>
```

## Deployment Scripts Found

### `deploy-url-shortener-api.sh`
- Deploys Lambda functions
- Creates/updates API Gateway HTTP API
- Creates routes for POST `/url-shortener` and GET `/{shortId}`
- **⚠️ Does NOT configure custom domain or certificates**

### Missing Components:
- No script for custom domain setup
- No script for certificate management
- No script for Route53 DNS configuration

## Solution Steps

### Step 1: Check Current Status
```bash
# Check API Gateway custom domains
aws apigatewayv2 get-domain-names --region us-east-1

# Check ACM certificates
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[?contains(DomainName, `share.twilly.app`) || contains(SubjectAlternativeNameList, `share.twilly.app`)]'
```

### Step 2: If Certificate Expired or Missing

**Option A: Request new certificate via ACM**
```bash
# Request certificate (if using DNS validation)
aws acm request-certificate \
  --domain-name share.twilly.app \
  --validation-method DNS \
  --region us-east-1
```

**Option B: Use existing certificate (if it exists but expired)**
- Go to AWS Certificate Manager
- Request new certificate for `share.twilly.app`
- Complete DNS validation
- Wait for certificate to be issued

### Step 3: Configure API Gateway Custom Domain

**Get API Gateway ID:**
```bash
API_ID=$(aws apigatewayv2 get-apis --region us-east-1 --query "Items[?Name=='twilly-url-shortener-api'].ApiId" --output text)
echo "API ID: $API_ID"
```

**Create/Update Custom Domain:**
```bash
# Create custom domain (if it doesn't exist)
aws apigatewayv2 create-domain-name \
  --domain-name share.twilly.app \
  --domain-name-configurations CertificateArn=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID \
  --region us-east-1

# Create API mapping
aws apigatewayv2 create-api-mapping \
  --domain-name share.twilly.app \
  --api-id $API_ID \
  --stage default \
  --api-mapping-key "" \
  --region us-east-1
```

### Step 4: Configure Route53 DNS

Get API Gateway domain name:
```bash
aws apigatewayv2 get-domain-name \
  --domain-name share.twilly.app \
  --region us-east-1 \
  --query 'DomainNameConfigurations[0].TargetDomainName'
```

Create Route53 record:
```bash
# Point share.twilly.app to API Gateway custom domain
aws route53 change-resource-record-sets \
  --hosted-zone-id <YOUR_ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "share.twilly.app",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "<API_GATEWAY_DOMAIN>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

## Alternative Solution: Use Nuxt Route Instead

If AWS infrastructure is too complex to fix, consider using Nuxt route handler:

1. Create `pages/s/[shortId].vue` that handles redirects
2. Update frontend to return `https://twilly.app/s/${shortId}` instead
3. The Nuxt route queries DynamoDB and redirects

**Pros:** No certificate/DNS issues, simpler
**Cons:** Longer URLs, less clean branding

## Testing

Test the workflow:
```bash
# 1. Generate a short URL (via frontend)
# 2. Check DynamoDB entry was created
aws dynamodb get-item \
  --table-name Twilly \
  --key '{"PK": {"S": "SHORT_URL"}, "SK": {"S": "TEST_SHORT_ID"}}'

# 3. Test Lambda directly
aws lambda invoke \
  --function-name UrlRedirectFunction \
  --payload '{"pathParameters": {"shortId": "TEST_SHORT_ID"}}' \
  response.json

# 4. Test via curl
curl -I https://share.twilly.app/TEST_SHORT_ID
```

## Files Involved

### Frontend:
- `stores/TaskStore.js` - Calls shortenUrl API
- `pages/managefiles.vue` - Share link generation UI
- `pages/profile.vue` - Share link generation UI

### Backend (Nuxt API):
- `server/api/message/shortenUrl/index.post.js` - Creates short URLs

### AWS Infrastructure:
- `lambda-url-shortener-get.js` - Handles redirects
- `deploy-url-shortener-api.sh` - Deployment script

### Missing:
- Custom domain setup script
- Certificate management
- Route53 DNS configuration

