/**
 * The one public résumé PDF (/resume.pdf), printed from the web résumé, so the two can never disagree: the page's
 * own print stylesheet (features/resume/resume.module.css) IS the PDF. content/resume.json → /resume/ → this.
 *
 *   npm run build && npm start            (any server that serves the built site; default http://127.0.0.1:3100)
 *   npm run build:pdf                     print, gate, and write public/resume.pdf
 *   npm run build:pdf -- --check          print and gate only; fail if public/resume.pdf's text differs (CI)
 *   npm run build:pdf -- --url http://127.0.0.1:3000/resume/
 *
 * PRIVACY GATE (DESIGN §2: no phone number anywhere; it fails loudly and nothing is written):
 *   1. the page's HTML must hold no phone-number pattern and no tel: link;
 *   2. the PDF's own text (extracted with pdf.js) must hold none either;
 *   3. the extraction must demonstrably work (the name, the city and the public email are found), so an empty or
 *      unreadable extraction can never pass silently;
 *   4. at most two pages.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { extractText, getDocumentProxy } from 'unpdf';
import { PHONE } from '../src/lib/compliance.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};
const URL_ = opt('--url', 'http://127.0.0.1:3100/resume/');
const OUT = path.join(process.cwd(), 'public', 'resume.pdf');
const MUST_FIND = ['Qijin', 'Toronto', 'qxjack@gmail.com'];
const MAX_PAGES = 2;

async function pdfText(bytes: Uint8Array) {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(doc, { mergePages: true });
  return { pages: totalPages, text: String(text).replace(/\s+/g, ' ').trim() };
}

function gate(what: string, text: string) {
  const m = text.match(PHONE);
  if (m) throw new Error(`${what} contains a phone-number pattern or tel: link: ${JSON.stringify(m[0])}`);
}

async function main() {
  const browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const res = await page.goto(URL_, { waitUntil: 'networkidle' });
    if (!res || !res.ok()) throw new Error(`${URL_}: HTTP ${res?.status()}`);
    gate(`${URL_} (its HTML)`, await page.content());
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ printBackground: false, preferCSSPageSize: true, tagged: true, outline: true });
    const { pages, text } = await pdfText(pdf);
    gate('the PDF', text);
    for (const w of MUST_FIND)
      if (!text.includes(w))
        throw new Error(`the PDF's text has no "${w}": the extraction failed, so nothing is trusted`);
    if (pages > MAX_PAGES) throw new Error(`the PDF has ${pages} pages (at most ${MAX_PAGES})`);
    if (flag('--check')) {
      if (!existsSync(OUT)) throw new Error('public/resume.pdf is missing: run npm run build:pdf');
      const committed = await pdfText(await readFile(OUT));
      gate('public/resume.pdf', committed.text);
      if (committed.text !== text)
        throw new Error('public/resume.pdf is stale: its text differs from the résumé page. Run npm run build:pdf');
      console.log(`build-pdf --check: public/resume.pdf matches /resume/ (${pages} pages), no phone number`);
    } else {
      await writeFile(OUT, pdf);
      console.log(`build-pdf: wrote public/resume.pdf (${pages} pages, ${pdf.length} bytes), no phone number`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`build-pdf: REFUSED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
