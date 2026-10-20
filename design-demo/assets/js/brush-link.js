// brush-link.js — keeps the dry-brush underline honest: a constant pen speed (long links take
// longer to draw than short ones) and alternating bristle patterns so neighbours never match.
//
//   import { initBrushLinks } from '/assets/js/brush-link.js';
//   const destroy = initBrushLinks();          // every a.brush in the document
//   <a class="brush" href="/work/">Work</a>  // CSS draws it on hover/focus; aria-current keeps it
//
// The drawing itself is CSS (effects.css, background-size in the reading direction, so it also
// flows across wrapped lines). This module only sets --brush-ms and data-brush. Idempotent.

const bound = new WeakSet();
let count = 0;

function measure(a) {
  let w = 0;
  for (const r of a.getClientRects()) w += r.width;   // all line boxes of a wrapped link
  const ms = Math.round(Math.min(980, 340 + w * 0.85));
  a.style.setProperty('--brush-ms', `${ms}ms`);
}

export function initBrushLinks(root = document, selector = 'a.brush') {
  const links = [...root.querySelectorAll(selector)].filter((a) => !bound.has(a));
  for (const a of links) {
    bound.add(a);
    if (!a.dataset.brush) a.dataset.brush = String((count++ % 2) + 1);
    measure(a);
  }
  let t = 0;
  const onResize = () => { clearTimeout(t); t = setTimeout(() => links.forEach(measure), 180); };
  addEventListener('resize', onResize, { passive: true });
  return () => {
    removeEventListener('resize', onResize);
    clearTimeout(t);
    links.forEach((a) => bound.delete(a));
  };
}
