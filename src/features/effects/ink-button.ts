/**
 * Ink blooms from where the pointer enters a button (or a row), and drains out where it leaves.
 * CSS does the bloom (effects.css: the registered --ink-r on a radial gradient, feathered by #ink-feather,
 * masked by the swash stroke). This only moves the bloom's origin (--x/--y), sizes its reach (--rmax), keeps the
 * arrow's label colour in register (--ax/--ay) and blooms keyboard focus from the centre. Without JS the bloom
 * grows from the centre. A button's ink reaches past its farthest corner; a row's wash comes to rest ~80% of the way
 * to the row's far edge, so its tide line stays in view.
 * Idempotent; returns its undo.
 */
const bound = new WeakSet<Element>();

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

export function initInkButtons(root: ParentNode, selector = '.ink-btn, .ink-row'): () => void {
  const els = [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => !bound.has(el));
  const ctrl = new AbortController();
  const { signal } = ctrl;
  for (const el of els) {
    bound.add(el);
    el.addEventListener('pointerenter', (e) => place(el, e.clientX, e.clientY), { signal });
    el.addEventListener('pointerleave', (e) => place(el, e.clientX, e.clientY), { signal });
    el.addEventListener(
      'focusin',
      () => {
        if (el.matches(':focus-visible, :has(:focus-visible)')) centre(el);
      },
      { signal },
    );
  }
  return () => {
    ctrl.abort();
    els.forEach((el) => bound.delete(el));
  };
}
