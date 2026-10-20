// shaders.ts — GLSL for the WebGL2 landscape (gl.ts).
//
//   NOISE    once per context: a 512² tileable texture. r/g = soft mist fields, b = paper tooth +
//            short fibres, a = a few long faint fibres.
//   SCENE    the expensive static painting (ridges, crest contours, texture strokes, granulation,
//            graded washes, pigment, static mist bands, water, the figure layers, the keep-out mist) into
//            one view's RGBA8 framebuffer. A view is a window (the page's strip or closing: a box on the page
//            looking at the world at its own framing, uView) or the full viewport (the desktop horizon).
//            Re-run only on resize, a framing / composition / palette change, a pan, the ink-bloom arrival
//            and a figure layer's fade. Its alpha channel is a mask: how much drifting mist may lie over
//            each pixel (valleys and water yes, near crests no, figures thinly).
//   PRESENT  cheap, per frame: the windows at their live boxes (1:1 with the scroll) and the horizon band
//            between them, drifting mist inside the windows, the pointer's wake through it, the pale mist
//            bank of a page change (sweep), the reading veil behind text, paper grain. A handful of texture
//            taps (the wake and the sweep add a few, only where they are).

import { LAYERS, RIVER_FRONT, HS } from './compose';
import { ROWS } from './ridges';
import { lightsGLSL } from './lights';
import { elementDefines } from '../elements';

export const VEILS = 12;  // reading-veil rects painted at once (4b: living pages veil a block in bands)
export const TRAIL = 8;   // points of the pointer's wake (the newest is the pointer itself)
export const LIFE = 8;    // 4b small life: entries laid in at once (index.ts lifeU: shimmer, smoke, willow sway, a boat)

export const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HASH = `
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

const COLORS = `
const vec3 PAPER = vec3(0.937, 0.945, 0.933);   // #EFF1EE cool rice paper (text sits on it, unchanged)
const vec3 SKY   = vec3(0.953, 0.976, 0.984);   // #F3F9FB the luminous horizon air (lighter than the paper)
const vec3 SKY_T = vec3(0.722, 0.851, 0.941);   // #BEDDF2 ice-blue sky high in the window (the light needs a blue round it)
const vec3 LIGHT = vec3(0.984, 0.996, 1.000);   // #FBFEFF the light core
const vec3 MIST  = vec3(0.945, 0.965, 0.973);   // #F1F6F8 mist is light, never grey
const vec3 AIR   = vec3(0.800, 0.882, 0.929);   // #CCE1ED far-plane air (atmospheric perspective toward ice)
const vec3 INK_N = vec3(0.047, 0.082, 0.110);   // burnt ink, a breath of indigo #0C151C
const vec3 INK_F = vec3(0.141, 0.290, 0.388);   // deep indigo wash #244A63
const vec3 AZ_D  = vec3(0.180, 0.475, 0.690);   // azurite, deep #2E79B0
const vec3 AZ_M  = vec3(0.612, 0.769, 0.878);   // azurite, misted #9CC4E0
const vec3 MA_D  = vec3(0.110, 0.490, 0.510);   // jade, deep #1C7D82
const vec3 MA_M  = vec3(0.545, 0.808, 0.800);   // jade, misted #8BCECC
const vec3 JADE  = vec3(0.420, 0.725, 0.741);   // #6BB9BD jade
const vec3 AIR2  = vec3(0.894, 0.945, 0.973);
const vec3 MIST2B = vec3(0.882, 0.925, 0.945);   // #E1ECF1 (the present pass's MIST2, for the scene: the mist over the terraces)
const vec3 DISC_C = vec3(0.957, 0.984, 0.992);  // #F4FBFD the moon disc's core
const vec3 DISC_E = vec3(0.839, 0.933, 0.961);  // #D6EEF5 ...its wash at the rim
const vec3 DISC_H = vec3(0.560, 0.780, 0.850);  // #8FC7D9 its hairlines (a cyan rim, never jade)
const vec3 RIM_L = vec3(0.969, 0.996, 1.000);   // #F7FEFF rim light on the crests facing the light
const vec3 BLOOM_W = vec3(0.914, 0.992, 0.996); // #E9FDFE the bloom's core
const vec3 BLOOM_C = vec3(0.749, 0.914, 0.949); // #BFE9F2 ...its wide cyan falloff
// each place's light: world x (stretches), scene height, radius (viewport heights), strength
// (one colour story. Every place has its light, a low, wide glow in the sky; Home's is the strongest (a bloom
// behind the host peak), the others 0.3-0.5 of it. w in (0, 1): the light also lies on the water as a broken glitter
// column (Writing's low moon, Contact's glint); w < 0: sky glow only. No disc, no ring anywhere.)
uniform float uStillL;   // (a story-map still: only Home's light keeps its heart and bloom; the others are a faint glow)
vec4 lightK0(float k);
// "Morning opens" (elements.ts morning): seconds into Home's once-a-session morning, >= 9 at rest (and always
// elsewhere). Home's light starts low (3.5 % of the view) and small (40 % of its radius) and rises and opens on an
// ease-out; every term that reads the light (its core, bloom, rim light, the water's glitter) follows it.
uniform float uMorn;
float mornE(float t) { float x = clamp((t - 0.12) / 1.65, 0.0, 1.0); return 1.0 - (1.0 - x) * (1.0 - x) * (1.0 - x); }
vec4 lightK(float k) {
  vec4 Lq = lightK0(k);
  if (uStillL > 0.5) {
    // (a story-map still's sun) 1: only Home keeps its sun; 2: none; 3 + j: only place j
    float keep = uStillL < 1.5 ? 0.0 : (uStillL < 2.5 ? -9.0 : uStillL - 3.0);
    if (abs(k - keep) > 0.5) Lq.w *= 0.22;
    // a place's own lit still holds the sun: at least .85 of Home's, whatever its page's own light
    else if (uStillL > 2.5) Lq.w = (Lq.w < 0.0 ? -1.0 : 1.0) * max(abs(Lq.w), 0.85);
  }
  if (uMorn < 8.0 && k > -0.5 && k < 0.5) {
    float e = mornE(uMorn);
    Lq.y -= 0.045 * (1.0 - e);
    Lq.z *= mix(0.6, 1.0, e);
    Lq.w *= mix(0.22, 1.0, e * e);   // (dim and diffuse while low: never a small hard disc)
  }
  return Lq;
}
// Home's light (whatever its strength now: the morning dims it while it rises)
bool homeL(vec4 Lh) { return Lh.w > 0.0 && Lh.x > 0.5 && Lh.x < 1.0; }
// (the one light table: lights.ts, shared with the story-map stills and the footer)
${lightsGLSL()}
vec4 lightOf(float u) { return lightK(floor(u)); }`;

export const NOISE_SIZE = 512;

export const NOISE = `#version 300 es
precision highp float;
out vec4 o;
const float N = ${NOISE_SIZE}.0;
${HASH}
// gradient noise, periodic with \`per\` cells, ~[-1, 1]
float pnoise(vec2 p, float per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 a0 = mod(i, per), a1 = mod(i + 1.0, per);
  float a = dot(hash22(a0) * 2.0 - 1.0, f);
  float b = dot(hash22(vec2(a1.x, a0.y)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(vec2(a0.x, a1.y)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(a1) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.6;
}
float pfbm(vec2 uv, float f, int oct, float seed) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int k = 0; k < 6; k++) {
    if (k >= oct) break;
    s += a * pnoise(uv * f + seed * 13.7, f);
    n += a; a *= 0.5; f *= 2.0;
  }
  return s / n;
}
// Paper fibres: gently bent segments scattered on a grid of cells (the grid wraps, so the tile
// repeats seamlessly). Signed: some fibres read a touch lighter, some a touch darker.
float fibres(vec2 P, float cell, float lmin, float lmax, float width, float bendK, float keep, float seed) {
  float cells = N / cell;
  vec2 c0 = floor(P / cell);
  float acc = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = c0 + vec2(float(i), float(j));
    vec2 cw = mod(c, cells);
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      if (hash12(cw * 1.91 + fk * 4.7 + seed * 3.3) > keep) continue;
      vec2 h = hash22(cw * 1.37 + fk * 19.1 + seed);
      vec2 h2 = hash22(cw * 2.11 + fk * 7.3 + seed + 5.0);
      vec2 ctr = (c + h) * cell;
      float ang = h2.x * 3.14159265;
      vec2 d = vec2(cos(ang), sin(ang));
      vec2 nr = vec2(-d.y, d.x);
      float len = mix(lmin, lmax, h2.y * h2.y);
      vec2 q = P - ctr;
      float t = dot(q, d);
      float bend = (hash12(cw + fk * 3.1 + seed) - 0.5) * bendK;
      float nd = dot(q, nr) - bend * t * t / len;
      float along = 1.0 - smoothstep(len * 0.55, len, abs(t));
      float line = 1.0 - smoothstep(width * 0.5, width * 0.5 + 0.85, abs(nd));
      float sgn = hash12(cw * 3.7 + fk + seed * 2.0) < 0.6 ? 1.0 : -1.0;
      acc += line * along * sgn * (0.45 + 0.55 * hash12(cw + seed * 9.0 + fk));
    }
  }
  return acc;
}
void main() {
  vec2 P = gl_FragCoord.xy;
  vec2 uv = P / N;
  // mist fields, domain-warped so they curl rather than blob
  vec2 w = vec2(pfbm(uv, 3.0, 3, 1.0), pfbm(uv, 3.0, 3, 2.0));
  float m1 = pfbm(uv + w * 0.12, 4.0, 5, 3.0) * 0.5 + 0.5;
  float m2 = pfbm(uv - w * 0.10, 8.0, 4, 4.0) * 0.5 + 0.5;
  // paper tooth: soft 2-16 px relief, never per-pixel sensor noise
  float tooth = pnoise(P / 2.0, N / 2.0) * 0.55 + pnoise(P / 4.0 + 7.0, N / 4.0) * 0.30 + pnoise(P / 8.0 + 3.0, N / 8.0) * 0.15;
  float shortF = fibres(P, 16.0, 3.0, 12.0, 0.6, 0.8, 0.9, 1.0);
  float longF = fibres(P, 128.0, 40.0, 120.0, 0.9, 0.45, 0.2, 7.0);
  // long fibres only ever read lighter (translucent strands in the sheet), never as dark hairs
  o = vec4(m1, m2, clamp(0.5 + tooth * 0.28 + shortF * 0.1, 0.0, 1.0), clamp(0.5 + abs(longF) * 0.22, 0.0, 1.0));
}`;

export const SCENE = `#version 300 es
precision highp float;
#define L ${LAYERS}
#define ROWS ${ROWS}
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uRidges;   // RGBA16F: one row per plane (far -> near): crest height, smoothed slope, broad crest;
                             // then row L: water, waterline, bone, ink; row L+1: strokes, reflection, banks,
                             // indigo water; row L+2: near bank (-1: none), shore, pigment strength, malachite lean;
                             // row L+3: terraces, still mirror, open water
uniform sampler2D uNoise;    // NOISE tile (repeat)
uniform vec3  uLayer[L];     // foot height, foot fade, ink strength
uniform vec4  uView;         // x: world x of the view's left edge (viewport heights: the pan), y: scene height at its
                             // top edge, z: its height in scene units, w: its width in scene units (its aspect)
uniform float uHs;           // viewport heights per stretch (figure layers are placed in stretches)
uniform vec4  uKeep;         // the keep-out (box uv x): text's right edge, active 0/1, mist ramp half-width, figure guard
uniform vec4  uNote;         // the strip's "Draft art" note (box uv x0, y0, x1, y1, with a margin): no figures, no pigment
uniform sampler2D uFigA;     // figure layers (premultiplied RGBA, top row first, mipmapped for the bleed halo)
uniform sampler2D uFigB;
uniform vec4  uFigRA;        // a layer's world rect: u0 (stretches), y0 (scene height), 1/width, 1/height
uniform vec4  uFigRB;
uniform vec4  uFigKA;        // alpha, plane, phase (0: after the plane's ink, 1: after its mist band / the water), 0
uniform vec4  uFigKB;
uniform float uLift;         // camera lift, viewports: only ever <= 0 now (the closing's final sink)
uniform float uArrive;       // seconds into the ink bloom; >= 1.7 = at rest
uniform float uTide;         // strength of the dried wash edges
uniform vec4  uHz[L];        // the horizon state, per plane: sink (viewports), foot (uv y), ink multiplier, squash
uniform float uHzK;          // 0 = the page's full scene, 1 = the horizon
uniform vec4  uPlanes;       // 4b depth layers: x first plane painted, y last, z 1 = a layer over transparent paper
                             // (premultiplied colour, alpha = its coverage), 0 = an opaque view (alpha = mist admittance)
uniform vec4  uCrop;         // 4b: the view paints only columns [x, x + y] of its ridges and of uView's width (a depth
                             // layer's crop); (0, 1) = the whole view

${COLORS}
${HASH}
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
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * gnoise(p); p = ROT * p * 2.03; a *= 0.5; }
  return s;
}
// explicit LOD 0: these lookups sit in divergent branches (no derivatives) and are always magnified
float T(vec2 q) { return textureLod(uNoise, q, 0.0).r; }
float T2(vec2 q) { return textureLod(uNoise, q, 0.0).g; }
// camera lift per plane (parallax): the near planes move most, the far ones barely. Used now only for the
// closing's final sink (a negative lift: the near crest rises above the footer)
float lay(float dep) { return mix(0.05, 0.95, pow(dep, 3.0)); }
float rowV(int r) { return (float(r) + 0.5) / float(ROWS); }
const vec3 STROKE = vec3(0.430, 0.580, 0.660);   // the long low strokes on the water (light: darker, on the pale lake they read as a grey smear)

// Strokes on the water: discrete horizontal brush marks, anchored to the world, in rows below the
// waterline. Each has a loaded start and a thin tail, a slight tilt, and breaks up in a dry brush. Rows
// further out (nearer the viewer) have longer, broader and fewer strokes. Returns their density, 0..1.
float strokeRow(float px, float below, float dj, float th, float cell, float keep, float seed) {
  float s = 0.0;
  float ci = floor(px / cell);
  for (int k = -1; k <= 1; k++) {
    float c = ci + float(k);
    float h1 = hash12(vec2(c, seed));
    if (h1 > keep) continue;
    float h2 = hash12(vec2(c + 17.3, seed * 1.7));
    float h3 = hash12(vec2(c - 5.1, seed + 3.3));
    float len = cell * (0.45 + 0.85 * h3);
    float x0 = (c + h2 * 0.6) * cell;
    float u = (px - x0) / len;
    if (u < 0.0 || u > 1.0) continue;
    float taper = sin(3.14159 * pow(u, 0.55));                   // loaded start, long thin tail
    float y = dj + (h1 / keep - 0.5) * th * 4.0 + (u - 0.5) * (h2 - 0.5) * th * 2.5 + sin(u * 3.14159) * th * 0.6;
    float w = th * (0.2 + 0.8 * taper);
    float e = (below - y) / w;
    s = max(s, exp(-e * e * 1.6) * taper * taper);
  }
  return s;
}
float waterStrokes(vec2 p, float below) {
  float s = strokeRow(p.x, below, 0.020, 0.0022, 0.17, 0.55, 1.0);
  s = max(s, strokeRow(p.x, below, 0.052, 0.0030, 0.26, 0.45, 2.0) * 0.9);
  s = max(s, strokeRow(p.x, below, 0.110, 0.0042, 0.42, 0.38, 3.0) * 0.75);
  s = max(s, strokeRow(p.x, below, 0.215, 0.0065, 0.66, 0.32, 4.0) * 0.6);
  if (s <= 0.0) return 0.0;
  // dry brush: paper shows through along the stroke
  return s * smoothstep(-0.55, 0.25, gnoise(vec2(p.x * 36.0, below * 240.0)));
}
// The far shore's banks: flat strips of land along the waterline (a light wash, its top melting into the
// mist at the mountains' feet), running for stretches, broken elsewhere. Densest a little above the water;
// its foot runs on into the water and melts there under the water's feathered cover, so the waterline is
// never a ruled line.
float shoreBanks(vec2 p, float above) {
  float run = smoothstep(0.30, 0.50, T2(vec2(p.x * 0.21 + 0.17, 0.81)));
  if (run <= 0.0) return 0.0;
  float bh = (0.014 + 0.022 * T(vec2(p.x * 0.55 + 0.4, 0.37))) * run;  // its height above the water
  float top = bh * (0.8 + 0.4 * T2(vec2(p.x * 2.3, 0.12)));            // an uneven, low top
  float d = smoothstep(top, top * 0.2, above) * smoothstep(-0.04, 0.016, above);
  float dry = smoothstep(-0.7, 0.35, gnoise(vec2(p.x * 16.0, above * 110.0)));
  return clamp(run * d * 0.8 * dry, 0.0, 1.0);
}
// a figure layer at world point w (stretches, scene height): the crisp layer over a faint bleed halo (premultiplied),
// dissolving into mist at both ends of the layer (never a cut edge)
vec4 figAt(sampler2D T, vec4 R, vec2 w) {
  vec2 q = vec2((w.x - R.x) * R.z, (w.y - R.y) * R.w);
  if (q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0) return vec4(0.0);
  float ends = smoothstep(0.0, 0.13, q.x + (textureLod(uNoise, w * vec2(0.6, 2.4), 0.0).r - 0.5) * 0.08)
             * smoothstep(1.0, 0.88, q.x + (textureLod(uNoise, w * vec2(0.6, 2.4) + 0.5, 0.0).g - 0.5) * 0.08);
  q.y = 1.0 - q.y;
  vec4 c = textureLod(T, q, 0.0);
  vec4 h = textureLod(T, q, 2.2);
  return (c + h * 0.3 * (1.0 - c.a)) * ends;
}
// how much of a figure layer stands here along x (its rect, melting at both ends as figAt lays it in): 4b, the terraces
float figSpan(vec4 R, vec2 w) {
  vec2 q = vec2((w.x - R.x) * R.z, (w.y - R.y) * R.w);
  return smoothstep(0.0, 0.13, q.x) * smoothstep(1.0, 0.88, q.x) * step(0.0, q.y) * step(q.y, 1.0);
}
// 4b: the river town's depth (compose.ts RIVER_FRONT): how high above the far bank the nearest things in a column reach
// (the front row and its trees, the landmark, the masts, the bridge and the crowd on its crown); the mist lies behind
const float FRONT[${RIVER_FRONT.hb.length}] = float[${RIVER_FRONT.hb.length}](${RIVER_FRONT.hb.map((v) => v.toFixed(3)).join(', ')});
// the town's span along the river (world stretches): where its own hills keep misty feet and the far range runs on
const vec2 TOWN = vec2(${RIVER_FRONT.u0.toFixed(4)}, ${(RIVER_FRONT.u0 + RIVER_FRONT.du * (RIVER_FRONT.hb.length - 1)).toFixed(4)});
float frontAt(float u) {
  float x = (u - ${RIVER_FRONT.u0.toFixed(4)}) / ${RIVER_FRONT.du.toFixed(4)};
  if (x <= 0.0 || x >= ${(RIVER_FRONT.hb.length - 1).toFixed(1)}) return ${RIVER_FRONT.def.toFixed(3)};
  int i = int(x);
  return mix(FRONT[i], FRONT[i + 1], x - float(i));
}
float figHi = 0.0;   // how much of a figure layer stands here high in the sky (the later mist keeps off it)
float skyHi = 0.0;
void figOver(inout vec3 col, inout float mm, inout float cov, vec4 F, float k) {
  F *= k;
  figHi = max(figHi, F.a * skyHi);
  col = col * (1.0 - F.a) + F.rgb;
  cov = cov * (1.0 - F.a) + F.a;
  mm = mix(mm, mix(0.3, 0.02, skyHi), F.a);   // the drifting mist passes over the figures, thinly (not in the sky)
}

// the near framing elements (the Work willow, Writing's pine and reeds, Résumé's bamboo, Contact's willow tip)
// are painted in the sets in fresh or deep green, a key no other figure uses: those pixels are left out where the layer
// stands at its plane and laid over the whole view at the end (in the nearest depth layer only), so no plane, mist
// band or town mist comes in front of them: they stand nearest the camera and fade by their own depth (painted in the
// set). (The colour key stands in for a second framing layer per set at plane 4.)
float frameKey(vec4 F) {
  return smoothstep(0.07, 0.16, (F.g - max(F.r, F.b)) / max(F.a, 1e-3)) * step(0.02, F.a);
}
vec4 unframed(vec4 F) { return F * (1.0 - frameKey(F)); }
// Work's own grading (its fuller far range, the town's river hills), faded in and out over half a stretch:
// a 0.15-stretch edge would stand as a vertical seam in Writing's closing band (it frames the Work/Writing boundary)
float workW(float u) { return smoothstep(0.75, 1.3, u) * (1.0 - smoothstep(1.75, 2.35, u)); }
// where a plane's foot melts into its mist band, along x: broad billows (warped, low frequency), -0.5..0.5
float footN(float x, float fi) {
  float w = T(vec2(x * 0.07 + fi * 0.19, 0.29 + 0.07 * fi)) - 0.5;
  return (T(vec2(x * 0.13 + w * 0.25 + fi * 0.27, 0.11 * fi)) - 0.5) * 0.8 + (T2(vec2(x * 0.31 + fi * 0.5, 0.63)) - 0.5) * 0.35;
}
// the light at a point, summed over this place's light and its neighbours' (no seam where one place's light
// hands over to the next): x = the core (sigma 0.6 R), y = the bloom (sigma 1.6 R), z = the wide halo (sigma 3 R).
// D = the dominant light (for its direction and the water's glitter column).
vec3 lightFall(float u, float y, out vec4 D) {
  vec3 g = vec3(0.0);
  float k = floor(u), best = -1.0;
  D = lightK(k);
  for (int j = -1; j <= 1; j++) {
    vec4 Lj = lightK(k + float(j));
    vec2 d = vec2((u - Lj.x) * uHs, y - Lj.y);
    float r2 = dot(d, d), Rj = Lj.z * 0.92, st = abs(Lj.w);
    vec3 f = vec3(exp(-r2 / (0.36 * Rj * Rj)), exp(-r2 / (2.56 * Rj * Rj)), exp(-r2 / (9.0 * Rj * Rj))) * st;
    g += f;
    if (f.y > best) { best = f.y; D = Lj; }
  }
  return g;
}
// a ribbon of mist (qingxiao 1m08): a white band with a billowing top edge and a soft underside, tapering in and
// out along x; returns (fill, top rim, streamline). Its top is feathered over ft (wider where it crosses the
// light: never a dead-flat cut), the edge modulated by noise, and it swells along its length on a slow, warped noise
// (a fast one switches it on and off every ~50 px: vertical streaks down the slopes under it).
vec3 ribbon(float y, float c, float x, float seed, float lk) {
  float wx = x + 0.35 * (T(vec2(x * 0.11 + seed, 0.37)) - 0.5);
  float top = c + 0.022 * sin(x * 1.7 + seed) + 0.008 * sin(x * 4.9 + seed * 2.0) + 0.02 * (T(vec2(wx * 0.6 + seed * 0.21, 0.81)) - 0.5)
    + 0.03 * fbm3(vec2(x * 3.3 + seed, seed * 1.3)) + 0.01 * gnoise(vec2(x * 8.0 + seed, 2.3));   // (so no level line cuts a peak)
  float sw = T(vec2(wx * 0.05 + seed * 0.37, 0.53));
  float th = 0.004 + 0.022 * smoothstep(0.38, 0.66, sw);
  float taper = smoothstep(0.3, 0.55, sw);
  float ft = 0.006 + 0.045 * clamp(lk, 0.0, 1.0);
  float a = smoothstep(top + ft * 0.6, top - ft * 0.4, y) * smoothstep(top - th - 0.035, top - th, y);
  float rim = exp(-pow((y - top + 0.0022) / 0.0008, 2.0));
  float sl = exp(-pow((y - top + 0.008 + 0.003 * sin(x * 3.7 + seed)) / 0.0007, 2.0)) * smoothstep(0.5, 0.62, sw);
  // (its strength varies along x, so a band never reads as a level slab across a narrow window)
  float vx = smoothstep(0.3, 0.7, T(vec2(x * 1.6 + seed * 0.13, 0.91)) * 0.7 + T2(vec2(x * 3.7 + seed, 0.27)) * 0.4);
  return vec3(a * mix(0.15, 1.0, vx), rim * vx, sl * vx) * taper;
}

// "Morning opens": the mist across the range parts away from the light like curtains drawing back (xuanfang37-1m12),
// over the first ~2 s of Home's morning. A thick bank round a belt (by), split at the light's x; each half is drawn
// back sideways (its mist travels with its edge: drawn back, never wiped), its inner edge billowing and lit by the
// light pouring through the gap, thinning away as it opens. x: alpha, y: how lit (its inner edge).
vec3 curtain(vec2 p, float uy, float by, float t, float seed) {
  if (t > 2.3) return vec3(0.0);
  vec4 L0 = lightK0(0.0);
  float dx = p.x - L0.x * uHs;                       // viewport heights from the light
  // (it is already parting on the first painted frame, the host peak's tip standing in the gap: never an
  // empty phase of cloud over blank paper; it eases out of a small opening rather than out of a closed bank)
  float x = clamp((t + 0.06) / 1.9, 0.0, 1.0);
  float e = 1.0 - (1.0 - x) * (1.0 - x) * (1.0 - 0.6 * x);
  float open = mix(0.045, 1.2, e);                   // the gap's half-width
  float side = dx < 0.0 ? -1.0 : 1.0;
  float qx = p.x - side * open * 0.8;                // (the bank rides out with its edge: drawn back, never wiped)
  // its inner edge: a billowing front, lobed up its height
  float edge = (T(vec2(uy * 3.1 + seed, 0.3 + seed)) - 0.5) * 0.11 + (T2(vec2(uy * 9.0 + seed, 0.7)) - 0.5) * 0.035;
  float d = abs(dx) - open + edge;                   // > 0: still behind the curtain's edge
  float body = smoothstep(-0.015, 0.06, d);
  // a cloud bank with a crisp, lit, billowing top and a soft underside (the engine's belts' manner, larger)
  // (its top: broad swells along x, never a level slab, crowned by rounded billows of uneven width and height)
  float sw = (T(vec2(qx * 0.55 + seed, 0.41)) - 0.5) / 0.13;
  // (the billows are of uneven size, 0.6-1.4x (a stronger warp of their cells spreads their widths, and
  // each crown's height follows its own size), and the bank's top line is broken by a second, mid-scale swell, so the
  // lobes never sit in a row on one level)
  float bu = qx * 5.0 + 2.4 * (T(vec2(qx * 0.8 + seed * 1.7, 0.83)) - 0.5) / 0.13;
  float bf = fract(bu) - 0.5, bh = hash12(vec2(floor(bu), seed));
  float rr = mix(0.6, 1.4, hash12(vec2(floor(bu) + 0.5, seed + 3.1)));
  float billow = sqrt(max(0.0, 0.25 - bf * bf)) * 2.0 * (0.35 + 0.65 * bh) * rr;
  float sw2 = (T(vec2(qx * 1.7 + seed * 2.3, 0.19)) - 0.5) / 0.13;
  // (the bank rises toward the gap, as a curtain held up at its inner edge, and its swells are deeper, so it
  // is never a level slab)
  float top = by + 0.035 + 0.045 * sw + 0.022 * sw2 + 0.026 * billow + 0.05 * exp(-max(d, 0.0) / 0.22) - 0.02 * smoothstep(0.2, 0.8, abs(dx));
  float pxs = max(abs(dFdy(uy)), 1e-5);
  float cap = 1.0 - smoothstep(top - 1.5 * pxs, top + 1.5 * pxs, uy);
  float under = smoothstep(by - 0.15, by - 0.03, uy);
  float tex = 0.75 + 0.25 * smoothstep(0.3, 0.7, T(vec2(qx * 1.6, uy * 4.0) + seed));
  float fade = 1.0 - smoothstep(0.5, 1.0, x);
  float ends = 1.0 - smoothstep(0.45, 1.0, abs(qx - L0.x * uHs) - 0.35 * sw * 0.2);   // (it trails off: never full width)
  float a = clamp(body * cap * under * tex * fade * ends, 0.0, 1.0);
  float rim = exp(-pow((top - uy) / 0.009, 2.0)) * body;                 // the lit top
  float lit = exp(-pow((d - 0.012) / 0.035, 2.0)) * (1.0 - smoothstep(0.75, 1.0, x));   // the inner edge, toward the light
  // its value: bluer down in its body, deeper in the hollows between billows and under each billow's crown, lit on the
  // billows' tops (a cloud sea with value structure, never two flat white slabs)
  float hollow = smoothstep(0.22, 0.5, abs(bf)) * (1.0 - smoothstep(0.0, 0.06, top - uy)) * smoothstep(0.0, 0.012, top - uy);
  float lobe = smoothstep(0.35, 0.7, T(vec2(qx * 2.3 + seed, uy * 3.2)));
  float shade = clamp(smoothstep(0.0, 0.11, top - uy) * (0.5 + 0.5 * lobe) + 0.55 * hollow + 0.25 * smoothstep(0.04, 0.16, top - uy) * (1.0 - lobe), 0.0, 1.0);
  return vec3(a, max(rim, lit) * (1.0 - 0.6 * hollow), shade);
}

