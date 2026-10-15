// shanshui.js — full-bleed misty ink landscape, painted by one WebGL2 fragment shader.
//
//   const land = initShanshui(canvas, { veil: heroTextEl });
//   land?.destroy();
//
// Returns null when WebGL2 is unavailable (the caller then loads the Canvas2D fallback).
// Ridge silhouettes come from ridges.js (CPU, once per resize); the shader adds ink
// gradation, dry-brush and texture strokes, drifting domain-warped mist, the reading
// veil behind text, the cursor parting the mist, and the scroll "camera lift".

import { buildRidges, withSlopes, layerFeet, LAYERS } from './ridges.js';

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
#define L ${LAYERS.length}
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uRidges;   // RG16F: crest height + smoothed slope; x across the viewport, one row per layer (far -> near)
uniform vec3  uLayer[L];     // foot height, foot fade, ink strength
uniform vec2  uRes;
uniform float uTime;
uniform float uScroll;       // viewports scrolled
uniform float uLift;         // 1 = camera lifts with scroll, 0 = reduced motion
uniform vec3  uPointer;      // uv x, uv y, strength
uniform vec4  uVeil[2];      // reading veil rects, uv (x0, y0, x1, y1); x0 < 0 = unused
uniform float uReveal;       // 0 -> 1 arrival: the mist clears

