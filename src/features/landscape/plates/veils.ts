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
 *   THE BODY (round 7; everything below the first screen, and the tail): ONE FIELD OF MIST for the whole page. The
 *   words lie across the whole frame now, with the painting on every side of them, and patches with torn edges left
 *   scraps of mountain in the gaps between neighbours. So the mist is computed as one field: every band of a
 *   [data-veil] block's own lines and pictures is solid paper (and CORE round it); beyond that the paper thins out
 *   with the distance to the nearest words, over a length that swells and shrinks with a slow noise (billows), so
 *   blocks that stand close share one cloud, a wide gap opens onto the painting, and no edge is ever a ruled line or
 *   a scrap. [data-veil="bank"] lays a bank the whole width of the screen behind a section (the tail). The field is
 *   drawn small (one sample per 8 CSS px: mist has no detail finer than that), handed to CSS as the mask of one sheet
 *   of the paper's tile the size of the page, and drawn again whenever the words move (a new page, a new layout, a
 *   fold opened).
 *   A margin note, and anything that asks for its own paper ([data-veil-own]), is veiled on its own lines.
 *   Words inked INTO the painting (body.css .inked; [data-veil-clear] names a box that holds some) stand behind this
 *   sheet, so the mist opens round them: a neighbour's cloud never greys a letter of them.
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
const SOLID = 14; // beyond a band's CORE the paper stays whole this far...
const THIN = 125; // ...then thins out to nothing over about this much more,
const SWELL = 80; // swelling and shrinking by up to this much in slow billows (about 330 px each)
const RIPPLE = 34; // ...with smaller ones riding on them (about 110 px)
const BANK_PAD = 30; // a bank's solid paper above its section's first line and below its last
const CLEAR = 80; // the mist closes again over about this much round words inked into the painting (it billows too)

type Box = [left: number, top: number, right: number, bottom: number];

