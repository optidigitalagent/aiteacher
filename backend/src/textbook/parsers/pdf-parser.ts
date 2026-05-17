// ── PDF Parser ─────────────────────────────────────────────────────────────────
// Extracts plain text from PDF files using pdf-parse (in devDependencies).
// Build-time only — not imported in the main server bundle.
//
// Usage: `npx tsx src/scripts/parse-textbook.ts --pdf path/to/book.pdf --section 1.2`

import fs from 'fs'

export interface PdfParseResult {
  text: string
  pages: number
  info: Record<string, string>
}

export async function parsePdf(filePath: string): Promise<PdfParseResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`)
  }

  // Dynamic import so the main server bundle is never affected
  const pdfParse = await importPdfParse()
  const buffer   = fs.readFileSync(filePath)
  const result   = await pdfParse(buffer)

  return {
    text:  result.text ?? '',
    pages: result.numpages ?? 0,
    info:  (result.info ?? {}) as Record<string, string>,
  }
}

// ── PDF page range extraction ─────────────────────────────────────────────────

export interface PageRangeOptions {
  startPage?: number
  endPage?: number
}

export async function parsePdfPageRange(
  filePath: string,
  options: PageRangeOptions = {},
): Promise<PdfParseResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${filePath}`)
  }

  const pdfParse = await importPdfParse()
  const buffer   = fs.readFileSync(filePath)

  const { startPage = 1, endPage } = options
  let collectedText = ''
  let totalPages    = 0

  const parseOptions = {
    pagerender: (pageData: { pageIndex: number; getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
      const pageNum = pageData.pageIndex + 1
      totalPages    = Math.max(totalPages, pageNum)

      if (pageNum < startPage) return Promise.resolve('')
      if (endPage !== undefined && pageNum > endPage) return Promise.resolve('')

      return pageData.getTextContent().then(
        (content: { items: Array<{ str: string; transform: number[] }> }) => {
          const lines = content.items.map((item) => item.str).join(' ')
          collectedText += '\n' + lines
          return lines
        },
      )
    },
  }

  const result = await pdfParse(buffer, parseOptions)

  return {
    text:  collectedText.trim() || result.text,
    pages: totalPages || result.numpages,
    info:  (result.info ?? {}) as Record<string, string>,
  }
}

// ── Dynamic import guard ──────────────────────────────────────────────────────

async function importPdfParse(): Promise<(buffer: Buffer, options?: unknown) => Promise<{ text: string; numpages: number; info: unknown }>> {
  try {
    const mod = await import('pdf-parse')
    // pdf-parse exports a default function
    const fn = (mod as unknown as { default: (b: Buffer, o?: unknown) => Promise<{ text: string; numpages: number; info: unknown }> }).default
    if (typeof fn !== 'function') throw new Error('pdf-parse default export is not a function')
    return fn
  } catch {
    throw new Error(
      'pdf-parse is not installed. Run: npm install --save-dev pdf-parse @types/pdf-parse\n' +
      'Or install as a production dependency if you need PDF parsing at runtime.',
    )
  }
}
