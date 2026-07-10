import crypto from 'node:crypto'

const SECRET_PATTERNS = [
  /\b\d{8,12}:[A-Za-z0-9_-]{25,}\b/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  /\b[A-Z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD)\s*=\s*[^\s]+/gi,
]

export const AGENT_CHAIN = [
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

export const ROLE_SKILL_MAP = {
  'intake-orchestrator': 'goal-intake-orchestrator',
  'product-context-researcher': 'product-context-researcher',
  'goal-analyst': 'goal-analyst',
  'scenario-designer': 'scenario-designer',
  'architecture-planner': 'planner',
  'backend-implementer': 'backend-implementer',
  'frontend-implementer': 'frontend-implementer',
  'voice-runtime-implementer': 'voice-runtime-implementer',
  'prompt-curriculum-implementer': 'prompt-curriculum-implementer',
  'developer-reminder': 'developer-reminder',
  'qa-tester': 'qa-tester',
  'live-qa-orchestrator': 'live-qa-orchestrator',
  'adversarial-product-critic': 'adversarial-product-critic',
  'failure-analyst': 'failure-analyst',
  'acceptance-auditor': 'acceptance-auditor',
  'deployment-verifier': 'deploy-railway',
  'handoff-scribe': 'handoff-scribe',
}

export function redactSecrets(input) {
  let out = String(input ?? '')
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[REDACTED_SECRET]')
  return out
}

export function createGoalPacket({ text, chatId, telegramUserId, username, now = new Date() }) {
  const rawIdea = redactSecrets(text).trim()
  const title = deriveTitle(rawIdea)
  const goalId = `goal_${now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${crypto.randomBytes(3).toString('hex')}`

  return {
    goalId,
    title,
    status: 'INTAKE_READY_FOR_CODEX',
    source: {
      channel: 'telegram',
      chatId: String(chatId),
      telegramUserId: telegramUserId ? String(telegramUserId) : null,
      username: username ? String(username) : null,
      receivedAt: now.toISOString(),
    },
    rawIdea,
    orchestrationBrief: buildOrchestrationBrief(rawIdea),
    scenarioContract: buildScenarioContract(rawIdea),
    agentChain: AGENT_CHAIN,
    roleSkillMap: ROLE_SKILL_MAP,
    blockingGates: [
      'Goal Rebase Gate',
      'Scenario Contract Gate',
      'Implementation Review Gate',
      'Automated QA Gate',
      'Adversarial Product Critic Gate',
      'Live Evidence Gate',
      'Acceptance Auditor Gate',
      'Deployment Verification Gate',
    ],
    nextCodexAction: 'Run repository recovery, rebase the active goal from this packet, write acceptance criteria, then begin the autonomous loop.',
  }
}

export function formatGoalPacket(packet) {
  return [
    `Goal packet created: ${packet.title}`,
    `ID: ${packet.goalId}`,
    '',
    'Codex next action:',
    packet.nextCodexAction,
    '',
    'Required gates:',
    ...packet.blockingGates.map((gate) => `- ${gate}`),
  ].join('\n')
}

function deriveTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Untitled product goal'
  const clipped = clean.slice(0, 90)
  return clipped.length < clean.length ? `${clipped}...` : clipped
}

function buildOrchestrationBrief(rawIdea) {
  return {
    userOutcome: rawIdea,
    definitionOfDone: [
      'The user-facing outcome is demonstrated in the running product, not only in code or tests.',
      'Every reported failure has a reproduction, root-cause note, repair evidence, and re-test evidence.',
      'No phase may finish while an applicable critic or auditor still has a blocking finding.',
    ],
    nonNegotiables: [
      'Do not hide unclear intent inside implementation tasks; rebase the goal first.',
      'Do not ask the user to manually test anything that can be automated with browser, logs, API, or scripted runtime checks.',
      'Do not mark completion from theory, local unit tests, or deploy health alone.',
    ],
  }
}

function buildScenarioContract(rawIdea) {
  const affectedSurfaces = deriveAffectedSurfaces(rawIdea)
  const scenarioRows = affectedSurfaces.flatMap((surface) => buildSurfaceScenarios(surface))

  return {
    affectedSurfaces,
    happyPath: [
      'A normal target user completes the requested workflow successfully in the app.',
      'The main product behavior matches the stated goal in UI, backend state, logs, and final output.',
    ],
    negativePath: [
      'Wrong, partial, off-topic, repeated, and confused user inputs are handled without breaking progression.',
      'The app reports recoverable problems clearly and does not silently lose user work.',
    ],
    adversarialPath: [
      'A critic tries to distract the teacher, force topic drift, repeat stale answers, interrupt audio, and stress timing.',
      'The system stays aligned to the current lesson state and records exact evidence for any failure.',
    ],
    liveEvidence: [
      'Browser automation or live production smoke with screenshots, console logs, WebSocket frames, and correlated backend logs.',
      'Voice, STT, TTS, multilingual, UI, backend, prompt, curriculum, payment, auth, and safety surfaces are included when affected.',
    ],
    failureDefinition: [
      'Any missing live evidence for an affected surface blocks completion.',
      'Any cursor drift, lost turn, duplicate submit, stale transcript, unsafe behavior, or unverified user scenario blocks completion.',
    ],
    scenarioRows,
    originalIdea: rawIdea,
  }
}

function deriveAffectedSurfaces(rawIdea) {
  const text = rawIdea.toLowerCase()
  const surfaces = new Set(['product'])
  if (/\b(ui|browser|frontend|screen|button|page|platform|чат|экран|кноп)/i.test(text)) surfaces.add('frontend')
  if (/\b(api|backend|server|websocket|db|redis|logs?|лог|сервер)/i.test(text)) surfaces.add('backend')
  if (/\b(voice|mic|microphone|stt|tts|audio|speak|listen|голос|микрофон|речь)/i.test(text)) surfaces.add('voice')
  if (/\b(ai|teacher|tutor|alex|prompt|учител|агент|интеллект)/i.test(text)) surfaces.add('teacher-ai')
  if (/\b(russian|ukrainian|рус|украин|language|multilingual)/i.test(text)) surfaces.add('multilingual')
  if (/\b(kids|child|children|ребен|дет)/i.test(text)) surfaces.add('safety')
  if (/\b(pay|billing|auth|login|liqpay|оплат|авторизац)/i.test(text)) surfaces.add('auth-billing')
  return Array.from(surfaces)
}

function buildSurfaceScenarios(surface) {
  return [
    {
      id: `${surface}-happy`,
      type: 'happy',
      surface,
      actionSequence: `Run the normal ${surface} user path for the requested outcome.`,
      expectedBehavior: 'The user-visible result matches the goal and state stays consistent.',
      evidenceSource: 'Automated test, browser/API/WS evidence, or live QA artifact.',
      ownerRole: 'qa-tester',
      blockingFailure: 'Outcome is not visible, state is inconsistent, or evidence is missing.',
    },
    {
      id: `${surface}-adversarial`,
      type: 'adversarial',
      surface,
      actionSequence: `Try to break the ${surface} path with confusing, repeated, interrupted, or invalid input.`,
      expectedBehavior: 'The product recovers, stays aligned to the current task, and records the failure if any.',
      evidenceSource: 'Adversarial critic report plus logs/traces for the scenario.',
      ownerRole: 'adversarial-product-critic',
      blockingFailure: 'The product drifts, loops, loses state, falsely succeeds, or lacks evidence.',
    },
  ]
}
