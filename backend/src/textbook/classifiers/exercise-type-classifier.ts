// ── Exercise Type Classifier ───────────────────────────────────────────────────
// Classifies exercise type from instruction text using deterministic patterns.
// No AI. Order matters: more specific patterns come first.

import type { DetectedExerciseType, TypeDetectionResult } from '../types.js'

interface ClassifierRule {
  type: DetectedExerciseType
  confidence: 'high' | 'medium' | 'low'
  pattern: RegExp
}

// Rules are evaluated top-to-bottom; first match wins.
const CLASSIFIER_RULES: ClassifierRule[] = [
  // ── Listening-based — must come first to override fill/complete patterns ──
  { type: 'listening_matching',    confidence: 'high',   pattern: /listen\s+and\s+match|match\s+.{0,60}then\s+listen/i },
  { type: 'listening_gap',         confidence: 'high',   pattern: /listen\s+and\s+(complete|fill|check)|complete\s+.{0,60}then\s+listen/i },
  { type: 'pronunciation_practice',confidence: 'high',   pattern: /say\s+these\s+(words?|sounds?)|listen\s+and\s+repeat|practise\s+saying|pronounce\s+the/i },
  { type: 'audio_based',           confidence: 'high',   pattern: /^listen\b/i },

  // ── Grammar focus — must come before generic fill patterns ──
  { type: 'grammar_focus_fill',    confidence: 'high',   pattern: /grammar\s+focus|complete\s+the\s+examples|look\s+at\s+the\s+grammar\s+box/i },

  // ── Sentence transformation ──
  { type: 'sentence_transformation', confidence: 'high', pattern: /rewrite\s+the|transform\s+the|complete\s+the\s+second\s+sentence|use\s+the\s+word\s+in\s+brackets/i },

  // ── Grammar drill ──
  { type: 'grammar_drill',         confidence: 'high',   pattern: /complete\s+the\s+questions?\s+(about|for|on)|write\s+(the\s+)?questions?|form\s+questions?/i },
  { type: 'grammar_drill',         confidence: 'medium', pattern: /make\s+(questions?|sentences?)\s+about|complete\s+the\s+questions?/i },

  // ── Fill in the gap ──
  { type: 'fill_in_the_gap',       confidence: 'high',   pattern: /fill\s+in\s+the\s+(gaps?|blanks?)|complete\s+the\s+(text|sentences?|gaps?)\s+with\b|put\s+the\s+(correct\s+)?words?\s+in/i },
  { type: 'fill_in_the_gap',       confidence: 'medium', pattern: /complete\s+the\s+(sentences?|gaps?|text)\b/i },

  // ── Matching ──
  { type: 'matching',              confidence: 'high',   pattern: /match\s+\d+|match\s+[a-h]\s*[–\-]|match\s+the\s+(words?|sentences?|questions?|phrases?)/i },
  { type: 'matching',              confidence: 'medium', pattern: /\bmatch\b/i },

  // ── Multiple choice ──
  { type: 'multiple_choice',       confidence: 'high',   pattern: /choose\s+the\s+correct|circle\s+the\s+(best|correct)|tick\s+the\s+correct|select\s+the\s+(best|correct)/i },

  // ── Translation ──
  { type: 'translation',           confidence: 'high',   pattern: /translate(\s+into\s+english)?|put\s+(these\s+)?sentences?\s+into\s+english/i },

  // ── Reading ──
  { type: 'reading_comprehension', confidence: 'high',   pattern: /read\s+the\s+(text|article|passage|story)\s+and\s+(answer|discuss|check|find|decide)/i },
  { type: 'paragraph_reading',     confidence: 'high',   pattern: /read\s+the\s+(paragraph|following|passage)\b/i },

  // ── Dialogue ──
  { type: 'dialogue_practice',     confidence: 'high',   pattern: /act\s+out\s+the\s+dialogue|practise\s+the\s+dialogue|read\s+the\s+dialogue|role[-\s]?play/i },

  // ── Pair speaking — before discussion ──
  { type: 'pair_speaking',         confidence: 'high',   pattern: /ask\s+and\s+answer|in\s+pairs[,.]\s+ask|interview\s+your\s+partner|ask\s+your\s+partner/i },

  // ── Discussion ──
  { type: 'discussion',            confidence: 'high',   pattern: /in\s+pairs[,.]\s+discuss|discuss\s+(who|what|how|whether|if|your|the)\b|talk\s+about\b/i },
  { type: 'discussion',            confidence: 'medium', pattern: /\bdiscuss\b/i },

  // ── Personal fill ──
  { type: 'personal_fill',         confidence: 'high',   pattern: /make\s+(them|the\s+sentences?)\s+true\s+for\s+you|true\s+for\s+you|complete.{0,40}about\s+yourself/i },
  { type: 'personal_fill',         confidence: 'medium', pattern: /complete\s+the\s+sentences?\s+to\s+make\b/i },

  // ── Vocabulary ──
  { type: 'vocabulary_list',       confidence: 'medium', pattern: /label\s+the\s+pictures?|complete\s+the\s+table|write\s+the\s+(words?|vocabulary)/i },
]

export function classifyExerciseType(instruction: string): TypeDetectionResult {
  for (const rule of CLASSIFIER_RULES) {
    if (rule.pattern.test(instruction)) {
      return {
        type:           rule.type,
        confidence:     rule.confidence,
        matchedPattern: rule.pattern.source,
      }
    }
  }
  return { type: 'unknown', confidence: 'low', matchedPattern: '' }
}

export function isListeningBased(type: DetectedExerciseType): boolean {
  return type === 'listening_matching' || type === 'listening_gap' || type === 'audio_based'
}

export function requiresAudio(type: DetectedExerciseType): boolean {
  return isListeningBased(type) || type === 'pronunciation_practice'
}

export function requiresPartner(type: DetectedExerciseType): boolean {
  return type === 'pair_speaking' || type === 'dialogue_practice'
}

export function requiresPhoto(instruction: string): boolean {
  return /look\s+at\s+the\s+(picture|photo|image)|describe\s+the\s+(picture|photo)/i.test(instruction)
}
