import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { query, withTransaction } from '../db/postgres.js'
import redis from '../db/redis.js'
import {
  buildIntro,
  buildStep,
  checkSpam,
  evaluateMcqServerSide,
  buildWarmUpFeedback,
  buildFollowUpFeedback,
  buildConfusedHint,
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
} from '../demo/evaluator.js'
import { classifyInput, buildEarlyResult } from '../demo/abuse-guard.js'

const router = Router()

const MAX_AI_CALLS = 4
// Abuse thresholds
const ABUSE_FLAG_LIMIT    = 3   // gibberish submissions before early termination
const ATTEMPTS_LIMIT      = 8   // total rejected submissions (short/confused/gibberish) on AI steps
// Max chars forwarded to AI — keeps token cost low
const SPEAKING_MAX_CHARS  = 300
const WRITING_MAX_CHARS   = 400

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
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to load session' })
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
      // No AI — rule-based spam check + scripted feedback
      const spam = checkSpam(answer, expectedStep.minLength)
      if (spam.spam) {
        res.status(422).json({ code: 'INVALID_ANSWER', message: getSpamMessage(spam.reason) })
        return
      }
      feedbackMessage = buildWarmUpFeedback(session, answer)
      score = { feedback: feedbackMessage }

    } else if (stepKey === 'warm_up_followup') {
      // Rule-based, no AI, light spam check
      const spam = checkSpam(answer, expectedStep.minLength)
      if (spam.spam) {
        res.status(422).json({ code: 'INVALID_ANSWER', message: getSpamMessage(spam.reason) })
        return
      }
      feedbackMessage = buildFollowUpFeedback(session, answer, 'warm_up_followup')
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
      // Rule-based follow-up — classify but no abuse tracking
      const classified = classifyInput(answer, expectedStep.minLength)
      if (classified.cls !== 'VALID') {
        res.status(422).json({ code: 'INVALID_ANSWER', message: classified.message })
        return
      }
      feedbackMessage = buildFollowUpFeedback(session, answer, 'speaking_followup')
      score = { feedback: feedbackMessage }

    } else if (stepKey === 'speaking_task' || stepKey === 'writing_task') {
      // ── Classification + abuse guard + per-step retry loop ────────────────
      const classified = classifyInput(answer, expectedStep.minLength)

      if (classified.cls !== 'VALID') {
        let abuseFlags: number
        let totalAttempts: number
        let stepRetries: number

        if (classified.cls === 'GIBBERISH') {
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

        // Early termination overrides everything
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

        // Force-advance confused/short students after 3 attempts on same step
        if (classified.cls !== 'GIBBERISH' && stepRetries >= 3) {
          await clearStepRetries(sessionId, stepKey)
          score = { score: 3, feedback: "Let's keep going — you'll get more practice with this in the full course.", skipped: true }
          feedbackMessage = score.feedback!
          // fall through to saveAnswer
        } else {
          // Dynamic message: gibberish gets escalating warnings, confused/short get rephrasing + examples
          const msg = classified.cls === 'GIBBERISH'
            ? getGibberishMessage(abuseFlags)
            : classified.cls === 'CONFUSED'
            ? buildConfusedHint(session, stepKey, stepRetries)
            : stepRetries >= 2
            ? buildConfusedHint(session, stepKey, stepRetries)
            : classified.message
          res.status(422).json({ code: 'INVALID_ANSWER', message: msg })
          return
        }

      } else {
        // ── Valid input — clear retries, evaluate with AI or rule-based ──────
        await clearStepRetries(sessionId, stepKey)

        if (stepKey === 'speaking_task') {
          if (session.ai_calls_used >= MAX_AI_CALLS) {
            score = buildRuleBasedSpeakingFeedback(answer)
          } else {
            await incrementAiCalls(sessionId)
            const trimmedAnswer = answer.slice(0, SPEAKING_MAX_CHARS)
            score = await evaluateSpeaking(trimmedAnswer, { ...session, ai_calls_used: session.ai_calls_used + 1 })
          }
        } else {
          if (session.ai_calls_used >= MAX_AI_CALLS) {
            score = buildRuleBasedWritingFeedback(answer)
          } else {
            await incrementAiCalls(sessionId)
            const trimmedAnswer = answer.slice(0, WRITING_MAX_CHARS)
            score = await evaluateWriting(trimmedAnswer, { ...session, ai_calls_used: session.ai_calls_used + 1 })
          }
        }
        feedbackMessage = score.feedback ?? "Keep going."
        correctionMessage = score.correction
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

    // Final result generation (AI call #3) on last step
    let finalResult = null
    if (isLastStep) {
      const freshSession = await loadSession(sessionId, userId)
      if (freshSession && freshSession.ai_calls_used < MAX_AI_CALLS) {
        await incrementAiCalls(sessionId)
        finalResult = await generateFinalResult(freshSession)
      } else {
        finalResult = {
          level: 'B1',
          score: 65,
          strengths: ['communicating ideas', 'effort and persistence'],
          areas_to_improve: ['grammar accuracy', 'sentence variety'],
          teacher_message: "You showed real potential today! Keep practising and you'll make fast progress.",
        }
      }
      await saveFinalResult(sessionId, finalResult)
    }

    res.json({
      feedback: {
        message: feedbackMessage,
        correction: correctionMessage ?? null,
        score: score.score ?? null,
        correct: score.correct ?? null,
      },
      nextStep: nextStepContent,
      finalResult,
      isComplete: isLastStep,
    })
  } catch (err) {
    console.error('[demo/answer] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to process answer' })
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

    // Clear BOTH rate-limit keys that /demo/start checks in order.
    await redis.del(`demo:user:${userId}:attempts`)
    await redis.del(`demo:ip:${ip}`)

    console.log(`[demo/dev-reset] reset ok: user=${userId} ip=${ip}`)
    res.json({ ok: true })
  } catch (err) {
    console.error('[demo/dev-reset] error:', err instanceof Error ? err.message : err)
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Reset failed' })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpamMessage(reason: string | undefined): string {
  switch (reason) {
    case 'too_short':        return 'Please write a bit more!'
    case 'too_long':         return 'Please keep your answer under 500 characters.'
    case 'repeated_chars':   return "That looks like a test — give me a real answer!"
    case 'low_alpha_ratio':  return 'Please write in English!'
    default:                 return 'Please give a proper answer.'
  }
}

function getGibberishMessage(abuseFlags: number): string {
  if (abuseFlags <= 1) return "I couldn't follow that — try a real sentence, even a simple one."
  return "Let's keep it real — I want to help you improve. Write one sentence about the topic."
}

export default router
