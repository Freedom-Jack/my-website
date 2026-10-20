// main.js — wires the hero study together. Each effect is a self-contained module.
import { initShanshui } from './shanshui.js';
import { inkButton } from './ink-button.js';
import { mistReveal } from './mist-reveal.js';

const root = document.documentElement;
const canvas = document.querySelector('.shanshui');

async function fallback() {
  root.classList.remove('has-gl');
  root.classList.add('no-gl');
  const { paintFallback } = await import('./shanshui-fallback.js');
  // a canvas that ever held a WebGL context cannot give a 2D one, so paint on a fresh copy
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  paintFallback(fresh);
}

// Arrival clock.
//  - DEMO ONLY: ?t=<ms> freezes the arrival at that moment, for exact screenshots
//    (?y=<px>, which pre-scrolls, is an inline script at the end of index.html).
//  - Automated browsers (WebDriver / headless) get the settled state at first paint: their
//    clocks are unreliable, and link previews or agents should see the finished page.
//    Same content either way; only the animation is skipped.
const params = new URLSearchParams(location.search);
const automated = navigator.webdriver === true || /HeadlessChrome/.test(navigator.userAgent);
const freezeAt = params.has('t') ? Number(params.get('t')) : automated ? 4000 : undefined;

let land = null;
if (canvas) {
  try {
    land = initShanshui(canvas, { veil: document.querySelectorAll('[data-veil]'), freezeAt });
  } catch (err) {
    console.warn(err);
  }
  if (land) {
    root.classList.add('has-gl');
    canvas.addEventListener('shanshui:lost', fallback, { once: true });
  } else {
    fallback();
  }
}

document.querySelectorAll('.ink-btn').forEach(inkButton);
mistReveal();

// The name settles out of a displacement filter; drop the filters once it is done (they cost paint).
if (freezeAt === undefined) {
  setTimeout(() => root.classList.add('intro-done'), 1500);
} else {
  const freeze = () => {
    for (const a of document.getAnimations()) {
      if (a.timeline === document.timeline) { a.pause(); a.currentTime = freezeAt; }
    }
    const svg = document.querySelector('svg.defs');
    svg?.pauseAnimations();
    svg?.setCurrentTime(freezeAt / 1000);
  };
  freeze();
  requestAnimationFrame(freeze);
  if (freezeAt >= 1500) root.classList.add('intro-done');
}

