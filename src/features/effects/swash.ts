import { elementOn } from '@/features/landscape/elements';

/**
 * swash (features/landscape/elements.ts): the one light along the name's swash, fired when the painting's light is up.
 * The lay itself is CSS, keyed to html.is-arrived (the name's ink settle is done: effects/arrival.ts). The light waits
 * for the engine's 'ink:sunup' (the morning's light has risen, ~1.8 s; a plain bloom's, ~1.24 s) and for the lay to be
 * down (720 ms after is-arrived), then html.swash-light runs it once (jade.css). Only on the load that plays the swash
 * (html.swash-play, set by the boot script once per session on Home); never after a route change, never when quiet
 * (the CSS guards reduced motion and Still). If the engine never says, a timer fires it at ~2.6 s.
 */
const LAY_MS = 720;
const FALLBACK_MS = 2600;

export function initSwash(): () => void {
  const html = document.documentElement;
  if (!html.classList.contains('swash-play') || !elementOn('swash')) return () => {};
  let sun = false,
    arrivedAt = html.classList.contains('is-arrived') ? performance.now() : 0,
    done = false;
  const timers: number[] = [];
  const fire = () => {
    if (done || !sun || !arrivedAt) return;
    const wait = arrivedAt + LAY_MS - performance.now();
    if (wait > 0) {
      timers.push(window.setTimeout(fire, wait + 10));
      return;
    }
    done = true;
    html.classList.add('swash-light');
  };
  const onSun = () => {
    sun = true;
    fire();
  };
  const mo = new MutationObserver(() => {
    if (!arrivedAt && html.classList.contains('is-arrived')) {
      arrivedAt = performance.now();
      fire();
    }
  });
  mo.observe(html, { attributes: true, attributeFilter: ['class'] });
  addEventListener('ink:sunup', onSun);
  timers.push(
    window.setTimeout(() => {
      sun = true;
      if (!arrivedAt) arrivedAt = performance.now() - LAY_MS;
      fire();
    }, FALLBACK_MS),
  );
  return () => {
    mo.disconnect();
    removeEventListener('ink:sunup', onSun);
    timers.forEach(clearTimeout);
  };
}
