import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync } from 'fs';

const PDF_PATH = 'C:/Users/Admin/Downloads/1606679541_1focus_2_student_s_book.pdf';

const data = new Uint8Array(readFileSync(PDF_PATH));
const doc = await pdfjsLib.getDocument({
  data,
  useWorkerFetch: false,
  isEvalSupported: false,
  useSystemFonts: true,
  disableFontFace: true,
}).promise;

console.log('Total pages:', doc.numPages);

const pageTexts = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  const pageText = content.items.map(item => item.str).join(' ');
  pageTexts.push({ page: i, text: pageText });
  if (i % 20 === 0) process.stderr.write(`Extracted ${i}/${doc.numPages} pages\n`);
}

writeFileSync('focus2_extracted.json', JSON.stringify(pageTexts, null, 2));
console.log('Done. Written to focus2_extracted.json');
