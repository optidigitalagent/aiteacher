// ── Section Registry ──────────────────────────────────────────────────────────
// Canonical source of truth for section runtime availability.
// Combines: explicit manifests, auto-built manifests, catalog metadata.
//
// Status levels:
//   READY        — has executable manifest with supported exercises + visible payload
//   PARTIAL      — has some executable exercises (e.g. some skipped for audio)
//   CONTENT_ONLY — has text/content but no structured executable exercises yet
//   UNSUPPORTED  — exercises require audio/media not available in current runtime
//   MISSING      — section referenced but no usable content exists
//
// Only READY and PARTIAL sections may start a normal paid lesson exercise flow.

import { FOCUS2_CATALOG } from './curriculum-catalog.js'
import { getManifestForSection } from './section-manifest.js'
import { tryBuildAutoManifest } from './auto-section-manifest-builder.js'
import type { SectionExerciseManifest } from './section-manifest.js'

export type SectionRuntimeStatus = 'READY' | 'PARTIAL' | 'CONTENT_ONLY' | 'UNSUPPORTED' | 'MISSING'

export interface SectionStatusEntry {
  sectionId:                string
  unit:                     number
  title:                    string
  status:                   SectionRuntimeStatus
  supportedExerciseCount:   number
  unsupportedExerciseCount: number
  canStartPaidLesson:       boolean
  reason:                   string
}

// ── Cache ─────────────────────────────────────────────────────────────────────
// Computed once at startup; manifests do not change at runtime.

let _cache: Map<string, SectionStatusEntry> | null = null

function getCache(): Map<string, SectionStatusEntry> {
  if (_cache) return _cache
  _cache = new Map()
  for (const entry of FOCUS2_CATALOG) {
    const status = computeStatus(entry.sectionId)
    _cache.set(entry.sectionId, status)
    console.log(
      `[section-registry] status section=${entry.sectionId} status=${status.status} ` +
      `supported=${status.supportedExerciseCount} unsupported=${status.unsupportedExerciseCount}`,
    )
  }
  return _cache
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getSectionRuntimeStatus(sectionId: string): SectionStatusEntry {
  const normalized = normalizeSectionId(sectionId)
  const entry = getCache().get(normalized)
  if (entry) return entry
  return {
    sectionId:                normalized,
    unit:                     0,
    title:                    'Unknown',
    status:                   'MISSING',
    supportedExerciseCount:   0,
    unsupportedExerciseCount: 0,
    canStartPaidLesson:       false,
    reason:                   'Section not found in curriculum catalog.',
  }
}

export function listSectionRuntimeStatuses(): SectionStatusEntry[] {
  return Array.from(getCache().values())
}

export function canStartPaidLesson(sectionId: string): boolean {
  return getSectionRuntimeStatus(sectionId).canStartPaidLesson
}

export function getSafeSectionManifest(sectionId: string): SectionExerciseManifest | null {
  const normalized = normalizeSectionId(sectionId)
  const status = getSectionRuntimeStatus(normalized)
  if (!status.canStartPaidLesson) return null
  const explicit = getManifestForSection(normalized)
  if (explicit) return explicit
  return tryBuildAutoManifest(normalized)
}

// ── Status computation ────────────────────────────────────────────────────────

function computeStatus(sectionId: string): SectionStatusEntry {
  const catalog = FOCUS2_CATALOG.find(s => s.sectionId === sectionId)
  if (!catalog) {
    return makeEntry(sectionId, 0, 'Unknown', 'MISSING', 0, 0, 'Section not found in curriculum catalog.')
  }

  if (!catalog.enabled) {
    return makeEntry(sectionId, catalog.unit, catalog.sectionTitle, 'MISSING', 0, 0, 'Section is disabled.')
  }

  if (catalog.type === 'listening') {
    return makeEntry(sectionId, catalog.unit, catalog.sectionTitle, 'UNSUPPORTED', 0, 0,
      'This section requires audio playback which is not yet supported in the current runtime.')
  }

  if (catalog.type === 'speaking' && catalog.dataQuality === 'unavailable') {
    return makeEntry(sectionId, catalog.unit, catalog.sectionTitle, 'MISSING', 0, 0,
      'This section requires in-person speaking practice. No structured content available.')
  }

  // Try explicit manifest first, then auto-builder
  const manifest = getManifestForSection(sectionId) ?? tryBuildAutoManifest(sectionId)

  if (!manifest || manifest.exercises.length === 0) {
    console.warn(`[auto-manifest] auto_manifest_failed section="${sectionId}" reason=no_exercises_produced`)
    return makeEntry(sectionId, catalog.unit, catalog.sectionTitle, 'CONTENT_ONLY', 0, 0,
      'Content available but no structured executable exercises yet. This section cannot start a paid lesson.')
  }

  const executable   = manifest.exercises.filter(e => e.executable)
  const unsupported  = manifest.exercises.filter(e => !e.executable)

  if (executable.length === 0) {
    return makeEntry(sectionId, catalog.unit, catalog.sectionTitle, 'UNSUPPORTED',
      0, unsupported.length,
      'All exercises in this section require unsupported features (audio/media).')
  }

  const status: SectionRuntimeStatus = unsupported.length > 0 ? 'PARTIAL' : 'READY'

  return makeEntry(
    sectionId, catalog.unit, catalog.sectionTitle, status,
    executable.length, unsupported.length,
    status === 'READY'
      ? `Section ready: ${executable.length} executable exercises.`
      : `Section partially ready: ${executable.length} executable, ${unsupported.length} skipped (require audio/media).`,
  )
}

function makeEntry(
  sectionId: string,
  unit: number,
  title: string,
  status: SectionRuntimeStatus,
  supported: number,
  unsupported: number,
  reason: string,
): SectionStatusEntry {
  const canStart = status === 'READY' || status === 'PARTIAL'
  return {
    sectionId,
    unit,
    title,
    status,
    supportedExerciseCount:   supported,
    unsupportedExerciseCount: unsupported,
    canStartPaidLesson:       canStart,
    reason,
  }
}

// ── ID normalization ──────────────────────────────────────────────────────────
// Frontend sends IDs like "focus2-6.3"; registry works with canonical "6.3".

export function normalizeSectionId(sectionId: string): string {
  if (/^\d+\.\d+$/.test(sectionId)) return sectionId
  // "focus2-6.3" → "6.3"
  const m0 = sectionId.match(/^focus\d+-(\d+\.\d+)$/)
  if (m0) return m0[1]!
  // "unit-6-section-1" or "unit6-section1"
  const m1 = sectionId.match(/unit[-_]?(\d+)[-_]section[-_]?(\d+)/i)
  if (m1) return `${m1[1]}.${m1[2]}`
  // "6_1" → "6.1"
  const m2 = sectionId.match(/^(\d+)_(\d+)$/)
  if (m2) return `${m2[1]}.${m2[2]}`
  return sectionId
}
