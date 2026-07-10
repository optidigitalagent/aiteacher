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
      studentAnswer: 'Okay.',
      lessonStartedAt: Date.now(),
    })

    expect(ready.feedback).toBeNull()
    expect(ready.cursorUpdate).toBeNull()
    expect(ready.deterministicTeacherText).toContain('Before we start')
    expect(ready.deterministicTeacherText).toContain('free time today')

    let state = await exerciseEngine.getState(lessonId)
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
      expect(result.deterministicTeacherText).toContain('My ___ is photography.')

      const state = await exerciseEngine.getState(lessonId)
      expect(state?.currentExerciseState?.currentStepIndex).toBe(0)
      expect(state?.currentExerciseState?.stepAttempts).toHaveLength(0)
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
