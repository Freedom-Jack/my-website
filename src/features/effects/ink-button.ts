/**
 * Ink blooms from where the pointer enters a button (or a row), and drains out where it leaves.
 * CSS does the bloom (effects.css: the registered --ink-r on a radial gradient, feathered by #ink-feather,
 * masked by the swash stroke). This only moves the bloom's origin (--x/--y), sizes its reach (--rmax), keeps the
 * arrow's label colour in register (--ax/--ay), blooms keyboard focus from the centre, and drops 2–3 decaying
 * rings on press (WAAPI). Without JS the bloom grows from the centre. A button's ink reaches past its farthest
 * corner; a row's wash comes to rest ~80% of the way to the row's far edge, so its tide line stays in view.
 * Idempotent; returns its undo.
 */
import { fxOn } from '@/features/landscape/elements';

const bound = new WeakSet<Element>();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const RINGS = [
  { delay: 0, dur: 720, to: 1.05, alpha: 0.9 },
  { delay: 110, dur: 860, to: 0.78, alpha: 0.55 },
  { delay: 230, dur: 980, to: 0.56, alpha: 0.3 },
];

function place(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  el.style.setProperty('--x', `${x.toFixed(1)}px`);
  el.style.setProperty('--y', `${y.toFixed(1)}px`);
  if (el.classList.contains('ink-row')) {
    // the wash spills into the margin (its ::before is inset by --bleed, a negative length)
    const bleed = Math.abs(parseFloat(getComputedStyle(el, '::before').left) || 0);
    const far = Math.max(x, r.width - x) + bleed;
    el.style.setProperty('--rmax', `${Math.round(far * 0.8)}px`);
  } else {
    const cs = getComputedStyle(el);
    const dx = parseFloat(cs.getPropertyValue('--ink-dx')) || 26;
    const tail = parseFloat(cs.getPropertyValue('--ink-tail')) || dx;
    const dy = parseFloat(cs.getPropertyValue('--ink-dy')) || 15;
    const fx = Math.max(x + dx, r.width - x + tail);
    const fy = Math.max(y, r.height - y) + dy;
    el.style.setProperty('--rmax', `${Math.round(Math.hypot(fx, fy) + 46)}px`);
  }
  const arrow = el.querySelector('.ink-btn__arrow');
  if (arrow) {
    const a = arrow.getBoundingClientRect();
    el.style.setProperty('--ax', `${(a.left - r.left).toFixed(1)}px`);
    el.style.setProperty('--ay', `${(a.top - r.top).toFixed(1)}px`);
  }
}

function centre(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  place(el, r.left + r.width / 2, r.top + r.height / 2);
}

function rings(btn: HTMLElement, clientX: number, clientY: number) {
  if (reduced()) return;
  // (final round: Home's brush button answers a press with value only, jade.css: no rings, no crescent, no hairline)
  if (btn.closest('.strip--home')) return;
  const ink = btn.querySelector('.ink-btn__ink');
  if (!ink) return;
  const r = ink.getBoundingClientRect();
  // paper rings on a bloomed (dark) stroke, ink rings on the pale resting wash (e.g. a touch tap)
  const dark = btn.matches(':hover, :focus-visible');
  for (const ring of RINGS) {
    const el = document.createElement('span');
    el.className = 'ink-btn__ring';
    el.style.left = `${clientX - r.left}px`;
    el.style.top = `${clientY - r.top}px`;
    if (!dark) el.style.setProperty('--ring', 'rgb(17 20 22 / .38)');
    ink.append(el);
    el.animate(
      [
        { transform: 'scale(.08)', opacity: ring.alpha },
        { transform: `scale(${ring.to})`, opacity: 0 },
      ],
      {
        duration: ring.dur,
        delay: ring.delay,
        easing: 'cubic-bezier(.2, .7, .1, 1)',
        fill: 'both',
      },
    ).finished.then(
      () => el.remove(),
      () => el.remove(),
    );
  }
}

export function initInkButtons(root: ParentNode, selector = '.ink-btn, .ink-row'): () => void {
  const els = [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => !bound.has(el));
  const ctrl = new AbortController();
  const { signal } = ctrl;
  for (const el of els) {
    bound.add(el);
    el.addEventListener('pointerenter', (e) => place(el, e.clientX, e.clientY), { signal });
    el.addEventListener(
      'pointerleave',
      (e) => {
        // P4 rowrule: the brushed rule lifts where it lies (its fronts stay put), so the row keeps its entry point
        if (fxOn('rowrule') && el.classList.contains('ink-row')) return;
        place(el, e.clientX, e.clientY);
      },
      { signal },
    );
    el.addEventListener(
      'focusin',
      () => {
        if (el.matches(':focus-visible, :has(:focus-visible)')) centre(el);
      },
      { signal },
    );
    if (el.classList.contains('ink-btn')) {
      el.addEventListener(
        'pointerdown',
        (e) => {
          if (e.button === 0) rings(el, e.clientX, e.clientY);
        },
        { signal },
      );
      el.addEventListener(
        'keydown',
        (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          const r = el.getBoundingClientRect();
          rings(el, r.left + r.width / 2, r.top + r.height / 2);
        },
        { signal },
      );
    }
  }
  return () => {
    ctrl.abort();
    els.forEach((el) => bound.delete(el));
  };
}
