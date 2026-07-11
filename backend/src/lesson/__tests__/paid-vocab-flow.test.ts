import { beforeEach, describe, expect, it, vi } from 'vitest'

const redisStore = new Map<string, string>()

const redisMock = {
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => {
    redisStore.set(key, value)
    return 'OK'
  }),
  del: vi.fn(async (key: string) => {
    redisStore.delete(key)
    return 1
  }),
}

vi.mock('../../db/redis.js', () => ({
  default: redisMock,
}))

vi.mock('../../memory/index.js', () => ({
  memoryService: {
    recordValidationEvent: vi.fn(async () => undefined),
    recordExerciseCompleted: vi.fn(async () => undefined),
    recordLessonCompleted: vi.fn(async () => undefined),
    getTeacherMemoryPromptBlock: vi.fn(async () => ''),
  },
  updateAdaptiveSignal: vi.fn(async () => undefined),
  deriveMistakeCategory: vi.fn(() => 'unknown'),
  getSessionMemory: vi.fn(async () => ({})),
  buildAdaptiveLearningContextBlock: vi.fn(() => ''),
}))

vi.mock('../pedagogical-progress-graph.js', () => ({
  recordNodeAttempt: vi.fn(async () => undefined),
  recordNodeCompleted: vi.fn(async () => undefined),
  recordNodeSkipped: vi.fn(async () => undefined),
  recordMisconception: vi.fn(async () => undefined),
}))

vi.mock('../../runtime/trace-recorder.js', () => ({
  recordTraceEvent: vi.fn(),
}))

