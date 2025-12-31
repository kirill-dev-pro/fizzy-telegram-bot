# Webhook Management

This guide covers everything you need to know about managing your Telegram bot's webhook configuration.

## What is a Webhook?

A webhook tells Telegram where to send updates (messages, commands, etc.) when users interact with your bot. Without a properly configured webhook, your bot won't receive any messages.

## Quick Reference

```bash
# Check current webhook status
bun run webhook:status

# Set webhook to your deployment URL
bun run webhook:set https://your-app.railway.app

# Delete webhook (stops bot from receiving updates)
bun run webhook:delete
```

## Checking Webhook Status

View your current webhook configuration:

```bash
bun run webhook:status
```

### Example Output (Healthy)

```bash
🔗 Telegram Webhook Manager
   Using API: Proxy
   API Base: https://telegram-api-proxy.diogomf.workers.dev

📊 Current Webhook Status:

   URL: https://fizzy-tg-bot-production.up.railway.app
   Has Custom Certificate: false
   Pending Updates: 0
   Max Connections: 40
```

### Example Output (With Errors)

```bash
📊 Current Webhook Status:

   URL: https://fizzy-tg-bot-production.up.railway.app
   Pending Updates: 15

   ⚠️  Last Error: 2025-12-31T03:44:08.000Z
   Error Message: Wrong response from the webhook: 502 Bad Gateway
```

### What to Look For

- **✅ Pending Updates: 0** - Webhook is delivering messages
- **⚠️ Pending Updates: >10** - Webhook might not be working
- **✅ No Last Error** - No recent delivery failures
- **⚠️ Last Error present** - Check error message and timestamp

## Setting a Webhook

### For Railway Deployment

1. **Get your Railway URL** from the Railway dashboard (e.g., `https://fizzy-tg-bot-production.up.railway.app`)

2. **Set the webhook:**

   ```bash
   bun run webhook:set https://your-app.up.railway.app
   ```

   **Important:** No trailing slash!

3. **Verify it worked:**

   ```bash
   bun run webhook:status
   ```

### Using the Script Directly

````bash
bun run scripts/webhook.js set https://your-app.up.railway.app
```***E
```bash
🔗 Telegram Webhook Manager
   Using API: Proxy

Setting webhook to: https://your-app.up.railway.app

✅ Webhook set successfully!
📊 Current Webhook Status:

   URL: https://your-app.up.railway.app
   Pending updates: 0
````

## Deleting a Webhook

**Warning:** This stops your bot from receiving messages!

```bash
bun run webhook:delete
```

### When to Delete

- Switching to polling mode (not recommended for production)
- Changing deployment platforms
- Troubleshooting webhook issues

#### Expected Output

```bash
✅ Webhook deleted successfully!
📊 Current Webhook Status:

   ⚠️  No webhook configured
   Bot is not receiving updates!
```

## Common Issues & Solutions

### Issue: High Pending Updates

**Symptom:**

```bash
Pending Updates: 150
```

**Causes:**

- Webhook URL is incorrect or unreachable
- Bot server is down or crashed
- Railway deployment failed

**Solution:**

1. Check Railway deployment is running
2. Verify the webhook URL is correct
3. Test the URL: `curl https://your-app.railway.app/health`
4. Re-set the webhook if URL changed

### Issue: 502 Bad Gateway Errors

**Symptom:**

```bash
⚠️  Last Error: Wrong response from the webhook: 502 Bad Gateway
```

**Causes:**

- Bot crashed when processing updates
- Server returned error response
- Railway container restart

**Solution:**

1. Check Railway logs for errors
2. Verify bot code handles errors gracefully (we already do this!)
3. Old errors (>1 hour) are usually resolved - check if pending updates = 0

### Issue: 404 Not Found

**Symptom:**

```bash
Error Message: Wrong response from the webhook: 404 Not Found
```

**Causes:**

