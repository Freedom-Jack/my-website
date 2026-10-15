/**
 * frame.js
 * requestAnimationFrame with a timer backstop. Whichever fires first wins.
 * Real browsers get rAF timing; environments that throttle rAF to almost nothing
 * (headless capture under virtual time, some embedded webviews) still get ~30 fps.
 * Hidden tabs are handled by the callers, which stop scheduling on visibilitychange.
 */
export function nextFrame(cb, backstopMs = 34) {
  let done = false, raf = 0, timer = 0;
  const run = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    cb(performance.now());
  };
  raf = requestAnimationFrame(run);
  timer = setTimeout(run, backstopMs);
  return () => { done = true; cancelAnimationFrame(raf); clearTimeout(timer); };
}
