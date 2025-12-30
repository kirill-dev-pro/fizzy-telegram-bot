import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { logger } from "../src/logger";

const volumePath = Bun.env.RAILWAY_VOLUME_MOUNT_PATH;
const dbPath = volumePath ? `${volumePath}/bot.db` : "bot.db";

const shouldRunSetup = Bun.env.FORCE_DB_SETUP === "true" || !existsSync(dbPath);

if (!shouldRunSetup) {
  logger.info("Database already exists, skipping setup", {
    dbPath,
    component: "setup-db",
  });
  process.exit(0);
}

logger.info("Setting up database", { dbPath, component: "setup-db" });

const db = new Database(dbPath);

try {
  logger.info("Creating user_tokens table", { component: "setup-db" });
  db.run(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      user_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      account_slug TEXT NOT NULL,
      token TEXT NOT NULL,
      PRIMARY KEY (user_id, alias)
    )
  `);

  logger.info("Creating chat_token_links table", { component: "setup-db" });
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_token_links (
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      PRIMARY KEY (user_id, chat_id)
    )
  `);

  logger.info("Creating topic_boards table", { component: "setup-db" });
  db.run(`
    CREATE TABLE IF NOT EXISTS topic_boards (
      topic_id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      board_name TEXT
    )
  `);

  logger.info("Database setup complete", { component: "setup-db" });
} catch (error) {
  logger.error("Database setup failed", {
    error: error.message,
    stack: error.stack,
    component: "setup-db",
  });
  process.exit(1);
} finally {
  db.close();
}