void main() {
  // x: across the view (the ridge columns); y: scene height (viewport heights from the scene's bottom)
  vec2 uv = vec2(uCrop.x + vUv.x * uCrop.y, uView.y - (1.0 - vUv.y) * uView.z);
  float aspect = uView.w;
  vec2 p = vec2(uView.x + uv.x * aspect, uv.y);   // world position (viewport heights): moves with the pan
  vec2 wu = vec2(p.x / uHs, uv.y);                // ...in stretches, for the figure layers
  float lift = uLift;
  bool settled = uArrive >= 1.7;

  // the scene here: water in front of the far shore (planes 0-2) and the brush technique
  vec4 scn = texture(uRidges, vec2(uv.x, rowV(L)));
  float wS = scn.r;
  float bone = scn.b, inkT = scn.a;
  float wY = mix(scn.g, scn.g * uHz[2].w, uHzK) - lay(0.5) * lift - uHzK * uHz[2].x;   // the waterline goes with the far shore
  vec4 scn2 = texture(uRidges, vec2(uv.x, rowV(L + 1)));   // strokes, reflection, banks, indigo water
  vec4 scn3 = texture(uRidges, vec2(uv.x, rowV(L + 2)));   // near bank, shore, pigment, malachite lean
  float nearY = scn3.r < -0.5 ? -9.0 : mix(scn3.r, scn3.r * uHz[2].w, uHzK) - lay(0.5) * lift - uHzK * uHz[2].x;
  float shoreK = scn3.g;
  vec4 scn4 = texture(uRidges, vec2(uv.x, rowV(L + 3)));   // terraces, still mirror, open water
  float terr = scn4.r * (1.0 - uHzK), mirror = scn4.g;
  // open water: water with no near bank before it; over a river the near bank is land, so a near plane there
  // stands whole, and only over open water is it a headland melting into it
  float wO = scn4.b;
  // pigment: never under the text (zero inside the keep-out, full again 2 ramps right of its edge), never in the horizon
  float keepPig = 1.0 - uKeep.y * (1.0 - smoothstep(uKeep.x, uKeep.x + uKeep.z * 2.0, uv.x));
  float pigK = scn3.b * keepPig * (1.0 - uHzK);
  float lean = scn3.a;
  float keepFig = 1.0 - uKeep.y * (1.0 - smoothstep(uKeep.w, uKeep.w + uKeep.z * 0.45, uv.x));
  // on the river the town's back rows dissolve into the mist under the hills, and low banks of mist drift among them.
  // 4b: keyed by depth, not by height: the mist lies behind the nearest things in each column (frontAt), so the
  // bridge's crown and its crowd, the landmark and the masts stand clear in front of it however high they rise
  float figMist = 1.0;
  if (wS > 0.0 && shoreK < 0.99) {
    float hb = uv.y - wY;              // height above the far bank
    float db = hb - frontAt(wu.x);     // ...above the nearest things here: the town behind them
    float n1 = T(vec2(p.x * 0.28, hb * 9.0 + 0.3)), n2 = T2(vec2(p.x * 0.61 + 0.2, hb * 14.0));
    float back = smoothstep(0.003, 0.025, db + (n1 - 0.5) * 0.012) * (0.55 + 0.5 * n1);
    float drift = smoothstep(0.5, 0.72, n1 * 0.75 + n2 * 0.35) * smoothstep(0.0, 0.008, db) * (1.0 - smoothstep(0.02, 0.034, db)) * 0.85;
    // high in the sky (the willow, a swallow) nothing is behind the town: no town mist there
    float sky5 = 1.0 - smoothstep(0.13, 0.19, hb);
    figMist = 1.0 - clamp(max(back * 0.92, drift), 0.0, 1.0) * wS * (1.0 - shoreK) * sky5;
    skyHi = 1.0 - sky5;
  } else skyHi = smoothstep(0.34, 0.46, uv.y);
  // the "Draft art" note: no figures and no pigment under its line. 4b: its guard is a patch of mist, not a box: clear
  // close round the line (inside the note box's margins: index.ts measureKeep), the pigment thinning back in across the
  // box's edge to about a third of its height beyond it, the edge billowing, so over pigment (Contact's indigo water) it
  // never cuts a ruled edge; figures come back by the box's edge, so the scene's figures just off it keep whole
  if (uNote.z > uNote.x) {
    float ar = uView.w / uView.z;                                    // the view's aspect: x in view heights
    vec2 nb = vec2((uNote.z - uNote.x) * ar, uNote.w - uNote.y);     // the note box, view heights
    vec2 nd = abs(vec2(uv.x * ar, vUv.y) - vec2((uNote.x + uNote.z) * 0.5 * ar, (uNote.y + uNote.w) * 0.5)) - nb * 0.5;
    float sd = (length(max(nd, 0.0)) + min(max(nd.x, nd.y), 0.0)) / nb.y;   // signed distance, in box heights
    if (sd < 0.6) {
      vec2 nn = vec2(uv.x * ar * 0.5, vUv.y) / nb.y * 0.3;
      float nz = (T(nn + vec2(0.31, 0.17)) - 0.5) / 0.13 * 0.65 + (T2(nn * 2.7 + vec2(0.7, 0.4)) - 0.5) / 0.14 * 0.35;
      float noteK = smoothstep(-0.3, 0.32, sd + nz * (0.06 + 0.1 * smoothstep(-0.3, 0.3, sd)));   // pigment
      keepFig *= smoothstep(-0.2, 0.12, sd + nz * 0.04);   // figures: only round the line (a boat or reeds just above keep)
      pigK *= noteK;
      keepPig *= noteK;
    }
  }
  // the far shore's reflection, gathered plane by plane as the shore is painted: the colour the still water
  // mirrors here (reflC) and how much of the shore lies in the mirror here (reflA)
  vec3 reflC = MIST;
  float reflA = 0.0;

  // static cloud banks, anchored to the world; the present pass sets mist drifting over them
  float sm = smoothstep(0.30, 0.74, T(p * vec2(0.23, 0.62) + vec2(0.0, lift * 0.35)) * 0.7 + T2(p * vec2(0.61, 1.7) + 0.37) * 0.42);

  // a depth layer (4b) paints only its planes [lo, hi] over transparent paper and keeps its coverage (every
  // "col = mix(col, x, a)" below is an "over" in premultiplied colour, so it holds for both: cov follows it)
  int lo = int(uPlanes.x + 0.5), hi = int(uPlanes.y + 0.5);
  bool layer = uPlanes.z > 0.5;
  vec3 col = PAPER;
  float cov = 1.0;
  if (layer) { col = vec3(0.0); cov = 0.0; }
  else {
    // luminous graded air: pale at the horizon, ice blue high up, a soft light core behind the host peak
    // (the inner places' windows are short crops: their ice blue comes down lower, so they carry the same morning)
    float inner = smoothstep(1.5, 2.2, wu.x);
    col = mix(mix(SKY, LIGHT, 0.6), mix(SKY_T, vec3(0.812, 0.890, 0.933), 0.6 * inner), smoothstep(mix(0.16, 0.27, inner), mix(0.64, 0.42, inner), uv.y));   // (the inner places' ice desaturated toward #CFE3EE)
  }
  vec4 Lg;
  vec3 lf = lightFall(wu.x, uv.y, Lg) * (1.0 - uHzK);
  vec2 ld = vec2((wu.x - Lg.x) * uHs, uv.y - Lg.y);
  float lr = length(ld);
  float glow = clamp(lf.y * 0.85 + lf.x * 0.3, 0.0, 1.0);   // the light, 0..1
  float pxv = max(abs(dFdy(uv.y)), 1e-5);   // one buffer px in scene units (uniform flow: before any branch)
  if (!layer) {
    // the light is a bloom, not a disc: a white-hot core, a soft falloff (sigma 1.6 R) and a wide, faint
    // cyan-white halo that spills into the ice-blue sky (qingxiao 2m08); no ring, no edge line
    col = mix(col, mix(BLOOM_C, LIGHT, 0.3), clamp(lf.z * 0.18, 0.0, 0.35));
    col = mix(col, LIGHT, clamp(lf.y * 0.5, 0.0, 1.0));
    col = mix(col, vec3(1.0), clamp(lf.x * 1.3, 0.0, 1.0));
    // the light's core: a compact white heart, brighter than everything round it, its edge soft (no
    // disc line); the bloom round it is the present pass's, after the grain
    { float Rh = Lg.z * 0.92, st = clamp(abs(Lg.w) * (homeL(Lg) ? 1.0 : 0.7), 0.0, 1.0);
      float heart = (1.0 - smoothstep(0.16 * Rh, 0.46 * Rh, lr)) * st;
      col = mix(col, vec3(1.0), heart); }
  }
  float mm = 0.18;   // drifting-mist admittance (alpha out)

  // cloud belts that lie between the planes, never over the nearest crests
  float b1y = uLayer[1].x + 0.17 - lift * 0.45 - uHzK * uHz[1].x + (T(vec2(p.x * 0.31, 0.3)) - 0.5) * 0.09 + 0.025 * fbm3(vec2(p.x * 2.0, 0.71));
  float b2y = uLayer[3].x + 0.15 - lift * 0.8 - uHzK * uHz[3].x + (T(vec2(p.x * 0.27, 0.7)) - 0.5) * 0.08 + 0.025 * fbm3(vec2(p.x * 2.0, 3.17));
  float belt1 = exp(-pow((uv.y - b1y) / 0.05, 2.0));
  float belt2 = exp(-pow((uv.y - b2y) / 0.05, 2.0));
  // on the river the hills stand behind the town: their cloud belts lie thinner, so the hills keep their colour
  float river = wS * (1.0 - shoreK);
  belt1 *= 1.0 - 0.7 * river;
  belt2 *= 1.0 - 0.7 * river;

  // Front-to-back pre-pass (height lookups only): at rest, planes hidden behind a nearer plane
  // that fully covers this pixel are skipped, which keeps the dense lower screen cheap.
  int first = lo;
  if (settled && wS <= 0.0) {   // (over water every plane counts: the near ones are only their ink there)
    for (int i = L - 1; i > 0; i--) {
      if (i > hi) continue;
      if (i <= lo) break;
      float fi = float(i);
      float h0 = texture(uRidges, vec2(uv.x, rowV(i))).r;
      float h = mix(h0, h0 * uHz[i].w, uHzK) - lay(fi / float(L - 1)) * lift - uHzK * uHz[i].x;
      if (h - uv.y > 0.03) { first = i; break; }
    }
  }

  // over water a layer gathers the far shore's reflection from the planes behind its own (it paints only its own)
  int start = wS > 0.0 ? 0 : first;
  for (int i = start; i < L; i++) {
    if (i > hi) break;
    bool paint = i >= first;
    float fi = float(i);
    float dep = fi / float(L - 1);                    // 0 far .. 1 near
    float ly = lay(dep) * lift + uHzK * uHz[i].x;     // the closing's sink, and the horizon's
    vec3 Lp = uLayer[i];
    float footY = mix(Lp.x - ly, uHz[i].y, uHzK);     // at the horizon, peaks rise from a low mist
    float fade = mix(Lp.y, 0.09, uHzK);
    float shoreW = i <= 2 ? wS * shoreK : 0.0;        // this plane is the far shore: it stands on the water
    float riverW = i <= 2 ? wS * (1.0 - shoreK) : 0.0;   // ...or, on the river, keeps its own feet in mist above the town
    // ...and across open water, in a water scene's own boneless technique (the lake, the crossing; not at a seam,
    // where a neighbour's mountains stand at the water's edge), it is a clear silhouette
    float openW = smoothstep(0.5, 1.0, shoreW) * smoothstep(0.6, 0.15, bone);
    // The far shore stands on the waterline. Across open water its wash runs down to the water (a short misty
    // foot), so its hills read and mirror; at a seam the foot stays misty. Where the water ends the foot keeps
    // to the waterline until the water has all but gone, so the wash never runs down across the fading water
    // as a long diagonal.
    if (shoreW > 0.0) {
      float sf = smoothstep(0.0, 0.3, shoreW);
      footY = mix(footY, wY - mix(0.012, 0.03, openW), sf);
      fade = mix(fade, mix(0.07, 0.045, openW), sf);
    }
    else if (wO > 0.0 && i >= 3) footY += 0.1 * wO;   // a near plane over open water: only its headlands show, melting into it
    // over the town (TOWN, from the river's depth profile) only its own hills (plane 2) keep their feet in mist
    // above it, and less high; the guests behind stand on the river's horizon, and the far range runs on over the town as
    // it does over the mountain and the lake (lifting all three left a hole in the one far range above the town). Where
    // the river comes out past his mountain the old lift holds, so his mountain's edge is painted as it always was.
    // Canvas2D lifts none.
    float tk = smoothstep(TOWN.x - 0.04, TOWN.x + 0.06, wu.x) * (1.0 - smoothstep(TOWN.y - 0.04, TOWN.y + 0.06, wu.x));
    float rl = mix(0.06, i == 2 ? 0.035 : i == 1 ? 0.0 : -1.0, tk);
    if (riverW > 0.0) { footY = mix(footY, max(footY, wY + rl), riverW); fade = mix(fade, max(fade, 0.085), riverW); }
    // over open water nothing stands before the far shore: its wash is fuller and flatter; a near plane
    // standing in open water is only a pale headland, so its crest never draws a line across the water
    float inkK = Lp.z * inkT * mix(1.0, uHz[i].z, uHzK) * (1.0 + 0.5 * openW) * (i >= 3 ? 1.0 - 0.55 * wO : 1.0);
    if (i == 2 && terr > 0.001) footY -= 0.075 * smoothstep(0.001, 0.05, terr);   // the terraced hill runs on down behind the near hills
    // (only over the town: the river's ridge columns step, and elsewhere (Home) this draws vertical bands down the slopes)
    float workWin = workW(wu.x);
    inkK *= 1.0 + 0.7 * riverW * workWin * (1.0 - uHzK);   // the river's hills stand clear behind the town (graded ice-blue peaks)
    float bodyW = mix(0.30, 0.16, dep) * (1.0 + 0.8 * openW);
    vec3 ridge = texture(uRidges, vec2(uv.x, rowV(i))).rgb;
    ridge = mix(ridge, ridge * uHz[i].w, uHzK);       // the horizon flattens the ranges (level distance)
    float h = ridge.r - ly;
    if (riverW * workWin > 0.001 && uHzK < 0.001) {
      // (the far range over the town loses its finest teeth: a 1-2-1 average over ~2 x 11 px of the ridge, so it
      // reads as a soft far wash, never a sawtooth "stock chart" hairline climbing behind the roofs)
      float dx = 0.012 / aspect;
      float hl = texture(uRidges, vec2(uv.x - dx, rowV(i))).r, hr = texture(uRidges, vec2(uv.x + dx, rowV(i))).r;
      float hl2 = texture(uRidges, vec2(uv.x - 2.0 * dx, rowV(i))).r, hr2 = texture(uRidges, vec2(uv.x + 2.0 * dx, rowV(i))).r;
      h = mix(h, (hl2 + 2.0 * hl + 3.0 * ridge.r + 2.0 * hr + hr2) / 9.0 - ly, riverW * workWin);
    }
    float y = uv.y;
    float d = h - y;                                  // > 0 inside the mountain
    // ink bloom: far planes are painted first, each one over ~0.85 s (all done by ~1.25 s)
    // (the morning: the host peak's crest is inked from the first frame, so its tip already stands through the parting
    // cloud: never cloud over empty paper; the others a breath earlier than a plain bloom)
    float headS = uMorn < 8.0 ? (i == 2 ? 0.42 : 0.15) : 0.0;
    float pr = settled ? 1.0 : clamp((uArrive + headS - fi * 0.1) / 0.85, 0.0, 1.0);

    if (paint && d > -0.03 && pr > 0.0) {
      // ink wicking into paper: a soft, slightly fuzzy edge (isotropic, never hair-like spikes)
      float farTown = riverW * workWin;   // (the far range over the town: soft wash only, no hairline, no fine teeth)
      float soft = mix(0.0034, 0.0013, dep) * (1.0 - 0.45 * openW) * (1.0 + 3.0 * farTown);   // cut-paper edges; across the water a shore stands crisper
      float fib = gnoise(p * vec2(70.0, 55.0) + fi * 7.3) * 0.6 + gnoise(p * vec2(22.0, 14.0) - fi) * 0.4;
      float inside = smoothstep(-soft, soft, d + fib * soft * 0.35);

      float dd = max(d, 0.0);
      vec2 lp = vec2(p.x, uv.y + ly);                // layer space (moves with the plane)
      // contour: darkest at the crest, broken by dry-brush streaks that run along the stroke
      float rimW = mix(0.012, 0.0068, dep);
      float dry = gnoise(vec2(lp.x * 9.0 + fi * 3.1, dd * 150.0 + fi)) * 0.65 + gnoise(vec2(lp.x * 28.0, dd * 380.0)) * 0.35;
      float rim = exp(-dd / rimW) * smoothstep(-0.5, 0.2, dry) * bone * (1.0 - farTown);   // boneless scenes: no contour
      // wash body: nearly flat silhouettes far away, strong gradation up close; pigment pools
      float pool = 0.88 + 0.12 * fbm3(lp * vec2(2.4, 4.0) + fi * 2.7);
      // the wash follows the massif (broad crest), with a little extra ink near every edge
      float db = max(ridge.b - ly - y, 0.0);
      float body = exp(-mix(dd, db, 0.6) / bodyW) * pool;
      // shadow faces: light from the upper left, so slopes falling to the right are shaded
      float slope = ridge.g;
      float shade = smoothstep(0.1, 1.4, -slope) - 0.5 * smoothstep(0.2, 1.4, slope);
      // texture strokes on the near planes: warped creases down the slopes
      float cun = smoothstep(0.3, 1.0, dep) * bone;
      vec2 cq = lp * vec2(11.0, 5.5) + vec2(fbm3(lp * 5.0 + fi) * 1.1, 0.0);
      float crease = pow(1.0 - abs(gnoise(cq + fi * 11.0)), 6.0);
      crease *= smoothstep(0.004, 0.025, dd) * exp(-dd / (bodyW * 0.9));
      // flying white: paper shows through the dry brush in broken streaks
      // (domain-warped, so the flying white never falls in evenly spaced vertical streaks)
      float streak = gnoise(vec2(lp.x * 9.0 + fbm3(lp * vec2(2.3, 3.1) + fi) * 2.6, lp.y * 6.0 + fbm3(lp * vec2(3.7, 1.9) - fi) * 1.8) + fi * 5.0);
      // hemp-fibre strokes: broken parallel lines running down the fall line of each face
      float u = (lp.x + dd * slope * 0.55) * 52.0 + gnoise(lp * vec2(5.0, 9.0) + fi) * 1.3;
      float hemp = smoothstep(0.66, 0.96, 1.0 - abs(fract(u) * 2.0 - 1.0));
      hemp *= smoothstep(-0.05, 0.5, gnoise(vec2(floor(u) * 1.7 + fi, dd * 16.0)));
      hemp *= smoothstep(0.004, 0.02, dd) * exp(-dd / 0.10) * cun;

      float densB = body * mix(0.22, 0.86, pow(dep, 1.6));   // far planes pale, the near ones carry the value
      float dens = rim * 0.85 * dep * dep + densB;   // far planes: wash only
      dens += shade * mix(0.10, 0.36, dep) * exp(-dd / 0.045) * bone;   // a short accent under the crest
      dens += cun * crease * (0.6 + 0.6 * max(shade, 0.0));
      dens += hemp * (0.22 + 0.3 * max(shade, 0.0));
      // terraced fields (the Résumé's shore): bands across the hill, each a dark, dry lip of earth with a paler wet field
      // above it that holds the light (and the malachite); none on the far range, none on the rounded crown, fading into
      // the foot's mist. 4b: the bands are level, as the figure layer's walls are (sets/terraces.ts): a field at level z
      // lies at y = z - s (crest - z), sagging where the hill swells toward us (s, one smooth noise along the hill), so
      // its lip never runs parallel to the crest. Where that layer stands on this plane it draws the walls itself, and
      // the bands give way to it (never two rhythms crossing on the flanks)
      float paddy = 0.0;
      if (terr > 0.001 && i >= 2) {
        float sag = 0.30 + 0.26 * clamp((T(vec2(lp.x * 0.9 + fi * 0.13, 0.57)) - 0.5) / 0.26 + 0.5, 0.0, 1.0);
        float z = lp.y + sag * db / (1.0 + sag);          // the level this point's field lies at
        float tstep = mix(0.0128, 0.009, smoothstep(0.5, 1.0, dep));
        float tq = -z / tstep + (T2(lp * vec2(1.7, 0.6) + fi * 0.31) - 0.5) * 0.5;
        float fr = fract(tq);
        float lip = smoothstep(0.74, 0.9, fr) * (1.0 - smoothstep(0.93, 1.0, fr));
        lip *= smoothstep(-0.45, 0.25, gnoise(vec2(lp.x * 38.0 + fi * 5.0, floor(tq) * 3.1)));
        float layW = 0.0;
        if (uFigKA.x > 0.0 && abs(uFigKA.y - fi) < 0.5) layW = figSpan(uFigRA, wu) * min(uFigKA.x, 1.0);
        if (uFigKB.x > 0.0 && abs(uFigKB.y - fi) < 0.5) layW = max(layW, figSpan(uFigRB, wu) * min(uFigKB.x, 1.0));
        float tk = terr * smoothstep(0.006, 0.024, db) * (1.0 - layW);
        paddy = tk * smoothstep(0.08, 0.3, fr) * (1.0 - smoothstep(0.52, 0.72, fr));
        dens += tk * lip * mix(0.28, 0.5, dep);
        dens -= paddy * densB * 0.3;
      }
      // the dry-brush ink crown. On the near crags only (planes 2-4: the host peak and the crags in front), held
      // light: a mass of ink on the summit and down the face turned away from the light,
      // its depth the true distance below the crest (13 ridge taps: it follows the rock, never the screen's columns),
      // bitten deeper by broad blobs of load and left bare in patches; its edge breaks into flying white along the
      // stroke's own direction (never plumb), and it bleeds into a slate-blue wash that runs into the plane's ice. The
      // shadow and light faces come from the face's BROAD slope (+-0.075 vh) and a light side that turns smoothly under
      // the light, so no vertical seam where the local slope flips (a cut-paper slice down the host peak). Ink over
      // wash: crisp near; the far ranges keep their soft graded washes.
      float crownW = 0.0, crownI = 0.0, cShd = 0.0;
      vec3 crownWC = INK_F, crownIC = INK_N;
      float crownK = smoothstep(0.3, 0.48, dep) * (1.0 - 0.6 * openW) * (1.0 - riverW) * (1.0 - 0.6 * terr) * (1.0 - uHzK) * keepPig;   // (planes 2-4: the host peak is plane 2; not the river's hills behind the town: they stay a soft far range)
      crownK *= smoothstep(0.04, 0.16, h - footY) * smoothstep(0.1, 0.34, vUv.y);
      if (crownK > 0.001 && d > -0.004) {
        // the crown is ONE brush stroke laid along the crest (never a melting, stair-stepped band sagging like a
        // rubber eyebrow). Everything about the stroke is read at the crest point nearest this pixel (the foot of the
        // perpendicular), never from this pixel's own column: per-column widths were what hung the ink in vertical
        // drips down a steep face. The crest is the 13-tap ridge as a polyline; Dp = the perpendicular distance to it.
        float Hp = max(h - footY, 0.05);
        float hs[13];
        float hTop = -9.0, hMin = 9.0;
        for (int s = 0; s < 13; s++) {
          float dx = float(s - 6) * 0.0125;
          float hr = s == 6 ? ridge.r : texture(uRidges, vec2(uv.x + dx / aspect, rowV(i))).r;
          if (s == 6) hr = h; else hr = mix(hr, hr * uHz[i].w, uHzK) - ly;
          hs[s] = hr;
          hTop = max(hTop, hr); hMin = min(hMin, hr);
        }
        float Dp = 9.0, fx = 0.0, fh = h; int fk = 6;
        for (int s = 0; s < 12; s++) {
          vec2 a0 = vec2(float(s - 6) * 0.0125, hs[s]);
          vec2 sg = vec2(0.0125, hs[s + 1] - hs[s]);
          vec2 q = vec2(0.0, y) - a0;
          float t = clamp(dot(q, sg) / dot(sg, sg), 0.0, 1.0);
          vec2 c = a0 + sg * t;
          float dist = length(vec2(0.0, y) - c);
          if (dist < Dp) { Dp = dist; fx = c.x; fh = c.y; fk = s + int(t + 0.5); }
        }
        float alongF = p.x + fx;                                            // world position of the foot along the crest
        float hl = hs[max(fk - 2, 0)], hr2 = hs[min(fk + 2, 12)];
        float sS = (hs[min(fk + 3, 12)] - hs[max(fk - 3, 0)]) / (0.0125 * float(min(fk + 3, 12) - max(fk - 3, 0)));   // broad slope at the foot
        vec4 Lc;
        lightFall(wu.x + fx / uHs, fh, Lc);
        float fc = clamp((Lc.x - wu.x - fx / uHs) * uHs / 0.08, -1.0, 1.0);   // the light's side (+1: to the right)
        float shd = smoothstep(0.05, 0.8, sS * fc);                        // the face turned away from the light
        float lit = smoothstep(0.1, 0.9, -sS * fc);
        float summitK = max(smoothstep(-0.07, -0.01, fh - (ridge.b - ly)), smoothstep(-0.045, -0.008, fh - hTop) * 0.85);
        // a col (the crest a local minimum here): no ink at all
        float saddle = smoothstep(0.002, 0.012, min(hl, hr2) - fh);
        cShd = shd * crownK;
        float boneK = smoothstep(0.3, 0.7, bone);
        float Hs = max(Hp, 0.3);
        float desc = clamp((hTop - fh) / Hs, 0.0, 1.0);   // how far down the face the foot lies (from its own local summit; a lower crag is not 'down the host's face')
        // thick-thin along the stroke (0.15..1), 1-2 full lifts per crest, the width on the shadow face only (the lit
        // face goes clean to a hairline), pressed on the summit
        float tt = gnoise(vec2(alongF * 5.0 + fi * 2.3, 0.37 + fi)) * 0.65 + gnoise(vec2(alongF * 13.0 - fi, 1.9)) * 0.35;
        float modW = mix(0.15, 1.0, smoothstep(-0.55, 0.55, tt));
        float gapL = max(smoothstep(-0.62, -0.46, gnoise(vec2(alongF * 4.2 + fi * 5.1, 2.7))), smoothstep(0.6, 0.95, summitK));
        float Wb = Hs * 0.085 * modW * mix(0.08, 1.0, max(shd, 0.6 * summitK)) * mix(1.0, 1.6, summitK);
        // never deeper than a third of the crest's width here (a narrow spire is not filled), nor its relief
        float span = 0.0;
        for (int s = 0; s < 13; s++) span += step(fh - 0.09, hs[s]);
        Wb = min(Wb, 0.35 * min(span * 0.0125, max(hTop - hMin, 0.03)));
        Wb = max(Wb, pxv * 1.1);
        // bites from low-frequency noise (features of a few px), never per-texel thresholds
        float bite = gnoise(vec2(alongF * 9.0 + fi * 1.3, 5.3)) * 0.22 + gnoise(vec2(alongF * 26.0, 7.7)) * 0.14 + gnoise(vec2(alongF * 80.0, 2.1)) * 0.05;
        float fw = 0.85 * pxv;                                               // ~ fwidth(Dp): Dp is a true distance
        float aM = 1.0 - smoothstep(-fw, fw, Dp - Wb * (1.0 - bite));
        float u = clamp(Dp / Wb, 0.0, 1.0);
        // flying white: bristle tracks running WITH the stroke (fast across it, slow along it), opening toward its
        // inner side and where the brush ran dry; soft thresholds (a few px), never a per-texel step
        float fwS = gnoise(vec2(alongF * 4.0 + fi * 3.1, u * 5.5 + fi * 0.7)) * 0.6 + gnoise(vec2(alongF * 11.0 - fi, u * 11.0 + 3.3)) * 0.4;
        float dryA = smoothstep(-0.25, 0.45, gnoise(vec2(alongF * 2.4 + fi * 0.9, 4.1)));
        float open = max(dryA, 0.15) * smoothstep(0.3, 0.8, u) * smoothstep(-0.1, 0.15, fwS + 0.35 * (u - 0.55));
        aM *= 1.0 - 0.9 * open;
        // the stroke ends abruptly and raggedly where it has run far enough down a face (no taper into a drip)
        float endT = gnoise(vec2(alongF * 7.0 + fi, 8.1)) * 0.2 + gnoise(vec2(alongF * 3.0 + fi, u * 4.5 + 1.3)) * 0.18 + 0.5;
        aM *= 1.0 - smoothstep(endT - 0.02, endT + 0.02, desc * 2.0);
        aM *= gapL * (1.0 - saddle);
        aM *= smoothstep(0.0, 0.003, Hp);
        float Md = Wb;
        if (boneK < 0.999) {
          // a boneless place (the lake, the crossing): the same stroke, thinner and in slate-indigo, no flying white
          float Wn = Wb * 0.5;
          float aN = (1.0 - smoothstep(-fw, fw, Dp - Wn * (1.0 - bite))) * 0.8 * gapL * (1.0 - saddle);
          aM = mix(aN, aM, boneK);
          Md = mix(Wn, Wb, boneK);
        }
        float gw = clamp(Dp / max(Md * 3.0 + 0.008, 1e-4), 0.0, 1.0);
        crownW = pow(1.0 - gw, 1.7) * mix(0.1, 0.4, shd) * mix(1.0, 0.3, lit) * gapL * (1.0 - saddle) * smoothstep(0.0, 0.01, Md / Hp);
        crownW *= 1.0 - smoothstep(0.35, 0.6, desc);
        crownWC = mix(mix(INK_F, AZ_D, 0.35), mix(AZ_M, AZ_D, 0.5), smoothstep(0.2, 0.9, gw));
        crownI = aM * mix(0.82, 0.95, summitK) * (i >= 4 ? 0.69 : 1.0) * (0.78 + 0.22 * smoothstep(-0.5, 0.5, gnoise(vec2(alongF * 6.0, u * 2.5 + fi))));   // (the load varies inside the stroke)   // (the crag under the plum: 0.55 of 0.8)
        crownIC = mix(INK_N, INK_F, 0.18 + 0.2 * u);
        crownIC = mix(mix(INK_F, AZ_D, 0.35), crownIC, boneK);
        // a figure standing on this crest (the hut) takes the crown out of its column
        float figG = 0.0;
        if (uFigKA.x > 0.0 && abs(uFigKA.y - fi) < 0.5) figG = max(figAt(uFigA, uFigRA, vec2(wu.x, h - 0.004)).a, figAt(uFigA, uFigRA, vec2(wu.x, h + 0.01)).a);
        if (uFigKB.x > 0.0 && abs(uFigKB.y - fi) < 0.5) figG = max(figG, figAt(uFigB, uFigRB, vec2(wu.x, h - 0.004)).a);
        float gK = crownK * (1.0 - smoothstep(0.05, 0.35, figG));
        crownW *= gK; crownI *= gK;
        dens += (crownI * 0.6 + crownW * 0.3) * 0.25;
      }
      float bodyFrac = densB / max(dens, 1e-4);      // how much of the ink is the wash (the colour carries part of it)
      dens *= mix(1.0, 0.72 + 0.28 * smoothstep(-0.7, 0.3, streak), cun);
      // pigment granulation: dense ink settles into the paper unevenly
      dens *= 1.0 + gnoise(p * 150.0 + fi * 17.0) * 0.07 * smoothstep(0.12, 0.6, dens);

      // dried wash edge: the first wash stopped here and left a faint, broken tide line
      float reach = dd / (bodyW * 2.6);
      float tideR = 0.42 + (T2(lp * vec2(0.8, 1.1) + fi * 0.37) - 0.5) * 0.55;
      float tk = uTide * smoothstep(0.1, 0.6, dep);
      dens *= mix(1.0 - 0.3 * tk, 1.0, smoothstep(tideR + 0.035, tideR - 0.035, reach));
      dens += tk * 0.075 * exp(-pow((reach - tideR) / 0.016, 2.0)) * smoothstep(0.38, 0.62, T(lp * vec2(2.3, 0.7) + fi * 0.5));

      // the wet front of the arrival: drops land along the crest (far planes first), the water
      // spreads sideways and runs down the massif; its edge is feathered by the paper's fibres,
      // and pigment gathers just behind it (the tide line it leaves when it stops)
      float halo = 1.0, wet = 1.0;
      if (!settled) {
        float e = 1.0 - pow(1.0 - pr, 1.7);                       // quick to start, slow to settle
        float front = e * 2.0 - 0.32;
        float drop = smoothstep(0.32, 0.68, T2(vec2(p.x * 0.19 + fi * 0.131, 0.37 + fi * 0.173)));
        float wob = T(lp * vec2(0.9, 1.4) + fi * 0.21) - 0.5;
        float wob2 = T2(lp * vec2(3.1, 4.3) + fi * 0.43) - 0.5;
        float capil = gnoise(lp * vec2(46.0, 30.0) + fi * 3.7) * 0.6 + gnoise(lp * vec2(130.0, 90.0)) * 0.4;   // fibres at the edge
        float rf = mix(dd, db, 0.75) / (bodyW * 2.6);              // the water follows the massif, not each spire
        float a = rf * 0.8 + drop * 0.55 + wob * 0.34 + wob2 * 0.16;
        float edge = a + capil * 0.035;
        float cover = smoothstep(front + 0.07, front - 0.11, edge);
        // damp paper just ahead of the ink: the far washes show through it, softened
        halo = max(smoothstep(front + 0.16, front - 0.06, edge), 0.4 * smoothstep(front + 0.42, front - 0.04, a));
        float poolF = exp(-pow((front - 0.06 - edge) / 0.06, 2.0)) * (1.0 - e * e);
        dens = (dens * (0.82 + 0.18 * e) + poolF * 0.2) * cover;  // pigment pools at the moving front
        wet = cover;
      }

      // the feet dissolve into the mist band below each plane
      // (the foot's line on a slower, warped noise: a faster one (x * 0.42) lets the wash hang down in ~40 px tongues,
      // which under the young palette's fuller washes read as vertical streaks down every slope)
      float fY = footY + footN(p.x, fi) * 0.09 * (1.0 - 0.6 * shoreW);
      float foot = smoothstep(fY, fY + fade, y + (sm - 0.5) * 0.06);
      dens = clamp(dens * foot * inkK, 0.0, 1.0);

      vec3 ink = mix(INK_F, INK_N, pow(dep, 0.8));
      ink = mix(ink, AIR, (1.0 - dep) * 0.55);       // atmospheric perspective toward ice
      vec3 fill;
      if (pigK > 0.001) {
        // misted blue-green (qinglu): the ink keeps its bones (contour, creases, texture strokes) and lightens its
        // wash, a mineral wash carries the mass (azurite toward the crest, malachite down the slope, by height
        // above the plane's foot), then the bones show through again. Far planes take the misted pigments, near
        // planes approach the deep ones; the colour dissolves into the foot's mist exactly as the ink does.
        float kp = pigK / 0.75;
        float dB = dens * clamp(bodyFrac, 0.0, 1.0), dI = dens - dB;
        fill = mix(MIST, ink, clamp(dI + dB * (1.0 - 0.55 * kp), 0.0, 1.0));
        // (graded from the massif's broad crest, not from each column's own crest: from the local crest, the dark
        // top colour hangs down in a column under every notch and saddle, vertical streaks down the slopes)
        float hh = clamp(mix(dd, db, 0.85 * smoothstep(0.3, 0.5, dep)) / (bodyW * 1.5), 0.0, 1.0);   // (far ranges: their own crest; the massif's steps showed as seams there)   // 0 at the crest .. 1 where the wash has faded
        // (the rich palette takes the deeper grades and lifts the mist off them; misted is unchanged up to 0.6 of rich)
        float richK = smoothstep(0.6, 1.0, kp);
        float deepK = clamp(smoothstep(0.05, 0.8, dep) * 0.92 * (1.0 + 0.4 * richK) + 0.16 * richK, 0.0, 1.0);   // the host keeps its value
        // where azurite gives way to malachite; a malachite-led scene (the terraces, lean > .6) is malachite to the crest
        // (suisui 0m28) one clean vertical gradient per plane, the hue set by the scene (azurite-led peaks, a
        // malachite-led scene in jade), deep at the crest and washing out to ice white at the foot; no blue-green smudges
        float hueK = smoothstep(0.58, 0.8, lean);
        vec3 crestC = mix(mix(AZ_M, AZ_D, deepK), mix(MA_M, MA_D, deepK), hueK);
        crestC = mix(crestC, mix(AZ_M, AZ_D, 0.45), 0.6 * workW(wu.x) * (1.0 - smoothstep(0.45, 0.7, dep)));
        vec3 pig = mix(crestC, mix(AIR2, LIGHT, 0.4), smoothstep(0.0, 1.0, hh));
        pig = mix(pig, AIR2, (1.0 - dep) * 0.35 * (1.0 - 0.45 * richK));
        // (on Work the far range behind the town is an ice-blue range: a fuller, deeper wash)
        float workK = workW(wu.x) * (1.0 - smoothstep(0.45, 0.7, dep));
        float a = clamp(pigK * (0.5 + 0.8 * body + 0.9 * paddy) * foot * inkK * wet * 1.25 * (1.0 + 0.7 * workK), 0.0, 1.0);
        fill = mix(fill, pig, a * 0.9);
        fill = mix(fill, ink, clamp(dI * 0.5 * kp, 0.0, 1.0));
        // the flooded paddies hold the light: bright jade water on each tread
        fill = mix(fill, mix(MA_M, LIGHT, 0.55), clamp(paddy * 0.2 * keepPig * (1.0 - uHzK), 0.0, 1.0));   // (a breath, not a stripe per tread)
      } else fill = mix(MIST, ink, dens);
      // the light: the far planes dissolve into the light core (backlit haze); every crest facing the light takes a thin
      // rim of light on its lit side, the shadow side keeps its contour
      float facing = Lg.x > wu.x ? 1.0 : -1.0;
      float litF = smoothstep(0.05, 1.0, -slope * facing) * (0.35 + 0.65 * smoothstep(0.0, 0.6, glow + 0.25));
      float rimL = exp(-dd / mix(0.007, 0.0035, dep)) * litF * smoothstep(0.0, 0.35, dep);
      fill = mix(fill, LIGHT, clamp(rimL * (0.3 + 0.9 * glow) + glow * (1.0 - dep) * (homeL(Lg) ? 0.12 : 0.4), 0.0, 0.85));   // (Home: the peaks stand dark before the light)
      // far planes lift toward ice white (only the near planes keep their value)
      fill = mix(fill, AIR2, 0.62 * (1.0 - smoothstep(0.2, 0.45, dep)) * (1.0 - uHzK) * (1.0 - 0.5 * riverW * workWin) * (1.0 - 0.75 * workW(wu.x)));   // (over the town the far range keeps its ice-blue wash: the peaks behind the bridge)
      // a crisp rim of light, 2-3 buffer px, on the crests facing the light (visible at 1x)
      float rimPx = pxv * mix(2.0, 3.2, dep);
      float rimB = (1.0 - smoothstep(rimPx, rimPx + 1.2 * pxv, dd)) * smoothstep(0.1, 0.6, -slope * facing + 0.25) * (0.5 + 0.5 * smoothstep(0.0, 0.5, glow + 0.2)) * smoothstep(0.1, 0.4, dep);
      // the contour: a crisp thick-thin line in ink (INK_N) along every crest but the farthest, so the crests never
      // read as smooth airbrush gradients; its width set by the slope and a slow noise (about 1.5-3 px near, 0.5 px
      // far), broken in a few places along each ridge where the brush lifted; and on the near crag the creases and hemp
      // strokes return at about half strength, crisp near, nothing far (clean outlines over flat graded fills).
      float wPx = mix(0.5, 3.0, smoothstep(0.1, 0.8, dep)) * (0.6 + 0.55 * smoothstep(0.1, 1.2, abs(slope))) * (1.0 + 0.35 * gnoise(vec2(lp.x * 2.3 + fi * 1.7, fi * 0.9)));
      float wL = wPx * pxv;
      float gap = smoothstep(-0.42, -0.22, gnoise(vec2(lp.x * 3.4 + fi * 2.9, 0.5 + fi)));   // 3-4 breaks per ridge
      float cline = (1.0 - smoothstep(wL, wL + 1.1 * pxv, dd)) * gap * smoothstep(0.1, 0.3, dep) * bone * (1.0 - farTown);
      // a crest low in the view (the phone strip's foot) is not ruled across it in ink: it melts into the mist there
      float lowK = smoothstep(0.1, 0.34, vUv.y);
      cline *= mix(0.2, 1.0, lowK);
      vec3 lineC = mix(mix(INK_F, INK_N, 0.6), INK_N, dep);
      fill = mix(fill, lineC, cline * mix(0.45, 0.88, smoothstep(0.2, 0.55, dep)) * clamp(foot * inkK * 1.6, 0.0, 1.0) * wet * (1.0 - 0.75 * rimB));
      if (pigK > 0.001) {
        float tex = (cun * crease * (0.6 + 0.6 * max(shade, 0.0)) + hemp * (0.22 + 0.3 * max(shade, 0.0))) * smoothstep(0.55, 0.9, dep);
        fill = mix(fill, mix(ink, INK_N, 0.3), clamp(tex * 0.45 * foot * inkK * wet, 0.0, 0.6));
      }
      // the crown goes on over the colour and the contour: wash, then the ink mass (each held light)
      { float cF = foot * min(inkK * 1.3, 1.0) * wet;
        fill = mix(fill, crownWC, clamp(crownW * 0.6 * cF, 0.0, 0.5));
        fill = mix(fill, crownIC, clamp(crownI * 0.9 * cF, 0.0, 0.8)); }
      fill = mix(fill, mix(AIR2, MIST, 0.5), (1.0 - lowK) * 0.72 * smoothstep(0.5, 0.9, dep));   // (the strip's foot: no dark ridge row)
      fill = mix(fill, RIM_L, rimB * 0.92 * wet * keepPig);
      // the light spills over the crests in front of it: the sky-side edge of each ridge is lifted by the glow
      // (backlit rim), strongest right against the light, gone a few tens of px down
      fill = mix(fill, LIGHT, clamp(glow * glow * exp(-dd / mix(0.010, 0.016, dep)) * 0.75 * wet * keepPig * (1.0 - 0.85 * cShd), 0.0, 0.8));   // (not inside the ink of a shadow face: there it reads as a double outline)
      float cv = inside * halo;
      // a near plane's pale, boneless foot is a veil of mist, not a sheet of paper: what lies behind it (the
      // Résumé's terraces) shows through where its wash is thin (no hill-shaped void cut out of the scene)
      if (i >= 3 && terr > 0.001) cv *= mix(0.25, 1.0, smoothstep(0.04, 0.3, dens));   // (on the terraces only; elsewhere the thin foot's texture shows the slopes behind through it in vertical bands)
      if (layer) {
        // the same over, written for premultiplied colour (a near plane over open water is only its ink)
        float aE = cv;
        vec3 P = fill * cv;
        if (i >= 3 && wO > 0.0) { aE = cv * (1.0 - (1.0 - dens) * wO); P = cv * (fill * (1.0 - wO) + ink * dens * wO); }
        col = col * (1.0 - aE) + P;
        cov = cov * (1.0 - aE) + aE;
      } else {
        if (i >= 3 && wO > 0.0) fill = mix(fill, mix(col, ink, dens), wO);   // over open water a near plane is only its ink
        col = mix(col, fill, cv);
      }
      mm = mix(mm, mix(0.6, 0.1, dep) * (1.0 - dens), cv);
    }
    // a figure layer that stands on this plane, before its mist band (it softens the feet); it inks in with its plane
    float prF = settled ? 1.0 : clamp((uArrive - fi * 0.1 - 0.35) / 0.6, 0.0, 1.0);
    if (paint && uFigKA.x > 0.0 && abs(uFigKA.y - fi) < 0.5 && uFigKA.z < 0.5) figOver(col, mm, cov, unframed(figAt(uFigA, uFigRA, wu)), uFigKA.x * keepFig * prF);
    if (paint && uFigKB.x > 0.0 && abs(uFigKB.y - fi) < 0.5 && uFigKB.z < 0.5) figOver(col, mm, cov, unframed(figAt(uFigB, uFigRB, wu)), uFigKB.x * keepFig * prF);

    // the far shore's reflection: the plane mirrored in the waterline (y' = 2 wY - y) and painted with the
    // plane's own wash, so the mirror holds its true shape and tone (the water takes a third of it, below).
    // Softened a little (spires melt in the water) and wavering sideways in thin rows, like still water.
    if (shoreW > 0.0 && y < wY && pr > 0.0) {
      float bw = wY - y;
      float yr = wY + bw;
      float wav = gnoise(vec2(bw * 230.0 + fi * 1.7, p.x * 1.3)) * (0.0012 + 0.02 * bw) / aspect * (1.0 - 0.8 * mirror);
      vec3 rr = texture(uRidges, vec2(uv.x + wav, rowV(i))).rgb;
      rr = mix(rr, rr * uHz[i].w, uHzK);
      float dr = mix(rr.r, rr.b, 0.3) - ly - yr;
      if (dr > -0.02) {
        vec2 lr = vec2(p.x, yr + ly);
        float pool = 0.75 + 0.25 * fbm3(lr * vec2(2.4, 4.0) + fi * 2.7);
        float bodyR = exp(-mix(max(dr, 0.0), max(rr.b - ly - yr, 0.0), 0.6) / bodyW) * pool * mix(0.62, 0.84, dep);
        float footR = smoothstep(footY, footY + fade, yr);
        float dR = clamp(bodyR * footR * inkK, 0.0, 1.0) * pr;
        vec3 inkR = mix(mix(INK_F, INK_N, pow(dep, 0.8)), MIST, (1.0 - dep) * 0.35);
        float covR = smoothstep(-0.008, 0.01, dr) * shoreW;
        reflC = mix(reflC, mix(MIST, inkR, dR), covR);
        reflA = max(reflA, covR);
      }
    }

    if (!paint) continue;   // a plane behind this layer's own: its reflection only

    // mist band drifting between this plane and the next
    float bY = footY + footN(p.x, fi) * 0.09 + 0.03 * fbm3(vec2(p.x * 3.1 + fi * 1.7, fi * 0.37));   // the band's top billows (with the foot, on the slower noise, plus a finer fbm, so no band reads as a level slab)
    float band = 1.0 - smoothstep(bY - 0.05, bY + fade * 1.5, uv.y);
    band *= smoothstep(bY - 0.30, bY - 0.02, uv.y) * 0.5 + 0.5;
    // the near planes' mist keeps off open water; the far shore's lies thinner on it, so its hills read
    float bandK = i >= 3 ? 1.0 - 0.75 * wO : 1.0 - 0.7 * openW;
    bandK *= 1.0 - 0.6 * riverW;    // the river's hills: a thinner band at their misty feet
    float bA = clamp(band * (0.6 + 0.4 * sm) * 0.8 * bandK * mix(0.7, 1.0, smoothstep(0.25, 0.7, T(vec2(p.x * 0.6 + fi * 0.21, 0.47 + fi * 0.1)))), 0.0, 1.0) * (1.0 - 0.85 * figHi);   // (its strength varies along x)
    // over the terraces the band below the terraced hill is a thin veil (the hill's body runs on down to the
    // hills in front: no paper-white void between them), and its mist is ice, never paper
    float terrB = (i == 2 || i == 3) ? smoothstep(0.001, 0.05, terr) : 0.0;
    bA *= 1.0 - 0.6 * terrB;
    col = mix(col, mix(MIST, mix(MIST2B, MA_M, 0.25), terrB), bA); cov = mix(cov, 1.0, bA);
    mm = max(mm, band * 0.9 * (i >= 3 ? 1.0 : bandK) * (1.0 - figHi));
    // (the mist is there from the first frame; the ink blooms into it)
    // the belts are ribbons of mist with crisp lit tops (the old soft belts kept faint beneath them)
    if (i == 2) {
      float b1 = belt1 * (1.0 - 0.6 * openW) * (1.0 - 0.85 * figHi); float bb = clamp(b1 * sm * 0.45, 0.0, 1.0); col = mix(col, SKY, bb); cov = mix(cov, 1.0, bb); mm = max(mm, b1);
      vec3 rb = ribbon(uv.y, b1y + 0.02, p.x, 1.7, glow * 2.0) * (1.0 - 0.6 * openW) * (1.0 - 0.7 * river) * (1.0 - uHzK);
      float ra = clamp(rb.x * 0.88, 0.0, 1.0);
      col = mix(col, LIGHT, ra); cov = mix(cov, 1.0, ra);
      col = mix(col, mix(AIR, AZ_M, 0.4), rb.z * 0.35 * ra);
      mm = max(mm, rb.x * 0.6 * (1.0 - figHi));
      if (uMorn < 8.0) {   // the morning: the curtain of mist in front of the host peak, parting
        vec3 cu = curtain(p, uv.y, lightK0(0.0).y - 0.05, uMorn, 2.3);
        float ca = cu.x * 0.94 * (1.0 - 0.85 * figHi) * (1.0 - uHzK);
        col = mix(col, mix(mix(LIGHT, mix(mix(MIST, SKY, 0.5), AZ_M, 0.22 * cu.z), cu.z * 0.85), vec3(1.0), cu.y), ca); cov = mix(cov, 1.0, ca); mm = max(mm, cu.x);
      }
    }
    if (i == 3) {
      float bb = clamp(belt2 * sm * 0.5 * bandK, 0.0, 1.0) * (1.0 - 0.85 * figHi); col = mix(col, SKY, bb); cov = mix(cov, 1.0, bb); mm = max(mm, belt2 * (1.0 - figHi));
      vec3 rb = ribbon(uv.y, b2y + 0.01, p.x, 4.1, glow * 2.0) * bandK * (1.0 - 0.7 * river) * (1.0 - uHzK) * (1.0 - 0.85 * figHi);
      float ra = clamp(rb.x * 0.9, 0.0, 1.0);
      col = mix(col, LIGHT, ra); cov = mix(cov, 1.0, ra);
      col = mix(col, mix(AIR, AZ_M, 0.4), rb.z * 0.35 * ra);
      mm = max(mm, rb.x * 0.6 * (1.0 - figHi));
      if (uMorn < 8.0) {   // the morning: the nearer curtain, lower, parting a beat behind the first
        vec3 cu = curtain(p, uv.y, lightK0(0.0).y - 0.17, uMorn - 0.12, 5.9);
        float ca = cu.x * 0.94 * bandK * (1.0 - 0.85 * figHi) * (1.0 - uHzK);
        col = mix(col, mix(mix(LIGHT, mix(mix(MIST, SKY, 0.4), AZ_M, 0.26 * cu.z), cu.z * 0.85), vec3(1.0), cu.y), ca); cov = mix(cov, 1.0, ca); mm = max(mm, cu.x);
      }
    }

    // water, in front of the far shore and behind the near planes: reserved paper, the far shore's
    // reflection broken by long horizontal tears, a few long low strokes; the waterline melts into mist
    if (i == 2 && wS > 0.0) {
      float below = wY - y;
      // the banks: land along the waterline, before the water
      float bk = scn2.b > 0.0 ? shoreBanks(p, -below) * scn2.b * pr : 0.0;
      col = mix(col, mix(INK_F, MIST, 0.2), bk * 0.22 * inkT); cov = mix(cov, 1.0, bk * 0.22 * inkT);
      float cover = wS * smoothstep(-0.008, 0.034, below);
      if (nearY > -1.0) cover *= smoothstep(nearY - 0.008, nearY + 0.005, y);   // a river: its near bank is land
      if (cover > 0.0) {
        // the water is reserved paper; near the far shore mist lies on it, thinning towards the viewer,
        // so the shore's misty foot runs on into the water without a line
        vec3 water = mix(mix(PAPER, SKY, 0.4), MIST, 0.3 * exp(-below / 0.035));
        // glassy water: pale ice at the far shore deepening to clear cyan toward the viewer (never under the text)
        water = mix(water, mix(vec3(0.900, 0.953, 0.970), vec3(0.560, 0.790, 0.860), smoothstep(0.0, 0.12, below)), 0.75 * keepPig * (1.0 - uHzK) * (1.0 - mirror * 0.4));
        float rn = gnoise(vec2(p.x * 1.6, below * 74.0) + vec2(3.1, 0.0)) * 0.6 + gnoise(vec2(p.x * 4.6, below * 150.0)) * 0.4;
        float gap = smoothstep(0.34 - below * 0.6, 0.56 - below * 0.6, rn);   // a few long tears, wider further out
        // the mirror image: at most a third of its source's ink, torn by the ripples, fading further out; on still water
        // (the lake: mirror) it is whole: up to 0.6 of the source, barely torn, holding its strength
        float rcap = mix(0.34, 0.6, mirror);
        float rk = rcap * min(scn2.g, 1.0) * reflA * (1.0 - mix(0.7, 0.15, mirror) * gap) * mix(mix(0.75, 1.0, exp(-below / 0.2)), 1.0, mirror);
        // the reflection is the hill's own colour (its ice-blue wash, from the mirrored ink's value) lifted toward the
        // sky at 0.35-0.5: never darker than the hill (a dark grey smudge in the lake), never a pale cut-out of it,
        // broken by the horizontal ripples, with two or three bright ripple lines across it
        float rv = clamp((dot(MIST, vec3(0.333)) - dot(reflC, vec3(0.333))) / 0.6, 0.0, 1.0);   // how much ink was mirrored
        vec3 reflT = mix(mix(AIR2, mix(AZ_M, AZ_D, 0.38), clamp(rv * 1.35, 0.0, 1.0) * keepPig), mix(MIST, reflC, 0.6), 1.0 - keepPig);
        reflT = mix(reflT, SKY, 0.24);
        water = mix(water, reflT, clamp(rk * 1.25, 0.0, mix(0.42, 0.5, mirror)));
        float rl = 0.0;
        for (int q = 0; q < 3; q++) {
          float yq = 0.012 + 0.017 * float(q) + 0.004 * sin(p.x * 3.0 + float(q));
          rl += exp(-pow((below - yq) / max(0.0011, 0.9 * pxv), 2.0)) * smoothstep(0.45, 0.7, gnoise(vec2(p.x * (2.2 + float(q)), float(q) * 3.7)) * 0.5 + 0.5);
        }
        water = mix(water, LIGHT, clamp(rl * reflA * 0.6 * keepPig * (1.0 - uHzK), 0.0, 0.7));
        // under a moon (Writing) a long glassy column of light down the still water, broken in ripples
        if (Lg.w > 0.0 && !homeL(Lg)) {
          // the light on the water is a broken glitter column (no ripple rings): short horizontal flecks of light
          // in rows, densest under the light and scattering wider toward the viewer
          float cx = (wu.x - Lg.x) * uHs;
          float cw = Lg.z * (0.25 + 1.4 * below);
          float colm = exp(-cx * cx / (cw * cw)) * smoothstep(0.0, 0.008, below) * (1.0 - smoothstep(0.06, 0.26, below));
          float row = gnoise(vec2(p.x * 7.0 + floor(below * 300.0) * 1.37, below * 300.0));
          float fleck = smoothstep(0.25, 0.6, row) * smoothstep(0.15, 0.5, gnoise(vec2(p.x * 26.0, below * 900.0 + 3.1)));
          // (the lake catching the light) on pale water a white fleck cannot show, so the water round
          // the column first deepens a little into a clear cyan sheet; the flecks are then pure light, and two or three
          // long glassy highlights lie across the column (crisp white lines on the water)
          float lk = keepPig * (1.0 - uHzK) * min(abs(Lg.w) * 2.0, 1.0);
          float sheet = exp(-cx * cx / (cw * cw * 5.0)) * smoothstep(0.0, 0.012, below) * (1.0 - smoothstep(0.05, 0.3, below));
          water = mix(water, mix(water, vec3(0.60, 0.80, 0.86), 0.6), clamp(sheet * 0.6 * lk, 0.0, 0.5));
          water = mix(water, LIGHT, clamp(colm * (0.18 + 0.75 * fleck) * lk, 0.0, 0.9));
          water = mix(water, vec3(1.0), clamp(colm * fleck * 0.55 * lk, 0.0, 0.6));
          float hl = 0.0;
          for (int q = 0; q < 3; q++) {
            float yq = 0.007 + 0.016 * float(q) + 0.003 * sin(p.x * 2.0 + float(q) * 1.9);
            hl += exp(-pow((below - yq) / max(0.0009, 0.8 * pxv), 2.0)) * exp(-cx * cx / (cw * cw * 3.0)) * smoothstep(0.5, 0.75, gnoise(vec2(p.x * 3.2 + float(q) * 2.3, float(q) * 5.1)) * 0.5 + 0.5);
          }
          water = mix(water, vec3(1.0), clamp(hl * 0.9 * lk, 0.0, 0.9));
        }
        // the crossing's water takes a pale indigo (azurite toned with indigo), a little deeper toward the viewer, and
        // its ripples are drawn in indigo; never under the text, never in the horizon
        float ind = clamp(scn2.a * scn3.b * keepPig * (1.0 - uHzK), 0.0, 1.0);
        vec3 IND = mix(AZ_M, INK_F, 0.38);
        float st = waterStrokes(p, below) * scn2.r;
        water = mix(water, mix(STROKE, mix(INK_F, AZ_D, 0.35), ind), st * mix(0.5, 0.32, smoothstep(0.05, 0.3, below)) * pr);
        water = mix(water, mix(MIST, IND, 0.72), clamp(ind * (0.62 + 0.38 * smoothstep(0.0, 0.22, below)) * 1.2, 0.0, 0.66));
        col = mix(col, water, cover); cov = mix(cov, 1.0, cover);
        mm = mix(mm, 0.36, cover);
      }
      // the waterline dissolves into a soft, pale bank of mist: reserved paper between the shore and its
      // mirror image, never a ruled line (grey mist here would read as one)
      float wl = exp(-pow((y - wY - 0.003) / 0.024, 2.0)) * wS;
      col = mix(col, mix(PAPER, SKY, 0.5), wl * 0.5); cov = mix(cov, 1.0, wl * 0.5);
      mm = max(mm, wl * 0.35);
      if (nearY > -1.0) {   // ...and the river's near bank into a thinner one
        float wn = exp(-pow((y - nearY) / 0.012, 2.0)) * wS;
        col = mix(col, mix(PAPER, SKY, 0.5), wn * 0.35); cov = mix(cov, 1.0, wn * 0.35);
      }
    }
    // a figure layer that stands in front of this plane's mist (and on the water)
    if (uFigKA.x > 0.0 && abs(uFigKA.y - fi) < 0.5 && uFigKA.z > 0.5) figOver(col, mm, cov, unframed(figAt(uFigA, uFigRA, wu)), uFigKA.x * keepFig * prF * figMist);
    if (uFigKB.x > 0.0 && abs(uFigKB.y - fi) < 0.5 && uFigKB.z > 0.5) figOver(col, mm, cov, unframed(figAt(uFigB, uFigRB, wu)), uFigKB.x * keepFig * prF * figMist);
  }

  // the framing elements, over everything (see frameKey), in the view that holds the nearest plane
  float frameA = 0.0;   // (how much near-camera framing covers this pixel: the light does not bloom over it)
  {
    for (int j = 0; j < 2; j++) {
      vec4 K = j == 0 ? uFigKA : uFigKB;
      if (K.x <= 0.0 || K.y < float(lo) - 0.5 || K.y > float(hi) + 0.5) continue;
      vec4 F = j == 0 ? figAt(uFigA, uFigRA, wu) : figAt(uFigB, uFigRB, wu);
      float prF = settled ? 1.0 : clamp((uArrive - K.y * 0.1 - 0.35) / 0.6, 0.0, 1.0);
      F *= frameKey(F) * K.x * keepFig * prF;
      col = col * (1.0 - F.a) + F.rgb;
      cov = cov * (1.0 - F.a) + F.a;
      mm = mix(mm, 0.08, F.a);
      frameA = max(frameA, F.a);
    }
  }
  // the bloom (a light pass over the whole view): a white core round the light and a wide soft cyan falloff,
  // screened over everything, so the air round the light is brighter than the paper; never in the keep-out
  {
    // (from the summed falloffs; the core only lightly over what stands in front of it, so the peak stays dark
    // against its light; on Home three soft shafts fall from behind the peak, very low, only in the painting)
    float bk = (1.0 - uHzK) * keepPig * (1.0 - 0.85 * frameA);
    vec3 c0 = layer ? col / max(cov, 1e-3) : col;
    float shaft = 0.0;
    if (homeL(Lg)) {
      float an = atan(ld.y, ld.x);
      float sh = exp(-pow((an + 2.05) / 0.07, 2.0)) * 0.8 + exp(-pow((an + 1.62) / 0.05, 2.0)) + exp(-pow((an + 2.55) / 0.06, 2.0)) * 0.6;
      shaft = sh * smoothstep(Lg.z * 0.6, Lg.z * 1.4, lr) * exp(-lr / (Lg.z * 3.2)) * (0.6 + 0.4 * gnoise(vec2(lr * 9.0, an * 4.0)));
    }
    vec3 scr = 1.0 - (1.0 - c0) * (1.0 - BLOOM_W * clamp(lf.x * 0.4 + lf.y * 0.12, 0.0, 0.8) * bk);
    scr = 1.0 - (1.0 - scr) * (1.0 - BLOOM_C * clamp(lf.z * 0.2 + shaft * 0.16, 0.0, 0.5) * bk);
    col = layer ? scr * cov : scr;
  }
  // the keep-out: the scene is recomposed by mist where the text stands, opaque up to 140 px left of the text's right
  // edge and clear 140 px right of it, over the window's full height, its edge broken like mist (never a gradient line)
  if (uKeep.y > 0.0) {
    float nz = (T2(vec2(uv.y * 2.3 + 0.17, p.x * 0.31)) - 0.5) * 2.0 + (T(vec2(uv.y * 6.1, p.x * 0.9 + 0.4)) - 0.5);
    float kr = uKeep.y * (1.0 - smoothstep(uKeep.x - uKeep.z, uKeep.x + uKeep.z, uv.x + nz * uKeep.z * 0.45));
    // (a depth layer in front of the base: it simply clears there, and the base's mist shows through)
    if (layer) { col *= 1.0 - kr; cov *= 1.0 - kr; }
    else col = mix(col, mix(MIST, SKY, 0.45), kr);
    mm = mix(mm, 0.5, kr);
  }

  outColor = layer ? vec4(col, clamp(cov, 0.0, 1.0)) : vec4(col, clamp(mm, 0.0, 1.0));
}`;

export const PRESENT = `#version 300 es
precision highp float;
${elementDefines()}
#define VEILS ${VEILS}
#define TRAIL ${TRAIL}
#define LIFE ${LIFE}
#define LR ${LAYERS}
#define ROWS ${ROWS}
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uWin0;     // the windows' scenes (strip, closing) and the horizon's
uniform sampler2D uWin1;
uniform sampler2D uHzTex;
uniform sampler2D uNoise;
uniform float uAspect;       // the canvas's aspect
uniform vec4  uWinR[2];      // a window's box on the canvas, uv (x0, y0, x1, y1), y up; x0 > x1 = none
uniform vec4  uWinM[2];      // its world mapping (the scene's uView): left (vh), top, height, width (scene units)
uniform vec4  uWinS[2];      // its scene's painted region in its texture: uv scale (xy) and clamp (zw)
uniform vec4  uWinF[2];      // feathers: top, bottom (fractions of the box height), wake allowed 0/1, arrival 0..1
uniform vec4  uWinK[2];      // keep-out (box uv x): text's right edge, active 0/1, ramp half-width, 0
uniform vec4  uWinO[2];      // 4b: the painting's sink inside its box (box uv, downward): it leaves slower than its box
// "The camera travels" (index.ts PART): a living page's window below 1200 px, at rest, is two depth layers: its own view
// holds the back (the sky and the far ranges, opaque), uWinN* the front (the place, premultiplied, alpha = coverage). The
// front sinks by uWinO.y (life lies in it), the back by uWinP.y; a bank of mist rises between them (uWinP.z, box uv) and
// the front may drift sideways (uWinP.w, box widths). uWinP.x = 0: one view, as before.
uniform sampler2D uWinN0;
uniform sampler2D uWinN1;
uniform vec4  uWinNS[2];     // the front layer's painted region in its texture (as uWinS)
uniform vec4  uWinP[2];      // x on, y the back's sink, z the mist between the layers, w the front's drift
#ifdef EL_GLIMPSE
// "Windows into the painting" (elements.ts glimpses; index.ts GLIMPSE, glimpseU): below 1200 px, at a page's
// major breaks, short boxes onto the page's own place. Each window has its own view, painted for its own framing at idle
// (two depth layers: the back in the lower half of its buffer, the front in the upper); here they are only slid: as a
// window passes up the screen the front drops below the back, both pan east (the near more), the sea of cloud climbs.
// Box-anchored (they scroll 1:1 with the page); the rest pose under reduced motion and Still.
#define GLN 2
uniform sampler2D uGl0;      // the first window's view
uniform sampler2D uGl1;      // the second's
uniform vec4  uGlS[GLN];     // 1 / the view's buffer size (px)
uniform vec4  uGlK;          // x on, y the paper-only early-out (below 1200 px with the windows on: laptops keep the full pass)
uniform vec4  uGlR[GLN];     // each window's box, canvas uv (x0, y0, x1, y1), y up; x0 > x1 = none
uniform vec4  uGlA[GLN];     // the back's and the front's drop (view uv y), their pans (view uv x)
uniform vec4  uGlB2[GLN];    // the view's uv for the box's: x0, sx, y0, sy
uniform vec4  uGlF2[GLN];    // x the box's height (CSS px), y the words' margin (CSS px: paper and mist only), z the box's width (CSS px), w seed (< 0: an end)
uniform vec4  uGlC[GLN];     // x the camera's height (0..1), y the light's bloom kept, z the front's ink deepened, w the fade-in
uniform vec4  uGlD[GLN];     // x the sea of cloud's surface (box uv, up; < -0.5 none), y the mist between the layers (< -0.5 none), z a slim window (1), else minus the left side's melt in CSS px (0: the usual), w an end: Contact's soft end (endS, 1), else the bottom ramp's extra CSS px
uniform vec4  uGlM[GLN];     // each view's world mapping (as uWinM)
#endif
uniform float uHzK;          // the horizon band, 0..1 (desktop only)
uniform vec4  uHzS;          // its scene's painted region
uniform vec4  uHzM;          // its world mapping
uniform float uTime;         // the drifting mist's clock (windows); the horizon's mist rests
uniform vec4  uVeil[VEILS];  // reading-veil rects, uv (x0, y0, x1, y1); x0 < -0.5 = unused
uniform float uVeilS[VEILS]; // each rect's veil strength
uniform float uVeilF[VEILS]; // each rect's feather, x uVeilR (a reserve for small print: 0.5)
uniform float uVeilR;        // the veil's feather, uv y: 0.13 x the shorter side (it also scales the bottom vignette)
uniform vec4  uTrail[TRAIL]; // the pointer's wake, newest first: uv x, uv y, strength, 0 (strength 0 = unused)
uniform vec4  uWakeBox;      // the uv box the wake can reach (x0, y0, x1, y1); x0 > x1 = no wake
uniform float uWakeR;        // the wake's radius, viewport heights (a local opening: ~110 CSS px, index.ts wakeR())
uniform vec4  uSweep;        // the pale bank of a page change: centre (uv x), half-width (vh), strength, thickness
uniform float uSweepSeed;    // the bank's own billows
uniform float uHold;         // a long jump: how much of the outgoing frame (uPrev) still shows, 1 -> 0
uniform sampler2D uPrev;     // the last frame before a long jump's splice
uniform float uSweepK;       // (silk veil) the text keep-out's right edge (screen uv x; 0 = none): the veil stays right of it
uniform float uPx;           // CSS px per canvas px
uniform float uPanPx;        // the pan, in CSS px (paper grain unrolls with the scroll)
uniform float uGrain;
uniform float uGrainPx;      // CSS px per grain texel (1, finer on dense phone screens)
// 4b, the living ground (body[data-ground="living"], wide screens): the page's own scene painted once into three depth
// layers (far: the sky and the far ranges, opaque, alpha = mist admittance; middle and near: premultiplied, alpha =
// coverage), each presented at its own sink as you scroll (the camera rising through cloud), with a haze deck between
// far and middle and a sea of mist over the feet. Present-only: a scroll never repaints a layer.
uniform sampler2D uSt0;
uniform sampler2D uSt1;
uniform sampler2D uSt2;
uniform vec4  uStS[3];       // each layer's painted region (draft corner): uv scale (xy) and clamp (zw)
uniform vec4  uStO[3];       // each layer now: x slide (uv, rightward), y sink (uv, downward), z alpha, 0
uniform vec4  uStR[3];       // each layer's crop at rest, viewport uv (x0, y0, x1, y1; y up): a transparent layer holds
                             // nothing outside it; the far one covers the viewport (above it its sky row repeats)
