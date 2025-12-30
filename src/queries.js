import { Database } from "bun:sqlite";

const volumePath = Bun.env.RAILWAY_VOLUME_MOUNT_PATH;
const dbPath = volumePath ? `${volumePath}/bot.db` : "bot.db";
const db = new Database(dbPath);

export const saveUserToken = (userId, alias, accountSlug, token) =>
  db
    .query(
      "INSERT OR REPLACE INTO user_tokens (user_id, alias, account_slug, token) VALUES (?, ?, ?, ?)"
    )
    .run(userId, alias, accountSlug, token);

export const getUserTokens = (userId) =>
  db
    .query(
      "SELECT alias, account_slug, token FROM user_tokens WHERE user_id = ?"
    )
    .all(userId);

export const getUserTokenByAlias = (userId, alias) =>
  db
    .query("SELECT * FROM user_tokens WHERE user_id = ? AND alias = ?")
    .get(userId, alias);

export const deleteUserToken = (userId, alias) =>
  db
    .query("DELETE FROM user_tokens WHERE user_id = ? AND alias = ?")
    .run(userId, alias);

// Chat-to-token linking
export const saveLinkChatToToken = (userId, chatId, alias) =>
  db
    .query(
      "INSERT OR REPLACE INTO chat_token_links (user_id, chat_id, alias) VALUES (?, ?, ?)"
    )
    .run(userId, chatId, alias);

export const getChatTokenLink = (userId, chatId) =>
  db
    .query(
      "SELECT alias FROM chat_token_links WHERE user_id = ? AND chat_id = ?"
    )
    .get(userId, chatId);

export const getBoardForTopic = (topicId) =>
  db
    .query("SELECT board_id, board_name FROM topic_boards WHERE topic_id = ?")
    .get(topicId);

export const saveBoardForTopic = (topicId, boardId, boardName = null) =>
  db
    .query(
      "INSERT OR REPLACE INTO topic_boards (topic_id, board_id, board_name) VALUES (?, ?, ?)"
    )
    .run(topicId, boardId, boardName);
