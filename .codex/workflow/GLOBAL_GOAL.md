# GLOBAL_GOAL.md - Mentium AI Teacher

## ACTIVE GOAL

**Paid Teacher Multilingual Voice and Conversational Tutor Behavior - STARTED 2026-07-10**

Make the ordinary paid teacher handle Russian, Ukrainian, and English turns
reliably while sounding more like a live tutor. Adult paid voice must not force
RU/UA speech through English-only STT; English answers must still be recognized
as English; one-turn self-correction/repetition must be accepted when the final
answer is correct; and bounded conversational follow-ups must stay tied to the
lesson without changing grading, progression, or curriculum authority.

**Current completion status:** prior reports that the backend teacher "brain"
was ready are stale. A user-provided live transcript on 2026-07-10 showed two
remaining product defects: direct word-help / ASR-confused help turns such as
`worms`, `world`, and RU/UA unknown word-help were still not useful enough, and
the paid mic could start PCM capture before the backend received `mic_start`,
which can drop the beginning of a turn. The repair is committed, pushed,
deployed, and post-deploy health/log checked at commit `703da40`. Controlled
authenticated running-product microphone smoke is still pending.

**Acceptance criteria:**
- [x] Adult paid STT defaults are multilingual for RU/UA/EN voice turns without
  using Live-API-invalid `detect_language`.
- [x] Kids STT config remains explicitly `nova-2` / `en`.
- [x] Deterministic expected-answer cleanup accepts unpunctuated one-turn
  self-correction when the final tail exactly matches the backend expected
  answer.
- [x] Negated/possessive tails such as `not keen on` and `my hobby` are not
  falsely normalized.
- [x] Repeated current expected answers remain accepted and acknowledged
  naturally.
- [x] Adult paid lesson UI provides a minimal RU/UA voice-language selector,
  and `mic_start` passes the selected language to the backend.
- [x] Adult paid STT can create explicit `language=ru` or `language=uk`
  Deepgram live streams for the next mic turn while preserving `multi` as the
  default and Kids `nova-2` / `en`.
- [x] Short mixed answer lists that contain the current expected answer, such
  as `hobby spare time` or `keen on like`, are accepted without accepting
  negated/possessive phrases.
- [x] RU/UA clarification questions during deterministic paid gap-fill items
  are answered as clarification and return to the current item without grading
  the native-language question as an English answer.
- [x] English task-help/confusion during deterministic paid gap-fill items is
  answered as help and returns to the current item without feedback, cursor
  movement, or attempt-count changes.
- [x] Direct word-help requests and ASR variants such as `which world is it`
  and `help me with this worms` are answered as current-item help without
  feedback, cursor movement, teacher-brain input, or attempt-count changes.
- [x] Paid WebSocket voice routing sends current-answer help requests such as
  `Which world is it? Which world is it? I don't know.` to deterministic
  current-item help before the off-topic guard can answer about `worlds`.
- [x] Unknown RU/UA word-help fallback during deterministic gap-fill gives the
  current expected answer instead of a dead-end `I'm not sure` response, while
  preserving known phrase-map translations such as `for 30 minutes`.
- [x] Paid classroom sends `mic_start` before PCM capture can emit the first
  `audio_chunk`, preventing first-word audio from being ignored as stale.
- [x] Paid classroom clears the input/transcript preview at mic-turn start and
  guards briefly against late previous-turn transcript events repopulating it.
- [x] Adult paid voice finalization submits/logs the captured turn id rather
  than a mutable current turn id.
- [x] Teacher text acknowledges self-correction/repetition without changing
  curriculum answers, scoring, or progression.
- [x] Teacher Brain rules allow bounded topic-aware personal questions only in
  speaking/warmup or after backend completion; deterministic gap-fill grading
  remains backend-owned.
- [x] Focused tests, `npx tsc --noEmit`, frontend production build, and full
  backend suite pass.
- [ ] Running-product adult paid lesson smoke verifies real microphone RU, UA,
  and EN turns with the configured STT provider, including no lost first words,
  no split half-turns, no stale transcript carryover, and no missing
  `student_message`.
- [x] Deploy is completed for the latest mic/help repair and health/log checks
  passed.
- [ ] Authenticated paid lesson microphone smoke passes for the latest repair.

**Paused goals:**
- Autonomous Product Delivery V3 / Telegram intake-orchestrator: local service
  and workflow are ready, but live Telegram bot smoke remains blocked on a
  user-provided new BotFather token and manual Telegram command verification.
- Owner-only paid lesson access bypass: code and deploy are complete, but the
  owner paid lesson section `1.1` live microphone smoke remains pending.
