/**
 * The name's ink settle on a full page load (SPEC-R4A §9.1). Nothing on the first screen is hidden, faded or
 * blurred at first paint: the name ([data-arrive="name"], Home only) is readable the moment it is painted. It
 * only wears a feathered ink edge (#ink-arrive, effects.css) whose displacement this relaxes from 8 to 0 over
 * --dur-settle (400 ms); then html.is-arrived drops the filter. Reduced motion: no edge at all. After a route
 * change (html.is-routed) CSS drops it. If this never runs, the boot script adds .is-arrived after 3 s.
 */
const FEATHER_MAX = 8;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function initArrival(): () => void {
  const html = document.documentElement;
  const name = document.querySelector('[data-arrive="name"]');
  const map = document.querySelector('#ink-arrive feDisplacementMap');
  const dur = parseFloat(getComputedStyle(html).getPropertyValue('--dur-settle')) || 400;
  let raf = 0;
  let last = -1;
  let t0 = 0;
  const setFeather = (px: number) => {
    const v = Math.round(px * 100) / 100;
    if (v !== last) {
      map?.setAttribute('scale', String(v));
      last = v;
    }
  };
  const settle = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    setFeather(0);
    html.classList.add('is-arrived');
  };
  const tick = (now: number) => {
    if (!t0) t0 = now;
    const t = Math.min(1, (now - t0) / dur);
    setFeather(FEATHER_MAX * (1 - easeOut(t)));
    if (t >= 1) settle();
    else raf = requestAnimationFrame(tick);
  };
  if (!name || !map || matchMedia('(prefers-reduced-motion: reduce)').matches || html.classList.contains('is-arrived'))
    settle();
  else raf = requestAnimationFrame(tick);
  // the safety net: whatever happens, the edge is gone after ~2.5 s
  const safety = setTimeout(settle, 2500);
  return () => {
    clearTimeout(safety);
    settle();
  };
}
