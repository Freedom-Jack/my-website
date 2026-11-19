/**
 * THE VEILS, as the page's own layers (round 6; they were rects in the engine's screen pass).
 *
 * Nothing of the painting stands behind text: behind every block of words the page keeps its own paper, cut from the
 * paper's tile (the engine's grain, plates/sink.ts), in the page's flow, so the browser moves it with the words and no
 * frame is drawn for it. Shown only while the plates are (html[data-plates="on"]); wherever the engine lays the stage
 * on its own canvas (a page change, a narrow window) it draws its own veils, as before.
 *
 * Two kinds:
 *   THE FIRST SCREEN (the header's band of paper, and the title block: [data-landscape="keepout"] or anything in
 *   .strip): as round 6 laid them, patches that end in torn edges of mist (plates/edges.ts), a plain soft edge at
 *   the left where no painting stands. The first screen is the live site's: nothing about its paper changes.
 *
 *   THE BODY (round 7, as corrected after Jack's verdict "everything under the header is just straight downhill
 *   toilet paper": the first field kept solid paper far round every block, and with the words across the whole
 *   frame it whited the painting out): the painting stands at full strength through the whole page, and the words
 *   keep only A BREATH OF MIST. One field for the page, computed from where the words stand:
 *     - behind small text (and a drawing) the mist is strong (PEAK: the words read on any ground, the painting
 *       only a ghost behind them) and thins out to nothing close by, in billows (a slow noise), so the peaks and
 *       roofs stand clear on every side of a block and between two blocks;
 *     - behind display words (a title, a numeral: .h-ink, .num) only a faint breath (LIGHT):
 *       they are read straight on the painting;
 *     - [data-veil="bank"] lays a bank of whole paper the width of the screen behind a section (the tail);
 *     - round words inked INTO the painting (body.css .inked; [data-veil-clear] names a box that holds some) the
 *       mist opens: they stand behind this sheet.
 *   The field is drawn small (one sample per 8 CSS px: mist has no detail finer than that), handed to CSS as the
 *   mask of one sheet of the paper's tile the size of the page, and drawn again whenever the words move (a new
 *   page, a new layout, a fold opened). A margin note is veiled on its own lines.
 */

import { EDGE_W, mountEdges } from './edges';

const CORE = 26; // CSS px of solid paper round a band's lines
const SIDE = EDGE_W; // (the first screen) then a torn edge of mist this wide beside the band (plates/edges.ts)...
const ENDS = 150; // ...and this tall above and below it
const LEFT = 90; // (its left side, where no painting stands: a plain soft edge)
const BAND_TOL = 160; // a run of lines this much wider or narrower than the band above starts its own band
const BAND_MIN = 100; // ...once it is this tall
// the body's field of mist
const CELL = 8; // CSS px per sample of the field
const PEAK = 0.88; // the mist's strength behind small text (the painting a ghost there)
const LIGHT = 0.4; // ...and behind display words: a breath
const PAD = 8; // CSS px of that strength round a block's lines
const THIN = 72; // beyond it the mist thins out to nothing over about this much,
const SWELL = 36; // swelling and shrinking by up to this much in slow billows (about 330 px each)
const RIPPLE = 16; // ...with smaller ones riding on them (about 110 px)
const LIE = 0.75; // a sideways step's share of one up or down: the mist lies in bands
const BANK_PAD = 12; // a bank's whole paper above its section's first line and below its last
const BANK_THIN = 100; // ...and how far its edge thins out
const CLEAR = 80; // the mist closes again over about this much round words inked into the painting (it billows too)
/** Display words: read straight on the painting, with only a breath of mist. */
const DISPLAY = '.h-ink, .num, .next__link';

type Box = [left: number, top: number, right: number, bottom: number];

