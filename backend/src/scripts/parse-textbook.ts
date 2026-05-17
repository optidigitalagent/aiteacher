#!/usr/bin/env tsx
// ── Textbook Parser CLI ────────────────────────────────────────────────────────
//
// Usage:
//   # Parse plain text / OCR:
//   npm run parse-textbook -- --section 2.1 --unit 2 --textbook "Focus B1" --file path/to/ocr.txt
//
//   # Parse a PDF:
//   npm run parse-textbook -- --section 2.1 --unit 2 --textbook "Focus B1" --pdf path/to/book.pdf
//
//   # With teacher book answers (overlay correctAnswer on items):
//   npm run parse-textbook -- --section 2.1 --unit 2 --file ocr.txt --teacher teacher_book.txt
//
//   # List stored manifests:
//   npm run parse-textbook -- --list
//
// Output: backend/data/manifests/{sectionId}.json
// The engine picks up this file automatically on the next lesson start.

import fs   from 'fs'
import path from 'path'
import { runTextbookParsePipeline } from '../textbook/index.js'
import { listStoredManifests }      from '../textbook/manifest/manifest-store.js'
import type { ParsePipelineConfig } from '../textbook/types.js'

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      args[key] = argv[i + 1] ?? 'true'
      i++
    }
  }
  return args
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if ('list' in args) {
    const stored = listStoredManifests()
    if (stored.length === 0) {
      console.log('No parsed manifests found in data/manifests/')
    } else {
      console.log('Stored manifests:')
      stored.forEach(s => console.log(`  ${s}`))
    }
    return
  }

  const section  = args['section']
  const unit     = args['unit']
  const textbook = args['textbook'] ?? 'Focus B1'
  const cefr     = args['cefr']     ?? 'B1'

  if (!section || !unit) {
    console.error('Usage: npm run parse-textbook -- --section 2.1 --unit 2 [--file ocr.txt | --pdf book.pdf]')
    process.exit(1)
  }

  const unitNum = parseInt(unit, 10)
  if (isNaN(unitNum) || unitNum < 1) {
    console.error(`Invalid unit number: "${unit}"`)
    process.exit(1)
  }

  // Read raw text
  let rawText        = ''
  let teacherBookText: string | undefined

  if (args['pdf']) {
    rawText = await readPdf(args['pdf'])
  } else if (args['file']) {
    rawText = readFile(args['file'])
  } else {
    // Read from stdin
    rawText = fs.readFileSync('/dev/stdin', 'utf-8')
  }

  if (args['teacher']) {
    teacherBookText = readFile(args['teacher'])
  }

  if (!rawText.trim()) {
    console.error('No textbook content provided. Use --file, --pdf, or pipe via stdin.')
    process.exit(1)
  }

  const config: ParsePipelineConfig = {
    textbook,
    cefrLevel:       cefr,
    sectionId:       section,
    unitNumber:      unitNum,
    rawText,
    teacherBookText,
  }

  console.log('\n━━━ Textbook Parser ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const result = await runTextbookParsePipeline(config)

  console.log('\n━━━ Result ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  if (result.manifestResult.success) {
    console.log(`✓ Manifest saved for section ${section}`)
    const m = result.manifestResult.manifest!
    const executable = m.exercises.filter(e => e.executable).length
    const skipped    = m.exercises.filter(e => !e.executable).length
    console.log(`  ${m.exercises.length} exercises | ${executable} executable | ${skipped} skipped`)
    if (result.manifestResult.warnings.length) {
      console.log('\nWarnings:')
      result.manifestResult.warnings.forEach(w => console.log(`  ⚠ ${w}`))
    }
    console.log('\nNext: restart the server — the engine will load the new manifest automatically.')
  } else {
    console.log(`✗ Manifest for section ${section} was NOT saved due to errors:`)
    result.manifestResult.errors.forEach(e => console.log(`  ✗ ${e}`))
    console.log('\nFix the errors above and rerun.')
    process.exit(1)
  }
}

// ── File helpers ──────────────────────────────────────────────────────────────

function readFile(filepath: string): string {
  const resolved = path.resolve(filepath)
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }
  return fs.readFileSync(resolved, 'utf-8')
}

async function readPdf(filepath: string): Promise<string> {
  const { parsePdf } = await import('../textbook/parsers/pdf-parser.js')
  console.log(`Parsing PDF: ${filepath}`)
  const result = await parsePdf(filepath)
  console.log(`  ${result.pages} pages extracted`)
  return result.text
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error('[parse-textbook] Fatal error:', err)
  process.exit(1)
})
