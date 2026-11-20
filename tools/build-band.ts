/**
 * The band's stills: each page kind's stage (the painting as the band shows it: styles/band.css), cut from the real
 * engine on this machine's GPU: public/scenes/band/<page>-<part>.webp + manifest.json, read by
 * components/layout/BandStill. The still is the painting from the first paint on every device, the whole painting
 * wherever the engine does not run (phones, tablets, reduced motion, no GPU), and it lies under the live stage where
 * it does.
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100   a QA build (it exposes the engine as window.__ink)
 *   npm run build:band -- --base http://127.0.0.1:3100            cut every page; needs Google Chrome (headless, Metal)
 *   npm run build:band -- --pages home,work                       some of them (the others keep their entries)
 *   npm run build:band -- --preview <dir>                         also keep each page's whole stage as a PNG (outside the repo)
 *   npm run build:band -- --check                                 no browser: exit 1 when the stills are stale (CI)
 *
 * Per page: the page is opened at CUT (1440 wide: one stretch of the scroll across the window, as the wide class
 * frames it), its band made TALL (more sky than a laptop's band shows: a phone's band is taller against its width),
 * the engine forced live and then stilled (no drift, no small life). Once the stage's plates are developed, they are
 * laid over each other in the page exactly as the band lays them (plates/sink.ts), into one picture: the stage from
 * the hero's left edge, as wide as the settled band plus the page's travel. That picture is cut into the parts the
 * page fetches:
 *   wide-a    the window's width at the page's top (what a laptop or a tablet shows first), at 1x and 2x
 *   wide-b    the rest to the east (the settled band's reach and the travel), at 1x and 2x: fetched after the first
 *   phone-a   what a phone shows first: a phone-width part of the stage, further east (PHONE_AT), at 2x
 *   phone-b   the rest to the east for the phone
 * and the manifest records, per page, where each part lies, in units of the cut's window width (so the styles place
 * every part by the same rule the engine frames the stage with): the waterline's depth, each part's left edge and
 * width, the tablet's look (TABLET_X), and the page's travel.
 * Then the whole scroll as one strip (transit.webp): the five places' stages (Home, Work, Writing, the Résumé,
 * Contact), each drawn from its own picture and faded into the next where two overlap (the same world, each under
 * its own place's air), from Home's left edge to the crossing's open water. It is what flies by when a page changes
 * where the engine does not run (features/navigation/flight.ts), and the tail's map of the whole scroll
 * (components/layout/ScrollMap); the manifest records the stretch of the world it shows, its waterline, where each
 * place stands along it and each page's seat on the scroll. Cut only when all five places are cut in one run.
 * The manifest also records a hash of what the stills are cut from (every file under the engine, the switch table,
 * the places, the band's numbers and this tool): `--check` compares it, so a change to any of them without a new
 * cut fails CI. Only a run that cuts every page writes it.
 * Regenerate after any engine, set, palette, light, place or band change.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { BAND } from '../src/features/landscape/band.ts';
import { bandGeometry } from '../src/features/landscape/band-geometry.ts';
import type { PageId } from '../src/features/landscape/places.ts';
import { flag, opt, plainWebp, rel, sha, walk } from './lib.ts';

const ROOT = process.cwd();
const BASE = opt('--base', 'http://127.0.0.1:3100').replace(/\/$/, '');
const PREVIEW = opt('--preview', '');
const ONLY = opt('--pages', '');

/** The cut's window: the wide class, one stretch across; tall enough for the tall band. */
const CUT = { width: BAND.ref[0], height: 1320 };
/** The strip's box for the cut (CSS px): taller than a laptop's (600 at most), for the sky a phone's band needs. */
const TALL = 960;
/** Each page kind's route. */
const ROUTES: Record<PageId, string> = {
  home: '/',
  work: '/work/',
  case: '/work/rag-assistant/',
  writing: '/writing/',
  article: '/writing/what-is-an-ai-agent/',
  resume: '/resume/',
  contact: '/contact/',
  'not-found': '/a-path-that-fades-into-the-mist/',
};
/** Where a phone looks at each place (world x of its band's left edge at the page's top; it shows 0.513 of a stretch,
 *  0.446 where the page stands inside its place). */
