/**
 * seal.js — the seal is stamped once per visit (session), then simply sits there.
 *   stampSeal(document.querySelector('.seal'))
 */
export function stampSeal(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let seen = false;
  try {
    seen = sessionStorage.getItem('seal-stamped') === '1';
    sessionStorage.setItem('seal-stamped', '1');
  } catch { /* storage blocked: stamp anyway */ }
  if (!seen) el.classList.add('is-stamping');
}
