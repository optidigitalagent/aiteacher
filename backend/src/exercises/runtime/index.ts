// Exercise Runtime Protocols — public API

export type {
  ExerciseProtocol,
  ProgressionContext,
  ValidationSignal,
  ProtocolDirective,
} from './protocol-types.js'

export { deterministicProtocol } from './deterministic.protocol.js'
export { matchingProtocol }      from './matching.protocol.js'
export { speakingProtocol }      from './speaking.protocol.js'
export { grammarFocusProtocol }  from './grammar-focus.protocol.js'
export { unsupportedProtocol }   from './unsupported.protocol.js'

export {
  selectProtocol,
  shouldLockProgression,
  useSoftFeedback,
  buildProtocolCorrection,
  buildProtocolOffTopicRecovery,
} from './protocol-runner.js'
