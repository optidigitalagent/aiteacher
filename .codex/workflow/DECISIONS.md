# DECISIONS.md — Architectural Decision Log

> Record every non-obvious architectural or implementation decision made
> during autonomous goal execution. Never delete entries — append only.
> Format: date, decision, reason, alternatives rejected.

---

## Template

```
### [DATE] — <short title>

**Decision:** <what was decided>
**Reason:** <why — constraint, tradeoff, evidence>
**Alternatives rejected:** <what was considered and why not chosen>
**Reversible:** yes / no / with-migration
**Risk:** low / medium / high
```

---

## Active Decisions

### 2026-07-10 - Paid lesson intelligence repair stays deterministic and expected-answer bounded

**Decision:** Repair the observed paid lesson teaching defects with bounded
backend logic: STT cleanup may only return the current backend expected answer,
deterministic exercise wording remains backend-authored from engine/cursor
state, and Teacher Brain only gets a warm bridge/follow-up allowance in
speaking/warmup rather than gap-fill item turns.
**Reason:** The user reported real paid lesson AI behavior issues, but asked to
improve the AI intelligence/teaching layer rather than frontend or microphone
mechanics. Keeping cleanup expected-answer bounded fixes likely STT mistakes
without broad substring acceptance. Keeping deterministic text backend-authored
prevents LLM wording from contradicting cursor authority.
**Alternatives rejected:** Broad phonetic/substring answer acceptance; moving
gap-fill correctness to the LLM; opening personal follow-up inside
deterministic gap-fill; changing frontend mic behavior.
**Reversible:** Yes.
**Risk:** Medium until the repair is deployed and verified with the live paid
lesson and real microphone.

### 2026-07-10 - Paid voice repair stays backend-authoritative and avoids invented news

**Decision:** The paid voice smoke repair keeps backend Deepgram / exercise
engine as the authoritative voice path. STT model/language can be configured by
environment, but the default remains `nova-2` / `en`. Human tutor behavior may
ask one short follow-up only in speaking/warmup and may use lesson topic,
student memory, or backend-supplied context, but must not invent current
news/events.
**Reason:** The user wants cleaner voice turns and a more human teacher without
raising cost or breaking curriculum authority. Backend expected-answer cleanup
can safely normalize noisy deterministic transcripts because expected answers
come from current backend state. Current-event claims would require external
research, which is not authorized by repository rules.
**Alternatives rejected:** Browser-only paid STT submission; broad substring
answer acceptance; changing the default STT language/model without provider
verification; free-chat loops; invented news/movie/festival hooks.
**Reversible:** Yes.
**Risk:** Medium until deployed and verified with real production audio.

### 2026-07-10 - User operating preferences live in AGENTS.md

**Decision:** The user's Russian project-work rules were added to root
`AGENTS.md` as `User Operating Preferences`.
**Reason:** `AGENTS.md` is the repository instruction file that Codex reads
before work. Keeping these preferences there makes future fresh chats inherit
the rules for autonomous checks, deployment when in scope, post-deploy
verification, concise final responses, and compact handoff reports.
**Alternatives rejected:** Store the rules only in chat history or only in
workflow progress, which would be missed by new chats.
**Reversible:** Yes.
**Risk:** Low - documentation/workflow instruction change only.

### 2026-07-09 - Paid adult voice finalization is backend-outcome driven

**Decision:** Paid adult mic stop must end with an explicit backend outcome:
`student_message`, `voice_turn_empty`, or STT `voice_unavailable`. The frontend
does not normally release pending mic state on a short local no-text guess; its
timer is only a lost-event fallback. Noisy deterministic STT cleanup may submit
only a backend current expected answer.
**Reason:** Production evidence showed the old 1500ms frontend timeout could
clear pending state before backend finalization, allowing stale/double submits.
It also showed Deepgram can include self-corrections in one transcript
(`Harvey. Hobby.`, `Get fit. Free time.`). Backend state is the only safe
authority for final answer text, transcript recording, scoring, and cursor
progression.
**Alternatives rejected:** Browser-only paid STT submit; accepting any
substring that contains an answer; keeping frontend no-text timeout as normal
control flow; allowing teacher prompt rules to open free chat during
deterministic textbook items.
**Reversible:** Yes.
**Risk:** Medium until deployed and verified with real production audio.

