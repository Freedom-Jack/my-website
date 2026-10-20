/**
 * Keeps the dry-brush underline honest: a constant pen speed (long links take longer to draw than short ones)
 * and alternating bristle patterns, so neighbours never match. The drawing itself is CSS (effects.css,
 * background-size in the reading direction, so it also flows across wrapped lines); this only sets
 * --brush-ms and data-brush. Idempotent; returns its undo.
 */
const bound = new WeakSet<Element>();
let count = 0;

function measure(a: HTMLElement) {
  let w = 0;
  for (const r of a.getClientRects()) w += r.width; // all line boxes of a wrapped link
  a.style.setProperty('--brush-ms', `${Math.round(Math.min(980, 340 + w * 0.85))}ms`);
}

export function initBrushLinks(root: ParentNode, selector = 'a.brush'): () => void {
  const links = [...root.querySelectorAll<HTMLElement>(selector)].filter((a) => !bound.has(a));
  for (const a of links) {
    bound.add(a);
    if (!a.dataset.brush) a.dataset.brush = String((count++ % 2) + 1);
    measure(a);
  }
  let t = 0;
  const onResize = () => {
    clearTimeout(t);
    t = window.setTimeout(() => links.forEach(measure), 180);
  };
  addEventListener('resize', onResize, { passive: true });
  return () => {
    removeEventListener('resize', onResize);
    clearTimeout(t);
    links.forEach((a) => bound.delete(a));
  };
}
