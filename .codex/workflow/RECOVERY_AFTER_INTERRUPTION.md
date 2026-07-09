# Recovery After Interruption — Codex Automation V2

## When to Run

Run at the start of every new session, on `Continue.`, and after a crash,
context limit, tool interruption, or uncertain handoff.

## Reconstruction Sequence

1. Capture repository state:

   ```powershell
   git status --short --untracked-files=all
   git branch --show-current
   git rev-parse HEAD
   git log -10 --oneline
   ```

2. Read active workflow state in the order defined by `AGENTS.md`.
3. Inspect staged, unstaged, and untracked files relevant to the goal.
4. Inspect recent commits for claimed phase boundaries and changed files.
5. Inspect relevant implementation and tests. Do not infer completion from
   tracking text or commit messages.
6. Compare the last checkpoint with repository evidence.

## Reconciliation Rules

Use these evidence priorities:

1. User request and acceptance criteria define intended outcome.
2. Repository files and git objects prove what exists.
3. Fresh command output proves current validation state.
4. Persisted review reports prove only the exact diff and commit they identify.
5. Progress summaries are navigation aids, not proof.

Classify the interrupted task:

- **Completed and evidenced:** preserve it; advance without repeating it.
- **Implemented but validation missing/stale:** rerun only required validation.
- **Reviewed but findings not fixed:** restore the highest-priority fix task.
- **Tracking stale but code ahead:** verify the uncertain delta, then repair
  tracking.
- **Tracking ahead but code/evidence missing:** downgrade the claim and restore
  the missing task.
- **Partial edit in worktree:** continue from the diff after checking intent and
  unrelated user changes.

Tests or reviews are stale when they do not identify the current relevant diff
or commit. Rerun stale gates; do not rerun unrelated completed phases.

## Recovery Checkpoint

When reconciliation changes the apparent state, append:

```text
Recovery timestamp:
HEAD and branch:
Worktree summary:
Last trustworthy checkpoint:
Mismatch found:
Evidence inspected:
Tasks preserved as complete:
Boundary revalidated:
Correct next action:
```

Update `NEXT_ACTION.md` before resuming. Recovery ends by entering
`AUTONOMOUS_LOOP.md`; it is not a reason to wait for user confirmation.
