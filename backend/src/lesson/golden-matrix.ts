// ── Golden Matrix Analyzer ─────────────────────────────────────────────────────
// Classifies every Focus 2 section as GOLD | SILVER | BLOCKED for MVP curation.
//
// GOLD:    Production-ready. At least one deterministic exercise with real answers.
//          Stable manifest. Coherent pedagogy. Recommended for MVP onboarding.
// SILVER:  Functionally safe but pedagogically thin. Only soft-speaking exercises
//          (grammar-focus explanation + discussion). No fill/drill items.
// BLOCKED: Unsafe for paid lesson. No manifest, audio-only, empty engine queue.
//
// Classification rules:
//   GOLD   = canStartPaidLesson + executableCount >= 1 + deterministicCount >= 1
//   SILVER = canStartPaidLesson + executableCount >= 1 + deterministicCount === 0
//   BLOCKED = !canStartPaidLesson OR executableCount === 0 OR no manifest

import { FOCUS2_CATALOG, type SectionCatalogEntry } from './curriculum-catalog.js'
import { getSectionRuntimeStatus }                   from './section-registry.js'
import { getManifestForSection }                     from './section-manifest.js'
import { tryBuildAutoManifest }                      from './auto-section-manifest-builder.js'

export type GoldenTier = 'GOLD' | 'SILVER' | 'BLOCKED'

export interface GoldenMatrixEntry {
  sectionId:          string
  unit:               number
  title:              string
  topic:              string
  goldenStatus:       GoldenTier
  manifestSource:     'explicit' | 'auto-built' | 'none'
  executableCount:    number
  deterministicCount: number
  softSpeakingCount:  number
  skippedCount:       number
  exerciseTypes:      string[]
  recommendedForMVP:  boolean
  blockedReasons:     string[]
  stabilityNotes:     string
}

// Exercise types that are deterministic — backend validates answer, not AI improvisation.
// These produce fill/drill/matching exercises with specific correct answers.
const DETERMINISTIC_TYPES = new Set([
  'fill_gap',
  'grammar_focus_fill',
  'grammar_fill',
  'grammar_drill',
  'read_and_answer',
  'phrase_classification',
  'vocabulary_fill_gap',
  'collocations_fill',
  'matching',
  'find_opposites',
  'choose_from_box',
  'read_and_write_names',
  'gapped_text',
  'personal_fill',
])

let _cache: Map<string, GoldenMatrixEntry> | null = null

// ── Public API ────────────────────────────────────────────────────────────────

export function getGoldenMatrix(): Map<string, GoldenMatrixEntry> {
  if (_cache) return _cache
  _cache = new Map()
  for (const catalog of FOCUS2_CATALOG) {
    const entry = analyzeSection(catalog)
    _cache.set(catalog.sectionId, entry)
    console.log(
      `[golden_matrix] section=${catalog.sectionId} status=${entry.goldenStatus}` +
      ` executable=${entry.executableCount} deterministic=${entry.deterministicCount}` +
      ` source=${entry.manifestSource}` +
      (entry.blockedReasons.length ? ` reason="${entry.blockedReasons[0]}"` : ''),
    )
  }
  return _cache
}

export function getGoldenEntry(sectionId: string): GoldenMatrixEntry | null {
  return getGoldenMatrix().get(sectionId) ?? null
}

export function listGoldenEntries(): GoldenMatrixEntry[] {
  return Array.from(getGoldenMatrix().values())
}

export function getMvpRecommendedSections(): GoldenMatrixEntry[] {
  return listGoldenEntries().filter(e => e.recommendedForMVP)
}

