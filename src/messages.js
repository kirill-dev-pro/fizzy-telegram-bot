import { FIZZY_BASE_URL } from "./fizzy";

export const MESSAGES = {
  welcomePrivate: `
🚀 Welcome to Fizzy Telegram Bot!

📝 Getting Started:

1️⃣ *Setup token* — Configure your Fizzy personal token here in private chat
   Use the "Setup Token" button below or run:
   \`/config_token <alias> <slug> <token>\`
   
   Get your token on "My profile" section on ${FIZZY_BASE_URL}

2️⃣ *Setup board* — Go to your group/topic and run:
   \`/config_board <board_id>\`

3️⃣ *Create cards* — Start creating cards with:
   \`/issue <title>\`, \`/todo <title>\`, or \`/fizzy <title>\`

Use the buttons below for easy setup! 👇
  `.trim(),

  welcomeGroup: `
🚀 Welcome to Fizzy Telegram Bot!

📝 Getting Started:

1️⃣ *Setup token* — Configure your Fizzy personal token in private chat
   Click "Setup Fizzy Personal Token" button below

2️⃣ *Setup board* — Set the board for this topic/chat:
   \`/config_board <board_id>\`

3️⃣ *Create cards* — Start creating cards:
   \`/issue <title>\`, \`/todo <title>\`, or \`/fizzy <title>\`
   
   Example: \`/todo Fix login\` or \`/issue Add feature -d Description here\`

💡 Tip: Reply to messages/images to include context in your cards!
  `.trim(),

  configTokenHelp: `
*Command*
\`/config_token <alias> <account_slug> <personal_token>\`

Params:

• _Alias_
A friendly name for this account \\(e\\.g\\., work, personal, client\\-acme\\)

• _Account slug_
Your account slug in Fizzy app, usually the first number on url after domain:
https://app\\.fizzy\\.do/1234456/ \\(1234456 is account slug\\)

• _Personal token_
You can generate one in "My profile" in Fizzy app\\.

*Example of usage:*
\`/config_token work 1234456 abc123token456\`
  `.trim(),

  configTokenMissingArgs: (isPrivate = false) =>
    `❌ Missing arguments!

Usage:
\`/config_token <alias> <account_slug> <personal_token>\`

Example:
\`/config_token work 1234456 abc123token456\`
${!isPrivate && "\n🚨 Run this command in private chat for security."}
  `.trim(),

  tokenSaved: (alias, accountSlug) =>
    `✅ Token '${alias}' saved!\n\nAccount: ${accountSlug}`,

  tokenUpdated: (alias, accountSlug) =>
    `✅ Token '${alias}' updated!\n\nAccount: ${accountSlug}\n\n💡 Tip: Any chats using this account will now use the new token.`,

  noAccountsConfigured: `
❌ No accounts configured.

Set up your token in private chat first.

Click 'Setup Fizzy Personal Token' button.
  `.trim(),

  selectAccountPrompt: "🔑 Select which account to use for this chat:",

  boardSet: (boardId, boardName, alias, accountSlug) => {
    const boardDisplay = boardName ? `${boardId} (${boardName})` : boardId;
    if (alias && accountSlug) {
      return `✅ Board set: ${boardDisplay}\n\nUsing account: ${alias} (${accountSlug})\n\nYou can now use /issue, /todo, or /fizzy here.`;
    }
    return `✅ Board set: ${boardDisplay}\n\nYou can now use /issue, /todo, or /fizzy here.`;
  },

  missingTitle: (command) =>
    `
Missing title!

Usage:
\`/${command} <title> -d [description]\`

Example:
\`/${command} Fix login -d Happens on iOS only\`
Or: \`/${command} Add favicon\`
  `.trim(),

  creatingCard: "Creating Fizzy card...",

  cardCreated: (title, url) => `✅ Card created!\n${title}\n${url}`,

  noBoardConfigured:
    "❌ No board configured. Use /config_board <board_id> first.",

  mustSelectAccountFirst: `
⚠️ First, select which account to use for this chat.

Use /select_account to select your account, then run /config_board again.
  `.trim(),

  // Status messages
  statusPrivateNoAccounts: `
📊 Your Status:

❌ No Fizzy accounts configured yet.

You need to set up your Fizzy personal token first.

Click the 'Setup Token' button below to get started.
  `.trim(),

  statusPrivateWithAccounts: (accounts) => {
    let msg = "Saved Token Accounts:\n\n";
    accounts.forEach((account) => {
      msg += `• ${account.alias} (${account.account_slug})\n`;
    });
    return msg;
  },

  statusGroup: (chatLink, tokenData, board) => {
    let msg = "Status\n\n";

    if (chatLink && tokenData) {
      msg += `✅ Personal Token: ${chatLink.alias} (${tokenData.account_slug})\n`;
    } else {
      msg += `❌ Personal Token: not set\n`;
    }

    if (board) {
      const boardDisplay = board.board_name || board.board_id;
      msg += `✅ Board: ${boardDisplay}\n`;
    } else {
      msg += `❌ Board: not set\n`;
    }

    return msg;
  },

  // Help messages
  helpPrivate: `
📚 *Available Commands*

*Account Management:*
• \`/config_token <alias> <slug> <token>\` — Save/update Fizzy account
  Example: \`/config_token work 1234456 abc123token456\`
• \`/delete_account <alias>\` — Remove saved account
  Example: \`/delete_account work\`

*General:*
• \`/start\` — Show welcome message and setup steps
• \`/help\` — Show this help message
• \`/status\` — Show all your configured accounts

*Usage:*
1\\. Save your Fizzy token\\(s\\) here in private chat
2\\. Go to your group and run \`/config_board <board_id>\`
3\\. Start creating cards with \`/issue\` or \`/todo\`

💡 Tip: Run any command without arguments to see examples\\.
  `.trim(),

  helpGroup: `
📚 *Available Commands*

*Setup:*
• \`/config_board <board_id>\` — Set board for this topic/chat
  Example: \`/config_board 03f770pvr5f56\`
• \`/select_account\` — Switch Fizzy personal token account for this chat

*Creating Cards:*
• \`/issue <title> -d [description]\` — Create a card
• \`/todo <title> -d [description]\` — Create a card \\(same as issue\\)
• \`/fizzy <title> -d [description]\` — Create a card \\(same as issue\\)
  
  Examples:
  • \`/todo Fix login\`
  • \`/issue Add feature -d Description here\`
  • \`/fizzy Review PR -d Check the new login flow\`
  
  💡 Tip: Reply to a message/image to include context in your card\\!

*General:*
• \`/start\` — Show welcome message and setup steps
• \`/help\` — Show this help message
• \`/status\` — Show current account and board configuration

*Note:* First configure your token in private chat\\!
  `.trim(),

  // Error messages
  configTokenIncorrectArgs: `
❌ Incorrect arguments!

Usage:
\`/config_token <alias> <account_slug> <personal_token>\`

Example:
\`/config_token work 1234456 abc123token456\`
  `.trim(),

  configTokenNotPrivate: `
⚠️ For security, tokens must be set in private chat.

Click the 'Setup Token (Private Chat)' button to configure your account.
  `.trim(),

  deleteAccountMissingAlias: `
❌ Missing account alias!

Usage:
\`/delete_account <alias>\`

Example:
\`/delete_account work\`

💡 Use /help to see all your configured accounts.
  `.trim(),

  deleteAccountIncorrectArgs: `
❌ Incorrect arguments!

Usage:
\`/delete_account <alias>\`

Example:
\`/delete_account work\`
  `.trim(),

  deleteAccountNotPrivate: "This command is only available in private chat.",

  deleteAccountNotFound: (alias) => `❌ Account '${alias}' not found.`,

  deleteAccountSuccess: (alias) => `✅ Account '${alias}' deleted.`,

  configBoardMissingId: `
❌ Missing board ID!

Usage:
\`/config_board <board_id>\`

Example:
\`/config_board 03f770pvr5f56\`
  `.trim(),

  configBoardIncorrectArgs: `
❌ Incorrect arguments!

Usage:
\`/config_board <board_id>\`

Example:
\`/config_board 03f770pvr5f56\`
  `.trim(),

  configBoardInvalidId: "❌ Invalid board ID. Board IDs are usually longer.",

  configBoardNoTokenPrivate: `
⚠️ First, configure your token in private chat!

Click 'First, let's setup token (Private Chat)' button in /start
  `.trim(),

  selectAccountIncorrectArgs: `
❌ This command doesn't take arguments!

Usage:
\`/select_account\`

This command will show you a menu to select which account to use for this chat.
  `.trim(),

  selectAccountNotGroup: "This command is only available in group chats.",

  accountSelected: (alias) => `✅ Account '${alias}' selected for this chat!`,

  accountSelectedWithPending: (alias) =>
    `Using '${alias}' account. Creating card...`,

  tokenNotFound: (alias) =>
    `❌ Token '${alias}' not found. Please set it up in private chat.`,

  boardNotConfigured:
    "❌ No board configured. Use /config_board <board_id> first.",

  missingTitleReply: (command) =>
    `Missing title!\n\nUsage:\n/${command} <title> -d [description]\n\nExample:\n/${command} Fix login -d Happens on iOS only\nOr: /${command} Add favicon`,

  cardCreationFailed: (error) => `❌ Failed to create card\n\n${error}`,

  welcomeBotAdded: "Welcome! Click below to set up:",
};
