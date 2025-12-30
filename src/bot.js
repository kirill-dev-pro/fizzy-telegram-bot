import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { serve } from "bun";

import { MESSAGES } from "./messages";
import {
  getUserTokens,
  getUserTokenByAlias,
  saveUserToken,
  deleteUserToken,
  saveLinkChatToToken,
  getChatTokenLink,
  getBoardForTopic,
  saveBoardForTopic,
} from "./queries";
import { createFizzyCard, formatCardError, fetchBoardInfo } from "./fizzy";
import { logger } from "./logger";

if (!Bun.env.BOT_TOKEN) {
  throw new Error("BOT_TOKEN environment variable is required but not set");
}
const bot = new Bot(Bun.env.BOT_TOKEN);

const botInfo = await bot.api.getMe();
const botUsername = botInfo.username;

logger.info("Bot initialized", { username: botUsername });

// ===== Regexes =====

const CREATE_CARD_REGEX =
  /^\/(issue|todo|fizzy)\s+([^-\n]+?)(?:\s+-d\s+([\s\S]*))?$/i;
const CREATE_CARD_LONELY_REGEX = /^\/(issue|todo|fizzy)$/i;

const CONFIG_BOARD_REGEX = /^\/config_board\s+([a-zA-Z0-9]+)$/i;
const CONFIG_BOARD_INCOMPLETE_REGEX = /^\/config_board(\s|$)/i;
const CONFIG_BOARD_LONELY_REGEX = /^\/config_board$/i;

const CONFIG_TOKEN_REGEX =
  /^\/config_token\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9]{20,})$/i;
const CONFIG_TOKEN_INCOMPLETE_REGEX = /^\/config_token(\s|$)/i;
const CONFIG_TOKEN_LONELY_REGEX = /^\/config_token$/i;

const DELETE_ACCOUNT_REGEX = /^\/delete_account\s+([a-zA-Z0-9_-]+)$/i;
const DELETE_ACCOUNT_INCOMPLETE_REGEX = /^\/delete_account(\s|$)/i;
const DELETE_ACCOUNT_LONELY_REGEX = /^\/delete_account$/i;

const SELECT_ACCOUNT_REGEX = /^\/select_account$/i;
const SELECT_ACCOUNT_INCOMPLETE_REGEX = /^\/select_account(\s|$)/i;

const getPrivateMenu = new InlineKeyboard()
  .text("Setup Token", "set_token")
  .row()
  .text("Token accounts", "status")
  .row()
  .text("How to Use", "start")
  .text("Help", "help");

const getGroupMenu = (botUsername) =>
  new InlineKeyboard()
    .url(
      "Setup Fizzy Personal Token",
      `https://t.me/${botUsername}?start=setup`
    )
    .row()
    .text("Status", "status")
    .text("Select Account", "select_account_btn")
    .row()
    .text("How to Use", "start")
    .text("Help", "help");

function buildAccountSelectionKeyboardMenu(userTokens, currentAlias = null) {
  const keyboardMenu = new InlineKeyboard();
  userTokens.forEach((token, idx) => {
    const isCurrent = currentAlias && currentAlias === token.alias;
    const label = isCurrent
      ? `✅ ${token.alias} (${token.account_slug})`
      : `${token.alias} (${token.account_slug})`;
    keyboardMenu.text(label, `select_account:${token.alias}`);
    if (idx % 2 === 1) keyboardMenu.row(); // 2 buttons per row
  });
  return keyboardMenu;
}

async function getImageFromReply(ctx, msg) {
  if (!msg.reply_to_message?.photo) return null;

  const repliedMsg = msg.reply_to_message;
  const photoSizes = repliedMsg.photo.sort((a, b) => b.file_size - a.file_size);
  const largestPhoto = photoSizes[0];
  const fileId = largestPhoto.file_id;

  const file = await ctx.api.getFile(fileId);
  const downloadUrl = `https://api.telegram.org/file/bot${Bun.env.BOT_TOKEN}/${file.file_path}`;

  const response = await fetch(downloadUrl);
  const arrayBuffer = await response.arrayBuffer();

  return {
    content: arrayBuffer,
    filename: `photo_${fileId}.jpg`,
    contentType: "image/jpeg",
  };
}