export function getGoldenSummary(): {
  total: number
  gold:  number
  silver: number
  blocked: number
  mvpRecommended: string[]
  blockedSections: Array<{ sectionId: string; reasons: string[] }>
} {
  const all     = listGoldenEntries()
  const gold    = all.filter(e => e.goldenStatus === 'GOLD')
  const silver  = all.filter(e => e.goldenStatus === 'SILVER')
  const blocked = all.filter(e => e.goldenStatus === 'BLOCKED')
  return {
    total:           all.length,
    gold:            gold.length,
    silver:          silver.length,
    blocked:         blocked.length,
    mvpRecommended:  gold.map(e => e.sectionId),
    blockedSections: blocked.map(e => ({ sectionId: e.sectionId, reasons: e.blockedReasons })),
  }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function analyzeSection(catalog: SectionCatalogEntry): GoldenMatrixEntry {
  const sectionId = catalog.sectionId
  const status    = getSectionRuntimeStatus(sectionId)

  if (!status.canStartPaidLesson) {
    const reason = status.reason || `Runtime status: ${status.status}`
    return makeBlocked(catalog, [reason], `Blocked by registry (${status.status}).`)
  }

  const explicit = getManifestForSection(sectionId)
  const manifest = explicit ?? tryBuildAutoManifest(sectionId)

  if (!manifest || manifest.exercises.length === 0) {
    return makeBlocked(catalog, ['No exercise manifest — engine queue would be empty.'], 'No manifest.')
  }

  const source        = explicit ? 'explicit' : 'auto-built'
  const executable    = manifest.exercises.filter(e => e.executable)
  const skipped       = manifest.exercises.filter(e => !e.executable)
  const deterministic = executable.filter(e => DETERMINISTIC_TYPES.has(e.type))
  const softSpeaking  = executable.filter(e => !DETERMINISTIC_TYPES.has(e.type))
  const exerciseTypes = [...new Set(manifest.exercises.map(e => e.type))]

  if (executable.length === 0) {
    return makeBlocked(
      catalog,
      ['All exercises require unsupported features (audio/media).'],
      'Zero executable exercises.',
      source, skipped.length, exerciseTypes,
    )
  }

  const tier: GoldenTier = deterministic.length > 0 ? 'GOLD' : 'SILVER'

  return {
    sectionId,
    unit:               catalog.unit,
    title:              catalog.sectionTitle,
    topic:              catalog.topic,
    goldenStatus:       tier,
    manifestSource:     source,
    executableCount:    executable.length,
    deterministicCount: deterministic.length,
    softSpeakingCount:  softSpeaking.length,
    skippedCount:       skipped.length,
    exerciseTypes,
    recommendedForMVP:  tier === 'GOLD',
    blockedReasons:     [],
    stabilityNotes:     buildNotes(tier, source, deterministic.length, softSpeaking.length, skipped.length),
  }
}

function makeBlocked(
  catalog:        SectionCatalogEntry,
  reasons:        string[],
  stabilityNotes: string,
  manifestSource: 'explicit' | 'auto-built' | 'none' = 'none',
  skippedCount    = 0,
  exerciseTypes:  string[] = [],
): GoldenMatrixEntry {
  return {
    sectionId:          catalog.sectionId,
    unit:               catalog.unit,
    title:              catalog.sectionTitle,
    topic:              catalog.topic,
    goldenStatus:       'BLOCKED',
    manifestSource,
    executableCount:    0,
    deterministicCount: 0,
    softSpeakingCount:  0,
    skippedCount,
    exerciseTypes,
    recommendedForMVP:  false,
    blockedReasons:     reasons,
    stabilityNotes,
  }
}

function buildNotes(
  tier:               GoldenTier,
  source:             'explicit' | 'auto-built',
  deterministicCount: number,
  softSpeakingCount:  number,
  skippedCount:       number,
): string {
  if (tier === 'GOLD') {
    const parts: string[] = []
    if (source === 'explicit')       parts.push('explicit manifest')
    if (deterministicCount >= 2)     parts.push(`${deterministicCount} deterministic exercises`)
    else                             parts.push(`${deterministicCount} deterministic exercise`)
    if (softSpeakingCount > 0)       parts.push(`${softSpeakingCount} discussion`)
    if (skippedCount > 0)            parts.push(`${skippedCount} audio exercises skipped`)
    return parts.join('; ')
  }
  return `${softSpeakingCount} soft-speaking exercise${softSpeakingCount !== 1 ? 's' : ''} only — no fill/drill items.`
}
