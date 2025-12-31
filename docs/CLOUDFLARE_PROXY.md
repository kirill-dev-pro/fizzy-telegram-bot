# Cloudflare Worker Telegram API Proxy

If your hosting provider (like Railway) blocks access to the Telegram API (`api.telegram.org`), you can use Cloudflare Workers as a free proxy to route requests through.

## Why Use This?

Some hosting providers block external API calls including Telegram's API. Cloudflare Workers can act as a simple proxy with:

- Free tier with 100,000 requests/day
- Low latency global network
- Simple deployment

## Setup Instructions

### 1. Create Cloudflare Worker

1. Sign up or log in at [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages**
3. Click **Create Application** → **Create Worker**
4. Name your worker (e.g., `telegram-api-proxy`)
5. Click **Deploy**

### 2. Deploy Proxy Code

1. After creating the worker, click **Edit Code**
2. Replace the default code with the contents of `cloudflare-worker.js`:

   ```javascript
   export default {
     async fetch(request) {
       const url = new URL(request.url);

       // Rewrite the URL to point to Telegram API
       const telegramUrl = `https://api.telegram.org${url.pathname}${url.search}`;

       // Forward the request to Telegram API
       return fetch(telegramUrl, {
         method: request.method,
         headers: request.headers,
         body: request.method !== "GET" ? request.body : undefined,
       });
     },
   };
   ```

3. Click "Save and Deploy"
4. Copy your worker URL (e.g., `https://telegram-api-proxy.YOUR-SUBDOMAIN.workers.dev`)

### 3. Configure Your Bot

Add the `TELEGRAM_API_PROXY_URL` environment variable to your deployment:

**In Railway:**

1. Go to your Railway project
2. Navigate to **Variables**
3. Add new variable:

   ```bash
   TELEGRAM_API_PROXY_URL=https://telegram-api-proxy.YOUR-SUBDOMAIN.workers.dev
   ```

4. Redeploy your application

**In .env (local development):**

```bash
BOT_TOKEN=your_telegram_bot_token
TELEGRAM_API_PROXY_URL=https://telegram-api-proxy.YOUR-SUBDOMAIN.workers.dev
```

### 4. Verify It's Working

When you start your bot, you should see this log message:

```text
Using Telegram API proxy: https://telegram-api-proxy.YOUR-SUBDOMAIN.workers.dev
```

## Testing

You can test the proxy is working by running:

```bash


# Direct Telegram API call (may fail if blocked)
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe

# Through your Cloudflare Worker proxy (should work)
curl https://telegram-api-proxy.YOUR-SUBDOMAIN.workers.dev/bot<YOUR_BOT_TOKEN>/getMe
```

Both should return the same bot information if the proxy is working correctly.

## Limitations

- Cloudflare Workers free tier: 100,000 requests/day
- 10ms CPU time per request
- This should be more than enough for most Telegram bots

## Troubleshooting

**Bot still can't connect:**

- Verify the `TELEGRAM_API_PROXY_URL` is set correctly, ensure no slash "/" at the end
- Check the worker is deployed and accessible
- Test the worker URL directly with curl

**Worker quota exceeded:**

- Upgrade to Cloudflare Workers paid plan ($5/month for 10M requests)
- Or optimize your bot to make fewer API calls

**CORS or request issues:**

- The worker forwards all headers, so authentication should work seamlessly
- Check Cloudflare Worker logs for any errors

## Security Notes

- The worker simply proxies requests to Telegram API
- Your bot token is still sent securely (HTTPS)
- The worker doesn't log or store any data
- Only use this worker for your own bot traffic

## Alternative Solutions

If you don't want to use Cloudflare Workers, you can also:

1. **Change hosting provider** to one that doesn't block Telegram API (Heroku, DigitalOcean, etc.)
2. **Use a VPS** with unrestricted network access
3. **Run your own proxy server** (if you have existing infrastructure)