uniform vec4  uStC;          // the cloud the camera rises through: x strength, y its top (uv y), z its softness (uv); w the
                             // strength of the sea's body (its drifting banks under the surface)
uniform vec4  uStV;          // a place with an anchor (Work), once stepped: a curtain of mist left of which the middle and
                             // near layers dissolve (x its edge, uv; y strength; z its width, uv), billowing down its length
uniform vec4  uStM;          // the stage's world mapping at rest (as uWinM)
uniform vec4  uSt;           // x on, y lift 0..1 (settled), z sea strength, w haze-deck strength
uniform vec4  uSea;          // x sea surface (uv y), y its softness (uv), z haze deck (uv y), w billow amplitude (uv)
uniform vec4  uStX;          // an inner place (Writing, Résumé, Contact): x how far its far sky reads as air (its
                             // pale blue fades to paper near the column and high up), y how much of a transparent layer's
                             // crop its foot dissolves over, z the reading column's right edge (uv x), w the place's seed
uniform vec4  uStG;          // ...the hero strip's box at the page's top (viewport uv y0, y1, up) and its words' keep-out (uv x,
                             // its ramp's half-width): the window's inner grade, laid on the stage as the strip has it
uniform vec4  uStK;          // x the right end of the page's row rules (uv x; 0 none), y the lift (0..1)
uniform vec4  uStF;          // ...x the footer's top (uv y, up), y its feather (uv), z on: the stage clears to paper above
                             // the footer (the story map on clean paper), w unused