- Kids Personalization V2 and ordinary Mentium lesson mode production smoke
  remain paused behind the current paid teacher behavior repair.

---

## PREVIOUS ACTIVE GOAL

**Autonomous Product Delivery V3 - STARTED 2026-07-10**

Build the project workflow so the user can describe product outcomes to one
Telegram intake-orchestrator, while Codex runs a full autonomous delivery chain:
goal formulation, scenario contracts, implementation, live QA, adversarial
critique, failure analysis, repair loops, deployment verification, and final
acceptance audit.

**Paused goals:**
- Owner-only paid lesson access bypass: code and deploy are complete, but the
  owner paid lesson section `1.1` live microphone smoke remains pending.
- Kids Personalization V2 and ordinary Mentium lesson mode production smoke
  remain paused behind this automation upgrade.

---

## SCOPE

In scope:
- Telegram bot service for goal intake and progress/status notifications.
- Workflow contracts that force goal rebasing when the active goal no longer
  matches user-reported production defects.
- Scenario matrices covering happy, negative, adversarial, live-evidence, and
  failure-definition paths for each product goal.
- Blocking adversarial product critic, live QA gate, failure-analysis gate, and
  acceptance-auditor gate.
- Agent-chain definitions for orchestrator, analysts, implementers, developer
  reminder, QA, critic, failure analyst, deployment verifier, and handoff
  writer.
- Safe secret handling: bot tokens and internal API keys must come only from
  environment variables and must never be committed.

Out of scope for this first automation phase:
- Fixing the paid lesson runtime defects themselves.
- Changing billing, payment, or authentication product logic.
- Changing Kids Brain behavior, STT/TTS provider behavior, curriculum content,
  or `docs/master-prompt.md`.
- Deploying the new bot service to Railway unless explicitly requested after
  local validation.

---

## ACCEPTANCE CRITERIA

- [x] Telegram bot service is scaffolded without hardcoded secrets.
- [x] Bot accepts rough product goals and converts them into structured goal
  packets with user outcome, scenario contract, agent chain, blocking gates,
  and Codex next action.
- [x] Bot supports platform linking endpoints already expected by the backend:
  `/internal/telegram/consume-link-token` and `/internal/telegram/linked`.
- [x] Bot exposes internal Codex/status endpoints protected by
  `INTERNAL_TELEGRAM_API_KEY`.
- [x] Bot redacts Telegram/API-token-like secrets before storing goal packets.
- [x] Unit tests cover secret redaction and goal-packet generation.
- [x] Workflow documents define the multi-agent delivery chain and make
  scenario contracts mandatory before implementation.
- [x] Workflow documents make adversarial product critique and live evidence
  blocking for lesson, voice, AI, frontend, backend, billing/auth, curriculum,
  safety, and deployment surfaces when affected.
- [x] Workflow documents require goal rebasing before further repair when the
  active goal/scope no longer matches the real product failure.
- [x] Current paused paid-lesson goal is preserved and not falsely marked
  complete.
- [x] `tools/telegram-orchestrator` tests pass.
- [x] Repository diff check passes.
- [ ] Telegram bot is run against Telegram with the provided token from local
  environment only, and `/start`, `/new_goal`, `/confirm`, `/status`,
  `/export`, and `/link` are manually verified.
- [ ] Optional deployment is completed only after explicit deploy approval and
  production bot health/status checks pass.

---

## PHASE SEQUENCE

| Phase | Name | Status |
|-------|------|--------|
| 0 | Recovery and goal rebase | COMPLETE |
| 1 | Telegram intake-orchestrator service | COMPLETE |
| 2 | Multi-agent workflow contracts | COMPLETE |
| 3 | Local validation and review | COMPLETE |
| 4 | Telegram live bot smoke | PENDING - requires running with secret token outside repository |
| 5 | Optional deploy and production verification | PENDING - requires explicit deploy approval |

---

## CURRENT CONSTRAINTS

- Do not write the Telegram bot token to any file, git diff, log, or workflow
  state. Use `TELEGRAM_BOT_TOKEN` only from environment.
- Rotate the Telegram token after setup because it was shared in chat.
- Local C: drive has had no free space; npm commands that need cache/temp must
  use `D:\codex-npm-cache` and `D:\codex-temp` where applicable.
- Do not touch LiqPay keys, payment flow, auth logic, Kids Brain behavior,
  STT/TTS provider configuration, curriculum content, or `docs/master-prompt.md`
  for this automation task.
- Deployment is not authorized by this goal unless the user explicitly asks
  for the bot service deployment after local verification.