// Build card description with metadata
function buildCardDescription(msg, customDesc, title) {
  let description = msg.reply_to_message
    ? msg.reply_to_message.text || msg.reply_to_message.caption || ""
    : customDesc || title;

  const sender = msg.from.username
    ? `@${msg.from.username}`
    : msg.from.first_name;
  description += `\n\n\n\nvia telegram by ${sender}`;

  return description;
}

function getSenderInfo(msg) {
  return msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
}

function getCardType(hasDescription, hasReply, hasMedia) {
  if (hasReply && hasMedia) return "Card with reply and media created";
  if (hasReply) return "Card with reply created";
  if (hasDescription) return "Card with description created";
  return "Card created";
}

// === Callbacks ===
bot.callbackQuery("set_token", (ctx) => {
  logger.command(
    "keyboard",
    "option_selected",
    "set_token",
    getSenderInfo(ctx)
  );
  return ctx
    .answerCallbackQuery()
    .then(() =>
      ctx.reply(MESSAGES.configTokenHelp, { parse_mode: "MarkdownV2" })
    );
});
bot.callbackQuery("start", (ctx) => {
  logger.command("keyboard", "option_selected", "start", getSenderInfo(ctx));
  const isPrivate = ctx.chat.type === "private";
  const message = isPrivate ? MESSAGES.welcomePrivate : MESSAGES.welcomeGroup;

  return ctx.answerCallbackQuery().then(() =>
    ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: isPrivate ? getPrivateMenu : getGroupMenu(botUsername),
    })
  );
});
bot.callbackQuery("status", async (ctx) => {
  logger.command("keyboard", "option selected", "status", getSenderInfo(ctx));
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id.toString();
  const isPrivate = ctx.chat.type === "private";

  if (isPrivate) {
    const userTokens = getUserTokens(userId);

    if (userTokens.length === 0) {
      return ctx.reply(MESSAGES.statusPrivateNoAccounts, {
        reply_markup: getPrivateMenu,
      });
    }

    const msg = MESSAGES.statusPrivateWithAccounts(userTokens);
    return ctx.reply(msg, { reply_markup: getPrivateMenu });
  } else {
    // Show chat configuration in group
    const chatId = ctx.chat.id.toString();
    const chatLink = getChatTokenLink(userId, chatId);
    // Check if we're in a topic thread - callback queries need different handling
    const callbackQuery = ctx.callbackQuery;
    const topicId = callbackQuery?.message?.message_thread_id
      ? callbackQuery.message.message_thread_id.toString()
      : ctx.chat?.message_thread_id
      ? ctx.chat.message_thread_id.toString()
      : ctx.message?.message_thread_id
      ? ctx.message.message_thread_id.toString()
      : "general";
    const board = getBoardForTopic(topicId);

    const msg = MESSAGES.statusGroup(
      chatLink,
      chatLink ? getUserTokenByAlias(userId, chatLink.alias) : null,
      board
    );
    return ctx.reply(msg);
  }
});
bot.callbackQuery("help", (ctx) => {
  logger.command("keyboard", "option selected", "help", getSenderInfo(ctx));
  return ctx.answerCallbackQuery().then(() =>
    ctx.reply(
      ctx.chat.type === "private" ? MESSAGES.helpPrivate : MESSAGES.helpGroup,
      {
        parse_mode: "MarkdownV2",
        reply_markup:
          ctx.chat.type === "private"
            ? getPrivateMenu
            : getGroupMenu(botUsername),
      }
    )
  );
});

const pendingCards = new Map(); // Store pending card data for account selection

