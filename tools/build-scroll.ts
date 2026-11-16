/**
 * The whole scroll in miniature (the tail's map, components/layout/ScrollMap): ONE strip of the painting from Home's
 * peaks to the crossing, the stretches between the places included, cut from the real engine on this machine's GPU:
 * public/scenes/scroll/scroll.webp and scroll.json (its size, the stretches it shows, and where along it each place
 * stands, which ScrollMap reads to put each page's name under its place).
 * Jack, of the five separate place stills that stood here: "it is not a coherent scroll … also include the
 * transitions".
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3106   a QA build (it exposes the engine as window.__ink)
 *   npm run build:scroll -- --base http://127.0.0.1:3106          cut it; needs Google Chrome (headless, Metal)
 *   npm run build:scroll -- --preview <dir>                       also keep the raw strip (outside the repo)
 *
 * How: Home at 1520 × 800 (one stretch of the scroll per screen), its words hidden and the keep-out dropped (no mist
 * under a title that is not there). The engine's camera is taken along the scroll in nine stands half a stretch apart
 * (panTo); at each, once the place and its figures are painted, the loop is held (the QA hold) and the screen is
 * captured until two captures match, and
 * stats().stage.framing says where in the world that view starts. A pan moves every layer of the painting alike, so
 * two neighbouring views show the same world where they overlap and differ only in their light: the strip is the
 * views laid side by side, each fading into the next across their overlap, so the light changes along it as it does
 * for a visitor walking the scroll, and no seam shows.
 * The framing willow boughs (elements.ts boughs: Work's and Writing's) hang into a page's first screen from above
 * it; in a strip they would hang in the middle of the sky, so the strip is cut with that switch off (the table's own
 * QA override, window.__elOff).
 * REGENERATE AFTER ANY ENGINE, SET, PALETTE, LIGHT OR PLACE CHANGE (as the stills; no --check: the strip is one
 * picture, looked at whenever it is cut).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};
const BASE = opt('--base', 'http://127.0.0.1:3106').replace(/\/$/, '');
const PREVIEW = opt('--preview', '');

const VIEW = { width: 1520, height: 800 }; // aspect 1.9: one stretch of the scroll across the screen
const FROM = 0; // the first stretch (Home) …
const TO = 5; // … to the end of the fifth (Contact); the 404's lone peak lies off the map
const STANDS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]; // where the camera stands (the pages' own range: Home 0 … Contact 4)
const ROWS: [top: number, bottom: number] = [30, 650]; // the screen rows kept: the sky over the peaks to the near shore
const WIDTH = 3600; // the file's width: the screen's width at 2x on a laptop, a phone's scroller at 2x
const QUALITY = 0.74;
/** Each place's focus (world x: stretch + compose.ts SCENES[stretch].frame.focus[0]), in the painting's order. */
const PLACES: Record<string, number> = { home: 0.79, work: 1.565, writing: 2.8, resume: 3.65, contact: 4.68 };
const CHROME_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];
const OUT_DIR = path.join(ROOT, 'public', 'scenes', 'scroll');
const HIDE_CSS = `
  .site-header, main > *:not(.strip), .strip__text, .strip__still, .site-footer, .veils, .skip-link,
  [class*="switches"] { visibility: hidden !important; }
  html { scrollbar-width: none; }`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chrome's encoder wraps the image in VP8X with an ICC profile: keep only the lossy bitstream (as the stills). */
