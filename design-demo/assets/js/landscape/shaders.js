// shaders.js — GLSL for the WebGL2 landscape (gl.js).
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

import { LAYERS } from './compose.js';
import { ROWS } from './ridges.js';

export const VEILS = 8;   // reading-veil rects painted at once
export const TRAIL = 8;   // points of the pointer's wake (the newest is the pointer itself)

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
const vec3 PAPER = vec3(0.937, 0.945, 0.933);   // #EFF1EE cool rice paper
const vec3 SKY   = vec3(0.945, 0.953, 0.949);   // a breath lighter and cooler, high in the sky
const vec3 MIST  = vec3(0.914, 0.929, 0.925);   // cool mist
const vec3 INK_N = vec3(0.063, 0.075, 0.082);   // burnt ink
const vec3 INK_F = vec3(0.243, 0.337, 0.392);   // indigo wash #3E5664
const vec3 AZ_D  = vec3(0.173, 0.361, 0.541);   // azurite, deep #2C5C8A
const vec3 AZ_M  = vec3(0.498, 0.624, 0.722);   // azurite, misted #7F9FB8
const vec3 MA_D  = vec3(0.227, 0.502, 0.416);   // malachite, deep #3A806A
const vec3 MA_M  = vec3(0.553, 0.710, 0.643);   // malachite, misted #8DB5A4`;

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
                             // row L+3: terraces, still mirror
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
const vec3 STROKE = vec3(0.360, 0.430, 0.475);  // the long low strokes on the water

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
void figOver(inout vec3 col, inout float mm, vec4 F, float k) {
  F *= k;
  col = col * (1.0 - F.a) + F.rgb;
  mm = mix(mm, 0.3, F.a);   // the drifting mist passes over the figures, thinly
}