// Account selection callback handler
bot.callbackQuery(/^select_account:(.+)$/, async (ctx) => {
  logger.command(
    "keyboard",
    "option selected",
    "select_account",
    getSenderInfo(ctx)
  );
  await ctx.answerCallbackQuery();
  const alias = ctx.match[1];
  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id.toString();

  // Link the selected account to this chat
  saveLinkChatToToken(userId, chatId, alias);

  // Get pending card data
  const pendingKey = `${userId}_${chatId}`;
  const cardData = pendingCards.get(pendingKey);

  if (!cardData) {
    logger.command(
      "account_selection",
      "success",
      `account linked: ${alias}`,
      getSenderInfo(ctx)
    );
    return ctx.reply(MESSAGES.accountSelected(alias));
  }

  // Remove from pending
  pendingCards.delete(pendingKey);

  const tokenData = getUserTokenByAlias(userId, alias);

  if (!tokenData) {
    logger.command(
      "account_selection",
      "error",
      `token not found: ${alias}`,
      getSenderInfo(ctx)
    );
    return ctx.reply(MESSAGES.tokenNotFound(alias));
  }

  const board = getBoardForTopic(cardData.topicId);

  if (!board) {
    logger.command(
      "account_selection",
      "warning",
      "board not configured",
      getSenderInfo(ctx)
    );
    return ctx.reply(MESSAGES.boardNotConfigured);
  }

  await ctx.reply(MESSAGES.accountSelectedWithPending(alias));

  const fizzyConfig = {
    account_slug: tokenData.account_slug,
    board_id: board.board_id,
    token: tokenData.token,
  };

  const result = await createFizzyCard(
    fizzyConfig,
    cardData.title,
    cardData.description,
    cardData.imageFile
  );

  if (result.success) {
    const hasDescription =
      cardData.description && cardData.description !== cardData.title;
    const hasReply = cardData.wasReply;
    const hasMedia = !!cardData.imageFile;
    logger.command(
      "card_creation",
      "success",
      getCardType(hasDescription, hasReply, hasMedia),
      getSenderInfo(ctx)
    );
    await ctx.reply(MESSAGES.cardCreated(cardData.title, result.url));
  } else {
    logger.command(
      "card_creation",
      "error",
      `failed to create card via account selection: ${alias}`,
      getSenderInfo(ctx)
    );
    await ctx.reply(
      MESSAGES.cardCreationFailed(
        formatCardError(result, alias, tokenData.account_slug)
      )
    );
  }
});

bot.callbackQuery("select_account_btn", async (ctx) => {
  logger.command(
    "keyboard",
    "option selected",
    "select_account",
    getSenderInfo(ctx)
  );
  await ctx.answerCallbackQuery();
  const userId = ctx.from.id.toString();

  const userTokens = getUserTokens(userId);

  if (userTokens.length === 0) {
    logger.command(
      "select_account",
      "warning",
      "no accounts configured",
      getSenderInfo(ctx)
    );
    return ctx.reply(MESSAGES.noAccountsConfigured);
  }

  const chatId = ctx.chat.id.toString();
  const currentLink = getChatTokenLink(userId, chatId);
  const keyboardMenu = buildAccountSelectionKeyboardMenu(
    userTokens,
    currentLink?.alias
  );

  logger.command(
    "select_account",
    "success",
    "account selection menu shown",
    getSenderInfo(ctx)
  );
  return ctx.reply(MESSAGES.selectAccountPrompt, {
    reply_markup: keyboardMenu,
  });
});

bot.command("start", (ctx) => {
  logger.command("/start", "command executed", "", getSenderInfo(ctx.message));
  const isPrivate = ctx.chat.type === "private";
  const message = isPrivate ? MESSAGES.welcomePrivate : MESSAGES.welcomeGroup;

  return ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: isPrivate ? getPrivateMenu : getGroupMenu(botUsername),
  });
});

