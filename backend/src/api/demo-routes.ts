import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { query, withTransaction } from '../db/postgres.js'
import redis from '../db/redis.js'
import {
  buildIntro,
  buildStep,
  evaluateMcqServerSide,
  buildWarmUpFeedback,
  buildFollowUpFeedback,
  buildConfusedHint,
  buildStudentQuestionResponse,
  buildTaskClarification,
  getTotalSteps,
  type DemoSession,
  type ScoreRecord,
} from '../demo/lesson-engine.js'
import {
  evaluateSpeaking,
  evaluateWriting,
  generateFinalResult,
  buildRuleBasedSpeakingFeedback,
  buildRuleBasedWritingFeedback,
  getOpenAIClient,
  inferMeaning,
} from '../demo/evaluator.js'
import {
  classifyInput,
  buildEarlyResult,
  detectVocabWord,
  VOCAB_EXPLANATIONS,
  detectConfirmIntent,
  detectStudentQuestion,
  detectToxicity,
  detectMetaHelpIntent,
  detectEmbeddedConfusion,
  normalizeVoiceTranscript,
  analyzeAnswerQuality,
} from '../demo/abuse-guard.js'
import { DEMO_AI_CONFIG, canUseDemoAI, DEMO_TTS_CONFIG, canUseDemoTTS } from '../demo/ai-config.js'

const router = Router()

// Abuse thresholds
const ABUSE_FLAG_LIMIT    = 3   // gibberish submissions before early termination
const ATTEMPTS_LIMIT      = 8   // total rejected submissions on AI steps
// Per-session feature limits (tracked in Redis)
const HELP_REQUESTS_LIMIT = 5
const TRANSLATE_LIMIT     = 10
// Max chars forwarded to AI
const TTS_MAX_TEXT_CHARS  = 400
const SPEAKING_MAX_CHARS  = 300
const WRITING_MAX_CHARS   = 400
const TRANSLATE_MAX_CHARS = 500
const HELP_MAX_CHARS      = 160

// ── Conversation safety guard ─────────────────────────────────────────────────
// Appends the step question if the message doesn't already end with one.
// This ensures every teacher response requires a user action.
function ensureTeacherContinues(msg: string, stepPrompt: string): string {
  const t = msg.trim()
  return t.endsWith('?') ? t : (stepPrompt ? `${t}\n\n${stepPrompt}` : t)
}

// ── Simple stable hash for cache keys ────────────────────────────────────────
function simpleHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(16)
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function loadSession(sessionId: string, userId: string): Promise<DemoSession | null> {
  const res = await query<DemoSession>(
    `SELECT id, user_id, lesson_mood, interest_area, teacher_style,
            speaking_confidence, demo_mission, status,
            COALESCE(current_step, 'warm_up')        AS current_step,
            COALESCE(step_index, 0)                   AS step_index,
            COALESCE(answers, '{}')                   AS answers,
            COALESCE(scores, '{}')                    AS scores,
            final_result,
            COALESCE(ai_calls_used, 0)                AS ai_calls_used,
            COALESCE(abuse_flags, 0)                  AS abuse_flags,
            COALESCE(answer_attempts_total, 0)         AS answer_attempts_total,
            started_lesson_at, completed_at
     FROM demo_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  )
  return res.rows[0] ?? null
}

async function incrementAiCalls(sessionId: string): Promise<number> {
  const res = await query<{ ai_calls_used: number }>(
    `UPDATE demo_sessions
     SET ai_calls_used = COALESCE(ai_calls_used, 0) + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING ai_calls_used`,
    [sessionId],
  )
  return res.rows[0]?.ai_calls_used ?? 0
}

// Gibberish: increment both abuse_flags and answer_attempts_total atomically
async function incrementAbuse(
  sessionId: string,
): Promise<{ abuse_flags: number; answer_attempts_total: number }> {
  const res = await query<{ abuse_flags: number; answer_attempts_total: number }>(
    `UPDATE demo_sessions
     SET abuse_flags          = COALESCE(abuse_flags, 0) + 1,
         answer_attempts_total = COALESCE(answer_attempts_total, 0) + 1,
         updated_at            = NOW()
     WHERE id = $1
     RETURNING abuse_flags, answer_attempts_total`,
    [sessionId],
  )
  return res.rows[0] ?? { abuse_flags: 0, answer_attempts_total: 0 }
}

// Short/confused: only increment answer_attempts_total (not an abuse flag)
async function incrementAttempts(
  sessionId: string,
): Promise<{ answer_attempts_total: number }> {
  const res = await query<{ answer_attempts_total: number }>(
    `UPDATE demo_sessions
     SET answer_attempts_total = COALESCE(answer_attempts_total, 0) + 1,
         updated_at             = NOW()
     WHERE id = $1
     RETURNING answer_attempts_total`,
    [sessionId],
  )
  return res.rows[0] ?? { answer_attempts_total: 0 }
}

async function saveAnswer(
  sessionId: string,
  stepKey: string,
  stepIndex: number,
  nextStepKey: string,
  nextStepIndex: number,
  answer: string,
  score: ScoreRecord,
  isComplete: boolean,
): Promise<void> {
  const status = isComplete ? 'completed' : 'in_progress'

  await query(
    `UPDATE demo_sessions
     SET answers       = COALESCE(answers, '{}') || jsonb_build_object($2::text, $3::text),
         scores        = COALESCE(scores, '{}')  || jsonb_build_object($4::text, $5::jsonb),
         current_step  = $6,
         step_index    = $7,
         status        = $8,
         started_lesson_at = COALESCE(started_lesson_at, NOW()),
         updated_at    = NOW()
     WHERE id = $1`,
    [sessionId, stepKey, answer, stepKey, JSON.stringify(score), nextStepKey, nextStepIndex, status],
  )

  if (isComplete) {
    await query(
      `UPDATE demo_sessions SET completed_at = NOW() WHERE id = $1`,
      [sessionId],
    )
  }
}

async function saveFinalResult(sessionId: string, result: object): Promise<void> {
  await query(
    `UPDATE demo_sessions
     SET final_result = $2::jsonb, status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [sessionId, JSON.stringify(result)],
  )
}

// ── Per-step retry tracking (Redis, 1-hour TTL) ───────────────────────────────

async function getStepRetries(sessionId: string, stepKey: string): Promise<number> {
  const val = await redis.get(`demo:retry:${sessionId}:${stepKey}`)
  return val ? parseInt(val, 10) : 0
}

