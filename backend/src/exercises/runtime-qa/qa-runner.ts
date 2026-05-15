// QA Runner
// Lightweight backend-only runner that validates protocol assignments,
// downgrade behavior, and snapshot shape rules against QA definitions.
// Does NOT require a running server or database.

import { selectProtocol } from '../runtime/protocol-runner.js'
import { getExercisePolicy } from '../protocols/index.js'
import { REGRESSION_MATRIX, GLOBAL_FORBIDDEN_REGRESSIONS } from './regression-matrix.js'
import type { QAScenario, QACheckResult, QAScenarioReport } from './qa-types.js'
import { ALL_DETERMINISTIC_SCENARIOS } from './deterministic.qa.js'
import { ALL_MATCHING_SCENARIOS } from './matching.qa.js'
import { ALL_SPEAKING_SCENARIOS } from './speaking.qa.js'
import { ALL_GRAMMAR_FOCUS_SCENARIOS } from './grammar-focus.qa.js'
import { ALL_UNSUPPORTED_SCENARIOS } from './unsupported.qa.js'

// ── Check helpers ─────────────────────────────────────────────────────────────

function check(scenarioId: string, name: string, pass: boolean, detail?: string): QACheckResult {
  return { scenarioId, check: name, result: pass ? 'pass' : 'fail', detail }
}

// ── Protocol assignment check ─────────────────────────────────────────────────

function checkProtocolAssignment(scenario: QAScenario): QACheckResult[] {
  const results: QACheckResult[] = []

  try {
    const protocol = selectProtocol(scenario.exerciseType)
    results.push(check(
      scenario.scenarioId,
      'protocol_name_matches',
      protocol.protocolName === scenario.expectedRuntimeBehavior.protocolName,
      `expected=${scenario.expectedRuntimeBehavior.protocolName} got=${protocol.protocolName}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'soft_feedback_matches',
      protocol.shouldUseSoftFeedback() === scenario.expectedRuntimeBehavior.usesSoftFeedback,
      `expected=${scenario.expectedRuntimeBehavior.usesSoftFeedback} got=${protocol.shouldUseSoftFeedback()}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'lock_item_matches',
      protocol.shouldLockCurrentItem() === scenario.expectedRuntimeBehavior.locksItemUntilCorrect,
      `expected=${scenario.expectedRuntimeBehavior.locksItemUntilCorrect} got=${protocol.shouldLockCurrentItem()}`,
    ))
  } catch (err) {
    results.push(check(scenario.scenarioId, 'protocol_selection_no_throw', false, String(err)))
  }

  return results
}

// ── Policy check ──────────────────────────────────────────────────────────────

