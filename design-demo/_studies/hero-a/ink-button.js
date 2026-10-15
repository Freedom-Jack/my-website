// ink-button.js — ink blooms into the button from the point where the pointer enters,
// recedes towards where it leaves; a press drops ink that sends out fading rings.
//
//   document.querySelectorAll('.ink-btn').forEach(inkButton);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function place(el, clientX, clientY) {
  const r = el.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  el.style.setProperty('--x', `${x}px`);
  el.style.setProperty('--y', `${y}px`);
  // radius that reaches the farthest corner from the entry point (+ feathered rim)
  const fx = Math.max(x, r.width - x);
  const fy = Math.max(y, r.height - y);
  el.style.setProperty('--rmax', `${Math.hypot(fx, fy) + 40}px`);
}

function drop(el, clientX, clientY) {
  if (reduced()) return;
  const r = el.getBoundingClientRect();
  const x = clientX - r.left;
  const y = clientY - r.top;
  // one ink drop, then two diminishing rings: fast attack, long decay
  ['ink-drop', 'ink-ring', 'ink-ring'].forEach((cls, i) => {
    const s = document.createElement('span');
    s.className = cls;
    s.setAttribute('aria-hidden', 'true');
    s.style.cssText = `left:${x}px;top:${y}px;--i:${i}`;
    s.addEventListener('animationend', () => s.remove(), { once: true });
    el.append(s);
  });
}

export function inkButton(el) {
  el.addEventListener('pointerenter', (e) => place(el, e.clientX, e.clientY));
  el.addEventListener('pointerleave', (e) => place(el, e.clientX, e.clientY));
  el.addEventListener('pointerdown', (e) => drop(el, e.clientX, e.clientY));
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const r = el.getBoundingClientRect();
    drop(el, r.left + r.width / 2, r.top + r.height / 2);
  });
  el.addEventListener('focus', () => {
    if (el.matches(':focus-visible')) {
      const r = el.getBoundingClientRect();
      place(el, r.left + 8, r.top + r.height / 2);
    }
  });
}
