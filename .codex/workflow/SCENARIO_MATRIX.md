# Scenario Matrix Contract

## Rule

No product goal may enter implementation until this matrix exists for the goal.
Rows may be marked `NOT APPLICABLE`, but the reason must be concrete.

| Scenario Type | Required Evidence | Blocking Failures |
|---|---|---|
| Happy path | The intended user completes the workflow in the app | Outcome not visible or state not updated |
| Negative path | Wrong, partial, confused, repeated, empty, or invalid inputs | App loses state, gives false success, or dead-ends |
| Adversarial path | Critic tries to distract, interrupt, race, repeat, or derail | Teacher/app drifts, accepts unsafe state, or loops |
| Multilingual path | Affected languages and mixed-language turns are tested | Unsupported language silently breaks target flow |
| Voice path | Mic, STT, TTS, transcripts, interruption, and audio completion | Lost turn, stale transcript, duplicate submit, text-only turn |
| Browser path | Playwright trace/screenshot/video/console/page errors | UI overlap, hidden state, broken navigation, unhandled error |
| Backend path | API/WS events, DB/Redis state, server logs | Unauthorized access, cursor drift, race, missing persistence |
| Prompt/teacher path | Teacher behavior stays task-bound and useful | Robotic loop, wrong item, hallucination, uncontrolled chat |
| Curriculum path | Target content, accepted answers, scoring, progression | Personalization changes correctness or progression |
| Safety path | Child/adult safety boundaries where applicable | Unsafe content, PII leak, roleplay/safety bypass |
| Deployment path | Health checks, startup logs, 4xx/5xx scan, smoke | Deploy success without behavior proof |

## Completion Rule

The scenario matrix is complete only when each applicable row has:

- exact action sequence;
- expected product behavior;
- evidence source;
- owner role;
- pass/fail result;
- linked repair task for failures.

---

## Active Scenario Matrix - Paid Teacher Multilingual Voice and Conversational Tutor Behavior

| Scenario Type | Action Sequence | Expected Product Behavior | Evidence Source | Owner Role | Result |
|---|---|---|---|---|---|
| Happy path | Start adult paid lesson section `1.1`; answer deterministic English items by voice, including `hobby`, `spare time`, `keen on` | English is transcribed as English, current expected answer is graded correctly, cursor advances only through backend engine | Local tests: `paid-vocab-flow.test.ts`, full backend suite | qa-tester | PASS locally; live smoke pending |
| Negative path | Say `not keen on` or `my hobby` while current expected answer is `keen on` / `hobby` | Transcript is not falsely normalized to expected answer | `voice-turn-stabilizer.test.ts` | qa-tester | PASS |
| Adversarial path | Say wrong answer first and correct answer second in one turn: `Like keen on`; repeat correct phrase: `keen on keen on` | Final expected answer is accepted; teacher acknowledges self-correction/repetition without punishing; no answer is invented | `voice-turn-stabilizer.test.ts`, `paid-vocab-flow.test.ts` | adversarial-product-critic | PASS locally; live smoke pending |
| Multilingual path | Select RU or UA in the paid mic selector, then ask a short Russian clarification and a short Ukrainian clarification during adult paid lesson | `mic_start.language` reaches backend; adult STT uses explicit `ru`/`uk` for that turn; RU/UA turn is handled as multilingual clarification, not as an English exercise answer | `message-types.test.ts`, `stt-deepgram-options.test.ts`, frontend build; live mic smoke pending | voice-runtime-implementer + live-qa-orchestrator | PASS locally; live smoke pending |
| Voice path | Use browser microphone for EN, RU, UA, self-correction, and repeated expected answer turns | No lost turn, stale transcript, duplicate submit, or text-only teacher turn; TTS speaks the teacher response | Required manual/live QA | live-qa-orchestrator | PENDING |
| Browser path | Run paid classroom with mic controls, RU/UA selector, and transcript display | UI remains usable; selector does not hide mic/input; selected language is included in the next paid `mic_start` frame | `frontend npm run build`; running-product browser smoke pending | frontend reviewer / live-qa-orchestrator | PASS build; live browser smoke pending |
| Backend path | Inspect WS/engine path after voice normalization | Backend engine remains authoritative for grading/cursor; normalization is expected-answer bounded | `lesson-ws.ts`, `master-orchestrator.ts`, tests, `npx tsc --noEmit` | backend-reviewer | PASS |
| Prompt/teacher path | Review Teacher Brain rule changes for self-correction and bounded personal follow-up | Teacher stays task-bound; no deterministic free chat replaces grading | `teacher-brain-rules.ts`, `pedagogical-behavior.qa.test.ts` | prompt-curriculum-implementer | PASS |
| Curriculum path | Verify accepted answers, exercise order, scoring, and progression were not changed | Curriculum authority preserved | Changed-file diff; `paid-vocab-flow.test.ts`; full backend suite | curriculum-reviewer | PASS |
| Safety path | Check Kids protected surface after shared voice/config changes | Kids STT remains `nova-2/en`; Kids tests still pass; no Kids curriculum behavior changed | `kids-stt-config-parity.test.ts`; full backend suite | kids-safety-monitor | PASS |
| Deployment path | After approval, deploy backend/frontend and inspect health/logs; repeat live paid lesson smoke | Production health/logs clean and user-facing behavior proven | Railway deploy/health/log evidence | deployment-verifier | PENDING - deployment not approved this turn |