async function incrementStepRetries(sessionId: string, stepKey: string): Promise<number> {
  const key = `demo:retry:${sessionId}:${stepKey}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, 3600)
  return count
}

async function clearStepRetries(sessionId: string, stepKey: string): Promise<void> {
  await redis.del(`demo:retry:${sessionId}:${stepKey}`)
}

// ── GET /demo/session/:id ─────────────────────────────────────────────────────

router.get('/demo/session/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params['id']
  const userId = req.user!.userId

  if (!sessionId) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'Missing session id' })
    return
  }

  try {
    const session = await loadSession(sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' })
      return
    }

    const intro = buildIntro(session)
    const totalSteps = getTotalSteps()

    if (session.status === 'completed' && session.final_result) {
      res.json({
        id: session.id,
        status: 'completed',
        stepIndex: totalSteps,
        totalSteps,
        isComplete: true,
        interestArea: session.interest_area,
        demoMission: session.demo_mission,
        intro,
        currentStep: null,
        finalResult: session.final_result,
      })
      return
    }

    const currentStep = buildStep(session, session.step_index)

    res.json({
      id: session.id,
      status: session.status,
      stepIndex: session.step_index,
      totalSteps,
      isComplete: false,
      interestArea: session.interest_area,
      demoMission: session.demo_mission,
      intro,
      currentStep,
      finalResult: null,
    })
  } catch (err) {
    console.error('[demo/session] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'SESSION_LOAD_FAILED', message: 'Could not load demo session' })
  }
})

// ── POST /demo/answer ─────────────────────────────────────────────────────────

router.post('/demo/answer', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const body = req.body as Record<string, unknown>

  const sessionId = typeof body['sessionId'] === 'string' ? body['sessionId'] : null
  const stepKey   = typeof body['stepKey']   === 'string' ? body['stepKey']   : null
  const answerRaw = typeof body['answer']    === 'string' ? body['answer']    : null

  if (!sessionId || !stepKey || answerRaw === null) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'sessionId, stepKey and answer are required' })
    return
  }

  const answer = answerRaw.trim()

  try {
    const session = await loadSession(sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' })
      return
    }

    if (session.status === 'completed') {
      res.status(409).json({ code: 'ALREADY_COMPLETED', message: 'This session is already completed' })
      return
    }

    // Enforce step order
    const expectedStep = buildStep(session, session.step_index)
    if (!expectedStep || expectedStep.key !== stepKey) {
      res.status(400).json({ code: 'WRONG_STEP', message: 'This is not the current step' })
      return
    }

    const totalSteps = getTotalSteps()
    const isLastStep = session.step_index === totalSteps - 1
    const nextStepIndex = isLastStep ? totalSteps : session.step_index + 1
    const nextStepContent = buildStep(session, nextStepIndex)
    const nextStepKey = nextStepContent?.key ?? 'completed'

    // ── Step-specific evaluation ──────────────────────────────────────────────

    let score: ScoreRecord
    let feedbackMessage: string
    let correctionMessage: string | undefined

    if (stepKey === 'warm_up') {
      const stepPrompt = expectedStep.prompt ?? ''
      if (detectMetaHelpIntent(answer)) {
        res.status(422).json({ code: 'META_HELP', message: buildMetaHelpResponse(session, stepPrompt, stepKey) })
        return
      }
      if (detectToxicity(answer)) {
        console.log('[demo-ai] moderation step=warm_up')
        res.status(422).json({ code: 'MODERATION', message: buildToxicModerationResponse(answer, stepPrompt) })
        return
      }
      const classified = classifyInput(answer, expectedStep.minLength)
      if (classified.cls === 'VOCAB_HELP') {
        console.log('[demo-ai] skipped reason=VOCAB_HELP step=warm_up')
        res.status(422).json({ code: 'VOCAB_HELP', message: ensureTeacherContinues(classified.message, stepPrompt) })
        return
      }
      if (classified.cls === 'GIBBERISH' || classified.cls === 'REPETITION_SPAM') {
        const msg = ensureTeacherContinues("I couldn't understand that — try a real sentence.", stepPrompt)
        res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
        return
      }
      if (classified.cls === 'CONFUSED') {
        const msg = ensureTeacherContinues(buildConfusedHint(session, 'warm_up', 0), stepPrompt)
        res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
        return
      }
      if (classified.cls === 'SHORT') {
        const msg = ensureTeacherContinues(classified.message, stepPrompt)
        res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
        return
      }
      // Single-word answers need one retry — warm_up_followup asks for elaboration
      // immediately after, so we want at least a short phrase before advancing.
      // Without this, the student hears "give me a sentence" feedback AND the
      // follow-up question back-to-back before they can answer either.
      const wuWordCount = answer.trim().split(/\s+/).filter(Boolean).length
      if (wuWordCount === 1) {
        const wuRetries = await getStepRetries(sessionId, stepKey)
        if (wuRetries < 1) {
          await incrementStepRetries(sessionId, stepKey)
          await incrementAttempts(sessionId)
          const word = answer.trim()
          const hint = `${word.charAt(0).toUpperCase() + word.slice(1)} — give me a bit more. Try: "I really like ${word} because..." — one sentence is enough.`
          res.status(422).json({ code: 'INVALID_ANSWER', message: ensureTeacherContinues(hint, stepPrompt) })
          return
        }
        // Second attempt still one word — accept so the student isn't trapped
      }

      // VALID or VALID_WEAK_ENGLISH — advance (warm_up is calibration only)
      feedbackMessage = buildWarmUpFeedback(session, answer)
      if (classified.cls === 'VALID_WEAK_ENGLISH' && classified.correction) {
        correctionMessage = classified.correction
      }
      score = { feedback: feedbackMessage }

    } else if (stepKey === 'warm_up_followup') {
      const stepPrompt = expectedStep.prompt ?? ''
      if (detectMetaHelpIntent(answer)) {
        res.status(422).json({ code: 'META_HELP', message: buildMetaHelpResponse(session, stepPrompt, stepKey) })
        return
      }
      if (detectToxicity(answer)) {
        console.log('[demo-ai] moderation step=warm_up_followup')
        res.status(422).json({ code: 'MODERATION', message: buildToxicModerationResponse(answer, stepPrompt) })
        return
      }
      const classified = classifyInput(answer, expectedStep.minLength)
      if (classified.cls === 'VOCAB_HELP') {
        console.log('[demo-ai] skipped reason=VOCAB_HELP step=warm_up_followup')
        res.status(422).json({ code: 'VOCAB_HELP', message: ensureTeacherContinues(classified.message, stepPrompt) })
        return
      }
      if (classified.cls === 'GIBBERISH' || classified.cls === 'REPETITION_SPAM') {
        const msg = ensureTeacherContinues("I couldn't understand that — try a real sentence.", stepPrompt)
        res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
        return
      }
      if (classified.cls === 'CONFUSED') {
        const msg = ensureTeacherContinues(buildConfusedHint(session, 'warm_up_followup', 0), stepPrompt)
        res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
        return
      }
      if (classified.cls === 'SHORT') {
        const msg = ensureTeacherContinues(classified.message, stepPrompt)
        res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
        return
      }
      // Word-count floor: a one-word or very short answer needs elaboration — but only
      // ask once. If the student already tried and kept it short, accept and move on.
      // Prevents the "ocean" → rejection → "it is ocean" → rejection → frustration loop.
      const wuFollowupWordCount = answer.trim().split(/\s+/).filter(Boolean).length
      if (wuFollowupWordCount <= 5) {
        const wuFollowupRetries = await getStepRetries(sessionId, stepKey)
        if (wuFollowupRetries < 1) {
          await incrementStepRetries(sessionId, stepKey)
          await incrementAttempts(sessionId)
          const msg = ensureTeacherContinues("Tell me a bit more — give me a full sentence with your actual reasoning.", stepPrompt)
          res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
          return
        }
        // Second attempt still short — accept with brief feedback, don't trap further
      }
      feedbackMessage = buildFollowUpFeedback(session, answer, 'warm_up_followup')
      if (classified.cls === 'VALID_WEAK_ENGLISH' && classified.correction) {
        correctionMessage = classified.correction
      }
      score = { feedback: feedbackMessage }

    } else if (stepKey === 'grammar_mcq') {
      // Server-side MCQ — no AI, no classification needed
      const selectedIndex = parseInt(answer, 10)
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
        res.status(400).json({ code: 'INVALID_ANSWER', message: 'Please select a valid option (0–3)' })
        return
      }
      const result = evaluateMcqServerSide(session, selectedIndex)
      score = { correct: result.correct, feedback: result.feedback }
      feedbackMessage = result.feedback
      correctionMessage = undefined

    } else if (stepKey === 'speaking_followup') {
      const stepPrompt = expectedStep.prompt ?? ''

      if (detectMetaHelpIntent(answer)) {
        res.status(422).json({ code: 'META_HELP', message: buildMetaHelpResponse(session, stepPrompt, stepKey) })
        return
      }
      if (detectToxicity(answer)) {
        console.log('[demo-ai] moderation step=speaking_followup')
        res.status(422).json({ code: 'MODERATION', message: buildToxicModerationResponse(answer, stepPrompt) })
        return
      }

      // ── 0. Student question — answer grammar/task question, return to current task ──
      if (detectStudentQuestion(answer)) {
        const response = buildStudentQuestionResponse(session, stepPrompt)
        res.status(422).json({ code: 'STUDENT_QUESTION', message: response })
        return
      }

      // ── 0b. Embedded confusion — student is confused about the question itself ──
      if (detectEmbeddedConfusion(answer)) {
        console.log('[demo-meta-help] embedded_confusion step=speaking_followup')
        const clarification = buildTaskClarification(session, 'speaking_followup', stepPrompt)
        res.status(422).json({ code: 'STUDENT_QUESTION', message: clarification, spokenMessage: clarification.slice(0, 200) })
        return
      }

      const classified = classifyInput(answer, expectedStep.minLength)
      if (classified.cls === 'VOCAB_HELP') {
        console.log('[demo-ai] skipped reason=VOCAB_HELP step=speaking_followup')
        res.status(422).json({ code: 'VOCAB_HELP', message: ensureTeacherContinues(classified.message, stepPrompt) })
        return
      }
      if (classified.cls !== 'VALID' && classified.cls !== 'VALID_WEAK_ENGLISH') {
        const hint = classified.cls === 'CONFUSED'
          ? buildConfusedHint(session, 'speaking_followup', 0)
          : classified.message
        res.status(422).json({ code: 'INVALID_ANSWER', message: ensureTeacherContinues(hint, stepPrompt) })
        return
      }
      // Word-count floor: ask once for a full sentence, but accept on the second try
      // even if still short — prevents the student from being permanently stuck.
      const sfWordCount = answer.trim().split(/\s+/).filter(Boolean).length
      if (sfWordCount <= 3) {
        const sfRetries = await getStepRetries(sessionId, stepKey)
        if (sfRetries < 1) {
          await incrementStepRetries(sessionId, stepKey)
          await incrementAttempts(sessionId)
          const msg = ensureTeacherContinues("Tell me a bit more — give me a full sentence with that idea.", stepPrompt)
          res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
          return
        }
        // Already asked once — accept short answer and continue
      }
      feedbackMessage = buildFollowUpFeedback(session, answer, 'speaking_followup')
      if (classified.cls === 'VALID_WEAK_ENGLISH' && classified.correction) {
        correctionMessage = classified.correction
      }
      score = { feedback: feedbackMessage }

    } else if (stepKey === 'speaking_task' || stepKey === 'writing_task') {
      const stepPrompt = expectedStep.prompt ?? ''

      // ── 0a. Meta / presence-check — student didn't hear, checking if system is active ──
      // Must run before everything else — these must NEVER be graded or counted as attempts.
      if (detectMetaHelpIntent(answer)) {
        console.log(`[demo-meta-help] step=${stepKey}`)
        res.status(422).json({ code: 'META_HELP', message: buildMetaHelpResponse(session, stepPrompt, stepKey) })
        return
      }

      if (detectToxicity(answer)) {
        console.log(`[demo-ai] moderation step=${stepKey}`)
        res.status(422).json({ code: 'MODERATION', message: buildToxicModerationResponse(answer, stepPrompt) })
        return
      }

      // ── 0b. Student question — answer grammar/task question, return to current task ──
      // Must run before classifyInput — grammar questions parse as VALID and would hit AI eval.
      if (detectStudentQuestion(answer)) {
        const response = buildStudentQuestionResponse(session, stepPrompt)
        res.status(422).json({ code: 'STUDENT_QUESTION', message: response })
        return
      }

      // ── 0c. Embedded confusion — student is confused even when pattern not at start ──
      // Catches "I will describe it like... what should I describe, I don't understand"
      // detectStudentQuestion only matches anchored-to-start patterns.
      if (detectEmbeddedConfusion(answer)) {
        console.log(`[demo-meta-help] embedded_confusion step=${stepKey}`)
        const clarification = buildTaskClarification(session, stepKey, stepPrompt)
        res.status(422).json({ code: 'STUDENT_QUESTION', message: clarification, spokenMessage: clarification.slice(0, 200) })
        return
      }

      const classified = classifyInput(answer, expectedStep.minLength)

      // ── 1. Vocabulary help — explain, no AI, no abuse count ──────────────────
      if (classified.cls === 'VOCAB_HELP') {
        console.log('[demo-ai] blocked reason=known_vocab_help step=' + stepKey)
        res.status(422).json({ code: 'VOCAB_HELP', message: ensureTeacherContinues(classified.message, stepPrompt) })
        return
      }

      // ── 2. Pending meaning confirmation (yes / no loop) ──────────────────────
      const pendingMeaningKey = `demo:pending_meaning:${sessionId}:${stepKey}`
      const pendingRaw = await redis.get(pendingMeaningKey)
      if (pendingRaw !== null) {
        const pending = JSON.parse(pendingRaw) as { inferredMeaning: string; originalAnswer: string }
        const confirmIntent = detectConfirmIntent(answer)

        if (confirmIntent === 'yes') {
          await redis.del(pendingMeaningKey)
          const correctionMsg = [
            `Great — I can see what you meant.`,
            `A more natural way to say it:`,
            `"${pending.inferredMeaning}"`,
            `Why this works: we use a full sentence with 'because' or 'to' to connect your idea.`,
            `No problem — now try again in your own words.`,
          ].join('\n')
          res.status(422).json({ code: 'MEANING_CONFIRMED', message: ensureTeacherContinues(correctionMsg, stepPrompt) })
          return
        }

        if (confirmIntent === 'no') {
          await redis.del(pendingMeaningKey)
          const frame = buildConfusedHint(session, stepKey, 2)
          const frameMsg = `No problem. ${frame}`
          res.status(422).json({ code: 'INVALID_ANSWER', message: ensureTeacherContinues(frameMsg, stepPrompt) })
          return
        }

        // Unclear response while waiting for yes/no — ask once more, no retry increment
        res.status(422).json({
          code: 'MEANING_UNCLEAR',
          message: `Just yes or no — did I understand you correctly?\n"${pending.inferredMeaning}"\n(Say "yes" or "no" and we'll keep going.)`,
        })
        return
      }

      // ── 3. Non-VALID input ───────────────────────────────────────────────────
      if (classified.cls !== 'VALID') {

        // POSSIBLE_MEANING_UNCLEAR — infer intent before any abuse tracking
        if (classified.cls === 'POSSIBLE_MEANING_UNCLEAR') {
          const budget = canUseDemoAI(session, 'unclear_meaning_inference', 200, 70)
          if (budget.allowed) {
            await incrementAiCalls(sessionId)
            const inferred = await inferMeaning(answer, session, stepKey)
            await redis.set(
              pendingMeaningKey,
              JSON.stringify({ inferredMeaning: inferred, originalAnswer: answer }),
              'EX', 3600,
            )
            const msg = [
              `I can see what you're trying to say.`,
              `I think you mean: "${inferred}"`,
              `Is that what you wanted to say? (yes / no)`,
            ].join('\n')
            res.status(422).json({ code: 'MEANING_UNCLEAR', message: msg })
            return
          }
          // Budget exhausted — give a frame hint and ask retry (no inference)
          const retries = await incrementStepRetries(sessionId, stepKey)
          const fallbackMsg = `That idea is useful — the English just needs structure.\n${buildConfusedHint(session, stepKey, retries)}`
          res.status(422).json({ code: 'INVALID_ANSWER', message: ensureTeacherContinues(fallbackMsg, stepPrompt) })
          return
        }

        let abuseFlags: number
        let totalAttempts: number
        let stepRetries: number

        if (classified.cls === 'GIBBERISH' || classified.cls === 'REPETITION_SPAM') {
          const updated = await incrementAbuse(sessionId)
          abuseFlags    = updated.abuse_flags
          totalAttempts = updated.answer_attempts_total
          stepRetries   = await incrementStepRetries(sessionId, stepKey)
        } else {
          const updated = await incrementAttempts(sessionId)
          abuseFlags    = session.abuse_flags
          totalAttempts = updated.answer_attempts_total
          stepRetries   = await incrementStepRetries(sessionId, stepKey)
        }

        if (abuseFlags >= ABUSE_FLAG_LIMIT || totalAttempts >= ATTEMPTS_LIMIT) {
          const earlyResult = buildEarlyResult(session, abuseFlags >= ABUSE_FLAG_LIMIT)
          await saveFinalResult(sessionId, earlyResult)
          res.json({
            feedback: { message: earlyResult.teacher_message, correction: null, score: earlyResult.score, correct: null },
            nextStep: null,
            finalResult: earlyResult,
            isComplete: true,
          })
          return
        }

        const isSpamClass = classified.cls === 'GIBBERISH' || classified.cls === 'REPETITION_SPAM'
        if (!isSpamClass && stepRetries >= 3) {
          await clearStepRetries(sessionId, stepKey)
          score = { score: 3, feedback: "That's okay — I have enough to see your pattern. Let's keep moving.", skipped: true }
          feedbackMessage = score.feedback!
          // fall through to saveAnswer
        } else {
          let msg: string
          if (isSpamClass) {
            msg = ensureTeacherContinues(getGibberishMessage(abuseFlags), stepPrompt)
          } else if (classified.cls === 'VALID_WEAK_ENGLISH') {
            msg = ensureTeacherContinues(classified.message, stepPrompt)
          } else if (classified.cls === 'CONFUSED') {
            msg = ensureTeacherContinues(buildConfusedHint(session, stepKey, stepRetries), stepPrompt)
          } else {
            // SHORT
            const base = stepRetries >= 2 ? buildConfusedHint(session, stepKey, stepRetries) : classified.message
            msg = ensureTeacherContinues(base, stepPrompt)
          }
          res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
          return
        }

      } else {
        // ── 4. Valid input — evaluate with AI or rule-based ──────
        // Read retry count BEFORE evaluation — used in quality gate below.
        const qualityRetryCount = await getStepRetries(sessionId, stepKey)

        if (stepKey === 'speaking_task') {
          const budget = canUseDemoAI(session, 'speaking_eval', 350, 120)
          if (!budget.allowed) {
            console.log(`[demo-ai] fallback reason=${budget.reason ?? 'budget'} step=speaking_task`)
            score = buildRuleBasedSpeakingFeedback(answer)
          } else {
            const rawAnswer = answer.slice(0, SPEAKING_MAX_CHARS)
            const voiceNorm = normalizeVoiceTranscript(rawAnswer)

            if (voiceNorm.isVoiceLike) {
              console.log(`[demo-voice-norm] confidence=${voiceNorm.confidence} reason=${voiceNorm.reason} normalized="${voiceNorm.normalizedText.slice(0, 80)}"`)
            }

            // Low confidence extraction — can't reliably determine the answer; ask for retry
            if (voiceNorm.confidence === 'low' && voiceNorm.isVoiceLike && qualityRetryCount < expectedStep.maxRetries) {
              await incrementStepRetries(sessionId, stepKey)
              await incrementAttempts(sessionId)
              res.status(422).json({
                code: 'QUALITY_RETRY',
                message: ensureTeacherContinues(
                  "I could hear you were thinking — but I couldn't quite catch your final answer. Say it one more time.",
                  stepPrompt,
                ),
              })
              return
            }

            const evalAnswer = voiceNorm.isVoiceLike ? voiceNorm.normalizedText : rawAnswer

            // ── 4a-pre. "Cannot do this task" detection ──────────────────────
            // Student honestly says they have no project/experience to draw on.
            // Instead of generic QUALITY_RETRY, redirect with an alternative framing
            // that makes it possible for them to answer — then accept on the next try.
            const cannotDoTask =
              /\bi\s+don'?t\s+(?:have|had)\s+(?:any\w*|a\s+\w+)\s*(?:like\s+this|similar|to\s+(?:share|talk\s+about)|at\s+all)?\b/i.test(evalAnswer) ||
              /\bi\s+(?:never\s+had|didn'?t\s+have|don'?t\s+really\s+have)\s+(?:a\s+)?(?:project|assignment|class\s+moment|presentation)\b/i.test(evalAnswer) ||
              /\bthere\s+(?:is|was|isn'?t|wasn'?t)\s+(?:nothing|no\s+project|no\s+assignment|nothing\s+like\s+this)\b/i.test(evalAnswer)

            if (cannotDoTask && qualityRetryCount < expectedStep.maxRetries) {
              await incrementStepRetries(sessionId, stepKey)
              await incrementAttempts(sessionId)
              console.log(`[demo-redirect] cannot_do_task step=speaking_task retry=${qualityRetryCount}`)
              const redirect = qualityRetryCount === 0
                ? "That's fine — let me rephrase. Think of any time this school year when you put effort into something: studying for a test, finishing a homework, understanding a difficult topic in class. Even something small. What comes to mind first?"
                : "Even the smallest thing works — just describe any school task you completed this year. Start with 'I worked on...' and tell me what it was."
              res.status(422).json({
                code: 'QUALITY_RETRY',
                message: ensureTeacherContinues(redirect, stepPrompt),
                spokenMessage: redirect.split('.')[0] + '.',
              })
              return
            }

            // ── 4a. Rule-based weak-answer gate (zero AI cost) ──────────────
            const weakCheck = analyzeAnswerQuality(evalAnswer, stepKey)
            if (weakCheck.quality === 'weak' && qualityRetryCount < expectedStep.maxRetries) {
              await incrementStepRetries(sessionId, stepKey)
              await incrementAttempts(sessionId)
              const base = weakCheck.suggestedResponse ?? buildConfusedHint(session, stepKey, qualityRetryCount + 1)
              res.status(422).json({
                code: 'QUALITY_RETRY',
                message: ensureTeacherContinues(base, stepPrompt),
              })
              return
            }

            await incrementAiCalls(sessionId)
            score = await evaluateSpeaking(
              evalAnswer,
              { ...session, ai_calls_used: session.ai_calls_used + 1 },
              voiceNorm.isVoiceLike,
              voiceNorm.hasMetaHelpInside,
            )
          }
        } else {
          // ── 4a. Rule-based weak-answer gate for writing (zero AI cost) ────
          const writingAnswer = answer.slice(0, WRITING_MAX_CHARS)
          const weakCheck = analyzeAnswerQuality(writingAnswer, stepKey)
          if (weakCheck.quality === 'weak' && qualityRetryCount < expectedStep.maxRetries) {
            await incrementStepRetries(sessionId, stepKey)
            await incrementAttempts(sessionId)
            const base = weakCheck.suggestedResponse ?? buildConfusedHint(session, stepKey, qualityRetryCount + 1)
            res.status(422).json({
              code: 'QUALITY_RETRY',
              message: ensureTeacherContinues(base, stepPrompt),
            })
            return
          }

          const budget = canUseDemoAI(session, 'writing_eval', 400, 120)
          if (!budget.allowed) {
            console.log(`[demo-ai] fallback reason=${budget.reason ?? 'budget'} step=writing_task`)
            score = buildRuleBasedWritingFeedback(answer)
          } else {
            await incrementAiCalls(sessionId)
            score = await evaluateWriting(writingAnswer, { ...session, ai_calls_used: session.ai_calls_used + 1 })
          }
        }
        feedbackMessage = score.feedback ?? "Keep going."
        correctionMessage = score.correction

        // Quality gate: score ≤ 5 on a real answer → ask for retry rather than silently advancing.
        // Only fires if retries are not exhausted and total attempts haven't hit the session limit.
        const QUALITY_RETRY_THRESHOLD = 5
        if (
          !score.skipped &&
          typeof score.score === 'number' &&
          score.score <= QUALITY_RETRY_THRESHOLD &&
          qualityRetryCount < expectedStep.maxRetries &&
          session.answer_attempts_total < ATTEMPTS_LIMIT
        ) {
          await incrementStepRetries(sessionId, stepKey)
          await incrementAttempts(sessionId)
          const corrPart = score.correction ? `\n\nA more natural way: "${score.correction}"` : ''
          res.status(422).json({
            code: 'QUALITY_RETRY',
            message: ensureTeacherContinues(feedbackMessage + corrPart, stepPrompt),
            spokenMessage: buildSpokenFeedback(feedbackMessage),
          })
          return
        }

        // Advancing — clear retry counter
        await clearStepRetries(sessionId, stepKey)
      }

    } else {
      res.status(400).json({ code: 'INVALID_STEP', message: 'Unknown step key' })
      return
    }

    // Save answer and advance step
    await saveAnswer(
      sessionId,
      stepKey,
      session.step_index,
      nextStepKey,
      nextStepIndex,
      answer,
      score,
      isLastStep,
    )

    // Final result generation on last step
    let finalResult = null
    if (isLastStep) {
      const freshSession = await loadSession(sessionId, userId)
      const resultFallback = {
        level: 'B1',
        score: 65,
        strengths: ['communicating ideas', 'effort and persistence'],
        areas_to_improve: ['grammar accuracy', 'sentence variety'],
        teacher_message: "You engaged in English today — that's the starting point. The full course builds exactly on where you are now, step by step.",
      }
      if (freshSession) {
        const budget = canUseDemoAI(freshSession, 'final_result', 450, 180)
        if (budget.allowed) {
          await incrementAiCalls(sessionId)
          finalResult = await generateFinalResult(freshSession)
        } else {
          console.log(`[demo-ai] fallback reason=${budget.reason ?? 'budget'} purpose=final_result`)
          finalResult = resultFallback
        }
      } else {
        finalResult = resultFallback
      }
      await saveFinalResult(sessionId, finalResult)
    }

    // For the last step: build a natural closing that fits the score.
    // Avoids the contradiction of "add more detail... That's the session done."
    if (isLastStep) {
      const wasLowScore = typeof score.score === 'number' && score.score <= 5
      if (wasLowScore) {
        // Retries exhausted, low score — replace AI's "add more detail" with graceful close.
        // Correction is embedded in the close message; clear it to prevent double-display.
        feedbackMessage = buildGracefulClose(score, stepKey, correctionMessage)
        correctionMessage = undefined
      } else {
        feedbackMessage += '\n\n' + buildNaturalClose(score)
      }
    }

    // For the final step, the AI teacher's own voice speaks the closing line.
    // The static goodbye bot audio is not used — AI owns the lesson end.
    const spokenFeedback = isLastStep
      ? buildClosingSpokenLine(score)
      : buildSpokenFeedback(feedbackMessage)

    res.json({
      feedback: {
        message: feedbackMessage,
        spokenFeedback,
        correction: correctionMessage ?? null,
        score: score.score ?? null,
        correct: score.correct ?? null,
      },
      nextStep: nextStepContent,
      finalResult,
      isComplete: isLastStep,
      finalAudioKey: null,
    })
  } catch (err) {
    console.error('[demo/answer] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to process answer' })
  }
})

