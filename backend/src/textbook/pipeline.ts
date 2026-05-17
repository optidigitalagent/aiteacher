// ── Textbook Parser Pipeline ───────────────────────────────────────────────────
// Orchestrates: raw text → parsed section → manifest → validated → stored.
// This is a build-time tool. It does not run in the lesson server.

import { parseTextbookText }       from './parsers/text-parser.js'
import { extractExercises }        from './extractor/exercise-extractor.js'
import { extractAnswerKey, overlayAnswers } from './extractor/answer-extractor.js'
import { buildManifest }           from './manifest/manifest-builder.js'
import { validateManifest }        from './manifest/manifest-validator.js'
import { saveManifest }            from './manifest/manifest-store.js'
import type { ParsePipelineConfig, ParsePipelineResult, ParsedSection } from './types.js'

export async function runTextbookParsePipeline(
  config: ParsePipelineConfig,
): Promise<ParsePipelineResult> {
  const log: string[] = []
  const emit = (msg: string) => { log.push(msg); console.log(`[textbook-parser] ${msg}`) }

  emit(`Section ${config.sectionId} | ${config.textbook} ${config.cefrLevel} | Unit ${config.unitNumber}`)

  // 1. Normalize + detect exercise blocks
  const rawSection = parseTextbookText(config.rawText, {
    sectionId:  config.sectionId,
    unitNumber: config.unitNumber,
  })
  emit(`Detected ${rawSection.exerciseBlocks.length} exercise block(s)`)
  rawSection.parseWarnings.forEach(w => emit(`[WARN] ${w}`))

  // 2. Classify + extract items
  let parsedSection: ParsedSection = extractExercises(rawSection)
  emit(`Extracted ${parsedSection.exercises.length} exercise(s)`)
  parsedSection.parseErrors.forEach(e => emit(`[ERR] ${e}`))
  emitExerciseSummary(parsedSection, emit)

  // 3. Overlay teacher book answers (optional)
  if (config.teacherBookText) {
    const answerKey = extractAnswerKey(config.teacherBookText, config.sectionId)
    emit(`Teacher book: ${answerKey.answers.length} answer(s) extracted`)
    parsedSection = { ...parsedSection, exercises: overlayAnswers(parsedSection.exercises, answerKey) }
  }

  // 4. Build manifest
  const manifest = buildManifest(parsedSection)
  emit(`Manifest built: ${manifest.exercises.length} entries`)

  // 5. Validate
  const validation = validateManifest(manifest)
  validation.errors.forEach(e => emit(`[MANIFEST ERR] ${e}`))
  validation.warnings.forEach(w => emit(`[MANIFEST WARN] ${w}`))

  // 6. Persist (only if valid — or if only warnings)
  if (validation.errors.length === 0) {
    const savedPath = saveManifest(manifest)
    emit(`Saved to: ${savedPath}`)
  } else {
    emit(`Manifest NOT saved due to ${validation.errors.length} error(s)`)
  }

  return {
    config,
    parsedSection,
    manifestResult: {
      sectionId: config.sectionId,
      success:   validation.errors.length === 0,
      manifest:  validation.errors.length === 0 ? manifest : null,
      warnings:  validation.warnings,
      errors:    validation.errors,
    },
    parseLog: log,
  }
}

function emitExerciseSummary(
  section: ParsedSection,
  emit: (msg: string) => void,
): void {
  for (const ex of section.exercises) {
    const itemInfo  = ex.items.length ? ` | ${ex.items.length} items` : ''
    const typeInfo  = `${ex.typeDetection.type} (${ex.typeDetection.confidence})`
    emit(`  Ex ${ex.exerciseNumber}: ${typeInfo}${itemInfo}`)
  }
}
