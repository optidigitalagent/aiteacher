// Textbook Parser System — public exports
export { runTextbookParsePipeline } from './pipeline.js'

export {
  loadManifest,
  saveManifest,
  listStoredManifests,
} from './manifest/manifest-store.js'

export { validateManifest }    from './manifest/manifest-validator.js'
export { buildManifest }       from './manifest/manifest-builder.js'
export { classifyExerciseType } from './classifiers/exercise-type-classifier.js'
export { extractExercises }    from './extractor/exercise-extractor.js'
export { extractAnswerKey }    from './extractor/answer-extractor.js'

export type {
  ParsePipelineConfig,
  ParsePipelineResult,
  ParsedSection,
  ParsedExercise,
  ParsedItem,
  ManifestBuildResult,
  DetectedExerciseType,
  TypeDetectionResult,
  TeacherBookAnswerKey,
} from './types.js'
