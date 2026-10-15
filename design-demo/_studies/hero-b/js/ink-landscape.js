/**
 * ink-landscape.js — "Wet ink bloom"
 *
 * A misty ink-mountain landscape that is painted into wet rice paper on load.
 *
 * Pipeline (WebGL2, no dependencies):
 *  1. paper   one-off: two tileable 256² noise textures (permeability, mist clouds, grain,
 *             paper fibres with their direction, anisotropic dry-brush streaks).
 *  2. bloom   ping-pong simulation at ~½ CSS resolution. One wetness field per ridge plane
 *             (6 planes in two RGBA16F targets, written together with MRT). Each step:
 *               W += D·perm·∇²W            water wicks through the paper, faster where it is permeable
 *                  + DF·fibre·∂²W/∂s²       and along individual fibres (capillary hairs at the edge)
 *                  + R·perm·gate·W(1−W)     a wet front advances at constant speed inside the stroke
 *                  − E·(1−gate)·W           and evaporates where no ink was laid
 *             Drops land along each ridge crest (far planes first), bloom outward and merge.
 *             After ~1.2 s the field converges and the simulation freezes, so cost is bounded.
 *  3. ink     composites the six planes back to front: crest-dark washes that fade into mist,
 *             pigment pooling (darker rim where water − blur(water) > 0), dry-brush texture,
 *             mist between planes, per-plane scroll parallax. Re-run only when something moves.
 *  4. present cheap per-frame pass: drifting, breathing mist, rising cloud on scroll,
 *             a mist veil behind the text, paper grain and fibres.
 *
 * API: const scape = createInkLandscape(canvas, { reduced, seed }); scape.setSafeRect(rect); scape.destroy();
 * Returns null when WebGL2 is unavailable (the caller then uses the 2D fallback).
 */
import { LAYERS, SAMPLES, buildHeights, hexToRgb } from './ridges.js';
import { nextFrame } from './frame.js';

const N = LAYERS.length; // 6
const STEP_RATE = 240;   // simulation steps per second of animation time
const BLOOM_END = 1.25;  // s: everything painted
const FREEZE_AT = 2.4;   // s: stop simulating

/* ------------------------------------------------------------------ shaders */

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