uniform vec4  uLive;         // x 1 = every page (the drift keeps off text; a veil's tear only moves its edge), 2 = and
                             // living veils on the text's lines (the stage); y their solid core (vh: 40 CSS px), z
                             // feather (vh), w sky-deck strength
uniform vec4  uLive2;        // living veils: x the page's scroll (viewport heights: the swell travels with the words), y
                             // the clearing beyond the feather (vh), z the swell of the veil's edge (vh); w (every page)
                             // one CSS px in viewport heights
// 4b, small life (index.ts lifeU): the few things that move in the painting (the water's shimmer, a thread of smoke, the
// willows' sway, one drifting boat). They are worked out once per pixel (lifePrep) for the one view that holds them this
// frame (uLifeT[1].y: a window, or a layer of the stage), and laid into that view's sample as it is composited (lifeLay),
// so whatever lies in front of it (a nearer layer, the cloud, the sea, the mist, the veils) passes over them as over the
// painting. Present only, on the ambient frames and the drift's clock (uTime): they stop with the mist, and uLifeK.x eases
// them to the still painting (reduced motion, Still, the idle sleep). Never near text: none within 40 CSS px of a veiled
// line (lifeText), none in a window's keep-out. Compiled in only with LIFE_ON: gl.ts builds this program twice and draws
// with the life one only while some life is on screen (a software rasteriser runs every branch, taken or not).
uniform vec4  uLifeU;        // the union of the entries' boxes (canvas uv x0, y0, x1, y1): no life outside it
uniform vec4  uLifeT[2];     // the entries, sorted by kind: [0] where shimmer, smoke, willow, boat start; [1] x the count,
                             // y the view they lie in (0, 1 the windows; 2 the stage's far layer or its combined one, 3 its
                             // middle, 4 its near; -1 none)
uniform vec4  uLifeR[LIFE];  // an entry's box on the canvas (uv, y up)
uniform vec4  uLifeA[LIFE];  // x kind (1 shimmer, 2 smoke, 3 willow, 4 a sprite: boat, walker), y a sprite's height in its
                             // atlas (v), z strength, w a seed
uniform vec4  uLifeB[LIFE];  // per kind. shimmer: x speed, y bottom fade (box uv); smoke: x, y the source (canvas uv), z its
                             // lean at the top, w its half-width at the top (plume heights); willow: x, y the foot (canvas
                             // uv), z the tree's height (uv), w the sway (uv x); a sprite: x alpha, y its lod, z, w its
                             // atlas u0, u1
uniform vec4  uLifeK;        // x life's strength now (0..1), y, z one buffer px in canvas uv (x, y), w the text guard (vh)
uniform vec4  uLifeFigR;     // the figure layer the shimmer keeps off (boats, the bridge): world x0 (vh), y0, 1/w, 1/h; z 0 = none
uniform sampler2D uLifeRid;  // the ridge rows of the view life lies in (where its water is)
uniform sampler2D uLifeSpr;  // the drifting boat (premultiplied, mipmapped; cut out of the figure layer by the worker)
uniform sampler2D uLifeFig;
// life that answers the reader (elements.ts): the stirred water's ring sets, the plum's gust, the waterfall
uniform vec4  uStir[4];      // a ring set on the open water: canvas uv x, y, age (s; < 0 none), w = 2 x kind + seed
                             // (kind 0 the pointer passing, 1 a tap's drop, 2 the ferryman's pole or the bow)
uniform vec4  uStirK;        // x strength (0 = none), y 1 = the plum eases to rest with the drift (stillSettle), z the
                             // stage's ridge columns per screen width
                             // (cssW / its painted width: 1 unless it is painted wider, st.ext), w 1 = the water's own
                             // rings are drawn as broken rings too
uniform vec4  uGust;         // the plum's gust: x age (s; < 0 none), y its lean (-1..1), z strength, w the bough's nudge (rad)
uniform vec4  uGust2;        // the gust's petals: their origin (canvas uv x, y), their size (canvas uv x), 0
// "The scroll's air" (elements.ts air; index.ts airStep; a wind on the figures only): all zero when it is off
// (reduced motion, Still, Canvas2D, a forced pose), and then nothing here changes a pixel.
uniform vec4  uAir;          // x on, y the scroll's eased speed (viewports/s, + = reading down), z its drift (viewports
                             // travelled, eased), w the speed's envelope 0..1 (gone ~1.1 s after the scroll stops)
uniform vec4  uAir2;         // x the plum's lean (rad), y the ribbon's bow (scene units), z the wind's strength (phones
                             // 0.5), w 0
// is this wind family the place's own (uAir2.w, a bit set: 1 the plum and the ribbon, 2 willows, 4 rushes)?
float airFam(float b) { return mod(floor(uAir2.w / b), 2.0); }
uniform vec4  uAir3;         // x the light's swell (its bloom x (1 + x): the camera rising, the page read on), y its
                             // warmth (near the light only), z, w 0
uniform vec4  uAirP[3];      // petals blown off the plum: canvas uv x, y, turn (rad), alpha
uniform vec4  uAirQ[3];      // ...their size (canvas uv x), curl (their width as they turn), hue, 1 = a white plum petal

${COLORS}
const vec3 MIST2 = vec3(0.882, 0.925, 0.945);   // #E1ECF1 a mist bank never gets darker than this (ice, not grey)
const float HSW = ${HS.toFixed(3)};               // viewport heights per stretch in a window and on the stage
const float REST_T = 40.0;                      // the horizon's mist: at rest
${HASH}
vec4 stTap(sampler2D T, vec4 S, vec4 O, vec2 uv) {
  // (above the layer's top its sky row repeats (clamp); uStR[0].z is the far layer's width in viewports)
  vec2 q = clamp(vec2((uv.x - O.x) / max(uStR[0].z, 1.0), uv.y + O.y), 0.0, 1.0);
  return texture(T, min(q * S.xy, S.zw)) * O.z;
}
// a transparent depth layer, held only over its crop R (nothing outside it)
vec4 stTapR(sampler2D T, vec4 S, vec4 O, vec4 R, vec2 uv) {
  vec2 q = (vec2(uv.x - O.x, uv.y + O.y) - R.xy) / max(R.zw - R.xy, vec2(1e-4));
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0);
  return texture(T, min(q * S.xy, S.zw)) * O.z;
}
// how near the light this point stands (exp(-r^2 s)), the nearest of the three places' lights round it: one place's
// light alone (floor of the stretch) steps where the world crosses into the next stretch, a straight seam in the sky
// that only very wide windows reach (the Résumé at 2560, x 2370)
float lightNear(vec2 wp, float s) {
  float u = wp.x / HSW, k = floor(u), m = 0.0;
  for (int j = -1; j <= 1; j++) {
    vec4 L = lightK(k + float(j));
    float r = length(vec2((u - L.x) * HSW, wp.y - L.y)) / max(L.z, 1e-3);
    m = max(m, exp(-r * r * s));
  }
  return m;
}
// the inner places' spring morning (the window's grade, as the strip has it) on the stage, so its rest frame keeps the
// strip's look: the hills take Home's value structure, the pale air moves toward one smooth ice gradient (white at the
// light, bluer away from it) in the strip's top, and left of the words' keep-out the pale sky is paper.
// ly = the hero box's uv y where this layer stands, lx its uv x; air = 0 for a transparent layer (its hills only).
vec3 stGrade(vec3 c, vec2 wp, float lx, float ly, float air) {
  float keepW = 1.0 - smoothstep(uStG.z - uStG.w, uStG.z + uStG.w * 2.0, lx);
  float inK = smoothstep(1.9, 2.15, wp.x / HSW) * (1.0 - keepW);
  float lumS = dot(c, vec3(0.299, 0.587, 0.114));
  float hillK = inK * (1.0 - smoothstep(0.86, 0.93, lumS)) * smoothstep(0.35, 0.6, lumS);
  c = mix(c, clamp(mix(vec3(lumS), c, 1.35) - (0.9 - lumS) * 0.22, 0.0, 1.0), hillK);
  if (air <= 0.0) return c;
  float nearL = lightNear(wp, 0.9);
  float br = (textureLod(uNoise, wp * vec2(0.12, 0.3) + vec2(0.37, 0.71), 3.0).r - 0.5) / 0.13 * 0.05;
  float upK = clamp(smoothstep(0.35, 0.85, ly) * (1.0 + br), 0.0, 1.0) * (1.0 - nearL);
  vec3 iceI = mix(SKY_T, vec3(0.812, 0.890, 0.933), 0.6);
  vec3 airT = mix(SKY, iceI, upK);
  airT = mix(airT, LIGHT, nearL * 0.6);
  float airW = smoothstep(0.66, 0.84, lumS) * smoothstep(0.4, 0.55, ly);
  airW *= 1.0 - smoothstep(0.0, 0.05, max(c.g - c.b, c.r - c.b) + 0.012);
  c = mix(c, airT, inK * airW * 0.85 * air);
  c = mix(c, PAPER, keepW * smoothstep(0.6, 0.8, lumS) * air);
  return c;
}
// stTapR's layer with its foot (and its left crop) dissolving into the air over a lobed edge on an inner place (uStX.y),
// so no layer ends in a ruled line where the sea does not cover it
vec4 stTapF(sampler2D T, vec4 S, vec4 O, vec4 R, vec2 uv, float bx) {
  vec2 q = (vec2(uv.x - O.x, uv.y + O.y) - R.xy) / max(R.zw - R.xy, vec2(1e-4));
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return vec4(0.0);
  vec4 c = texture(T, min(q * S.xy, S.zw)) * O.z;
  if (uStX.y > 0.0) {
    float nb = (textureLod(uNoise, vec2(q.x * bx * 0.8 + uStX.w * 3.1, 0.47), 2.0).r - 0.5) / 0.13;
    // (broad lobes, never drips: a fine noise across x streaks the foot into vertical drips and seams)
    float nc = (textureLod(uNoise, vec2(q.x * bx * 0.9 + uStX.w, 0.19 + q.y * 0.6), 2.5).g - 0.5) / 0.13;
    float f = smoothstep(0.0, uStX.y, q.y - uStX.y * 0.25 + uStX.y * (0.22 * nb + 0.08 * nc));
    // (the left crop dissolves over at least 120 CSS px, its line swelling with the lobes, never a ruled edge)
    float fw = max(0.12, 120.0 * uLive2.w / max(bx, 1e-3));
    f *= smoothstep(0.0, fw, q.x - fw * 0.15 + fw * 0.35 * nc);
    c *= f;
  }
  return c;
}
// a depth layer's own mist admittance, read from its colour (it carries coverage, not admittance): pale mist and
// wash take the drifting mist, dark ink keeps it thin
float stAdm(vec4 c) {
  float lm = dot(c.rgb / max(c.a, 1e-3), vec3(0.299, 0.587, 0.114));
  return mix(0.1, 0.72, smoothstep(0.55, 0.92, lm));
}
// the cloud bank's billowing top (uv y, up) at screen x bx (uv x times the aspect): from the noise's coarse mips, drifting
float stCloudTop(float bx) {
  float b1 = (textureLod(uNoise, vec2(bx * 0.7 + uTime * 0.0016, 0.37), 3.0).r - 0.5) / 0.13;
  float b2 = (textureLod(uNoise, vec2(bx * 1.7 - uTime * 0.0021, 0.83), 2.0).r - 0.5) / 0.14;
  return uStC.y + 0.035 * b1 + 0.012 * b2;
}
// a bank of mist as a painter leaves it: a pale body a breath deeper toward its foot (a bank has
// volume, never a flat sheet), coming out of the air over a soft edge with a faint cool wash just above it (its lit top).
// c the colour under it, cov how much mist stands here, t how far above the bank's edge (box uv; < 0 inside), cn a noise.
vec3 airCloud(vec3 c, float cov, float t, float cn) {
  float wash = smoothstep(-0.03, 0.02, t) * (1.0 - smoothstep(0.02, 0.2, t));
  vec3 body = mix(mix(MIST, SKY, 0.3 + 0.45 * cn), mix(MIST2, MIST, 0.55), smoothstep(0.02, 0.4, -t) * 0.5);
  c = mix(c, vec3(0.83, 0.89, 0.915), wash * 0.18 * (1.0 - cov));
  return mix(c, body, cov);
}
// the parting mist (by position, not speed): a closing below 1200 px comes out of cloud as it arrives. Two lobed
// banks lie across it while its top comes into view, the upper drifting up and one way, the lower down and the other,
// thinning from within (an fbm threshold), so the place opens between them; at the page's end (m = 0) they are gone and
// the closing is unchanged. l box uv (y up), wx world x (stretches), m 1 -> 0 as the reader arrives.
vec3 partMist(vec3 c, vec2 l, float wx, float m) {
  float o = 1.0 - m;
  for (int j = 0; j < 2; j++) {
    float fj = float(j), sg = j == 0 ? 1.0 : -1.0;
    float cy = mix(0.72, 0.34, fj) + sg * o * 0.34;
    float bx = wx * 1.7 + fj * 3.7 + sg * o * 0.35 + uTime * 0.001;
    float b1 = (textureLod(uNoise, vec2(bx, 0.41 + 0.3 * fj), 3.0).r - 0.5) / 0.13;
    float b2 = (textureLod(uNoise, vec2(bx * 2.6 + 0.3, 0.17 + 0.2 * fj), 2.0).g - 0.5) / 0.13;
    float hw = mix(0.05, 0.27, m);
    float d = abs(l.y - cy - 0.06 * b1 - 0.02 * b2) - hw;
    float n = textureLod(uNoise, vec2(bx * 1.4, l.y * 1.8 + fj), 1.0).r * 0.65 + textureLod(uNoise, vec2(bx * 3.1, l.y * 3.3 + 0.4), 0.0).g * 0.35;
    float cov = (1.0 - smoothstep(-0.06, 0.04, d)) * smoothstep(1.02 - m * 0.95, 1.1 - m * 0.8, n + 0.45) * smoothstep(0.0, 0.12, m);
    c = airCloud(c, cov * 0.94, -d, n);
  }
  return c;
}

#ifdef EL_GLIMPSE
// the morning in a window: the ice-blue sky above a window's skyline, deepest high in the box (ly, box uv) and fading
// to the mist lower down; paper round the light (sunK), so the light reads as the paper's own white
vec3 glSky(float ly, float nb, float nc, float sunK) {
  float hiK = smoothstep(0.0, 0.72, ly + 0.04 * nb + 0.02 * nc);
  return mix(mix(MIST2, SKY_T * vec3(1.02, 1.01, 1.0), 0.4 + 0.6 * hiK), PAPER, sunK);
}
// the hero window's inner-place grade (the window loop's, with no keep-out), so a glimpse of Writing, the Résumé or
// Contact keeps its strip's spring morning; ly = the strip's own box uv y at this point
vec3 glGrade(vec3 c, vec2 wp, float ly) {
  float inK = smoothstep(1.9, 2.15, wp.x / HSW);
  if (inK <= 0.0) return c;
  float lumS = dot(c, vec3(0.299, 0.587, 0.114));
  float hillK = inK * (1.0 - smoothstep(0.86, 0.93, lumS)) * smoothstep(0.35, 0.6, lumS);
  c = mix(c, clamp(mix(vec3(lumS), c, 1.35) - (0.9 - lumS) * 0.22, 0.0, 1.0), hillK);
  // (the nearest of the three lights round the point: one place's light alone steps where the world crosses into the
  // next stretch, a straight seam in a window that looks across it)
  float nearL = lightNear(wp, 0.9);
  float br = (textureLod(uNoise, wp * vec2(0.12, 0.3) + vec2(0.37, 0.71), 3.0).r - 0.5) / 0.13 * 0.05;
  float upK = clamp(smoothstep(0.35, 0.85, ly) * (1.0 + br), 0.0, 1.0) * (1.0 - nearL);
  vec3 iceI = mix(SKY_T, vec3(0.812, 0.890, 0.933), 0.6);
  vec3 airT = mix(SKY, iceI, upK);
  airT = mix(airT, LIGHT, nearL * 0.6);
  float airW = smoothstep(0.66, 0.84, lumS) * smoothstep(0.4, 0.55, ly);
  airW *= 1.0 - smoothstep(0.0, 0.05, max(c.g - c.b, c.r - c.b) + 0.012);
  return mix(c, airT, inK * airW * 0.85);
}
#endif

