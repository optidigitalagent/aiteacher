# Codex Automation V2

This directory contains the repository's Codex-owned autonomous workflow. It
was adapted from `.claude`, but Automation V2 contracts are maintained here and
are not overwritten by synchronization.

- `workflow/` contains the Codex-owned goal, progress, decision, risk, review,
  recovery, review, autonomous-loop, and deployment state.
- `rules/` contains project coding and prompt rules.
- `skills/` exposes each specialized workflow role as a Codex skill.
- `scripts/sync-from-claude.ps1` refreshes generated files from `.claude`.

`AGENTS.md` is the repository entry point and authority map. Claude permission
settings are intentionally not copied: Codex sandbox and approval behavior is
controlled by the active Codex environment, not repository workflow content.

Normal use:

- `Continue.` reconstructs state and resumes the correct next task.
- A rough idea starts idea intake and autonomous execution.

The user does not copy role prompts or reviewer output. The sync script never
writes to `.claude`, product source directories, or Automation V2-owned files.
