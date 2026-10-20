/**
 * ink-button.js
 * Ink-bloom buttons. CSS does the bloom (@property --r on a radial mask, feathered by #ink-edge);
 * this module only records where the pointer came in, and drops two diminishing water rings on press.
 */
const RINGS = [
  { delay: 0, dur: 760, from: .12, to: 1, alpha: .9 },
  { delay: 120, dur: 900, from: .08, to: .72, alpha: .55 },
];

export function inkButtons(selector = '.ink-btn', { reduced = false } = {}) {
  for (const btn of document.querySelectorAll(selector)) {
    const ink = btn.querySelector('.ink-btn__ink');
    const at = (e) => {
      const r = btn.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    btn.addEventListener('pointerenter', (e) => {
      const [x, y] = at(e);
      btn.style.setProperty('--x', `${x}px`);
      btn.style.setProperty('--y', `${y}px`);
    });
    const drop = (x, y) => {
      if (reduced || !ink) return;
      for (const r of RINGS) {
        const el = document.createElement('span');
        el.className = 'ink-ring';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        ink.append(el);
        el.animate(
          [{ transform: `scale(${r.from})`, opacity: r.alpha }, { transform: `scale(${r.to})`, opacity: 0 }],
          { duration: r.dur, delay: r.delay, easing: 'cubic-bezier(.2,.7,.1,1)', fill: 'both' },
        ).finished.then(() => el.remove(), () => el.remove());
      }
    };
    btn.addEventListener('pointerdown', (e) => drop(...at(e)));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') drop(btn.offsetWidth / 2, btn.offsetHeight / 2);
    });
  }
}
