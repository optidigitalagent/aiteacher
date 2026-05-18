# Project Cleanup Recommendations

> Analysis of current project structure for cleanup, consolidation, and removal.
> IMPORTANT: Do NOT delete automatically. All items below are RECOMMENDATIONS ONLY.
> Review each category, confirm intent, then action manually.

Last analyzed: 2026-05-18

---

## Category 1: QA Transcripts (Should NOT be in git)

**Recommendation: Remove from tracking (add to .gitignore)**

Files:
- `docs/runtime-qa/FREE_LESSON_CHAT_TRANSCRIPT.md`
- `docs/runtime-qa/PAID_LESSON_CHAT_TRANSCRIPT.md`
- `docs/runtime-qa/FREE_LESSON_CONSOLE_LOGS.md`
- `docs/runtime-qa/PAID_LESSON_CONSOLE_LOGS.md`
- `docs/runtime-qa/RUNTIME_QA_NOTES_RAW.md`

**Reason:** These are raw QA session artifacts — captured transcripts and console logs.
They contain runtime-specific output that rotates with every session.
Tracking them in git creates noise in the history and doesn't benefit the team.

**Lessons extracted from these files** should be moved to:
- `docs/teacher-brain/08-qa-learnings/SECTION_1_2_QA_LEARNINGS.md`
- `docs/teacher-brain/09-runtime-failures/KNOWN_RUNTIME_FAILURES.md`

**Action:** Add `docs/runtime-qa/*.md` to `.gitignore` OR move all QA transcripts to an untracked folder (`docs/runtime-qa-local/`).

---

## Category 2: Duplicate/Redundant Phase Handoff Files

**Recommendation: Keep ONE canonical location per handoff**

The project has BOTH:
- `docs/phase/PHASE_X_HANDOFF.md`
- `docs/handoffs/PHASE_X_HANDOFF.md`

For some phases there are duplicate files in both folders with identical or near-identical content.

Specific confirmed duplicates:
- `docs/phase/PHASE_0_HANDOFF.md` + `docs/handoffs/PHASE_0_HANDOFF.md`
- `docs/phase/PHASE_1_HANDOFF.md` + `docs/handoffs/PHASE_1_HANDOFF.md`
- `docs/phase/PHASE_3_HANDOFF.md` + `docs/handoffs/PHASE_3_HANDOFF.md`
- `docs/phase/PHASE_8_HANDOFF.md` + `docs/handoffs/PHASE_8_HANDOFF.md`

**Recommendation:** Consolidate to `docs/handoffs/` only. Remove `docs/phase/*_HANDOFF.md`.
Keep `docs/phase/*_PROMPT.md` files — those are phase input prompts, not handoffs, and are distinct.

**Action:** Verify content is identical, then delete from `docs/phase/` folder.

---

## Category 3: Stale Architecture Docs (Early-Phase, Now Superseded)

**Recommendation: Archive or delete**

Files:
- `docs/architecture.md` — early architecture doc, pre-Exercise Engine
- `docs/lesson-fsm.md` — early FSM, now superseded by current orchestrator
- `docs/dialogue-examples.md` — early dialogue examples, pre-Teacher Brain vault
- `docs/student-model.md` — early student model, now in Teacher Brain vault
- `docs/pedagogy-sources.md` — source list, may have been incorporated

**Reason:** These pre-date the current architecture by multiple phases.
The current architecture is documented in:
- `frontend/CLAUDE.md` (authoritative architecture constitution)
- `docs/teacher-brain/` vault
- `docs/PAID_LESSON_TEACHER_BRAIN_SPEC.md`

**Action:** Read each file to confirm nothing unique remains, then delete or move to `docs/archive/`.

---

## Category 4: Bootstrap/Experiment Docs (One-Time Artifacts)

**Recommendation: Remove from main docs tree**

Files:
- `docs/bootstrap_prompt_v1.md` — one-time bootstrap prompt, no longer referenced
- `docs/orchestrator_implementation_prompt_v1.md` — one-time implementation prompt
- `docs/project_reality_layer_and_orchestrator_first_design.md` — early design exploration
- `docs/architecture_doctrine.md` — possibly superseded by `frontend/CLAUDE.md`

