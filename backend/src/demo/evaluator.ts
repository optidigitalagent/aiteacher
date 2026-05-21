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
        ? "You're on the right track. What exactly happened, and how did it make you feel? Give me one more specific detail."
        : "Good start. Can you add a past event — what happened and when? Even one more sentence helps.",
    }
  }
  if (wordCount >= 5) {
    return {
      score: 4,
      feedback: "You've started — give me a bit more. What's one specific detail or reason you can add?",
    }
  }
  return {
    score: 3,
    feedback: "That's short — tell me a bit more. Try: 'I think… because…' and give me one real idea.",
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
        ? "Add 'because' or 'however' to connect your ideas — it makes a real difference to how the writing reads."
        : "You have the right ideas. Try adding a specific example to back them up.",
    }
  }
  return {
    score: 3,
    feedback: "That's a start — add a reason or example to give it some weight. What makes you say that?",
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
  isVoiceLike?: boolean,
  hasMetaHelpInside?: boolean,
): Promise<ScoreRecord> {
  const topic = TOPIC_PACKS[session.interest_area] ?? TOPIC_PACKS['school_life']!

  const systemPrompt = `You are an English teacher evaluating a student's spoken response in a demo lesson.
Return ONLY valid JSON: {"score": 0-10, "feedback": "string", "correction": "string or null"}

Rules:
- Be SPECIFIC — reference what the student actually said, the subject they named, or the moment they described
- NEVER open with empty phrases: "Great effort!", "Good attempt!", "Well done!", "Got it", "I see", "Interesting", "Useful", "You tried", "Specific answer", "I hear you're not sure", "I hear you're"
- NEVER say only "Tell me more" or "Give me more" — if you want more detail, ask something specific: "What part of [subject] interests you most?" or "What happened next?"
- NEVER say "doesn't address the prompt", "unclear English", or "confusing" — instead extract the likely idea and redirect
- NEVER say "A more natural way..." or "A more natural way to say that is..." — use varied correction phrasing: "Native speakers would usually say...", "A smoother version: ...", "You could also say...", "In natural English: ..."
- If student starts with a meta-complaint ("you didn't hear me", "you misunderstood", "that's not what I meant") — start with "I can see what you meant —" then evaluate what they actually said
- If student's answer is "I don't know", ends with "I don't know", or has no real attempt: score 3. NEVER say "I hear you're not sure." Instead use "That's okay — " or "Fair enough — " then give ONE sentence frame. Example: "That's okay — a lot of people pause here. Try: 'I would describe it as [idea].' Say it in your own words." NEVER praise a non-answer.
- If answer is unclear but contains real words: score 5, extract the likely idea, give a corrected sentence: "I can see the idea — try: '[correction]'. Say it in your own words."
- If answer is 1-3 words: score 5, say "[Word] — give me a full sentence: 'I [verb] [word] because...' — tell me something real."
- If answer has genuine content but grammar errors: correct ONE key error and explain it briefly. Score 6 minimum when the student named a real place, person, experience, or idea — even if the grammar is imperfect. A real idea with broken grammar is better than no idea.
- Score 5 only when the answer is too brief, repeats the question, or contains no personal idea at all.
- If answer is keyboard smash / truly no readable words: score 2, say "Try one clear sentence in English — even a simple one helps."
- correction: an improved version of EXACTLY what the student said — fix grammar and word order only, NEVER add content. If the student used wrong vocabulary or the text is so broken that a grammar-only fix still produces something meaningless, set correction to null. A bad correction is worse than no correction. Only provide correction when the result is clearly better English the student can learn from.
- Score range: 6-8 for real attempts with genuine content. Reserve 9-10 for exceptional answers. Reserve 5 for near-empty answers only.
- ALWAYS end with a question or clear instruction — the student must know what to do next.
- If warmUpAnswer contains an interesting idea (discoveries, world rules, online school, a specific subject or experience), reference it naturally when it genuinely connects — e.g. "You mentioned [idea] earlier — that same thinking applies here." Skip if it doesn't connect.
- Keep feedback under 55 words total.`

  const voiceNote = isVoiceLike
    ? '\nNote: extracted from a voice transcript — student was thinking aloud; evaluate this as their final intended idea.'
    : ''
  const helpNote = hasMetaHelpInside
    ? '\nNote: student included a help request inside their answer — briefly acknowledge it ("I can see what you meant —") then evaluate the answer itself.'
    : ''

  const warmUpAnswer = (session.answers['warm_up'] ?? '').slice(0, 100)

  const userPrompt = `Prompt given to student: "${topic.speakingPrompt}"
Student answer: "${answer}"${voiceNote}${helpNote}
Student confidence level: ${session.speaking_confidence}
Teacher style: ${session.teacher_style}
Interest area: ${topic.label}${warmUpAnswer ? `\nEarlier warm-up (student said): "${warmUpAnswer}"` : ''}`

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

    const rawScore = typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 6
    return {
      // Floor at 4 for genuine attempts — AI sometimes scores harshly on broken-grammar real content
      score: rawScore > 2 ? Math.max(4, rawScore) : rawScore,
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

  const systemPrompt = `You are an English teacher evaluating a student's written response in a demo lesson.
Return ONLY valid JSON: {"score": 0-10, "feedback": "string", "correction": "string or null"}

Rules:
- Be SPECIFIC — mention what they actually wrote, the topic they named, the idea they described
- Give ONE concrete improvement: e.g. "Use 'because' after your main point" or "Start with 'I would' instead of mid-sentence"
- NEVER open with empty phrases: "Got it", "Good ideas!", "You tried", "You attempted", "That gives me a better picture", "Clear idea", "I hear you're not sure", "I hear you're"
- NEVER say "doesn't address the prompt", "unclear", "confusing" — extract the idea and redirect warmly
- NEVER say "A more natural way..." — use varied phrasing: "Native speakers would usually say...", "A smoother version: ...", "You could also say...", "In natural English: ..."
- If student mentions meta-complaints ("you didn't hear me", "you misunderstood") — briefly acknowledge: "I can see what you meant —" then evaluate what they wrote
- If answer is "I don't know", vague, or no real personal content: score 3. NEVER say "I hear you're not sure." Use "That's okay — " or "Fair enough — " then give a sentence frame. Do NOT praise a non-answer.
- If answer is unclear but has real words: score 5, infer the idea, give a clearer version: "I can see the idea — try: '[correction]'. More specific this time."
- If answer has weak grammar but real content: correct 1-2 key errors, explain briefly. Score 6 minimum when the student expressed a real idea with specifics (place, activity, reason) — even if grammar needs work.
- Score 5 only when the answer is too brief, vague, or contains no real personal idea.
- correction: an improved version of EXACTLY what the student wrote — fix grammar and word order only, NEVER add content. If the text is too incoherent for grammar-only correction to be meaningful, set correction to null. A confusing correction is worse than none.
- If truly no readable words: score 2, say "Write 2-3 real English sentences about the topic — even simple ones count."
- Score range: 6-8 for real attempts with genuine content. Reserve 9-10 for strong, well-structured responses. Reserve 5 for near-empty attempts only.
- ALWAYS end with a question or clear instruction — student must know exactly what to do next.
- If earlier context (speaking answer, warm-up) is provided, reference it when it naturally connects — skip if it doesn't.
- Keep feedback under 60 words total.`

  const speakingAnswer = (session.answers['speaking_task'] ?? '').slice(0, 100)
  const warmUpAnswer   = (session.answers['warm_up'] ?? '').slice(0, 60)
  const contextLines   = [
    speakingAnswer && `Speaking answer earlier: "${speakingAnswer}"`,
    warmUpAnswer   && `Warm-up topic (student said): "${warmUpAnswer}"`,
  ].filter(Boolean).join('\n')

  const userPrompt = `Writing prompt: "${topic.writingPrompt}"
Student answer: "${answer}"
Student confidence: ${session.speaking_confidence}
Teacher style: ${session.teacher_style}
Interest area: ${topic.label}${contextLines ? `\n${contextLines}` : ''}`

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

    const rawScore = typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 6
    return {
      score: rawScore > 2 ? Math.max(4, rawScore) : rawScore,
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
