// ink.js: research sketch only (round 4, "scenes as story"). Not part of the demo.
// A tiny procedural ink kit: noise, a CPU port of the engine's mountain recipe (wash body, dry crest
// contour, creases, foot dissolving into mist) with optional mineral colour, and variable-width brush
// strokes for figurative things (roofs, boats, bridge, figures, willows).
'use strict';

const INK = (() => {
  // ---------- noise ----------
  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, oct = 4) {
    let a = 0.5, t = 0, n = 0;
    for (let i = 0; i < oct; i++) { t += a * vnoise(x, y, s + i * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
    return t / n;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (A, B, t) => [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)];

  // ---------- palette (the engine's, plus mineral pigments) ----------
  const C = {
    PAPER: [239, 241, 238], SKY: [241, 243, 242], MIST: [233, 237, 236], MIST2: [213, 220, 217],
    INK_N: [16, 19, 21], INK_F: [62, 86, 100],
    // mineral pigments, as a painter would grind them (deep grade) ...
    AZURITE: [44, 92, 138], MALACHITE: [58, 128, 106], OCHRE: [158, 102, 64], CINNABAR: [177, 54, 43],
    INDIGO: [72, 98, 118],
  };

  // ---------- ridges ----------
  // A crest profile in px (y down) from Gaussian massifs plus ridged fbm detail, like compose.js + ridges.js.
  function ridge(W, base, amp, massifs, seed, rough = 1) {
    const crest = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let env = 0;
      for (const [cx, hw, g, skew = 0] of massifs) {
        const w = u < cx ? hw * (1 + skew) : hw * (1 - skew);
        const dx = (u - cx) / w;
        env = Math.max(env, g * Math.exp(-dx * dx));
      }
      const r1 = 1 - Math.abs(fbm(u * 13, 0.5, seed, 4) * 2 - 1);
      const r2 = 1 - Math.abs(fbm(u * 46, 1.5, seed + 5, 3) * 2 - 1);
      const r3 = 1 - Math.abs(vnoise(u * 160, 2.5, seed + 8) * 2 - 1);
      const det = 0.40 + 0.36 * r1 * r1 + 0.17 * r2 * rough + 0.07 * r3 * rough;
      crest[x] = base - amp * env * det;
    }
    return crest;
  }

  /**
   * Paint ranges into an RGB float buffer (CPU version of the engine's SCENE pass, simplified).
   * layers: [{ crest, foot (px), fade (px), dep 0..1, ink 0..1 }], far -> near.
   * colour: null (ink only) | { mode: 'qinglu'|'qianjiang', k: strength 0..1, mistK }
   */
  function paintRanges(buf, W, H, layers, colour, opts = {}) {
    const S = opts.scale || 1;           // px per CSS px
    const Hn = opts.H || H;              // the painting's nominal height (for widths in "viewport" units)
    for (const L of layers) {
      const dep = L.dep;
      const inkC0 = mix3(C.INK_F, C.INK_N, Math.pow(dep, 0.8));
      const inkC = mix3(inkC0, C.MIST, (1 - dep) * 0.35);
      const bodyW = mix(0.30, 0.16, dep) * Hn;
      const rimW = mix(0.012, 0.0068, dep) * Hn;
      const soft = mix(2.4, 0.9, dep) * S;
      const cun = smooth(0.3, 1.0, dep);
      const seed = L.seed || 3;
      for (let x = 0; x < W; x++) {
        const cy = L.crest[x];
        const slope = (L.crest[Math.min(W - 1, x + 2)] - L.crest[Math.max(0, x - 2)]) / (4 * S);   // + = falling to the right
        const shade = smooth(0.1, 1.4, slope * 1.2) - 0.5 * smooth(0.2, 1.4, -slope * 1.2);
        const footY = L.foot + (vnoise(x / (90 * S), 0.3, seed) - 0.5) * 0.09 * Hn;
        const fade = L.fade;
        const y0 = Math.max(0, Math.floor(cy - soft * 2));
        const span = Math.max(1, footY - cy);
        for (let y = y0; y < H; y++) {
          const d = y - cy;
          const fk = 1 - smooth(footY - fade, footY, y);
          if (fk <= 0) break;
          const xs = x / S, ys = y / S;
          const fib = vnoise(xs * 0.9, ys * 0.9, seed + 1) - 0.5;
          const inside = smooth(-soft, soft, d + fib * soft * 1.6);
          if (inside <= 0) continue;
          const dd = Math.max(d, 0);
          const pool = 0.75 + 0.25 * fbm(xs / 160, ys / 110, seed + 2, 3);
          const body = Math.exp(-dd / bodyW) * pool;
          const dry = vnoise(xs / 14, dd / (2.2 * S), seed + 3) * 0.65 + vnoise(xs / 4.5, dd / (0.9 * S), seed + 4) * 0.35;
          const rim = Math.exp(-dd / rimW) * smooth(0.3, 0.62, dry);
          // creases down the fall line, on the near planes
          let crease = 0;
          if (cun > 0.01 && dd > 1) {
            const w = fbm(xs / 60, ys / 60, seed + 6, 2) * 1.1;
            const n = vnoise(xs / 11 + w * 3 + dd * slope * 0.02, ys / 46, seed + 7);
            crease = Math.pow(1 - Math.abs(n * 2 - 1), 6) * smooth(1, 6, dd / S) * Math.exp(-dd / (bodyW * 0.9)) * cun;
          }
          let densInk = rim * 0.85 * dep * dep + crease * (0.55 + 0.6 * Math.max(shade, 0)) + Math.max(shade, 0) * mix(0.10, 0.36, dep) * Math.exp(-dd / (0.045 * Hn));
          let densBody = body * mix(0.62, 0.84, dep);
          const gran = 1 + (vnoise(xs / 1.6, ys / 1.6, seed + 9) - 0.5) * 0.35;
          densInk *= gran; densBody *= gran;
          const k = fk * L.ink;
          const i = (y * W + x) * 3;
          let r = buf[i], g = buf[i + 1], b = buf[i + 2];
          let fr, fg, fb;
          if (!colour) {
            const dn = clamp01((densBody + densInk) * k);
            fr = mix(C.MIST[0], inkC[0], dn); fg = mix(C.MIST[1], inkC[1], dn); fb = mix(C.MIST[2], inkC[2], dn);
          } else {
            // ink bones first (a lighter body wash: the colour carries the mass) ...
            const dn = clamp01((densBody * 0.5 + densInk * 1.05) * k);
            fr = mix(C.MIST[0], inkC[0], dn); fg = mix(C.MIST[1], inkC[1], dn); fb = mix(C.MIST[2], inkC[2], dn);
            // ... then the mineral wash, graded from the crest to the foot
            const h = clamp01(dd / span);
            let pig;
            if (colour.mode === 'qinglu') {
              pig = h < 0.42 ? mix3(C.AZURITE, C.MALACHITE, smooth(0.08, 0.42, h)) : mix3(C.MALACHITE, C.OCHRE, smooth(0.5, 0.95, h));
            } else {
              pig = mix3(C.INDIGO, C.OCHRE, smooth(0.15, 0.75, h));
            }
            pig = mix3(pig, C.MIST, (1 - dep) * (colour.mistK ?? 0.45));
            const a = clamp01(colour.k * (0.30 + 0.70 * body) * fk) * (colour.mode === 'qinglu' ? 1 : 0.8);
            if (colour.mode === 'qinglu') {        // mineral: a semi-opaque layer, then the ink texture shows again
              fr = mix(fr, pig[0], a * 0.85); fg = mix(fg, pig[1], a * 0.85); fb = mix(fb, pig[2], a * 0.85);
              const di = clamp01(densInk * k * 0.55);
              fr = mix(fr, inkC[0], di); fg = mix(fg, inkC[1], di); fb = mix(fb, inkC[2], di);
            } else {                                // light crimson-ochre: a transparent glaze (multiply)
              fr *= mix(1, pig[0] / 239, a); fg *= mix(1, pig[1] / 241, a); fb *= mix(1, pig[2] / 238, a);
            }
          }
          const cov = inside;
          buf[i] = mix(r, fr, cov); buf[i + 1] = mix(g, fg, cov); buf[i + 2] = mix(b, fb, cov);
        }
      }
      // the mist band below this plane
      if (L.band !== false) {
        for (let x = 0; x < W; x++) {
          const bY = L.foot + (vnoise(x / (110 * S), 0.7, seed + 11) - 0.5) * 0.08 * Hn;
          const y0 = Math.max(0, Math.floor(bY - L.fade * 1.4)), y1 = Math.min(H, Math.ceil(bY + 0.12 * Hn));
          for (let y = y0; y < y1; y++) {
            const sm = smooth(0.35, 0.72, fbm(x / (260 * S), y / (60 * S), seed + 12, 3));
            const band = smooth(bY - L.fade * 1.4, bY - L.fade * 0.2, y) * (1 - smooth(bY + 0.02 * Hn, bY + 0.12 * Hn, y));
            const m = clamp01(band * (0.35 + 0.65 * sm) * 0.8);
            const i = (y * W + x) * 3;
            buf[i] = mix(buf[i], C.MIST[0], m); buf[i + 1] = mix(buf[i + 1], C.MIST[1], m); buf[i + 2] = mix(buf[i + 2], C.MIST[2], m);
          }
        }
      }
    }
  }

  function paperBuffer(W, H) {
    const buf = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      const t = smooth(0.0, 0.55, 1 - y / H) * 0.6;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        buf[i] = mix(C.PAPER[0], C.SKY[0], t); buf[i + 1] = mix(C.PAPER[1], C.SKY[1], t); buf[i + 2] = mix(C.PAPER[2], C.SKY[2], t);
      }
    }
    return buf;
  }
  function putBuffer(ctx, buf, W, H) {
    const img = ctx.createImageData(W, H);
    for (let i = 0, j = 0; i < W * H * 3; i += 3, j += 4) {
      img.data[j] = buf[i]; img.data[j + 1] = buf[i + 1]; img.data[j + 2] = buf[i + 2]; img.data[j + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  // fine paper tooth + a few long fibres, multiplied over everything at the end (device px)
  function grain(ctx, W, H, k = 1) {
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = (vnoise(x / 1.7, y / 1.7, 91) - 0.5) * 0.55 + (vnoise(x / 4, y / 4, 92) - 0.5) * 0.3 + (vnoise(x / 9, y / 9, 93) - 0.5) * 0.15;
      const f = 1 + t * 0.045 * k;
      const j = (y * W + x) * 4;
      d[j] *= f; d[j + 1] *= f; d[j + 2] *= f;
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- brush ----------
  function resample(pts, step) {
    const out = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const L = Math.hypot(x1 - x0, y1 - y0);
      let t = step - acc;
      while (t <= L) { out.push([x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L]); t += step; }
      acc = (acc + L) % step;
    }
    const last = pts[pts.length - 1];
    if (out.length === 1 || Math.hypot(out[out.length - 1][0] - last[0], out[out.length - 1][1] - last[1]) > step * 0.3) out.push(last);
    return out;
  }
  /** A variable-width brush stroke: loaded start, thin tail, a little wobble. pts in CSS px. */
  function stroke(ctx, pts, o = {}) {
    const w = o.w ?? 1.2, col = o.col ?? 'rgba(18,22,24,0.85)', wob = o.wob ?? 0.3, seed = o.seed ?? 1;
    const tIn = o.tin ?? 0.15, tOut = o.tout ?? 0.45, minW = o.min ?? 0.25;
    const P = resample(pts, Math.max(0.6, Math.min(2, w)));
    const n = P.length;
    if (n < 2) return;
    const Lp = [], Rp = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      let tw = Math.min(1, minW + (1 - minW) * smooth(0, tIn, t)) * Math.min(1, minW + (1 - minW) * (1 - smooth(1 - tOut, 1, t)));
      tw *= 1 + wob * (vnoise(i * 0.18, seed, 77) - 0.5) * 2;
      const hw = w * tw * 0.5;
      Lp.push([P[i][0] + nx * hw, P[i][1] + ny * hw]);
      Rp.push([P[i][0] - nx * hw, P[i][1] - ny * hw]);
    }
    ctx.beginPath();
    ctx.moveTo(Lp[0][0], Lp[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(Lp[i][0], Lp[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }
  /** Dry brush: the stroke split into bristles that break up (flying white). */
  function dry(ctx, pts, o = {}) {
    const w = o.w ?? 3, col = o.col ?? 'rgba(18,22,24,0.5)', nb = o.bristles ?? 5, seed = o.seed ?? 3, thr = o.thr ?? 0.42;
    const P = resample(pts, 0.8);
    const n = P.length;
    if (n < 3) return;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let b = 0; b < nb; b++) {
      const off = (b / (nb - 1) - 0.5) * w;
      ctx.lineWidth = Math.max(0.35, (w / nb) * 1.25);
      let on = false;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const a = P[Math.max(0, i - 1)], c = P[Math.min(n - 1, i + 1)];
        let nx = -(c[1] - a[1]), ny = c[0] - a[0];
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const taper = 1 - 0.6 * t;
        const x = P[i][0] + nx * off * taper, y = P[i][1] + ny * off * taper;
        const keep = vnoise(i * 0.11, b * 3.1 + seed, 55) > thr + 0.35 * t * t;
        if (keep && !on) { ctx.moveTo(x, y); on = true; } else if (keep) ctx.lineTo(x, y); else on = false;
      }
      ctx.stroke();
    }
  }
  /** A soft wash: a filled shape whose edge wicks into the paper. */
  function wash(ctx, pts, col, soft = 0.8) {
    ctx.save();
    if (soft > 0) ctx.filter = `blur(${soft}px)`;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.restore();
  }
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  return { hash2, vnoise, fbm, rng, smooth, mix, mix3, clamp01, C, ridge, paintRanges, paperBuffer, putBuffer, grain, stroke, dry, wash, rgba, resample };
})();
