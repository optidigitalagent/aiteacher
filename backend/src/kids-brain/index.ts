// Shared enums
export * from './shared/enums.js';

// Shared constants
export * from './shared/constants.js';

// Shared errors
export * from './shared/errors.js';

// Score types and helpers
export * from './shared/score.js';

// Shared types
export * from './shared/types.js';

// Log events
export * from './shared/log-events.js';

// Contracts
export type { STTResult } from './contracts/stt-result.js';
export type { ActionPacket } from './contracts/action-packet.js';
export type { TurnRecord } from './contracts/turn-record.js';
export type { MasteryRecord } from './contracts/mastery-record.js';
export type { ChildProfile } from './contracts/child-profile.js';
export type { SessionMemory } from './contracts/session-memory.js';
export type {
  RedisSessionStore,
  PostgresProfileStore,
  SafetyEventStore,
} from './contracts/stores.js';

// State types
export type { ChildState } from './state/child-state.js';
export type { ItemState } from './state/item-state.js';
export type { SessionState } from './state/session-state.js';

// Vocabulary guard
export {
  CORE_TEACHER_VOCABULARY,
  CORE_TEACHER_VOCABULARY_SET,
  isCoreTeacherWordAllowed,
} from './teacher-response/core-teacher-vocabulary.js';
