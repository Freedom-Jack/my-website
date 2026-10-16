/**
 * The header's cinnabar seal is stamped once per browser session, then simply sits there. The stamp is a CSS
 * animation (effects.css) on the home link's seal, only while <html> lacks .is-sealed; the boot script adds
 * .is-sealed before first paint when this session has already seen it. This records the stamp.
 * The About-me signature's seal is never stamped and never moves.
 */
const KEY = 'ink:sealed';

export function initSeal(): () => void {
  const mark = document.querySelector('.home-link .seal__mark');
  const html = document.documentElement;
  if (!mark) return () => {};
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* private mode: it will simply stamp again */
  }
  if (html.classList.contains('is-sealed')) return () => {};
  const settle = () => html.classList.add('is-sealed');
  mark.addEventListener('animationend', settle, { once: true });
  // no animationend (animations off): settle, but never cut a stamp that is still playing
  const t = setTimeout(() => {
    if (!mark.getAnimations().some((a) => a.playState === 'running' || a.playState === 'paused')) settle();
  }, 2000);
  return () => {
    clearTimeout(t);
    mark.removeEventListener('animationend', settle);
  };
}
