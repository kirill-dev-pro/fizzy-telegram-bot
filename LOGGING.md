# Logging Configuration

This bot uses structured JSON logging with Axiom integration for centralized log management.

## Features

- **Structured JSON logs**: All logs are output as JSON to stdout for easy parsing
- **Axiom integration**: Logs are streamed in real-time to Axiom for analysis and monitoring
- **Log levels**: Support for debug, info, warn, and error levels
- **Contextual metadata**: Each log includes relevant context (user, command, component, etc.)

## Environment Variables

Configure logging using these environment variables in your `.env` file:

```bash
# Required: Axiom authentication token
AXIOM_API_TOKEN=xaat-your-api-token-here

# Optional: Dataset name (defaults to "fizzy-telegram-bot")
AXIOM_DATASET=fizzy-telegram-bot

# Optional: Organization ID (only needed for organization accounts)
# AXIOM_ORG_ID=your-org-id

# Optional: Minimum log level (defaults to "info")
# Options: debug, info, warn, error
# LOG_LEVEL=info
```

## Axiom Setup

### 1. Get your API Token

You should use an **API token** (starts with `xaat-`) instead of a personal token (starts with `xapt-`) for better security.

To create an API token:

1. Go to [Axiom Settings](https://app.axiom.co/settings/tokens)
2. Click "Create Token"
3. Select "API Token" type
4. Give it a name (e.g., "Fizzy Telegram Bot")
5. Copy the token and update your `.env` file

### 2. Create a Dataset

If you haven't created a dataset yet:

1. Go to [Axiom Datasets](https://app.axiom.co/datasets)
2. Click "Create Dataset"
3. Name it `fizzy-telegram-bot` (or whatever you set in `AXIOM_DATASET`)
4. The bot will automatically start sending logs to this dataset

## Log Structure

All logs follow this structure:

```json
{
  "timestamp": "2025-12-30T14:00:48.445Z",
  "level": "info",
  "message": "Card created successfully",
  "service": "fizzy-telegram-bot",
  "component": "fizzy",
  "account_slug": "6118636",
  "board_id": "03f76vxqro1dw9gra8wtfhrni",
  "card_id": "12345",
  "title": "Example card",
  "has_image": false
}
```

### Common Fields

- `timestamp`: ISO 8601 timestamp
- `level`: Log level (debug, info, warn, error)
- `message`: Human-readable message
- `service`: Always "fizzy-telegram-bot"
- `component`: Which part of the bot generated the log (bot, fizzy, setup-db, reset-db)

### Contextual Fields

Additional fields vary by operation:

#### Bot Commands

```json
{
  "command": "/config_token",
  "status": "success",
  "details": "saved token: work",
  "sender": "@username"
}
```

#### Card Creation

```json
{
  "account_slug": "6118636",
  "board_id": "03f76vxqro1dw9gra8wtfhrni",
  "card_id": "12345",
  "title": "Card title",
  "has_image": true
}
```

#### API Errors

```json
{
  "status": 403,
  "error": "Forbidden",
  "account_slug": "6118636",
  "board_id": "03f76vxqro1dw9gra8wtfhrni"
}
```

## Querying Logs in Axiom

### Example Queries

**Find all errors:**

```bash
level == "error"
```

**Find card creation failures:**

```bash
message contains "Card creation failed"
```

**Track a specific user's activity:**

```bash
sender == "@username"
```

**Monitor API response times:**

```bash
component == "fizzy" | summarize avg(duration), p95(duration) by message
```

**Find authentication errors:**

```bash
status == 401 or status == 403
```

## Local Development

When developing locally:

1. Logs will always output to stdout as JSON
2. If `AXIOM_API_TOKEN` is not set, logs won't be sent to Axiom (only to stdout)
3. Set `LOG_LEVEL=debug` to see more detailed logs

## Production Deployment

On Railway:

1. Set the `AXIOM_API_TOKEN` environment variable in your Railway project
2. Logs will be sent to both Railway's log viewer and Axiom
3. Use Axiom for long-term storage and analysis
4. Railway logs are useful for real-time debugging

## Troubleshooting

### Logs not appearing in Axiom

1. Check that `AXIOM_API_TOKEN` is set correctly
2. Verify the token has write permissions for the dataset
3. Check Axiom status page for outages
4. Look for "Failed to ingest log to Axiom" errors in stdout

### Missing context fields

Some fields are optional and only appear when relevant:

- `sender`: Only on user-initiated commands
- `details`: Only when additional info is available
- `has_image`: Only on card creation operations
- `card_id`: Only when card creation succeeds

### Performance Impact

- Axiom ingestion is asynchronous and non-blocking
- Failed Axiom requests don't affect bot operation
- Logs always reach stdout even if Axiom is unavailable
