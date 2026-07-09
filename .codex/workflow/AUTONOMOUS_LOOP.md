# Autonomous Loop — Codex Automation V2

## State Machine

```text
RECONSTRUCT
  → INTAKE or PLAN when goal/task state is missing
  → EXECUTE
  → TEST
  → REVIEW
  → FIX → TEST → REVIEW (when any gate fails)
  → CHECKPOINT
  → PHASE COMPLETE
  → NEXT PHASE
  → FINAL ACCEPTANCE AUDIT
  → GOAL COMPLETE
```

Codex owns every transition. The user does not transfer prompts or role output.

## Loop Procedure

1. **Reconstruct**
   - Follow `RECOVERY_AFTER_INTERRUPTION.md`.
   - Select the one valid next action from evidence, not timestamps alone.
2. **Execute**
   - Read the relevant role skill and current files.
   - Make the smallest scoped change.
   - Preserve unrelated worktree changes.
3. **Test**
   - Run targeted checks first, then required regression checks.
   - Record exact commands, exit codes, pass/fail counts, and baseline
     comparisons.
4. **Review**
   - Apply `REVIEW_GATE.md`.
   - Persist all role verdicts in one review-cycle section.
5. **Repair**
   - Convert each blocking finding into the current `NEXT_ACTION`.
   - Diagnose from direct evidence.
   - Try at most three materially different repair approaches for the same
     task, recording each attempt and result.
   - Retest and rerun every gate affected by the fix.
6. **Checkpoint**
   - Update progress, next action, risks, decisions, review evidence, and deploy
     evidence before advancing.
7. **Advance**
   - Mark a phase complete only when its implementation, tests, and applicable
     review gates pass.
   - Select the first incomplete phase whose dependencies are complete.
   - Write its first task to `NEXT_ACTION.md` and continue immediately.
8. **Complete**
   - After all phases pass, run a fresh acceptance audit against every criterion.
   - If any item is partial or incomplete, write the highest-priority missing
     work to `NEXT_ACTION.md` and continue.
   - Stop only after the auditor returns `GOAL COMPLETE`.

## Atomic Checkpoint Contract

After each transition, persist enough state for a new session to resume:

```text
Checkpoint ID: <goal>/<phase>/<task>/<attempt>
State: EXECUTE | TEST | REVIEW | FIX | BLOCKED | PHASE_COMPLETE | GOAL_COMPLETE
Base commit:
Working-tree files:
Completed evidence:
Failed evidence:
Review verdicts:
Attempt count:
Risks changed:
Next action:
Stop condition: none | <allowed condition>
```

`NEXT_ACTION.md` contains exactly one task. A blocker is also a task: describe
the unavailable input, completed attempts, preserved state, and precise resume
condition.

## Interruption Safety

Never rely on in-memory role output. Persist review findings and command
evidence before changing phases. If interrupted between an action and its
checkpoint, the next session revalidates only the uncertain boundary; it does
not redo earlier completed phases.
