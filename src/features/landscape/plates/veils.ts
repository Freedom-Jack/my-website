/**
 * THE VEILS, as the page's own layers (round 6; they were rects in the engine's screen pass).
 *
 * Nothing of the painting stands behind text: behind every block of words the page keeps its own paper, a patch cut
 * from the paper's tile (the engine's grain, plates/sink.ts) that ends in torn edges of mist (plates/edges.ts), laid
 * on the block's own lines and scrolling with them, so the browser moves it and no frame is drawn for it. The header keeps a band of paper that
 * scrolls away with it. Shown only while the plates are (html[data-plates="on"]); wherever the engine lays the
 * stage on its own canvas (a page change, a narrow window) it draws its own veils, as before.
 *
 * What is veiled: every [data-veil] and [data-landscape="keepout"] block of the page's <main>, the tail's lines,
 * and each margin note on its own; a block is veiled in bands, each the union of its own lines and pictures (a wide
 * diagram over narrow text is veiled wide only beside the diagram).
 */

import { EDGE_W, mountEdges } from './edges';

const CORE = 26; // CSS px of solid paper round a band's lines
const SIDE = EDGE_W; // ...then a torn edge of mist this wide beside the band (plates/edges.ts)...
const ENDS = 150; // ...and this tall above and below it
const LEFT = 90; // (its left side, where no painting stands: a plain soft edge)
const BAND_TOL = 160; // a run of lines this much wider or narrower than the band above starts its own band
const BAND_MIN = 100; // ...once it is this tall

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
    for (const q of range.getClientRects()) if (q.width >= 2 && q.height >= 2 && inside(q)) items.push([q.left, q.top, q.right, q.bottom]);
  }
  items.sort((a, b) => a[1] - b[1]);
  const uni = (a: Box | null, b: Box): Box => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : [...b]);
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

export function createVeils(): Veils {
  const root = document.createElement('div');
  root.className = 'veils';
  root.setAttribute('aria-hidden', 'true');
  const head = document.createElement('div');
  head.className = 'veil veil--head';
  root.append(head);
  document.body.prepend(root);

  const dropEdges = mountEdges();
  let timer = 0;
  let dead = false;
  let last = '';
  const pool: HTMLElement[] = [];

  function measure() {
    timer = 0;
    if (dead) return;
    const main = document.getElementById('main');
    const els = new Set<Element>();
    if (main) for (const el of main.querySelectorAll('[data-veil], [data-landscape="keepout"]')) els.add(el);
    for (const el of document.querySelectorAll('.site-footer .tail__colophon, .site-footer .tail__stamp, .site-footer .tail__base')) els.add(el);
    for (const el of [...els]) for (const n of el.querySelectorAll('.margin-note, [data-veil-own]')) els.add(n);
    const y = window.scrollY || 0;
    const x = window.scrollX || 0;
    // (beside a block the paper reaches further on a wide window, where the painting is larger)
    const wide = Math.min(1.5, Math.max(1, innerWidth / 1440));
    const boxes: number[][] = [];
    const side = Math.round(SIDE * wide);
    for (const el of els) {
      if (!el.isConnected) continue;
      for (const b of bandsOf(el)) {
        // (the patch: the band's lines and CORE round them, solid; then its edges)
        boxes.push([Math.round(b[0] + x - CORE - LEFT), Math.round(b[1] + y - CORE - ENDS), Math.round(b[2] + x + CORE + side), Math.round(b[3] + y + CORE + ENDS), side]);
      }
    }
    const key = JSON.stringify(boxes);
    if (key === last) return;
    last = key;
    while (pool.length < boxes.length) {
      const d = document.createElement('div');
      d.className = 'veil';
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
      d.style.width = `${b[2] - b[0]}px`;
      d.style.height = `${b[3] - b[1]}px`;
      d.style.setProperty('--side', `${b[4]}px`);
      // (each patch takes its edges from another part of the tiles: neighbours never match)
      d.style.setProperty('--at', `${-((i * 397 + b[1]) % 1536)}px`);
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
      root.remove();
    },
  };
}
