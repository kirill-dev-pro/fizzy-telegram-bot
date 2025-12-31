// Webhook management script for Telegram bot
// Usage:
//   bun run scripts/webhook.js status        - Check current webhook
//   bun run scripts/webhook.js set <URL>     - Set webhook URL
//   bun run scripts/webhook.js delete        - Delete webhook

const BOT_TOKEN = process.env.BOT_TOKEN || Bun.env.BOT_TOKEN;
const PROXY_URL = process.env.TELEGRAM_API_PROXY_URL || Bun.env.TELEGRAM_API_PROXY_URL;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN environment variable not set");
  process.exit(1);
}

// Use proxy if configured, otherwise use direct API
const API_BASE = PROXY_URL || "https://api.telegram.org";
const API_URL = `${API_BASE}/bot${BOT_TOKEN}`;

console.log(`\n🔗 Telegram Webhook Manager`);
console.log(`   Using API: ${PROXY_URL ? "Proxy" : "Direct"}`);
console.log(`   API Base: ${API_BASE}\n`);

const command = process.argv[2];
const webhookUrl = process.argv[3];

async function getWebhookInfo() {
  const response = await fetch(`${API_URL}/getWebhookInfo`);
  const data = await response.json();

  if (!data.ok) {
    console.error("❌ Failed to get webhook info:", data.description);
    process.exit(1);
  }

  return data.result;
}

async function setWebhook(url) {
  const response = await fetch(`${API_URL}/setWebhook?url=${encodeURIComponent(url)}`);
  const data = await response.json();

  if (!data.ok) {
    console.error("❌ Failed to set webhook:", data.description);
    process.exit(1);
  }

  console.log("✅ Webhook set successfully!");
  return data.result;
}

async function deleteWebhook() {
  const response = await fetch(`${API_URL}/deleteWebhook`);
  const data = await response.json();

  if (!data.ok) {
    console.error("❌ Failed to delete webhook:", data.description);
    process.exit(1);
  }

  console.log("✅ Webhook deleted successfully!");
  return data.result;
}

function displayWebhookInfo(info) {
  console.log("📊 Current Webhook Status:\n");

  if (info.url) {
    console.log(`   URL: ${info.url}`);
    console.log(`   Has Custom Certificate: ${info.has_custom_certificate}`);
    console.log(`   Pending Updates: ${info.pending_update_count}`);

    if (info.last_error_date) {
      const errorDate = new Date(info.last_error_date * 1000);
      console.log(`\n   ⚠️  Last Error: ${errorDate.toISOString()}`);
      console.log(`   Error Message: ${info.last_error_message}`);
    }

    if (info.last_synchronization_error_date) {
      const syncDate = new Date(info.last_synchronization_error_date * 1000);
      console.log(`\n   ⚠️  Last Sync Error: ${syncDate.toISOString()}`);
    }

    if (info.max_connections) {
      console.log(`\n   Max Connections: ${info.max_connections}`);
    }
  } else {
    console.log("   ⚠️  No webhook configured");
    console.log("   Bot is not receiving updates!");
  }

  console.log();
}

// Main command handler
switch (command) {
  case "status":
  case "info":
    const info = await getWebhookInfo();
    displayWebhookInfo(info);

    if (!info.url) {
      console.log("💡 To set webhook, run:");
      console.log("   bun run scripts/webhook.js set https://your-railway-app.railway.app\n");
    }
    break;

  case "set":
    if (!webhookUrl) {
      console.error("❌ Please provide a webhook URL");
      console.log("Usage: bun run scripts/webhook.js set <URL>\n");
      process.exit(1);
    }

    console.log(`Setting webhook to: ${webhookUrl}\n`);
    await setWebhook(webhookUrl);

    // Show updated info
    const newInfo = await getWebhookInfo();
    displayWebhookInfo(newInfo);
    break;

  case "delete":
  case "remove":
    await deleteWebhook();

    // Show updated info
    const deletedInfo = await getWebhookInfo();
    displayWebhookInfo(deletedInfo);
    break;

  default:
    console.log("Usage:");
    console.log("  bun run scripts/webhook.js status          - Check current webhook");
    console.log("  bun run scripts/webhook.js set <URL>       - Set webhook URL");
    console.log("  bun run scripts/webhook.js delete          - Delete webhook");
    console.log();
    process.exit(1);
}
