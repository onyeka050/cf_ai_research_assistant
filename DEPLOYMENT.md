# Deployment Guide

## Quick Deploy (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Login to Cloudflare
```bash
npx wrangler login
```
This opens your browser to authenticate with Cloudflare.

### Step 3: Deploy
```bash
npm run deploy
```

That's it! Your app is now live at the URL Wrangler outputs.

---

## Detailed Deployment Steps

### Prerequisites Checklist
- [ ] Node.js 18 or higher installed
- [ ] Cloudflare account created (free tier is fine)
- [ ] Terminal/command prompt access

### First-Time Setup

#### 1. Install Wrangler (if not already installed)
```bash
npm install -g wrangler
```

#### 2. Authenticate
```bash
wrangler login
```
This will:
- Open your default browser
- Ask you to log in to Cloudflare
- Authorize Wrangler to access your account

#### 3. Verify Authentication
```bash
wrangler whoami
```
Should show your Cloudflare account email.

### Deploy to Production

#### Option A: Quick Deploy
```bash
npm run deploy
```

#### Option B: Manual Deploy
```bash
npx wrangler deploy
```

### What Happens During Deploy

1. **TypeScript Compilation**: Your TypeScript code is compiled
2. **Bundling**: All code is bundled into a single Worker script
3. **Upload**: Code is uploaded to Cloudflare's network
4. **Durable Object Migration**: Durable Objects are provisioned
5. **Workers AI Binding**: AI capabilities are linked
6. **Global Distribution**: Your Worker is deployed to 300+ locations

### After Deployment

You'll see output like:
```
✨ Deployed ai-research-assistant
   https://ai-research-assistant.your-subdomain.workers.dev
```

**Your app is now live!** Visit the URL to use it.

---

## Environment-Specific Deployments

### Development Environment
```bash
npm run dev
```
Runs locally at `http://localhost:8787`

### Production Environment
```bash
npm run deploy
```
Deploys to `*.workers.dev` domain

### Custom Domain (Optional)

After initial deployment, you can add a custom domain:

1. Go to Cloudflare Dashboard
2. Select your Worker
3. Click "Triggers" tab
4. Click "Add Custom Domain"
5. Enter your domain (must be on Cloudflare)

---

## Monitoring Your Deployment

### View Logs
```bash
npx wrangler tail
```
Shows real-time logs from your Worker.

### Check Status
Visit Cloudflare Dashboard → Workers & Pages → Your Worker

### View Analytics
Dashboard shows:
- Request count
- Error rate
- CPU time
- Response time

---

## Troubleshooting Deployment

### Error: "Not authenticated"
**Solution:**
```bash
wrangler login
```

### Error: "No wrangler.toml found"
**Solution:** Make sure you're in the project directory:
```bash
cd ai-research-assistant
```

### Error: "Durable Object binding not found"
**Solution:** Check `wrangler.toml` has:
```toml
[[durable_objects.bindings]]
name = "CONVERSATIONS"
class_name = "ConversationManager"
```

### Error: "Workers AI not available"
**Solution:** 
- Workers AI must be enabled in your Cloudflare account
- Check dashboard: Workers & Pages → AI
- May need to accept terms of service

### Deployment is slow
**Normal:** First deployment can take 2-3 minutes
**Subsequent deployments:** Usually 30-60 seconds

---

## Updating Your Deployment

### Make Changes
1. Edit files locally
2. Test with `npm run dev`
3. Commit changes (if using Git)

### Deploy Updates
```bash
npm run deploy
```
Updates are atomic and instant - no downtime!

### Rollback (if needed)
```bash
npx wrangler rollback
```
Rolls back to previous deployment.

---

## Cost Considerations

### Cloudflare Free Tier Includes:
- 100,000 Worker requests/day
- 10,000 Durable Object requests/day
- Workers AI usage (pay-as-you-go)

### Typical Usage Costs:
- **Light usage** (100 chats/day): ~$1-2/month
- **Moderate usage** (1,000 chats/day): ~$5-10/month
- **Heavy usage** (10,000 chats/day): ~$50-100/month

Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/

### Monitor Costs:
Dashboard → Account Home → Billing

---

## Production Checklist

Before deploying to production:

- [ ] Test locally with `npm run dev`
- [ ] Test all features (send message, clear chat, refresh page)
- [ ] Check browser console for errors
- [ ] Verify Durable Objects are working (messages persist)
- [ ] Test on mobile device/responsive view
- [ ] Set up monitoring/alerts (optional)
- [ ] Add custom domain (optional)
- [ ] Enable error tracking (optional)

---

## CI/CD Integration (Optional)

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Setup:
1. Generate API token in Cloudflare Dashboard
2. Add as GitHub Secret: `CLOUDFLARE_API_TOKEN`
3. Push to main branch to auto-deploy

---

## Multiple Environments

### Development
```toml
# wrangler.toml
name = "ai-research-assistant-dev"
```

### Production
```toml
# wrangler.prod.toml
name = "ai-research-assistant"
```

Deploy to specific environment:
```bash
npx wrangler deploy --config wrangler.prod.toml
```

---

## Support

### Getting Help
- Cloudflare Discord: https://discord.gg/cloudflaredev
- Cloudflare Community: https://community.cloudflare.com/
- Wrangler Issues: https://github.com/cloudflare/workers-sdk/issues

### Common Questions

**Q: How do I delete my deployment?**
A: Dashboard → Workers & Pages → Select Worker → Settings → Delete

**Q: Can I test without deploying?**
A: Yes! Use `npm run dev` for local testing

**Q: How do I see my Worker logs?**
A: Run `npx wrangler tail` or view in Dashboard

**Q: Is there a deployment limit?**
A: Free tier: Unlimited deployments, but request limits apply

---

**Ready to deploy?** Run `npm run deploy` and you're live! 🚀