const PHONE_AT: Record<PageId, number> = {
  home: 0.53,
  work: 1.33,
  case: 1.57,
  writing: 2.6,
  article: 2.68,
  resume: 3.35,
  contact: 4.46,
  'not-found': 5.56,
};
/** Where a tablet looks: this far east of the hero's left edge (window widths of the cut). Its window shows 0.87 of
 *  the cut's, so the place keeps its seat right of the middle and the sky at the left stays open for the title. */
const TABLET_X: Partial<Record<PageId, number>> & { any: number } = { any: 0.1, home: 0.08 };
/** A phone's band, as styles/tokens.css sets it: one stretch is this many window widths; the settled band is 1 / zoom
 *  of the window wide. */
const PHONE = { scale: 1.95, zoom: 0.56, px: 390 };
const QUALITY = { a: 0.82, b: 0.76, transit: 0.72 };
/** The whole scroll's strip: the places in the scroll's order, and where one's picture fades into the next's (world
 *  x, stretches: over open water or mist where there is some), its scale (px per CSS px of the cut) and its end. */
const CHAIN: PageId[] = ['home', 'work', 'writing', 'resume', 'contact'];
const SEAMS: [number, number][] = [
  [0.95, 1.1],
  [2.2, 2.45],
  [3.02, 3.2],
  [4.1, 4.35],
];
const TRANSIT = { density: 0.5, to: 5.9 };
/** Each place's focus (world x: stretch + engine/compose.ts SCENES[stretch].frame.focus[0]): where its name stands
 *  under the tail's map. */
const FOCUS: Record<string, number> = { home: 0.79, work: 1.565, writing: 2.8, resume: 3.65, contact: 4.68 };
const CHROME_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'];
const OUT_DIR = path.join(ROOT, 'public', 'scenes', 'band');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