// ---- 4b small life ----
// what lifePrep leaves for lifeLay: the willows' shift of the view's tap (canvas uv x), the shimmer's light gaps and
// ripple lines (strengths; the colour is worked out on the view's own sample), and the smoke and the boat as one
// premultiplied layer over it (and the boat's alpha, which thins the drifting mist over it as over any figure)
float lifeDx = 0.0, lifeSG = 0.0, lifeSL = 0.0, lifeBA = 0.0, lifeBD = 0.0;   // (lifeBD: the sprites' alpha dilated ~2 px, for the ribbon's mask)
float lifeRD = 0.0, lifeRW = 0.0, lifeFL = 0.0, lifeFD = 0.0;   // a ring's ink and its light; the falling water's light and its gaps
vec4 lifeO = vec4(0.0);
// the guard round text: the distance (vh) to the nearest veiled box (a living page's text lines, a block's box elsewhere,
// the "Draft art" note), whatever the veil's strength. Motion fades out from ~110 CSS px of it to none within 40 px; the
// boat, a figure, keeps the scene's own figure margin round the note (~24 px). (The veils are packed from the first.)
float lifeTextD(vec2 uv) {
  float d = 9.0;
  for (int k = 0; k < VEILS; k++) {
    vec4 V = uVeil[k];
    if (V.x < -0.5) break;
    vec2 vq = max(vec2(V.x - uv.x, V.y - uv.y), vec2(uv.x - V.z, uv.y - V.w));
    vq.x *= uAspect;
    if (uVeilS[k] > 0.0) d = min(d, length(max(vq, 0.0)));
  }
  return d;
}
bool lifeBox(vec4 R, vec2 uv) { return uv.x >= R.x && uv.x <= R.z && uv.y >= R.y && uv.y <= R.w; }
// A falling petal at d from its centre (canvas uv, x times the aspect), r0 its size, turned by rot, curled by flip (its
// width): its colour and its coverage.
// (a painted petal, not a flat dot: obovate, narrow at its base and wide at its rim with a small notch, its colour a
// deeper pink at the base washing to near white at the rim, a soft edge and a faint pooled rim; it curls as it turns,
// so its width flips)
vec4 lifePetal(vec2 d, float r0, float rot, float flip, float h1) {
  vec2 e = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)) * d / r0;
  e.y /= 0.62 * flip;
  float ex = e.x * 0.5 + 0.5;                                        // 0 base .. 1 rim
  float wd = mix(0.38, 1.0, smoothstep(0.0, 0.75, ex)) * (1.0 - 0.28 * exp(-pow(e.y / 0.16, 2.0)) * smoothstep(0.82, 1.0, ex));
  float egg = length(vec2(e.x, e.y / max(wd, 0.2)));
  vec3 pc = mix(vec3(0.992, 0.945, 0.957), vec3(0.93, 0.56, 0.66), clamp(0.15 + 0.45 * h1 + 0.55 * (1.0 - ex) - 0.2 * flip, 0.0, 1.0));
  pc = mix(pc, vec3(0.86, 0.5, 0.6), 0.35 * smoothstep(0.7, 0.95, egg) * (1.0 - smoothstep(0.95, 1.0, egg)));
  return vec4(pc, 1.0 - smoothstep(0.62, 1.0, egg));
}
// the open water at this pixel of the life's view (as the shimmer reads it: below the waterline, past a river's
// near bank, off the boats and the bridge), 0..1
float lifeWater(vec2 wp, float rx, bool strict) {
  int cx = clamp(int(rx * float(textureSize(uLifeRid, 0).x)), 0, textureSize(uLifeRid, 0).x - 1);
  vec4 w0 = texelFetch(uLifeRid, ivec2(cx, LR), 0);
  float below = w0.g - wp.y;
  if (w0.r <= 0.0 || below <= 0.0015) return 0.0;
  float k = smoothstep(0.05, 0.35, w0.r) * smoothstep(0.0015, 0.012, below);   // (a ring is drawn whole on any open water)
  float nb = texelFetch(uLifeRid, ivec2(cx, LR + 2), 0).r;
  if (nb > -0.5) k *= smoothstep(nb + 0.004, nb + 0.016, wp.y);
  if (uLifeFigR.z > 0.0) {
    vec2 fq = vec2((wp.x - uLifeFigR.x) * uLifeFigR.z, 1.0 - (wp.y - uLifeFigR.y) * uLifeFigR.w);
    // (only what stands on the water, solid ink: a hull, the bridge's piers, the islet's pine; a reflection, laid
    // lighter and torn, is water and takes the rings)
    if (fq.x > 0.0 && fq.x < 1.0 && fq.y > 0.0 && fq.y < 1.0) {
      // (the pointer's rings keep off the reflections too: any of the figure layer's ink, a bridge's or a
      // boat's mirror included, blurred a little, so a ring never lies over a mirrored hull or arch)
      if (strict) k *= 1.0 - smoothstep(0.03, 0.14, textureLod(uLifeFig, fq, 2.5).a);
      else k *= 1.0 - smoothstep(0.62, 0.9, textureLod(uLifeFig, fq, 1.0).a);
    }
  }
  return k;
}
// smooth periodic noise round a circle (th: the angle), K cells to a turn, 0..1
float lifeAng(float th, float K, float sd) {
  float x = fract(th / 6.2831853 + 0.5) * K;
  float i = floor(x), f = x - i;
  float a = hash12(vec2(mod(i, K), sd)), b = hash12(vec2(mod(i + 1.0, K), sd));
  return mix(a, b, f * f * (3.0 - 2.0 * f));
}
// one ring set on the water (elements.ts stir; qingxiao 0m49): two or three broken rings, flattened by the view,
// each open by a third or so of its arc, a dark crescent inside that is thick (3-4 px) on one side and runs out to
// nothing on the other, a white hairline just outside; they grow fast and slow down as they fade. Never a closed or a
// perfect circle: each ring's radius wanders, and its breaks, its weight and its crescent's side are its own per spawn.
// Leaves its ink and light in lifeRD / lifeRW, and the reflection's wobble under it in lifeDx.
void lifeStir(vec4 S, vec2 uv, float k) {
  float kind = floor(S.w * 0.5), seed = S.w - kind * 2.0, a = S.z;
  // (the pointer's ring (kind 0: a dwell, kind 1: a tap) is ONE small flat broken ring, 22 px at most, 1:5, 30-45 %
  // of it missing, a 0.6-0.8 px thick-thin line, lit only on its far lip, gone in 1.4 s; the ferry's own drops (kind 2)
  // are larger and slower: two rings, up to 40 px, over 4.4 s)
  bool user = kind < 1.5;
  float Lf = user ? 1.4 : 4.4;
  if (a < 0.0 || a > Lf) return;
  float SQ = user ? 5.0 : 3.4;                            // the water seen at a low angle: rings wider than tall
  vec2 e = (uv - S.xy) / uLive2.w;                        // CSS px (uv y spans the viewport's height)
  e.x *= uAspect;
  e.y *= SQ;
  float r = length(e);
  float Rmax = user ? 22.0 : 40.0;
  if (r > Rmax * 1.2 + 10.0) return;
  float G = length(vec2(e.x, e.y * SQ)) / max(r, 1e-3);  // the ring's distance in screen px is (r - R) / G
  float th = atan(e.y, e.x);
  vec2 cs = vec2(cos(th), sin(th));
  float u = a / Lf;
  float fade = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.3, 1.0, u));
  vec2 e0 = e;
  float nR = user ? 1.0 : 2.0;
  for (int j = 0; j < 3; j++) {
    float fj = float(j);
    if (fj >= nR) break;
    float aj = a - fj * 0.3;                              // the inner rings follow the first
    if (aj <= 0.0) continue;
    float gj = 1.0 - pow(1.0 - min(aj / Lf * 1.1, 1.0), 2.4);
    float Rj = (2.5 + (Rmax - 2.5) * gj) * (j == 0 ? 1.0 : j == 1 ? 0.67 : 0.46);   // spaced 1 : 1.5 : 2.2
    // (its breaks, weight and wander: smooth periodic noise round the ring, a few cells to a turn, so a ring has one to
    // three breaks and one or two swells; each ring and each spawn has its own)
    float sj = seed * 17.3 + fj * 3.7 + kind * 1.9;
    // (the inner rings are never quite concentric: each sits a little off the first, as a hand lays them)
    if (j > 0) {
      vec2 off = vec2(cos(seed * 6.283 + fj * 1.7), 0.3 * sin(seed * 4.1 + fj)) * (1.6 + 1.2 * fj) * SQ * vec2(1.0 / SQ, 1.0);
      vec2 ej = e0 - off;
      r = length(ej); G = length(vec2(ej.x, ej.y * SQ)) / max(r, 1e-3);
      th = atan(ej.y, ej.x); cs = vec2(cos(th), sin(th));
    }
    float n1 = lifeAng(th, 5.0, sj), n2 = lifeAng(th, 7.0, sj + 9.1), n3 = lifeAng(th, 4.0, sj + 4.4);
    Rj *= 1.0 + 0.09 * (n3 - 0.5) * (0.4 + 0.6 * gj);
    float sd = (r - Rj) / G;
    if (abs(sd) > 9.0) continue;
    float open = smoothstep(0.26, 0.36, n1);                               // about 70 % of the arc drawn, broken
    if (user) {
      // (one sure gap of ~45 deg either side of a seeded angle, and the noise's breaks: 30-45 % missing)
      float dg = abs(mod(th - seed * 6.2831853 + 3.1415927, 6.2831853) - 3.1415927);
      open = smoothstep(0.3, 0.4, n1) * smoothstep(0.6, 0.85, dg);
    }
    // the crescent: its thick side (3-4 px) where the brush pressed, running out to a hair, then lifting off
    float side = 0.5 + 0.5 * cos(th - seed * 6.283 - fj * 2.3);
    float press = side * side * (0.45 + 0.55 * n2) * smoothstep(0.26, 0.5, n1);
    float wI = user ? 0.25 + 0.3 * press : (0.35 + 4.4 * press) * (1.0 - 0.38 * gj) * (j == 0 ? 1.0 : 0.66);
    float ink = smoothstep(-wI - 0.7, -wI + 0.35, sd) * (1.0 - smoothstep(-0.45, 0.45, sd)) * open;
    // the white hairline outside it, broken where the ink is heaviest (the light catches the ring's far lip)
    float hairOpen = smoothstep(0.3, 0.42, n2) * (1.0 - 0.7 * press);
    float hair = exp(-pow((sd - 1.4 - 0.5 * gj) / 0.55, 2.0)) * hairOpen * (j == 0 ? 1.0 : 0.6);
    if (user) hair = exp(-pow((sd - 1.1) / 0.45, 2.0)) * hairOpen * smoothstep(0.15, 0.7, sin(th)) * open;   // (the far lip only)
    float ka = k * fade * (1.0 - 0.3 * fj / nR);
    lifeRD = max(lifeRD, ink * ka * (user ? 0.55 : 0.68));
    lifeRW = max(lifeRW, hair * ka * (user ? 0.5 : 0.7));
    // the reflection under the ring is pushed a little along its normal (~1.2 CSS px), so the water wobbles
    lifeDx += cs.x * ((user ? 0.5 : 1.2) * uLive2.w / uAspect) * exp(-pow(sd / 4.0, 2.0)) * ka * (j == 0 ? 1.0 : 0.5);
  }
}

// Everything the view's life does at this pixel, given the view's world point wp (viewport heights), its world units per
// canvas uv dw (x, y), its ridge column rx and its keep-out (0..1). Each kind's entries are walked as one run (the
// bounds come from uniforms: an empty run costs nothing).
void lifePrep(vec2 uv, vec2 wp, vec2 dw, float rx, float keep) {
  if (!(uv.x >= uLifeU.x && uv.x <= uLifeU.z && uv.y >= uLifeU.y && uv.y <= uLifeU.w)) return;
  float td = lifeTextD(uv);
  float gText = smoothstep(uLifeK.w, uLifeK.w * 2.75, td) * (1.0 - keep);
  float gNear = smoothstep(uLifeK.w * 0.15, uLifeK.w * 0.6, td) * (1.0 - keep);
  int r0 = int(uLifeT[0].x), r1 = int(uLifeT[0].y), r2 = int(uLifeT[0].z), r3 = int(uLifeT[0].w), r4 = int(uLifeT[1].x);
  // the water's shimmer: slow light gaps sliding along the open water below the waterline (the view's own ridge rows
  // say where it is: the same water the scene painted), cut at a river's near bank, kept off the boats and the bridge
  // (the figure layer), damped on still water (the mirror: a breath, never ripples)
  for (int i = r0; i < r1; i++) {
    vec4 R = uLifeR[i];
    if (!lifeBox(R, uv)) continue;
    vec4 A = uLifeA[i], B = uLifeB[i];
    vec2 q = (uv - R.xy) / max(R.zw - R.xy, vec2(1e-6));
    // (the ridge rows fetched, not filtered: a column is ~1 buffer px)
    int cx = clamp(int(rx * float(textureSize(uLifeRid, 0).x)), 0, textureSize(uLifeRid, 0).x - 1);
    vec4 w0 = texelFetch(uLifeRid, ivec2(cx, LR), 0);                 // water, waterline
    float below = w0.g - wp.y;
    if (w0.r <= 0.0 || below <= 0.002) continue;
    float nb = texelFetch(uLifeRid, ivec2(cx, LR + 2), 0).r;          // a river's near bank (-1: none)
    float mirror = texelFetch(uLifeRid, ivec2(cx, LR + 3), 0).g;
    float k = A.z * uLifeK.x * gText * min(w0.r, 1.0) * smoothstep(0.002, 0.02, below) * (1.0 - 0.7 * mirror);
    if (nb > -0.5) k *= smoothstep(nb + 0.004, nb + 0.016, wp.y);
    k *= smoothstep(0.0, 0.06, q.x) * smoothstep(1.0, 0.94, q.x) * smoothstep(0.0, B.y, q.y);
    if (uLifeFigR.z > 0.0) {
      vec2 fq = vec2((wp.x - uLifeFigR.x) * uLifeFigR.z, 1.0 - (wp.y - uLifeFigR.y) * uLifeFigR.w);
      if (fq.x > 0.0 && fq.x < 1.0 && fq.y > 0.0 && fq.y < 1.0) k *= 1.0 - smoothstep(0.02, 0.15, textureLod(uLifeFig, fq, 2.0).a) * (1.0 - mirror);
    }
    if (k <= 0.001) continue;
    float tt = uTime * B.x;
    // (long streaks along the water, anchored to the painting but sized in CSS px, as on a 1440 px screen whatever the
    // view's scale, so a phone's small strip gets a few calm streaks, not a fine scribble; each lookup's level is worked
    // out from its scale across the streaks (they are minified there, magnified along them), so the noise is filtered at
    // the size it is drawn and no lookup depends on a neighbour's branch)
    float sf = 1.0 / max(900.0 * dw.y * uLive2.w, 1e-4);
    float ly = log2(max(dw.y * uLifeK.z * sf * 512.0, 1e-6));   // noise texels per buffer px, per unit of below x sf
    float a = textureLod(uNoise, vec2(wp.x * sf * 0.55 - tt * 0.004, below * sf * 9.0), max(0.0, ly + log2(9.0))).r;
    float b = textureLod(uNoise, vec2(wp.x * sf * 1.3 + tt * 0.003, below * sf * 21.0 + 0.37), max(0.0, ly + log2(21.0))).g;
    float f = a * 0.7 + b * 0.45;
    lifeSG = max(lifeSG, smoothstep(0.60, 0.70, f) * k);
    lifeSL = max(lifeSL, smoothstep(0.50, 0.57, f) * (1.0 - smoothstep(0.57, 0.64, f)) * k);
    // ripple rings (qingxiao 0m49): a few thin rings spawn on the water and spread out, flattened by the view,
    // fading as they grow; each comes back somewhere else
    for (int j = 0; j < 3; j++) {
      if (float(j) >= B.z) break;
      float fj = float(j), per = 6.5 + 2.7 * fj;
      float cyc = floor(uTime / per + fj * 0.37), ph = fract(uTime / per + fj * 0.37);
      vec2 c = vec2(0.15 + 0.7 * hash12(vec2(cyc, fj + A.w)), 0.2 + 0.55 * hash12(vec2(cyc + 3.1, fj)));
      // (uStirK.w) the water's own rings take the stirred rings' grammar (elements.ts stir: broken, thick-thin, never
      // a closed ellipse), lighter than a ring you make (kind 3)
      if (uStirK.w > 0.5) {
        lifeStir(vec4(R.xy + c * (R.zw - R.xy), ph * 4.4, 6.0 + 0.999 * hash12(vec2(cyc + 7.7, fj + A.w))), uv, min(1.0, k * 4.0) * 0.6);
        continue;
      }
      vec2 d = (q - c) * (R.zw - R.xy);
      d.x *= uAspect;
      d.y *= 4.2;
      float rr = (0.012 + ph * 0.07) * uLive2.w * 900.0;
      float wd = uLifeK.z * 4.2 * 1.3;
      float ring = exp(-pow((length(d) - rr) / wd, 2.0)) + 0.5 * exp(-pow((length(d) - rr * 0.62) / wd, 2.0)) * smoothstep(0.15, 0.4, ph);
      lifeSG = max(lifeSG, ring * (1.0 - ph) * smoothstep(0.0, 0.08, ph) * min(1.0, k * 4.0));
    }
  }
  // smoke: a thin thread from its source, rising and leaning a little downwind, wavering, broken into puffs that rise
  // along it, widening and thinning out toward the top of its box; mist-grey (toward MIST2, at most halfway: never a dark
  // line)
  for (int i = r1; i < r2; i++) {
    vec4 R = uLifeR[i];
    if (!lifeBox(R, uv)) continue;
    vec4 A = uLifeA[i], B = uLifeB[i];
    if (A.y < -1.5) {
      // "The waterfall falls" (elements.ts waterfall). Its strands are what the layer painted white in the cleft (read from
      // the figure layer itself, so the motion stays on them); broken lights slide down them at ~20-30 CSS px a second,
      // each strand at its own speed, the water between them thinning toward the rock's blue, each light with a small
      // glow on the rock; at the foot a plume of spray breathes and rises. B: the fall's x, its lip's y and its foot's y
      // (canvas uv), its half-width (uv x).
      float hgt = max(B.y - B.z, 1e-5);
      float tt = (B.y - uv.y) / hgt;                              // 0 at the lip .. 1 at the foot
      float k = A.z * uLifeK.x * gText;
      if (uMorn < 8.0) k *= smoothstep(1.35, 2.1, uMorn);   // (the morning: the fall catches the risen light and starts to move: its one beat of light)
      vec2 pxW = vec2(dw.x * uLive2.w / uAspect, dw.y * uLive2.w);   // world units per CSS px
      vec2 pw = wp / max(pxW, vec2(1e-7));                       // CSS px, anchored to the painting
      if (abs(uv.x - B.x) < B.w && tt > -0.02 && tt < 0.98 && uLifeFigR.z > 0.0) {
        vec2 fq = vec2((wp.x - uLifeFigR.x) * uLifeFigR.z, 1.0 - (wp.y - uLifeFigR.y) * uLifeFigR.w);
        vec4 F = textureLod(uLifeFig, fq, 0.0);
        vec4 F2 = textureLod(uLifeFig, fq, 1.5);
        float lumF = dot(F.rgb / max(F.a, 1e-3), vec3(0.299, 0.587, 0.114));
        float lumF2 = dot(F2.rgb / max(F2.a, 1e-3), vec3(0.299, 0.587, 0.114));
        float ends = smoothstep(-0.02, 0.05, tt) * (1.0 - smoothstep(0.82, 0.98, tt));
        float strand = smoothstep(0.18, 0.5, F.a) * smoothstep(0.5, 0.75, lumF) * ends;
        float near = smoothstep(0.04, 0.22, F2.a) * smoothstep(0.45, 0.7, lumF2) * ends;
        float sp = 24.0 * (0.8 + 0.45 * fract(floor(pw.x / 2.5) * 0.618));   // (each strand at its own speed)
        float n = texture(uNoise, vec2(pw.x * 0.013 + A.w, (pw.y + uTime * sp) * 0.0062)).r
                + 0.45 * (texture(uNoise, vec2(pw.x * 0.031 + 0.3, (pw.y + uTime * sp * 1.15) * 0.016)).g - 0.5);
        float fl = smoothstep(0.52, 0.62, n);
        lifeFL = max(lifeFL, (strand * fl + near * fl * 0.32 * (1.0 - strand)) * k);
        lifeFD = max(lifeFD, strand * (1.0 - smoothstep(0.38, 0.52, n)) * k * 0.9);
      }
      // the spray at its foot: a soft plume that swells and sinks back, rising and torn by the drift
      vec2 dp = vec2((uv.x - B.x) * uAspect, uv.y - B.z) / uLive2.w;   // CSS px from the foot
      float br = 0.5 + 0.5 * sin(uTime * 0.62 + A.w * 3.0) * sin(uTime * 0.23 + 1.0);
      float rxP = 22.0 * (0.85 + 0.3 * br), ryP = 9.0 * (0.85 + 0.35 * br);
      float pl = exp(-(dp.x * dp.x) / (rxP * rxP) - pow((dp.y - 3.0 - 4.0 * br) / ryP, 2.0));
      float tear = texture(uNoise, vec2(pw.x * 0.02 + A.w, pw.y * 0.035 - uTime * 0.05)).r;
      float al = clamp(pl * smoothstep(0.32, 0.62, tear) * (0.28 + 0.2 * br) * k, 0.0, 0.5);
      lifeO = lifeO * (1.0 - al) + vec4(mix(MIST, LIGHT, 0.6), 1.0) * al;
      continue;
    }
    if (A.y < -0.5) {
      // petals falling from the plum: each from the top of the box to its foot on a slow swaying diagonal,
      // turning and tumbling (its width flips), out of the air and into the mist; then round again
      vec2 bs = R.zw - R.xy;
      vec2 q = (uv - R.xy) / bs;
      for (int j = 0; j < 12; j++) {
        if (float(j) >= B.x) break;
        float fj = float(j);
        float h1 = hash12(vec2(fj, 3.7)), h2 = hash12(vec2(fj + 7.1, 1.3)), h3 = hash12(vec2(fj + 3.3, 9.1));
        float per = (16.0 + 12.0 * h1) / max(B.y, 0.1);
        float ph = fract(uTime / per + h2);
        vec2 c = vec2(mix(0.6 + 0.4 * h3, 0.05 + 0.35 * h3, ph) + 0.06 * sin(uTime * (0.45 + 0.4 * h1) + fj * 1.7), 1.0 - ph);
        vec2 d = (q - c) * bs;
        d.x *= uAspect;
        float r0 = B.z * uAspect * (0.5 + 0.95 * h3 * h3 + 0.2 * h1);   // (a wide spread of sizes)
        if (dot(d, d) > r0 * r0 * 2.0) continue;
        float rot = uTime * (0.5 + 0.8 * h1) * (h2 < 0.5 ? -1.0 : 1.0) + fj;
        float flip = 0.3 + 0.7 * abs(cos(uTime * (0.7 + 0.6 * h3) + fj));
        vec4 pe = lifePetal(d, r0, rot, flip, h1);
        float al = pe.a * smoothstep(0.0, 0.07, ph) * (1.0 - smoothstep(0.7, 1.0, ph));
        al = clamp(al * 0.95 * uLifeK.x * gText * (1.0 - B.w), 0.0, 1.0);   // (the morning: B.w holds them back)
        lifeO = lifeO * (1.0 - al) + vec4(pe.rgb, 1.0) * al;
      }
      continue;
    }
    float H = max(R.w - B.y, 1e-4);
    float h = (uv.y - B.y) / H;                       // 0 at the source .. 1 at the top
    if (h <= 0.0) continue;
    float xs = (uv.x - B.x) * uAspect / H;            // across, in plume heights
    float lod = log2(max(512.0 * uLifeK.z / H, 1.0));   // noise texels per buffer px, per plume height
    float wv = textureLod(uNoise, vec2(h * 0.45 - uTime * 0.03 + A.w, A.w * 1.7), lod - 1.2).r - 0.5;
    float xc = B.z * h * h + wv * 1.6 * h;
    float wd = mix(0.05, B.w, h);
    float d = (xs - xc) / wd;
    float br = textureLod(uNoise, vec2(xs * 0.2 + A.w * 2.3, h * 0.35 - uTime * 0.05), lod - 1.5).r;
    float al = exp(-d * d) * smoothstep(0.32, 0.6, br) * smoothstep(0.0, 0.1, h) * (1.0 - smoothstep(0.3, 1.0, h));
    al = clamp(al * A.z * uLifeK.x * gText, 0.0, 0.5);
    lifeO = lifeO * (1.0 - al) + vec4(MIST2, 1.0) * al;
  }
  // willow sway: the crown and its hanging strands swing in a slow breeze, the swing running down the strands; the trunk
  // and the foot stay put, and the box's edges are feathered, so nothing round the tree moves (<= 1.5 CSS px)
  for (int i = r2; i < r3; i++) {
    vec4 R = uLifeR[i];
    if (!lifeBox(R, uv)) continue;
    vec4 A = uLifeA[i], B = uLifeB[i];
    vec2 q = (uv - R.xy) / max(R.zw - R.xy, vec2(1e-6));
    float up = clamp((uv.y - B.y) / max(B.z, 1e-6), 0.0, 1.0);   // 0 at the foot .. 1 at the crown's top
    float w = smoothstep(0.12, 0.55, up) * smoothstep(0.0, 0.22, q.x) * smoothstep(1.0, 0.78, q.x) * smoothstep(1.0, 0.86, q.y);
    float ph = uTime * 0.85 + A.w - up * 1.7;
    lifeDx += B.w * A.z * w * (0.7 * sin(ph) + 0.3 * sin(ph * 2.3 + 1.3)) * uLifeK.x * gText;
#ifdef EL_AIR
    // (the scroll's air: the strands stream a little with the scroll's wind, most at their tips, and swing back
    // with the plum's spring when it drops)
    lifeDx += B.w * A.z * w * clamp(uAir2.x / 0.0105, -1.6, 1.6) * (0.5 + 0.5 * up) * 1.1 * gText * airFam(2.0);
#endif
  }
  // the sprites (the drifting boat, the bridge's walker, the bobbing ferry): each fills its entry's box (moved by
  // index.ts) from its place in the layer's one atlas (B.z..B.w across, 0..A.y down), over a faint bleed halo like the
  // figures' (not x uLifeK: a sprite is no longer in the still painting, so it stays, still, when life stops)
  for (int i = r3; i < r4; i++) {
    vec4 R = uLifeR[i];
    if (!lifeBox(R, uv)) continue;
    vec4 B = uLifeB[i];
    vec2 q = (uv - R.xy) / max(R.zw - R.xy, vec2(1e-6));
    if (uLifeA[i].z > 3.5) {
      // rushes in a breeze (elements.ts contactLife). The clump bends from its foot (the box's bottom), more toward
      // its tips, each stem a little out of step with its neighbours (the phase runs across the clump and up it), so it
      // sways as grass does, never as one rigid piece; at most ~3.5 CSS px at the tips. Its box was widened by 8 % each
      // side (index.ts) so a bent tip is never cut.
      float hq = clamp(q.y, 0.0, 1.0);
      float ph = uTime * 0.95 + uLifeA[i].w + q.x * 5.0 - hq * 1.3;
      float sw = (0.65 * sin(ph) + 0.35 * sin(ph * 2.1 + 0.7)) * pow(hq, 1.7) * uLifeK.x * (uLifeA[i].z - 4.0);   // (calmer on phones: 4.6)
#ifdef EL_AIR
      sw += clamp(uAir2.x / 0.0105, -1.6, 1.6) * 0.55 * pow(hq, 1.7) * (uLifeA[i].z - 4.0) * airFam(4.0);   // (they bow to the scroll's wind)
#endif
      q.x = (q.x - sw * 3.6 * uLive2.w / uAspect / max(R.z - R.x, 1e-6)) * 1.16 - 0.08;
      if (q.x < 0.0 || q.x > 1.0) continue;
    } else if (uLifeA[i].z > 2.5) {
      // the plum swings about its root (the box's right side, high up) by about half a degree, about every 12 s,
      // with a smaller, quicker breath over it (the frame stays put; only the bough turns)
      float ar = uAspect * (R.z - R.x) / max(R.w - R.y, 1e-6);
      float an = 0.0087 * sin(uTime * 0.503 + uLifeA[i].w) + 0.0025 * sin(uTime * 1.37 + 1.7);
      // the pointer's nudge (elements.ts plumGust): a damped swing in the gust's direction (~1.5 deg, ~2.5 s)
      if (uGust.x >= 0.0) an += uGust.w * uGust.y * exp(-uGust.x / 1.25) * sin(uGust.x * 3.3);
      // with the drift (stillSettle) the swing eases to the bough's rest (a still frame shows it at rest)
      an *= mix(1.0, uLifeK.x, uStirK.y);
#ifdef EL_AIR
      an += uAir2.x * airFam(1.0);   // (the bough leans against the scroll's wind and swings back on its spring)
#endif
      vec2 pv = vec2(1.0, 0.8);
      vec2 cq = (q - pv) * vec2(ar, 1.0);
      cq = mat2(cos(an), sin(an), -sin(an), cos(an)) * cq;
      q = vec2(cq.x / ar, cq.y) + pv;
      if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
    } else if (uLifeA[i].z > 1.5) {
      // a bird: it glides, and now and then its wings beat (the sprite folds about its middle in time), and it
      // banks a little as it goes
      float ar = uAspect * (R.z - R.x) / max(R.w - R.y, 1e-6);
      float beat = smoothstep(0.1, 0.7, sin(uTime * 0.8 + uLifeA[i].w));
      float sy = mix(1.0, 0.45 + 0.55 * abs(sin(uTime * 6.5 + uLifeA[i].w)), beat);
      float bk = 0.14 * sin(uTime * 0.45 + uLifeA[i].w);
      vec2 cq = (q - 0.5) * vec2(ar, 1.0);
      cq = mat2(cos(bk), sin(bk), -sin(bk), cos(bk)) * cq;
      q = vec2(cq.x / ar, cq.y / sy) + 0.5;
      if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) continue;
    }
    vec2 tq = vec2(mix(B.z, B.w, q.x), (1.0 - q.y) * uLifeA[i].y);
    vec4 F = textureLod(uLifeSpr, tq, B.y);
    float wetE = 0.0;
    if (uLifeA[i].z > 2.75 && uLifeA[i].z < 3.5) {
      // the plum's arrival: its ink blooms from the root (the box's right side, high up) to the tips, a
      // ragged threshold on the distance from the root with a darker wet edge at the front, never a global fade
      float hide = (uLifeA[i].z - 3.0) / 0.45;
      if (hide > 0.001) {
        float ar = uAspect * (R.z - R.x) / max(R.w - R.y, 1e-6);
        float dr = length((q - vec2(1.0, 0.8)) * vec2(ar, 1.0)) / length(vec2(ar, 0.8));
        float fr = (1.0 - hide) * 1.12 + 0.05 * (textureLod(uNoise, q * vec2(ar, 1.0) * 1.7, 0.0).r - 0.5) / 0.13;
        float m = smoothstep(fr, fr - 0.035, dr);
        wetE = m * smoothstep(fr - 0.09, fr - 0.02, dr);
        F *= m;
      }
    }
    F += textureLod(uLifeSpr, tq, B.y + 2.2) * (uLifeA[i].z > 2.5 ? 0.05 : uLifeA[i].z > 1.5 ? 0.08 : 0.3) * (1.0 - F.a);   // (a bird and the plum keep their painted edge: only a breath of halo)
    F.rgb *= 1.0 - 0.28 * wetE;   // (the wet front of the plum's blooming ink)
    F *= B.x * gNear;
    lifeO = F + lifeO * (1.0 - F.a);
    lifeBA = max(lifeBA, F.a);
    lifeBD = max(lifeBD, smoothstep(0.015, 0.2, textureLod(uLifeSpr, tq, B.y + 1.6).a * B.x));
  }
  // "The plum answers" (elements.ts plumGust): the gust lets go of three to five petals, one after another (120-400 ms
  // apart), of different sizes (0.6-1.2), about one in three a white plum petal; each is carried a little with the
  // pointer's lean, then falls slowly in a long drifting arc with the breeze, tumbling under 90 deg/s, over ~6 s
  if (uGust.z > 0.0 && uGust.x >= 0.0 && uGust.x < 7.6) {
    float gs = uGust2.w;
    int nP = 3 + int(floor(hash12(vec2(gs, 1.7)) * 2.999));
    float tj = 0.0;
    for (int j = 0; j < 5; j++) {
      if (j >= nP) break;
      float fj = float(j);
      float h1 = hash12(vec2(fj + gs, 5.3)), h2 = hash12(vec2(fj + 2.9 + gs, 8.1)), h3 = hash12(vec2(fj + 6.1, 0.7 + gs));
      if (j > 0) tj += 0.12 + 0.28 * h2;                  // (one after another)
      float t = uGust.x - tj;
      float T = 5.2 + 1.4 * h1;
      if (t <= 0.0 || t >= T) continue;
      float push = (1.0 - exp(-t * 1.1)) / 1.1;
      float wind = 7.0 + 5.0 * h3;                        // (the breeze carries it on, px/s, the way the gust leaned)
      // (each lets go from its own blossom along the bough, ~22 px apart, so they never leave as one cluster)
      vec2 off = vec2(uGust.y * ((38.0 + 30.0 * h3) * push + wind * t) + 14.0 * sin(t * (0.7 + 0.4 * h1) + fj * 2.0) + (fj - 2.0) * 22.0 + (h1 - 0.5) * 26.0,
                      8.0 * h2 * (1.0 - exp(-t * 2.0)) - (9.0 + 6.0 * h1) * t + (h3 - 0.5) * 22.0 + (fj - 2.0) * 4.0);
      vec2 c = uGust2.xy + vec2(off.x * uLive2.w / uAspect, off.y * uLive2.w);
      vec2 d = uv - c;
      d.x *= uAspect;
      float r0 = uGust2.z * uAspect * (0.6 + 0.6 * h3);
      if (dot(d, d) > r0 * r0 * 2.0) continue;
      float rot = t * (0.5 + 0.9 * h1) * (h2 < 0.5 ? -1.0 : 1.0) + fj * 1.3;   // (< 1.4 rad/s: a slow tumble)
      float flip = 0.3 + 0.7 * abs(cos(t * (0.6 + 0.5 * h3) + fj));
      vec4 pe = lifePetal(d, r0, rot, flip, h1);
      if (hash12(vec2(fj + gs, 3.3)) < 0.34) pe.rgb = mix(pe.rgb, mix(vec3(0.99, 0.985, 0.99), vec3(0.90, 0.92, 0.95), 0.4 * (1.0 - flip)), 0.8);   // (a white plum petal, cool in its turn)
      float ph = t / T;
      float al = clamp(pe.a * smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.65, 1.0, ph)) * 0.95 * uGust.z * uLifeK.x * gText, 0.0, 1.0);
      lifeO = lifeO * (1.0 - al) + vec4(pe.rgb, 1.0) * al;
    }
  }
  // "Water you can stir" (elements.ts stir): the ring sets on the open water (the water is read once, at the first live ring)
  if (uStirK.x > 0.0) {
    float wk = -1.0, wq = -1.0;
    for (int s = 0; s < 4; s++) {
      if (uStir[s].z < 0.0) continue;
      bool own = uStir[s].w >= 4.0;   // (kind 2: the ferry's own drops, at the pole and the bow, may lie by its mirror)
      if (own && wk < 0.0) wk = lifeWater(wp, rx, false) * gText * uLifeK.x * uStirK.x;
      if (!own && wq < 0.0) wq = lifeWater(wp, rx, true) * gText * uLifeK.x * uStirK.x;
      float k = own ? wk : wq;
      if (k <= 0.001) continue;
      lifeStir(uStir[s], uv, k);
    }
  }
}
// ...laid into the view's sample C (premultiplied colour, alpha its coverage; an opaque window passes alpha 1)
vec4 lifeLay(vec4 C, inout float adm) {
  if (lifeSG + lifeSL > 0.0 && C.a > 0.0) {
    vec3 sc = C.rgb / C.a;
    float dark = clamp((0.935 - dot(sc, vec3(0.299, 0.587, 0.114))) / 0.10, 0.0, 1.0);
    // where the water holds a reflection or the indigo, the gaps break it toward the light; on water as pale as the
    // paper (Work's river) a gap is a breath lighter than the paper, ruled under by a faint cool ripple line
    sc = mix(sc, mix(PAPER, SKY, 0.5), lifeSG * dark);
    sc = mix(sc, SKY * 1.012, min(lifeSG * (1.0 - dark), 1.0));
    sc = mix(sc, mix(MIST2, INK_F, 0.3), lifeSL * (1.0 - dark) * 0.8);
    C.rgb = sc * C.a;
  }
  if (lifeRD + lifeRW + lifeFL + lifeFD > 0.0 && C.a > 0.0) {
    // the falling water's gaps and lights; a ring's ink crescent and its white hairline
    vec3 sc = C.rgb / C.a;
    sc = mix(sc, sc * vec3(0.66, 0.80, 0.92), lifeFD);
    sc = mix(sc, LIGHT, min(lifeFL, 1.0));
    sc = mix(sc, mix(INK_F, INK_N, 0.3), min(lifeRD, 1.0));
    sc = mix(sc, LIGHT, min(lifeRW, 1.0));
    C.rgb = sc * C.a;
  }
  adm = mix(adm, 0.3, lifeBA);
  return lifeO + C * (1.0 - lifeO.a);
}

