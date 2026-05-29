export { buildSTTResult, buildSTTResultFromText } from './stt-adapter.js';
export type { SttAdapterInput } from './stt-adapter.js';
export {
  adaptRuntimePackets,
  requiresSessionClose,
} from './ws-action-adapter.js';
export type {
  AdaptedKidsMessage,
  KidsTeacherTextMessage,
  KidsStartListeningMessage,
  KidsStopListeningMessage,
  KidsSessionCompleteMessage,
  KidsSafetyCloseMessage,
} from './ws-action-adapter.js';
