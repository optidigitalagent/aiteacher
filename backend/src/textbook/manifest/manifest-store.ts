// ── Manifest Store ─────────────────────────────────────────────────────────────
// Persists SectionExerciseManifest to backend/data/manifests/{sectionId}.json
// and loads them back at runtime. Used by section-manifest.ts as a JSON overlay.

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { SectionExerciseManifest } from '../../lesson/section-manifest.js'

const __filename    = fileURLToPath(import.meta.url)
const __dirname     = path.dirname(__filename)
const MANIFESTS_DIR = path.resolve(__dirname, '../../../data/manifests')

// ── Write ─────────────────────────────────────────────────────────────────────

export function saveManifest(manifest: SectionExerciseManifest): string {
  ensureDir()
  const filepath = manifestPath(manifest.section)
  fs.writeFileSync(filepath, JSON.stringify(manifest, null, 2), 'utf-8')
  return filepath
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function loadManifest(sectionId: string): SectionExerciseManifest | null {
  const filepath = manifestPath(sectionId)
  if (!fs.existsSync(filepath)) return null

  try {
    const raw = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(raw) as SectionExerciseManifest
  } catch (err) {
    console.warn(`[manifest-store] Failed to parse ${filepath}:`, err)
    return null
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export function listStoredManifests(): string[] {
  if (!fs.existsSync(MANIFESTS_DIR)) return []

  return fs
    .readdirSync(MANIFESTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', '').replace(/_/g, '.'))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function manifestPath(sectionId: string): string {
  const filename = sectionId.replace(/\./g, '_') + '.json'
  return path.join(MANIFESTS_DIR, filename)
}

function ensureDir(): void {
  if (!fs.existsSync(MANIFESTS_DIR)) {
    fs.mkdirSync(MANIFESTS_DIR, { recursive: true })
  }
}
