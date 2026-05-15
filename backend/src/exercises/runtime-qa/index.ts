// Exercise Runtime QA Matrix — barrel export
// Import this module to access all QA scenarios, regression matrix, and the runner.

export * from './qa-types.js'

// Scenario collections
export { ALL_DETERMINISTIC_SCENARIOS } from './deterministic.qa.js'
export { ALL_MATCHING_SCENARIOS } from './matching.qa.js'
export { ALL_SPEAKING_SCENARIOS } from './speaking.qa.js'
export { ALL_GRAMMAR_FOCUS_SCENARIOS } from './grammar-focus.qa.js'
export { ALL_UNSUPPORTED_SCENARIOS } from './unsupported.qa.js'
export { ALL_RECONNECT_SCENARIOS } from './reconnect-resume.qa.js'
export { ALL_CORRECTION_LADDER_SCENARIOS } from './correction-ladder.qa.js'
export { ALL_OFF_TOPIC_SCENARIOS } from './off-topic.qa.js'
export { ALL_DOWNGRADE_SCENARIOS } from './downgrade.qa.js'

// Regression matrix
export {
  REGRESSION_MATRIX,
  GLOBAL_FORBIDDEN_REGRESSIONS,
  getRegressionEntry,
  getAllForbiddenRegressionsFor,
} from './regression-matrix.js'

// Runner
export { runAllQA } from './qa-runner.js'