/** Text folded away (a closed <details>, content-visibility: hidden) is not on the page: it veils nothing. */
function unrendered(pe: Element) {
  const d = pe.closest('details');
  if (d && !(d as HTMLDetailsElement).open && !pe.closest('summary')) return true;
  const cv = (pe as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
  return typeof cv === 'function' && !cv.call(pe, { contentVisibilityAuto: true, visibilityProperty: true });
}

/** An element's words and pictures as a few bands down its height (viewport px). */
function bandsOf(el: Element): Box[] {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return [];
  const items: Box[] = [];
  const inside = (q: DOMRect) => !(q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right);
  for (const m of el.querySelectorAll('img, svg, video, canvas')) {
    if (m.tagName.toLowerCase() === 'svg' && m.parentElement?.closest('svg')) continue;
    const q = m.getBoundingClientRect();
    if (q.width >= 2 && q.height >= 2 && inside(q)) items.push([q.left, q.top, q.right, q.bottom]);
  }
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walk.nextNode(), i = 0; n && i < 900; n = walk.nextNode(), i++) {
    if (!(n as Text).data.trim()) continue;
    const pe = n.parentElement;
    // (a margin note, and anything that asks for its own paper, data-veil-own, is veiled on its own lines)
    const own = pe?.closest('.margin-note, [data-veil-own]');
    if (!pe || pe.closest('svg') || (own && own !== el && el.contains(own)) || unrendered(pe)) continue;
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
  /** Measure the page's words again (a new page, a new layout). */
  refresh(): void;
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

/**
 * The body's field of mist for a page `w` x `h` CSS px whose words stand in `cores` (page px: left, top, right,
 * bottom), open over `clear` (words inked into the painting): a small canvas whose alpha is the paper's strength,
 * one sample per CELL px.
 */
function drawField(w: number, h: number, cores: Box[], clear: Box[]): HTMLCanvasElement | null {
  const gw = Math.max(1, Math.ceil(w / CELL)),
    gh = Math.max(1, Math.ceil(h / CELL));
  const c = document.createElement('canvas');
  c.width = gw;
  c.height = gh;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  // the distance to the nearest words, in cells (a two-pass chamfer: plenty for mist)
  const INF = 1e6;
  const d = new Float32Array(gw * gh).fill(INF);
  for (const [l, t, r, b] of cores) {
    const x0 = Math.max(0, Math.floor(l / CELL)),
      x1 = Math.min(gw, Math.ceil(r / CELL));
    const y0 = Math.max(0, Math.floor(t / CELL)),
      y1 = Math.min(gh, Math.ceil(b / CELL));
    for (let y = y0; y < y1; y++) d.fill(0, y * gw + x0, y * gw + x1);
  }
  const D = Math.SQRT2;
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      let v = d[i]!;
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1]! + 1);
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
      if (x < gw - 1) v = Math.min(v, d[i + 1]! + 1);
      if (y < gh - 1) {
        v = Math.min(v, d[i + gw]! + 1);
        if (x < gw - 1) v = Math.min(v, d[i + gw + 1]! + D);
        if (x > 0) v = Math.min(v, d[i + gw - 1]! + D);
      }
      d[i] = v;
    }
  const swell = noise2(7),
    ripple = noise2(31);
  const img = ctx.createImageData(gw, gh);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const px = d[i]! * CELL;
      let a = 1;
      if (px > SOLID) {
        // how far the paper reaches here: a slow swell and a ripple on it (the billows of a cloud's edge)
        const reach =
          THIN +
          SWELL * swell((x * CELL) / 330, (y * CELL) / 330) +
          RIPPLE * ripple((x * CELL) / 110, (y * CELL) / 110);
        const t = Math.min(1, (px - SOLID) / Math.max(40, reach));
        a = 1 - t * t * (3 - 2 * t);
      }
      img.data[i * 4 + 3] = Math.round(255 * a);
    }
  // the clearings: no paper over words inked into the painting, the mist closing again over about CLEAR px round
  // them (a billowing edge, never a ruled one); the lines of a neighbour keep their own paper whole
  const FAR = CLEAR + RIPPLE;
  for (const [l, t, r, b] of clear) {
    const x0 = Math.max(0, Math.floor((l - FAR) / CELL)),
      x1 = Math.min(gw, Math.ceil((r + FAR) / CELL));
    const y0 = Math.max(0, Math.floor((t - FAR) / CELL)),
      y1 = Math.min(gh, Math.ceil((b + FAR) / CELL));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (d[y * gw + x] === 0) continue;
        const cx = (x + 0.5) * CELL,
          cy = (y + 0.5) * CELL;
        const reach = CLEAR + RIPPLE * ripple(cx / 110, cy / 110);
        const k = Math.min(1, Math.hypot(Math.max(l - cx, 0, cx - r), Math.max(t - cy, 0, cy - b)) / reach);
        const j = (y * gw + x) * 4 + 3;
        img.data[j] = Math.round(img.data[j]! * k * k * (3 - 2 * k));
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
    const cores: Box[] = [];
    const body = new Set<Element>();
    if (main) for (const el of main.querySelectorAll('[data-veil]')) if (!hero.has(el)) body.add(el);
    for (const el of document.querySelectorAll('.site-footer[data-veil], .site-footer [data-veil]')) body.add(el);
    for (const el of [...body]) for (const n of el.querySelectorAll('.margin-note, [data-veil-own]')) body.add(n);
    const foot = document.querySelector('.site-footer');
    const end = Math.round(
      (foot ?? main ?? document.body).getBoundingClientRect().bottom + y, // (the page's own end: the sheet adds no scroll)
    );
    for (const el of body) {
      if (!el.isConnected) continue;
      if (el.getAttribute('data-veil') === 'bank') {
        const r = el.getBoundingClientRect();
        if (r.height >= 2) cores.push([0, r.top + y - BANK_PAD, docW, r.bottom + y + BANK_PAD]);
        continue;
      }
      for (const b of bandsOf(el)) cores.push([b[0] + x - CORE, b[1] + y - CORE, b[2] + x + CORE, b[3] + y + CORE]);
    }
    const clear: Box[] = [];
    if (main)
      for (const el of main.querySelectorAll('.inked, [data-veil-clear]'))
        for (const b of bandsOf(el)) clear.push([b[0] + x, b[1] + y, b[2] + x, b[3] + y]);
    const fkey = `${docW}|${end}|${JSON.stringify([cores, clear].map((bs) => bs.map((b) => b.map(Math.round))))}`;
    if (fkey === lastField) return;
    lastField = fkey;
    field.style.height = `${end}px`;
    if (!cores.length) {
      field.style.display = 'none';
      return;
    }
    const canvas = drawField(docW, end, cores, clear);
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
    refresh,
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
