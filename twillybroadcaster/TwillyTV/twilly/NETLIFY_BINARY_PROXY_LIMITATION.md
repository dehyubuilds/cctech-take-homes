# Critical Issue: Netlify Serverless Binary Proxy Limitation

## Problem

**Netlify serverless functions cannot properly proxy binary video segments.** All attempts to return binary data result in serialization/corruption:

- ❌ `Buffer` → Serialized to text
- ❌ `Uint8Array` → Serialized to text  
- ❌ `sendRaw(buffer)` → Serialized to text
- ❌ `sendStream(response.body)` → Serialized to `[object ReadableStream]` string

## Error

Browser receives corrupted segments → `DEMUXER_ERROR_COULD_NOT_PARSE`

## Solutions (In Order of Preference)

### 1. **Set Up HTTPS on EC2 NGINX** (BEST SOLUTION)
   - Configure SSL/TLS certificate on EC2 NGINX
   - Serve HLS directly over HTTPS
   - **No proxy needed** - browser can load directly
   - **Implementation**: Use Let's Encrypt or AWS Certificate Manager

### 2. **Use CloudFront Distribution**
   - Create CloudFront distribution pointing to EC2 HTTP
   - CloudFront automatically handles HTTPS
   - CloudFront can proxy binary correctly
   - **Implementation**: Set up CloudFront origin for `http://100.24.103.57`

### 3. **Use AWS Lambda + API Gateway** (Alternative Serverless)
   - AWS Lambda can handle binary responses correctly with proper configuration
   - API Gateway supports binary media types
   - More complex setup but works for binary streaming

### 4. **Use Regular Node.js Server** (Not Serverless)
   - Deploy a regular Node.js/Express server (e.g., on EC2, Heroku, Railway)
   - Regular servers can proxy binary without issues
   - More infrastructure to manage

## Current Workaround

Using HLS.js (forced for all browsers) to get better error messages, but segments are still corrupted and playback will not work until proxy issue is resolved.

## Recommendation

**Option 1 (HTTPS on EC2) is the best solution** - it's the simplest and most performant. No proxy needed, direct HTTPS connection from browser to EC2.
