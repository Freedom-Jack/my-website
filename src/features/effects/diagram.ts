/**
 * Diagram strokes draw in, once (SPEC-R4A §9.7; they are not text, so they keep their draw-in).
 *   <svg data-draw> … <path class="diagram__edge" pathLength="1" data-order="1" d="…"/> …
 * When the element's top crosses 90% of the viewport its strokes draw in flow order (stroke-dashoffset 1 → 0
 * over --dur-draw each, --draw-step apart; strokes sharing a data-order draw together), and everything is drawn by
 * the time it is 60% up the viewport, or at once if it was jumped past. Anything on screen at init is drawn at rest.
 * Drawn at rest: reduced motion, Still, no JS, print, forced colours. Labels, nodes and bands never move.
 * Print: every "Read as steps" list prints, open or closed (components.css + printSteps below).
 */
const TRIGGER = 0.9;
const SETTLE = 0.4;
const bound = new WeakSet<Element>();

const reached = (el: Element) => el.getBoundingClientRect().top < innerHeight;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = () => document.documentElement.classList.contains('is-still');
const token = (name: string, fallback: number) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || fallback;

function groups(el: Element): Element[][] {
  const by = new Map<number, Element[]>();
  for (const s of el.querySelectorAll('[data-order]')) {
    const k = Number(s.getAttribute('data-order')) || 0;
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(s);
  }
  return [...by.keys()].sort((a, b) => a - b).map((k) => by.get(k)!);
}

function draw(el: Element) {
  const dur = token('--dur-draw', 520);
  const step = token('--draw-step', 90);
  const easing = 'cubic-bezier(.2, .7, .1, 1)';
  const strokes = groups(el);
  if (!strokes.length) {
    el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], {
      duration: dur,
      easing,
      fill: 'backwards',
    });
    return;
  }
  strokes.forEach((group, i) => {
    for (const s of group) {
      s.animate(
        [
          { strokeDasharray: '1 2', strokeDashoffset: 1.001 },
          { strokeDasharray: '1 2', strokeDashoffset: 0 },
        ],
        { duration: dur, delay: i * step, easing, fill: 'backwards' },
      );
    }
  });
}

const animations = (el: Element) => [el, ...el.querySelectorAll('[data-order]')].flatMap((n) => n.getAnimations());

function printSteps(root: ParentNode): () => void {
  const steps = [...root.querySelectorAll<HTMLDetailsElement>('details.diagram__steps')];
  if (!steps.length) return () => {};
  let opened: HTMLDetailsElement[] = [];
  const before = () => {
    opened = steps.filter((d) => d.isConnected && !d.open);
    for (const d of opened) d.open = true;
  };
  const after = () => {
    for (const d of opened.splice(0)) d.open = false;
  };
  addEventListener('beforeprint', before);
  addEventListener('afterprint', after);
  return () => {
    removeEventListener('beforeprint', before);
    removeEventListener('afterprint', after);
    after();
  };
}

export function initDiagrams(root: ParentNode): () => void {
  const unprint = printSteps(root);
  const els = [...root.querySelectorAll('[data-draw]')].filter((el) => !bound.has(el));
  if (!els.length) return unprint;
  for (const el of els) bound.add(el);
  if (reduced() || still() || !('IntersectionObserver' in window)) {
    return () => {
      unprint();
      for (const el of els) bound.delete(el);
    };
  }
  const zone = (f: number) => `100000px 0px -${Math.round((1 - f) * 100)}% 0px`;
  const trig = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        trig.unobserve(e.target);
        if (!e.target.classList.contains('is-pending')) continue;
        e.target.classList.remove('is-pending');
        draw(e.target);
      }
    },
    { rootMargin: zone(TRIGGER) },
  );
  const done = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        done.unobserve(e.target);
        trig.unobserve(e.target);
        if (e.target.classList.contains('is-pending')) e.target.classList.remove('is-pending');
        else for (const a of animations(e.target)) a.finish();
      }
    },
    { rootMargin: zone(SETTLE) },
  );
  for (const el of els) {
    if (reached(el)) continue; // on screen (or passed) at init: drawn at rest
    el.classList.add('is-pending');
    trig.observe(el);
    done.observe(el);
  }
  return () => {
    unprint();
    trig.disconnect();
    done.disconnect();
    for (const el of els) {
      bound.delete(el);
      el.classList.remove('is-pending');
      for (const a of animations(el)) a.finish();
    }
  };
}
