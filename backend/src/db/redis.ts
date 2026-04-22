import Redis from 'ioredis'
import 'dotenv/config'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
})

redis.on('error', (err: Error) => {
  console.error('[redis] error:', err.message)
})

redis.on('ready', () => {
  console.log('[redis] connected')
})

export const LESSON_TTL = 14_400 // 4 hours

export function lessonStateKey(lessonId: string): string {
  return `lesson:${lessonId}:state`
}

export function lessonContextKey(lessonId: string): string {
  return `lesson:${lessonId}:context`
}

export function lessonExercisesKey(lessonId: string): string {
  return `lesson:${lessonId}:exercises`
}

export function lessonErrorsKey(lessonId: string): string {
  return `lesson:${lessonId}:errors`
}

export function activeSessionKey(studentId: string): string {
  return `session:${studentId}:active`
}

export async function checkConnection(): Promise<void> {
  await redis.connect()
  await redis.ping()
  console.log('[redis] ping OK')
}

export default redis
