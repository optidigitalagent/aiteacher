# Telegram Goal Import Contract

## Purpose

Convert confirmed Telegram goal packets from `tools/telegram-orchestrator` into
Codex workflow state.

## Discovery

When a user says to continue from Telegram, or when a goal packet is expected:

1. Read the latest packet from the bot service:
   `GET /internal/orchestrator/latest` with
   `Authorization: Bearer $INTERNAL_TELEGRAM_API_KEY`.
2. If the bot service is not running locally or deployed, read the JSONL file
   only when `ORCHESTRATOR_DATA_DIR` is known and available.
3. Never print or persist `INTERNAL_TELEGRAM_API_KEY`.

## Import

For a packet with `status=INTAKE_READY_FOR_CODEX`:

1. Run repository recovery.
2. Run `goal-intake-orchestrator`.
3. Rebase or create `GLOBAL_GOAL.md`, `GOAL.md`, and `NEXT_ACTION.md`.
4. Materialize a concrete per-goal `SCENARIO_MATRIX.md`; the generic packet
   scenario contract is only an intake seed.
5. Record the role chain using `roleSkillMap` from the packet.
6. Write a progress checkpoint with the packet id.

## Completion

After import, notify the bot through `/internal/orchestrator/events` when the
bot service is available. Do not mark the packet consumed until workflow files
contain a concrete next action.