### 2026-07-09 - Paid mic transcript preview does not replace backend STT

**Decision:** Paid lesson keeps backend Deepgram / lesson engine as the
authoritative source for final student voice turns. Frontend only preserves and
displays transcript preview during `mic_stop` finalization and blocks duplicate
submits while waiting for the backend `student_message`.
**Reason:** Demo uses browser WebSpeech directly, but paid lessons need the
backend WebSocket/STT path for transcript recording, scoring, cursor authority,
and consistent AI context. The production issue was UX visibility and button
state, not a need to move paid scoring to browser-only STT.
**Alternatives rejected:** Submit browser WebSpeech text directly for paid
voice turns; run WebSpeech and Deepgram in parallel as competing sources;
continue clearing paid input immediately on `mic_stop`.
**Reversible:** Yes.
**Risk:** Low - backend authority is preserved; live browser/mic smoke is still
required after deploy.

---

### 2026-07-09 - Paid deterministic item turns bypass Teacher Brain wording

**Decision:** For ordinary paid deterministic engine turns with actions
`step_correct`, `soft_pass`, `exercise_complete`, or `step_revealed`,
`MasterLessonOrchestrator` now returns backend-authored
`deterministicTeacherText`; `lesson-ws` sends that text and TTS directly instead
of calling the Teacher Brain for the verbal wording of that turn.
**Reason:** Live paid lesson smoke showed the engine cursor could advance while
LLM wording still said to stay on the old item because conversation history
contained repeated wrong attempts. Correctness and progression were already
backend-authoritative; the remaining unsafe surface was letting the LLM restate
the cursor transition for simple deterministic outcomes.
**Alternatives rejected:** Add stronger prompt text only; rely on stale-item
guards after generation; keep partial MP3 streaming and change frontend decode
logic in the same patch.
**Reversible:** Yes.
**Risk:** Medium - deterministic text is less conversational, but it prevents
state contradictions in correctness-critical paid exercise turns.

---

### 2026-07-09 - ElevenLabs TTS sends one complete MP3 per teacher turn

**Decision:** Buffer ElevenLabs network chunks into a single `audio_chunk`
before sending to the frontend, matching the existing OpenAI TTS path.
**Reason:** The frontend decodes every `audio_chunk` as a complete MP3. Network
read chunks from ElevenLabs are arbitrary byte boundaries and can be
undecodable partial MP3 fragments, causing audible truncation such as dropping
`Tell me when you're ready.` from the opening greeting.
**Alternatives rejected:** Continue streaming partial MP3 chunks; add frontend
MediaSource streaming in the same repair; force OpenAI TTS via env.
**Reversible:** Yes, if the frontend later supports true streaming MP3 assembly.
**Risk:** Low - this adds one-turn TTS latency but avoids lost audio and mirrors
the already-tested OpenAI TTS buffering path.

---

### 2026-06-07 — Kids STT utterance_end_ms raised to 1000ms

**Decision:** UTTERANCE_END_MS_KIDS changed from 700 → 1000ms
**Reason:** Deepgram API minimum is 1000ms. 700ms caused HTTP 400 on Kids
  WebSocket upgrade. Adult config (1500ms) was already valid.
**Alternatives rejected:** Removing utterance_end_ms entirely — would lose
  UtteranceEnd events which are required for silence detection.
**Reversible:** Yes (change constant back)
**Risk:** Low

---

### 2026-06-07 — Kids Audio Buffering During waitUntilReady