function plainWebp(data: Buffer): Buffer {
  if (data.toString('latin1', 0, 4) !== 'RIFF' || data.toString('latin1', 8, 12) !== 'WEBP')
    throw new Error('not a WebP');
  const chunks = new Map<string, Buffer>();
  let i = 12;
  while (i + 8 <= data.length) {
    const tag = data.toString('latin1', i, i + 4);
    const n = data.readUInt32LE(i + 4);
    if (!chunks.has(tag)) chunks.set(tag, data.subarray(i + 8, i + 8 + n));
    i += 8 + n + (n & 1);
  }
  const body = chunks.get('VP8 ');
  if (!body || chunks.has('ALPH') || chunks.has('ANIM')) return data;
  const size = Buffer.alloc(4);
  size.writeUInt32LE(body.length);
  const vp8 = Buffer.concat([
    Buffer.from('VP8 ', 'latin1'),
    size,
    body,
    body.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0),
  ]);
  const riff = Buffer.alloc(4);
  riff.writeUInt32LE(4 + vp8.length);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), riff, Buffer.from('WEBP', 'latin1'), vp8]);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', args: CHROME_ARGS });
  try {
    const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
    await page.addInitScript('window.__elOff = ["boughs"];');
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction('window.__ink && window.__ink.stats().plates && window.__ink.stats().plates.on', null, {
      timeout: 30_000,
    });
    await page.addStyleTag({ content: HIDE_CSS });
    await page.evaluate(`(() => {
      document.querySelectorAll('[data-landscape="keepout"]').forEach((e) => e.removeAttribute('data-landscape'));
      window.__ink.rebind({ keepout: [], veil: [] });
      window.__ink.refresh();
    })()`);
    await sleep(1500);

    const height = ROWS[1] - ROWS[0];
    const views: { png: Buffer; left: number; scale: number }[] = [];
    for (const stand of STANDS) {
      await page.evaluate(`window.__ink.panTo(${stand}, { duration: 0 })`);
      let last: Buffer | null = null;
      let view: { png: Buffer; left: number; scale: number } | null = null;
      for (let k = 0; k < 60 && !view; k++) {
        await sleep(k ? 300 : 600);
        const f = (await page.evaluate(
          `(() => { const s = window.__ink.stats(); const f = s.stage && s.stage.framing; const figs = Object.values(s.figures || {});
            return { busy: !!(s.pending || s.panning || s.arriving || s.sweeping || s.deferred || figs.includes('pending')) || !(s.stage && s.stage.ready && (s.stage.painted || []).every(Boolean)) || !(s.plates && s.plates.on),
              left: f ? f.worldLeft : null, scale: f ? f.scale : null }; })()`,
        )) as { busy: boolean; left: number | null; scale: number | null };
        if (f.busy || f.left === null || f.scale === null) {
          last = null;
          continue;
        }
        // (the QA hold: the loop stops on its present, so the fall, the smoke and the mist stand for the capture)
        await page.evaluate(`window.__ink.qa && window.__ink.qa({ hold: true })`);
        await sleep(200);
        const shot = await page.screenshot({ clip: { x: 0, y: ROWS[0], width: VIEW.width, height } });
        if (last && shot.equals(last)) view = { png: shot, left: f.left, scale: f.scale };
        last = shot;
      }
      await page.evaluate(`(() => { window.__ink.qa && window.__ink.qa({ hold: false }); window.__ink.resume(); })()`);
      if (!view) throw new Error(`the view at ${stand} never held still`);
      views.push(view);
      console.log(`  stand ${stand}: the view starts at ${view.left.toFixed(3)}`);
    }
    const scale = views[0]!.scale;
    const to = Math.min(TO, views[views.length - 1]!.left + VIEW.width / scale);
    const total = Math.round((to - FROM) * scale);

    // side by side, each view fading into the next across their overlap; then each density
    const stitch = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await stitch.goto('about:blank');
    const out = (await stitch.evaluate(
      `(async ([imgs, lefts, from, scale, total, height, vw, sizes]) => {
        const data = [];
        for (const b64 of imgs) {
          const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
          const t = document.createElement('canvas'); t.width = vw; t.height = height;
          const g = t.getContext('2d'); g.drawImage(im, 0, 0);
          data.push(g.getImageData(0, 0, vw, height).data);
        }
        const c = document.createElement('canvas'); c.width = total; c.height = height;
        const g = c.getContext('2d');
        const o = g.createImageData(total, height);
        const x0 = lefts.map((l) => Math.round((l - from) * scale));     // each view's first column in the strip
        const mid = x0.map((x) => x + vw / 2);
        for (let x = 0; x < total; x++) {
          // the two views whose middles stand either side of this column (one, before the first and after the last)
          let i = 0;
          while (i < mid.length - 1 && mid[i + 1] <= x) i++;
          let a = i, b = Math.min(mid.length - 1, i + 1), t = 0;
          if (x <= mid[0]) { a = b = 0; }
          else if (b !== a) {
            // fade only where both views have the column, in the middle of their overlap
            const lo = Math.max(x0[b], mid[a]), hi = Math.min(x0[a] + vw, mid[b]);
            t = hi > lo ? Math.min(1, Math.max(0, (x - lo) / (hi - lo))) : x >= x0[b] ? 1 : 0;
            t = t * t * (3 - 2 * t);
          }
          const xa = Math.min(vw - 1, Math.max(0, x - x0[a])), xb = Math.min(vw - 1, Math.max(0, x - x0[b]));
          const A = data[a], B = data[b];
          for (let y = 0; y < height; y++) {
            const pa = (y * vw + xa) * 4, pb = (y * vw + xb) * 4, po = (y * total + x) * 4;
            o.data[po] = A[pa] + (B[pb] - A[pa]) * t;
            o.data[po + 1] = A[pa + 1] + (B[pb + 1] - A[pa + 1]) * t;
            o.data[po + 2] = A[pa + 2] + (B[pb + 2] - A[pa + 2]) * t;
            o.data[po + 3] = 255;
          }
        }
        g.putImageData(o, 0, 0);
        const res = { raw: c.toDataURL('image/png').split(',')[1] };
        for (const [d, w, q] of sizes) {
          const h = Math.round(height * w / total);
          const oc = document.createElement('canvas'); oc.width = w; oc.height = h;
          const k = oc.getContext('2d'); k.imageSmoothingEnabled = true; k.imageSmoothingQuality = 'high';
          // (in halvings where it more than halves: one step drops the fine lines of the roofs)
          let src = c, sw = total, sh = height;
          while (sw / 2 > w) { const tc = document.createElement('canvas'); tc.width = Math.round(sw / 2); tc.height = Math.round(sh / 2); const tg = tc.getContext('2d'); tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, sw, sh, 0, 0, tc.width, tc.height); src = tc; sw = tc.width; sh = tc.height; }
          k.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
          const url = oc.toDataURL('image/webp', q);
          if (!url.startsWith('data:image/webp;base64,')) return { error: 'this Chrome cannot encode WebP' };
          res[d] = { w, h, webp: url.slice('data:image/webp;base64,'.length) };
        }
        return res;
      })(${JSON.stringify([
        views.map((v) => v.png.toString('base64')),
        views.map((v) => v.left),
        FROM,
        scale,
        total,
        height,
        VIEW.width,
        [['1', WIDTH, QUALITY]],
      ])})`,
    )) as { error?: string; raw: string } & Record<'1', { w: number; h: number; webp: string }>;
    if (out.error) throw new Error(out.error);

    await mkdir(OUT_DIR, { recursive: true });
    const data = plainWebp(Buffer.from(out['1'].webp, 'base64'));
    await writeFile(path.join(OUT_DIR, 'scroll.webp'), data);
    console.log(`scroll.webp  ${out['1'].w} × ${out['1'].h}  ${data.length} B`);
    const span = to - FROM;
    const places = Object.fromEntries(
      Object.entries(PLACES).map(([k, x]) => [k, Number(((x - FROM) / span).toFixed(4))]),
    );
    await writeFile(
      path.join(OUT_DIR, 'scroll.json'),
      `${JSON.stringify({ file: 'scroll.webp', size: [out['1'].w, out['1'].h], from: FROM, to: Number(to.toFixed(3)), places }, null, 2)}\n`,
    );
    if (PREVIEW) {
      await mkdir(PREVIEW, { recursive: true });
      await writeFile(path.join(PREVIEW, 'scroll-raw.png'), Buffer.from(out.raw, 'base64'));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`build-scroll: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
