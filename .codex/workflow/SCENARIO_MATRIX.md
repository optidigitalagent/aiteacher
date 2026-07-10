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
| Negative path | Say `not keen on` or `my hobby` while current expected answer is `keen on` / `hobby`; ask `which world is it` or `help me with this worms` during a gap-fill item | Transcript is not falsely normalized to expected answer; direct word-help is answered as help and does not count as a wrong attempt | `voice-turn-stabilizer.test.ts`, `paid-vocab-flow.test.ts` | qa-tester | PASS locally; live smoke pending |
| Adversarial path | Say wrong answer first and correct answer second in one turn: `Like keen on`; repeat correct phrase: `keen on keen on`; ask for the word in English/RU/UA instead of answering | Final expected answer is accepted; teacher acknowledges self-correction/repetition without punishing; direct help gives current-item support without grading, cursor movement, or attempts | `voice-turn-stabilizer.test.ts`, `paid-vocab-flow.test.ts` | adversarial-product-critic | PASS locally; live smoke pending |
| Multilingual path | Select RU or UA in the paid mic selector, then ask a short Russian clarification and a short Ukrainian clarification during adult paid lesson; also submit RU/UA text clarification during deterministic item `1.1` | `mic_start.language` reaches backend; adult STT uses explicit `ru`/`uk` for that turn; RU/UA turn is handled as multilingual clarification, not as an English exercise answer; text clarification returns to current item without feedback/cursor/attempt changes | `message-types.test.ts`, `stt-deepgram-options.test.ts`, `paid-vocab-flow.test.ts`, frontend build; production deploy/health/log checks at `d3dcc2d`; live mic smoke pending | voice-runtime-implementer + live-qa-orchestrator | PASS locally and deployed for text clarification; live mic smoke pending |
| Voice path | Use browser microphone for EN, RU, UA, self-correction, repeated expected answer turns, and immediate speech right after pressing mic | `mic_start` reaches backend before audio chunks; no lost first words, split half-turns, stale transcript carryover, duplicate submit, missing `student_message`, or text-only teacher turn; TTS speaks the teacher response | `frontend npm run build`, static mic ordering check; required authenticated live QA | live-qa-orchestrator | PASS locally for ordering/build; live mic smoke pending |
| Browser path | Run paid classroom with mic controls, RU/UA selector, transcript display, and quick start/stop mic behavior | UI remains usable; selector does not hide mic/input; selected language is included in the next paid `mic_start` frame; first PCM chunk cannot be sent before `mic_start` | `frontend npm run build`, static mic ordering check; running-product browser smoke pending | frontend reviewer / live-qa-orchestrator | PASS build/static; live browser smoke pending |
| Backend path | Inspect WS/engine path after voice normalization | Backend engine remains authoritative for grading/cursor; normalization is expected-answer bounded | `lesson-ws.ts`, `master-orchestrator.ts`, tests, `npx tsc --noEmit` | backend-reviewer | PASS |
| Prompt/teacher path | Review Teacher Brain rule changes for self-correction and bounded personal follow-up; adversarially ask RU/UA phrase questions and English task-help/confusion questions during deterministic gap-fill | Teacher stays task-bound; no deterministic free chat replaces grading; native-language clarification and English task-help are answered and anchored back to current item without attempts/cursor changes | `teacher-brain-rules.ts`, `pedagogical-behavior.qa.test.ts`, `paid-vocab-flow.test.ts`; deployed at `1ee5613` with HTTP/log checks clean | prompt-curriculum-implementer | PASS locally and deployed; authenticated browser/mic smoke pending |
| Curriculum path | Verify accepted answers, exercise order, scoring, and progression were not changed | Curriculum authority preserved | Changed-file diff; `paid-vocab-flow.test.ts`; full backend suite | curriculum-reviewer | PASS |
| Safety path | Check Kids protected surface after shared voice/config changes | Kids STT remains `nova-2/en`; Kids tests still pass; no Kids curriculum behavior changed | `kids-stt-config-parity.test.ts`; full backend suite | kids-safety-monitor | PASS |
| Deployment path | Commit, push, deploy latest mic/help repair; inspect health/logs; repeat live paid lesson smoke | Production health/logs are clean; user-facing microphone behavior still must be proven | Local deploy gates passed; Railway deploy pending for latest repair | deployment-verifier + live-qa-orchestrator | PENDING latest deploy; live smoke pending |
