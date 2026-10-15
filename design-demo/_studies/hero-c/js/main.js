/** Hero study C: wires the self-contained effect modules. */
import { mountShanshui } from './shanshui-svg.js';
import { inkButtons } from './ink-button.js';
import { emergeName } from './name-emerge.js';
import { mistReveal, inkIn } from './mist-reveal.js';
import { stampSeal } from './seal.js';

const params = new URLSearchParams(location.search);
// Demo-only: ?t=<ms> freezes the arrival at that moment, for screenshots of the load-in.
const freezeAt = params.has('t') ? Number(params.get('t')) : undefined;

emergeName(document.querySelector('.name'), { at: freezeAt });
stampSeal(document.querySelector('.seal'));
mountShanshui(document.querySelector('.shanshui'), { seed: 1207 });
inkButtons(document);
mistReveal('.mist-in');
inkIn('[data-ink-in]');

if (freezeAt !== undefined) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const a of document.getAnimations()) {
      if (a.timeline !== document.timeline) continue; // scroll-driven ones stay live
      a.pause();
      a.currentTime = freezeAt;
    }
  }));
}

// Demo-only: ?y=<px> pre-scrolls so headless screenshots can capture lower sections
// (scrolls the body, see html.demo-y in study.css).
const y = Number(params.get('y'));
if (y > 0) {
  document.documentElement.classList.add('demo-y');
  const go = () => { document.body.scrollTop = y; };
  requestAnimationFrame(go);
  addEventListener('load', go);
  document.fonts?.ready.then(go);
}
