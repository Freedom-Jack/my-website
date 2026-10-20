// strip.ts — a tiny static thumbnail of the whole handscroll, for the footer's scroll map (SPEC-R3 §8.6).
// DOM-free and deterministic: the same world ridges and scene rows the painting is built from
// (compose.ts / ridges.ts), sampled once at a fixed level composition, in three planes of silhouettes
// (far: planes 0-1, middle: plane 2, near: planes 3-4). Over the lake and the crossing the far shore stands
// on its waterline and the water is open paper with a waterline drawn in. Equal width per stretch.

import { spec, resolve } from './compose';
import { buildRidges, SCENE_ROW } from './ridges';

const PER = 40;           // samples per stretch
const Y0 = 0.1;           // the strip's bottom edge, viewport heights above the painting's bottom...
const SPAN_Y = 0.62;      // ...and how much of the painting's height it shows (top: 0.72)
const TOL = 0.22;         // simplification tolerance, strip units

type Pt = [x: number, y: number];

/**
 * @param {{from?:number, to?:number, width?:number, height?:number}} [o]
 *   from/to: the world span (stretches; 0..6 = home to contact, six equal columns); width/height: viewBox.
 * @returns {string} inline SVG markup (preserveAspectRatio="none", aria-hidden): three pale ink washes, each a
 *   gradient (ids sm-wash-0..2) of --strip-ink at the crest opacities --strip-far, --strip-mid, --strip-near,
 *   dissolving toward the foot; the water lines in --strip-water. Fallbacks for each. Same string on every call.
 */
export function stripSVG({ from = 0, to = 6, width = 600, height = 36 }: { from?: number; to?: number; width?: number; height?: number } = {}): string {
  from = Number.isFinite(+from) ? +from : 0;
  to = Number.isFinite(+to) && +to > from ? +to : from + 6;
  width = Math.max(1, +width || 600);
  height = Math.max(1, +height || 36);
  const span = to - from;
  const n = Math.max(8, Math.round(PER * span));
  const P = resolve(spec('level', 1), 1.6);
  const buf = buildRidges(n, { left: from, wvis: span, aspect: 1.6 * span, pigment: 0 }, P);
  const X = (c: number) => ((c + 0.5) / n) * width;
  const Y = (h: number) => height * (1 - (h - Y0) / SPAN_Y);
  const at = (row: number, c: number) => buf[(row * n + c) * 4];
  const water = (c: number) => at(SCENE_ROW, c);
  const wline = (c: number) => Y(buf[(SCENE_ROW * n + c) * 4 + 1]);

  const groups = [[0, 1], [2], [3, 4]];
  // Pale ink washes, not flat silhouettes: each plane is one wash of the strip's ink (--strip-ink), densest at its
  // crests and dissolving toward its foot (a vertical gradient over the plane's own box), never solid. The far plane
  // is the palest; nearer planes a little denser, as in the painting (--strip-far/-mid/-near are their opacities at
  // the crest). Where they overlap the washes deepen, as layered washes do.
  const tops = ['var(--strip-far, .26)', 'var(--strip-mid, .36)', 'var(--strip-near, .46)'];
  const feet = [0.03, 0.05, 0.07];
  const defs = tops.map((a, g) => `<linearGradient id="sm-wash-${g}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" style="stop-color:var(--strip-ink, #2A3034);stop-opacity:${a}"/>`
    + `<stop offset=".55" style="stop-color:var(--strip-ink, #2A3034);stop-opacity:calc(${a} * .72)"/>`
    + `<stop offset="1" style="stop-color:var(--strip-ink, #2A3034);stop-opacity:${feet[g]}"/></linearGradient>`);
  const fills = [0, 1, 2].map((g) => `url(#sm-wash-${g})`);
  const paths = groups.map((planes, g) => {
    const top: Pt[] = [];
    const bottom: Pt[] = [];
    for (let c = 0; c < n; c++) {
      let h = -Infinity;
      for (const l of planes) h = Math.max(h, at(l, c));
      const ws = g < 2 ? water(c) : 0;   // the far shore ends at the water; the near planes stand in front
      let yb = height;
      let yt = Y(h);
      if (ws > 0) {
        yb = height + (wline(c) - height) * ws;
        yt = Math.min(yt, yb);
        if (yb - yt < 1.6 * (height / 36)) yt = yb;   // no slivers of a plane lying along the waterline
      }
      top.push([X(c), Math.min(height, yt)]);
      bottom.push([X(c), yb]);
    }
    top.unshift([0, top[0][1]]);
    top.push([width, top[top.length - 1][1]]);
    bottom.unshift([0, bottom[0][1]]);
    bottom.push([width, bottom[bottom.length - 1][1]]);
    const pts = simplify(top, TOL).concat(simplify(bottom, TOL).reverse());
    return `<path style="fill:${fills[g]}" d="M${pts.map(fmt).join('L')}Z"/>`;
  });

  // the water: a waterline where the water is open, and a shorter, fainter ripple line under it
  const lines = [];
  for (const [dy, inset, op] of [[0, 0, 1], [height * 0.11, 0.18, 0.6]]) {
    let run: [number, number] | null = null;
    for (let c = 0; c <= n; c++) {
      const on = c < n && water(c) > 0.6;
      if (on && !run) run = [c, c];
      else if (on) run![1] = c;
      else if (run) {
        const len = run[1] - run[0];
        const a = run[0] + Math.round(len * inset), b = run[1] - Math.round(len * inset * 1.4);
        if (b > a) {
          const y = (wline(a) + wline(b)) / 2 + dy;
          lines.push(`<path vector-effect="non-scaling-stroke" style="stroke:var(--strip-water, #B9C2C4);opacity:${op}" d="M${fmt([X(a), y])}L${fmt([X(b), y])}"/>`);
        }
        run = null;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<defs>${defs.join('')}</defs>`
    + paths.join('')
    + (lines.length ? `<g fill="none" stroke-width="1" stroke-linecap="round">${lines.join('')}</g>` : '')
    + '</svg>';
}

const r1 = (v: number) => {
  const s = (Math.round(v * 10) / 10).toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
};
const fmt = ([x, y]: Pt) => `${r1(x)} ${r1(y)}`;

// Douglas-Peucker on a polyline
function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let best = -1, dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
      if (d > dmax) { dmax = d; best = i; }
    }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