function checkPolicy(scenario: QAScenario): QACheckResult[] {
  const results: QACheckResult[] = []

  try {
    const policy = getExercisePolicy(scenario.exerciseType)

    results.push(check(
      scenario.scenarioId,
      'runtime_mode_matches',
      policy.runtimeMode === scenario.expectedRuntimeBehavior.runtimeMode,
      `expected=${scenario.expectedRuntimeBehavior.runtimeMode} got=${policy.runtimeMode}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'validation_mode_matches',
      policy.validationMode === scenario.expectedValidationBehavior.validationMode,
      `expected=${scenario.expectedValidationBehavior.validationMode} got=${policy.validationMode}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'progression_mode_matches',
      policy.progressionMode === scenario.expectedProgressionBehavior.progressionMode,
      `expected=${scenario.expectedProgressionBehavior.progressionMode} got=${policy.progressionMode}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'allow_in_runtime_consistent',
      policy.allowInCurrentRuntime === (scenario.expectedRuntimeBehavior.runtimeMode !== 'skipped'
        && !scenario.expectedRuntimeBehavior.runtimeMode.startsWith('future')),
      `allowInCurrentRuntime=${policy.allowInCurrentRuntime}`,
    ))
  } catch (err) {
    results.push(check(scenario.scenarioId, 'policy_lookup_no_throw', false, String(err)))
  }

  return results
}

// ── Correction ladder check ───────────────────────────────────────────────────

function checkCorrectionLadder(scenario: QAScenario): QACheckResult[] {
  const results: QACheckResult[] = []

  try {
    const protocol = selectProtocol(scenario.exerciseType)
    const { speakingExercisesSkipStrictLadder, revealOnlyAtFinalTurn } = scenario.expectedCorrectionFlow

    if (speakingExercisesSkipStrictLadder) {
      results.push(check(
        scenario.scenarioId,
        'speaking_skips_strict_ladder',
        protocol.shouldUseSoftFeedback() === true,
        'speaking type must use soft feedback',
      ))
      results.push(check(
        scenario.scenarioId,
        'speaking_no_reveal',
        protocol.shouldRevealAnswer(99) === false,
        'speaking must never reveal answer regardless of retry count',
      ))
    } else if (revealOnlyAtFinalTurn && scenario.expectedCorrectionFlow.turns.length > 0) {
      const lastTurnIndex = scenario.expectedCorrectionFlow.turns.length
      results.push(check(
        scenario.scenarioId,
        'no_reveal_before_final_turn',
        protocol.shouldRevealAnswer(lastTurnIndex - 1) === false,
        `retryCount=${lastTurnIndex - 1} should not reveal`,
      ))
      results.push(check(
        scenario.scenarioId,
        'reveal_at_final_turn',
        protocol.shouldRevealAnswer(lastTurnIndex) === true,
        `retryCount=${lastTurnIndex} should reveal`,
      ))
    }
  } catch (err) {
    results.push(check(scenario.scenarioId, 'correction_ladder_no_throw', false, String(err)))
  }

  return results
}

// ── Matching-specific regression check ───────────────────────────────────────

function checkMatchingRegression(scenario: QAScenario): QACheckResult[] {
  if (!['matching', 'vocabulary_matching', 'find_opposites', 'collocations'].includes(scenario.exerciseType)) {
    return []
  }

  const results: QACheckResult[] = []

  try {
    const protocol = selectProtocol(scenario.exerciseType)
    results.push(check(
      scenario.scenarioId,
      'matching_uses_matching_protocol',
      protocol.protocolName === 'matching',
      `matching type must use matching protocol, got ${protocol.protocolName}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'matching_not_soft_feedback',
      protocol.shouldUseSoftFeedback() === false,
      'matching must not use soft feedback',
    ))
  } catch (err) {
    results.push(check(scenario.scenarioId, 'matching_regression_no_throw', false, String(err)))
  }

  return results
}

// ── Unsupported regression check ─────────────────────────────────────────────

