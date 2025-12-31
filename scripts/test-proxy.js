// Test script to verify Telegram API proxy connection
// Run with: bun run test-proxy.js

import { Bot } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN || Bun.env.BOT_TOKEN;
const PROXY_URL = process.env.TELEGRAM_API_PROXY_URL || Bun.env.TELEGRAM_API_PROXY_URL;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN not set");
  process.exit(1);
}

console.log("\n🧪 Testing Telegram API Connection\n");
console.log("Configuration:");
console.log(`  Bot Token: ${BOT_TOKEN.substring(0, 15)}...`);
console.log(`  Proxy URL: ${PROXY_URL || "Not configured (direct connection)"}`);
console.log();

// Test with proxy
const botConfig = PROXY_URL ? { apiRoot: PROXY_URL } : {};
const bot = new Bot(BOT_TOKEN, botConfig);

console.log("Testing getMe() call...");
const start = Date.now();

try {
  const botInfo = await bot.api.getMe();
  const duration = Date.now() - start;

  console.log("\n✅ Connection successful!");
  console.log(`  Response time: ${duration}ms`);
  console.log(`  Bot username: @${botInfo.username}`);
  console.log(`  Bot ID: ${botInfo.id}`);
  console.log(`  Bot name: ${botInfo.first_name}`);

  if (duration > 2000) {
    console.log("\n⚠️  Warning: Response time >2s, proxy may be slow");
  }

} catch (error) {
  const duration = Date.now() - start;
  console.log(`\n❌ Connection failed after ${duration}ms`);
  console.log(`  Error: ${error.message}`);

  if (PROXY_URL) {
    console.log("\nTroubleshooting:");
    console.log("  1. Verify proxy URL format (should be base URL only):");
    console.log(`     Expected: https://worker-name.workers.dev`);
    console.log(`     Got:      ${PROXY_URL}`);
    console.log("  2. Test proxy with curl:");
    console.log(`     curl ${PROXY_URL}/bot${BOT_TOKEN.substring(0, 15)}.../getMe`);
  }

  process.exit(1);
}

console.log("\n✨ All tests passed!\n");