// ── POST /demo/help ───────────────────────────────────────────────────────────
// Student asks for help understanding a word or phrase.
// Does NOT advance the lesson step. Max 5 requests per session. No AI cost.

router.post('/demo/help', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const body = req.body as Record<string, unknown>

  const sessionId = typeof body['sessionId'] === 'string' ? body['sessionId'] : null
  const textRaw   = typeof body['text']      === 'string' ? body['text']      : null

  if (!sessionId || textRaw === null) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'sessionId and text required' })
    return
  }

  const text = textRaw.trim().slice(0, HELP_MAX_CHARS)

  if (!text) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'text cannot be empty' })
    return
  }

  try {
    const session = await loadSession(sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' })
      return
    }

    if (session.status === 'completed') {
      res.status(409).json({ code: 'ALREADY_COMPLETED', message: 'Session completed' })
      return
    }

    // Rate limit
    const helpKey = `demo:help:${sessionId}`
    const helpCount = await redis.incr(helpKey)
    if (helpCount === 1) await redis.expire(helpKey, 14400)

    if (helpCount > HELP_REQUESTS_LIMIT) {
      res.status(429).json({ code: 'HELP_LIMIT_REACHED', message: "Help limit reached for this session. Try answering in your own words — even a simple sentence counts." })
      return
    }

    // Prompt injection guard
    if (/ignore\s+(previous|all|above|prior)\s+instructions?/i.test(text)) {
      console.log('[demo-help] blocked reason=injection')
      res.status(422).json({ code: 'INVALID_HELP', message: "I couldn't understand that — try typing one word or a short phrase you want explained." })
      return
    }

    // Spam/gibberish guard on the help text itself
    const cls = classifyInput(text, 2)
    if (cls.cls === 'GIBBERISH' || cls.cls === 'REPETITION_SPAM') {
      console.log('[demo-help] blocked reason=gibberish')
      res.status(422).json({ code: 'INVALID_HELP', message: "I couldn't understand that help request — try one short word or sentence." })
      return
    }

    // Try vocab detection first (template-based, free)
    const vocabWord = detectVocabWord(text)
    if (vocabWord && vocabWord !== '__confused__') {
      const entry = VOCAB_EXPLANATIONS[vocabWord]
      if (entry) {
        console.log('[demo-help] mode=template word=' + vocabWord)
        const currentStep = buildStep(session, session.step_index)
        const stepPrompt = currentStep?.prompt ?? ''
        const base = `${entry.explanation}\n${entry.example}\n${entry.taskHint}`
        res.json({ message: ensureTeacherContinues(base, stepPrompt) })
        return
      }
    }

    // Generic fallback — no AI call for help (keeps demo cost-safe)
    console.log('[demo-help] mode=generic')
    const currentStep = buildStep(session, session.step_index)
    const stepPrompt = currentStep?.prompt ?? ''
    const wordClean = text.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/).slice(0, 3).join(' ')
    const base = wordClean
      ? `Good question. Try to use "${wordClean}" in a full sentence — even a simple attempt helps a lot.`
      : "Good question — try using it in a simple sentence. Even a short attempt tells me a lot."
    res.json({ message: ensureTeacherContinues(base, stepPrompt) })
  } catch (err) {
    console.error('[demo/help] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Help request failed' })
  }
})