function checkUnsupportedRegression(scenario: QAScenario): QACheckResult[] {
  if (scenario.expectedRuntimeBehavior.protocolName !== 'unsupported') return []

  const results: QACheckResult[] = []

  try {
    const protocol = selectProtocol(scenario.exerciseType)
    const policy = getExercisePolicy(scenario.exerciseType)

    results.push(check(
      scenario.scenarioId,
      'unsupported_uses_unsupported_protocol',
      protocol.protocolName === 'unsupported',
      `expected unsupported protocol, got ${protocol.protocolName}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'unsupported_not_allowed_in_runtime',
      policy.allowInCurrentRuntime === false,
      `allowInCurrentRuntime must be false for unsupported, got ${policy.allowInCurrentRuntime}`,
    ))
    results.push(check(
      scenario.scenarioId,
      'unsupported_validation_mode',
      policy.validationMode === 'unsupported',
      `validationMode must be "unsupported", got ${policy.validationMode}`,
    ))
  } catch (err) {
    results.push(check(scenario.scenarioId, 'unsupported_regression_no_throw', false, String(err)))
  }

  return results
}

// ── Run a single scenario ─────────────────────────────────────────────────────

function runScenario(scenario: QAScenario): QAScenarioReport {
  const checks: QACheckResult[] = [
    ...checkProtocolAssignment(scenario),
    ...checkPolicy(scenario),
    ...checkCorrectionLadder(scenario),
    ...checkMatchingRegression(scenario),
    ...checkUnsupportedRegression(scenario),
  ]

  const passed = checks.filter(c => c.result === 'pass').length
  const failed = checks.filter(c => c.result === 'fail').length
  const skipped = checks.filter(c => c.result === 'skip').length

  return { scenarioId: scenario.scenarioId, exerciseType: scenario.exerciseType, checks, passed, failed, skipped }
}

// ── Regression matrix validation ──────────────────────────────────────────────

function runRegressionMatrix(): { passed: number; failed: number; details: string[] } {
  let passed = 0
  let failed = 0
  const details: string[] = []

  for (const entry of REGRESSION_MATRIX) {
    try {
      const protocol = selectProtocol(entry.exerciseType)
      const policy = getExercisePolicy(entry.exerciseType)

      const protocolOk = protocol.protocolName === entry.expectedProtocol
      const runtimeOk = policy.runtimeMode === entry.expectedRuntimeMode
      const validationOk = policy.validationMode === entry.expectedValidationMode
      const progressionOk = policy.progressionMode === entry.expectedProgressionMode

      if (protocolOk && runtimeOk && validationOk && progressionOk) {
        passed++
        console.log(`[qa] scenario=${entry.exerciseType} pass=true`)
      } else {
        failed++
        const mismatches = [
          !protocolOk && `protocol:${protocol.protocolName}≠${entry.expectedProtocol}`,
          !runtimeOk && `runtime:${policy.runtimeMode}≠${entry.expectedRuntimeMode}`,
          !validationOk && `validation:${policy.validationMode}≠${entry.expectedValidationMode}`,
          !progressionOk && `progression:${policy.progressionMode}≠${entry.expectedProgressionMode}`,
        ].filter(Boolean).join(', ')
        details.push(`FAIL ${entry.exerciseType}: ${mismatches}`)
        console.log(`[qa] scenario=${entry.exerciseType} pass=false detail=${mismatches}`)
      }
    } catch (err) {
      failed++
      details.push(`FAIL ${entry.exerciseType}: threw ${String(err)}`)
      console.log(`[qa] scenario=${entry.exerciseType} pass=false detail=threw`)
    }
  }

  return { passed, failed, details }
}

// ── Full QA run ───────────────────────────────────────────────────────────────

export function runAllQA(): void {
  const allScenarios: QAScenario[] = [
    ...ALL_DETERMINISTIC_SCENARIOS,
    ...ALL_MATCHING_SCENARIOS,
    ...ALL_SPEAKING_SCENARIOS,
    ...ALL_GRAMMAR_FOCUS_SCENARIOS,
    ...ALL_UNSUPPORTED_SCENARIOS,
  ]

  console.log('\n=== Exercise Runtime QA Matrix ===\n')
  console.log(`Global forbidden regressions: ${GLOBAL_FORBIDDEN_REGRESSIONS.length}`)
  console.log(`Regression matrix entries: ${REGRESSION_MATRIX.length}`)
  console.log(`QA scenarios: ${allScenarios.length}\n`)

  let totalPassed = 0
  let totalFailed = 0

  for (const scenario of allScenarios) {
    const report = runScenario(scenario)
    totalPassed += report.passed
    totalFailed += report.failed

    const status = report.failed === 0 ? 'PASS' : 'FAIL'
    console.log(`[${status}] ${scenario.scenarioId} (${scenario.exerciseType}) — ${report.passed}/${report.checks.length} checks`)

    if (report.failed > 0) {
      for (const c of report.checks.filter(x => x.result === 'fail')) {
        console.log(`  ✗ ${c.check}: ${c.detail ?? ''}`)
      }
    }
  }

  console.log('\n--- Regression Matrix ---')
  const matrixResult = runRegressionMatrix()
  console.log(`Matrix: ${matrixResult.passed} passed, ${matrixResult.failed} failed`)
  for (const d of matrixResult.details) {
    console.log(`  ${d}`)
  }

  const grandTotal = totalPassed + matrixResult.passed
  const grandFailed = totalFailed + matrixResult.failed
  console.log(`\n=== Total: ${grandTotal} passed, ${grandFailed} failed ===\n`)

  if (grandFailed > 0) {
    process.exitCode = 1
  }
}

// Allow direct execution: node qa-runner.js
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllQA()
}
