/**
 * Torn edges of mist (round 6): the two mask tiles the page's own layers end on.
 *
 * Mist never ends on a ruled line. The engine's screen pass tore the veils' and the curtain's edges with its noise;
 * now that they are the page's own layers (plates.css) they are masked with these tiles instead: an edge that swells
 * in and out in rounded tongues (about 100 px each, smaller billows riding on them) and breaks into a few patches of
 * mist. Drawn once on small canvases, on the main thread (a few ms), and handed to CSS as images, one per side a
 * layer can end on (each repeats along its length, EDGE_L; EDGE_W across):
 *   --edge-l   clear at its left, solid at its right (a layer's left end: the curtain)
 *   --edge-r   solid at its left, clear at its right (a veil's side toward the painting)
 *   --edge-t   clear at its top, solid at its foot;   --edge-b   solid at its top, clear at its foot
 * Seeded: the same edges on every load.
 */
export const EDGE_W = 220; // CSS px across a torn edge (clear to solid)
export const EDGE_L = 1536; // CSS px along it before it repeats

const smooth = (t: number) => t * t * (3 - 2 * t);
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Periodic value noise along one axis: `n` knots over the period, smooth between them, -0.5..0.5. */
function noise1(n: number, seed: number) {
  const R = rng(seed);
  const k = Array.from({ length: n }, () => R() - 0.5);
  return (t: number) => {
    const x = (((t % 1) + 1) % 1) * n;
    const i = Math.floor(x);
    const f = smooth(x - i);
    return k[i % n] * (1 - f) + k[(i + 1) % n] * f;
  };
}
/** Periodic value noise in two axes (periodic along v only), -0.5..0.5. */
function noise2(nu: number, nv: number, seed: number) {
  const R = rng(seed);
  const k = Array.from({ length: (nu + 1) * nv }, () => R() - 0.5);
  const at = (i: number, j: number) => k[Math.min(nu, i) * nv + (j % nv)];
  return (u: number, v: number) => {
    const x = Math.min(0.9999, Math.max(0, u)) * nu;
    const y = (((v % 1) + 1) % 1) * nv;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = smooth(x - i);
    const fy = smooth(y - j);
    return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
  };
}

/** The edge's coverage at `a` across it (0 its clear side .. 1 its solid side) and `l` along it (0..1, periodic). */
function coverage(calm = false) {
  const tongues = noise1(14, 11); // ~110 px each
  const billows = noise1(46, 23); // ~33 px
  const swell = noise1(4, 37); // one slow swell down the length
  const patches = noise2(5, 34, 53); // ~45 px patches of mist
  return (a: number, l: number) => {
    // where the edge's middle lies across the tile: near its solid side, pushed out toward the clear side by the
    // tongues (as the engine's veils were: about 60 px past the solid paper, up to ~150 in a tongue); then a ramp of
    // about 65 px, torn by the patches
    // (calm: the curtain's edge only billows, about 37 px either way: a tongue there would let the place it hides show)
    const t = Math.min(1, Math.max(0, 0.27 + 2.3 * tongues(l) + 0.6 * billows(l) + 0.5 * swell(l)));
    const mid = calm ? 0.72 + 0.34 * tongues(l) + 0.1 * billows(l) : 0.9 - 0.52 * t;
    const d = (a - mid) / (calm ? 0.3 : 0.24) + 0.5 + (calm ? 0.42 : 0.28) * patches(a, l);
    return smooth(Math.min(1, Math.max(0, d))) * smooth(Math.min(1, a / 0.08));
  };
}

function tile(w: number, h: number, alpha: (x: number, y: number) => number): Promise<string> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  if (!x) return Promise.resolve('');
  const img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      img.data[o + 3] = Math.round(255 * alpha((i + 0.5) / w, (j + 0.5) / h));
    }
  }
  x.putImageData(img, 0, 0);
  return new Promise((resolve) => c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/png'));
}

/** Draw the tiles and name them on <html> (--edge-l, --edge-r, --edge-t, --edge-b). Returns their undo. */
export function mountEdges(): () => void {
  const html = document.documentElement;
  const cov = coverage();
  const calm = coverage(true);
  const S = 0.5; // the tiles are soft: half the CSS size is plenty
  const across = Math.round(EDGE_W * S);
  const along = Math.round(EDGE_L * S);
  const urls: string[] = [];
  let dead = false;
  void Promise.all([
    tile(across, along, (u, v) => calm(u, v)),
    tile(across, along, (u, v) => cov(1 - u, v + 0.29)),
    tile(along, across, (u, v) => cov(v, u + 0.61)),
    tile(along, across, (u, v) => cov(1 - v, u + 0.37)),
  ]).then((made) => {
    urls.push(...made);
    if (dead) {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
      return;
    }
    ['l', 'r', 't', 'b'].forEach((side, i) => {
      if (made[i]) html.style.setProperty(`--edge-${side}`, `url("${made[i]}")`);
    });
  });
  return () => {
    dead = true;
    for (const side of ['l', 'r', 't', 'b']) html.style.removeProperty(`--edge-${side}`);
    urls.forEach((u) => u && URL.revokeObjectURL(u));
  };
}
