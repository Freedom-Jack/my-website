/**
 * landscape-fallback.js
 * Static Canvas 2D painting of the same ridge planes, for browsers without WebGL2
 * (or after a lost context). No simulation: soft crest-dark washes, empty stretches where
 * the brush skipped (the same paint mask as the shader), and mist at the foot of the screen.
 */
import { LAYERS, SAMPLES, buildHeights } from './ridges.js';

const PAPER = '#eff1ee';

export function paintFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const layer = document.createElement('canvas');
  const lctx = layer.getContext('2d');

  function draw() {
    const box = canvas.getBoundingClientRect();
    const w = Math.round(box.width) || window.innerWidth, h = Math.round(box.height) || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    for (const c of [canvas, layer]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    const H = buildHeights(w / h);
    const at = (i, k, c) => H[(i * SAMPLES + k) * 2 + c];
    LAYERS.forEach((L, i) => {
      let top = h;
      for (let k = 0; k < SAMPLES; k++) top = Math.min(top, h * (1 - at(i, k, 0)));
      // mist pooled behind this ridge
      if (L.fog) {
        const g = ctx.createLinearGradient(0, top - h * .12, 0, top + h * .08);
        g.addColorStop(0, 'rgba(239,241,238,0)');
        g.addColorStop(1, `rgba(239,241,238,${L.fog * .8})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, top - h * .12, w, h);
      }
      // the wash: dark at the crest, gone into mist a short way below
      lctx.clearRect(0, 0, w, h);
      lctx.beginPath();
      lctx.moveTo(0, h);
      for (let k = 0; k < SAMPLES; k += 2) lctx.lineTo((k / (SAMPLES - 1)) * w, h * (1 - at(i, k, 0)));
      lctx.lineTo(w, h);
      lctx.closePath();
      const reach = h * L.fall * 3.2;
      const g = lctx.createLinearGradient(0, top, 0, top + reach * 2.4);
      const a = (x) => `${L.ink}${Math.round(Math.min(1, x) * 255).toString(16).padStart(2, '0')}`;
      g.addColorStop(0, a(L.tone * .85));
      g.addColorStop(.35, a(L.tone * .35));
      g.addColorStop(1, a(0));
      lctx.fillStyle = g;
      lctx.filter = `blur(${(1 - L.tone) * 2.2}px)`;
      lctx.fill();
      lctx.filter = 'none';
      // empty space: fade the plane out where the brush skipped
      const m = lctx.createLinearGradient(0, 0, w, 0);
      for (let k = 0; k <= 32; k++) {
        const s = Math.round((k / 32) * (SAMPLES - 1));
        m.addColorStop(k / 32, `rgba(0,0,0,${Math.min(1, at(i, s, 1) * 1.2)})`);
      }
      lctx.globalCompositeOperation = 'destination-in';
      lctx.fillStyle = m;
      lctx.fillRect(0, 0, w, h);
      lctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(layer, 0, 0, w, h);
    });
    // the foot of the screen dissolves into mist
    const foot = ctx.createLinearGradient(0, h * .82, 0, h);
    foot.addColorStop(0, 'rgba(239,241,238,0)');
    foot.addColorStop(1, 'rgba(239,241,238,.9)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, h * .82, w, h * .18);
  }

  draw();
  let t;
  const onResize = () => { clearTimeout(t); t = setTimeout(draw, 150); };
  window.addEventListener('resize', onResize);
  canvas.dataset.renderer = 'canvas2d';
  return { setSafeRect() {}, destroy() { window.removeEventListener('resize', onResize); } };
}