describe('paid lesson vocabulary item flow', () => {
  beforeEach(() => {
    redisStore.clear()
    vi.clearAllMocks()
  })

  it('treats intro readiness as warm-up, not as the first gap-fill answer', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-warmup'

    await exerciseEngine.init(lessonId, '1.1')

    const ready = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0939\u093e\u0902 \u091c\u0940. I\'m ready.',
      lessonStartedAt: Date.now(),
    })

    expect(ready.feedback).toBeNull()
    expect(ready.cursorUpdate).toBeNull()
    expect(ready.deterministicTeacherText).toContain('Before we start')
    expect(ready.deterministicTeacherText).toContain('free time today')

    let state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)

    const shortWarmupAnswer = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Yes. I have.',
      lessonStartedAt: Date.now(),
    })

    expect(shortWarmupAnswer.feedback).toBeNull()
    expect(shortWarmupAnswer.cursorUpdate).toBeNull()
    expect(shortWarmupAnswer.deterministicTeacherText).toContain('What did you do in your free time?')

    state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)

    const warmupAnswer = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'I watched a movie.',
      lessonStartedAt: Date.now(),
    })

    expect(warmupAnswer.feedback).toBeNull()
    expect(warmupAnswer.cursorUpdate).toBeNull()
    expect(warmupAnswer.deterministicTeacherText).toContain('real English practice')
    expect(warmupAnswer.deterministicTeacherText).toContain('My ___ is photography.')

    state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)

    const firstAnswer = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Hobby',
      lessonStartedAt: Date.now(),
    })
    expect(firstAnswer.feedback?.correct).toBe(true)
  })

  it('keeps Section 1.1 item text and expected answer synchronized', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { tryBuildAutoManifest } = await import('../auto-section-manifest-builder.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-item-sync'

    const manifest = tryBuildAutoManifest('1.1')
    const firstItem = manifest?.exercises[0]?.items?.[0]
    expect(firstItem).toEqual({
      text: 'My ___ is photography.',
      correctAnswer: 'hobby',
    })

    await exerciseEngine.init(lessonId, '1.1')

    const wrongFirst = await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Spare time',
      lessonStartedAt: Date.now(),
    })
    expect(wrongFirst?.feedback?.correct).toBe(false)
    expect(wrongFirst?.cursorUpdate?.currentItem).toBe('My ___ is photography.')
    expect(wrongFirst?.deterministicTeacherText).toContain('My ___ is photography.')

    const correctFirst = await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Hobby',
      lessonStartedAt: Date.now(),
    })
    expect(correctFirst?.feedback?.correct).toBe(true)
    expect(correctFirst?.cursorUpdate?.currentItem).toBe('What do you do in your ___?')
  })

  it('answers RU/UA clarification without grading it as a gap-fill attempt', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()

    for (const [lessonId, question, expectedPhrase] of [
      ['paid-vocab-flow-ua-clarification', 'як сказати протягом 30 хвилин', 'for 30 minutes'],
      ['paid-vocab-flow-ru-clarification', 'как сказать смешной фильм', 'funny movie'],
    ] as const) {
      await exerciseEngine.init(lessonId, '1.1')

      const result = await orchestrator.handleStudentAnswer({
        lessonId,
        userId: 'user-1',
        sessionId: 'session-1',
        studentAnswer: question,
        lessonStartedAt: Date.now(),
      })

      expect(result.feedback).toBeNull()
      expect(result.cursorUpdate).toBeNull()
      expect(result.deterministicTeacherText).toContain(expectedPhrase)
      expect(result.deterministicTeacherText).toContain('one short English sentence')

      const state = await exerciseEngine.getState(lessonId)
      expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
      expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)

      const followupAnswer = await orchestrator.handleStudentAnswer({
        lessonId,
        userId: 'user-1',
        sessionId: 'session-1',
        studentAnswer: 'I can try.',
        lessonStartedAt: Date.now(),
      })

      expect(followupAnswer.feedback).toBeNull()
      expect(followupAnswer.cursorUpdate).toBeNull()
      expect(followupAnswer.deterministicTeacherText).toContain('My ___ is photography.')

      const stateAfterFollowup = await exerciseEngine.getState(lessonId)
      expect(stateAfterFollowup?.currentExerciseState?.currentStepIndex).toBe(0)
      expect(stateAfterFollowup?.currentExerciseState?.stepAttempts).toHaveLength(0)
    }
  })

  it('answers English task-help confusion without grading it as a gap-fill attempt', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()

    for (const [lessonId, question] of [
      ['paid-vocab-flow-english-help', 'I do not understand the task. What should I do here?'],
      ['paid-vocab-flow-english-confused', 'Can you explain what I should answer?'],
    ] as const) {
      await exerciseEngine.init(lessonId, '1.1')

      const result = await orchestrator.handleStudentAnswer({
        lessonId,
        userId: 'user-1',
        sessionId: 'session-1',
        studentAnswer: question,
        lessonStartedAt: Date.now(),
      })

      expect(result.feedback).toBeNull()
      expect(result.cursorUpdate).toBeNull()
      expect(result.teacherInput).toBeNull()
      expect(result.deterministicTeacherText).toContain('one word')
      expect(result.deterministicTeacherText).toContain('activity you enjoy')
      expect(result.deterministicTeacherText).toContain('My ___ is photography.')

      const state = await exerciseEngine.getState(lessonId)
      expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
      expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
    }
  })

  it('answers direct word-help and ASR word/world/worms variants without grading', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()

    for (const [lessonId, question, expectedAnswer] of [
      ['paid-vocab-flow-direct-word-help-1', "Sorry. I don't know. Can you help me with this worms?", 'hobby'],
      ['paid-vocab-flow-direct-word-help-2', "I don't know. Which world is it?", 'hobby'],
      ['paid-vocab-flow-direct-word-help-3', 'Which word is it?', 'hobby'],
    ] as const) {
      await exerciseEngine.init(lessonId, '1.1')

      const result = await orchestrator.handleStudentAnswer({
        lessonId,
        userId: 'user-1',
        sessionId: 'session-1',
        studentAnswer: question,
        lessonStartedAt: Date.now(),
      })

      expect(result.feedback).toBeNull()
      expect(result.cursorUpdate).toBeNull()
      expect(result.teacherInput).toBeNull()
      expect(result.deterministicTeacherText).toContain(`"${expectedAnswer}"`)
      expect(result.deterministicTeacherText).toContain('My ___ is photography.')

      const state = await exerciseEngine.getState(lessonId)
      expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
      expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
    }
  })

  it('answers ASR-confused word-help for the current item after a wrong attempt', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-current-item-word-help-after-wrong'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'hobby',
      lessonStartedAt: Date.now(),
    })
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Free training. Free try free time.',
      lessonStartedAt: Date.now(),
    })
    const stateBeforeHelp = await exerciseEngine.getState(lessonId)
    const attemptsBeforeHelp = stateBeforeHelp?.currentExerciseState?.stepAttempts.length ?? 0

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: "Which world is it? Which world is it? I don't know.",
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"spare time"')
    expect(result.deterministicTeacherText).toContain('What do you do in your ___?')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(1)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)
  })

  it('routes paid voice current-answer help before the WebSocket off-topic guard', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../../ws/lesson-ws.ts', import.meta.url), 'utf8')
    const helpRouteIndex = source.indexOf('isCurrentAnswerHelpRequest(text)')
    const offTopicIndex = source.indexOf('if (looksLikeOffTopicRequest(text))')

    expect(helpRouteIndex).toBeGreaterThan(-1)
    expect(offTopicIndex).toBeGreaterThan(-1)
    expect(helpRouteIndex).toBeLessThan(offTopicIndex)
    expect(source.slice(helpRouteIndex, offTopicIndex)).toContain('handleVoiceAnswer')
    expect(source.slice(helpRouteIndex, offTopicIndex)).toContain('currentAnswerHelp: true')
  })

  it('sends deterministic orchestrator text on the typed exercise-answer path', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../../ws/lesson-ws.ts', import.meta.url), 'utf8')
    const handlerIndex = source.indexOf('async function handleEngineExerciseAnswer')
    const teacherInputIndex = source.indexOf('if (orchResult.teacherInput)', handlerIndex)
    const deterministicIndex = source.indexOf('if (orchResult.deterministicTeacherText)', handlerIndex)

    expect(handlerIndex).toBeGreaterThan(-1)
    expect(deterministicIndex).toBeGreaterThan(handlerIndex)
    expect(teacherInputIndex).toBeGreaterThan(deterministicIndex)
    expect(source.slice(deterministicIndex, teacherInputIndex)).toContain("type: 'ai_text'")
    expect(source.slice(deterministicIndex, teacherInputIndex)).toContain('ttsStream')
  })

  it('keeps AI-routed side questions locked to the exercises phase', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(new URL('../../ws/lesson-ws.ts', import.meta.url), 'utf8')
    const handlerIndex = source.indexOf('async function handleEngineExerciseAnswer')
    const teacherInputIndex = source.indexOf('if (orchResult.teacherInput)', handlerIndex)
    const processInputIndex = source.indexOf('await processInput(ws, meta, orchResult.teacherInput, false, true)', teacherInputIndex)

    expect(handlerIndex).toBeGreaterThan(-1)
    expect(teacherInputIndex).toBeGreaterThan(handlerIndex)
    expect(processInputIndex).toBeGreaterThan(teacherInputIndex)
    expect(source.slice(teacherInputIndex, processInputIndex)).toContain('await forcePhaseToExercises(lessonId)')
  })

  it('blocks previous paid voice transcripts from repopulating the next mic input', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync(
      new URL('../../../../frontend/src/features/classroom/components/ClassroomLayout.tsx', import.meta.url),
      'utf8',
    )
    const transcriptCaseIndex = source.indexOf("case 'transcript'")
    const micStartIndex = source.indexOf("send({ type: 'mic_start'", transcriptCaseIndex)

    expect(transcriptCaseIndex).toBeGreaterThan(-1)
    expect(micStartIndex).toBeGreaterThan(transcriptCaseIndex)
    expect(source).toContain('previousVoiceTranscriptRef')
    expect(source).toContain('previousTranscriptBlockUntilRef')
    expect(source.slice(transcriptCaseIndex, micStartIndex)).toContain('normalizedTranscript === normalizedPrevious')
    expect(source.slice(micStartIndex - 500, micStartIndex)).toContain('previousTranscriptBlockUntilRef.current = Date.now() + 4000')
  })

  it('uses the current expected answer for unknown RU/UA word-help fallback in gap-fill', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-ua-current-answer-help'

    await exerciseEngine.init(lessonId, '1.1')

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u042f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438 \u0445\u043e\u0431\u0456 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u043e\u044e?',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"hobby"')
    expect(result.deterministicTeacherText).toContain('My ___ is photography.')
    expect(result.deterministicTeacherText).not.toContain("I'm not sure about that exact word")

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
  })

  it('answers Ukrainian free-time translation with the current item phrase instead of an English-only warning', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-ua-free-time-current-item'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'hobby',
      lessonStartedAt: Date.now(),
    })
    const stateBeforeHelp = await exerciseEngine.getState(lessonId)
    const attemptsBeforeHelp = stateBeforeHelp?.currentExerciseState?.stepAttempts.length ?? 0

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0422\u0430\u043a, \u0430\u043b\u0435 \u044f \u043f\u0438\u0442\u0430\u044e, \u044f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438, \u0432\u0456\u043b\u044c\u043d\u0438\u0439 \u0447\u0430\u0441 \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456.',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"spare time"')
    expect(result.deterministicTeacherText).toContain('What do you do in your ___?')
    expect(result.deterministicTeacherText).not.toContain("I can see you're writing")

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(1)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)
  })

  it('answers Ukrainian gym-strength translation with get fit on the current item', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-ua-get-fit-current-item'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'hobby',
      lessonStartedAt: Date.now(),
    })
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'spare time',
      lessonStartedAt: Date.now(),
    })
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'keen on',
      lessonStartedAt: Date.now(),
    })
    const stateBeforeHelp = await exerciseEngine.getState(lessonId)
    const attemptsBeforeHelp = stateBeforeHelp?.currentExerciseState?.stepAttempts.length ?? 0

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u042f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438 \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456, \u0449\u043e \u0441\u0442\u0430\u0454 \u0441\u0438\u043b\u044c\u043d\u0456\u0448\u0438\u043c, \u043a\u0430\u0447\u0430\u0454\u0442\u044c\u0441\u044f.',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"get fit"')
    expect(result.deterministicTeacherText).toContain('I joined a gym to ___.')
    expect(result.deterministicTeacherText).not.toContain("I can see you're writing")

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(3)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)
  })

  it('answers an explicit Ukrainian translation question instead of guessing the current item', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-ua-homework-explicit-translation'

    await exerciseEngine.init(lessonId, '1.1')
    for (const answer of ['hobby', 'spare time', 'keen on', 'get fit']) {
      await orchestrator.handleStudentAnswer({
        lessonId,
        userId: 'user-1',
        sessionId: 'session-1',
        studentAnswer: answer,
        lessonStartedAt: Date.now(),
      })
    }
    const stateBeforeHelp = await exerciseEngine.getState(lessonId)
    const attemptsBeforeHelp = stateBeforeHelp?.currentExerciseState?.stepAttempts.length ?? 0

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438 \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456 \u0434\u043e\u043c\u0430\u0448\u043d\u044f \u0440\u043e\u0431\u043e\u0442\u0430?',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"homework"')
    expect(result.deterministicTeacherText).toContain('Do you usually have much homework?')
    expect(result.deterministicTeacherText).not.toContain('The word here is "free time"')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(4)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)

    const followupAnswer = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Yes, every day.',
      lessonStartedAt: Date.now(),
    })

    expect(followupAnswer.feedback).toBeNull()
    expect(followupAnswer.cursorUpdate).toBeNull()
    expect(followupAnswer.teacherInput).toBeNull()
    expect(followupAnswer.deterministicTeacherText).toContain('I love reading in my ___.')

    const stateAfterFollowup = await exerciseEngine.getState(lessonId)
    expect(stateAfterFollowup?.currentExerciseState?.currentStepIndex).toBe(4)
    expect(stateAfterFollowup?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)
  })

  it('answers known mid-exercise translation questions deterministically without grading', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-unknown-side-question-ai'

    await exerciseEngine.init(lessonId, '1.1')
    const stateBeforeHelp = await exerciseEngine.getState(lessonId)
    const attemptsBeforeHelp = stateBeforeHelp?.currentExerciseState?.stepAttempts.length ?? 0

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438 \u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456?',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"\u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c" in English is "ship"')
    expect(result.deterministicTeacherText).not.toContain('My ___ is photography.')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)

    const followupAnswer = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'No, never.',
      lessonStartedAt: Date.now(),
    })

    expect(followupAnswer.feedback).toBeNull()
    expect(followupAnswer.cursorUpdate).toBeNull()
    expect(followupAnswer.teacherInput).toBeNull()
    expect(followupAnswer.deterministicTeacherText).toContain('My ___ is photography.')

    const stateAfterFollowup = await exerciseEngine.getState(lessonId)
    expect(stateAfterFollowup?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(stateAfterFollowup?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)
  })

  it('routes standalone Cyrillic lookup words to side-question help instead of grading', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-bare-cyrillic-side-question'

    await exerciseEngine.init(lessonId, '1.1')
    const stateBeforeHelp = await exerciseEngine.getState(lessonId)
    const attemptsBeforeHelp = stateBeforeHelp?.currentExerciseState?.stepAttempts.length ?? 0

    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"\u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c" in English is "ship"')
    expect(result.deterministicTeacherText).not.toContain('My ___ is photography.')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(attemptsBeforeHelp)
  })

  it('does not grade conversational Ukrainian lookup forms from the live transcript', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-live-ua-side-question'

    await exerciseEngine.init(lessonId, '1.1')

    const appleQuestion = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u044f\u0431\u043b\u0443\u043a\u043e? \u041d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456?',
      lessonStartedAt: Date.now(),
    })

    expect(appleQuestion.feedback).toBeNull()
    expect(appleQuestion.cursorUpdate).toBeNull()
    expect(appleQuestion.teacherInput ?? '').toContain('[SIDE QUESTION DURING CURRENT ITEM]')
    expect(appleQuestion.teacherInput ?? '').toContain('\u044f\u0431\u043b\u0443\u043a\u043e')
    expect(appleQuestion.teacherInput ?? '').toContain('Do NOT grade this as the exercise answer')

    const bedQuestion = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u042f\u043a \u0437\u0430 \u0442\u0438? \u041b\u0456\u0436\u043a\u043e \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456.',
      lessonStartedAt: Date.now(),
    })

    expect(bedQuestion.feedback).toBeNull()
    expect(bedQuestion.cursorUpdate).toBeNull()
    expect(bedQuestion.teacherInput ?? '').toContain('[SIDE QUESTION DURING CURRENT ITEM]')
    expect((bedQuestion.teacherInput ?? '').toLowerCase()).toContain('\u043b\u0456\u0436\u043a\u043e')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
  })

  it('answers known English lookup questions deterministically instead of grading', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-english-side-question-ai'

    await exerciseEngine.init(lessonId, '1.1')
    const result = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'What does ship mean?',
      lessonStartedAt: Date.now(),
    })

    expect(result.feedback).toBeNull()
    expect(result.cursorUpdate).toBeNull()
    expect(result.teacherInput).toBeNull()
    expect(result.deterministicTeacherText).toContain('"Ship" means: a large boat used to travel on water')
    expect(result.deterministicTeacherText).not.toContain('My ___ is photography.')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
  })

  it('grades the current answer after a side-question instead of swallowing it as follow-up', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-side-question-then-current-answer'

    await exerciseEngine.init(lessonId, '1.1')
    const sideQuestion = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'What does ship mean?',
      lessonStartedAt: Date.now(),
    })
    expect(sideQuestion.feedback).toBeNull()
    expect(sideQuestion.cursorUpdate).toBeNull()

    const answer = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'hobby',
      lessonStartedAt: Date.now(),
    })

    expect(answer.feedback?.correct).toBe(true)
    expect(answer.cursorUpdate?.itemIndex).toBe(1)
    expect(answer.cursorUpdate?.currentItem).toBe('What do you do in your ___?')
    expect(answer.deterministicTeacherText).toContain('"hobby" fits perfectly')
    expect(answer.deterministicTeacherText).not.toContain("return to the question")
  })

  it('lets a new side question replace a pending side-question follow-up', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-side-question-replaced'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438 \u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456?',
      lessonStartedAt: Date.now(),
    })

    const nextQuestion = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u0441\u043a\u0430\u0437\u0430\u0442\u0438 \u0434\u043e\u043c\u0430\u0448\u043d\u044f \u0440\u043e\u0431\u043e\u0442\u0430?',
      lessonStartedAt: Date.now(),
    })

    expect(nextQuestion.feedback).toBeNull()
    expect(nextQuestion.cursorUpdate).toBeNull()
    expect(nextQuestion.teacherInput).toBeNull()
    expect(nextQuestion.deterministicTeacherText).toContain('"homework"')
    expect(nextQuestion.deterministicTeacherText).not.toContain('My ___ is photography.')
  })

  it('lets live conversational lookup replace a pending side-question follow-up', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-live-side-question-replaced'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u044f\u0431\u043b\u0443\u043a\u043e? \u041d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456?',
      lessonStartedAt: Date.now(),
    })

    const replacement = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u042f\u043a \u0437\u0430 \u0442\u0438? \u041b\u0456\u0436\u043a\u043e \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456.',
      lessonStartedAt: Date.now(),
    })

    expect(replacement.feedback).toBeNull()
    expect(replacement.cursorUpdate).toBeNull()
    expect(replacement.deterministicTeacherText).toBeUndefined()
    expect(replacement.teacherInput ?? '').toContain('[SIDE QUESTION DURING CURRENT ITEM]')
    expect((replacement.teacherInput ?? '').toLowerCase()).toContain('\u043b\u0456\u0436\u043a\u043e')
    expect(replacement.teacherInput ?? '').toContain('Do NOT grade this as the exercise answer')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
  })

  it('lets a standalone Cyrillic lookup replace a pending side-question follow-up', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-standalone-side-question-replaced'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u0410 \u044f\u043a \u044f\u0431\u043b\u0443\u043a\u043e? \u041d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456?',
      lessonStartedAt: Date.now(),
    })
    await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u042f\u043a \u0437\u0430 \u0442\u0438? \u041b\u0456\u0436\u043a\u043e \u043d\u0430 \u0430\u043d\u0433\u043b\u0456\u0439\u0441\u044c\u043a\u0456\u0439 \u043c\u043e\u0432\u0456.',
      lessonStartedAt: Date.now(),
    })

    const replacement = await orchestrator.handleStudentAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: '\u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c',
      lessonStartedAt: Date.now(),
    })

    expect(replacement.feedback).toBeNull()
    expect(replacement.cursorUpdate).toBeNull()
    expect(replacement.teacherInput).toBeNull()
    expect(replacement.deterministicTeacherText).toContain('"\u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c" in English is "ship"')
    expect(replacement.deterministicTeacherText).not.toContain('My ___ is photography.')

    const state = await exerciseEngine.getState(lessonId)
    expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
    expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
  })

  it('keeps exercise authority after repeated wrong answers and advances keen on to the gym item deterministically', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-1'

    await exerciseEngine.init(lessonId, '1.1')

    await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Hobby',
      lessonStartedAt: Date.now(),
    })
    await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Spare time',
      lessonStartedAt: Date.now(),
    })
    const wrongKeenA = await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Like',
      lessonStartedAt: Date.now(),
    })
    expect(wrongKeenA?.feedback?.correct).toBe(false)
    expect(wrongKeenA?.deterministicTeacherText).toContain('Try again - She\'s really ___ dancing.')

    const wrongKeenB = await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Enjoy',
      lessonStartedAt: Date.now(),
    })
    expect(wrongKeenB?.feedback?.correct).toBe(false)
    expect(wrongKeenB?.deterministicTeacherText).toBe('It is a 2-word phrase: keen __. Try again - She\'s really ___ dancing.')

    await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Enjoy.',
      lessonStartedAt: Date.now(),
    })

    const result = await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Keen on.',
      lessonStartedAt: Date.now(),
    })

    expect(result?.feedback?.correct).toBe(true)
    expect(result?.cursorUpdate?.currentItem).toBe('I joined a gym to ___.')
    expect(result?.deterministicTeacherText).toContain('I joined a gym to ___.')
    expect(result?.deterministicTeacherText).not.toContain('Try once more')
    expect(result?.deterministicTeacherText).not.toContain('stay on this item')
  })

  it('accepts one-turn self-correction and acknowledges it naturally', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-self-correct'

    await exerciseEngine.init(lessonId, '1.1')
    await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Hobby',
      lessonStartedAt: Date.now(),
    })
    await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'Spare time',
      lessonStartedAt: Date.now(),
    })

    const result = await orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer: 'keen on',
      lessonStartedAt: Date.now(),
      voiceNormalizationReason: 'self_corrected_to_expected_answer_tail',
      rawStudentAnswer: 'like keen on',
    })

    expect(result?.feedback?.correct).toBe(true)
    expect(result?.cursorUpdate?.currentItem).toBe('I joined a gym to ___.')
    expect(result?.deterministicTeacherText).toContain('You corrected it to "keen on" yourself - good.')
    expect(result?.deterministicTeacherText).toContain('I joined a gym to ___.')
  })

  it('uses natural deterministic confirmations and a warm bridge into vocabulary speaking', async () => {
    const { exerciseEngine } = await import('../../engine/exercise-engine.js')
    const { MasterLessonOrchestrator } = await import('../master-orchestrator.js')
    const orchestrator = new MasterLessonOrchestrator()
    const lessonId = 'paid-vocab-flow-bridge'
    const submit = (studentAnswer: string) => orchestrator.handleVoiceAnswer({
      lessonId,
      userId: 'user-1',
      sessionId: 'session-1',
      studentAnswer,
      lessonStartedAt: Date.now(),
    })

    await exerciseEngine.init(lessonId, '1.1')

    const firstCorrect = await submit('Hobby')
    expect(firstCorrect?.deterministicTeacherText).toContain('What do you do in your ___?')
    expect(firstCorrect?.deterministicTeacherText).toContain('"hobby" fits perfectly')
    expect(firstCorrect?.deterministicTeacherText).not.toMatch(/^(Right|Good|Yes|Exactly)\. (Next|Now|Let's continue):/)

    await submit('Spare time')
    await submit('Keen on')
    await submit('Take up')
    await submit('Give up')
    await submit('Get fit')
    const transition = await submit('Free time')

    expect(transition?.feedback?.correct).toBe(true)
    expect(transition?.cursorUpdate?.exerciseNumber).toBe(2)
    expect(transition?.deterministicTeacherText).toContain('Nice, vocabulary is done.')
    expect(transition?.deterministicTeacherText).toContain('Now let\'s use it in a real opinion:')
    expect(transition?.deterministicTeacherText).toContain('Do you think free time is more important than school time?')
    expect(transition?.deterministicTeacherText).toContain('Start like this: "I think ... because ..."')
    expect(transition?.deterministicTeacherText).not.toContain('Next:')
  })

  it('builds vocabulary Exercise 2 as a tutor-like speaking prompt', async () => {
    const { tryBuildAutoManifest } = await import('../auto-section-manifest-builder.js')
    const manifest = tryBuildAutoManifest('1.1')
    const speaking = manifest?.exercises.find(ex => ex.num === 2)

    expect(speaking?.runtimeMode).toBe('soft_speaking')
    expect(speaking?.instruction).toBe(
      'Do you think free time is more important than school time? Give two reasons. Start like this: "I think ... because ..."',
    )
  })
})