const vec3 PAPER = vec3(0.946, 0.956, 0.950);   // cool rice paper (~#EEF1EF on screen, after grain)
const vec3 MIST  = vec3(0.925, 0.941, 0.938);   // cool veil
const vec3 VEIL  = vec3(0.938, 0.951, 0.947);
const vec3 INK_N = vec3(0.063, 0.075, 0.082);   // burnt ink
const vec3 INK_F = vec3(0.243, 0.337, 0.392);   // indigo wash #3E5664

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// gradient noise, ~[-1, 1]
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1, 0)) * 2.0 - 1.0, f - vec2(1, 0));
  float c = dot(hash22(i + vec2(0, 1)) * 2.0 - 1.0, f - vec2(0, 1));
  float d = dot(hash22(i + vec2(1, 1)) * 2.0 - 1.0, f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.6;
}
const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);          // world units = viewport heights
  float t = uTime;
  float lift = uScroll * uLift;

  // Cursor gently parts the mist: push the mist field outward and thin it.
  vec2 dp = p - vec2(uPointer.x * aspect, uPointer.y);
  float part = exp(-dot(dp, dp) / 0.045) * uPointer.z;

  // Drifting mist: domain-warped fbm, stretched sideways into bands.
  vec2 mp = (p + dp * part * 0.6) * vec2(1.25, 3.4) + vec2(0.0, lift * 1.2);
  vec2 w = vec2(fbm3(mp * 0.55 + vec2(t * 0.011, 0.0)),
                fbm3(mp * 0.55 + vec2(5.2, 1.3) - vec2(t * 0.008, 0.0)));
  float mistN = fbm(mp + 1.7 * w + vec2(-t * 0.020, 0.0)) * 0.5 + 0.5;
  float mist = smoothstep(0.32, 0.80, mistN) * (1.0 - 0.85 * part);

  // Paper and sky
  vec3 col = PAPER;
  col = mix(col, VEIL, smoothstep(0.45, 1.0, uv.y) * 0.6);

  // Cloud belts drift across the mountain bodies; they sit between planes, never over the nearest crests.
  float wisp = smoothstep(0.38, 0.78, mistN) * (1.0 - 0.85 * part);
  float belt1 = exp(-pow((uv.y - 0.36 + lift * 0.45 + gnoise(vec2(p.x * 1.4 - t * 0.02, 3.0)) * 0.035) / 0.05, 2.0)) * wisp;
  float belt2 = exp(-pow((uv.y - 0.17 + lift * 0.8 + gnoise(vec2(p.x * 1.1 + t * 0.015, 7.0)) * 0.03) / 0.05, 2.0)) * wisp;

  // Front-to-back pre-pass (height lookups only): planes hidden behind a nearer plane that
  // fully covers this pixel are skipped, which keeps the dense lower screen cheap.
  int first = 0;
  for (int i = L - 1; i > 0; i--) {
    float fi = float(i);
    float dep = fi / float(L - 1);
    float h = texture(uRidges, vec2(uv.x, (fi + 0.5) / float(L))).r - mix(0.13, 0.95, dep * dep) * lift;
    if (h - (uv.y + mist * 0.012 * (1.0 - dep)) > 0.03) { first = i; break; }
  }

  for (int i = first; i < L; i++) {
    float fi = float(i);
    float dep = fi / float(L - 1);                    // 0 far .. 1 near
    float lay = mix(0.13, 0.95, dep * dep) * lift;    // parallax: near planes sink faster
    vec3 Lp = uLayer[i];
    float footY = Lp.x - lay;
    float row = (fi + 0.5) / float(L);
    vec2 ridge = texture(uRidges, vec2(uv.x, row)).rg;
    float h = ridge.r - lay;
    float y = uv.y + mist * 0.012 * (1.0 - dep);      // far ridges shimmer through the mist
    float d = h - y;                                  // > 0 inside the mountain

    if (d > -0.03) {
      // ink wicking into paper: a soft, slightly fuzzy edge (isotropic, never hair-like spikes)
      float soft = mix(0.011, 0.0026, dep);
      float fib = gnoise(p * vec2(70.0, 55.0) + fi * 7.3) * 0.6 + gnoise(p * vec2(22.0, 14.0) - fi) * 0.4;
      float inside = smoothstep(-soft, soft, d + fib * soft * 0.8);

      float dd = max(d, 0.0);
      vec2 lp = vec2(p.x, uv.y + lay);                // layer space (moves with the plane)
      // contour: darkest at the crest, broken by dry-brush streaks that run along the stroke
      float rimW = mix(0.012, 0.0068, dep);
      float dry = gnoise(vec2(lp.x * 9.0 + fi * 3.1, dd * 150.0 + fi)) * 0.65 + gnoise(vec2(lp.x * 28.0, dd * 380.0)) * 0.35;
      float rim = exp(-dd / rimW) * smoothstep(-0.5, 0.2, dry);
      // wash body: nearly flat silhouettes far away, strong gradation up close; pigment pools
      float bodyW = mix(0.30, 0.16, dep);
      float pool = 0.75 + 0.25 * fbm3(lp * vec2(2.4, 4.0) + fi * 2.7);
      float body = exp(-dd / bodyW) * pool;
      // shadow faces: light from the upper left, so slopes falling to the right are shaded
      float slope = ridge.g;
      float shade = smoothstep(0.1, 1.4, -slope) - 0.5 * smoothstep(0.2, 1.4, slope);
      // texture strokes (cun) on the near planes: warped creases down the slopes
      float cun = smoothstep(0.45, 1.0, dep);
      vec2 cq = lp * vec2(11.0, 5.5) + vec2(fbm3(lp * 5.0 + fi) * 1.1, 0.0);
      float crease = pow(1.0 - abs(gnoise(cq + fi * 11.0)), 6.0);
      crease *= smoothstep(0.004, 0.025, dd) * exp(-dd / (bodyW * 0.9));
      // flying white: paper shows through the dry brush in broken streaks
      float streak = gnoise(vec2(lp.x * 26.0 + gnoise(lp * 3.0) * 2.0, lp.y * 4.0) + fi * 5.0);

      // hemp-fibre strokes: broken parallel lines running down the fall line of each face
      float u = (lp.x + dd * slope * 0.55) * 52.0 + gnoise(lp * vec2(5.0, 9.0) + fi) * 1.3;
      float hemp = smoothstep(0.66, 0.96, 1.0 - abs(fract(u) * 2.0 - 1.0));
      hemp *= smoothstep(-0.05, 0.5, gnoise(vec2(floor(u) * 1.7 + fi, dd * 16.0)));
      hemp *= smoothstep(0.004, 0.02, dd) * exp(-dd / 0.10) * cun;

      float dens = rim * 0.85 * dep * dep + body * mix(0.62, 0.84, dep);   // far planes: wash only, no contour
      dens += shade * mix(0.10, 0.36, dep) * exp(-dd / 0.045);   // a short accent under the crest
      dens += cun * crease * (0.6 + 0.6 * max(shade, 0.0));
      dens += hemp * (0.22 + 0.3 * max(shade, 0.0));
      dens *= mix(1.0, 0.72 + 0.28 * smoothstep(-0.7, 0.3, streak), cun);
      // pigment granulation: dense ink settles into the paper unevenly
      dens *= 1.0 + gnoise(p * 150.0 + fi * 17.0) * 0.2 * smoothstep(0.12, 0.6, dens);
      // the feet dissolve into the mist band below each plane
      // ...except near the cursor, where the parted mist lets the feet show
      float foot = smoothstep(footY - part * 0.12, footY + Lp.y * (1.0 - 0.55 * part), y + (mist - 0.5) * 0.06);
      dens = clamp(dens * foot * Lp.z, 0.0, 1.0);

      vec3 ink = mix(INK_F, INK_N, pow(dep, 0.8));
      ink = mix(ink, MIST, (1.0 - dep) * 0.35);      // atmospheric perspective: far = pale, blue
      vec3 fill = mix(MIST, ink, dens);
      col = mix(col, fill, inside);
    }

    // mist band drifting between this plane and the next
    float band = (1.0 - smoothstep(footY - 0.05, footY + Lp.y * 1.5, uv.y)) * (1.0 - 0.6 * part);
    band *= smoothstep(footY - 0.30, footY - 0.02, uv.y) * 0.5 + 0.5;
    col = mix(col, MIST, clamp(band * (0.35 + 0.65 * mist) * 0.85, 0.0, 1.0));
    if (i == 2) col = mix(col, VEIL, clamp(belt1 * 0.8, 0.0, 1.0));
    if (i == 3) col = mix(col, VEIL, clamp(belt2 * 0.85, 0.0, 1.0));
  }

  // Rising into the clouds: a sea of mist climbs as you scroll; everything thickens.
  float sea = mix(-0.15, 0.20, smoothstep(0.0, 1.8, lift));   // far crests keep piercing it
  float seaM = 1.0 - smoothstep(sea - 0.10, sea + 0.06 + mistN * 0.2, uv.y);   // billowing top
  col = mix(col, VEIL, seaM * smoothstep(0.0, 0.25, lift));
  col = mix(col, VEIL, smoothstep(0.5, 2.4, uScroll) * 0.55);

  // Reading veil: mist banks up behind the text (feathered, noisy, never a box)
  float veil = 0.0;
  for (int k = 0; k < 2; k++) {
    vec4 V = uVeil[k];
    if (V.x < -0.5) continue;
    vec2 vq = max(vec2(V.x - uv.x, V.y - uv.y), vec2(uv.x - V.z, uv.y - V.w));
    vq.x *= aspect;
    float vd = length(max(vq, 0.0));
    veil = max(veil, 1.0 - smoothstep(0.0, 0.2, vd + (mistN - 0.5) * 0.08));
  }
  col = mix(col, VEIL, veil * 0.72);

  // Arrival: the landscape clears out of a full mist, unevenly
  float fog = clamp((1.0 - uReveal) * 1.5 - (1.0 - mistN) * 0.5, 0.0, 1.0);
  col = mix(col, VEIL, fog);

  // Soft vignette into paper at the side edges and the bottom
  float ev = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x);
  col = mix(VEIL, col, 0.84 + 0.16 * ev);
  col = mix(col, MIST, (1.0 - smoothstep(0.0, 0.09, uv.y)) * 0.55);

  // Paper: faint mottling and fibres (fine grain is a full-resolution CSS layer)
  vec2 fp = gl_FragCoord.xy / uRes.y;
  float mott = fbm3(fp * 5.0);
  float f1 = pow(1.0 - abs(gnoise(ROT * fp * vec2(26.0, 260.0))), 28.0);
  float f2 = pow(1.0 - abs(gnoise(fp * vec2(240.0, 30.0) + 9.0)), 30.0);
  col *= 1.0 + mott * 0.012 - (f1 + f2) * 0.028;

  // dither to kill banding in the long mist gradients
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`shanshui: shader compile failed\n${log}`);
  }
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas  fixed, full-viewport canvas
 * @param {{ veil?: Element | Iterable<Element> | null, reducedMotion?: boolean, freezeAt?: number }} [opts]
 */