void main() {
  // x: across the view (the ridge columns); y: scene height (viewport heights from the scene's bottom)
  vec2 uv = vec2(vUv.x, uView.y - (1.0 - vUv.y) * uView.z);
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
  vec4 scn4 = texture(uRidges, vec2(uv.x, rowV(L + 3)));   // terraces, still mirror
  float terr = scn4.r * (1.0 - uHzK), mirror = scn4.g;
  // pigment: never under the text (zero inside the keep-out, full again 2 ramps right of its edge), never in the horizon
  float keepPig = 1.0 - uKeep.y * (1.0 - smoothstep(uKeep.x, uKeep.x + uKeep.z * 2.0, vUv.x));
  float pigK = scn3.b * keepPig * (1.0 - uHzK);
  float lean = scn3.a;
  float keepFig = 1.0 - uKeep.y * (1.0 - smoothstep(uKeep.w, uKeep.w + uKeep.z * 0.45, vUv.x));
  // on the river the town's back rows dissolve into the mist under the hills, and low banks of mist drift across it
  float figMist = 1.0;
  if (wS > 0.0 && shoreK < 0.99) {
    float hb = uv.y - wY;   // height above the far bank
    float n1 = T(vec2(p.x * 0.28, hb * 9.0 + 0.3)), n2 = T2(vec2(p.x * 0.61 + 0.2, hb * 14.0));
    float back = smoothstep(0.034, 0.058, hb + (n1 - 0.5) * 0.022) * (0.55 + 0.5 * n1);
    float drift = smoothstep(0.5, 0.72, n1 * 0.75 + n2 * 0.35) * smoothstep(0.012, 0.03, hb) * (1.0 - smoothstep(0.05, 0.064, hb)) * 0.85;
    figMist = 1.0 - clamp(max(back * 0.92, drift), 0.0, 1.0) * wS * (1.0 - shoreK);
  }
  if (uNote.z > uNote.x) {
    vec2 nq = max(vec2(uNote.x - vUv.x, uNote.y - vUv.y), vec2(vUv.x - uNote.z, vUv.y - uNote.w));
    float noteK = smoothstep(0.0, 0.03, max(nq.x, nq.y));
    keepFig *= noteK;
    pigK *= noteK;
    keepPig *= noteK;
  }
  // the far shore's reflection, gathered plane by plane as the shore is painted: the colour the still water
  // mirrors here (reflC) and how much of the shore lies in the mirror here (reflA)
  vec3 reflC = MIST;
  float reflA = 0.0;

  // static cloud banks, anchored to the world; the present pass sets mist drifting over them
  float sm = smoothstep(0.30, 0.74, T(p * vec2(0.23, 0.62) + vec2(0.0, lift * 0.35)) * 0.7 + T2(p * vec2(0.61, 1.7) + 0.37) * 0.42);

  vec3 col = PAPER;
  col = mix(col, SKY, smoothstep(0.45, 1.0, uv.y) * 0.6);
  float mm = 0.18;   // drifting-mist admittance (alpha out)

  // cloud belts that lie between the planes, never over the nearest crests
  float b1y = uLayer[1].x + 0.17 - lift * 0.45 - uHzK * uHz[1].x + (T(vec2(p.x * 0.31, 0.3)) - 0.5) * 0.09;
  float b2y = uLayer[3].x + 0.15 - lift * 0.8 - uHzK * uHz[3].x + (T(vec2(p.x * 0.27, 0.7)) - 0.5) * 0.08;
  float belt1 = exp(-pow((uv.y - b1y) / 0.05, 2.0));
  float belt2 = exp(-pow((uv.y - b2y) / 0.05, 2.0));
  // on the river the hills stand behind the town: their cloud belts lie thinner, so the hills keep their colour
  float river = wS * (1.0 - shoreK);
  belt1 *= 1.0 - 0.7 * river;
  belt2 *= 1.0 - 0.7 * river;

  // Front-to-back pre-pass (height lookups only): at rest, planes hidden behind a nearer plane
  // that fully covers this pixel are skipped, which keeps the dense lower screen cheap.
  int first = 0;
  if (settled && wS <= 0.0) {   // (over water every plane counts: the near ones are only their ink there)
    for (int i = L - 1; i > 0; i--) {
      float fi = float(i);
      float h0 = texture(uRidges, vec2(uv.x, rowV(i))).r;
      float h = mix(h0, h0 * uHz[i].w, uHzK) - lay(fi / float(L - 1)) * lift - uHzK * uHz[i].x;
      if (h - uv.y > 0.03) { first = i; break; }
    }
  }

  for (int i = first; i < L; i++) {
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
    else if (wS > 0.0 && i >= 3) footY += 0.1 * wS;   // a near plane over water: only its headlands show, melting into it
    if (riverW > 0.0) { footY = mix(footY, max(footY, wY + 0.06), riverW); fade = mix(fade, max(fade, 0.085), riverW); }
    // over open water nothing stands before the far shore: its wash is fuller and flatter; a near plane
    // standing in open water is only a pale headland, so its crest never draws a line across the water
    float inkK = Lp.z * inkT * mix(1.0, uHz[i].z, uHzK) * (1.0 + 0.5 * openW) * (i >= 3 ? 1.0 - 0.55 * wS : 1.0);
    float bodyW = mix(0.30, 0.16, dep) * (1.0 + 0.8 * openW);
    vec3 ridge = texture(uRidges, vec2(uv.x, rowV(i))).rgb;
    ridge = mix(ridge, ridge * uHz[i].w, uHzK);       // the horizon flattens the ranges (level distance)
    float h = ridge.r - ly;
    float y = uv.y;
    float d = h - y;                                  // > 0 inside the mountain
    // ink bloom: far planes are painted first, each one over ~0.85 s (all done by ~1.25 s)
    float pr = settled ? 1.0 : clamp((uArrive - fi * 0.1) / 0.85, 0.0, 1.0);

    if (d > -0.03 && pr > 0.0) {
      // ink wicking into paper: a soft, slightly fuzzy edge (isotropic, never hair-like spikes)
      float soft = mix(0.011, 0.0026, dep) * (1.0 - 0.45 * openW);   // across the water a shore stands crisper
      float fib = gnoise(p * vec2(70.0, 55.0) + fi * 7.3) * 0.6 + gnoise(p * vec2(22.0, 14.0) - fi) * 0.4;
      float inside = smoothstep(-soft, soft, d + fib * soft * 0.8);

      float dd = max(d, 0.0);
      vec2 lp = vec2(p.x, uv.y + ly);                // layer space (moves with the plane)
      // contour: darkest at the crest, broken by dry-brush streaks that run along the stroke
      float rimW = mix(0.012, 0.0068, dep);
      float dry = gnoise(vec2(lp.x * 9.0 + fi * 3.1, dd * 150.0 + fi)) * 0.65 + gnoise(vec2(lp.x * 28.0, dd * 380.0)) * 0.35;
      float rim = exp(-dd / rimW) * smoothstep(-0.5, 0.2, dry) * bone;   // boneless scenes: no contour
      // wash body: nearly flat silhouettes far away, strong gradation up close; pigment pools
      float pool = 0.75 + 0.25 * fbm3(lp * vec2(2.4, 4.0) + fi * 2.7);
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
      float streak = gnoise(vec2(lp.x * 26.0 + gnoise(lp * 3.0) * 2.0, lp.y * 4.0) + fi * 5.0);
      // hemp-fibre strokes: broken parallel lines running down the fall line of each face
      float u = (lp.x + dd * slope * 0.55) * 52.0 + gnoise(lp * vec2(5.0, 9.0) + fi) * 1.3;
      float hemp = smoothstep(0.66, 0.96, 1.0 - abs(fract(u) * 2.0 - 1.0));
      hemp *= smoothstep(-0.05, 0.5, gnoise(vec2(floor(u) * 1.7 + fi, dd * 16.0)));
      hemp *= smoothstep(0.004, 0.02, dd) * exp(-dd / 0.10) * cun;

      float densB = body * mix(0.62, 0.84, dep);
      float dens = rim * 0.85 * dep * dep + densB;   // far planes: wash only
      dens += shade * mix(0.10, 0.36, dep) * exp(-dd / 0.045) * bone;   // a short accent under the crest
      dens += cun * crease * (0.6 + 0.6 * max(shade, 0.0));
      dens += hemp * (0.22 + 0.3 * max(shade, 0.0));
      // terraced fields (the Résumé's shore): bands that follow the hill's form (depth below its broad crest), each a
      // dark, dry lip of earth with a paler wet field above it that holds the light (and the malachite); none on the
      // far range, none on the rounded crown, fading into the foot's mist
      float paddy = 0.0;
      if (terr > 0.001 && i >= 2) {
        float tstep = mix(0.017, 0.0105, dep);
        float tq = db / tstep + (T2(lp * vec2(1.7, 0.6) + fi * 0.31) - 0.5) * 0.7;
        float fr = fract(tq);
        float lip = smoothstep(0.74, 0.9, fr) * (1.0 - smoothstep(0.93, 1.0, fr));
        lip *= smoothstep(-0.45, 0.25, gnoise(vec2(lp.x * 38.0 + fi * 5.0, floor(tq) * 3.1)));
        float tk = terr * smoothstep(0.006, 0.024, db);
        paddy = tk * smoothstep(0.08, 0.3, fr) * (1.0 - smoothstep(0.52, 0.72, fr));
        dens += tk * lip * mix(0.28, 0.5, dep);
        dens -= paddy * densB * 0.3;
      }
      float bodyFrac = densB / max(dens, 1e-4);      // how much of the ink is the wash (the colour carries part of it)
      dens *= mix(1.0, 0.72 + 0.28 * smoothstep(-0.7, 0.3, streak), cun);
      // pigment granulation: dense ink settles into the paper unevenly
      dens *= 1.0 + gnoise(p * 150.0 + fi * 17.0) * 0.2 * smoothstep(0.12, 0.6, dens);

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
      float fY = footY + (T(vec2(p.x * 0.42 + fi * 0.27, 0.11 * fi)) - 0.5) * 0.09 * (1.0 - 0.6 * shoreW);
      float foot = smoothstep(fY, fY + fade, y + (sm - 0.5) * 0.06);
      dens = clamp(dens * foot * inkK, 0.0, 1.0);

      vec3 ink = mix(INK_F, INK_N, pow(dep, 0.8));
      ink = mix(ink, MIST, (1.0 - dep) * 0.35);      // atmospheric perspective: far = pale, blue
      vec3 fill;
      if (pigK > 0.001) {
        // misted blue-green (qinglu): the ink keeps its bones (contour, creases, texture strokes) and lightens its
        // wash, a mineral wash carries the mass (azurite toward the crest, malachite down the slope, by height
        // above the plane's foot), then the bones show through again. Far planes take the misted pigments, near
        // planes approach the deep ones; the colour dissolves into the foot's mist exactly as the ink does.
        float kp = pigK / 0.75;
        float dB = dens * clamp(bodyFrac, 0.0, 1.0), dI = dens - dB;
        fill = mix(MIST, ink, clamp(dI + dB * (1.0 - 0.55 * kp), 0.0, 1.0));
        float hh = clamp(dd / (bodyW * 1.5), 0.0, 1.0);             // 0 at the crest .. 1 where the wash has faded
        // (the rich palette takes the deeper grades and lifts the mist off them; misted is unchanged up to 0.6 of rich)
        float richK = smoothstep(0.6, 1.0, kp);
        float deepK = clamp(smoothstep(0.15, 1.0, dep) * 0.85 * (1.0 + 0.4 * richK) + 0.16 * richK, 0.0, 1.0);
        // where azurite gives way to malachite; a malachite-led scene (the terraces, lean > .6) is malachite to the crest
        float tr = 0.42 - 0.3 * lean - 0.5 * smoothstep(0.6, 0.9, lean);
        vec3 pig = mix(mix(AZ_M, AZ_D, deepK), mix(MA_M, MA_D, deepK), smoothstep(tr - 0.2, tr + 0.2, hh + (pool - 0.875) * 0.7));
        pig = mix(pig, MIST, (1.0 - dep) * 0.34 * (1.0 - 0.45 * richK));
        float a = clamp(pigK * (0.5 + 0.8 * body + 0.9 * paddy) * foot * inkK * wet * 1.25, 0.0, 1.0);
        fill = mix(fill, pig, a * 0.9);
        fill = mix(fill, ink, clamp(dI * 0.5 * kp, 0.0, 1.0));
      } else fill = mix(MIST, ink, dens);
      if (i >= 3 && wS > 0.0) fill = mix(fill, mix(col, ink, dens), wS);   // over open water a near plane is only its ink
      float cov = inside * halo;
      col = mix(col, fill, cov);
      mm = mix(mm, mix(0.6, 0.1, dep) * (1.0 - dens), cov);
    }
    // a figure layer that stands on this plane, before its mist band (it softens the feet); it inks in with its plane
    float prF = settled ? 1.0 : clamp((uArrive - fi * 0.1 - 0.35) / 0.6, 0.0, 1.0);
    if (uFigKA.x > 0.0 && abs(uFigKA.y - fi) < 0.5 && uFigKA.z < 0.5) figOver(col, mm, figAt(uFigA, uFigRA, wu), uFigKA.x * keepFig * prF);
    if (uFigKB.x > 0.0 && abs(uFigKB.y - fi) < 0.5 && uFigKB.z < 0.5) figOver(col, mm, figAt(uFigB, uFigRB, wu), uFigKB.x * keepFig * prF);

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

    // mist band drifting between this plane and the next
    float bY = footY + (T(vec2(p.x * 0.42 + fi * 0.27, 0.11 * fi)) - 0.5) * 0.09;   // the band's top billows
    float band = 1.0 - smoothstep(bY - 0.05, bY + fade * 1.5, uv.y);
    band *= smoothstep(bY - 0.30, bY - 0.02, uv.y) * 0.5 + 0.5;
    // the near planes' mist keeps off open water; the far shore's lies thinner on it, so its hills read
    float bandK = i >= 3 ? 1.0 - 0.75 * wS : 1.0 - 0.7 * openW;
    bandK *= 1.0 - 0.6 * riverW;    // the river's hills: a thinner band at their misty feet
    col = mix(col, MIST, clamp(band * (0.3 + 0.7 * sm) * 0.8 * bandK, 0.0, 1.0));
    mm = max(mm, band * 0.9 * (i >= 3 ? 1.0 : bandK));
    // (the mist is there from the first frame; the ink blooms into it)
    if (i == 2) { float b1 = belt1 * (1.0 - 0.6 * openW); col = mix(col, SKY, clamp(b1 * sm * 0.8, 0.0, 1.0)); mm = max(mm, b1); }
    if (i == 3) { col = mix(col, SKY, clamp(belt2 * sm * 0.85 * bandK, 0.0, 1.0)); mm = max(mm, belt2); }

    // water, in front of the far shore and behind the near planes: reserved paper, the far shore's
    // reflection broken by long horizontal tears, a few long low strokes; the waterline melts into mist
    if (i == 2 && wS > 0.0) {
      float below = wY - y;
      // the banks: land along the waterline, before the water
      float bk = scn2.b > 0.0 ? shoreBanks(p, -below) * scn2.b * pr : 0.0;
      col = mix(col, mix(INK_F, MIST, 0.2), bk * 0.22 * inkT);
      float cover = wS * smoothstep(-0.008, 0.034, below);
      if (nearY > -1.0) cover *= smoothstep(nearY - 0.008, nearY + 0.005, y);   // a river: its near bank is land
      if (cover > 0.0) {
        // the water is reserved paper; near the far shore mist lies on it, thinning towards the viewer,
        // so the shore's misty foot runs on into the water without a line
        vec3 water = mix(mix(PAPER, SKY, 0.4), MIST, 0.3 * exp(-below / 0.035));
        float rn = gnoise(vec2(p.x * 1.6, below * 74.0) + vec2(3.1, 0.0)) * 0.6 + gnoise(vec2(p.x * 4.6, below * 150.0)) * 0.4;
        float gap = smoothstep(0.34 - below * 0.6, 0.56 - below * 0.6, rn);   // a few long tears, wider further out
        // the mirror image: at most a third of its source's ink, torn by the ripples, fading further out; on still water
        // (the lake: mirror) it is whole: up to 0.6 of the source, barely torn, holding its strength
        float rcap = mix(0.34, 0.6, mirror);
        float rk = rcap * min(scn2.g, 1.0) * reflA * (1.0 - mix(0.7, 0.15, mirror) * gap) * mix(mix(0.75, 1.0, exp(-below / 0.2)), 1.0, mirror);
        water = mix(water, reflC, clamp(rk, 0.0, rcap));
        // the crossing's water takes a pale indigo (azurite toned with indigo), a little deeper toward the viewer, and
        // its ripples are drawn in indigo; never under the text, never in the horizon
        float ind = clamp(scn2.a * scn3.b * keepPig * (1.0 - uHzK), 0.0, 1.0);
        vec3 IND = mix(AZ_M, INK_F, 0.38);
        float st = waterStrokes(p, below) * scn2.r;
        water = mix(water, mix(STROKE, mix(INK_F, AZ_D, 0.35), ind), st * mix(0.5, 0.32, smoothstep(0.05, 0.3, below)) * pr);
        water = mix(water, mix(MIST, IND, 0.72), clamp(ind * (0.62 + 0.38 * smoothstep(0.0, 0.22, below)) * 1.2, 0.0, 0.66));
        col = mix(col, water, cover);
        mm = mix(mm, 0.36, cover);
      }
      // the waterline dissolves into a soft, pale bank of mist: reserved paper between the shore and its
      // mirror image, never a ruled line (grey mist here would read as one)
      float wl = exp(-pow((y - wY - 0.003) / 0.024, 2.0)) * wS;
      col = mix(col, mix(PAPER, SKY, 0.5), wl * 0.5);
      mm = max(mm, wl * 0.35);
      if (nearY > -1.0) {   // ...and the river's near bank into a thinner one
        float wn = exp(-pow((y - nearY) / 0.012, 2.0)) * wS;
        col = mix(col, mix(PAPER, SKY, 0.5), wn * 0.35);
      }
    }
    // a figure layer that stands in front of this plane's mist (and on the water)
    if (uFigKA.x > 0.0 && abs(uFigKA.y - fi) < 0.5 && uFigKA.z > 0.5) figOver(col, mm, figAt(uFigA, uFigRA, wu), uFigKA.x * keepFig * prF * figMist);
    if (uFigKB.x > 0.0 && abs(uFigKB.y - fi) < 0.5 && uFigKB.z > 0.5) figOver(col, mm, figAt(uFigB, uFigRB, wu), uFigKB.x * keepFig * prF * figMist);
  }

  // the keep-out: the scene is recomposed by mist where the text stands, opaque up to 140 px left of the text's right
  // edge and clear 140 px right of it, over the window's full height, its edge broken like mist (never a gradient line)
  if (uKeep.y > 0.0) {
    float nz = (T2(vec2(uv.y * 2.3 + 0.17, p.x * 0.31)) - 0.5) * 2.0 + (T(vec2(uv.y * 6.1, p.x * 0.9 + 0.4)) - 0.5);
    float kr = uKeep.y * (1.0 - smoothstep(uKeep.x - uKeep.z, uKeep.x + uKeep.z, vUv.x + nz * uKeep.z * 0.45));
    col = mix(col, mix(MIST, SKY, 0.45), kr);
    mm = mix(mm, 0.5, kr);
  }

  outColor = vec4(col, clamp(mm, 0.0, 1.0));
}`;

export const PRESENT = `#version 300 es
precision highp float;
#define VEILS ${VEILS}
#define TRAIL ${TRAIL}
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
uniform float uWakeR;        // the wake's radius, viewport heights (a local opening: ~110 CSS px, index.js wakeR())
uniform vec4  uSweep;        // the pale bank of a page change: centre (uv x), half-width (vh), strength, thickness
uniform float uSweepSeed;    // the bank's own billows
uniform float uPx;           // CSS px per canvas px
uniform float uPanPx;        // the pan, in CSS px (paper grain unrolls with the scroll)
uniform float uGrain;
uniform float uGrainPx;      // CSS px per grain texel (1, finer on dense phone screens)