bot.on("my_chat_member", (ctx) =>
  ctx.myChatMember.new_chat_member.status === "member" &&
  ctx.chat.type !== "private"
    ? ctx.reply(MESSAGES.welcomeBotAdded, {
        parse_mode: "Markdown",
        reply_markup: getGroupMenu(botUsername),
      })
    : null
);

bot.command("help", (ctx) => {
  logger.command("/help", "command executed", "", getSenderInfo(ctx.message));
  const isPrivate = ctx.chat.type === "private";
  const message = isPrivate ? MESSAGES.helpPrivate : MESSAGES.helpGroup;

  return ctx.reply(message, {
    parse_mode: "MarkdownV2",
    reply_markup: isPrivate ? getPrivateMenu : getGroupMenu(botUsername),
  });
});

bot.command("status", async (ctx) => {
  logger.command("/status", "command executed", "", getSenderInfo(ctx.message));
  const userId = ctx.from.id.toString();
  const isPrivate = ctx.chat.type === "private";

  if (isPrivate) {
    const userTokens = getUserTokens(userId);

    if (userTokens.length === 0) {
      return ctx.reply(MESSAGES.statusPrivateNoAccounts, {
        reply_markup: getPrivateMenu,
      });
    }

    const msg = MESSAGES.statusPrivateWithAccounts(userTokens);
    return ctx.reply(msg, { reply_markup: getPrivateMenu });
  } else {
    // Show chat configuration in group
    const chatId = ctx.chat.id.toString();
    const chatLink = getChatTokenLink(userId, chatId);
    const topicId = ctx.message?.is_topic_message
      ? ctx.message.message_thread_id.toString()
      : "general";
    const board = getBoardForTopic(topicId);

    const msg = MESSAGES.statusGroup(
      chatLink,
      chatLink ? getUserTokenByAlias(userId, chatLink.alias) : null,
      board
    );
    return ctx.reply(msg);
  }
});