export function initShanshui(canvas, opts = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'low-power',
  });
  if (!gl) return null;

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn(err);
    return null;
  }
  gl.useProgram(prog);

  // one oversized triangle covers the screen
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRidges', 'uLayer', 'uRes', 'uTime', 'uScroll', 'uLift', 'uPointer', 'uVeil', 'uReveal']) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uRidges, 0);

  const reduced = opts.reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frozen = Number.isFinite(opts.freezeAt) ? opts.freezeAt : null; // demo captures only
  const finePointer = matchMedia('(pointer: fine)').matches;
  gl.uniform1f(U.uLift, reduced ? 0 : 1);

  // Internal resolution: ~1 device px per 2 on retina, 0.75x on 1x screens; shrinks if frames run slow.
  // Software GL (no GPU) starts lower and idles at a gentler frame rate.
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  let quality = software ? 0.72 : 1;
  const ambientMs = software ? 66 : 33;
  const baseScale = () => Math.min(devicePixelRatio || 1, 2) * (devicePixelRatio >= 1.5 ? 0.5 : 0.75);

  let W = 0, H = 0;
  function resize() {
    const cw = innerWidth;
    const ch = canvas.clientHeight || innerHeight;
    let s = baseScale() * quality;
    s = Math.min(s, 1600 / Math.max(cw, ch)); // cap the long side
    const w = Math.max(2, Math.round(cw * s));
    const h = Math.max(2, Math.round(ch * s));
    if (w === W && h === H) return;
    W = canvas.width = w;
    H = canvas.height = h;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.uRes, W, H);
    const aspect = cw / ch;
    const samples = Math.min(1024, Math.max(256, Math.round(w / 1.5)));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, samples, LAYERS.length, 0, gl.RG, gl.FLOAT, withSlopes(buildRidges(samples, aspect), samples, aspect));
    gl.uniform3fv(U.uLayer, layerFeet(aspect).flat());
    dirty = true;
  }

  // ---- inputs
  let scrollV = 0;
  const pointer = { x: 0.5, y: 0.5, s: 0, tx: 0.5, ty: 0.5, ts: 0 };
  const veil = new Float32Array(8).fill(-1);
  const veilEls = opts.veil ? [...(opts.veil instanceof Element ? [opts.veil] : opts.veil)] : [];
  let dirty = true;

  function readScroll() {
    scrollV = scrollY / Math.max(1, innerHeight);
    // mist banks up behind the (up to two) text blocks that hold most of the screen
    const vw = innerWidth, vh = canvas.clientHeight || innerHeight;
    const seen = [];
    for (const el of veilEls) {
      const r = el.getBoundingClientRect();
      const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (area > 0) seen.push([area, r]);
    }
    seen.sort((a, b) => b[0] - a[0]);
    veil.fill(-1);
    seen.slice(0, 2).forEach(([, r], k) => {
      veil[k * 4] = r.left / vw; veil[k * 4 + 2] = r.right / vw;
      veil[k * 4 + 1] = 1 - r.bottom / vh; veil[k * 4 + 3] = 1 - r.top / vh;
    });
    dirty = true;
  }
  const onPointer = (e) => {
    pointer.tx = e.clientX / innerWidth;
    pointer.ty = 1 - e.clientY / (canvas.clientHeight || innerHeight);
    pointer.ts = 1;
  };
  const onLeave = () => { pointer.ts = 0; };

  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', () => { resize(); readScroll(); });
  if (finePointer && !reduced) {
    addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  // ---- loop: ~30 fps ambient, every frame while the pointer or scroll is moving
  const t0 = performance.now();
  const REVEAL_MS = 1700;
  let last = 0, raf = 0, running = true;
  let slow = 0, frames = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(64, now - (last || now));
    const elapsed = frozen ?? now - t0;
    const revealing = !reduced && frozen === null && elapsed < REVEAL_MS + 100;

    // smooth the pointer (frame-rate independent)
    const k = 1 - Math.exp(-dt / 140);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.s += (pointer.ts - pointer.s) * (1 - Math.exp(-dt / 400));
    const pointerMoving = Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) + Math.abs(pointer.ts - pointer.s) > 0.002;

    const ambientDue = !reduced && frozen === null && now - last >= ambientMs;
    if (!(dirty || ambientDue || pointerMoving || revealing)) return;

    // adaptive quality: if we are consistently slower than ~24 fps, render fewer pixels
    if (last && !reduced) {
      frames++;
      if (dt > 42) slow++;
      if (frames >= 45) {
        if (slow > 30 && quality > 0.55) { quality *= 0.8; W = H = 0; resize(); }
        frames = slow = 0;
      }
    }
    last = now;
    dirty = false;

    const tt = reduced ? 41.0 : 41.0 + elapsed / 1000;
    const r = reduced ? 1 : Math.min(1, elapsed / REVEAL_MS);
    const reveal = 1 - Math.pow(1 - r, 3);
    gl.uniform1f(U.uTime, tt);
    gl.uniform1f(U.uScroll, scrollV);
    gl.uniform1f(U.uReveal, reveal);
    gl.uniform3f(U.uPointer, pointer.x, pointer.y, pointer.s);
    gl.uniform4fv(U.uVeil, veil);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); canvas.dispatchEvent(new CustomEvent('shanshui:lost', { bubbles: true })); });

  resize();
  readScroll();
  raf = requestAnimationFrame(frame);

  return {
    refresh: readScroll,
    destroy() {
      stop();
      removeEventListener('scroll', readScroll);
      removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
