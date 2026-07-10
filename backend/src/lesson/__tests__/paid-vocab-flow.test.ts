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
