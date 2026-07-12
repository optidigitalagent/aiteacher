export function sanitizeTeacherTextForTts(text: string): string {
  return text
    .replace(/_{2,}/g, ' ')
    .replace(/\s+([?.!,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