**Decision:** Buffer up to 200 audio chunks during STT connection wait,
  flush after Open, discard on timeout.
**Reason:** mic_start awaits WebSocket open (~200–500ms). Browser sends
  audio immediately. Without buffering, first chunks are lost → no_transcript.
**Alternatives rejected:** Delaying mic_start on frontend — requires
  frontend change and adds latency. Increasing wait timeout — doesn't
  solve the lost-chunk problem.
**Reversible:** Yes
**Risk:** Low

---

### 2026-06-07 — Kids Brain STT Pre-warm on Connection Death

**Decision:** When Deepgram closes unexpectedly between turns, immediately
  create a fresh connection (pre-warm), not wait for next mic_start.
**Reason:** mic_start has no time budget for a fresh WebSocket handshake.
  Pre-warming during teacher TTS (5–20s window) gives connection time to open.
**Alternatives rejected:** Reconnect on mic_start — handshake latency
  causes lost audio. Persistent connection — Deepgram closes idle connections.
**Reversible:** Yes
**Risk:** Low

---

### 2026-06-07 — Exercise Context WS Message Fields

**Decision:** Added requiresVisualUI, visualAssetUrl, exerciseType to
  OutboundKidsExerciseContext. Frontend shows visual panel when URL present.
**Reason:** Frontend needs to know exercise type to render correct UI
  without parsing teacher text. URL can be null → graceful fallback.
**Alternatives rejected:** Frontend inferring type from teacher text —
  fragile, breaks on prompt edits.
**Reversible:** Yes (fields are additive)
**Risk:** Low

---

### 2026-06-07 — Fix test fixture instead of simplifying SessionMemory

**Decision:** Updated phase-1-exercise-escalation test fixture to use correct
  SessionMemory fields rather than simplifying the SessionMemory type.
**Reason:** SessionMemory is a production contract used by Redis storage and
  multiple agents. Loosening required fields to fix a test would create false
  confidence that partial memory objects are safe.
**Alternatives rejected:** Making SessionMemory fields optional — would weaken
  type safety across all callers. Using `as unknown as SessionMemory` cast —
  would hide real type errors.
**Reversible:** Yes (test-only change)
**Risk:** Low

---

### 2026-06-07 — Map non-existent ClassificationLabel values to nearest semantic equivalents

**Decision:** In test, replaced WRONG_WORD→WRONG_SEMANTIC, L1_DETECTED→L1_TRANSLATION,
  NOISE_ONLY→RANDOM_NONSENSE. These are the closest semantic equivalents.
**Reason:** The test is verifying that MOVE_ON fires for "any non-correct label".
  The exact label doesn't matter for this test — what matters is that it's non-correct.
  Any wrong/L1/noise label serves the same purpose.
**Alternatives rejected:** Adding the removed labels back to the enum — would create
  duplicates and confusion in the classification system.
**Reversible:** Yes (test-only change)
**Risk:** Low

---

> Append new decisions below as autonomous work progresses.

### 2026-07-09 - Owner paid access bypass lives in subscription service

**Decision:** Implement the `artenon92@gmail.com` no-payment/no-limit exception
inside `backend/src/billing/subscription-service.ts` by returning a virtual
active subscription from `getSubscription`.
**Reason:** Both `/lesson/start` and paid classroom WebSocket entry already
trust the shared backend subscription service. Placing the exception there
keeps auth required, avoids frontend trust, avoids duplicate REST/WS bypass
branches, and leaves LiqPay checkout/callback/key handling untouched per user
instruction.
**Alternatives rejected:** Set fake LiqPay keys or edit checkout flow; create a
real subscription row by payment activation; add frontend-only bypass; bypass
only `/lesson/start` while leaving WebSocket payment guard unchanged.
**Reversible:** Yes.
**Risk:** Medium - this is an intentional billing exception and must remain
limited to the exact owner email.