/** Text folded away (a closed <details>, content-visibility: hidden) is not on the page: it veils nothing. */
function unrendered(pe: Element) {
  const d = pe.closest('details');
  if (d && !(d as HTMLDetailsElement).open && !pe.closest('summary')) return true;
  const cv = (pe as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  return typeof cv === 'function' && !cv.call(pe, { contentVisibilityAuto: true, visibilityProperty: true });
}

/**
 * An element's words and pictures as a few bands down its height (viewport px). `which`: all of them (the first
 * screen's patches), its small text and pictures ('body'), or its display words alone ('display': DISPLAY).
 */
function bandsOf(el: Element, which: 'all' | 'body' | 'display' = 'all'): Box[] {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return [];
  const items: Box[] = [];
  const inside = (q: DOMRect) => !(q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right);
  if (which !== 'display')
    for (const m of el.querySelectorAll('img, svg, video, canvas')) {
      if (m.tagName.toLowerCase() === 'svg' && m.parentElement?.closest('svg')) continue;
      if (which === 'body' && m.closest(DISPLAY)) continue;
      const q = m.getBoundingClientRect();
      if (q.width >= 2 && q.height >= 2 && inside(q)) items.push([q.left, q.top, q.right, q.bottom]);
    }
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(), i = 0; n && i < 900; n = walk.nextNode(), i++) {
    if (!(n as Text).data.trim()) continue;
    const pe = n.parentElement;
    // (a margin note is veiled on its own lines)
    const own = pe?.closest('.margin-note');
    if (!pe || pe.closest('svg') || (own && own !== el && el.contains(own)) || unrendered(pe)) continue;
    if (which !== 'all' && !!pe.closest(DISPLAY) !== (which === 'display')) continue;
    range.selectNodeContents(n);
    for (const q of range.getClientRects())
      if (q.width >= 2 && q.height >= 2 && inside(q)) items.push([q.left, q.top, q.right, q.bottom]);
  }
  items.sort((a, b) => a[1] - b[1]);
  const uni = (a: Box | null, b: Box): Box =>
    a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : [...b];
  const bands: Box[] = [];
  let cur: Box | null = null;
  let nar: Box | null = null;
  for (const q of items) {
    if (!cur) {
      cur = [...q];
      continue;
    }
    if (q[1] < cur[3] - 4 && !nar) {
      cur = uni(cur, q); // beside what is already in the band
      continue;
    }
    if (q[2] > cur[2] + BAND_TOL) {
      // something wider starts below
      if (nar) {
        cur = uni(cur, nar);
        nar = null;
      }
      if (cur[3] - cur[1] >= BAND_MIN) {
        bands.push(cur);
        cur = [...q];
      } else cur = uni(cur, q);
    } else if (q[2] < cur[2] - BAND_TOL) {
      // narrower: a run of it may become a band
      nar = uni(nar, q);
      if (nar[3] - nar[1] >= BAND_MIN) {
        bands.push(cur);
        cur = nar;
        nar = null;
      }
    } else {
      if (nar) {
        cur = uni(cur, nar);
        nar = null;
      }
      cur = uni(cur, q);
    }
  }
  if (nar && cur) cur = uni(cur, nar);
  if (cur) bands.push(cur);
  return bands
    .map((b): Box => [Math.max(b[0], r.left), Math.max(b[1], r.top), Math.min(b[2], r.right), Math.min(b[3], r.bottom)])
    .filter((b) => b[2] > b[0] && b[3] > b[1]);
}

export interface Veils {
  destroy(): void;
}

/** Smooth value noise in two axes (seeded, the same field on every load), -1..1. */
function noise2(seed: number) {
  const hash = (i: number, j: number) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + seed) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const i = Math.floor(x),
      j = Math.floor(y);
    const fx = sm(x - i),
      fy = sm(y - j);
    return (
      (hash(i, j) * (1 - fx) + hash(i + 1, j) * fx) * (1 - fy) +
      (hash(i, j + 1) * (1 - fx) + hash(i + 1, j + 1) * fx) * fy
    );
  };
}

