// ── Textbook Parser — Core Types ──────────────────────────────────────────────
// Build-time pipeline: raw textbook text → SectionExerciseManifest JSON.
// No AI in this path. All parsing is deterministic.

import type { SectionExerciseManifest } from '../lesson/section-manifest.js'

// ── Raw document structure ────────────────────────────────────────────────────

export interface TextbookDocument {
  source: string        // file path or label
  textbook: string      // "Focus B1", "Focus A2+"
  cefrLevel: string     // "A2", "B1", "B2"
  rawText: string
}

export interface RawExerciseBlock {
  blockIndex: number
  exerciseNumber: number
  instructionRaw: string
  bodyRaw: string
  rawLines: string[]
  sourceLineStart: number
  sourceLineEnd: number
}

export interface RawSection {
  sectionId: string
  unitNumber: number
  rawText: string
  exerciseBlocks: RawExerciseBlock[]
  parseWarnings: string[]
}

// ── Detected exercise type ────────────────────────────────────────────────────

export type DetectedExerciseType =
  | 'fill_in_the_gap'
  | 'grammar_focus_fill'
  | 'grammar_drill'
  | 'sentence_transformation'
  | 'matching'
  | 'multiple_choice'
  | 'translation'
  | 'reading_comprehension'
  | 'paragraph_reading'
  | 'dialogue_practice'
  | 'discussion'
  | 'pair_speaking'
  | 'personal_fill'
  | 'listening_matching'
  | 'listening_gap'
  | 'pronunciation_practice'
  | 'audio_based'
  | 'vocabulary_list'
  | 'unknown'

export type DetectionConfidence = 'high' | 'medium' | 'low'

export interface TypeDetectionResult {
  type: DetectedExerciseType
  confidence: DetectionConfidence
  matchedPattern: string
}

// ── Parsed items ──────────────────────────────────────────────────────────────

export interface ParsedItem {
  index: number
  text: string
  correctAnswer: string   // '' for open-ended or teacher-book-required
  options?: string[]      // multiple_choice / matching right-column
  matchTarget?: string    // matching: the thing on the right being matched to
}

export interface ParsedExercise {
  exerciseNumber: number
  typeDetection: TypeDetectionResult
  instruction: string
  items: ParsedItem[]
  allowedPrompt?: string  // discussion / pair_speaking: single prompt to ask
  rawBlock: RawExerciseBlock
  parseWarnings: string[]
}

export interface ParsedSection {
  sectionId: string
  unitNumber: number
  exercises: ParsedExercise[]
  parseErrors: string[]
}

// ── Answer key (teacher book) ─────────────────────────────────────────────────

export interface TeacherBookAnswer {
  exerciseNumber: number
  itemIndex: number        // 0-based
  answer: string
  alternativeAnswers: string[]
}

export interface TeacherBookAnswerKey {
  sectionId: string
  answers: TeacherBookAnswer[]
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export interface ManifestBuildResult {
  sectionId: string
  success: boolean
  manifest: SectionExerciseManifest | null
  warnings: string[]
  errors: string[]
}

export interface ParsePipelineConfig {
  textbook: string          // "Focus B1"
  cefrLevel: string         // "B1"
  sectionId: string         // "1.2"
  unitNumber: number        // 1
  rawText: string           // raw student book text (OCR or plain)
  teacherBookText?: string  // optional teacher book text for answer overlay
}

export interface ParsePipelineResult {
  config: ParsePipelineConfig
  parsedSection: ParsedSection | null
  manifestResult: ManifestBuildResult
  parseLog: string[]
}