- Webhook URL is incorrect
- Bot isn't running at that URL
- Railway deployment is on different URL

**Solution:**

1. Verify Railway URL in dashboard
2. Check bot is actually deployed and running
3. Re-set webhook with correct URL

### Issue: Webhook Won't Set

**Symptom:**

```bash
❌ Failed to set webhook: Bad Request: bad webhook: ...
```

**Causes:**

- URL must be HTTPS (not HTTP)
- URL must be publicly accessible
- Invalid URL format

**Solution:**

1. Ensure URL starts with `https://`
2. Remove any trailing slashes
3. Verify URL is publicly accessible: `curl https://your-url`

## Understanding Webhook Info

### Pending Updates

The number of messages Telegram is trying to deliver:

- **0-5**: Normal, webhook is working
- **5-20**: Slight delay, usually resolves quickly
- **>20**: Problem with webhook delivery

### Last Error Date

When Telegram last failed to deliver an update:

- **No error**: Perfect, everything working
- **>1 hour ago**: Old error, likely resolved (check pending updates)
- **<1 hour ago**: Recent issue, investigate logs

### Max Connections

How many simultaneous connections Telegram uses:

- **Default**: 40
- **Can configure**: Not usually necessary

## Best Practices

### ✅ Do

- Use HTTPS URLs only
- Set webhook to your production deployment URL
- Check webhook status after deployment
- Monitor pending updates count
- Keep webhook URL stable

### ❌ Don't

- Use HTTP URLs (Telegram requires HTTPS)
- Add trailing slashes to URLs
- Change webhook URL frequently
- Use localhost or private IPs
- Delete webhook unless switching modes

## Webhook vs Polling

### Webhook (Recommended for Production):

**Pros:**

- ✅ Instant message delivery
- ✅ More efficient (no constant polling)
- ✅ Lower server load
- ✅ Telegram recommended method

**Cons:**

- ❌ Requires public HTTPS URL
- ❌ Slightly more setup

### Polling (Development Only)

**Pros:**

- ✅ Works on localhost
- ✅ No webhook setup needed

**Cons:**

- ❌ Delayed message delivery
- ❌ Higher server load
- ❌ Not recommended for production
- ❌ Can miss messages

**Note:** This bot uses webhooks. Polling mode is not implemented.

## Advanced: Manual Webhook Management

You can also use `curl` directly:

### Check Status

```bash
# Direct API
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo

# Through proxy
curl https://telegram-api-proxy.diogomf.workers.dev/bot<YOUR_TOKEN>/getWebhookInfo
```

### Set Webhook

```bash
# Direct API
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://your-app.railway.app"

# Through proxy
curl "https://telegram-api-proxy.diogomf.workers.dev/bot<YOUR_TOKEN>/setWebhook?url=https://your-app.railway.app"
```

### Delete Webhook

```bash
# Direct API
curl https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook

# Through proxy
curl https://telegram-api-proxy.diogomf.workers.dev/bot<YOUR_TOKEN>/deleteWebhook
```

## Troubleshooting Checklist

When webhook isn't working:

- [ ] Check Railway deployment is active
- [ ] Verify Railway URL matches webhook URL
- [ ] Test health endpoint: `curl https://your-app.railway.app/health`
- [ ] Check Railway logs for errors
- [ ] Verify pending updates < 10
- [ ] Re-set webhook if URL changed
- [ ] Check last error is old (>1 hour) or none
- [ ] Run tests: `bun test:all`

## Related Documentation

- [Testing Guide](../README.md#testing) - Test webhook status
- [Cloudflare Proxy Setup](CLOUDFLARE_PROXY.md) - If direct connection fails
- [Deployment Guide](../README.md#deployment) - Railway deployment

## Support

If webhook issues persist:

1. Check Railway logs for detailed errors
2. Run `bun test:all` to diagnose the issue
3. Verify bot code is handling errors gracefully
4. Check [Railway status](https://status.railway.app/) for outages