**Reason:** These are working documents from early design phases.
Their value has been absorbed into the current architecture.
Keeping them in the main `docs/` tree creates confusion about what is current.

**Action:** Move to `docs/archive/` folder or delete if content is fully superseded.

---

## Category 5: Redundant Runtime Rules Docs

**Recommendation: Review for consolidation**

Files in the root `docs/` folder that overlap with Teacher Brain vault content:
- `docs/AI_TEACHER_RUNTIME_RULES.md` — overlaps with `docs/teacher-brain/00-core/AI_TEACHER_DOCTRINE.md`
- `docs/RUNTIME_GUARDRAILS.md` — overlaps with Teacher Brain vault guardrails content
- `docs/LESSON_RUNTIME_STATE_MAP.md` — may overlap with `docs/teacher-brain/01-runtime/`
- `docs/MASTER_CLAUDE_SESSION_TEMPLATE.md` — session template, may be outdated

**Reason:** The Teacher Brain vault was created to consolidate these docs.
If they've been fully absorbed, root-level versions should be removed to avoid drift.

**Action:** Compare each file with vault equivalent. If vault is superset: delete root version.

---

## Category 6: Phase Prompt Files (Now Historical)

**Recommendation: Keep but reorganize**

Files: `docs/phase/PHASE_0_PROMPT.md` through `PHASE_12_PROMPT.md`

These are the implementation prompts used to direct each development phase.
They are historically valuable (show what was built and why) but are not active instructions.

**Recommendation:** They should be kept but clearly marked as historical:
- Add a `# [HISTORICAL — Phase Complete]` header to each
- Or move to `docs/phase-history/` folder

**Action:** No deletion needed. Minor reorganization recommended.

---

## Category 7: Audio Folder (Should Never Be Tracked)

**Recommendation: Verify .gitignore coverage**

The `audio/` folder is untracked (shows as `??` in git status).
This is correct — audio files should never be committed.

**Action:** Verify `audio/` is in `.gitignore`. It appears to already be untracked, but confirm the ignore rule exists.

---

## Category 8: Backend .env.backup

**Recommendation: Delete immediately**

File: `backend/.env.backup`

**Reason:** Backup environment files may contain API keys, database credentials, or other secrets.
They should NEVER be in the working tree, tracked or not.
The `.env` pattern typically means credentials are present.

**Action:** Delete the file. Ensure `.env.backup` is in `.gitignore`.

---

## Category 9: Obsidian Vault Files (Teacher Brain)

**Recommendation: Keep — but enforce .gitignore on local-only files**

`docs/teacher-brain/.obsidian/` contains Obsidian workspace and plugin config.
These are partially tracked.

- `workspace.json` — contains local window/split state. Should be in `.gitignore`.
- `app.json`, `appearance.json`, `core-plugins.json` — shared config. Can be tracked.
- `graph.json` — graph layout. Optional to track.

**Action:** Add `docs/teacher-brain/.obsidian/workspace.json` to `.gitignore`.

---

## Summary Prioritization

| Priority | Action | Risk |
|----------|--------|------|
| **URGENT** | Delete `backend/.env.backup` | Potential credential exposure |
| **High** | .gitignore QA transcripts | git noise |
| **High** | Remove duplicate phase handoff files | Confusion about canonical source |
| **Medium** | Archive bootstrap/experiment docs | Cognitive overhead |
| **Medium** | Review redundant runtime rules docs | Doc drift risk |
| **Low** | Add historical markers to phase prompts | Clarity |
| **Low** | Fix Obsidian workspace.json gitignore | Minor repo hygiene |

---

## What Should NOT Be Cleaned Up

- `docs/teacher-brain/` vault — this is growing and valuable, keep all of it
- `docs/PAID_LESSON_TEACHER_BRAIN_SPEC.md` — foundational spec, referenced by code
- `docs/WEBSOCKET_EVENT_CONTRACT.md` — active contract, referenced by runtime
- `docs/runtime-qa/` HOTFIX files — these document important bug fixes, keep them
- Any file referenced in `frontend/CLAUDE.md` or `TEACHER_BRAIN_INDEX.md`
