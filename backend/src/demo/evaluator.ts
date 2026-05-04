import OpenAI from 'openai'
import type { DemoSession, FinalResult, ScoreRecord } from './lesson-engine.js'
import { TOPIC_PACKS, GRAMMAR_PACKS } from './script-data.js'
import { DEMO_AI_CONFIG } from './ai-config.js'

// ── Rule-based fallbacks (used when AI is unavailable or limit reached) ────────

export function buildRuleBasedSpeakingFeedback(answer: string): ScoreRecord {
  const words = answer.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const hasPersonal = /\b(i|my|me)\b/i.test(answer)
  const hasPast = /\b(was|were|went|did|had|saw|felt|loved|enjoyed|found|visited|tried|made|thought|said)\b/i.test(answer)

  if (wordCount >= 25 && hasPersonal && hasPast) {
    return {
      score: 7,
      feedback: "You're describing past experiences naturally — that's a real skill. Next time, try adding one more specific detail or feeling to make it even stronger.",
    }
  }
  if (wordCount >= 12 && hasPersonal) {
    return {
      score: 5,
      feedback: hasPast
        ? "You're on the right track. Add more specific detail — what exactly happened, and how did it make you feel?"
        : "Good start. Try including a past event — tell me what happened and when.",
    }
  }
  if (wordCount >= 5) {
    return {
      score: 4,
      feedback: "That's a start — I need 2–3 full sentences to properly assess your speaking. Try expanding with a reason or example.",
    }
  }
  return {
    score: 3,
    feedback: "Very brief. Give me 2–3 full sentences about the topic — I want to see how you actually use English.",
  }
}

export function buildRuleBasedWritingFeedback(answer: string): ScoreRecord {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length
  const hasBecause = /\bbecause\b/i.test(answer)
  const hasConnectors = /\b(however|therefore|although|also|firstly|finally|moreover|furthermore|in addition)\b/i.test(answer)
  const hasExamples = /\b(for example|for instance|such as)\b/i.test(answer)

  if (wordCount >= 40 && (hasBecause || hasConnectors) && (hasExamples || hasConnectors)) {
    return {
      score: 7,
      feedback: "Solid structure — you're connecting ideas clearly. Try varying your sentence length to improve the flow.",
    }
  }
  if (wordCount >= 25 && (hasBecause || hasConnectors)) {
    return {
      score: 6,
      feedback: "You're using linking words — that's the right instinct. Add a concrete example or a second reason to give it more depth.",
    }
  }
  if (wordCount >= 15) {
    return {
      score: 5,
      feedback: !hasBecause && !hasConnectors
        ? "Add 'because' or 'however' to connect your ideas — it makes your writing sound significantly more sophisticated."
        : "You have the right ideas. Try adding a specific example to back them up.",
    }
  }
  return {
    score: 3,
    feedback: "Too brief for a writing task. I need at least 3 sentences with reasons and examples to give useful feedback.",
  }
}

// Lazy singleton — only initialised on first AI call
let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')
    _client = new OpenAI({ apiKey })
  }
  return _client
}

export function getOpenAIClient(): OpenAI { return getClient() }

// Model resolved at runtime — configurable via OPENAI_DEMO_MODEL env var
function getModel(): string { return DEMO_AI_CONFIG.model }

// ── Shared JSON parse helper ──────────────────────────────────────────────────

function parseJSON<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    return JSON.parse(match[0]) as T
  } catch {
    return fallback
  }
}

// ── Speaking evaluation (AI call #1) ─────────────────────────────────────────

