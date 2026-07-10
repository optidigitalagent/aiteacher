# Codex Intake Telegram Bot

Standalone Telegram service for Codex Automation V3 goal intake.

## What It Does

- Accepts rough product ideas in Telegram.
- Converts them into structured goal packets with scenario contracts, agent
  chain, blocking gates, and Codex next action.
- Can support the platform backend's Telegram link flow only when explicitly
  enabled.
- Lets Codex/tooling read latest goal packets and send project updates through
  internal API endpoints.

## Commands

- `/start` - help
- `/new_goal` - start a goal intake
- `/confirm` - persist the current draft for Codex
- `/status` - show latest goal packet
- `/export` - show latest packet JSON
- `/link` - disabled by default for standalone bots
- `/cancel` - cancel current draft

## Environment

Copy `.env.example` into your runtime environment. Do not commit real values.

```text
TELEGRAM_BOT_TOKEN=<from BotFather>
INTERNAL_TELEGRAM_API_KEY=<shared backend/bot secret>
ORCHESTRATOR_ALLOWED_CHAT_IDS=12345,67890
ORCHESTRATOR_DATA_DIR=./data
ORCHESTRATOR_BOT_NAME=Codex Intake Bot
ORCHESTRATOR_PLATFORM_LINK_ENABLED=0
PORT=4010
```

## Local Run

Recommended standalone run for a new BotFather bot:

```powershell
cd tools/telegram-orchestrator
npm run start:local
```

The helper asks for the new token without echoing it, clears Telegram webhook
state for polling mode, detects your chat id after you send `/start`, and
starts the bot with platform linking disabled.

The real bot token must never be committed or pasted into chat. Rotate it
after any accidental sharing.

## Tests

```powershell
cd tools/telegram-orchestrator
node --test
```