// ── POST /demo/translate ──────────────────────────────────────────────────────
// Translates a teacher message for the student.
// Max 10 per session. Cached. Requires session ownership.

router.post('/demo/translate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const body   = req.body as Record<string, unknown>

  const sessionId      = typeof body['sessionId']      === 'string' ? body['sessionId']      : null
  const textRaw        = typeof body['text']           === 'string' ? body['text']           : null
  const targetLanguage = typeof body['targetLanguage'] === 'string' ? body['targetLanguage'] : 'ru'

  if (!sessionId || textRaw === null) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'sessionId and text required' })
    return
  }

  if (!['uk', 'ru'].includes(targetLanguage)) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'targetLanguage must be uk or ru' })
    return
  }

  const text = textRaw.trim().slice(0, TRANSLATE_MAX_CHARS)

  if (!text) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'text cannot be empty' })
    return
  }

  try {
    const session = await loadSession(sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' })
      return
    }

    // Rate limit
    const xlateKey = `demo:translate:${sessionId}`
    const xlateCount = await redis.incr(xlateKey)
    if (xlateCount === 1) await redis.expire(xlateKey, 14400)

    if (xlateCount > TRANSLATE_LIMIT) {
      res.status(429).json({ code: 'TRANSLATE_LIMIT_REACHED', message: "Translation limit reached for this session." })
      return
    }

    // Cache check — avoids re-charging API for the same message
    const cacheKey = `demo:xlat:${simpleHash(text)}:${targetLanguage}`
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.log('[demo-translate] cache_hit=true')
      res.json({ translation: cached })
      return
    }

    console.log('[demo-translate] cache_hit=false')
    const langName = targetLanguage === 'uk' ? 'Ukrainian' : 'Russian'

    console.log(`[demo-translate] model=${DEMO_AI_CONFIG.translateModel}`)
    const aiResult = await getOpenAIClient().chat.completions.create({
      model:       DEMO_AI_CONFIG.translateModel,
      max_tokens:  200,
      temperature: 0.1,
      messages: [
        { role: 'system', content: `Translate the following English text to ${langName}. Return only the translation, nothing else. Preserve line breaks.` },
        { role: 'user',   content: text },
      ],
    })

    const translation = aiResult.choices[0]?.message?.content?.trim() ?? text
    await redis.set(cacheKey, translation, 'EX', 3600)

    res.json({ translation })
  } catch (err) {
    console.error('[demo/translate] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Translation failed' })
  }
})

