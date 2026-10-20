/**
 * name-emerge.js — the name resolves out of mist: CSS handles opacity + blur,
 * this tweens the #name-bleed displacement from a feathered, wicking edge to crisp,
 * then removes the filter so the settled name is plain, sharp text.
 *   emergeName(document.querySelector('.name'))
 */
export function emergeName(el, { from = 34, duration = 1050, filter = '#name-bleed', at } = {}) {
  const map = document.querySelector(`${filter} feDisplacementMap`);
  if (!el || !map || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const set = (ms) => {
    const t = Math.min(1, ms / duration);
    const e = 1 - Math.pow(1 - t, 4); // fast attack, long decay
    map.setAttribute('scale', (from * (1 - e)).toFixed(2));
    el.classList.toggle('is-bleeding', t < 1);
    return t < 1;
  };
  if (at !== undefined) { set(at); return; } // frozen frame (demo screenshots)
  const t0 = performance.now();
  const tick = (now) => { if (set(now - t0)) requestAnimationFrame(tick); };
  set(0);
  requestAnimationFrame(tick);
}
