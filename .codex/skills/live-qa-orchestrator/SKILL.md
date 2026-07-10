---
name: "live-qa-orchestrator"
description: "Run automation-first live QA with browser/API/WS/log/voice evidence before user-facing completion claims."
---

Follow `AGENTS.md` first. Use this skill when the goal affects live product
behavior, deployment, browser workflows, WebSocket flows, voice, STT, TTS, or
teacher behavior.

## Process

1. Prefer automated Playwright/API/WS checks over manual smoke.
2. Collect browser console errors, page errors, screenshots, traces, and videos
   where possible.
3. Correlate frontend session id, backend logs, WebSocket events, and runtime
   traces.
4. For voice work, verify transcript, final student message, TTS availability,
   teacher turn end, audio decode/duration, interruption, and no stale carryover.
5. Record exact pass/fail evidence.

## Blocking Rule

A deploy health check is not live QA. Completion is blocked if affected
behavior has no running-product proof.
