import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
  const section = getFocusStudentBookSection(focusLesson);

  if (!focusLesson) {
    return "";
  }

  if (!section) {
    return `
Student's Book section was requested: ${focusLesson}
But this section was not found in focus_lessons.json.
Do not invent textbook content.
Ask the student to choose an available section.
`;
  }

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
`;
}