bot.on("message:text", async (ctx) => {
  const msg = ctx.message;
  const text = msg.text || "";
  const userId = msg.from.id.toString();
  const isPrivate = ctx.chat.type === "private";

  if (
    text.match(CONFIG_TOKEN_INCOMPLETE_REGEX) &&
    !text.match(CONFIG_TOKEN_REGEX)
  ) {
    if (text.match(CONFIG_TOKEN_LONELY_REGEX)) {
      logger.command("/config_token", "validation", "lonely", getSenderInfo(msg));
      return ctx.reply(MESSAGES.configTokenMissingArgs(isPrivate), {
        parse_mode: "Markdown",
      });
    }
    // Handle incorrect arguments
    logger.command(
      "/config_token",
      "validation",
      "wrong arguments",
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.configTokenIncorrectArgs, {
      parse_mode: "Markdown",
    });
  }

  const tokenMatch = text.match(CONFIG_TOKEN_REGEX);
  if (tokenMatch) {
    if (!isPrivate) {
      logger.command(
        "/config_token",
        "validation",
        "not in private chat",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.configTokenNotPrivate);
    }
    const [, alias, accountSlug, token] = tokenMatch;

    const existingToken = getUserTokenByAlias(userId, alias);
    const isUpdate = existingToken !== null;

    saveUserToken(userId, alias, accountSlug, token);

    if (isUpdate) {
      logger.command(
        "/config_token",
        "success",
        `updated token: ${alias}`,
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.tokenUpdated(alias, accountSlug), {
        reply_markup: getPrivateMenu,
      });
    }

    logger.command(
      "/config_token",
      "success",
      `saved token: ${alias}`,
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.tokenSaved(alias, accountSlug), {
      reply_markup: getPrivateMenu,
    });
  }

  if (
    text.match(DELETE_ACCOUNT_INCOMPLETE_REGEX) &&
    !text.match(DELETE_ACCOUNT_REGEX)
  ) {
    if (text.match(DELETE_ACCOUNT_LONELY_REGEX)) {
      logger.command("/delete_account", "validation", "lonely", getSenderInfo(msg));
      return ctx.reply(MESSAGES.deleteAccountMissingAlias);
    }
    logger.command(
      "/delete_account",
      "validation",
      "wrong arguments",
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.deleteAccountIncorrectArgs);
  }

  const deleteMatch = text.match(DELETE_ACCOUNT_REGEX);
  if (deleteMatch) {
    if (!isPrivate) {
      logger.command(
        "/delete_account",
        "validation",
        "not in private chat",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.deleteAccountNotPrivate);
    }

    const alias = deleteMatch[1];
    const tokenData = getUserTokenByAlias(userId, alias);

    if (!tokenData) {
      logger.command(
        "/delete_account",
        "error",
        `account not found: ${alias}`,
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.deleteAccountNotFound(alias));
    }

    deleteUserToken(userId, alias);
    logger.command(
      "/delete_account",
      "success",
      `deleted account: ${alias}`,
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.deleteAccountSuccess(alias), {
      reply_markup: getPrivateMenu,
    });
  }

  if (
    text.match(CONFIG_BOARD_INCOMPLETE_REGEX) &&
    !text.match(CONFIG_BOARD_REGEX)
  ) {
    if (text.match(CONFIG_BOARD_LONELY_REGEX)) {
      logger.command("/config_board", "validation", "lonely", getSenderInfo(msg));
      return ctx.reply(MESSAGES.configBoardMissingId);
    }

    logger.command(
      "/config_board",
      "validation",
      "wrong arguments",
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.configBoardIncorrectArgs);
  }

  const boardMatch = text.match(CONFIG_BOARD_REGEX);
  if (boardMatch) {
    const [, boardId] = boardMatch;
    if (boardId.length < 10) {
      logger.command(
        "/config_board",
        "validation",
        "invalid board id",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.configBoardInvalidId);
    }

    if (!isPrivate) {
      const chatId = ctx.chat.id.toString();
      const chatLink = getChatTokenLink(userId, chatId);

      if (!chatLink) {
        const userTokens = getUserTokens(userId);

        if (userTokens.length === 0) {
          logger.command(
            "/config_board",
            "warning",
            "no accounts configured",
            getSenderInfo(msg)
          );
          return ctx.reply(MESSAGES.configBoardNoTokenPrivate);
        }

        // If only one account, auto-select it
        if (userTokens.length === 1) {
          const alias = userTokens[0].alias;
          saveLinkChatToToken(userId, chatId, alias);
          logger.command(
            "/config_board",
            "info",
            `auto-selected account: ${alias}`,
            getSenderInfo(msg)
          );
          // Continue with board configuration using this account
        } else {
          // Multiple accounts - show selection menu
          const keyboardMenu = buildAccountSelectionKeyboardMenu(
            userTokens,
            null // No current link since we're in the chatLink block
          );

          logger.command(
            "/config_board",
            "info",
            "account selection menu shown",
            getSenderInfo(msg)
          );
          return ctx.reply(MESSAGES.selectAccountPrompt, {
            reply_markup: keyboardMenu,
          });
        }
      }

      // Get the chat link (might have been just set by auto-selection)
      const finalChatLink = getChatTokenLink(userId, chatId);
      const tokenData = getUserTokenByAlias(userId, finalChatLink.alias);
      const boardInfo = await fetchBoardInfo({
        account_slug: tokenData.account_slug,
        board_id: boardId,
        token: tokenData.token,
      });

      const topicId = msg.is_topic_message
        ? msg.message_thread_id.toString()
        : "general";

      // Validate board exists before saving
      if (!boardInfo.success) {
        logger.command(
          "/config_board",
          "error",
          `board not found: ${boardId}`,
          getSenderInfo(msg)
        );
        return ctx.reply(
          `❌ Board not found: ${boardId}\n\nThe board ID might be incorrect or the board doesn't exist.\n\nPlease check the board ID and try again.`
        );
      }

      // Save board with name
      saveBoardForTopic(topicId, boardId, boardInfo.name);

      logger.command(
        "/config_board",
        "success",
        `board set for topic: ${topicId}`,
        getSenderInfo(msg)
      );
      return ctx.reply(
        MESSAGES.boardSet(boardId, boardInfo.name, finalChatLink.alias, tokenData.account_slug)
      );
    }

    const topicId = msg.is_topic_message
      ? msg.message_thread_id.toString()
      : "general";

    let boardName = null;
    const userTokens = getUserTokens(userId);

    if (userTokens.length > 0) {
      // Use the first available token to fetch board info
      const tokenData = userTokens[0];
      const boardInfo = await fetchBoardInfo({
        account_slug: tokenData.account_slug,
        board_id: boardId,
        token: tokenData.token,
      });

      // Validate board exists before saving
      if (!boardInfo.success) {
        logger.command(
          "/config_board",
          "error",
          `board not found: ${boardId}`,
          getSenderInfo(msg)
        );
        return ctx.reply(
          `❌ Board not found: ${boardId}\n\nThe board ID might be incorrect or the board doesn't exist.\n\nPlease check the board ID and try again.`
        );
      }

      boardName = boardInfo.name;
    }

    saveBoardForTopic(topicId, boardId, boardName);

    logger.command(
      "/config_board",
      "success",
      `board set for topic: ${topicId}`,
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.boardSet(boardId, boardName));
  }

  if (
    text.match(SELECT_ACCOUNT_INCOMPLETE_REGEX) &&
    !text.match(SELECT_ACCOUNT_REGEX)
  ) {
    logger.command(
      "/select_account",
      "validation",
      "wrong arguments",
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.selectAccountIncorrectArgs);
  }

  if (text.match(SELECT_ACCOUNT_REGEX)) {
    if (isPrivate) {
      logger.command(
        "/select_account",
        "validation",
        "not in group chat",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.selectAccountNotGroup);
    }

    const userTokens = getUserTokens(userId);

    if (userTokens.length === 0) {
      logger.command(
        "/select_account",
        "warning",
        "no accounts configured",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.noAccountsConfigured);
    }

    const chatId = ctx.chat.id.toString();
    const currentLink = getChatTokenLink(userId, chatId);
    const keyboardMenu = buildAccountSelectionKeyboardMenu(
      userTokens,
      currentLink?.alias
    );

    logger.command(
      "/select_account",
      "success",
      "account selection menu shown",
      getSenderInfo(msg)
    );
    return ctx.reply(MESSAGES.selectAccountPrompt, {
      reply_markup: keyboardMenu,
    });
  }

  if (CREATE_CARD_LONELY_REGEX.test(text)) {
    const command = text.match(CREATE_CARD_LONELY_REGEX)[1];
    logger.command(`/${command}`, "validation", "lonely", getSenderInfo(msg));
    return ctx.reply(MESSAGES.missingTitleReply(command, msg.message_id), {
      reply_to_message_id: msg.message_id,
    });
  }

  const fullMatch = text.match(CREATE_CARD_REGEX);
  if (fullMatch) {
    const [, command, title, customDesc] = fullMatch;

    const chatId = ctx.chat.id.toString();
    const topicId = msg.is_topic_message
      ? msg.message_thread_id.toString()
      : "general";

    const board = getBoardForTopic(topicId);

    if (!board) {
      logger.command(
        `/${command}`,
        "warning",
        "no board configured",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.noBoardConfigured);
    }
    if (!title) {
      logger.command(
        `/${command}`,
        "validation",
        "missing title",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.missingTitle(command));
    }

    const chatLink = getChatTokenLink(userId, chatId);

    if (!chatLink) {
      const userTokens = getUserTokens(userId);

      if (userTokens.length === 0) {
        logger.command(
          `/${command}`,
          "warning",
          "no accounts configured",
          getSenderInfo(msg)
        );
        return ctx.reply(
          "❌ No accounts configured.\n\nSet up your token in private chat first.\n\nClick 'Setup Fizzy Personal Token' button in /start"
        );
      }

      const description = buildCardDescription(msg, customDesc, title);
      const imageFile = await getImageFromReply(ctx, msg);

      // If only one token, auto-select it
      if (userTokens.length === 1) {
        const alias = userTokens[0].alias;
        saveLinkChatToToken(userId, chatId, alias);

        const status = await ctx.reply(
          MESSAGES.accountSelectedWithPending(alias),
          {
            reply_to_message_id: msg.message_id,
          }
        );

        const result = await createFizzyCard(
          {
            account_slug: userTokens[0].account_slug,
            board_id: board.board_id,
            token: userTokens[0].token,
          },
          title,
          description,
          imageFile
        );

        if (result.success) {
          const hasDescription = description && description !== title;
          const hasReply = !!msg.reply_to_message;
          const hasMedia = !!imageFile;
          logger.command(
            `/${command}`,
            "success",
            getCardType(hasDescription, hasReply, hasMedia),
            getSenderInfo(msg)
          );
        } else {
          logger.command(
            `/${command}`,
            "error",
            `card creation failed: ${alias}`,
            getSenderInfo(msg)
          );
        }

        return ctx.api.editMessageText(
          status.chat.id,
          status.message_id,
          result.success
            ? MESSAGES.cardCreated(title, result.url)
            : MESSAGES.cardCreationFailed(
                formatCardError(result, alias, userTokens[0].account_slug)
              )
        );
      }

      // Multiple tokens - show selection
      const pendingKey = `${userId}_${chatId}`;
      pendingCards.set(pendingKey, {
        title,
        description,
        imageFile,
        topicId,
        wasReply: !!msg.reply_to_message,
      });

      const keyboardMenu = buildAccountSelectionKeyboardMenu(userTokens);

      logger.command(
        `/${command}`,
        "success",
        "account selection menu shown",
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.selectAccountPrompt, {
        reply_markup: keyboardMenu,
      });
    }

    const tokenData = getUserTokenByAlias(userId, chatLink.alias);
    if (!tokenData) {
      logger.command(
        `/${command}`,
        "error",
        `token not found: ${chatLink.alias}`,
        getSenderInfo(msg)
      );
      return ctx.reply(MESSAGES.tokenNotFound(chatLink.alias));
    }

    const description = buildCardDescription(msg, customDesc, title);
    const imageFile = await getImageFromReply(ctx, msg);

    const status = await ctx.reply(MESSAGES.creatingCard, {
      reply_to_message_id: msg.message_id,
    });

    const result = await createFizzyCard(
      {
        account_slug: tokenData.account_slug,
        board_id: board.board_id,
        token: tokenData.token,
      },
      title,
      description,
      imageFile
    );

    if (result.success) {
      const hasDescription = description && description !== title;
      const hasReply = !!msg.reply_to_message;
      const hasMedia = !!imageFile;
      logger.command(
        `/${command}`,
        "success",
        getCardType(hasDescription, hasReply, hasMedia),
        getSenderInfo(msg)
      );
    } else {
      logger.command(
        `/${command}`,
        "error",
        `card creation failed: ${chatLink.alias}`,
        getSenderInfo(msg)
      );
    }

    const message = result.success
      ? MESSAGES.cardCreated(title, result.url)
      : MESSAGES.cardCreationFailed(
          formatCardError(result, chatLink.alias, tokenData.account_slug)
        );

    return ctx.api.editMessageText(status.chat.id, status.message_id, message);
  }

  // Ignore other messages
});

bot.catch((err) =>
  logger.error("Bot error", { error: err.message, stack: err.stack })
);

// === Webhook Server ===
const handle = webhookCallback(bot, "std/http");
const port = Number(Bun.env.PORT || 3000);

serve({ port, hostname: "0.0.0.0", fetch: handle });

logger.info("Fizzy Telegram bot started", { port, hostname: "0.0.0.0" });
