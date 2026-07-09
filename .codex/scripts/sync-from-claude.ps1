[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$claudeRoot = Join-Path $repoRoot '.claude'
$codexRoot = Join-Path $repoRoot '.codex'

# Automation V2 state and orchestration skills are Codex-owned. Synchronization
# may create missing files, but must not erase active state or V2 overrides.
$automationV2OwnedSkillNames = @(
    'acceptance-auditor',
    'auto-qa-loop',
    'backend-reviewer',
    'curriculum-reviewer',
    'deploy-railway',
    'frontend-reviewer',
    'goal-executor',
    'kids-safety-monitor',
    'orchestrator',
    'planner',
    'production-log-analyzer',
    'qa-tester'
)

if (-not (Test-Path -LiteralPath $claudeRoot -PathType Container)) {
    throw "Missing source workflow directory: $claudeRoot"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Convert-ClaudeReferences {
    param([Parameter(Mandatory = $true)][string]$Content)

    $result = $Content
    $result = $result.Replace('CLAUDE.md', 'AGENTS.md')
    $result = $result.Replace('.claude/agents/', '.codex/skills/')
    $result = $result.Replace('/AGENT.md', '/SKILL.md')
    $result = $result.Replace('.claude/rules/', '.codex/rules/')

    $workflowFiles = @(
        'GLOBAL_GOAL.md',
        'GOAL.md',
        'GOAL_PROGRESS.md',
        'GOAL_TEMPLATE.md',
        'NEXT_ACTION.md',
        'DECISIONS.md',
        'RISK_REGISTER.md',
        'REVIEW_REPORT.md',
        'DEPLOYMENT_CHECKLIST.md',
        'RUN_AUTONOMOUS_GOAL_EXECUTOR.md'
    )

    foreach ($name in $workflowFiles) {
        $result = $result.Replace(".claude/$name", ".codex/workflow/$name")
    }

    $result = $result.Replace('WebSearch', 'local repository inspection')
    $result = $result.Replace('Paste this into Claude Code:', 'Use this instruction in Codex:')
    $result = $result.Replace('Claude Code', 'Codex')
    return $result
}

$workflowNames = @(
    'GLOBAL_GOAL.md',
    'GOAL.md',
    'GOAL_PROGRESS.md',
    'GOAL_TEMPLATE.md',
    'NEXT_ACTION.md',
    'DECISIONS.md',
    'RISK_REGISTER.md',
    'REVIEW_REPORT.md',
    'DEPLOYMENT_CHECKLIST.md',
    'RUN_AUTONOMOUS_GOAL_EXECUTOR.md'
)

foreach ($name in $workflowNames) {
    $source = Join-Path $claudeRoot $name
    $target = Join-Path $codexRoot "workflow\$name"
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        Write-Verbose "Preserving Codex-owned workflow file: $target"
        continue
    }

    if (Test-Path -LiteralPath $source -PathType Leaf) {
        $content = [System.IO.File]::ReadAllText($source)
        $adapted = Convert-ClaudeReferences $content
        Write-Utf8File $target $adapted
    }
}

$ruleRoot = Join-Path $claudeRoot 'rules'
if (Test-Path -LiteralPath $ruleRoot -PathType Container) {
    Get-ChildItem -LiteralPath $ruleRoot -File -Filter '*.md' |
        Sort-Object Name |
        ForEach-Object {
            $content = [System.IO.File]::ReadAllText($_.FullName)
            $adapted = Convert-ClaudeReferences $content
            Write-Utf8File (Join-Path $codexRoot "rules\$($_.Name)") $adapted
        }
}

$descriptions = @{
    'acceptance-auditor'       = 'Audit every active-goal acceptance criterion against direct repository, test, and deployment evidence.'
    'api-cost-estimator'       = 'Estimate API costs and unit economics from repository configuration and supplied usage evidence.'
    'auto-qa-loop'             = 'Run bounded test, diagnosis, repair, and verification loops for authorized code changes.'
    'backend-reviewer'         = 'Review backend changes for correctness, security, architecture, and project-rule compliance.'
    'completion-analyzer'      = 'Analyze lesson completion metrics and identify the main funnel drop-off.'
    'curriculum-reviewer'      = 'Review changes for curriculum integrity, pedagogical constraints, and personalization boundaries.'
    'deploy-railway'           = 'Execute the user-authorized Railway deployment checklist with preflight and post-deploy verification.'
    'env-checker'              = 'Check required environment configuration without exposing secret values.'
    'frontend-reviewer'        = 'Review frontend changes for correctness, regressions, accessibility, and project conventions.'
    'goal-executor'            = 'Run the repository goal workflow from orientation through implementation, validation, review, and honest completion.'
    'implementer'              = 'Implement one scoped task from NEXT_ACTION with focused changes and direct validation evidence.'
    'kids-safety-monitor'      = 'Audit child-facing behavior and evidence for safety incidents and policy violations.'
    'latency-profiler'         = 'Measure and localize voice-turn latency against the repository latency budget.'
    'lesson-critic'            = 'Evaluate lesson quality against pedagogical and product criteria.'
    'lesson-qa'                = 'Verify lesson flow and core student interactions without changing product code.'
    'migration-guard'          = 'Review database migrations for safety, reversibility, locking, and data-loss risks.'
    'orchestrator'             = 'Select and run the repository review, QA, deploy, prompt, voice, RAG, cost, analytics, or safety pipeline.'
    'planner'                  = 'Decompose an active goal into ordered, testable phases and concrete tasks without implementing product code.'
    'production-log-analyzer'  = 'Analyze production logs for deployment health, regressions, and actionable failures.'
    'prompt-tester'            = 'Test prompt changes against required teaching behavior, output shape, and safety constraints.'
    'qa-tester'                = 'Design and run focused and regression tests, then report exact evidence and unresolved failures.'
    'rag-auditor'              = 'Audit retrieval configuration and evidence for relevance, coverage, and failure modes.'
}

$agentsRoot = Join-Path $claudeRoot 'agents'
Get-ChildItem -LiteralPath $agentsRoot -Directory |
    Sort-Object Name |
    ForEach-Object {
        $name = $_.Name
        if ($automationV2OwnedSkillNames -contains $name) {
            Write-Verbose "Preserving Automation V2 skill: $name"
            return
        }

        $source = Join-Path $_.FullName 'AGENT.md'
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            return
        }

        $description = $descriptions[$name]
        if (-not $description) {
            $description = "Apply the adapted $name role workflow for this repository."
        }

        $body = [System.IO.File]::ReadAllText($source)
        $body = Convert-ClaudeReferences $body

        $codexPreamble = @"
---
name: "$name"
description: "$description"
---

> Codex adaptation: follow `AGENTS.md` first. Treat `.codex/workflow/` as the
> writable workflow state. Do not modify `.claude`. Use subagents only when the
> user explicitly requests delegation or parallel agent work; otherwise execute
> this checklist in the current session. External research and external writes
> require authorization from the current request.

"@

        Write-Utf8File (Join-Path $codexRoot "skills\$name\SKILL.md") ($codexPreamble + $body)
    }

$readme = @'
# Codex Automation V2

`AGENTS.md` is the authority and entry point. `Continue.` reconstructs active
state and resumes the correct next task. A rough idea triggers idea intake,
planning, execution, tests, review, repair, and automatic phase advancement.

- `workflow/` contains Codex-owned state and Automation V2 contracts.
- `rules/` contains project coding and prompt rules.
- `skills/` contains specialized role checklists.
- `scripts/sync-from-claude.ps1` imports non-V2 legacy updates while preserving
  Codex-owned state and Automation V2 overrides.

The user never copies prompts or reviewer output between roles. The sync script
never writes to `.claude` or product source directories.
'@

$readmePath = Join-Path $codexRoot 'README.md'
if (-not (Test-Path -LiteralPath $readmePath -PathType Leaf)) {
    Write-Utf8File $readmePath $readme
}

Write-Output "Codex workflow synchronized from .claude; Automation V2 state preserved."
