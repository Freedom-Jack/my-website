/**
 * ink-name.js
 * The name arrives as wet ink: a soft, bleeding edge that settles to a crisp, pooled one.
 * Animates the shared #ink-name SVG filter (displacement scale + blur) with a resonance curve:
 * fast attack, long decay. Legible by ~0.5 s, fully dry by ~1.3 s.
 * The filter's markup holds the dry values, so without JS (or with reduced motion) the name is simply crisp.
 */
import { nextFrame } from './frame.js';

const START = { scale: 38, blur: 7 };
const DUR = 1300;

// cubic-bezier(.2,.7,.1,1) is close to this exponential settle
const settle = (p) => 1 - Math.pow(2, -9 * p) * (1 - p);

export function inkName(filterId = 'ink-name', { reduced = false, at = null } = {}) {
  const f = document.getElementById(filterId);
  if (!f || reduced) return;
  const disp = f.querySelector('feDisplacementMap');
  const blur = f.querySelector('feGaussianBlur');
  const end = { scale: +disp.getAttribute('scale'), blur: +blur.getAttribute('stdDeviation') };

  const apply = (e) => {
    disp.setAttribute('scale', (START.scale + (end.scale - START.scale) * e).toFixed(2));
    blur.setAttribute('stdDeviation', (START.blur + (end.blur - START.blur) * e).toFixed(2));
  };
  if (at !== null) { apply(settle(Math.min(1, at / DUR))); return; }  // demo-only still frame
  apply(0);
  let t0 = 0;
  const tick = (now) => {
    t0 ||= now;
    const p = Math.min(1, (now - t0) / DUR);
    apply(settle(p));
    if (p < 1) nextFrame(tick);
  };
  nextFrame(tick);
}