// ── POST /demo/tts ────────────────────────────────────────────────────────────
// Generates audio for a high-value teacher message in demo mode.
// Auth required, session ownership required, per-session TTS budget enforced.
// Frontend sends messageText — backend validates type, length, budget, then caches.

router.post('/demo/tts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId
  const body   = req.body as Record<string, unknown>

  const sessionId   = typeof body['sessionId']   === 'string' ? body['sessionId']   : null
  const messageType = typeof body['messageType'] === 'string' ? body['messageType'] : null
  const messageRaw  = typeof body['messageText'] === 'string' ? body['messageText'] : null

  if (!sessionId || !messageType || messageRaw === null) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'sessionId, messageType, and messageText are required' })
    return
  }

  const text = messageRaw.trim().slice(0, TTS_MAX_TEXT_CHARS)
  if (!text) {
    res.status(400).json({ code: 'INVALID_REQUEST', message: 'messageText cannot be empty' })
    return
  }

  console.log(`[demo-tts] request session=${sessionId} type=${messageType}`)

  try {
    const session = await loadSession(sessionId, userId)
    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' })
      return
    }

    // Load per-session TTS usage
    const usageKey = `demo:tts:usage:${sessionId}`
    const usageRaw = await redis.get(usageKey)
    const usage = usageRaw
      ? (JSON.parse(usageRaw) as { calls_used: number; chars_used: number })
      : { calls_used: 0, chars_used: 0 }

    // Budget + type check
    console.log(`[demo-tts] budget_state calls_used=${usage.calls_used} chars_used=${usage.chars_used} type=${messageType}`)
    const check = canUseDemoTTS(usage.chars_used, usage.calls_used, messageType, text.length)
    if (!check.allowed) {
      // final_closing should NEVER be blocked — if we somehow get here, force it through.
      // This is a safety net; canUseDemoTTS already has an unconditional bypass for final_closing.
      if (messageType === 'final_closing') {
        console.warn(`[demo-tts] WARNING: final_closing blocked by budget (reason=${check.reason}) — forcing through. calls_used=${usage.calls_used}`)
        // fall through to generation below
      } else {
        res.status(429).json({ code: 'TTS_LIMIT_REACHED', reason: check.reason })
        return
      }
    }

    // Cache check — avoids repeat API cost for replays
    const cacheKey = `demo:tts:cache:${simpleHash(text + messageType)}`
    if (DEMO_TTS_CONFIG.cacheEnabled) {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`[demo-tts] cache_hit=true type=${messageType}`)
        res.json({
          audio: cached,
          cached: true,
          budget: {
            callsUsed:  usage.calls_used,
            charsUsed:  usage.chars_used,
            callsLimit: DEMO_TTS_CONFIG.maxCallsPerSession,
            charsLimit: DEMO_TTS_CONFIG.maxCharsPerSession,
          },
        })
        return
      }
    }

    // Generate TTS — model/voice configurable via env, cheap defaults
    const ttsModel = process.env.OPENAI_TTS_MODEL ?? 'tts-1'
    const ttsVoice = (process.env.OPENAI_TTS_VOICE ?? 'nova') as
      'alloy' | 'ash' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer'

    console.log(`[demo-tts] openai_call model=${ttsModel} voice=${ttsVoice} type=${messageType} chars=${text.length} response_format=mp3`)

    const speechResponse = await getOpenAIClient().audio.speech.create({
      model:           ttsModel,
      voice:           ttsVoice,
      input:           text,
      response_format: 'mp3',
    })

    const base64Audio = Buffer.from(
      await (speechResponse as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer(),
    ).toString('base64')

    // Store in cache (1h TTL — enough to replay within the session)
    if (DEMO_TTS_CONFIG.cacheEnabled) {
      await redis.set(cacheKey, base64Audio, 'EX', 3600)
    }

    // Update usage tracking (4h TTL, same as session)
    const newUsage = { calls_used: usage.calls_used + 1, chars_used: usage.chars_used + text.length }
    await redis.set(usageKey, JSON.stringify(newUsage), 'EX', 14400)

    console.log(`[demo-tts] done calls_now=${newUsage.calls_used} chars_now=${newUsage.chars_used}`)
    res.json({
      audio: base64Audio,
      cached: false,
      budget: {
        callsUsed:  newUsage.calls_used,
        charsUsed:  newUsage.chars_used,
        callsLimit: DEMO_TTS_CONFIG.maxCallsPerSession,
        charsLimit: DEMO_TTS_CONFIG.maxCharsPerSession,
      },
    })

  } catch (err) {
    console.error('[demo/tts] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'TTS_FAILED', message: 'Voice generation failed' })
  }
})