/** The distance from every cell of a `gw` x `gh` grid to the nearest of `boxes` (page px), in cells (a two-pass
 *  chamfer: plenty for mist), a sideways step counting for LIE of one up or down: mist lies in bands, so a cloud
 *  reaches further beside its words than above and below them. Null when there are none. */
function distanceTo(gw: number, gh: number, boxes: Box[]): Float32Array | null {
  if (!boxes.length) return null;
  const INF = 1e6;
  const H = LIE;
  const d = new Float32Array(gw * gh).fill(INF);
  for (const [l, t, r, b] of boxes) {
    const x0 = Math.max(0, Math.floor(l / CELL)),
      x1 = Math.min(gw, Math.ceil(r / CELL));
    const y0 = Math.max(0, Math.floor(t / CELL)),
      y1 = Math.min(gh, Math.ceil(b / CELL));
    for (let y = y0; y < y1; y++) d.fill(0, y * gw + x0, y * gw + x1);
  }
  const D = Math.hypot(H, 1);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      let v = d[i]!;
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1]! + H);
      if (y > 0) {
        v = Math.min(v, d[i - gw]! + 1);
        if (x > 0) v = Math.min(v, d[i - gw - 1]! + D);
        if (x < gw - 1) v = Math.min(v, d[i - gw + 1]! + D);
      }
      d[i] = v;
    }
  for (let y = gh - 1; y >= 0; y--)
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x;
      let v = d[i]!;
      if (v === 0) continue;
      if (x < gw - 1) v = Math.min(v, d[i + 1]! + H);
      if (y < gh - 1) {
        v = Math.min(v, d[i + gw]! + 1);
        if (x < gw - 1) v = Math.min(v, d[i + gw + 1]! + D);
        if (x > 0) v = Math.min(v, d[i + gw - 1]! + D);
      }
      d[i] = v;
    }
  return d;
}

/** What the page's words ask of the mist (page px: left, top, right, bottom). */
interface Words {
  /** small text and drawings: the mist at PEAK */
  body: Box[];
  /** display words: a breath (LIGHT) */
  display: Box[];
  /** whole paper the width of the screen */
  banks: Box[];
  /** words inked into the painting: the mist opens round them */
  clear: Box[];
}

/**
 * The body's field of mist for a page `w` x `h` CSS px: a small canvas whose alpha is the mist's strength, one
 * sample per CELL px.
 */