${COLORS}
const vec3 MIST2 = vec3(0.835, 0.863, 0.851);   // #D5DCD9: a mist bank never gets darker than this
const float REST_T = 40.0;                      // the horizon's mist: at rest
${HASH}

void main() {
  vec2 uv = vUv;
  float aspect = uAspect;

  // 1. what lies under this pixel: paper, the horizon band, a window on top (box-anchored, so it moves 1:1 with
  // the page). p = the world point (for the mist), tm = its mist clock, adm = how much drifting mist may lie here.
  vec3 col = PAPER;
  float adm = 0.0, inWin = 0.0, wakeOK = 0.0, keep = 0.0, tm = REST_T, wsc = 1.0;
  vec2 p = vec2(uHzM.x + uv.x * uHzM.w, uv.y);
  if (uHzK > 0.0) {
    vec4 Hs = texture(uHzTex, min(uv * uHzS.xy, uHzS.zw));
    // round 3's soft edges: into paper at the sides and a low mist along the bottom
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
    vec4 S = wi == 0 ? texture(uWin0, min(l * uWinS[0].xy, uWinS[0].zw)) : texture(uWin1, min(l * uWinS[1].xy, uWinS[1].zw));
    vec4 M = uWinM[wi], F = uWinF[wi];
    vec2 wp = vec2(M.x + l.x * M.w, M.y - (1.0 - l.y) * M.z);
    // feathers: the window comes out of the paper at its top and goes back into it at its bottom, the edge broken
    // by the mist field (in world space, so it travels with the painting); its sides run off the screen
    float n = texture(uNoise, wp * vec2(0.9, 2.2) + 0.31).r - 0.5;
    float fa = smoothstep(0.0, F.x, 1.0 - l.y + n * F.x * 0.7) * smoothstep(0.0, F.y, l.y + n * F.y * 0.7);
    fa *= F.w;
    col = mix(col, S.rgb, fa);
    adm = mix(adm, S.a, fa);
    p = wp; tm = uTime; inWin = fa; wakeOK = F.z * fa;
    wsc = M.z / max(R.w - R.y, 1e-4);              // scene units per viewport height in this window (the wake's push)
    vec4 K = uWinK[wi];
    keep = K.y * (1.0 - smoothstep(K.x - K.z, K.x + K.z, l.x));
  }
  float t = tm;

  // drifting mist: two decks at different speeds, domain-warped (anchored to the world: it scrolls with its window)
  vec2 mp = p * vec2(0.26, 0.72);
  float w = texture(uNoise, mp * 0.7 + vec2(t * 0.0021, 0.0)).g;
  float m1 = texture(uNoise, mp + vec2(-t * 0.0045, 0.0) + (w - 0.5) * 0.35).r;

  // reading veil: mist banks up behind the text (feathered, noisy, never a box). Inside a strong
  // veil the paper stays solid; the mist only tears its edge. (Measured first: the wake keeps off it.)
  float veil = 0.0;
  for (int k = 0; k < VEILS; k++) {
    vec4 V = uVeil[k];
    if (V.x < -0.5) continue;
    vec2 vq = max(vec2(V.x - uv.x, V.y - uv.y), vec2(uv.x - V.z, uv.y - V.w));
    vq.x *= aspect;
    float vd = length(max(vq, 0.0));
    float s = uVeilS[k];
    float R = uVeilR * uVeilF[k];
    float fr = R / 0.13;
    float tear = mix(clamp((1.0 - s) / 0.28, 0.0, 1.0), 1.0, smoothstep(0.0, 0.02 * fr, vd));
    veil = max(veil, s * (1.0 - smoothstep(0.0, R, vd + (m1 - 0.5) * 0.06 * fr * tear)));
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
      float g = mix(A.z, B.z, f) * exp(-dot(dq, dq) / r2);
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
  col = mix(col, MIST, clamp(mist * adm * 0.6, 0.0, 0.8));
  if (wk > 0.001) {
    // where the mist parted the painting reads truer: the haze over the ink lifts (darker ink), and
    // the bare paper clears a breath brighter. Never below 80% of the ink's own value.
    float a = min(0.22 * wk, 0.3);
    vec3 clear = (col - MIST * a) / (1.0 - a);
    col = max(clear, col * 0.8);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col += vec3(0.017, 0.018, 0.018) * min(wk, 1.2) * smoothstep(0.86, 0.93, lum);
  }

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

  col = mix(col, PAPER, veil);

  // paper: faint mottling, fine tooth and fibres, a few long fibres (in CSS px, unrolling with the pan)
  vec2 gp = (gl_FragCoord.xy * uPx + vec2(uPanPx, 0.0)) / (${NOISE_SIZE}.0 * uGrainPx);
  float tooth = texture(uNoise, gp).b - 0.5;
  float longF = (texture(uNoise, gp * 0.71 + 0.31).a - 0.5) * 0.75 * clamp(1.6 - 0.5 * uPx / uGrainPx, 0.4, 1.0);   // on a coarse buffer a long fibre reads as a scratch
  float mott = texture(uNoise, gp * 0.09).r - 0.5;
  // a coarse buffer averages the grain away (mipmaps); give a little of it back
  float bpt = uPx / uGrainPx;   // grain texels per buffer pixel
  float gk = 1.0 + 0.2 * smoothstep(0.8, 1.35, bpt) - 0.35 * smoothstep(1.6, 2.4, bpt);   // ...unless it is very coarse
  col *= 1.0 + (tooth + longF * 0.7) * uGrain * gk + mott * 0.016;

  // dither to kill banding in the long mist gradients
  col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