void main() {
  vec2 uv = vUv;
  float aspect = uAspect;
#ifdef LIFE_ON
  // 4b small life, for the one view it lies in (its world point, scale, ridge column and keep-out worked out here)
  int lv = int(uLifeT[1].y);
  if (lv >= 0) {
    // (a stage layer: the stage's mapping at that layer's slide and sink; a window: its box, mapping, sink and keep-out)
    vec4 M = uStM, O = vec4(0.0), K = vec4(0.0), R = vec4(0.0, 0.0, 1.0, 1.0);
    if (lv >= 2) O = uStO[lv - 2];
    else { R = uWinR[lv]; M = uWinM[lv]; K = uWinK[lv]; O = vec4(0.0, uWinO[lv].y, 0.0, 0.0); }
    vec2 l = (uv - R.xy) / (R.zw - R.xy);
    vec2 ls = vec2(l.x - O.x, lv >= 2 ? l.y + O.y : min(l.y + O.y, 1.0));
    // (a stage painted wider than the screen (st.ext) holds its ridge columns over that width: uStirK.z)
    lifePrep(uv, vec2(M.x + ls.x * M.w, M.y - (1.0 - ls.y) * M.z), M.wz / (R.zw - R.xy), ls.x * (lv >= 2 ? uStirK.z : 1.0),
             K.y * (1.0 - smoothstep(K.x - K.z, K.x + K.z, l.x)));
  }
#else
  const int lv = -1;   // (the program without life: gl.ts uses it while none is on screen)
#endif

  // a pixel outside every painted region (the two windows, the windows into the painting; no stage, horizon band or
  // page change on screen) is the paper and its grain, written at once and the rest of the pass skipped, so the full
  // pass does not run over the whole screen on every scroll frame: in effect a scissor round what is painted (a true
  // scissor would need a preserved drawing buffer, a full-frame copy on a phone's GPU)
#ifdef EL_GLIMPSE
  if (uGlK.y > 0.5 && uSt.x <= 0.0 && uHzK <= 0.0 && uSweep.z <= 0.0 && uHold <= 0.0) {
    bool any = false;
    for (int i = 0; i < 2; i++) { vec4 R = uWinR[i]; if (R.x <= R.z && uv.x >= R.x && uv.x <= R.z && uv.y >= R.y && uv.y <= R.w) any = true; }
    for (int i = 0; i < GLN; i++) { vec4 R = uGlR[i]; if (uGlK.x > 0.5 && R.x <= R.z && uv.x >= R.x && uv.x <= R.z && uv.y >= R.y && uv.y <= R.w) any = true; }
    if (!any) {
      vec2 gp0 = (gl_FragCoord.xy * uPx + vec2(uPanPx, 0.0)) / (${NOISE_SIZE}.0 * uGrainPx);
      float bpt0 = uPx / uGrainPx;
      float gk0 = 1.0 + 0.2 * smoothstep(0.8, 1.35, bpt0) - 0.35 * smoothstep(1.6, 2.4, bpt0);
      vec3 c0 = PAPER * (1.0 + (texture(uNoise, gp0).b - 0.5) * 0.55 * uGrain * gk0 + (texture(uNoise, gp0 * 0.09).r - 0.5) * 0.010);
      outColor = vec4(c0 + (hash12(gl_FragCoord.xy) - 0.5) / 255.0, 1.0);
      return;
    }
  }
#endif

  // 1. what lies under this pixel: paper, the horizon band, a window on top (box-anchored, so it moves 1:1 with
  // the page). p = the world point (for the mist), tm = its mist clock, adm = how much drifting mist may lie here.
  vec3 col = PAPER;
  float adm = 0.0, inWin = 0.0, wakeOK = 0.0, keep = 0.0, tm = REST_T, wsc = 1.0, heroW = 0.0;
  float glCut = 0.0;   // a window's painting (its veil-free part: >= 40 px from any line)
  float glSun = 1.0;   // ...and how much of the light's bloom it keeps (only the highest window shows the light)
  float glA = 0.0;     // ...and how much of this pixel is a window's (nothing there is lighter than the paper)
  float seaBody = 0.0;   // 4b: the grey wash of the sea's rolling banks (laid on after the veils' clearing)
  float dyB = 0.0;       // a parted window's back, how far it stands above its front here (scene units): the light's bloom and Home's ribbon ride the back
  vec2 p = vec2(uHzM.x + uv.x * uHzM.w, uv.y);
  if (uSt.x > 0.0) {
    // the living ground: far (opaque), the haze deck, middle, near, then the sea of mist over their feet
    vec4 O1 = uStO[1];
    vec2 wp = vec2(uStM.x + (uv.x - O1.x) * uStM.w, uStM.y - (1.0 - (uv.y + O1.y)) * uStM.z);   // anchored to the middle layer
    vec4 B = stTap(uSt0, uStS[0], vec4(uStO[0].xy, 1.0, 0.0), uv - vec2(lv == 2 ? lifeDx : 0.0, 0.0));
    if (lv == 2) { float a0 = B.a; B = vec4(lifeLay(vec4(B.rgb, 1.0), a0).rgb, a0); }   // (4b small life)
    col = mix(PAPER, B.rgb, uStO[0].z);
    adm = B.a * uStO[0].z;
    if (uStG.y > uStG.x) {
      // (the inner places' spring morning, as their strip has it; the far layer stands at its own sink)
      float fyG = uv.y + uStO[0].y;
      col = stGrade(col, wp, (uv.x - uStO[0].x), (fyG - uStG.x) / (uStG.y - uStG.x), 1.0);
    }
    if (uStX.x > 0.0) {
      // an inner place's far sky is air, never a flat ice-blue slab with a ragged, nearly vertical left edge. Its pale
      // blue eases back toward the paper near the reading column, over a long edge that swells
      // in broad lobes down its height (never a vertical line), and high in the sky (where the header's paper band was at
      // rest), so it reads as air round the place, not cut paper. Ink and the place's own colours keep their value.
      float lumF = dot(col, vec3(0.299, 0.587, 0.114));
      float skyF = smoothstep(0.012, 0.06, col.b - col.r) * smoothstep(0.72, 0.85, lumF);
      float dxp = (uv.x - uStX.z) * aspect / max(uLive2.w, 1e-6);   // CSS px right of the column's edge
      float fy = uv.y + uStO[0].y;                                // the far layer's own height (1: its top)
      float nL = (textureLod(uNoise, vec2(fy * 1.9 + uStX.w * 5.0, 0.29 + uStX.w), 2.0).r - 0.5) / 0.13;
      float nL2 = (textureLod(uNoise, vec2(fy * 4.7 + uStX.w, 0.71), 1.0).g - 0.5) / 0.13;
      float nT = (textureLod(uNoise, vec2(uv.x * aspect * 0.8 + uStX.w * 2.3, 0.53), 2.0).g - 0.5) / 0.13;
      float e0 = 50.0 + 85.0 * nL + 25.0 * nL2;
      float lat = smoothstep(e0, e0 + 330.0, dxp);
      // (high in the sky only as the camera lifts: at rest the header's paper band does this)
      float hi = smoothstep(0.5 + 0.06 * nT, 0.95 + 0.04 * nT, fy);
      // (never round the place's own light: light needs blue round it to read as light; and all of it only as the
      // camera lifts, the header's paper band gone: at rest the strip's own morning stands)
      float ak = clamp(max(1.0 - lat, hi * 0.8), 0.0, 1.0) * uStX.x * (1.0 - 0.85 * lightNear(wp, 0.55)) * smoothstep(0.05, 0.75, uSt.y);
      col = mix(col, mix(PAPER, col, 0.3), skyF * ak);
    }
    float nb = texture(uNoise, vec2(wp.x * 0.31 + uTime * 0.0018, 0.23)).r - 0.5;
    float nc = texture(uNoise, vec2(wp.x * 0.97 - uTime * 0.0026, 0.61)).g - 0.5;
    if (uSt.w > 0.0) {
      // a pale deck of cloud between the far ranges and the middle ones: it rises as the camera does
      float hy = uSea.z + nb * uSea.w * 1.4 + nc * uSea.w * 0.5;
      float hk = (1.0 - smoothstep(hy - uSea.y * 1.6, hy + uSea.y * 0.7, uv.y)) * uSt.w;   // (not gated by the far layer's admittance, B.a: its vertical texture cuts the deck into columns)
      col = mix(col, mix(MIST, SKY, 0.35), hk * 0.82);
      adm = max(adm, hk * 0.8);
    }
    // coming back down through the cloud: the middle and near layers (and the sea over their feet) go wholly
    // under the bank while they take the rest of their drop there (uStO[1].w), so that drop is never seen
    float hid = 0.0;
    if (O1.w > 0.0) { float hy = stCloudTop(uv.x * aspect); hid = (1.0 - smoothstep(hy - uStC.z * 0.3, hy + uStC.z * 0.1, uv.y)) * O1.w; }
    float bxR = aspect * (uStR[1].z - uStR[1].x);   // (a crop's width in viewport heights, for its foot's lobes)
    vec4 Mi = stTapF(uSt1, uStS[1], O1, uStR[1], uv - vec2(lv == 3 ? lifeDx : 0.0, 0.0), bxR);
    float lfa = 0.0;
    if (lv == 3) Mi = lifeLay(Mi, lfa);
    Mi *= 1.0 - hid;
    // (as the camera lifts, the middle and near layers' ink keeps clear of the row rules' end: within ~40 px of
    // it they are paper's air, then they come back over a lobed ~90 px edge, so the rule never runs into a mountain foot)
    float ruleK = 0.0;
    if (uStK.x > 0.0 && uStK.y > 0.0) {
      float dxr = (uv.x - uStK.x) * aspect / max(uLive2.w, 1e-6);
      float nR = (textureLod(uNoise, vec2(uv.y * 2.1 + uStX.w * 4.3, 0.57), 2.0).r - 0.5) / 0.13;
      float e = 40.0 + 14.0 * nR;
      ruleK = (1.0 - smoothstep(e, e + 90.0, dxr)) * uStK.y;
      Mi *= 1.0 - ruleK;
    }
    float cur = 0.0;
    if (uStV.y > 0.0) {
      // (the curtain's edge billows down its length, anchored to the scene: it sinks with the town. From the noise's
      // coarse mips only, so the edge swells in broad billows; the fine octaves make it jump row to row, which smears
      // the town's roofs into horizontal streaks along it)
      float cb = (textureLod(uNoise, vec2(0.37, wp.y * 1.2 + 0.11), 3.0).r - 0.5) / 0.13 * 0.8 + (textureLod(uNoise, vec2(0.61, wp.y * 2.6 + 0.5), 2.0).g - 0.5) / 0.14 * 0.3;
      // (and it is torn into small drifting patches of mist, ~40 px, so the town's roofs go into a cloud rather than fade
      // sideways along their own lines)
      float cp = (texture(uNoise, wp * vec2(7.0, 11.0) + vec2(0.23 + uTime * 0.0012, 0.71)).r - 0.5) / 0.13;
      float ex = uStV.x + cb * uStV.z * 0.55 + cp * uStV.z * 0.5;
      cur = uStV.y * (1.0 - smoothstep(ex - uStV.z * 0.7, ex + uStV.z * 0.15, uv.x));
      // (a floor that billows with the edge but not with its patches: the patches alone tear holes up to ~200 px left
      // of the edge, where dark flecks of what the curtain hides (the bridge's crowd, a roof ridge, a mast) show through
      // in the margin. So everything left of the billowing edge is hidden, and the patches only lay mist over the
      // town's first roofs right of it: its west end goes into a cloud and leaves no fragments)
      float eb = uStV.x + cb * uStV.z * 0.55;
      cur = max(cur, uStV.y * (1.0 - smoothstep(eb - uStV.z * 0.35, eb + uStV.z * 0.05, uv.x)));
      Mi *= 1.0 - cur;
    }
    if (uStG.y > uStG.x && Mi.a > 0.004) Mi.rgb = stGrade(Mi.rgb / Mi.a, wp, uv.x - O1.x, 0.0, 0.0) * Mi.a;   // (its hills)
    col = col * (1.0 - Mi.a) + Mi.rgb;
    adm = mix(adm, stAdm(Mi), Mi.a);
    vec4 Ne = stTapF(uSt2, uStS[2], uStO[2], uStR[2], uv - vec2(lv == 4 ? lifeDx : 0.0, 0.0), aspect * (uStR[2].z - uStR[2].x));
    if (uStG.y > uStG.x && Ne.a > 0.004) Ne.rgb = stGrade(Ne.rgb / Ne.a, wp, uv.x - uStO[2].x, 0.0, 0.0) * Ne.a;
    if (lv == 4) Ne = lifeLay(Ne, lfa);
    Ne *= (1.0 - cur) * (1.0 - hid) * (1.0 - ruleK);
    col = col * (1.0 - Ne.a) + Ne.rgb;
    adm = mix(adm, stAdm(Ne), Ne.a);
    if (uStC.x > 0.0) {
      // the cloud the camera rises through (mid-lift on Work: the scene steps sideways inside it): a sea of cloud from
      // just above the middle layer's crests down into the sea; the far ranges stand clear above it. It is painted the
      // way a painter leaves a cloud: the billows are reserved paper, and a soft grey wash is laid round their tops (on
      // the sky over the bank, and in the folds where one billow rises in front of the next), so the bank has a lit,
      // billowing edge and form, never a flat grey. Anchored to the screen (the step inside it never shows), drifting.
      float bx = uv.x * aspect;
      // (contours from the noise's coarse mip: broad billows, no ragged small teeth)
      float b3 = (textureLod(uNoise, vec2(bx * 0.9 + 3.1 - uTime * 0.0012, 0.11), 3.0).r - 0.5) / 0.13;
      float b4 = (textureLod(uNoise, vec2(bx * 0.8 + 7.7 + uTime * 0.0010, 0.64), 3.0).r - 0.5) / 0.13;
      float cy = stCloudTop(bx);                                  // the bank's top (uv y, up)
      float c2 = cy - 0.13 + 0.04 * b3;                           // a nearer billow in front of it...
      float c3 = cy - 0.28 + 0.045 * b4;                          // ...and a third, lower
      float ck = (1.0 - smoothstep(cy - uStC.z * 0.3, cy + uStC.z * 0.1, uv.y)) * uStC.x;
      float cn = texture(uNoise, vec2(bx * 0.42 - uTime * 0.0022, uv.y * 1.3 + 0.17)).r;
      col = mix(col, mix(MIST, SKY, 0.45 + 0.3 * cn), ck * (0.94 + 0.06 * cn));
      // the wash: just above each billow's top, fading upward over ~10% of the view (the top one on the sky over the bank)
      float tw = 0.0;
      for (int j = 0; j < 3; j++) {
        float cj = j == 0 ? cy : j == 1 ? c2 : c3;
        float t = uv.y - cj;
        tw = max(tw, smoothstep(-0.004, 0.014, t) * (1.0 - smoothstep(0.014, 0.1, t)) * (j == 0 ? 0.85 : 1.0));
      }
      col = mix(col, vec3(0.78, 0.86, 0.90), tw * uStC.x * (0.5 + 0.16 * cn));
      adm = max(adm, ck * 0.8);
    }
    if (uSt.z > 0.0) {
      // the sea of mist: a billowing surface (world-anchored, drifting), mist at the surface, paper deeper down
      float sy = uSea.x + nb * uSea.w + nc * uSea.w * 0.45;
      float sea = (1.0 - smoothstep(sy - uSea.y, sy + uSea.y * 0.45, uv.y)) * uSt.z * (1.0 - hid);
      vec3 seaC = mix(mix(MIST, SKY, 0.25), mix(PAPER, SKY, 0.3), smoothstep(0.0, 0.2, sy - uv.y));
      col = mix(col, seaC, sea);
      adm = max(adm, sea * 0.85);
      // ...and, as the camera rises into it, its body: the drifting mist, in banks up to MIST2, from just under the
      // surface to about a third of the viewport down (laid on after the veils' clearing, below)
      float dd = sy - uv.y;
      seaBody = sea * uStC.w * smoothstep(0.0, 0.06, dd) * (1.0 - smoothstep(0.14, 0.4, dd));
    }
    if (uStF.z > 0.0) {
      // on an inner place the stage goes back into the paper above the footer, over a lobed edge, so the story map and
      // the footer's lines sit on clean paper
      float nF = (textureLod(uNoise, vec2(uv.x * aspect * 0.7 + uStX.w, 0.83), 2.0).r - 0.5) / 0.13;
      float nF2 = (textureLod(uNoise, vec2(uv.x * aspect * 2.1 - uTime * 0.001, 0.37), 1.0).g - 0.5) / 0.13;
      float fk = (1.0 - smoothstep(uStF.x - uStF.y * 0.2, uStF.x + uStF.y, uv.y + uStF.y * (0.35 * nF + 0.12 * nF2))) * uStF.z;
      col = mix(col, PAPER, fk);
      adm *= 1.0 - fk;
      seaBody *= 1.0 - fk;
    }
    p = wp; tm = uTime; inWin = 1.0; wakeOK = 1.0; heroW = 1.0;
    wsc = uStM.z;
  }
  if (uHzK > 0.0) {
    vec4 Hs = texture(uHzTex, min(uv * uHzS.xy, uHzS.zw));
    // soft edges: into paper at the sides and a low mist along the bottom
    float ev = smoothstep(0.0, 0.05, uv.x) * smoothstep(1.0, 0.95, uv.x);
    vec3 hz = mix(SKY, Hs.rgb, 0.84 + 0.16 * ev);
    hz = mix(hz, MIST, (1.0 - smoothstep(0.0, 0.09 * uVeilR / 0.13, uv.y)) * 0.55);
    col = mix(PAPER, hz, uHzK);
    adm = Hs.a * uHzK * 0.6;
  }
  for (int wi = 0; wi < 2; wi++) {
    vec4 R = uWinR[wi];
    if (R.x > R.z || uv.x < R.x || uv.x > R.z || uv.y < R.y || uv.y > R.w) continue;
    vec2 l = (uv - R.xy) / (R.zw - R.xy);          // box uv, y up
    float ly = l.y + uWinO[wi].y;                   // (the painting may sink inside its box: sampled higher up...)
    vec2 ls = vec2(l.x, min(ly, 1.0));
    vec2 lt = vec2(ls.x - (lv == wi ? lifeDx / (R.z - R.x) : 0.0), ls.y);   // (4b small life: the willows' sway)
    vec4 S;
    vec4 M = uWinM[wi], F = uWinF[wi];
    vec4 Pw = uWinP[wi];
    if (Pw.x > 0.5) {
      // the back at its own sink (above its own top: paper, through its own top feather), the mist rising over it,
      // then the front at the window's sink and drift (nothing above its top), as one sample for what follows
      float lyB = l.y + Pw.y;
      vec2 lb = vec2(lt.x, min(lyB, 1.0));
      S = wi == 0 ? texture(uWin0, min(lb * uWinS[0].xy, uWinS[0].zw)) : texture(uWin1, min(lb * uWinS[1].xy, uWinS[1].zw));
      vec2 wpB = vec2(M.x + lb.x * M.w, M.y - (1.0 - lb.y) * M.z);
      float nB = texture(uNoise, wpB * vec2(0.9, 2.2) + 0.31).r - 0.5;
      S.rgb = mix(PAPER, S.rgb, smoothstep(0.0, F.x, 1.0 - lyB + nB * F.x * 0.7));
      dyB = (lb.y - ls.y) * M.z;
      bool clo = Pw.x > 1.5;   // (a closing arriving: its two layers together, its mist parting over both)
      float ub = wpB.x / max(M.w, 1e-3);   // (world x in box widths, for the banks' lobes)
      if (Pw.z > 0.0 && !clo) {
        // the bank: drifting billows along its top (world-anchored to the back, so it rises with the scroll, not the box)
        // (billows of a fixed size in the box, never scaled down with the bank: a low bank is lobed, never a level slab)
        // (lobes sized by the box's width, about two across it, from coarse mips: sized in world units, a tablet's
        // bank rises almost straight up between two lobes and cuts the host's flank into a vertical cut-out edge)
        float bb = clamp((textureLod(uNoise, vec2(ub * 0.42 + uTime * 0.0015, 0.41), 3.5).r - 0.5) / 0.13, -2.0, 2.0);
        float bc = clamp((textureLod(uNoise, vec2(ub * 1.1 - uTime * 0.0022, 0.77), 3.0).g - 0.5) / 0.13, -2.0, 2.0);
        float top = Pw.z + (0.08 * bb + 0.025 * bc) * smoothstep(0.0, 0.1, Pw.z);
        float bank = (1.0 - smoothstep(top - 0.2, top + 0.07, l.y)) * smoothstep(0.0, 0.08, Pw.z);
        S.rgb = mix(S.rgb, mix(MIST, PAPER, 0.3 + 0.4 * smoothstep(top - 0.55, top - 0.12, l.y)), bank * 0.88);
        S.a = mix(S.a, 0.85, bank);
      }
      vec2 lf = vec2(lt.x - Pw.w, ls.y);
      vec4 Fn = (ly > 1.0 || lf.x < 0.0 || lf.x > 1.0) ? vec4(0.0) : (wi == 0 ? texture(uWinN0, min(lf * uWinNS[0].xy, uWinNS[0].zw)) : texture(uWinN1, min(lf * uWinNS[1].xy, uWinNS[1].zw)));
      if (Pw.z > 0.0 && !clo) {
        // ...and its foot over the front's feet (lighter: the near crags stand in it)
        float topF = Pw.z * 0.45;   // (PART.riseF / PART.rise)
        float bankF = (1.0 - smoothstep(topF - 0.16, topF + 0.05, l.y + clamp((textureLod(uNoise, vec2(ub * 0.6 + uTime * 0.001, 0.13), 3.5).r - 0.5) / 0.13, -2.0, 2.0) * 0.05)) * 0.8 * smoothstep(0.0, 0.08, Pw.z);
        Fn.rgb = mix(Fn.rgb, mix(MIST, PAPER, 0.4) * Fn.a, bankF);
      }
      S = vec4(S.rgb * (1.0 - Fn.a) + Fn.rgb, mix(S.a, stAdm(Fn), Fn.a));
      if (clo && Pw.z > 0.0) { S.rgb = partMist(S.rgb, l, wpB.x / HSW, Pw.z); S.a = mix(S.a, 0.85, Pw.z * 0.5); }
    } else {
      S = wi == 0 ? texture(uWin0, min(lt * uWinS[0].xy, uWinS[0].zw)) : texture(uWin1, min(lt * uWinS[1].xy, uWinS[1].zw));
    }
    if (lv == wi) { float sa = S.a; S = vec4(lifeLay(vec4(S.rgb, 1.0), sa).rgb, sa); }   // (...and the rest of it)
    vec2 wp = vec2(M.x + ls.x * M.w, M.y - (1.0 - ls.y) * M.z);
    // feathers: the window comes out of the paper at its top and goes back into it at its bottom, the edge broken
    // by the mist field (in world space, so it travels with the painting); its sides run off the screen
    float n = texture(uNoise, wp * vec2(0.9, 2.2) + 0.31).r - 0.5;
    // (...and its top feather sinks with it: above the painting's own top there is paper, never its top row repeated
    // upward: a clamp smears the roofs and willows into vertical streaks on phones)
    float fa = smoothstep(0.0, F.x, 1.0 - ly + n * F.x * 0.7) * smoothstep(0.0, F.y, l.y + n * F.y * 0.7);
    fa *= F.w;
    // at the bottom a bank of mist rises over ~2.4 feathers before the paper, in broad lobes, so a crest standing
    // there melts into it (no hard dark ridge along the phone strip's foot)
    { float nW = clamp((textureLod(uNoise, wp * vec2(0.35, 0.9) + vec2(0.63, 0.12), 2.0).r - 0.5) / 0.13, -2.0, 2.0);
      float nW2 = clamp((textureLod(uNoise, wp * vec2(1.7, 2.6) + vec2(0.21, 0.77), 1.0).g - 0.5) / 0.13, -2.0, 2.0);
      float botK = 1.0 - smoothstep(0.0, F.y * 2.4, l.y - F.y * 0.2 + nW * F.y * 0.6 + (nW * 0.6 + nW2 * 0.4) * 0.05 * smoothstep(0.78, 0.6, uAspect));   // (on phones its top billows: never a level slab)
      S.rgb = mix(S.rgb, mix(MIST, PAPER, 0.4), botK * 0.88);
      // (phones: a strip is short, so the near crests stand in its lowest third; there the dark ink melts into a
      // rising bank of mist, never a ruled dark ridge along the strip's foot)
      float lumB = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      float botP = (1.0 - smoothstep(0.0, 0.34, l.y + nW * 0.05)) * smoothstep(0.78, 0.6, uAspect) * smoothstep(0.88, 0.62, lumB);
      S.rgb = mix(S.rgb, mix(MIST, SKY, 0.3), botP * 0.7);
      // in the lowest ~40 % on phones the pale crag tips too (not only the dark ink) go into the bank, in broad lobes,
      // so the strip's foot is one clean mist with no small pale tips standing along it
      float botQ = (1.0 - smoothstep(0.12, 0.42, l.y + nW * 0.04 + nW2 * 0.015)) * smoothstep(0.78, 0.6, uAspect) * smoothstep(0.985, 0.9, lumB) * smoothstep(0.6, 0.76, lumB);   // (pale only: the traveller and the hut keep their ink)
      S.rgb = mix(S.rgb, mix(MIST, PAPER, 0.25), botQ * 0.82); }
    // Writing, Résumé and Contact carry the same spring morning. The grade is gated to the page's own hero window
    // (uWinK.w, set for the strip only: never the closing window or a neighbour, so no blue blocks or full-width stripes
    // reach the inner pages), kept right of the text's keep-out (colour stays out from behind text), and confined to the
    // window's top 60 %. It is a smooth vertical wash, not a mask of the pale pixels: every light pixel (air and mist
    // alike) moves toward the same gradient, so the mist never reads as white holes or as cut-out cloud lobes on a flat
    // cyan band; only a very low-frequency +-5 % breath moves it. Radial round the place's light: white at the light, a
    // little bluer away from it; the ice desaturated toward #CFE3EE.
    { vec4 Kw = uWinK[wi];
      float keepW = Kw.y * (1.0 - smoothstep(Kw.x - Kw.z, Kw.x + Kw.z * 2.0, l.x));
      float inK = smoothstep(1.9, 2.15, wp.x / HSW) * Kw.w * (1.0 - keepW);
      float lumS = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      // (the hills take Home's value structure: a little more colour and a deeper middle value)
      float hillK = inK * (1.0 - smoothstep(0.86, 0.93, lumS)) * smoothstep(0.35, 0.6, lumS);
      S.rgb = mix(S.rgb, clamp(mix(vec3(lumS), S.rgb, 1.35) - (0.9 - lumS) * 0.22, 0.0, 1.0), hillK);
      vec4 Lw = lightK(floor(wp.x / HSW));
      float rL = length(vec2((wp.x / HSW - Lw.x) * HSW, wp.y - Lw.y)) / max(Lw.z, 1e-3);
      float nearL = exp(-rL * rL * 0.9);
      float br = (textureLod(uNoise, wp * vec2(0.12, 0.3) + vec2(0.37, 0.71), 3.0).r - 0.5) / 0.13 * 0.05;
      float upK = clamp(smoothstep(0.35, 0.85, l.y) * (1.0 + br), 0.0, 1.0) * (1.0 - nearL);
      vec3 iceI = mix(SKY_T, vec3(0.812, 0.890, 0.933), 0.6);
      vec3 airT = mix(SKY, iceI, upK);
      airT = mix(airT, LIGHT, nearL * 0.6);
      float airW = smoothstep(0.66, 0.84, lumS) * smoothstep(0.4, 0.55, l.y);
      // the grade moves the air, never a painted colour standing in it (the willow's green, a blossom's pink):
      // a pixel warmer or greener than the ice keeps its own colour
      airW *= 1.0 - smoothstep(0.0, 0.05, max(S.g - S.b, S.r - S.b) + 0.012);
      S.rgb = mix(S.rgb, airT, inK * airW * 0.85);
      // (and left of the text the pale sky is paper: no blue wash at the page's left edge behind a title)
      S.rgb = mix(S.rgb, PAPER, keepW * smoothstep(0.6, 0.8, lumS));
      // (a closing window on an inner page keeps the ending's quiet grey-blue: its pale air is not a cyan band)
      float nonHero = (1.0 - Kw.w) * smoothstep(1.9, 2.15, wp.x / HSW);
      S.rgb = mix(S.rgb, mix(vec3(lumS), S.rgb, 0.4), nonHero * smoothstep(0.6, 0.85, lumS)); }
    col = mix(col, S.rgb, fa);
    adm = mix(adm, S.a, fa);
    p = wp; tm = uTime; inWin = fa; wakeOK = F.z * fa; heroW = uWinK[wi].w * fa;
    wsc = M.z / max(R.w - R.y, 1e-4);              // scene units per viewport height in this window (the wake's push)
    vec4 K = uWinK[wi];
    keep = K.y * (1.0 - smoothstep(K.x - K.z, K.x + K.z, l.x));
  }
#ifdef EL_GLIMPSE
  for (int gi = 0; gi < GLN; gi++) {
    vec4 R = uGlR[gi];
    if (uGlK.x < 0.5 || R.x > R.z || uv.x < R.x || uv.x > R.z || uv.y < R.y || uv.y > R.w) continue;
    vec2 l = (uv - R.xy) / (R.zw - R.xy);           // box uv, y up
    vec4 A = uGlA[gi], Bq = uGlB2[gi], Fq = uGlF2[gi], Cq = uGlC[gi], Dq = uGlD[gi], M = uGlM[gi];
    bool endW = Fq.w < 0.0;                         // a short page's end: the closing's own box
    // (Contact's end only (GLIMPSE.at[].soft): its water feathers softly into the mist, the comb is off and its pale
    // washes melt slowly at the sides; Writing's end keeps the usual phone edges exactly)
    bool endS = endW && Dq.w > 0.5;
    float seed = abs(Fq.w);
    float bxv = uv.x * aspect;                      // screen x (viewport heights): the mist's lobes keep their size
    float pxW = Fq.z;                               // the box's width, CSS px
    bool bleedW = R.x < 0.004 && R.z > 0.996;       // (a phone's window, the screen's full width)
    // (each layer's view uv, inside its half of the buffer, half a texel off the seam)
    vec2 vb = vec2(Bq.x + l.x * Bq.y + A.z, Bq.z + l.y * Bq.w + A.x);
    vec2 vf = vec2(Bq.x + l.x * Bq.y + A.w, Bq.z + l.y * Bq.w + A.y);
    vec2 ts = uGlS[gi].xy;
    vec2 tb = vec2(clamp(vb.x, ts.x, 1.0 - ts.x), clamp(vb.y * 0.5, ts.y, 0.5 - ts.y));
    vec2 tf = vec2(clamp(vf.x, ts.x, 1.0 - ts.x), clamp(0.5 + vf.y * 0.5, 0.5 + ts.y, 1.0 - ts.y));
    vec4 S = gi == 0 ? texture(uGl0, tb) : texture(uGl1, tb);
    vec4 Fn = gi == 0 ? texture(uGl0, tf) : texture(uGl1, tf);
    float airB = smoothstep(0.8, 0.88, dot(S.rgb, vec3(0.299, 0.587, 0.114)));   // (the back's pale air, before any tint)
    vec2 wp = vec2(M.x + vb.x * M.w, M.y - (1.0 - vb.y) * M.z);
    float nb = clamp((textureLod(uNoise, vec2(bxv * 0.75 + seed + uTime * 0.0015, 0.41), 3.5).r - 0.5) / 0.13, -2.0, 2.0);
    float nc = clamp((textureLod(uNoise, vec2(bxv * 2.0 - uTime * 0.0022 + seed * 1.7, 0.77), 2.5).g - 0.5) / 0.13, -2.0, 2.0);
    // (the light veiled where the window does not keep it: a sun in every window would be a stamp)
    { float lumL = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      float sunV = lightNear(wp, 0.7) * smoothstep(0.84, 0.95, lumL) * (1.0 - Cq.y);
      S.rgb = mix(S.rgb, mix(MIST, SKY, 0.45), sunV * 0.85); }
    // (the morning: the pale air above the skyline takes the ice-blue sky, deepest high in the window and fading to the
    // mist lower down, so each window is a piece of the same morning as the strip; ink and the light keep theirs)
    // (the morning as a band of sky across the page, never a box. A phone's window is the screen's width: the wash
    // runs off both sides at full strength, so it has no side edge to read as a box; a column-wide window
    // (tablets) lets it run out over the outer fifth of each side in lobes. Upward it reaches its full blue ~20 px below
    // the painting's top and fades into the paper across the 40 px margin in broad lobes (never a level line); lower down
    // glSky pales it into the horizon's mist)
    float washK, keepK = 0.0;   // (keepK: the light, the mist bank and the sea, which keep their own white)
    { float nw = clamp((textureLod(uNoise, vec2(bxv * 1.6 + seed * 1.3, 0.11), 2.5).r - 0.5) / 0.13, -2.0, 2.0);
      float nw2 = clamp((textureLod(uNoise, vec2(bxv * 4.2 - seed * 0.6, 0.83), 1.5).g - 0.5) / 0.13, -2.0, 2.0);
      float eTp = (1.0 - l.y) * Fq.x;
      float lobT = 16.0 * clamp(0.5 + 0.35 * nw + 0.2 * nw2, 0.0, 1.0);
      float vW = smoothstep(2.0 + lobT, Fq.y + 18.0 + lobT, eTp);
      float eS = min(l.x, 1.0 - l.x) * pxW;
      // (a column-wide window: the sides run out over ~0.2 of its width in tall lobes; the lobes vary down the side, never
      // across it: a ramp whose width changed along x folded into straight vertical stripes in the sky)
      float nsW = clamp((textureLod(uNoise, vec2(seed * 0.7 + 0.13, l.y * Fq.x * 0.011 + 0.61), 1.5).g - 0.5) / 0.13, -2.0, 2.0);
      float hW = bleedW ? 1.0 : smoothstep(10.0, 10.0 + pxW * 0.2 + 30.0 * clamp(0.5 + 0.4 * nsW, 0.0, 1.0), eS);
      washK = vW * hW; }
    { float lumA = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      float airK = smoothstep(0.86, 0.93, lumA) * (1.0 - smoothstep(0.02, 0.08, max(S.g - S.b, S.r - S.b)));
      S.rgb = mix(S.rgb, mix(mix(MIST2, PAPER, 0.75), glSky(l.y, nb, nc, 0.0), washK), airK * (0.75 + 0.25 * smoothstep(0.1, 0.75, l.y + 0.04 * nb + 0.02 * nc)));

      // (the light itself, where the window keeps it: a disc of the paper's own white, ~15 CSS px across its radius, in a
      // warm-paper halo; the peaks of the back stand in front of it, the front and the sea pass over it)
      if (Cq.y > 0.0) {
        float ku = wp.x / HSW;
        vec4 Ls = lightK(floor(ku));
        float pxU = Fq.x / max(M.z * Bq.w, 1e-5);              // CSS px per scene unit in this window
        float dpx = length(vec2((ku - Ls.x) * HSW, wp.y - Ls.y)) * pxU;
        float disc = (1.0 - smoothstep(12.0, 14.5, dpx)) * Cq.y * smoothstep(0.75, 0.88, lumA);
        float halo = exp(-max(dpx - 14.0, 0.0) / 20.0) * Cq.y * airK;
        S.rgb = mix(S.rgb, mix(S.rgb, PAPER * vec3(1.0, 0.99, 0.965), 0.6), halo * 0.6);
        S.rgb = mix(S.rgb, PAPER, disc);
        keepK = max(keepK, max(disc, halo));
      } }
    // the mist between the layers (over the back, behind the front): the camera is in the cloud
    if (Dq.y > -0.5) {
      float top = Dq.y + 0.07 * nb + 0.025 * nc;
      float bank = 1.0 - smoothstep(top - 0.22, top + 0.06, l.y);
      S.rgb = mix(S.rgb, mix(MIST, PAPER, 0.3 + 0.4 * smoothstep(top - 0.55, top - 0.1, l.y)), bank * 0.8);
      S.a = mix(S.a, 0.85, bank);
      keepK = max(keepK, bank);
    }
    // (low in the window a plane's foot dissolves in fine vertical streaks (a comb under the crags): there its half-
    // covered ink is smoothed across over 5 taps, ~12 CSS px; opaque ink and figures keep their edge)
    // (never in Contact's end, where the place's figures stand low: it smears the ferryman sideways)
    if (!endS && Fn.a > 0.01 && l.y < 0.6) {
      float kd = (1.0 - smoothstep(0.35, 0.6, l.y)) * (1.0 - smoothstep(0.85, 0.98, Fn.a));
      if (kd > 0.0) {
        vec4 Fs = vec4(0.0);
        for (int t = -2; t <= 2; t++) {
          vec2 tt = vec2(clamp(tf.x + float(t) * 3.0 / max(Fq.z + 96.0, 1.0), ts.x, 1.0 - ts.x), tf.y);
          Fs += gi == 0 ? texture(uGl0, tt) : texture(uGl1, tt);
        }
        Fn = mix(Fn, Fs / 5.0, kd);
      }
    }
    // the front: the place itself; near, its ink deepens a little and loses some of its haze
    if (Fn.a > 0.0) {
      if (Cq.z > 0.0) {
        vec3 fc = Fn.rgb / max(Fn.a, 1e-3);
        float inkF = smoothstep(0.92, 0.55, dot(fc, vec3(0.299, 0.587, 0.114)));
        Fn.rgb = mix(Fn.rgb, clamp(fc * 0.86 - 0.02, 0.0, 1.0) * Fn.a, Cq.z * inkF * 0.55);
      }
      S = vec4(S.rgb * (1.0 - Fn.a) + Fn.rgb, mix(S.a, stAdm(Fn), Fn.a));
    }
    // the sea of cloud below its surface: billows in two rows, each with a faint cool wash along its lit top, a bright
    // rim and a soft shade under it; the body pale toward paper deeper down
    if (Dq.x > -0.5) {
      // (billows of ~60-120 px ride on its swell, so its surface is a cloud's, never a level line)
      float nbl = clamp((textureLod(uNoise, vec2(bxv * 4.5 + seed * 0.4 - uTime * 0.001, 0.47), 1.5).g - 0.5) / 0.13, -2.0, 2.0);
      float sy = Dq.x + 0.09 * nb + 0.035 * nc + 0.035 * nbl;
      float nd = clamp((textureLod(uNoise, vec2(bxv * 1.3 + seed * 0.7 - uTime * 0.0012, 0.29), 3.0).r - 0.5) / 0.13, -2.0, 2.0);
      float s2 = sy - 0.16 + 0.05 * nd;
      float cn = texture(uNoise, vec2(bxv * 0.42 - uTime * 0.0022, l.y * 0.9 + seed)).r;
      float tw = 0.0;
      for (int j = 0; j < 2; j++) {
        float t = l.y - (j == 0 ? sy : s2);
        tw = max(tw, smoothstep(-0.006, 0.02, t) * (1.0 - smoothstep(0.02, 0.13, t)) * (j == 0 ? 0.8 : 1.0));
      }
      float sea = 1.0 - smoothstep(sy - 0.16, sy + 0.03, l.y);
      float sea2 = 1.0 - smoothstep(s2 - 0.12, s2 + 0.02, l.y);
      vec3 body = mix(mix(MIST, SKY, 0.4 + 0.3 * cn), mix(PAPER, MIST2, 0.6), smoothstep(0.04, 0.45, sy - l.y));
      float rim = 0.0, shd = 0.0;
      for (int j = 0; j < 2; j++) {
        float t = (j == 0 ? sy : s2) - l.y;
        rim = max(rim, smoothstep(-0.004, 0.01, t) * (1.0 - smoothstep(0.012, 0.05, t)));
        shd = max(shd, smoothstep(0.03, 0.08, t) * (1.0 - smoothstep(0.08, 0.2, t)) * (j == 0 ? 0.6 : 1.0));
      }
      float litS = lightNear(wp, 0.35) * Cq.y;
      body = mix(body, vec3(0.70, 0.79, 0.86), shd * 0.5 * (1.0 - 0.4 * litS));
      body = mix(body, mix(PAPER, PAPER * vec3(1.0, 0.99, 0.965), litS), rim * (0.7 + 0.3 * litS));
      S.rgb = mix(S.rgb, vec3(0.78, 0.86, 0.90), tw * 0.42);
      S.rgb = mix(S.rgb, body, max(sea, sea2) * 0.97);
      S.a = mix(S.a, 0.8, max(sea, sea2));
      keepK = max(keepK, max(sea, sea2));
    }
    S.rgb = glGrade(S.rgb, wp, vb.y);
    // (the inner places' grade turns their pale air to the strip's horizon white, which inside a window reads as a
    // pale rectangle in the sky band: there the air takes the window's own sky again; ink, figures, the light, the mist
    // bank and the sea keep theirs)
    { float lumG = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      float airG = smoothstep(0.86, 0.93, lumG) * (1.0 - smoothstep(0.03, 0.09, max(S.g - S.b, S.r - S.b))) * (1.0 - clamp(Fn.a * 1.5, 0.0, 1.0));
      S.rgb = mix(S.rgb, glSky(l.y, nb, nc, 0.0), airG * washK * (1.0 - keepK) * 0.85); }
    // (the air runs out into the paper upward and at the sides, wherever the wash does not reach: else the scene's own
    // sky and the inner places' grade make a band of blue with a level top where the painting begins, a stripe across
    // the screen; ink, the front, the light and the sea keep theirs)
    S.rgb = mix(S.rgb, mix(MIST2, PAPER, 0.8), airB * (1.0 - washK) * (1.0 - clamp(Fn.a * 1.5, 0.0, 1.0)) * 0.9);
    // (higher up the air is a little cooler and paler: aerial depth)
    { float lumC = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      vec3 cool = mix(vec3(lumC), S.rgb, 0.8) * vec3(0.98, 0.995, 1.02);
      S.rgb = mix(S.rgb, cool, smoothstep(0.5, 1.0, Cq.x) * 0.3); }
    // the feathers, in CSS px from the box's edges: at the top and bottom (the words stand just beyond them) paper at the
    // edge, then mist in broad lobes, and the painting only from Fq.y (40 px) in, plus its lobes (inward only, so no
    // figure ever comes nearer the words); at the sides no painting within 24 px of the screen's edge, the place going
    // into the mist in tall lobes over the next ~40 px, so nothing is ever cut by the edge
    float nf = clamp((textureLod(uNoise, vec2(bxv * 3.2 + seed * 2.3, 0.63), 2.0).r - 0.5) / 0.13, -2.0, 2.0);
    float nf2 = clamp((textureLod(uNoise, vec2(bxv * 6.5 - seed, 0.19), 1.5).g - 0.5) / 0.13, -2.0, 2.0);
    float eT = (1.0 - l.y) * Fq.x, eB = l.y * Fq.x;
    float nf3 = clamp((textureLod(uNoise, vec2(bxv * 12.0 + seed * 0.3 - uTime * 0.0015, 0.53), 1.0).r - 0.5) / 0.13, -2.0, 2.0);
    float slim = max(Dq.z, 0.0);
    float mlW = max(-Dq.z, 0.0);   // (a wider left melt, where a near hill comes in from the left edge)
    // (the painting may come to 42 px of the box's edge, and its lobes only reach further in: 0-10 px, then a 10 px ramp)
    float lT = mix(10.0, 4.0, slim) * clamp(0.5 + 0.3 * nf + 0.15 * nf2 + 0.1 * nf3, 0.0, 1.0);
    float lB = mix(10.0, 4.0, slim) * clamp(0.5 + 0.35 * nf2 + 0.15 * nf, 0.0, 1.0);
    float rmp = mix(10.0, 6.0, slim);
    float sideK = 1.0;
    float mK = smoothstep(2.0, Fq.y * 0.6, eT - lT * 0.5) * smoothstep(2.0, Fq.y * 0.6, eB - lB * 0.5);   // mist and the sky's air
    // (a mid-page window's bottom ramp is 24 px, not 10, so a place's foot never ends in a hard comb of vertical
    // streaks; set per place, uGlD.w: Work's first window keeps 10; a short page's end keeps its 10 px, Contact's has its
    // own feather below)
    float pK = smoothstep(Fq.y + 2.0 + lT, Fq.y + 2.0 + lT + rmp, eT) * smoothstep(Fq.y + 2.0 + lB, Fq.y + 2.0 + lB + rmp + (endW ? 0.0 : Dq.w * (1.0 - 0.7 * slim)), eB);   // the painting
    // (Contact's end, the place's water at its foot, goes into the mist over ~60 px in broad soft lobes, never
    // cut by the fine 10 px ramp: that read as a hard, ragged streak line under the water)
    if (endS) {
      float nE = clamp((textureLod(uNoise, vec2(bxv * 0.9 + seed * 0.37, 0.71), 3.0).r - 0.5) / 0.13, -2.0, 2.0);
      float nE2 = clamp((textureLod(uNoise, vec2(bxv * 2.1 - seed * 0.21, 0.35), 2.5).g - 0.5) / 0.13, -2.0, 2.0);
      float lE = 30.0 * clamp(0.5 + 0.4 * nE + 0.15 * nE2, 0.0, 1.0);
      float bE = smoothstep(Fq.y + 2.0 + 0.3 * lE, Fq.y + 2.0 + 40.0 + lE, eB);
      pK = smoothstep(Fq.y + 2.0 + lT, Fq.y + 2.0 + lT + rmp, eT) * bE * bE * (3.0 - 2.0 * bE);
    }
    { float ns = clamp((textureLod(uNoise, vec2(seed * 0.9, l.y * Fq.x * 0.012 + 0.27), 1.5).r - 0.5) / 0.13, -2.0, 2.0);
      float lS = 22.0 * clamp(0.5 + 0.4 * ns, 0.0, 1.0);
      float eL = l.x * pxW, eR = (1.0 - l.x) * pxW;
      // (in a full-bleed window only ink and figures go into the side mist; the air, the sky's blue, runs on off the
      // screen's edge, so the band has no side edge (an inner rectangle in the sky); nothing inky is ever within 24 px)
      float lumP = dot(S.rgb, vec3(0.299, 0.587, 0.114));
      float sR = bleedW ? 44.0 : 84.0;   // (a column-wide window's sides are paper beyond it: its place melts away over longer)
      // (in Contact's end its pale washes, the water above all, melt into the side mist slowly, never a
      // lozenge of water; its dark ink (the boat, the ferryman) keeps the shorter melt, so nothing near a side is lost)
      if (endS) sR = mix(sR, bleedW ? 104.0 : 124.0, smoothstep(0.5, 0.72, lumP));
      float pS = smoothstep(24.0, max(sR, mlW) + lS, eL) * smoothstep(24.0, sR + lS, eR);
      float satP = max(S.r, max(S.g, S.b)) - min(S.r, min(S.g, S.b));
      float airP = bleedW ? smoothstep(0.79, 0.86, lumP) * (1.0 - smoothstep(0.24, 0.32, satP)) * (1.0 - clamp(Fn.a * 2.5, 0.0, 1.0)) : 0.0;   // (the front's own pale rims stay in the mist)
      pK *= mix(pS, 1.0, airP);
      sideK = smoothstep(0.0, 40.0 + lS, eL) * smoothstep(0.0, 40.0 + lS, eR); }
    // (the sky's top: the ice-blue wash fades out into the mist and the paper in lobes, as the handscroll's sky is its
    // paper; the blue keeps to the window's upper middle)
    // (the margins hold no figure, only the air: above, the same ice-blue sky running out into the paper at the box's
    // edge; below, the paper of the sea of cloud)
    vec3 mC = mix(MIST2, PAPER, 0.65 + 0.2 * nc);   // (paper with a breath of mist: the window has no box)
    mC = mix(mC, glSky(l.y, nb, nc, 0.0), (bleedW ? smoothstep(0.3, 0.56, l.y + 0.04 * nb + 0.02 * nc) : smoothstep(0.5, 0.75, l.y) * sideK) * 0.85 * (1.0 - 0.6 * slim) * washK);   // (a full-bleed window's sides carry the same sky as its middle, down to the sea: no inner rectangle)
    vec3 G = mix(mC, S.rgb, pK);
    float fa = mK * Cq.w;
    // (a short page's end lies over the closing's own painting: it covers it whole, paper at its edges)
    if (endW) { G = mix(PAPER, G, mK); fa = Cq.w; }
    col = mix(col, G, fa);
    adm = mix(adm, mix(0.6, S.a, pK), fa);
    p = wp; tm = uTime; inWin = fa; wakeOK = 0.0; heroW = 0.0; keep = 0.0;
    wsc = M.z / max(R.w - R.y, 1e-4);
    glCut = max(glCut, fa * pK);
    glSun = mix(glSun, Cq.y, fa);
    glA = max(glA, fa);
  }
#endif
  float t = tm;

  // drifting mist: two decks at different speeds, domain-warped (anchored to the world: it scrolls with its window)
  vec2 mp = p * vec2(0.26, 0.72);
  float w = texture(uNoise, mp * 0.7 + vec2(t * 0.0021, 0.0)).g;
  float m1 = texture(uNoise, mp + vec2(-t * 0.0045, 0.0) + (w - 0.5) * 0.35).r;

  // reading veil: mist banks up behind the text (feathered, noisy, never a box). Inside a strong
  // veil the paper stays solid; the mist only tears its edge. (Measured first: the wake keeps off it.)
  float veil = 0.0, clearK = 0.0;
  // (living: where the veil's edge lies, anchored to the page so it travels with the words. Mist lies in horizontal
  // banks, so the field is stretched sideways: down a column's side the edge runs out in rounded tongues of mist about
  // 100 px tall and back in between them (never a ruled vertical line, and the painting passes behind banks, not a
  // slot); along a top or bottom edge it billows gently over ~450 px; smaller billows of ~30 px ride on both. sw is
  // about -0.1..1.2 of the swell, linear in the field above a soft floor (a clamped or eased map would rest at its floor
  // and leave a ruled run there; the noise's own spread is about +-0.15, hence the gains).)
  vec2 dq = vec2(uv.x * aspect, uv.y - uLive2.x);
  float sw = 0.0, swH = 0.0;
  if (uLive.x > 1.5) {
    float sx = 0.3 + 0.85 * ((texture(uNoise, dq * vec2(0.5, 2.2) + vec2(0.31, 0.57)).r - 0.5) * 6.0
                          + (texture(uNoise, dq * vec2(1.2, 3.6) + vec2(0.13, 0.71)).g - 0.5) * 2.6);
    sw = min(1.3, -0.1 + 0.15 * log(1.0 + exp((sx + 0.1) / 0.15)));
    // (along a top or bottom edge, billows that vary along the edge every ~200 px (smaller ones of ~80 px on
    // them, the noise's finest octaves left out), so a peak under the edge dissolves upward into banks of mist instead
    // of meeting a ruler; blended in by the edge's direction)
    float sh = 0.3 + 0.85 * ((textureLod(uNoise, dq * vec2(0.9, 0.45) + vec2(0.71, 0.23), 1.5).r - 0.5) * 6.5
                          + (textureLod(uNoise, dq * vec2(1.9, 0.8) + vec2(0.47, 0.09), 1.0).g - 0.5) * 2.8);
    swH = min(1.3, -0.1 + 0.15 * log(1.0 + exp((sh + 0.1) / 0.15)));
  }
  // (over dark ink the living veil's feather runs out up to 1.9x as far, so a peak beside the text dissolves into the
  // mist over a long, gentle ramp instead of meeting a cut; pale sky keeps the tighter edge)
  float inkK = smoothstep(0.9, 0.62, dot(col, vec3(0.299, 0.587, 0.114)));
  float wideK = clamp(aspect / max(uLive2.w, 1e-6) / 1440.0, 1.0, 1.8);   // (living: the window's width over 1440 CSS px)
  for (int k = 0; k < VEILS; k++) {
    vec4 V = uVeil[k];
    if (V.x < -0.5) continue;
    vec2 vq = max(vec2(V.x - uv.x, V.y - uv.y), vec2(uv.x - V.z, uv.y - V.w));
    vq.x *= aspect;
    float vd = length(max(vq, 0.0));
    float s = uVeilS[k];
    if (uLive.x > 1.5) {
      // living ground (4b): the rect is the text's own lines; solid paper over them and 40 px around (no pigment or
      // figure comes nearer), then a torn edge of mist whose line swells in and out along the text (never a ruled edge
      // down a column of sections), and beyond it a clearing where the pale mist and the sky deck thin out toward the
      // paper (so no lane of lighter paper shows). Only the edge moves with the drift: the core never does.
      float fk = uVeilF[k];
      // (the edge's direction: 1 beside the box, 0 above or below it; the tongues turn with it)
      vec2 vp = max(vq, 0.0);
      float side = smoothstep(0.25, 0.75, vp.x / max(vp.x + vp.y, 1e-6));
      // (a wide window's longer reach (wk) is for the sides only, where a column of sections meets the margin's
      // painting; above and below a block the edge keeps its 1440 reach, so the scenery under the last table of a page is
      // not lost in a 300 px fade on a tall window)
      float ws = mix(1.0, wideK, side);
      float c = uLive.y * fk, F = min(uLive.z * ws, uVeilR) * fk;
      // the feather's middle: half a feather beyond the core, pushed out by the tongues up to 1.3 of uLive2.z and in by
      // at most 0.1 of it, so the feather always keeps its full width and the core stays solid (never squeezed)
      // (the tongues and the long ramp over ink need room: beside a narrow margin, under ~420 CSS px between the text and
      // the window's edge, they shrink to 0.35 of their reach, so a 1280 px window keeps its painting)
      // (continuous across the box's corners. Beside it, the margin on that side; above or below it, the two
      // sides' margins blended across its width plus how far the pixel stands in from the nearer side, so the factor
      // eases from the corner inward over ~150 px instead of switching at the box's edge: a switch there is a vertical
      // seam at the right edge of a 960 px block on 1280-1366 px windows)
      float inb = max(0.0, min(uv.x - V.x, V.z - uv.x));
      float room = (mix(V.x, 1.0 - V.z, smoothstep(V.x, V.z, uv.x)) + inb) * aspect / uLive2.w;
      float kr = mix(0.35, 1.0, smoothstep(240.0, 420.0, room));
      float swk = mix(swH, sw, side);
      // (beside a narrow margin, under ~360 CSS px, the feather itself tightens too, to 0.55 of its width at
      // ~250 px (a 1280 window beside a 960 block), so the margin keeps its painting: the hut's ridge and the peaks come
      // out from the mist instead of a 220 px sliver; its top and bottom edges keep their width)
      float fn = mix(1.0, mix(0.55, 1.0, smoothstep(250.0, 360.0, room)), side);
      F *= fn;
      // (solid paper to 0.8 of the core; the feather starts there at the least, never inside it)
      float B = c * 0.8 + F * 0.5 + swk * uLive2.z * ws * fk * kr * mix(0.8, 1.0, side);
      float tear = (m1 - 0.5) * F * 1.8 * smoothstep(c, c + F * 0.5, vd);   // (torn by the drifting mist, off the core)
      // (over ink the feather runs out further; above or below a block a little further still, so a summit under its edge
      // fades upward over a longer ramp)
      veil = max(veil, s * max(1.0 - smoothstep(c * 0.8 - 8.0 * uLive2.w, c * 0.8, vd), 1.0 - smoothstep(B - F * 0.5, B + F * (0.5 + mix(1.15, 0.9, side) * inkK * kr), vd + tear)));
      clearK = max(clearK, s * (1.0 - smoothstep(B - F * 0.5, B + F * 0.5 + uLive2.y * ws * fk, vd)));
      continue;
    }
    float R = uVeilR * uVeilF[k];
    float fr = R / 0.13;
    // (every page, 4b: the tear moves only the veil's edge, from a few px outside the text's box: the words' own
    // background never moves; at least 6 CSS px out, uLive2.w = viewport heights per CSS px, so a small reserve's tight
    // feather on a phone never tears inside the 2 px the eye reads as the line)
    float tear = uLive.x > 0.5 ? smoothstep(max(0.004 * fr, 6.0 * uLive2.w), max(0.024 * fr, 16.0 * uLive2.w), vd)
                               : mix(clamp((1.0 - s) / 0.28, 0.0, 1.0), 1.0, smoothstep(0.0, 0.02 * fr, vd));
    float v0 = uLive.x > 0.5 ? 3.0 * uLive2.w : 0.0;   // (4b: solid for 3 CSS px round the box, where the eye reads the line)
    veil = max(veil, s * (1.0 - smoothstep(v0, R + v0, vd + (m1 - 0.5) * 0.06 * fr * tear)));
  }

  // (a window inside a section (the Résumé's year break) is not under its section's veil: its painting keeps
  // 40 px and more off every line, and the paper margins round it stay)
  veil = min(veil, 1.0 - glCut);
  clearK = min(clearK, 1.0 - glCut);   // (...nor under the clearing round the words: its paper margins are its own)
  // the header sits on paper, never on the painted sky: a paper band under it, anchored to the page (it scrolls
  // away with the header), solid to the header's foot and melting out over ~64 px (desktops; ~26 px on phones), its
  // edge torn by the drift so it is mist, not a ruled line. The painting rises out of the paper below it.
  {
    float cssPx = 1.0 / max(uLive2.w, 1e-6);
    float pageY = ((1.0 - uv.y) + uLive2.x) * cssPx;
    float wCss = aspect * cssPx;
    float wk2 = smoothstep(520.0, 1000.0, wCss);
    float H0 = mix(56.0, 76.0, wk2), HF = mix(26.0, 64.0, wk2);
    float hv = 1.0 - smoothstep(H0, H0 + HF, pageY + (m1 - 0.5) * HF * 0.7);
    veil = max(veil, hv);
    // under the paper band the ice-blue sky comes out of the paper through cloud, not along a ruled box edge: the
    // pale sky only (the ink keeps its value) eases back to paper over ~90-220 CSS px, its line billowing in broad,
    // world-anchored lobes
    float nH = (textureLod(uNoise, p * vec2(0.35, 0.9) + vec2(0.17, 0.41), 2.0).r - 0.5) / 0.13;
    float lumH = dot(col, vec3(0.299, 0.587, 0.114));
    float skyH = smoothstep(0.03, 0.12, col.b - col.r) * smoothstep(0.7, 0.85, lumH) * inWin;
    // (its line only breathes, on a very low-frequency noise, over a long vertical feather (>= 80 CSS px), so the blue
    // below keeps its strength and the top of the window never reads as a box, nor as white cut-out cloud lobes)
    float nH2 = (textureLod(uNoise, p * vec2(1.1, 2.0) + vec2(0.71, 0.29), 1.0).g - 0.5) / 0.13;
    float lob = nH * mix(8.0, 16.0, wk2) + nH2 * 3.0;
    float hv2 = 1.0 - smoothstep(H0 + HF * 0.2, H0 + HF * 0.2 + mix(80.0, 130.0, wk2), pageY - lob);
    col = mix(col, mix(PAPER, SKY, 0.45), clamp(hv2 * skyH * 0.92, 0.0, 1.0));
  }

  // the pointer's wake: a soft, local opening around the pointer and along its recent path (capsules that close as
  // they age). Every term is a smooth sum over the whole trail, never one segment's pick (a per-pixel choice of the
  // strongest segment's drag left a straight seam through the newest trail point): the opening is the strongest
  // capsule; the mist is pushed outward from the path (it parts) and drawn a little along it (capped, so a fast
  // flick never slides the whole sky). Only inside a wake window, never on text (its veil, its keep-out); it parts
  // the mist only.
  float wk = 0.0;
  vec2 off = vec2(0.0);
  if (wakeOK > 0.0 && uv.x >= uWakeBox.x && uv.x <= uWakeBox.z && uv.y >= uWakeBox.y && uv.y <= uWakeBox.w) {
    vec2 q = vec2(uv.x * aspect, uv.y);
    float r2 = uWakeR * uWakeR;
    float gs = 0.0;
    vec2 push = vec2(0.0), drag = vec2(0.0);
    for (int k = 0; k < TRAIL - 1; k++) {
      vec4 A = uTrail[k];
      if (A.z <= 0.0) break;
      vec4 B = uTrail[k + 1];
      if (B.z <= 0.0) B = A;
      vec2 a = vec2(A.x * aspect, A.y), b = vec2(B.x * aspect, B.y);
      vec2 ab = b - a;
      float l2 = dot(ab, ab);
      float f = l2 > 1e-8 ? clamp(dot(q - a, ab) / l2, 0.0, 1.0) : 0.0;
      vec2 dq = q - a - ab * f;
      // (and each point's own disc at its own strength. The capsule alone interpolates the strength along the
      // segment, so when the pointer rests just after moving, the newest point (1.0) and the one pushed before it (by
      // then ~0.1, a few px behind) meet on a straight line through the pointer, square to the motion: the mist was
      // parted on one side of the cursor and not the other)
      vec2 da = q - a;
      float g = max(mix(A.z, B.z, f) * exp(-dot(dq, dq) / r2), A.z * exp(-dot(da, da) / r2));
      wk = max(wk, g);
      gs += g;
      push += g * dq;                                          // away from the path
      float L = sqrt(l2);
      if (L > 1e-6) drag -= g * ab * (min(L, uWakeR * 0.5) / L);   // along the motion (b is the older point)
    }
    float m = (1.0 - veil) * (1.0 - keep) * wakeOK;
    wk *= m;
    off = (push * 0.75 + drag * 0.45) / max(gs, 1.0) * m * wsc;   // screen (viewport heights) -> scene units
  }

  vec2 mq = mp;
  if (wk > 0.001) {
    // the mist is parted outward from the path and drawn a little along it (the sample comes from behind)...
    mq = mp - off * vec2(0.26, 0.72);
    w = texture(uNoise, mq * 0.7 + vec2(t * 0.0021, 0.0)).g;
    m1 = texture(uNoise, mq + vec2(-t * 0.0045, 0.0) + (w - 0.5) * 0.35).r;
  }
  float m2 = texture(uNoise, mq * 2.3 + vec2(t * 0.0080, t * 0.0007) + (m1 - 0.5) * 0.25).g;
  // ...and parted around it
  float mist = smoothstep(0.36, 0.74, m1 * 0.68 + m2 * 0.42) * (1.0 - 0.9 * wk);
  if (uLive.x > 0.0) mist *= 1.0 - smoothstep(0.05, 0.5, veil);   // (every page) the drift never reaches the paper under text
  if (clearK > 0.0) {
    // living: round the text the pale mist thins out toward the paper (ink and colour are untouched), over a wide,
    // swelling margin, so the paper under the words meets the misty sky without a step
    float lumC = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, PAPER, clearK * smoothstep(0.86, 0.925, lumC) * 0.9);
  }
  // (the drift is light: it lifts what is darker than it and never dims the light itself)
  { vec3 dm = mix(col, MIST, clamp(mist * adm * 0.56 * (1.0 - clearK) * (1.0 - 0.95 * glA), 0.0, 0.75)); col = inWin > 0.0 ? max(col, dm) : dm; }
  // over the ice-blue air of a window the drift is a visible white wisp, so the mist is seen to move (the max() above
  // can only lift ink, so in the high-key sky it would never show); never near text
  { float lumW = dot(col, vec3(0.299, 0.587, 0.114));
    float iceW = inWin * smoothstep(0.03, 0.09, col.b - col.r) * smoothstep(0.7, 0.8, lumW) * (1.0 - smoothstep(0.02, 0.3, veil)) * (1.0 - clearK) * (1.0 - 0.6 * glA);
    col = mix(col, vec3(0.972, 0.986, 0.992), clamp(smoothstep(0.25, 0.85, mist) * iceW * 0.34, 0.0, 0.34)); }
  if (seaBody > 0.0) col = mix(col, MIST2, smoothstep(0.08, 0.7, mist) * seaBody * 0.9 * (1.0 - 0.85 * clearK));
  if (uLive.w > 0.0) {
    // the sky deck (4b, every page): open sky and pale mist take a faint drifting cloud toward MIST2, gently
    // perceptible; never on ink, never near text (it thins out over the living veils' clearing)
    float lumS = dot(col, vec3(0.299, 0.587, 0.114));
    float skyK = inWin * smoothstep(0.928, 0.940, lumS) * (1.0 - smoothstep(0.952, 0.975, lumS)) * (1.0 - smoothstep(0.02, 0.4, veil)) * (1.0 - clearK);   // (never over the light)
    col = mix(col, MIST2, mist * skyK * uLive.w);
  }
  if (wk > 0.001) {
    // where the mist parted the painting reads truer: the haze over the ink lifts (darker ink), and
    // the bare paper clears a breath brighter. Never below 80% of the ink's own value.
    float a = min(0.22 * wk, 0.3);
    vec3 clear = (col - MIST * a) / (1.0 - a);
    col = max(clear, col * 0.8);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col += vec3(0.017, 0.018, 0.018) * min(wk, 1.2) * smoothstep(0.86, 0.93, lum);
  }

