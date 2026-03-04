# Certificate Validation Fix for share.twilly.app

## Problem Identified

The SSL certificate validation is failing because:

1. **DNS Architecture**: `share.twilly.app` is managed as a **CNAME record** in the parent `twilly.app` zone (via nsone.net/Netlify), NOT as a separate delegated zone in Route53.

2. **Validation Record Location**: The ACM validation CNAME record was added to a Route53 hosted zone for `share.twilly.app`, but DNS queries for `share.twilly.app` subdomains don't reach that zone - they stay in the parent `twilly.app` zone.

3. **Result**: AWS ACM cannot validate the certificate because the validation record isn't publicly resolvable.

## Solution

You need to add the ACM validation CNAME record to **wherever `twilly.app` DNS is actually managed** (likely Netlify DNS or nsone.net DNS panel).

### Validation Record Details

```
Name:  _ed93fc1c93ad65f99b34be9fa0eccec4.share.twilly.app.
Type:  CNAME
Value: _b8401da580364176362bc344c46e7195.djqtsrsxkq.acm-validations.aws.
TTL:   300 (or default)
```

### Where to Add It

1. **If using Netlify DNS:**
   - Go to Netlify Dashboard → Site Settings → Domain Management → DNS
   - Add a CNAME record with the name and value above

2. **If using nsone.net DNS:**
   - Log into nsone.net DNS management
   - Find the `twilly.app` zone
   - Add a CNAME record with the name and value above

3. **If using another DNS provider:**
   - Log into your DNS provider
   - Find where `twilly.app` zone is managed
   - Add the CNAME record there

### After Adding the Record

1. Wait 2-5 minutes for DNS propagation
2. Verify the record resolves:
   ```bash
   dig +short _ed93fc1c93ad65f99b34be9fa0eccec4.share.twilly.app CNAME
   ```
   Should return: `_b8401da580364176362bc344c46e7195.djqtsrsxkq.acm-validations.aws.`

3. Check certificate status:
   ```bash
   ./check-cert-status.sh
   ```

4. Once certificate is ISSUED, run:
   ```bash
   ./fix-custom-domain-issues.sh
   ```

## Certificate ARN

```
arn:aws:acm:us-east-1:142770202579:certificate/67b6c2c0-d173-4d0a-9294-6b07901629c0
```

## Alternative Solution (If Above Doesn't Work)

If you want to use Route53 for `share.twilly.app`:

1. Set up NS delegation in the parent `twilly.app` zone pointing to Route53 nameservers
2. Then the validation record in Route53 will work

But the simpler solution is to just add the validation record where `twilly.app` DNS is managed.

