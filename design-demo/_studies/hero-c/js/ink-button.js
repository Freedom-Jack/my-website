/**
 * ink-button.js — ink blooms from the pointer's entry point; a press drops ink rings.
 *   inkButtons(document)   // enhances every .ink-btn
 * CSS does the drawing (@property --r on a radial mask, filtered by #ink-feather);
 * this module only records where the pointer entered/left and spawns press ripples.
 * Without JS the bloom still works on :hover and :focus-visible, from the centre.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

export function inkButtons(root = document) {
  for (const btn of root.querySelectorAll('.ink-btn')) {
    const ink = btn.querySelector('.ink-btn__ink');
    const wet = btn.querySelector('.ink-btn__wet') || ink;
    if (!ink) continue;

    const origin = (e) => {
      const r = ink.getBoundingClientRect();
      btn.style.setProperty('--x', `${(e.clientX - r.left).toFixed(1)}px`);
      btn.style.setProperty('--y', `${(e.clientY - r.top).toFixed(1)}px`);
    };
    // Bloom grows from where the pointer came in and recedes towards where it left.
    btn.addEventListener('pointerenter', origin);
    btn.addEventListener('pointerleave', origin);
    // Keyboard focus blooms from the centre.
    btn.addEventListener('focus', () => {
      if (!btn.matches(':hover')) { btn.style.setProperty('--x', '50%'); btn.style.setProperty('--y', '50%'); }
    });

    btn.addEventListener('pointerdown', (e) => {
      if (reduce.matches) return;
      const r = ink.getBoundingClientRect();
      const drop = document.createElement('span');
      drop.className = 'ink-btn__drop';
      drop.style.setProperty('--dx', `${e.clientX - r.left}px`);
      drop.style.setProperty('--dy', `${e.clientY - r.top}px`);
      drop.append(document.createElement('i'));
      wet.append(drop);
      setTimeout(() => drop.remove(), 1300);
    });
  }
}