const PAPER = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 oA; // r permeability · g mist cloud · b mist cloud 2 · a grain
layout(location = 1) out vec4 oB; // r fibre mask · gb fibre direction · a dry-brush streaks

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  float a = hash(mod(i, per)), b = hash(mod(i + vec2(1, 0), per));
  float c = hash(mod(i + vec2(0, 1), per)), d = hash(mod(i + vec2(1, 1), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 uv, vec2 f, int oct) {
  float s = 0., a = .5, n = 0.;
  for (int k = 0; k < 6; k++) { if (k >= oct) break; s += a * vnoise(uv * f, f); n += a; a *= .5; f *= 2.; }
  return s / n;
}
void main() {
  vec2 uv = vUv;
  // permeability: soft, cloudy sizing of the paper
  float perm = fbm(uv, vec2(8.), 5);
  // mist clouds, domain-warped so they curl rather than blob
  vec2 w = vec2(fbm(uv + .13, vec2(4.), 4), fbm(uv + .71, vec2(4.), 4)) - .5;
  float cloud = fbm(uv + w * .35, vec2(4.), 5);
  float cloud2 = fbm(uv - w * .25 + .37, vec2(8.), 4);
  float grain = .6 * vnoise(uv * 256., vec2(256.)) + .4 * vnoise(uv * 128., vec2(128.));
  oA = vec4(perm, cloud, cloud2, grain);

  // paper fibres: short random segments, 2 per 16 px cell, wrapped so the tile repeats
  vec2 P = uv * 256.;
  vec2 cell = floor(P / 16.);
  float best = 0.; vec2 dir = vec2(1, 0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(i, j);
    vec2 cw = mod(c, 16.);
    for (int k = 0; k < 2; k++) {
      vec2 h = vec2(hash(cw + float(k) * 17.1), hash(cw * 1.7 + float(k) * 5.3));
      vec2 ctr = (c + h) * 16.;
      float ang = hash(cw + float(k) * 3.7 + 9.1) * 3.14159;
      vec2 d = vec2(cos(ang), sin(ang));
      float len = 5. + 16. * hash(cw + float(k) * 2.3 + 1.7);
      vec2 q = P - ctr;
      float t = clamp(dot(q, d), -len, len);
      float dist = length(q - d * t);
      float taper = 1. - abs(t) / len;
      float m = (1. - smoothstep(.25, 1.1, dist)) * (.35 + .65 * hash(cw + float(k) * 8.9)) * sqrt(taper);
      if (m > best) { best = m; dir = d; }
    }
  }
  float streak = fbm(uv, vec2(2., 24.), 4);
  oB = vec4(best, dir * .5 + .5, streak);
}`;

const SIM = `#version 300 es
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
uniform sampler2D uS0, uS1, uH, uNA, uNB;
uniform vec2 uTexel;
uniform float uCss;      // CSS px per sim px
uniform float uAspect;
uniform float uT;        // animation time (s)
uniform float uT0[6];    // when each plane starts to be painted
uniform float uDur;      // how long the drops keep landing along a crest
uniform float uSettle;   // 0..1, late convergence so the bloom always completes
uniform float uDry[6];   // per plane: seconds for the water to dry (0 = stays wet until it fills)

vec2 HP(int i, float u) { return texture(uH, vec2(u, (float(i) + .5) / 6.)).rg; }

void main() {
  vec2 uv = vUv, tx = uTexel;
  vec2 cp = gl_FragCoord.xy * uCss / 256.;
  vec4 na = texture(uNA, cp), nb = texture(uNB, cp);
  float perm = .35 + 1.1 * na.r;
  float fib = nb.r;
  vec2 fo = (nb.gb * 2. - 1.) * tx * 1.5;

  vec4 c0 = texture(uS0, uv), c1 = texture(uS1, uv);
  vec2 ty = vec2(0, tx.y), txx = vec2(tx.x, 0), td = vec2(tx.x, -tx.y);
  vec4 n0 = texture(uS0, uv + ty) + texture(uS0, uv - ty) + texture(uS0, uv + txx) + texture(uS0, uv - txx);
  vec4 n1 = texture(uS1, uv + ty) + texture(uS1, uv - ty) + texture(uS1, uv + txx) + texture(uS1, uv - txx);
  vec4 d0 = texture(uS0, uv + tx) + texture(uS0, uv - tx) + texture(uS0, uv + td) + texture(uS0, uv - td);
  vec4 d1 = texture(uS1, uv + tx) + texture(uS1, uv - tx) + texture(uS1, uv + td) + texture(uS1, uv - td);
  vec4 lap0 = (4. * n0 + d0 - 20. * c0) / 6.;
  vec4 lap1 = (4. * n1 + d1 - 20. * c1) / 6.;
  vec4 lf0 = texture(uS0, uv + fo) + texture(uS0, uv - fo) - 2. * c0;
  vec4 lf1 = texture(uS1, uv + fo) + texture(uS1, uv - fo) - 2. * c1;

  // signed depth below each crest (vh units)
  vec2 h0 = HP(0, uv.x), h1 = HP(1, uv.x), h2 = HP(2, uv.x), h3 = HP(3, uv.x), h4 = HP(4, uv.x), h5 = HP(5, uv.x);
  vec4 sd0 = vec4(h0.x, h1.x, h2.x, h3.x) - uv.y;
  vec4 sd1 = vec4(h4.x, h5.x, 1., 1.) - uv.y;
  float wob = (na.r - .5) * .007 + fib * .004;
  // drops only land where the brush lays ink (the paint mask); the wet front may wander past it
  vec4 pm0 = smoothstep(.2, .55, vec4(h0.y, h1.y, h2.y, h3.y));
  vec4 pm1 = smoothstep(.2, .55, vec4(h4.y, h5.y, 0., 0.));
  vec4 g0 = smoothstep(-.0025, .005, sd0 + wob);
  vec4 g1 = smoothstep(-.0025, .005, sd1 + wob);

  // drops landing along the crest: each plane, in its own window, at noise-chosen spots
  vec4 crest0 = smoothstep(0., .006, sd0) * (1. - smoothstep(.012, .045, sd0));
  vec4 crest1 = smoothstep(0., .006, sd1) * (1. - smoothstep(.012, .045, sd1));
  float x = uv.x * uAspect, y = uv.y;
  // where the drops land: blotchy 2D noise, so each drop is a soft blot rather than a segment
  vec4 an0 = vec4(texture(uNA, vec2(x * 1.3 + .11, y * 2.1 + .13)).g, texture(uNA, vec2(x * 1.4 + .37, y * 2.2 + .41)).g,
                  texture(uNA, vec2(x * 1.6 + .59, y * 2.4 + .67)).g, texture(uNA, vec2(x * 1.8 + .83, y * 2.6 + .89)).g);
  vec4 an1 = vec4(texture(uNA, vec2(x * 2. + .29, y * 2.8 + .23)).g, texture(uNA, vec2(x * 2.2 + .71, y * 3. + .53)).g, 1., 1.);
  vec4 pr0 = clamp((uT - vec4(uT0[0], uT0[1], uT0[2], uT0[3])) / uDur, 0., 1.);
  vec4 pr1 = clamp((uT - vec4(uT0[4], uT0[5], 99., 99.)) / uDur, 0., 1.);
  vec4 seed0 = crest0 * pm0 * smoothstep(an0, an0 + .03, pr0 * 1.3 - .2);
  vec4 seed1 = crest1 * pm1 * smoothstep(an1, an1 + .03, pr1 * 1.3 - .2);

  // drying: as the water evaporates the wet front slows and stops, leaving a pooled tide line
  vec4 dy0 = vec4(uDry[0], uDry[1], uDry[2], uDry[3]), dy1 = vec4(uDry[4], uDry[5], 0., 0.);
  vec4 age0 = max(vec4(uT) - vec4(uT0[0], uT0[1], uT0[2], uT0[3]), 0.);
  vec4 age1 = max(vec4(uT) - vec4(uT0[4], uT0[5], 0., 0.), 0.);
  vec4 wet0 = mix(vec4(1.), exp(-age0 / max(dy0, .01)), step(.001, dy0));
  vec4 wet1 = mix(vec4(1.), exp(-age1 / max(dy1, .01)), step(.001, dy1));

  const float D = .17, DF = .24, R = .62, E = .022;   // D·perm·5.3 + DF·4 stays under the Euler limit
  vec4 w0 = c0 + wet0 * (D * perm * lap0 + DF * fib * lf0 + R * perm * g0 * c0 * (1. - c0)) - E * (1. - g0) * c0;
  vec4 w1 = c1 + wet1 * (D * perm * lap1 + DF * fib * lf1 + R * perm * g1 * c1 * (1. - c1)) - E * (1. - g1) * c1;
  w0 = max(w0, seed0 * .95);
  w1 = max(w1, seed1 * .95);
  // planes that never dry are brought to rest at the end; drying planes keep their bloom shapes
  w0 += (g0 - w0) * g0 * uSettle * .06 * (1. - step(.001, dy0));
  w1 += (g1 - w1) * g1 * uSettle * .06 * (1. - step(.001, dy1));
  o0 = clamp(w0, 0., 1.);
  o1 = vec4(clamp(w1.xy, 0., 1.), 0., 0.);
}`;

const INK = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uS0, uS1, uH, uNA, uNB;
uniform vec2 uSimTexel;
uniform float uPx;       // CSS px per composite px
uniform float uAspect;
uniform float uOff[6];   // parallax offset per plane (vh units)
uniform vec3 uInk[6];
uniform float uTone[6], uFall[6], uKeep[6], uRim[6], uTex[6], uFog[6], uSoft[6];
uniform vec3 uPaper, uMist;

vec2 HP(int i, float u) { return texture(uH, vec2(u, (float(i) + .5) / 6.)).rg; }
float Wt(int i, vec2 p) { return i < 4 ? texture(uS0, p)[i] : texture(uS1, p)[i - 4]; }

void main() {
  float u = vUv.x, y = vUv.y;
  vec2 cp = gl_FragCoord.xy * uPx / 256.;
  vec4 na = texture(uNA, cp), nb = texture(uNB, cp);
  vec2 rr = uSimTexel * 2.2;
  float x = u * uAspect;
  vec3 col = uPaper;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float yl = y - uOff[i];
    vec2 hp = HP(i, u);
    float h = hp.x;
    float d = h - yl;                                   // depth below this crest (vh)

    // mist between planes: patchy, pooled in the valley behind this ridge
    float cloud = texture(uNA, vec2(x * .35 + fi * .19, yl * .8 + fi * .37)).g;
    float valley = smoothstep(-.16, -.01, d) * (1. - smoothstep(.0, .05, d));
    col = mix(col, mix(uPaper, uMist, .25), uFog[i] * valley * smoothstep(.28, .68, cloud));

    vec2 p = vec2(u, yl);
    float w = Wt(i, p);
    float wb = .25 * (Wt(i, p + vec2(rr.x, 0)) + Wt(i, p - vec2(rr.x, 0)) + Wt(i, p + vec2(0, rr.y)) + Wt(i, p - vec2(0, rr.y)));
    float rim = clamp((w - wb) * 5., 0., 1.);          // pigment pooled where the water front stopped
    float e = w + (na.r - .5) * .2 + nb.r * .2;         // full-res fibres sharpen the soft sim edge
    float s = uSoft[i];
    float cov = smoothstep(.5 - .08 - s, .5 + .08 + s * .5, e);
    float bleed = smoothstep(.02, .45, w) * (1. - cov); // faint wet halo beyond the edge

    // the wash: darkest at the crest, running down the slope in streaks, gone into mist below
    float reach = texture(uNA, vec2(x * .5 + fi * .23, .5 + fi * .11)).b;   // how far the wash runs here
    float fall = uFall[i] * (.35 + 1.5 * smoothstep(.25, .8, reach));
    float dd = max(d, 0.);
    float streak = .6 * texture(uNB, vec2(yl * .32 + fi * .3, x * 1.45 + fi * .17)).a   // texture strokes down the slope
                 + .4 * texture(uNB, vec2(yl * .21 + fi * .7, x * 2.7 + fi * .53)).a;
    float grit = texture(uNA, vec2(x * 2.6 + fi * .3, yl * 2.2)).b;
    float tex = mix(1., smoothstep(.22, .78, streak * .75 + grit * .4), uTex[i]);
    float run = fall * (.55 + .9 * tex);                // streaks carry the ink further down
    float prof = exp(-dd / run) * (1. - uKeep[i]) + uKeep[i] * (1. - smoothstep(0., run * 6., dd));

    // empty space: where the brush skipped, cloud wraps the ridge with a billowy edge
    float billow = texture(uNA, vec2(x * .9 + fi * .41, yl * 1.7 + fi * .29)).g;
    float paint = smoothstep(.22, .62, hp.y * 1.25 + (billow - .5) * .8 - dd * 1.8);

    float a = paint * (uTone[i] * prof * (cov * (.72 + .28 * tex) + bleed * .35) + rim * uRim[i] * cov);
    col = mix(col, uInk[i], clamp(a, 0., 1.));
  }
  o = vec4(col, 1.);
}`;

const PRESENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uInkTex, uNA, uNB;
uniform float uTime, uBreath, uRise, uPx, uAspect, uSafeK;
uniform vec4 uSafe;      // text box in CSS px: x0, y0 (from bottom), x1, y1
uniform vec2 uCss;       // canvas size in CSS px
uniform vec3 uPaper, uMist;

void main() {
  vec3 c = texture(uInkTex, vUv).rgb;
  vec2 q = vec2(vUv.x * uAspect, vUv.y);
  float t = uTime;

  // two decks of mist drifting at different speeds (~100 s and ~140 s across a tile)
  float m1 = texture(uNA, q * vec2(.42, .9) + vec2(t * .0042, .0)).g;
  float m2 = texture(uNA, q * vec2(.9, 2.1) + vec2(-t * .0028, t * .0006) + (m1 - .5) * .16).b;
  float m = smoothstep(.38, .76, m1 * .6 + m2 * .5);
  float b = uBreath * .012;
  float band = exp(-pow((vUv.y - .17 - b) / .09, 2.)) + .8 * exp(-pow((vUv.y - .33 + b) / .08, 2.)) + .5 * exp(-pow((vUv.y - .5) / .07, 2.));
  vec3 cloudCol = mix(uPaper, uMist, .2);
  c = mix(c, cloudCol, clamp(m * band * (.62 + .1 * uBreath), 0., .85));
  // the foot of the screen dissolves into mist, so the range floats
  c = mix(c, cloudCol, smoothstep(.13, .0, vUv.y + (m - .5) * .08) * .85);

  // on scroll the cloud rises and the range sinks into it; the highest peaks stay above it
  float lvl = uRise * .62 - .1;
  float rise = smoothstep(lvl + .22, lvl - .1, vUv.y + (m - .5) * .24);
  c = mix(c, cloudCol, rise * .97 * smoothstep(0., .08, uRise));
  c = mix(c, uPaper, uRise * .35);   // and the whole scene recedes a little, to leave the text on paper

  // reserved space: thicken the mist behind the text so copy stays high-contrast
  vec2 px = vUv * uCss;
  vec2 ctr = (uSafe.xy + uSafe.zw) * .5, hs = (uSafe.zw - uSafe.xy) * .5;
  vec2 qd = abs(px - ctr) - hs;
  float sdb = length(max(qd, 0.)) + min(max(qd.x, qd.y), 0.);
  float safe = 1. - smoothstep(-40., 160., sdb + (m - .5) * 90.);
  c = mix(c, uPaper, safe * uSafeK);

  // paper: grain and the odd visible fibre
  vec2 cp = gl_FragCoord.xy * uPx / 256.;
  float gr = texture(uNA, cp).a, fb = texture(uNB, cp * .7 + .31).r;
  c *= 1. - .032 * (gr - .5) - .018 * smoothstep(.55, 1., fb);
  o = vec4(c, 1.);
}`;

/* ------------------------------------------------------------------ helpers */

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const cache = new Map();
  const loc = (name) => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
    return cache.get(name);
  };
  return { p, loc };
}
function texture(gl, w, h, internal, format, type, { repeat = false, data = null } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}
function framebuffer(gl, textures) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  textures.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
  gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? fb : null;
}
/** Page scroll; also covers the demo mode where the body is the scroller. */
const pageScroll = () => window.scrollY || document.body.scrollTop || 0;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------------------ main */

export function createInkLandscape(canvas, { reduced = false, seed = 7, onFail } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;

  let progs;
  try {
    progs = { paper: program(gl, PAPER), sim: program(gl, SIM), ink: program(gl, INK), present: program(gl, PRESENT) };
  } catch (err) {
    console.warn('[ink-landscape] shader error, falling back', err);
    return null;
  }
  let floatRT = !!gl.getExtension('EXT_color_buffer_float');   // RGBA16F state; RGBA8 otherwise
  gl.bindVertexArray(gl.createVertexArray());

  const paperRGB = hexToRgb('#eff1ee');
  const mistRGB = hexToRgb('#e3e8e5');
  const inkRGB = LAYERS.flatMap((L) => hexToRgb(L.ink));
  const pick = (k) => new Float32Array(LAYERS.map((L) => L[k]));
  const layerU = { uTone: pick('tone'), uFall: pick('fall'), uKeep: pick('keep'), uRim: pick('rim'), uTex: pick('tex'), uFog: pick('fog'), uSoft: pick('soft') };
  const starts = new Float32Array([0, .1, .2, .3, .4, .5]); // far planes are painted first
  const dryTimes = new Float32Array(LAYERS.map((L) => L.dry || 0));
  const DUR = .42;

  // paper noise, generated once
  const NA = texture(gl, 256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { repeat: true });
  const NB = texture(gl, 256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { repeat: true });
  {
    const fb = framebuffer(gl, [NA, NB]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, 256, 256);
    gl.useProgram(progs.paper.p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
  }

  let cssW = 0, cssH = 0, px = 1, simW = 0, simH = 0, simScale = .5;
  let heightTex = null, state = null, inkTex = null, inkFB = null;
  let simTime = 0, steps = 0, frozen = false, t0 = 0, cancel = null;
  let needInk = true, lastScroll = -1, lastPresent = 0, dead = false;
  let visible = document.visibilityState !== 'hidden';   // a background tab blooms when first seen
  let safe = [0, 0, 0, 0], safeK = .55;

  function makeState() {
    const internal = floatRT ? gl.RGBA16F : gl.RGBA8;
    const type = floatRT ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const mk = () => texture(gl, simW, simH, internal, gl.RGBA, type);
    const a = [mk(), mk()], b = [mk(), mk()];
    const fa = framebuffer(gl, a), fbb = framebuffer(gl, b);
    if (!fa || !fbb) throw new Error('state framebuffer incomplete');
    for (const fb of [fa, fbb]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { read: { tex: a, fb: fa }, write: { tex: b, fb: fbb } };
  }
  function freeState() {
    if (!state) return;
    for (const s of [state.read, state.write]) { s.tex.forEach((t) => gl.deleteTexture(t)); gl.deleteFramebuffer(s.fb); }
  }

  function resize(force = false) {
    const box = canvas.getBoundingClientRect();   // 100% × 100lvh: stable while mobile toolbars move
    const w = Math.round(box.width) || window.innerWidth, h = Math.round(box.height) || window.innerHeight;
    // Ignore mobile URL-bar jitter: only rebuild for width changes or big height changes.
    if (!force && w === cssW && Math.abs(h - cssH) < cssH * .15) return false;
    cssW = w; cssH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(1.5, dpr) * .8;             // composite resolution
    canvas.width = Math.round(cssW * scale);
    canvas.height = Math.round(cssH * scale);
    px = cssW / canvas.width;
    simScale = Math.min(.5, Math.sqrt(380000 / (cssW * cssH)));  // cap sim cost on huge screens
    simW = Math.max(64, Math.round(cssW * simScale));
    simH = Math.max(64, Math.round(cssH * simScale));

    const heights = buildHeights(cssW / cssH, seed);
    if (heightTex) gl.deleteTexture(heightTex);
    heightTex = texture(gl, SAMPLES, N, gl.RG16F, gl.RG, gl.FLOAT, { data: heights });

    freeState();
    state = makeState();
    if (inkTex) { gl.deleteTexture(inkTex); gl.deleteFramebuffer(inkFB); }
    inkTex = texture(gl, canvas.width, canvas.height, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    inkFB = framebuffer(gl, [inkTex]);
    needInk = true;
    return true;
  }

  function bind(prog, unit, name, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.loc(name), unit);
  }

  function simStep(settle) {
    const P = progs.sim;
    gl.useProgram(P.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.write.fb);
    gl.viewport(0, 0, simW, simH);
    bind(P, 0, 'uS0', state.read.tex[0]);
    bind(P, 1, 'uS1', state.read.tex[1]);
    bind(P, 2, 'uH', heightTex);
    bind(P, 3, 'uNA', NA);
    bind(P, 4, 'uNB', NB);
    gl.uniform2f(P.loc('uTexel'), 1 / simW, 1 / simH);
    gl.uniform1f(P.loc('uCss'), 1 / simScale);
    gl.uniform1f(P.loc('uAspect'), cssW / cssH);
    gl.uniform1f(P.loc('uT'), simTime);
    gl.uniform1fv(P.loc('uT0'), starts);
    gl.uniform1f(P.loc('uDur'), DUR);
    gl.uniform1f(P.loc('uSettle'), settle);
    gl.uniform1fv(P.loc('uDry'), dryTimes);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const r = state.read; state.read = state.write; state.write = r;
  }

  function inkPass(scrollY) {
    const P = progs.ink;
    gl.useProgram(P.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, inkFB);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bind(P, 0, 'uS0', state.read.tex[0]);
    bind(P, 1, 'uS1', state.read.tex[1]);
    bind(P, 2, 'uH', heightTex);
    bind(P, 3, 'uNA', NA);
    bind(P, 4, 'uNB', NB);
    gl.uniform2f(P.loc('uSimTexel'), 1 / simW, 1 / simH);
    gl.uniform1f(P.loc('uPx'), px);
    gl.uniform1f(P.loc('uAspect'), cssW / cssH);
    const s = reduced ? 0 : scrollY / cssH;
    gl.uniform1fv(P.loc('uOff'), new Float32Array(LAYERS.map((L) => s * L.speed)));
    gl.uniform3fv(P.loc('uInk'), new Float32Array(inkRGB));
    for (const k in layerU) gl.uniform1fv(P.loc(k), layerU[k]);
    gl.uniform3fv(P.loc('uPaper'), paperRGB);
    gl.uniform3fv(P.loc('uMist'), mistRGB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function present(time, scrollY) {
    const P = progs.present;
    gl.useProgram(P.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    bind(P, 0, 'uInkTex', inkTex);
    bind(P, 3, 'uNA', NA);
    bind(P, 4, 'uNB', NB);
    const t = reduced ? 30 : time;
    gl.uniform1f(P.loc('uTime'), t + 40);
    gl.uniform1f(P.loc('uBreath'), Math.sin(t * Math.PI * 2 / 17));
    gl.uniform1f(P.loc('uRise'), smooth(0, 1.05, scrollY / cssH));
    gl.uniform1f(P.loc('uPx'), px);
    gl.uniform1f(P.loc('uAspect'), cssW / cssH);
    gl.uniform2f(P.loc('uCss'), cssW, cssH);
    gl.uniform4f(P.loc('uSafe'), safe[0], cssH - (safe[3] - scrollY), safe[2], cssH - (safe[1] - scrollY));
    gl.uniform1f(P.loc('uSafeK'), safeK);
    gl.uniform3fv(P.loc('uPaper'), paperRGB);
    gl.uniform3fv(P.loc('uMist'), mistRGB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Replay the bloom from dry paper up to `sec`, off-screen. */
  function replay(sec) {
    for (const fb of [state.read.fb, state.write.fb]) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    steps = 0; simTime = 0;
    const n = Math.round(Math.min(sec, FREEZE_AT) * STEP_RATE);
    for (let i = 0; i < n; i++) { steps++; simTime = steps / STEP_RATE; simStep(smooth(BLOOM_END, FREEZE_AT - .3, simTime)); }
  }
  /** Finished painting at once (reduced motion, resize). ≈600 small GPU steps. */
  function settleNow() {
    replay(FREEZE_AT);
    for (let i = 0; i < 40; i++) simStep(1);
    frozen = true;
    needInk = true;
  }

  function frame(now) {
    cancel = null;
    if (dead) return;
    if (!t0) t0 = now;
    const time = (now - t0) / 1000;
    const scrollY = pageScroll();

    if (!frozen) {
      // Fixed-rate steps, at most 12 per frame: a slow device paints a little slower,
      // then catches up in one go at FREEZE_AT, so every screen ends on the same painting.
      const due = Math.min(12, Math.floor(Math.min(time, FREEZE_AT) * STEP_RATE) - steps);
      for (let i = 0; i < due; i++) {
        steps++;
        simTime = steps / STEP_RATE;
        simStep(smooth(BLOOM_END, FREEZE_AT - .3, simTime));
      }
      if (time >= FREEZE_AT) {
        const left = Math.min(400, Math.round(FREEZE_AT * STEP_RATE) - steps);
        for (let i = 0; i < left; i++) { steps++; simTime = steps / STEP_RATE; simStep(smooth(BLOOM_END, FREEZE_AT - .3, simTime)); }
        for (let i = 0; i < 40; i++) simStep(1);
        frozen = true;
      }
      needInk = true;
    }
    if (scrollY !== lastScroll) { needInk = true; lastScroll = scrollY; }
    if (needInk) { inkPass(scrollY); needInk = false; lastPresent = 0; }

    // ambient mist: 30 fps is plenty
    if (now - lastPresent > 33) { present(time, scrollY); lastPresent = now; }
    if (!reduced || !frozen || needInk) schedule();
  }
  const schedule = () => { if (!cancel && visible && !dead) cancel = nextFrame(frame); };

  /* lifecycle */
  try {
    resize(true);
  } catch (err) {
    if (!floatRT) { console.warn('[ink-landscape] setup failed', err); return null; }
    floatRT = false;                       // half-float targets refused: retry with RGBA8
    try { resize(true); } catch (err2) { console.warn('[ink-landscape] setup failed', err2); return null; }
  }
  if (reduced) settleNow();

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (resize()) { settleNow(); schedule(); } }, 160);
  };
  const onScroll = () => schedule();
  const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) { lastPresent = 0; schedule(); } };
  const onLost = (e) => { e.preventDefault(); dead = true; onFail?.(); };
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.dataset.renderer = floatRT ? 'webgl2-f16' : 'webgl2-rgba8';
  schedule();

  return {
    /** Demo-only: render the bloom exactly as it looks `sec` seconds after load, then hold still. */
    freezeAt(sec) {
      cancel?.();
      dead = true;
      replay(sec);
      inkPass(pageScroll());
      present(sec, pageScroll());
    },
    /** Text box (DOMRect in CSS px). The mist is thickened behind it. */
    setSafeRect(r, strength = .55) {
      const y = pageScroll();                 // stored in page coordinates, so it scrolls with the text
      safe = [r.left, r.top + y, r.right, r.bottom + y];
      safeK = strength;
      lastPresent = 0;
      schedule();
    },
    destroy() {
      dead = true;
      cancel?.();
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
    },
  };
}