### 2026-07-09 - Ordinary Mentium mode supersedes Kids work as active priority

**Decision:** Replace the active execution target with ordinary, non-Kids
Mentium lesson production readiness. Keep Kids evidence and risks, but pause
Kids implementation/debugging until the user re-prioritizes it.
**Reason:** The latest live Kids retest showed a real Kids loop, but the user
explicitly said to stop doing Kids mode and focus on the ordinary mode because
it is much more important. Repository and production evidence show ordinary
baseline checks are green, so the next valuable work is ordinary production
smoke verification rather than more Kids repair.
**Alternatives rejected:** Continue debugging Kids progression immediately;
enable additional Kids V2 flags; deploy without product-code changes.
**Reversible:** Yes.
**Risk:** Medium - Kids remains with an open progression-loop risk, but the
user-set priority is ordinary mode.

### 2026-06-10 — Micro-dialogue cooldown: count-up from 0 (design doc was internally inconsistent)

**Decision:** `createInitialPersonalizationState().microDialogueCooldown` changed 3 → 0.
  Semantics: counts exercises completed since the last micro-dialogue (count-up);
  engine eligibility requires `>= MICRO_DIALOGUE_COOLDOWN_EXERCISES (3)`;
  lesson-ws increments on each exercise advance and resets to 0 on fire.
**Reason:** docs/kids-personalization-v2.md was internally inconsistent: it specified
  initial value 3 with the comment "so first dialogue can fire after 3 exercises",
  but also M1 ("fires after ≥3 exercises", unit test "cooldown < 3 → no dialogue"),
  "cooldown++ after each exercise advance", and "on fire: cooldown = 0" — which is
  count-up arithmetic. Initial value 3 under count-up would make the first dialogue
  eligible after exercise 1, violating M1. GLOBAL_GOAL acceptance criterion M1 is
  authoritative → initial 0.
**Alternatives rejected:** keep initial 3 (violates M1 for the first dialogue);
  countdown semantics (contradicts M1's unit-test wording and the design's
  "cooldown++" / "reset to 0" rules).
**Reversible:** Yes (single constant in createInitialPersonalizationState)
**Risk:** Low — flag default-off; only affects when the FIRST dialogue may fire.

### 2026-06-10 — Phase 5 logic extracted to helpers to respect wiring-test regex window

**Decision:** Micro-dialogue interception/fire logic lives in helpers
  (handleKidsMicroDialogueReply, maybeFireKidsMicroDialogue,
  buildKidsTurnPersonalization) outside processKidsBrainV1Turn.
**Reason:** session-analytics.test.ts and phase-16b-runtime-safety.test.ts extract
  processKidsBrainV1Turn with regex window [\s\S]{1,12000} — inlining Phase 5 code
  pushed the function to 12,255 chars and broke both guard tests. Extracting helpers
  (now 11,520 chars) fixes the tests without weakening them, and matches the
  30-line-function rule in .codex/rules/backend.md.
**Alternatives rejected:** widening the regex in the guard tests (weakens
  pre-existing safety tests to accommodate new code).
**Reversible:** Yes
**Risk:** Low — future growth of processKidsBrainV1Turn will re-break the window
  (logged as RISK-016).

### 2026-06-12 — substituteChildName: function replacer (safety fix)

