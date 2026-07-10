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
    expect(wrongKeenB?.deterministicTeacherText).toBe('The answer has 2 words and starts with "keen". Try again - She\'s really ___ dancing.')

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
})
