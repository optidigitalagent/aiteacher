import OpenAI from 'openai'
import type { DemoSession, FinalResult, ScoreRecord } from './lesson-engine.js'
import { TOPIC_PACKS, GRAMMAR_PACKS } from './script-data.js'

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

const MODEL = 'gpt-4o'

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
- If answer is 1-3 words only (a topic name, single noun): score 3-4, say "[Word] — good topic. Try a full sentence: 'I [verb] [word] because...' — give me something real to work with."
- If answer is not English / gibberish / keyboard smash: score 1-2, say "I couldn't follow that as English. Try one clear sentence — even a simple one counts."
- correction: an improved full sentence version of what they said. Set to null ONLY if their grammar was already correct and complete.
- Keep feedback under 40 words total.`

  const userPrompt = `Prompt given to student: "${topic.speakingPrompt}"
Student answer: "${answer}"
Student confidence level: ${session.speaking_confidence}
Teacher style: ${session.teacher_style}
Interest area: ${topic.label}`

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 200,
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
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : "Good effort! Keep going.",
      correction: typeof parsed.correction === 'string' && parsed.correction !== 'null' ? parsed.correction : undefined,
    }
  } catch (err) {
    console.error('[evaluator] speaking eval failed:', err instanceof Error ? err.message : err)
    return { score: 6, feedback: "Good effort! Let's keep moving.", correction: undefined }
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
- correction: an improved version of 1-2 of their sentences showing the upgrade. null only if already excellent.
- If the answer is not English / gibberish: score 1, say "That doesn't read as English to me. Write 2-3 real sentences — even simple ones."
- Keep feedback under 60 words total.`

  const userPrompt = `Writing prompt: "${topic.writingPrompt}"
Student answer: "${answer}"
Student confidence: ${session.speaking_confidence}
Teacher style: ${session.teacher_style}
Interest area: ${topic.label}`

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 200,
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
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : "Well done! Good ideas here.",
      correction: typeof parsed.correction === 'string' && parsed.correction !== 'null' ? parsed.correction : undefined,
    }
  } catch (err) {
    console.error('[evaluator] writing eval failed:', err instanceof Error ? err.message : err)
    return { score: 6, feedback: "Well done! Good ideas here.", correction: undefined }
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
- Writing answer: "${(session.answers['writing_task'] ?? '').slice(0, 200)}"`

  const fallback: FinalResult = {
    level: 'B1',
    score: 65,
    strengths: ['communicating ideas', 'vocabulary range'],
    areas_to_improve: ['grammar accuracy', 'sentence variety'],
    teacher_message: "You showed real potential today! Keep practising and you'll make fast progress.",
  }

  try {
    const res = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 300,
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
    return fallback
  }
}