// ── POST /demo/dev-reset ──────────────────────────────────────────────────────
// Tester-only: resets the caller's own demo state so they can replay the demo.
// Requires DEMO_TEST_RESET_ENABLED=true AND caller email in DEMO_TESTER_EMAILS.
// Never resets another user. Normal one-time lock is unaffected for everyone else.

router.post('/demo/dev-reset', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (process.env.DEMO_TEST_RESET_ENABLED !== 'true') {
    res.status(404).json({ error: 'Not found' })
    return
  }

  const userId = req.user!.userId
  const email  = req.user!.email

  const allowedEmails = (process.env.DEMO_TESTER_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (!allowedEmails.includes(email.toLowerCase())) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not a tester account' })
    return
  }

  // Derive IP exactly as /demo/start does so we can clear the matching key
  const ip = (req.headers['x-forwarded-for'] as string | undefined)
    ?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown'

  try {
    // Fetch session IDs before the transaction so we can clear per-session Redis keys.
    // The TTS usage key (demo:tts:usage:{sessionId}) persists with a 4h TTL and
    // accumulates across resets because dev-reset reuses the same session row.
    // Without clearing it, budget appears exhausted from the 10th TTS call of run 3+.
    const sessionRows = await query<{ id: string }>(
      'SELECT id FROM demo_sessions WHERE user_id = $1',
      [userId],
    )
    const sessionIds = sessionRows.rows.map(r => r.id)

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE users SET demo_started_at = NULL WHERE id = $1',
        [userId],
      )
      await client.query(
        `UPDATE demo_sessions
         SET status = 'reset', completed_at = NULL, updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      )
      await client.query(
        'UPDATE user_lesson_profiles SET demo_lessons_completed = 0 WHERE user_id = $1',
        [userId],
      )
    })

    // Clear rate-limit keys that /demo/start checks.
    await redis.del(`demo:user:${userId}:attempts`)
    await redis.del(`demo:ip:${ip}`)

    // Clear all per-session Redis state so each test run starts with a clean slate.
    const STEP_KEYS = ['warm_up', 'warm_up_followup', 'grammar_mcq', 'speaking_task', 'speaking_followup', 'writing_task']
    for (const sid of sessionIds) {
      await redis.del(`demo:tts:usage:${sid}`)
      await redis.del(`demo:help:${sid}`)
      await redis.del(`demo:translate:${sid}`)
      for (const sk of STEP_KEYS) {
        await redis.del(`demo:retry:${sid}:${sk}`)
        await redis.del(`demo:pending_meaning:${sid}:${sk}`)
      }
    }

    console.log(`[demo/dev-reset] reset ok: user=${userId} ip=${ip} sessions_cleared=${sessionIds.length}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[demo/dev-reset] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Reset failed' })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

// Up to three sentences of feedback for TTS — enough for acknowledgment + correction + instruction.
// Cuts before ✗/✓ correction display blocks — those are visual, not spoken.
function buildSpokenFeedback(feedbackMsg: string): string {
  const clean = feedbackMsg.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim()
  // Cut before correction markers (✓ ✗) — these are for text display only
  const cutAt = clean.search(/✗|✓/)
  const base = cutAt > 0 ? clean.slice(0, cutAt) : clean
  // Replace literal \n with space so sentence-boundary scan works across line breaks
  const flat = base.replace(/\n+/g, ' ').trim()
  // Find up to three sentence boundaries so the teacher sounds complete, not cut off
  let endPos = flat.length
  let count = 0
  for (let i = 0; i < flat.length - 1; i++) {
    if (/[.!?]/.test(flat[i]) && /[\s"']/.test(flat[i + 1])) {
      count++
      if (count >= 3) { endPos = i + 1; break }
    }
  }
  return flat.slice(0, endPos).slice(0, 300).trim()
}

// Closing line spoken by the AI teacher at the end of the last step.
// Returned as spokenFeedback so the AI voice (not the static bot) owns the goodbye.
function buildClosingSpokenLine(score: ScoreRecord): string {
  const s = score.score ?? 0
  if (s >= 8) return "Strong finish — I have everything I need. Let me show you your results."
  if (s >= 6) return "I have a clear picture of your level now. Let me pull up your results."
  return "I've seen enough across all tasks to assess your level. Let me show you your results."
}

// Natural close when score is good — brief, teacher-like.
function buildNaturalClose(score: ScoreRecord): string {
  const s = score.score ?? 0
  if (s >= 8) return "Strong finish. Let me show you your results."
  if (s >= 6) return "I have a clear picture of your level now. Let me pull up your results."
  return "I've seen enough across all the tasks. Let me show you your results."
}

// Graceful close when retries exhausted on low score — replaces AI's retry-style message.
// Avoids "add more detail... That's the session done" contradiction.
function buildGracefulClose(score: ScoreRecord, stepKey: string, correction?: string): string {
  const corrLine = correction ? `\n\n✓ "${correction}"` : ''
  if (stepKey === 'writing_task') {
    return `Your idea came through clearly — the structure and capitalization need polish, but I can read your thinking. That's enough to assess your level.${corrLine}\n\nLet me show you your results now.`
  }
  return `I can see your idea. The grammar needs more work, but I have a complete picture of where you are.${corrLine}\n\nLet me show you your results now.`
}

// Teacher response for meta/presence-check intents (didn't hear, are you there, etc.).
// Repeats the current question with a sentence frame — does NOT advance the lesson.
function buildMetaHelpResponse(session: DemoSession, stepPrompt: string, stepKey: string): string {
  const hint = buildConfusedHint(session, stepKey, 0)
  return `I'm here — I can see your message.\n\nThe question is: ${stepPrompt}\n\n${hint}`
}

function getGibberishMessage(abuseFlags: number): string {
  if (abuseFlags <= 1) return "I couldn't follow that — try a real sentence, even a simple one."
  return "Let's keep it meaningful — I want to help you improve. Write one sentence about the topic."
}

// Builds a moderation response that sets a boundary AND extracts the student's likely intent,
// so the teacher stays pedagogically active rather than just blocking.
function buildToxicModerationResponse(answer: string, stepPrompt: string): string {
  const boundary = "Let's keep the conversation respectful."

  const hasMrBeast    = /\bmr\.?\s*beast\b/i.test(answer)
  const hasYouTube    = /\byoutube\b/i.test(answer)
  const hasNotWatching = /\b(watching\s+nothing|not\s+watching|nothing\s+right\s+now|here\s+(?:to|for)\s+lessons?|here\s+doing\s+lessons?|doing\s+this\s+lesson|i'?m\s+here)\b/i.test(answer)
  const hasRecommend  = /\b(recommend|tell\s+(?:my|a)\s+friend|suggest)\b/i.test(answer.toLowerCase())

  if (hasMrBeast) {
    if (hasNotWatching) {
      const corrected = `I would recommend MrBeast to a friend, but right now I'm not watching anything — I'm doing this lesson.`
      return `${boundary} I can see you want to recommend MrBeast but you're not watching anything right now. A clearer way to say it: "${corrected}" Try again without the insults: ${stepPrompt}`
    }
    if (hasRecommend) {
      const corrected = `I would recommend MrBeast to my friends because the videos are entertaining and fun.`
      return `${boundary} I can see you're recommending MrBeast. A natural version: "${corrected}" Try again: ${stepPrompt}`
    }
    return `${boundary} I can see you're a MrBeast fan. Give me a real sentence about that — without insults. ${stepPrompt}`
  }

  if (hasYouTube) {
    return `${boundary} I can see you watch YouTube. Tell me what kind of content in a clean sentence. ${stepPrompt}`
  }

  // Try to extract any proper-noun show or creator name
  const genericStarts = new Set(['The', 'I', 'A', 'But', 'And', 'Or', 'So', 'My', 'Me', 'We', 'It', 'He', 'She', 'You', 'Your', 'Got', 'Let', 'Keep', 'Just'])
  const propNounMatch = answer.match(/\b([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){0,2})\b/)
  if (propNounMatch) {
    const firstWord = (propNounMatch[1] ?? '').split(' ')[0] ?? ''
    if (!genericStarts.has(firstWord)) {
      const name = propNounMatch[1]!
      return `${boundary} I can see you're talking about ${name}. Tell me more about it — without the insults. ${stepPrompt}`
    }
  }

  return `${boundary} I'm here to help you improve your English — answer the question without insults. ${stepPrompt}`
}

export default router