**Decision:** `substituteChildName` uses a function replacer
`template.replace(/\[childName\]/g, () => name)` instead of a string
replacement.
**Why:** JavaScript `String.replace` interprets `$`-sequences (`$&`, `$'`,
`` $` ``, `$$`) in STRING replacements. The kids-safety-monitor demonstrated by
execution that profile names containing `$` produced garbled spoken greetings
(template fragments duplicated, placeholder leaking into TTS). A function
replacer returns the name verbatim — the profile name is never interpreted.
**Pinned by:** 2 regression tests in personalization-engine.test.ts (T3 block):
$-sequence names render literally; a name that is literally "[childName]" is
spoken verbatim exactly once (no re-expansion).
**Reversible:** Yes (but do not — this is a safety contract).
**Risk:** None known; blast radius of the original bug was bounded to fragments
of the approved template (API caps names at 1–100 chars).

### 2026-06-12 — Persona greeting/closing exempt from the 15-word truncator

**Decision:** buildPersonaGreeting/buildPersonaClosing do NOT pass through
truncateAtWordBudget. Their bound is: template text pinned ≤20 words by test
+ childName capped at 100 chars (MAX_CHILD_NAME_CHARS).
**Why:** Design Section 4.1 scopes the 15-word budget to INTEREST sentences;
the greeting constraint is "template-based only". Truncating the greeting
could cut the readiness cue ("are you ready?") that the curriculum handshake
relies on.
**Recorded at:** Phase 7 review (QA W-027 asked for an explicit decision).
**Reversible:** Yes.
**Risk:** A many-word 100-char name yields a ~29-word greeting worst-case —
bounded and TTS-safe.

### 2026-07-09 — Codex Automation V2 owns workflow state and role handoffs

**Decision:** `AGENTS.md` and the Automation V2 workflow contracts are the
authoritative execution layer. `Continue.` triggers state reconstruction and
resume; rough ideas trigger intake and planning. Role checklists run internally
and exchange evidence through `.codex/workflow/`, never through user
copy/paste. The Claude sync script preserves existing Codex workflow state and
V2-overridden orchestration skills.
**Reason:** The prior adapted workflow could overwrite live Codex state, asked
the user to paste a launch prompt, and contained reviewer output contracts that
could erase other reviewers. Those behaviors break interruption recovery and
autonomous phase advancement.
**Alternatives rejected:** Keep prompt-copy launch instructions; synchronize
active state from `.claude`; require separate user-mediated reviewer sessions.
**Reversible:** Yes, by changing the V2 contracts and sync preservation list.
**Risk:** Low. Legacy sections remain for historical context but are explicitly
subordinate to the V2 overrides and `AGENTS.md`.

### 2026-06-12 — buildWarmupReturnPhrase intentionally has no flag gate

**Decision:** buildWarmupReturnPhrase stays ungated by feature flags.
**Why:** It is a close-out path: a warmup already in progress must always be
closeable, even if flags are flipped off mid-session (same rationale as
isMicroDialogueInProgress not being flag-gated, Phase 5). A null here would
strand the child in warmup state.
**Recorded at:** Phase 7 review (QA W-027 flagged the asymmetry).
**Reversible:** Yes (but do not without handling the mid-session flag flip).
**Risk:** None — it only fires when lesson-ws is already draining a warmup.

### 2026-07-09 - target-word correction handles only confirmed teacher retry echo

**Decision:** The production `Say again. Blue.` failure is handled in
`backend/src/ws/kids-stt-correction.ts`, not by changing curriculum answers or
opening deterministic classification to any transcript containing the target.
Only the confirmed pattern `say again` followed by trailing current target
word(s) is normalized to the target word.
**Why:** Production logs proved the mic/STT path was alive and the failure was
classification of a mixed teacher retry echo plus target word. A broad
"contains target" rule would weaken curriculum authority and risk false
progression on arbitrary phrases. A narrow correction preserves the existing
multi-word guard for `I said blue`, `the blue`, social speech, and target-free
retry prompts.
**Alternatives rejected:** Accept any single target word contained in a longer
transcript; change Kids Brain accepted answers; change STT/TTS configuration;
make a frontend-only mic timing change without backend protection.
**Pinned by:** 4 tests in
`backend/src/ws/__tests__/phase-21-kids-stt-target-word-correction.test.ts`.
**Reversible:** Yes.
**Risk:** Pure speaker echo of exactly `Say again. Blue.` could be accepted as
the target; logged as RISK-020 and bounded by the narrow allowlist.