interface Part {
  files: string[];
  /** left edge and width, in window widths of the cut */
  x: number;
  w: number;
  /** the 1x file's size (px) */
  size: [number, number];
  bytes: number[];
}
interface Transit {
  file: string;
  size: [number, number];
  bytes: number;
  /** the world it shows (stretches), its waterline's depth and its height (window widths of the cut) */
  from: number;
  to: number;
  water: number;
  h: number;
  /** each place's focus, as a fraction of the strip's width */
  places: Record<string, number>;
  /** every page's seat on the scroll: its hero's left edge (world x), how close it stands, its travel (stretches) */
  pages: Record<string, { left: number; inside: number; travel: number }>;
}
interface Entry {
  /** the waterline's depth and the picture's height, in window widths of the cut */
  water: number;
  h: number;
  /** the page's travel, in window widths of the cut */
  travel: number;
  /** how much closer the page stands than its place's hero */
  inside: number;
  wide: { a: Part; b: Part };
  phone: { a: Part; b: Part };
  /** where the tablet looks: window widths of the cut east of the picture's left edge */
  tabletX: number;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** What the stills are cut from: each input file's hash, and one hash over them all. */
function inputs(): { hash: string; list: Record<string, string> } {
  const land = path.join(ROOT, 'src', 'features', 'landscape');
  const files = [
    ...walk(path.join(land, 'engine')).filter((f) => f.endsWith('.ts')),
    path.join(land, 'elements.ts'),
    path.join(land, 'places.ts'),
    path.join(land, 'band.ts'),
    path.join(land, 'band-geometry.ts'),
    path.join(ROOT, 'tools', 'build-band.ts'),
  ].sort();
  const list: Record<string, string> = {};
  for (const f of files) list[rel(f)] = sha(readFileSync(f));
  return { hash: sha(JSON.stringify(list)), list };
}

async function main() {
  const pages = (ONLY ? ONLY.split(',') : Object.keys(ROUTES)) as PageId[];
  type Manifest = {
    about: string;
    inputs?: string;
    inputList?: Record<string, string>;
    stills: Record<string, Entry>;
    transit?: Transit;
  };
  const manifest: Manifest = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest)
    : { about: '', stills: {} };
  const now = inputs();
  if (flag('--check')) {
    if (manifest.inputs === now.hash) {
      console.log('band stills: up to date');
      return;
    }
    const was = manifest.inputList ?? {};
    const changed = [...new Set([...Object.keys(was), ...Object.keys(now.list)])].filter((f) => was[f] !== now.list[f]);
    console.error(`band stills: stale (changed since the last cut: ${changed.join(', ') || 'unknown'}).`);
    console.error('Cut them again from a QA build on port 3100: npm run build:band');
    process.exit(1);
  }
  // each place's whole stage, small, for the strip of the whole scroll
  const minis: Record<string, { png: string; left: number; w: number; h: number; water: number }> = {};
  manifest.about =
    "The band's stills (the stage as the band shows it, one picture per page kind, in parts), made by tools/build-band.ts from the engine; regenerate after any engine, place or band change. Lengths are in window widths of the cut (1440 px).";
  await mkdir(OUT_DIR, { recursive: true });
  if (PREVIEW) await mkdir(PREVIEW, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', args: CHROME_ARGS });
  try {
    for (const id of pages) {
      const g = bandGeometry(id);
      const ctx = await browser.newContext({ viewport: CUT, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await page.addInitScript('window.__inkLive = true;');
      await page.addInitScript(`document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = ':root { --band-h: ${TALL}px !important; }';
        document.head.appendChild(s);
      });`);
      await page.goto(`${BASE}${ROUTES[id]}`, { waitUntil: 'load' });
      await page.waitForFunction(
        `(() => { const i = window.__ink; if (!i) return false; const s = i.stats(); return s.plates && s.plates.on && s.stage && s.stage.ready && !s.pending; })()`,
        null,
        { timeout: 45_000 },
      );
      // stilled: no drift, no small life; then wait until the plates stop being developed
      await page.evaluate(`window.__ink.setStill(true)`);
      let last = -1;
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(500);
        const n = (await page.evaluate(
          `(() => { const s = window.__ink.stats(); return s.plates && s.plates.on ? s.plates.developed : -1; })()`,
        )) as number;
        if (n >= 0 && n === last) break;
        last = n;
      }
      const unitPx = CUT.width; // one window width of the cut, CSS px
      const phoneX = (PHONE_AT[id] - g.left) * g.inside;
      const tabletX = TABLET_X[id] ?? TABLET_X.any;
      const travelU = g.travel * g.inside;
      const phoneHero = 1 / PHONE.scale; // a phone's window, in the cut's window widths
      const phoneAll = 1 / PHONE.zoom / PHONE.scale + travelU + 0.03;
      const out = (await page.evaluate(
        async ({ unitPx, phoneX, phoneHero, phoneAll, phonePx, Q, keep, mini }) => {
          const plate = (k: number) => document.querySelector<HTMLCanvasElement>(`canvas[data-plate="${k}"]`);
          const far = plate(1);
          if (!far || !far.width) return { error: 'no far plate' };
          const px = (v: string) => parseFloat(v) || 0;
          const W = px(far.style.width);
          const H = px(far.style.height);
          const s = far.width / W; // buffer px per CSS px
          const whole = document.createElement('canvas');
          whole.width = Math.round(W * s);
          whole.height = Math.round(H * s);
          const c = whole.getContext('2d')!;
          for (const k of [1, 2, 3, 4, 5]) {
            const p = plate(k);
            if (!p || p.style.display === 'none' || p.width < 2) continue;
            c.drawImage(p, px(p.style.left) * s, px(p.style.top) * s, px(p.style.width) * s, px(p.style.height) * s);
          }
          // a part of the whole, from x0 over w (CSS px of the cut), at `d` px per CSS px, as WebP
          const cut = (x0: number, w: number, d: number, q: number) => {
            const o = document.createElement('canvas');
            o.width = Math.max(1, Math.round(w * d));
            o.height = Math.max(1, Math.round(H * d));
            const g2 = o.getContext('2d')!;
            g2.imageSmoothingQuality = 'high';
            g2.drawImage(whole, x0 * s, 0, w * s, H * s, 0, 0, o.width, o.height);
            const url = o.toDataURL('image/webp', q);
            if (!url.startsWith('data:image/webp;base64,')) throw new Error('this Chrome cannot encode WebP');
            return { w: o.width, h: o.height, webp: url.slice('data:image/webp;base64,'.length) };
          };
          const dMax = Math.min(2, s); // the densest the plates hold
          const pd = (phonePx * 2) / (phoneHero * unitPx); // a phone at 2x: device px per CSS px of the cut
          const pEnd = Math.min(W, (phoneX + phoneAll) * unitPx);
          return {
            W,
            H,
            s,
            anchor: document.querySelector('.band-anchor')!.getBoundingClientRect().height,
            wideA: [cut(0, unitPx, 1, Q.a), cut(0, unitPx, dMax, Q.a)],
            wideB: [cut(unitPx - 2, W - unitPx + 2, 1, Q.b), cut(unitPx - 2, W - unitPx + 2, dMax, Q.b)],
            phoneA: [cut(phoneX * unitPx, phoneHero * unitPx, pd, Q.a)],
            phoneB: [cut((phoneX + phoneHero) * unitPx - 2, pEnd - (phoneX + phoneHero) * unitPx + 2, pd, Q.b)],
            pEnd,
            png: keep ? whole.toDataURL('image/png').slice('data:image/png;base64,'.length) : '',
            mini: mini
              ? (() => {
                  const o = document.createElement('canvas');
                  o.width = Math.round(W * mini);
                  o.height = Math.round(H * mini);
                  const g2 = o.getContext('2d')!;
                  g2.imageSmoothingQuality = 'high';
                  g2.drawImage(whole, 0, 0, o.width, o.height);
                  return o.toDataURL('image/png').slice('data:image/png;base64,'.length);
                })()
              : '',
          };
        },
        {
          unitPx,
          phoneX,
          phoneHero,
          phoneAll,
          phonePx: PHONE.px,
          Q: QUALITY,
          keep: !!PREVIEW,
          mini: CHAIN.includes(id) ? TRANSIT.density : 0,
        },
      )) as unknown as {
        error?: string;
        W: number;
        H: number;
        s: number;
        anchor: number;
        pEnd: number;
        png: string;
        mini: string;
      } & Record<'wideA' | 'wideB' | 'phoneA' | 'phoneB', { w: number; h: number; webp: string }[]>;
      if (out.error) throw new Error(`${id}: ${out.error}`);
      const write = async (name: string, b64: string) => {
        const data = plainWebp(Buffer.from(b64, 'base64'));
        await writeFile(path.join(OUT_DIR, name), data);
        return data.length;
      };
      const part = async (key: string, cuts: { w: number; h: number; webp: string }[], x: number, w: number) => {
        const files: string[] = [];
        const bytes: number[] = [];
        for (let i = 0; i < cuts.length; i++) {
          const name = cuts.length > 1 ? `${id}-${key}@${i + 1}x.webp` : `${id}-${key}.webp`;
          files.push(name);
          bytes.push(await write(name, cuts[i]!.webp));
        }
        return { files, x: r4(x), w: r4(w), size: [cuts[0]!.w, cuts[0]!.h] as [number, number], bytes };
      };
      const lap = 2 / unitPx; // the second part starts 2 px inside the first: no seam under a scale
      const entry: Entry = {
        water: r4((out.anchor * 0.66) / unitPx),
        h: r4(out.H / unitPx),
        travel: r4(travelU),
        inside: g.inside,
        wide: {
          a: await part('wide-a', out.wideA, 0, 1),
          b: await part('wide-b', out.wideB, 1 - lap, out.W / unitPx - 1 + lap),
        },
        phone: {
          a: await part('phone-a', out.phoneA, phoneX, phoneHero),
          b: await part('phone-b', out.phoneB, phoneX + phoneHero - lap, out.pEnd / unitPx - phoneX - phoneHero + lap),
        },
        tabletX: r4(tabletX),
      };
      manifest.stills[id] = entry;
      if (out.mini)
        minis[id] = { png: out.mini, left: g.left, w: out.W / unitPx, h: out.H / unitPx, water: entry.water };
      if (PREVIEW && out.png) await writeFile(path.join(PREVIEW, `${id}.png`), Buffer.from(out.png, 'base64'));
      const kb = (n: number[]) => n.map((b) => `${(b / 1024).toFixed(1)}`).join(' / ');
      console.log(
        `${id.padEnd(10)} stage ${Math.round(out.W)} × ${Math.round(out.H)} CSS px at ${out.s.toFixed(2)}x · wide-a ${kb(entry.wide.a.bytes)} KB · wide-b ${kb(entry.wide.b.bytes)} KB · phone-a ${kb(entry.phone.a.bytes)} KB · phone-b ${kb(entry.phone.b.bytes)} KB`,
      );
      await ctx.close();
    }
    // the whole scroll as one strip, when all five places were cut in this run
    if (CHAIN.every((id) => minis[id])) {
      const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
      const px = BAND.ref[0] * TRANSIT.density; // px per stretch
      const parts = CHAIN.map((id) => ({ ...minis[id]!, id }));
      const res = (await page.evaluate(
        async ({ parts, seams, px, to, q }) => {
          const load = (b64: string) =>
            new Promise<HTMLImageElement>((ok, no) => {
              const im = new Image();
              im.onload = () => ok(im);
              im.onerror = () => no(new Error('a stage did not decode'));
              im.src = `data:image/png;base64,${b64}`;
            });
          const imgs = await Promise.all(parts.map((p) => load(p.png)));
          const H = imgs[0]!.height;
          const strip = document.createElement('canvas');
          strip.width = Math.round(to * px);
          strip.height = H;
          const c = strip.getContext('2d')!;
          imgs.forEach((im, i) => {
            const x0 = parts[i]!.left * px;
            if (i === 0) {
              c.drawImage(im, x0, 0);
              return;
            }
            // this place's stage, let in across its seam with the one before it
            const [a, b] = seams[i - 1]!;
            const o = document.createElement('canvas');
            o.width = im.width;
            o.height = H;
            const g = o.getContext('2d')!;
            g.drawImage(im, 0, 0);
            const grad = g.createLinearGradient(a * px - x0, 0, b * px - x0, 0);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,1)');
            g.globalCompositeOperation = 'destination-in';
            g.fillStyle = grad;
            g.fillRect(0, 0, o.width, H);
            c.drawImage(o, x0, 0);
          });
          const url = strip.toDataURL('image/webp', q);
          return { w: strip.width, h: strip.height, webp: url.slice('data:image/webp;base64,'.length) };
        },
        { parts, seams: SEAMS, px, to: TRANSIT.to, q: QUALITY.transit },
      )) as { w: number; h: number; webp: string };
      const data = plainWebp(Buffer.from(res.webp, 'base64'));
      await writeFile(path.join(OUT_DIR, 'transit.webp'), data);
      const all = Object.keys(ROUTES) as PageId[];
      manifest.transit = {
        file: 'transit.webp',
        size: [res.w, res.h],
        bytes: data.length,
        from: 0,
        to: TRANSIT.to,
        water: minis.home!.water,
        h: minis.home!.h,
        places: Object.fromEntries(Object.entries(FOCUS).map(([k, u]) => [k, r4(u / TRANSIT.to)])),
        pages: Object.fromEntries(
          all.map((id) => {
            const g = bandGeometry(id);
            return [id, { left: g.left, inside: g.inside, travel: g.travel }];
          }),
        ),
      };
      console.log(`transit    ${res.w} × ${res.h} px · ${(data.length / 1024).toFixed(1)} KB`);
      await page.close();
    } else console.log('transit    not cut (it needs all five places in one run)');
  } finally {
    await browser.close();
  }
  // (only a run that cut every page may say the stills are current)
  if (!ONLY) {
    manifest.inputs = now.hash;
    manifest.inputList = now.list;
  }
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`manifest: ${Object.keys(manifest.stills).length} pages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
