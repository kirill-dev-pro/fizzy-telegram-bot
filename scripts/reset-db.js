import { Database } from "bun:sqlite";
import { logger } from "../src/logger";

const volumePath = Bun.env.RAILWAY_VOLUME_MOUNT_PATH;
const dbPath = volumePath ? `${volumePath}/bot.db` : "bot.db";

logger.info("Resetting database", { dbPath, component: "reset-db" });
logger.info("Dropping all existing tables", { component: "reset-db" });

const db = new Database(dbPath);

try {
  // Drop all existing tables
  db.run("DROP TABLE IF EXISTS user_tokens");
  db.run("DROP TABLE IF EXISTS chat_token_links");
  db.run("DROP TABLE IF EXISTS topic_boards");

  logger.info("Creating fresh tables", { component: "reset-db" });

  logger.info("Creating user_tokens table", { component: "reset-db" });
  db.run(`
    CREATE TABLE user_tokens (
      user_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      account_slug TEXT NOT NULL,
      token TEXT NOT NULL,
      PRIMARY KEY (user_id, alias)
    )
  `);

  logger.info("Creating chat_token_links table", { component: "reset-db" });
  db.run(`
    CREATE TABLE chat_token_links (
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      alias TEXT NOT NULL,
      PRIMARY KEY (user_id, chat_id)
    )
  `);

  logger.info("Creating topic_boards table", { component: "reset-db" });
  db.run(`
    CREATE TABLE topic_boards (
      topic_id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      board_name TEXT
    )
  `);

  logger.info("Database reset complete", { component: "reset-db" });
  logger.warn("All previous data has been cleared", {
    component: "reset-db",
    note: "Users will need to reconfigure tokens, accounts, and boards",
  });
} catch (error) {
  logger.error("Database reset failed", {
    error: error.message,
    stack: error.stack,
    component: "reset-db",
  });
  process.exit(1);
} finally {
  db.close();
}