#ifdef EL_SILK_VEIL
  // The page change as a mist dissolve (never a refractive silk sheet, which reads as a game-menu wipe): a drift of mist travels across the hero with the pan, from the side the new place comes in from. Its body
  // is an fbm threshold that opens round the travelling front (patches of mist gather, then dissolve behind it), mixed
  // toward the mist's own colour, never toward paper white. No edge line, no refraction, no highlight. Inside the
  // page's own hero window only (heroW: never the closing window, the paper round it, or the words' column), the
  // existing envelope (index.ts updateSweep, 340 ms). A long jump does not bleach through paper: the outgoing frame
  // is held and dissolved into the incoming one at the very end of this pass (uHold); only the words' column fades
  // under paper.
  if (uSweep.z > 0.0) {
    float dir = uSweep.y < 0.0 ? -1.0 : 1.0;
    float hw = abs(uSweep.y);
    float th = uSweep.w;
    float sd = uSweepSeed;
    float sideK = uSweepK > 0.0 ? smoothstep(uSweepK + 0.004, uSweepK + 0.05, uv.x) : 1.0;
    col = mix(col, PAPER, clamp(th * (1.0 - sideK) * uSweep.z * 0.94, 0.0, 1.0));
    float d = (uv.x - uSweep.x) * aspect * dir;                     // across the front (vh; > 0 behind it)
    vec2 q = vec2(uv.x * aspect, uv.y) * vec2(1.1, 1.5) + vec2(sd, sd * 0.37) + vec2(uTime * 0.004, 0.0);
    float n = textureLod(uNoise, q * 0.55, 0.0).r * 0.65 + textureLod(uNoise, q * 1.3 + 0.31, 0.0).g * 0.35;
    float bell = exp(-d * d / (hw * hw * 0.9));                      // where the drift stands now
    float cov = smoothstep(0.62, 0.38, n + 0.42 * (1.0 - bell)) * bell;
    float m = heroW * sideK * uSweep.z;
    col = mix(col, mix(MIST, MIST2, 0.35 + 0.25 * (1.0 - uv.y)), clamp(cov * m * 0.88, 0.0, 0.9));
  }
