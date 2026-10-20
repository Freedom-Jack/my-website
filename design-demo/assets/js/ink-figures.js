// ink-figures.js — key numbers ink in once, like a drop spreading into paper: a capillary front
// blooms from one point, the pigment starts as a pale indigo wash and dries to burnt ink.
//
//   import { initInkFigures } from '/assets/js/ink-figures.js';
//   const destroy = initInkFigures();
//   <span class="ink-figure" data-ink-figure data-ink-delay="120"><span>~90%</span></span>
//   optional: style="--ink-at: 30% 60%"  where the drop lands (default 32% 64%)
//
// One-shot (shared trigger/settle rules with mist-reveal.js: settled by 60% up the viewport).
// Each figure gets its own clone of #ink-feather so the capillary edge can relax to crisp
// as the ink settles, without affecting other figures. The pigment starts as the indigo wash and
// dries to the figure's own resting colour (read from its computed style), so a figure set in a
// lighter ink never snaps at the end.
// The wet bloom: while the glyphs ink in, a pale indigo copy of them (.ink-figure__bloom, aria-hidden,
// behind the glyphs, under the same capillary edge plus a 5 px blur) spreads past the letterforms
// from the drop's point and dries away over 1.4 s. While inking, the text sits in a temporary inner
// span (.ink-figure__wet), so the glyphs' edge filter and the bloom's own filter stay separate. Both
// are removed when the bloom ends, or at once on settle, which finishes everything (no text is ever
// left blurred). Reduced motion: a plain fade, no bloom.

import { onScrollIn, reached } from './mist-reveal.js';

const bound = new WeakSet();
const SVGNS = 'http://www.w3.org/2000/svg';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid = 0;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const ms = (name, fallback) => parseFloat(cssVar(name)) || fallback;
const BLOOM_MS = 1400;

function edgeFilter() {
  const base = document.getElementById('ink-feather');
  if (!base) return null;
  const f = base.cloneNode(true);
  f.id = `ink-figure-edge-${++uid}`;
  base.parentNode.append(f);
  const map = f.querySelector('feDisplacementMap');
  return { f, map, max: Number(map?.getAttribute('scale')) || 16 };
}

export function initInkFigures(root = document) {
  if (!('IntersectionObserver' in window)) return () => {};
  const els = [...root.querySelectorAll('[data-ink-figure]')].filter((el) => !bound.has(el));
  if (!els.length) return () => {};
  const live = new Map(); // el -> { anim, edge, raf }

  function stop(el) {
    const s = live.get(el);
    if (!s) return;
    cancelAnimationFrame(s.raf);
    s.anim?.finish();
    s.wet?.finish();
  }

  function ink(el) {
    if (!el.classList.contains('is-pending')) return;
    const glyphs = el.querySelector(':scope > span:not(.ink-figure__bloom)');
    if (!glyphs) { el.classList.remove('is-pending'); return; }
    el.classList.remove('is-pending');
    const delay = Number(el.dataset.inkDelay) || 0;

    if (reduced()) {
      glyphs.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay, fill: 'backwards' });
      return;
    }

    const duration = ms('--dur-ink-in', 1100);
    const rest = getComputedStyle(glyphs).color;   // the colour it dries to: its own, so the end is seamless
    const edge = edgeFilter();
    el.classList.add('is-inking');

    // While it inks, the text sits in a wet layer: the layer spreads (mask), blurs and changes colour,
    // and the glyphs' capillary edge (the cloned filter) roughens all of that, as one shape.
    const layer = document.createElement('span');
    layer.className = 'ink-figure__wet';
    layer.append(...glyphs.childNodes);
    glyphs.append(layer);
    if (edge) glyphs.style.filter = `url(#${edge.f.id})`;

    const anim = layer.animate([
      { '--ink-bloom': '0%', color: cssVar('--wash'), filter: 'blur(5px)', opacity: 0.4 },
      { opacity: 1, offset: 0.3 },
      { '--ink-bloom': '170%', color: rest, filter: 'blur(0px)', opacity: 1 },
    ], { duration, delay, easing: 'cubic-bezier(.25, .6, .15, 1)', fill: 'both' });

    // The wet bloom: the same glyphs behind, under the same capillary edge plus a 5 px blur. Its
    // opacity applies after its own filters, so the halo keeps its full strength and soft fringe.
    const bloom = document.createElement('span');
    bloom.className = 'ink-figure__bloom';
    bloom.setAttribute('aria-hidden', 'true');
    bloom.textContent = layer.textContent;
    if (edge) bloom.style.filter = `url(#${edge.f.id}) blur(5px)`;
    el.prepend(bloom);
    const wet = bloom.animate([
      { transform: 'scale(.9)', opacity: 0, easing: 'cubic-bezier(.2, .6, .3, 1)' },
      { transform: 'scale(1.03)', opacity: 0.32, offset: 0.25, easing: 'cubic-bezier(.3, .45, .35, 1)' },
      { transform: 'scale(1.12)', opacity: 0 },
    ], { duration: BLOOM_MS, delay, fill: 'both' });

    const state = { anim, wet, edge, raf: 0 };
    live.set(el, state);
    // the capillary edge relaxes as the ink settles: full wicking while it spreads, crisp at rest
    const tick = () => {
      const t = anim.currentTime == null ? 1 : Math.max(0, (anim.currentTime - delay) / duration);
      if (edge?.map) edge.map.setAttribute('scale', (edge.max * Math.pow(1 - Math.min(1, t), 1.6)).toFixed(2));
      if (t < 1) state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);

    const cleanup = () => {
      cancelAnimationFrame(state.raf);
      anim.cancel(); // the final frame equals the natural style, so this is seamless
      glyphs.append(...layer.childNodes);
      layer.remove();
      bloom.remove();
      glyphs.style.removeProperty('filter');
      if (!glyphs.getAttribute('style')) glyphs.removeAttribute('style');
      el.classList.remove('is-inking');
      edge?.f.remove();
      live.delete(el);
    };
    const settled = (a) => a.finished.catch(() => {});
    Promise.all([settled(anim), settled(wet)]).then(cleanup);
  }

  const watcher = onScrollIn({
    play: ink,
    settle(el, atInit) {
      if (atInit) return;
      if (el.classList.contains('is-pending')) { el.classList.remove('is-pending'); return; }
      stop(el);
    },
  });

  for (const el of els) {
    bound.add(el);
    if (!reached(el)) el.classList.add('is-pending');
    watcher.add(el);
  }

  return () => {
    watcher.destroy();
    for (const el of els) {
      bound.delete(el);
      stop(el);
      el.classList.remove('is-pending');
    }
  };
}
