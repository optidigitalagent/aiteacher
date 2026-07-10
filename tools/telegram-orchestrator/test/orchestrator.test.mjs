import test from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_CHAIN, ROLE_SKILL_MAP, createGoalPacket, formatGoalPacket, redactSecrets } from '../src/orchestrator.mjs'

test('redacts Telegram bot tokens and common API secrets', () => {
  const syntheticTelegramToken = '1234567890:' + 'SYNTHETIC_REDACTION_SAMPLE_1234567890'
  const text = `token ${syntheticTelegramToken} and OPENAI_API_KEY=sk-secret-value`
  const redacted = redactSecrets(text)
  assert.equal(redacted.includes('SYNTHETIC_REDACTION_SAMPLE'), false)
  assert.equal(redacted.includes('sk-secret-value'), false)
  assert.match(redacted, /\[REDACTED_SECRET\]/)
})

test('creates a goal packet with scenario and gate coverage', () => {
  const packet = createGoalPacket({
    text: 'Make the platform understand Russian voice and prove it with live QA.',
    chatId: '42',
    telegramUserId: '7',
    username: 'owner',
    now: new Date('2026-07-10T10:00:00.000Z'),
  })

  assert.equal(packet.goalId.startsWith('goal_20260710100000_'), true)
  assert.equal(packet.source.chatId, '42')
  assert.equal(packet.agentChain.includes('adversarial-product-critic'), true)
  assert.equal(packet.blockingGates.includes('Live Evidence Gate'), true)
  assert.equal(packet.scenarioContract.affectedSurfaces.includes('voice'), true)
  assert.equal(packet.scenarioContract.affectedSurfaces.includes('multilingual'), true)
  assert.ok(packet.scenarioContract.scenarioRows.some((row) => row.surface === 'voice' && row.type === 'adversarial'))
  assert.ok(packet.scenarioContract.adversarialPath.length > 0)
})

test('agent chain includes orchestration, implementation, critique, and handoff roles', () => {
  const required = [
    'intake-orchestrator',
    'product-context-researcher',
    'goal-analyst',
    'scenario-designer',
    'architecture-planner',
    'backend-implementer',
    'frontend-implementer',
    'voice-runtime-implementer',
    'prompt-curriculum-implementer',
    'developer-reminder',
    'qa-tester',
    'live-qa-orchestrator',
    'adversarial-product-critic',
    'failure-analyst',
    'acceptance-auditor',
    'deployment-verifier',
    'handoff-scribe',
  ]

  for (const role of required) {
    assert.equal(AGENT_CHAIN.includes(role), true)
    assert.equal(typeof ROLE_SKILL_MAP[role], 'string')
  }
})

test('formats packet without leaking raw long data', () => {
  const packet = createGoalPacket({ text: 'Improve autonomous development.', chatId: '1', now: new Date('2026-07-10T10:00:00.000Z') })
  const formatted = formatGoalPacket(packet)
  assert.match(formatted, /Goal packet created:/)
  assert.match(formatted, /Acceptance Auditor Gate/)
})