#else
  // the pale mist bank of a page change: billows of reserved paper with mist between them, travelling
  // with the pan. Thick (a long jump), it covers the whole view. Never darker than MIST2.
  if (uSweep.z > 0.0) {
    float dx = (uv.x - uSweep.x) * aspect;
    float bw = exp(-dx * dx / (uSweep.y * uSweep.y));
    float b = mix(bw, 1.0, uSweep.w);
    float th = uSweep.w;
    vec2 bq = vec2(dx * mix(0.85, 0.5, th) + uSweepSeed, uv.y * mix(0.8, 0.55, th) - uTime * 0.003);
    float wq = textureLod(uNoise, bq * vec2(1.3, 1.6) + vec2(0.31, 0.17), 0.0).g;
    float n = textureLod(uNoise, bq + vec2(0.7, 1.0) * (wq - 0.5) * 0.35, 0.0).r;
    float c = smoothstep(mix(0.42, 0.34, th), mix(0.62, 0.72, th), n + 0.12 * bw + 0.1 * th * (uv.y - 0.4));
    vec3 bank = mix(mix(PAPER, MIST2, mix(0.55, 0.3 + 0.12 * (1.0 - uv.y), th)), PAPER, c);
    col = mix(col, bank, clamp(b * uSweep.z * mix(0.5 + 0.45 * c, 0.94 + 0.05 * c, th), 0.0, 0.98));
  }

#endif
#ifdef EL_AIR
  // two or three of the plum's petals (capped) carried off by the scroll's wind (index.ts airStep): Home's
  // hero only, never within the veils' reach of the text (none within 40 px of a line), never in the keep-out
  if (uAir.x > 0.0 && heroW > 0.0 && uAirP[0].w + uAirP[1].w + uAirP[2].w > 0.0) {
    float pk = heroW * (1.0 - smoothstep(0.0, 0.03, veil)) * (1.0 - keep) * (1.0 - clearK);
    for (int i = 0; i < 3; i++) {
      vec4 A = uAirP[i];
      if (A.w <= 0.0 || pk <= 0.0) continue;
      vec4 Q = uAirQ[i];
      vec2 d = uv - A.xy;
      d.x *= aspect;
      float r0 = Q.x * aspect;
      if (dot(d, d) > r0 * r0 * 2.0) continue;
      vec4 pe = lifePetal(d, r0, A.z, Q.y, Q.z);
      if (Q.w > 0.5) pe.rgb = mix(pe.rgb, mix(vec3(0.99, 0.985, 0.99), vec3(0.90, 0.92, 0.95), 0.4 * (1.0 - Q.y)), 0.8);
      col = mix(col, pe.rgb, clamp(pe.a * A.w * pk * 0.95, 0.0, 1.0));
    }
  }
#endif
  col = mix(col, PAPER, veil);

  // paper: faint mottling, fine tooth and fibres (in CSS px, unrolling with the pan)
  vec2 gp = (gl_FragCoord.xy * uPx + vec2(uPanPx, 0.0)) / (${NOISE_SIZE}.0 * uGrainPx);
  float tooth = texture(uNoise, gp).b - 0.5;
  float mott = texture(uNoise, gp * 0.09).r - 0.5;
  // a coarse buffer averages the grain away (mipmaps); give a little of it back
  float bpt = uPx / uGrainPx;   // grain texels per buffer pixel
  float gk = 1.0 + 0.2 * smoothstep(0.8, 1.35, bpt) - 0.35 * smoothstep(1.6, 2.4, bpt);   // ...unless it is very coarse
  // (the light is nearly clean of grain, so it reads luminous, not as a noise filter)
  float gq = mix(1.0, 0.4, smoothstep(0.93, 0.98, dot(col, vec3(0.299, 0.587, 0.114))) * inWin * (1.0 - veil));
  col *= 1.0 + tooth * 0.55 * uGrain * gk * gq + mott * 0.010 * gq;   // a finer, quieter sheet under flat colour
  vec3 paperG = PAPER * (1.0 + tooth * 0.55 * uGrain * gk + mott * 0.010);   // (the paper here, with its grain)
  // ONE graphic gesture (after qingxiao 2m08 / 1m08), at Home's light only: a translucent silk
  // mist-ribbon, one long S from behind the host peak through the light. Its body a ~12 % cyan-white veil with soft
  // edges that twists (its width swells and pinches), a brighter 1-2 px core along it, broken by the mist and
  // drifting slowly along its length; painted only over the pale air and mist (so it passes BEHIND the ink of the
  // peaks), never under text, never on another page.
  p.y += dyB;   // (from here on, the light and the ribbon are the back's: they stay with the sky as the layers part)
  float pxp = max(abs(dFdy(p.y)), 1e-5);
  // (suspended while a page change crosses the view, so it is never drawn over a painting that is fading)
  if (heroW > 0.0 && tm > 0.0 && uSweep.z <= 0.0) {
    // a twisting strip. Two selvedges y = c +- W cos(ph) that cross where the silk turns
    // edge-on (the twist travels slowly along it); between them a translucent body, pale cyan where its face is toward
    // us, a deeper jade-cyan where we see its back. Never a vector point at its ends: the breadth
    // holds and each end frays into three strands of its own length, torn by alpha noise over its last 20 %; the
    // selvedges are 0.6 px hairs at <= 0.45, broken by gaps; the white heart shows only where the face turns up to the
    // light; never over a sprite (the plum's white blossoms, the swallow: their alpha dilated ~2 px). Passes BEHIND the
    // ink (laid only over pale air and mist). Never under text, Home only.
    float u = p.x / HSW;
    vec4 L0 = lightK0(0.0);
    float sx = (u - L0.x) * HSW;
    float s = (sx - 0.05) / 0.47;                   // -1 .. 1: from behind the host peak (left) to under the plum (right)
    if (abs(s) < 1.0 && u < 1.3) {
      float as = abs(s);
      float s0 = -0.05 / 0.47;                        // (where it crosses the light)
      float yc = L0.y + 0.042 * sin((s - s0) * 2.6 + 0.15) - 0.115 * (s - s0) * (s - s0) + 0.006 * sin(s * 5.0 - uTime * 0.16);
      float ph = s * 5.4 + 0.5 - uTime * 0.085;       // the twist, travelling along the silk
#ifdef EL_AIR
      // the scroll's wind bows the silk (most in its middle) and runs its twist along it; both settle
      yc += uAir2.y * (1.0 - s * s) * (0.8 + 0.2 * sin(s * 3.0 + 1.0));
      ph -= uAir.z * 1.5;
#endif
      float cph = cos(ph);
      float taper = pow(clamp(1.0 - s * s, 0.0, 1.0), 0.55);
      float W = 0.019 * mix(0.55, 1.0, taper) * (0.75 + 0.25 * sin(s * 2.3 + 1.1));   // (never down to a point)
      float cy = yc + 0.3 * W * sin(ph);              // (the turning strip's centre wanders a little: it is not a pipe)
      float e1 = cy + W * cph, e2 = cy - W * cph;
      float lo = min(e1, e2), hi = max(e1, e2);
      float aa = 0.9 * pxp;
      float inB = smoothstep(lo - aa, lo + aa, p.y) * (1.0 - smoothstep(hi - aa, hi + aa, p.y));
      float frontF = smoothstep(-0.15, 0.15, cph);   // 1: its face toward us, 0: its back
      // the frayed ends: over the last 20 % the silk opens into three strands that splay apart (across its full breadth,
      // whatever its twist), each ending at its own length and torn by alpha noise: a frayed end, never a point
      // (and wherever the silk fades out for any other reason: the window's feather, the words' clearing: there too it
      // frays rather than thinning to a point)
      float fadeV = heroW * (1.0 - clearK) * (1.0 - smoothstep(0.02, 0.3, veil));
      float frE = max(smoothstep(0.78, 1.0, as), 1.0 - smoothstep(0.3, 0.97, fadeV));
      float strK = 0.0;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float hk = hash12(vec2(fk + 0.5, s > 0.0 ? 3.7 : 9.1));
        float off = (fk - 1.0) * W * (0.45 + 0.9 * frE) + 0.3 * W * sin(s * 11.0 + fk * 2.1) * frE;
        float sw = max(W * (0.26 - 0.1 * frE), 0.9 * pxp);
        float sd = exp(-pow((p.y - cy - off) / sw, 2.0));
        float aN = texture(uNoise, vec2(s * 2.3 + fk * 0.31, 0.57 + fk * 0.17)).g;
        float endS = 0.88 + 0.11 * hk;
        float endK = 1.0 - smoothstep(endS - 0.07, endS, as + 0.05 * (aN - 0.5));
        strK = max(strK, sd * endK * smoothstep(0.34, 0.52, aN));
      }
      float dOut = max(max(lo - p.y, p.y - hi), 0.0);
      float halo = exp(-dOut / 0.011) * (0.55 + 0.45 * smoothstep(0.0, 0.6, abs(cph)));
      // torn by the mist (drifting)
      float airS = 0.0;
#ifdef EL_AIR
      airS = uAir.z * 0.3;   // (the tears in the silk travel with the scroll too)
#endif
      float brk = smoothstep(0.22, 0.55, texture(uNoise, vec2(sx * 0.5 - uTime * 0.018 - airS, 0.37)).r * 0.7 + texture(uNoise, vec2(sx * 1.6 - uTime * 0.03 - airS * 1.6, 0.81)).g * 0.45);
      brk = mix(0.18, 1.0, brk);
      float lumR = dot(col, vec3(0.299, 0.587, 0.114));
      float behind = smoothstep(0.8, 0.9, lumR);   // (only over the air and the mist: it passes behind every mountain)
      float rk = heroW * behind * (1.0 - smoothstep(0.02, 0.3, veil)) * (1.0 - clearK) * (1.0 - lifeBD);
      // the morning: the silk comes after the light: it unfurls from behind the peak toward the plum (1.0 - 2.2 s)
      if (uMorn < 8.0) { float uf = clamp((uMorn - 1.0) / 1.2, 0.0, 1.0); uf = 1.0 - (1.0 - uf) * (1.0 - uf);
        rk *= smoothstep(mix(-1.3, 1.25, uf), mix(-1.3, 1.25, uf) - 0.35, s) * smoothstep(0.0, 0.35, uf); }
      float bodyK = brk * mix(inB, strK, frE);
      float lineK = brk * (1.0 - frE);
      col = mix(col, vec3(0.985, 0.995, 1.0), clamp(halo * 0.3 * brk * rk * (1.0 - 0.6 * frE), 0.0, 1.0));   // the clearing of light round it
      // the body: pale cyan silk on its face, a deeper jade-cyan on its back; its white heart only where the face turns
      // up toward the light (the twist's phase), so the white is light on silk, not a core line
      float vb = clamp(abs(p.y - 0.5 * (lo + hi)) / max(0.5 * (hi - lo), 1e-4), 0.0, 1.0);
      float turnL = smoothstep(0.15, 0.85, sin(ph)) * frontF;
      vec3 faceC = mix(vec3(0.86, 0.955, 0.965), vec3(0.62, 0.88, 0.89), vb * vb);
      faceC = mix(faceC, vec3(0.985, 1.0, 1.0), turnL * (1.0 - vb * vb));
      vec3 backC = mix(vec3(0.70, 0.90, 0.90), vec3(0.45, 0.76, 0.78), vb);
      float dens = mix(0.42, 0.62, 1.0 - abs(cph));
      col = mix(col, mix(backC, faceC, frontF), clamp(bodyK * dens * rk, 0.0, 1.0));
      // the selvedges: 0.6 px hairs, at most 0.45, each broken by its own gaps (~20 % of its length), heavier where the
      // silk folds; the light beside them only where the face turns to the light
      float l1 = exp(-pow((p.y - e1) / (0.6 * pxp), 2.0)), l2 = exp(-pow((p.y - e2) / (0.6 * pxp), 2.0));
      float g1 = exp(-pow((p.y - e1) / (2.2 * pxp), 2.0)), g2 = exp(-pow((p.y - e2) / (2.2 * pxp), 2.0));
      float gp1 = smoothstep(0.405, 0.435, texture(uNoise, vec2(s * 1.3 + 0.21, 0.29)).g);
      float gp2 = smoothstep(0.405, 0.435, texture(uNoise, vec2(s * 1.3 + 0.67, 0.71)).g);
      float lw = mix(0.2, 0.45, 1.0 - abs(cph)) * (0.75 + 0.25 * sin(s * 13.0 + 0.7));
      col = mix(col, vec3(1.0), clamp((g1 * gp1 + g2 * gp2) * 0.3 * turnL * lineK * rk, 0.0, 1.0));
      col = mix(col, vec3(0.25, 0.60, 0.66), clamp(max(l1 * gp1, l2 * gp2) * lw * lineK * rk, 0.0, 1.0));
      // a fine companion thread that weaves round the silk, coming out of and going back into the mist (no ends)
      float yt = cy + 0.024 * sin(s * 3.3 + 2.1 - uTime * 0.05) * taper + 0.004 * sin(s * 9.0 + uTime * 0.11);
      float tk = smoothstep(-0.75, -0.4, s) * (1.0 - smoothstep(0.55, 0.9, s)) * (0.55 + 0.45 * sin(s * 6.0 + 1.3));
      tk *= smoothstep(0.38, 0.5, texture(uNoise, vec2(s * 1.1 + 0.43, 0.12)).g);
      float thr = exp(-pow((p.y - yt) / (0.6 * pxp), 2.0)), thg = exp(-pow((p.y - yt) / (2.6 * pxp), 2.0));
      col = mix(col, vec3(1.0), clamp(thg * 0.25 * tk * brk * rk, 0.0, 1.0));
      col = mix(col, vec3(0.36, 0.70, 0.74), clamp(thr * 0.4 * tk * brk * rk, 0.0, 1.0));
    }
  }
  // the light's bloom, added after the grain, inside the painting only and never under the
  // text: a tight halo and a wide soft glow round each place's light (Home's the strongest), breathing slowly; it wraps
  // what stands in front of the light (thinner over dark ink), so the sun reads as a source, not a haze
  vec3 cB = col;
  if (inWin > 0.0) {
    float bk = inWin * (1.0 - smoothstep(0.02, 0.3, veil)) * (1.0 - 0.7 * clearK) * glSun;
    float u = p.x / HSW, kk = floor(u), add = 0.0, wa = 0.0;
    for (int j = -1; j <= 1; j++) {
      vec4 Lj = lightK(kk + float(j));
      vec2 q = vec2((u - Lj.x) * HSW, p.y - Lj.y);
      float r = length(q) / max(Lj.z, 1e-3);
      float br = 1.0 + 0.08 * sin(uTime * 0.45 + float(j) * 1.7);
      float mb = (uMorn < 8.0 && homeL(Lj)) ? smoothstep(0.85, 2.1, uMorn) : 1.0;   // (the morning: the bloom rises last)
      add += (exp(-r * r * 3.2) * 0.075 + exp(-r * 1.5) * 0.04) * abs(Lj.w) * (homeL(Lj) ? 1.0 : 0.5) * br * mb;
      wa += exp(-r * r * 0.45) * min(abs(Lj.w) * 1.4, 1.0) * mb;
    }
    float lumB = dot(col, vec3(0.299, 0.587, 0.114));
#ifdef EL_AIR
    // one curve of light (a swell and a warmth): as the camera rises and as you read on the bloom grows and
    // warms a little, the pale air round the light with it; a glow only, never the paper (masked off the veils, bk)
    // (the swell widens the glow in the pale air only; it fades out before the core's own brightness, so the core never
    // grows brighter than it is at rest)
    vec3 addA = add * bk * mix(0.3, 1.0, smoothstep(0.35, 0.85, lumB)) * mix(vec3(0.975, 0.995, 1.0), vec3(1.0, 0.965, 0.9), uAir3.y);
    col += addA;
    col += addA * uAir3.x * (1.0 - smoothstep(0.86, 0.95, dot(col, vec3(0.299, 0.587, 0.114))));
    col = mix(col, vec3(1.0, 0.975, 0.935), clamp(wa * uAir3.y * 0.22 * bk * smoothstep(0.72, 0.93, lumB), 0.0, 0.14));
#else
    col += add * bk * mix(0.3, 1.0, smoothstep(0.35, 0.85, lumB)) * vec3(0.975, 0.995, 1.0);
#endif
  }

  // inside a window into the painting nothing is lighter than the paper round it, channel by channel (never a bleached
  // hole); the light's bloom there is warm paper, never added white
  if (glA > 0.0) {
    float bl = clamp(dot(max(col - cB, 0.0), vec3(0.333)) * 7.0, 0.0, 1.0);
    vec3 cw = mix(cB, paperG * vec3(1.0, 0.992, 0.968), bl);
    col = mix(col, min(cw, paperG), glA);
  }
  // dither to kill banding in the long mist gradients
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
#ifdef EL_SILK_VEIL
  // a long jump's cross-dissolve: the last frame before the splice (uPrev, grabbed by gl.ts) dissolves
  // into the new place through an fbm threshold as uHold falls 1 -> 0, with a breath of mist where the two meet
  if (uHold > 0.0) {
    vec3 pc = texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0).rgb;
    vec2 q = vec2(uv.x * aspect, uv.y) * 1.4 + vec2(uSweepSeed, 0.0);
    float n = textureLod(uNoise, q * 0.5, 0.0).r * 0.7 + textureLod(uNoise, q * 1.4 + 0.5, 0.0).g * 0.3;
    float nn = clamp((n - 0.5) / 0.32 + 0.5, 0.0, 1.0);
    float r = uHold * 1.3 - 0.15;
    float hk = 1.0 - smoothstep(r - 0.12, r + 0.12, nn);
    float edge = hk * (1.0 - hk) * 4.0;
    col = mix(col, pc, hk);
    col = mix(col, MIST, edge * 0.35 * (1.0 - veil));
  }
#endif
  outColor = vec4(col, 1.0);
}`;
