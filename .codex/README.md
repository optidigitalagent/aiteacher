# Codex workflow layer

This directory is generated from the repository's existing `.claude` workflow
and adapted for Codex.

- `workflow/` contains the Codex-owned goal, progress, decision, risk, review,
  and deployment state snapshot.
- `rules/` contains project coding and prompt rules.
- `skills/` exposes each specialized workflow role as a Codex skill.
- `scripts/sync-from-claude.ps1` refreshes generated files from `.claude`.

`AGENTS.md` is the repository entry point and authority map. Claude permission
settings are intentionally not copied: Codex sandbox and approval behavior is
controlled by the active Codex environment, not repository workflow content.

The sync script never writes to `.claude` or product source directories.