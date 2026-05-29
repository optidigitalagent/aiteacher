// Phase 7: Kids Brain Runtime Orchestrator

// Types
export type { RuntimeActionPacket, KidsBrainTurnInput, KidsBrainSilenceInput, KidsBrainSessionStartInput } from './runtime-types.js';
export { RuntimeActionPacketType } from './runtime-types.js';

// Result types
export type { RuntimeTurnResult, RuntimeSessionStartResult, RuntimeEndResult } from './runtime-result.js';

// Context helpers
export {
  derivePromptType,
  buildActivityContext,
  buildPromptContext,
  buildChildStateSnapshot,
  buildCurrentItemContext,
  buildAvailableItems,
  buildAvailableActivities,
  deriveScaffoldLevel,
  buildTeacherResponseContext,
} from './runtime-context.js';

// Logger
export { buildRuntimeLog } from './runtime-logger.js';

// Session bootstrap
export { startKidsBrainSession } from './session-bootstrap.js';

// Turn processing
export { processKidsBrainTurn } from './turn-processor.js';

// Silence processing
export { processKidsBrainSilence } from './silence-processor.js';

// Orchestrator (includes endKidsBrainSession)
export { endKidsBrainSession } from './kids-brain-orchestrator.js';
