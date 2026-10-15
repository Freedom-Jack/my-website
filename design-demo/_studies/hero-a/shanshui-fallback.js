// shanshui-fallback.js — static Canvas2D landscape for browsers without WebGL2.
// Same ridge profiles as the shader, painted once as graded washes; CSS adds the mist.

import { buildRidges, layerFeet, LAYERS } from './ridges.js';

const PAPER = [238, 241, 239];
const MIST = [231, 236, 235];
const INK_N = [16, 19, 21];
const INK_F = [62, 86, 100];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

export function paintFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const draw = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const cw = innerWidth;
    const ch = canvas.clientHeight || innerHeight;
    const w = (canvas.width = Math.round(cw * dpr));
    const h = (canvas.height = Math.round(ch * dpr));
    const aspect = cw / ch;
    const samples = 400;
    const ridges = buildRidges(samples, aspect);
    const feet = layerFeet(aspect);
    ctx.fillStyle = rgba(PAPER);
    ctx.fillRect(0, 0, w, h);
    ctx.filter = 'blur(1px)';
    LAYERS.forEach((_, l) => {
      const dep = l / (LAYERS.length - 1);
      const ink = mix(mix(INK_F, INK_N, Math.pow(dep, 0.8)), MIST, (1 - dep) * 0.5);
      const [foot, fade, strength] = feet[l];
      let top = 1;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let c = 0; c < samples; c++) {
        const y = ridges[l * samples + c];
        top = Math.min(top, 1 - y); // highest crest of this plane (canvas space, 0 = top)
        ctx.lineTo((c / (samples - 1)) * w, (1 - y) * h);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const yTop = Math.max(0, top) * h;
      const yFoot = (1 - foot - fade) * h;
      const g = ctx.createLinearGradient(0, yTop, 0, Math.max(yTop + 1, yFoot));
      g.addColorStop(0, rgba(ink, 0.85 * strength));
      g.addColorStop(0.35, rgba(ink, 0.35 * strength));
      g.addColorStop(1, rgba(MIST, 1));
      ctx.fillStyle = g;
      ctx.fill();
      // mist band at the foot of the plane
      const mb = ctx.createLinearGradient(0, (1 - foot - fade * 1.5) * h, 0, (1 - foot + 0.05) * h);
      mb.addColorStop(0, rgba(MIST, 0));
      mb.addColorStop(1, rgba(MIST, 0.9));
      ctx.fillStyle = mb;
      ctx.fillRect(0, (1 - foot - fade * 1.5) * h, w, h);
    });
    ctx.filter = 'none';
  };
  draw();
  addEventListener('resize', draw);
}
