# Deploy access and where twilly.app runs

## SSH fix (why it failed before)

The deploy script was using the **first** key it found: `twilly-streaming-key.pem`.  
Your EC2 instance uses **`twilly-streaming-key-1750894315`** (the KeyName in AWS).  
So the script was using the wrong key and got "Permission denied (publickey)".

**What we changed:** both deploy scripts now prefer the key that matches the instance:

- `scripts/deploy-trailer-api.sh` – tries `twilly-streaming-key-1750894315.pem` first  
- `scripts/deploy-get-content-fix.sh` – same key order  

SSH with that key works:  
`ssh -i ~/.ssh/twilly-streaming-key-1750894315.pem ec2-user@100.24.103.57`

---

## Where things run

| What | Where |
|------|--------|
| **twilly.app (API + site)** | **Netlify** (IPs 98.84.224.111, 18.208.88.157). Not on the EC2. |
| **EC2 100.24.103.57** | Streaming/RTMP (streaming-service-server, variant processors, nginx HLS). |

So:

- **Trailer API (and any Nuxt API) for twilly.app** must be deployed **to Netlify** (e.g. push to the repo connected to Netlify, or `netlify deploy --prod` from the twilly app directory).
- The **trailer API files were also copied to EC2** at `~/twilly/server/api/drops/` and `~/twilly/server/api/trailers/` for consistency, but nothing on that EC2 is currently serving the twilly.app API.

---

## How to get the trailer API live on twilly.app

1. **If Netlify builds from Git**  
   Commit and push the new API routes (they’re already in the repo). After Netlify builds and deploys, the trailer endpoints will be live.

2. **If you use Netlify CLI**  
   From the twilly app directory (the one with `nuxt.config` and `server/api`):
   ```bash
   cd /path/to/twilly   # e.g. TwillyTV/twilly
   npm run build
   netlify deploy --prod
   ```
   (Exact command may depend on your Netlify project setup.)

3. **EC2**  
   Use the updated scripts whenever you deploy API or streaming changes to that box; SSH will work with the key order we set.

---

## Quick reference

- **EC2:** `100.24.103.57`, user `ec2-user`, key `~/.ssh/twilly-streaming-key-1750894315.pem`
- **Deploy trailer API to EC2 (for reference):** `./scripts/deploy-trailer-api.sh`
- **Live twilly.app API:** deploy the Nuxt app (with the new `server/api` routes) to Netlify.