export async function evaluateSpeaking(
  answer: string,
  session: DemoSession,
): Promise<ScoreRecord> {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!

  const systemPrompt = `You are an English teacher evaluating a student's spoken response.
Return ONLY valid JSON: {"score": 0-10, "feedback": "string", "correction": "string or null"}

Rules:
- Be SPECIFIC — reference what the student actually said or the topic they mentioned
- NEVER start with generic phrases like "Great effort!", "Good attempt!", "Well done!" — be direct and honest
- NEVER say "Your answer isn't clear English", "doesn't address the prompt", or "I couldn't follow that as English" — these are too harsh for genuine attempts
- If answer is 1-3 words only (a topic name, single noun): score 3-4, say "[Word] — give me a full sentence: 'I [verb] [word] because...' — tell me something real."
- If answer is unclear but contains real words (word-salad, broken grammar): score 3-4, extract the likely idea, give a corrected sentence, say "I can see the idea — a clearer version: '[correction]'. Try again in your own words."
- If answer is keyboard smash / no real words: score 1-2, say "Try one clear sentence in English — even a simple one helps me understand where you are."
- correction: an improved full sentence version of what they said. Set to null ONLY if grammar was already correct and complete.
- Keep feedback under 45 words total.`

  const userPrompt = `Prompt given to student: "${topic.speakingPrompt}"
Student answer: "${answer}"
Student confidence level: ${session.speaking_confidence}
Teacher style: ${session.teacher_style}
Interest area: ${topic.label}`

  try {
    const res = await getClient().chat.completions.create({
      model: getModel(),
      max_tokens: DEMO_AI_CONFIG.maxOutputTokensPerCall,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const text = res.choices[0]?.message?.content ?? ''
    const parsed = parseJSON<{ score?: number; feedback?: string; correction?: string }>(text, {})

    return {
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 6,
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : "Try to say a bit more next time — more detail always helps.",
      correction: typeof parsed.correction === 'string' && parsed.correction !== 'null' ? parsed.correction : undefined,
    }
  } catch (err) {
    const isRateLimit = err != null && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429
    if (isRateLimit) {
      console.warn('[evaluator] rate limit — using rule-based speaking fallback')
    } else {
      console.error('[evaluator] speaking eval failed:', err instanceof Error ? err.message : err)
    }
    console.log('[demo-ai] fallback reason=quota_or_error purpose=speaking_eval')
    return buildRuleBasedSpeakingFeedback(answer)
  }
}

// ── Writing evaluation (AI call #2) ──────────────────────────────────────────

export async function evaluateWriting(
  answer: string,
  session: DemoSession,
): Promise<ScoreRecord> {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!

  const systemPrompt = `You are an English teacher evaluating a student's written response.
Return ONLY valid JSON: {"score": 0-10, "feedback": "string", "correction": "string or null"}

Rules:
- Be SPECIFIC — mention what they actually wrote or the idea they expressed
- Give ONE concrete improvement: e.g. "Use 'however' instead of 'but' to sound more formal" or "Add a reason after your main point"
- NEVER be generic — "Good ideas!" alone is not acceptable
- NEVER say "doesn't address the prompt" or "your answer is unclear" — instead, extract the likely idea and redirect gently
- If answer is unclear but has real words: score 3-4, infer the idea, give a clearer 1-sentence version, say "I can see you mean [idea] — a clearer version: '[correction]'. Try again."
- correction: an improved version of 1-2 of their sentences showing the upgrade. null only if already excellent.
- If the answer has no readable words (keyboard smash): score 1, say "Write 2-3 real English sentences — even simple ones give me something to work with."
- Keep feedback under 60 words total.`

  const userPrompt = `Writing prompt: "${topic.writingPrompt}"
Student answer: "${answer}"
Student confidence: ${session.speaking_confidence}
Teacher style: ${session.teacher_style}
Interest area: ${topic.label}`

  try {
    const res = await getClient().chat.completions.create({
      model: getModel(),
      max_tokens: DEMO_AI_CONFIG.maxOutputTokensPerCall,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const text = res.choices[0]?.message?.content ?? ''
    const parsed = parseJSON<{ score?: number; feedback?: string; correction?: string }>(text, {})

    return {
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 6,
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : "Try expanding your ideas with reasons and examples next time.",
      correction: typeof parsed.correction === 'string' && parsed.correction !== 'null' ? parsed.correction : undefined,
    }
  } catch (err) {
    const isRateLimit = err != null && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429
    if (isRateLimit) {
      console.warn('[evaluator] rate limit — using rule-based writing fallback')
    } else {
      console.error('[evaluator] writing eval failed:', err instanceof Error ? err.message : err)
    }
    console.log('[demo-ai] fallback reason=quota_or_error purpose=writing_eval')
    return buildRuleBasedWritingFeedback(answer)
  }
}

// ── Final result generation (AI call #3) ─────────────────────────────────────

export async function generateFinalResult(
  session: DemoSession,
): Promise<FinalResult> {
  const grammar = GRAMMAR_PACKS[session.demo_mission] ?? GRAMMAR_PACKS['real_conversation_mission']!
  const speakScore = (session.scores['speaking_task']?.score ?? 6) as number
  const writeScore = (session.scores['writing_task']?.score ?? 6) as number
  const grammarCorrect = session.scores['grammar_mcq']?.correct === true

  const systemPrompt = `You are an English teacher writing a personalised lesson summary for a student.
Return ONLY valid JSON:
{
  "level": "A2|B1|B2",
  "score": 1-100,
  "strengths": ["max 2 SPECIFIC short phrases based on what they actually did well"],
  "areas_to_improve": ["max 2 SPECIFIC short phrases based on their actual errors"],
  "teacher_message": "2-3 sentences: acknowledge something SPECIFIC from their answers, name the level, and give a concrete motivating next step"
}

Rules:
- strengths and areas_to_improve must reference actual performance, not generic phrases
- teacher_message must feel personal — mention their interest area or something they said
- Do NOT use phrases like "You showed real potential" or "Keep practising" alone — be more specific
- Total response under 160 words.`

  const speakFollowUp = (session.answers['speaking_followup'] ?? '').slice(0, 100)

  const userPrompt = `Student profile:
- Interest area: ${session.interest_area}
- Grammar target: ${grammar.target}
- Grammar MCQ: ${grammarCorrect ? 'correct' : 'incorrect'}
- Speaking score: ${speakScore}/10
- Writing score: ${writeScore}/10
- Speaking confidence: ${session.speaking_confidence}
- Demo mission: ${session.demo_mission}
- Teacher style: ${session.teacher_style}
- Speaking answer: "${(session.answers['speaking_task'] ?? '').slice(0, 200)}"
${speakFollowUp ? `- Speaking follow-up: "${speakFollowUp}"` : ''}
- Writing answer: "${(session.answers['writing_task'] ?? '').slice(0, 200)}"`

  const fallback: FinalResult = {
    level: 'B1',
    score: 65,
    strengths: ['expressing personal ideas', 'vocabulary range'],
    areas_to_improve: ['grammar accuracy', 'sentence variety'],
    teacher_message: "You communicate your ideas in English — that's already a real foundation. The next step is making your sentences smoother and more precise. The full course is built for exactly where you are now.",
  }

  try {
    const res = await getClient().chat.completions.create({
      model: getModel(),
      max_tokens: DEMO_AI_CONFIG.maxOutputTokensPerCall,
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const text = res.choices[0]?.message?.content ?? ''
    const parsed = parseJSON<Partial<FinalResult>>(text, {})

    return {
      level: typeof parsed.level === 'string' ? parsed.level : fallback.level,
      score: typeof parsed.score === 'number' ? Math.min(100, Math.max(1, parsed.score)) : fallback.score,
      strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]).slice(0, 2) : fallback.strengths,
      areas_to_improve: Array.isArray(parsed.areas_to_improve) ? (parsed.areas_to_improve as string[]).slice(0, 2) : fallback.areas_to_improve,
      teacher_message: typeof parsed.teacher_message === 'string' ? parsed.teacher_message : fallback.teacher_message,
    }
  } catch (err) {
    console.error('[evaluator] final result failed:', err instanceof Error ? err.message : err)
    console.log('[demo-ai] fallback reason=quota_or_error purpose=final_result')
    return fallback
  }
}

// ── Unclear meaning inference (AI call for word-salad input) ──────────────────
// Very cheap call (~150 input + 70 output tokens). Used once per unclear attempt.

export async function inferMeaning(
  answer: string,
  session: DemoSession,
  stepKey: string,
): Promise<string> {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!
  const prompt = stepKey === 'writing_task' ? topic.writingPrompt : topic.speakingPrompt

  try {
    const res = await getClient().chat.completions.create({
      model: getModel(),
      max_tokens: 80,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an English teacher. A student tried to answer a question but their English is unclear.
Infer their most likely intended meaning and write ONE clear, natural English sentence capturing what they meant.
Return ONLY the inferred sentence. Max 20 words. Keep it simple and direct.`,
        },
        {
          role: 'user',
          content: `Question: "${prompt}"\nStudent's attempt: "${answer.slice(0, 200)}"`,
        },
      ],
    })
    return res.choices[0]?.message?.content?.trim() ?? answer
  } catch (err) {
    console.error('[evaluator] inferMeaning failed:', err instanceof Error ? err.message : err)
    return answer
  }
}
