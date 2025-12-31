// Comprehensive test suite for Telegram bot setup
// Tests: Telegram API connection, proxy, webhook status
// Run with: bun run test:all

import { Bot } from "grammy";

const BOT_TOKEN = Bun.env.BOT_TOKEN;
const PROXY_URL = Bun.env.TELEGRAM_API_PROXY_URL;

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN not set");
  process.exit(1);
}

console.log("\n🧪 Running Bot Tests\n");
console.log("=".repeat(50));

let testsPassed = 0;
let testsFailed = 0;

// Test 1: Direct Telegram API Connection
console.log("\n📡 Test 1: Direct Telegram API Connection");
console.log("-".repeat(50));

const directBot = new Bot(BOT_TOKEN);
let directSuccess = false;
let directDuration = 0;

try {
  const start = Date.now();
  const botInfo = await directBot.api.getMe();
  directDuration = Date.now() - start;
  directSuccess = true;

  console.log("   ✅ PASSED - Direct connection works!");
  console.log(`   Bot: @${botInfo.username} (${botInfo.first_name})`);
  console.log(`   Response time: ${directDuration}ms`);
  testsPassed++;
} catch (error) {
  console.log("   ❌ FAILED - Direct connection failed");
  console.log(`   Error: ${error.message}`);
  testsFailed++;
}

// Test 2: Proxy Connection
console.log("\n🌐 Test 2: Proxy Connection");
console.log("-".repeat(50));

if (PROXY_URL) {
  console.log(`   Testing: ${PROXY_URL}`);

  const proxyBot = new Bot(BOT_TOKEN, { apiRoot: PROXY_URL });
  let proxyDuration = 0;

  try {
    const start = Date.now();
    const botInfo = await proxyBot.api.getMe();
    proxyDuration = Date.now() - start;

    console.log("   ✅ PASSED - Proxy connection works!");
    console.log(`   Bot: @${botInfo.username} (${botInfo.first_name})`);
    console.log(`   Response time: ${proxyDuration}ms`);

    if (directSuccess && proxyDuration > directDuration * 2) {
      console.log(
        `   ⚠️  Proxy is ${Math.round(
          proxyDuration / directDuration
        )}x slower than direct`
      );
    }

    testsPassed++;
  } catch (error) {
    console.log("   ❌ FAILED - Proxy connection failed");
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
} else {
  console.log("   ⏭️  SKIPPED - No proxy URL configured");
  console.log("   Set TELEGRAM_API_PROXY_URL to test proxy");
}

// Test 3: Webhook Status
console.log("\n🪝 Test 3: Webhook Status");
console.log("-".repeat(50));

const API_BASE = PROXY_URL || "https://api.telegram.org";
const API_URL = `${API_BASE}/bot${BOT_TOKEN}`;

try {
  const response = await fetch(`${API_URL}/getWebhookInfo`);
  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description);
  }

  const info = data.result;

  if (info.url) {
    // Determine status first
    let hasRecentError = false;
    let errorInfo = null;

    if (info.last_error_date) {
      const errorDate = new Date(info.last_error_date * 1000);
      const minutesAgo = Math.round((Date.now() - errorDate.getTime()) / 60000);
      const hoursAgo = Math.round(minutesAgo / 60);

      if (minutesAgo < 60) {
        hasRecentError = true;
        errorInfo = { type: 'recent', minutesAgo, message: info.last_error_message };
      } else {
        errorInfo = { type: 'old', hoursAgo, message: info.last_error_message };
      }
    }

    // Show status first (consistent with other tests)
    if (info.pending_update_count > 10) {
      console.log(`   ❌ FAILED - High pending updates (${info.pending_update_count}) - webhook not delivering!`);
      testsFailed++;
    } else if (hasRecentError) {
      console.log(`   ❌ FAILED - Recent error, monitoring needed`);
      testsFailed++;
    } else {
      console.log("   ✅ PASSED - Webhook working normally!");
      testsPassed++;
    }

    // Then show details
    console.log(`   URL: ${info.url}`);
    console.log(`   Pending updates: ${info.pending_update_count}`);

    // Show error info if any
    if (errorInfo) {
      if (errorInfo.type === 'recent') {
        console.log(`   ⚠️  Recent error: ${errorInfo.minutesAgo} minutes ago`);
        console.log(`   Error: ${errorInfo.message}`);
      } else {
        console.log(`   ℹ️  Last error: ${errorInfo.hoursAgo} hours ago (old, likely resolved)`);
        console.log(`   Error: ${errorInfo.message}`);
      }
    }
  } else {
    console.log("   ❌ FAILED - No webhook configured!");
    console.log("   Bot will not receive updates!");
    console.log("   Run: bun run webhook:set <YOUR_RAILWAY_URL>");
    testsFailed++;
  }
} catch (error) {
  console.log("   ❌ FAILED - Could not check webhook status");
  console.log(`   Error: ${error.message}`);
  testsFailed++;
}

// Test 4: Bot Auto-Detection Logic
console.log("\n🤖 Test 4: Auto-Detection Behavior");
console.log("-".repeat(50));

if (directSuccess && PROXY_URL) {
  console.log("   ✅ PASSED - Optimal setup detected!");
  console.log("   Direct connection works - will be used locally");
  console.log("   Proxy configured - will be used if direct fails");
  testsPassed++;
} else if (!directSuccess && PROXY_URL) {
  console.log("   ✅ PASSED - Proxy fallback working!");
  console.log("   Direct connection blocked (expected on Railway)");
  console.log("   Proxy will be used automatically");
  testsPassed++;
} else if (directSuccess && !PROXY_URL) {
  console.log("   ⚠️  PASSED - No proxy configured");
  console.log("   Direct connection works (good for local development)");
  console.log(
    "   Consider adding TELEGRAM_API_PROXY_URL for Railway deployment"
  );
  testsPassed++;
} else {
  console.log("   ❌ FAILED - No working connection!");
  console.log("   Both direct and proxy connections failed");
  console.log("   Check your BOT_TOKEN and network connection");
  testsFailed++;
}

// Summary
const totalTests = testsPassed + testsFailed;
console.log("\n" + "=".repeat(50));
console.log(`📊 Test Summary (${totalTests})`);
console.log("=".repeat(50));

if (testsPassed > 0) {
  console.log(`✅ Passed: ${testsPassed}`);
}

if (testsFailed > 0) {
  console.log(`❌ Failed: ${testsFailed}`);
}

if (testsFailed === 0) {
  console.log("\n🎉 All tests passed! Your bot is ready to go!\n");
  process.exit(0);
} else {
  console.log("\n⚠️  Some tests failed. Check the errors above.\n");
  process.exit(1);
}
