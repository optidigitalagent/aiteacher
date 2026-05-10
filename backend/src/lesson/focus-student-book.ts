import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getCatalogEntry, type SectionCatalogEntry } from './curriculum-catalog.js'
import { getFocusUnit, type FocusUnitContent } from './focus-content.js'

export type FocusStudentBookSection = {
  type: string;
  lessonTitle?: string;
  grammarFocus?: string;
  text: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.resolve(__dirname, "../../data/focus_lessons.json");

let cache: Record<string, FocusStudentBookSection> | null = null;

function loadFocusLessons(): Record<string, FocusStudentBookSection> {
  if (cache) return cache;

  if (!fs.existsSync(DATA_PATH)) {
    console.warn("[FocusStudentBook] focus_lessons.json not found:", DATA_PATH);
    cache = {};
    return cache;
  }

  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  cache = JSON.parse(raw);

  return cache!;
}

export function getFocusStudentBookSection(
  focusLesson?: string
): FocusStudentBookSection | null {
  if (!focusLesson) return null;

  const lessons = loadFocusLessons();
  return lessons[focusLesson] || null;
}

export function buildFocusStudentBookContext(focusLesson?: string): string {
  if (!focusLesson) return "";

  const section = getFocusStudentBookSection(focusLesson);

  if (section) {
    // OCR data available — use it as the authoritative source
    return `
Student's Book real section data

Section: ${focusLesson}
Lesson type: ${section.type}

Real Student's Book content:
${section.text}

Rules:
- Use this Student's Book content as the main source for the lesson.
- Do not invent exercises.
- Do not invent lesson topics.
- Do not mention page numbers unless they are present in the data.
- If the OCR text is unclear, say that the textbook text is unclear and continue carefully.
`.trim();
  }

  // No OCR data — try to use unit-level content from focus-content.ts via catalog
  const catalogEntry = getCatalogEntry(focusLesson);
  if (catalogEntry) {
    const unitData = getFocusUnit(catalogEntry.unit);
    if (unitData) {
      console.log(`[curriculum] using_unit_fallback sectionId=${focusLesson} unit=${catalogEntry.unit} quality=structured`);
      return buildUnitFallbackContext(focusLesson, catalogEntry, unitData);
    }
  }

  // Complete fallback — no catalog data, no unit data
  console.warn(`[curriculum] section_data_unavailable sectionId=${focusLesson} — no OCR or unit content found`);
  return `
Student's Book section was requested: ${focusLesson}
But this section has no exercise data or unit content available.
Do not invent textbook content. Do not reference exercises that don't exist.
Use the grammar target and topic to guide the student with your own knowledge of Focus 2 A2+/B1.
`.trim();
}

function buildUnitFallbackContext(
  sectionId: string,
  entry: SectionCatalogEntry,
  unit: FocusUnitContent
): string {
  const lines: string[] = [
    `Student's Book section: ${sectionId}`,
    `Section type: ${entry.sectionTitle} (${entry.type})`,
    `Topic: ${entry.topic}`,
    `Unit: ${unit.unit} — ${unit.title}`,
    '',
    '⚠ NOTE: Full textbook exercise text is not yet available for this section.',
    'Use the Focus 2 course content below to guide your teaching.',
    'Do NOT invent or reference specific exercise numbers from the textbook.',
    'Do NOT claim these exercises come from a specific page.',
    "Say 'Let's practice [topic]' not 'Exercise 3 from your book'.",
    '',
  ];

  if (entry.type === 'grammar' || entry.grammarFocus) {
    lines.push('=== GRAMMAR CONTENT ===');
    lines.push(unit.grammarExplanation);
    lines.push('');
    lines.push('Grammar reference table:');
    lines.push(unit.grammarTable);
    lines.push('');
    lines.push('Example sentences (use these as models):');
    unit.exampleSentences.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('');
    lines.push('Exercise ideas (practice areas — do not claim these are from the book):');
    unit.exerciseIdeas.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  }

  if (entry.type === 'vocabulary' || entry.vocabularyFocus) {
    lines.push('=== VOCABULARY CONTENT ===');
    unit.keyVocabulary.forEach(v => {
      lines.push(`• ${v.word} (${v.partOfSpeech}): ${v.definition}`);
      lines.push(`  Example: ${v.example}`);
    });
    lines.push('');
    lines.push(`Collocations: ${unit.collocations.join(', ')}`);
    lines.push(`Phrasal verbs: ${unit.phrasalVerbs.join(', ')}`);
  }

  if (entry.type === 'reading') {
    lines.push('=== READING CONTENT ===');
    lines.push('Reading passage (use this as the discussion text):');
    lines.push(unit.readingPassage);
    lines.push('');
    lines.push('Post-reading discussion question:');
    lines.push(unit.deepThinkingQuestion);
  }

  if (entry.type === 'listening') {
    lines.push('=== LISTENING SECTION ===');
    lines.push('Audio track not available in this format.');
    lines.push('Adapt: use the topic vocabulary below and the reading passage for discussion.');
    lines.push('');
    lines.push('Related content for context:');
    lines.push(unit.readingPassage);
    lines.push('');
    lines.push('Discussion question:');
    lines.push(unit.deepThinkingQuestion);
  }

  lines.push('');
  lines.push('Teaching rules for AI-guided sections:');
  lines.push('- Follow the Focus 2 guided discovery approach: ask questions, do not state rules first.');
  lines.push('- Keep exercises concise (A2+/B1 level, age 12–17).');
  lines.push('- Focus on the grammar target or vocabulary theme listed above.');
  lines.push('- Do NOT reference specific textbook pages or exercise numbers.');

  return lines.join('\n');
}