function drawField(w: number, h: number, words: Words): HTMLCanvasElement | null {
  const gw = Math.max(1, Math.ceil(w / CELL)),
    gh = Math.max(1, Math.ceil(h / CELL));
  const c = document.createElement('canvas');
  c.width = gw;
  c.height = gh;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const body = distanceTo(gw, gh, words.body),
    display = distanceTo(gw, gh, words.display),
    banks = distanceTo(gw, gh, words.banks);
  const swell = noise2(7),
    ripple = noise2(31);
  // full strength on the words, then thinning out to nothing over `reach` px
  const fall = (cells: number, peak: number, reach: number) => {
    const px = cells * CELL;
    if (px <= 0) return peak;
    if (px >= reach) return 0;
    const t = px / reach;
    return peak * (1 - t * t * (3 - 2 * t));
  };
  const img = ctx.createImageData(gw, gh);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      // how far the mist reaches here: a slow swell and a ripple on it (the billows of a cloud's edge)
      const billow =
        SWELL * swell((x * CELL) / 520, (y * CELL) / 210) + RIPPLE * ripple((x * CELL) / 170, (y * CELL) / 70);
      let a = 0;
      if (body) a = fall(body[i]!, PEAK, Math.max(30, THIN + billow));
      if (display) a = Math.max(a, fall(display[i]!, LIGHT, Math.max(24, (THIN + billow) * 0.7)));
      if (banks) a = Math.max(a, fall(banks[i]!, 1, Math.max(60, BANK_THIN + billow * 1.5)));
      img.data[i * 4 + 3] = Math.round(255 * a);
    }
  // the clearings: no mist over words inked into the painting, closing again over about CLEAR px round them (a
  // billowing edge, never a ruled one); a neighbour's own lines keep theirs
  const FAR = CLEAR + RIPPLE;
  for (const [l, t, r, b] of words.clear) {
    const x0 = Math.max(0, Math.floor((l - FAR) / CELL)),
      x1 = Math.min(gw, Math.ceil((r + FAR) / CELL));
    const y0 = Math.max(0, Math.floor((t - FAR) / CELL)),
      y1 = Math.min(gh, Math.ceil((b + FAR) / CELL));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * gw + x;
        if ((body && body[i] === 0) || (banks && banks[i] === 0)) continue;
        const cx = (x + 0.5) * CELL,
          cy = (y + 0.5) * CELL;
        const reach = CLEAR + RIPPLE * ripple(cx / 110, cy / 110);
        const k = Math.min(1, Math.hypot(Math.max(l - cx, 0, cx - r), Math.max(t - cy, 0, cy - b)) / reach);
        img.data[i * 4 + 3] = Math.round(img.data[i * 4 + 3]! * k * k * (3 - 2 * k));
      }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function createVeils(): Veils {
  const root = document.createElement('div');
  root.className = 'veils';
  root.setAttribute('aria-hidden', 'true');
  const head = document.createElement('div');
  head.className = 'veil veil--head';
  // the body's one sheet of mist (its mask is the field)
  const field = document.createElement('div');
  field.className = 'veil-field';
  root.append(head, field);
  document.body.prepend(root);

  const dropEdges = mountEdges();
  let timer = 0;
  let dead = false;
  let last = '';
  let lastField = '';
  let fieldUrl = '';
  let fieldSeq = 0;
  const pool: HTMLElement[] = [];

  function measure() {
    timer = 0;
    if (dead) return;
    const main = document.getElementById('main');
    const y = window.scrollY || 0;
    const x = window.scrollX || 0;
    const docW = document.documentElement.clientWidth;

    // ---- the first screen's patches (round 6's)
    const hero = new Set<Element>();
    if (main) for (const el of main.querySelectorAll('[data-landscape="keepout"], .strip [data-veil]')) hero.add(el);
    // (beside a block the paper reaches further on a wide window, where the painting is larger)
    const wide = Math.min(1.5, Math.max(1, innerWidth / 1440));
    const boxes: number[][] = [];
    const side = Math.round(SIDE * wide);
    for (const el of hero) {
      if (!el.isConnected) continue;
      for (const b of bandsOf(el)) {
        // (the patch: the band's lines and CORE round them, solid; then its edges)
        boxes.push([
          Math.round(b[0] + x - CORE - LEFT),
          Math.round(b[1] + y - CORE - ENDS),
          Math.round(b[2] + x + CORE + side),
          Math.round(b[3] + y + CORE + ENDS),
          side,
        ]);
      }
    }
    const key = JSON.stringify(boxes);
    if (key !== last) {
      last = key;
      while (pool.length < boxes.length) {
        const d = document.createElement('div');
        d.className = 'veil veil--hero';
        d.append(document.createElement('i'));
        root.append(d);
        pool.push(d);
      }
      pool.forEach((d, i) => {
        const b = boxes[i];
        if (!b) {
          d.style.display = 'none';
          return;
        }
        d.style.display = '';
        d.style.left = `${b[0]}px`;
        d.style.top = `${b[1]}px`;
        d.style.width = `${b[2]! - b[0]!}px`;
        d.style.height = `${b[3]! - b[1]!}px`;
        d.style.setProperty('--side', `${b[4]}px`);
        // (each patch takes its edges from another part of the tiles: neighbours never match)
        d.style.setProperty('--at', `${-((i * 397 + b[1]!) % 1536)}px`);
      });
    }

    // ---- the body's field of mist (round 7)
    const words: Words = { body: [], display: [], banks: [], clear: [] };
    const body = new Set<Element>();
    if (main) for (const el of main.querySelectorAll('[data-veil]')) if (!hero.has(el)) body.add(el);
    for (const el of document.querySelectorAll('.site-footer[data-veil], .site-footer [data-veil]')) body.add(el);
    for (const el of [...body]) for (const n of el.querySelectorAll('.margin-note')) body.add(n);
    const foot = document.querySelector('.site-footer');
    const end = Math.round(
      (foot ?? main ?? document.body).getBoundingClientRect().bottom + y, // (the page's own end: the sheet adds no scroll)
    );
    const at = (b: Box, pad: number): Box => [b[0] + x - pad, b[1] + y - pad, b[2] + x + pad, b[3] + y + pad];
    for (const el of body) {
      if (!el.isConnected) continue;
      if (el.getAttribute('data-veil') === 'bank') {
        const r = el.getBoundingClientRect();
        if (r.height >= 2) words.banks.push([0, r.top + y - BANK_PAD, docW, r.bottom + y + BANK_PAD]);
        continue;
      }
      for (const b of bandsOf(el, 'body')) words.body.push(at(b, PAD));
      for (const b of bandsOf(el, 'display')) words.display.push(at(b, PAD / 2));
    }
    if (main)
      for (const el of main.querySelectorAll('.inked, [data-veil-clear]'))
        for (const b of bandsOf(el)) words.clear.push(at(b, 0));
    const round = (bs: Box[]) => bs.map((b) => b.map(Math.round));
    const fkey = `${docW}|${end}|${JSON.stringify([words.body, words.display, words.banks, words.clear].map(round))}`;
    if (fkey === lastField) return;
    lastField = fkey;
    field.style.height = `${end}px`;
    if (!words.body.length && !words.display.length && !words.banks.length) {
      field.style.display = 'none';
      return;
    }
    const canvas = drawField(docW, end, words);
    if (!canvas) return;
    const seq = ++fieldSeq;
    canvas.toBlob((blob) => {
      if (!blob || dead || seq !== fieldSeq) return;
      const old = fieldUrl;
      fieldUrl = URL.createObjectURL(blob);
      field.style.display = '';
      field.style.setProperty('--field', `url("${fieldUrl}")`);
      if (old) setTimeout(() => URL.revokeObjectURL(old), 2000);
    });
  }
  const refresh = () => {
    if (dead || timer) return;
    timer = window.setTimeout(measure, 60);
  };

  // a new layout: the page's own size, its fonts, a fold opened; a new page: <main> replaced
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(refresh) : null;
  let watched: Element | null = null;
  const watch = () => {
    const main = document.getElementById('main');
    if (main === watched) return;
    if (watched) ro?.unobserve(watched);
    watched = main;
    if (main) ro?.observe(main);
    last = '';
    refresh();
  };
  const mo = new MutationObserver(watch);
  mo.observe(document.body, { childList: true });
  addEventListener('resize', refresh, { passive: true });
  document.fonts?.addEventListener?.('loadingdone', refresh);
  document.addEventListener('toggle', refresh, true);
  document.addEventListener('ink:veils', refresh); // (a block that grows without moving the page: the ask line's inscription)
  watch();
  refresh();

  return {
    destroy() {
      dead = true;
      clearTimeout(timer);
      ro?.disconnect();
      mo.disconnect();
      removeEventListener('resize', refresh);
      document.fonts?.removeEventListener?.('loadingdone', refresh);
      document.removeEventListener('toggle', refresh, true);
      document.removeEventListener('ink:veils', refresh);
      dropEdges();
      if (fieldUrl) URL.revokeObjectURL(fieldUrl);
      root.remove();
    },
  };
}
