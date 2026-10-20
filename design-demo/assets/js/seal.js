// seal.js — the header's cinnabar seal is stamped once per browser session, then simply sits there.
//
//   import { initSeal } from '/assets/js/seal.js';
//   const destroy = initSeal();
//
// The stamp is a CSS animation (effects.css) on the HOME LINK's seal only, and only while <html> lacks
// .is-sealed. The inline boot script in <head> adds .is-sealed before first paint when this session has
// already seen the stamp, so later pages never flash it. This module records the stamp.
// The About-me signature's seal (.seal--sign) is never stamped and never moves.

const KEY = 'ink:sealed';
let done = false;

export function initSeal(root = document) {
  const mark = root.querySelector('.home-link .seal__mark');
  const html = document.documentElement;
  if (!mark || done) return () => {};
  done = true;
  try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode: it will simply stamp again */ }
  if (html.classList.contains('is-sealed')) return () => { done = false; };
  const settle = () => html.classList.add('is-sealed');
  mark.addEventListener('animationend', settle, { once: true });
  // fallback when no animationend comes (animations off); never cut a stamp that is still playing or held
  const t = setTimeout(() => {
    if (!mark.getAnimations().some((a) => a.playState === 'running' || a.playState === 'paused')) settle();
  }, 2000);
  return () => { done = false; clearTimeout(t); mark.removeEventListener('animationend', settle); };
}
