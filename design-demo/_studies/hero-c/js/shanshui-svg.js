/**
 * shanshui-svg.js — seeded, layered SVG ink-mountain background (no WebGL).
 *
 *   import { mountShanshui } from './shanshui-svg.js';
 *   const ss = mountShanshui(document.querySelector('.shanshui'), { seed: 1207 });
 *   // ss.render()  re-generate for the current size   ss.destroy()  clean up
 *
 * `ridgeLayers(seed, W, H)` is a pure function that returns path data only, so in
 * the Next.js build it can run on the server and ship the landscape as plain SVG
 * markup with zero client JS. The browser then only adds CSS (mist, parallax).
 *
 * Look: 7 ridge planes. Far planes are pale indigo washes with soft edges; near
 * planes are darker ink with fibrous displaced edges, a dry-brush crest line and
 * mottled pigment. Every plane dissolves downward into mist (a ridge-relative
 * fade done in the filter), so mountain feet never show. Filters rasterise once;
 * parallax afterwards is a compositor-only transform.
 */

const NS = 'http://www.w3.org/2000/svg';

/* ---------- seeded randomness + 1D noise ---------- */
export function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gradientNoise1D(rand) {
  const N = 512;
  const g = new Float32Array(N);
  for (let i = 0; i < N; i++) g[i] = rand() * 2 - 1;
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const a = g[i & (N - 1)] * f;
    const b = g[(i + 1) & (N - 1)] * (f - 1);
    const u = f * f * f * (f * (f * 6 - 15) + 10);
    return (a + (b - a) * u) * 2; // roughly [-1, 1]
  };
}

const fbm = (n, x, oct = 4) => {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let k = 0; k < oct; k++) {
    s += a * n(x * f + k * 17.31);
    norm += a; a *= 0.5; f *= 2.03; // lacunarity off 2.0 avoids grid artefacts
  }
  return s / norm;
};

/** Musgrave ridged multifractal, 1D. Returns ~[0, 1]; sharp crests, rounded valleys. */
const ridged = (n, x, oct = 5) => {
  let s = 0, a = 0.5, f = 1, w = 1, norm = 0;
  for (let k = 0; k < oct; k++) {
    let r = 1 - Math.abs(n(x * f + k * 31.7));
    r *= r; r *= w;
    w = Math.min(1, Math.max(0, r * 2));
    s += r * a; norm += a; a *= 0.5; f *= 2.03;
  }
  return s / norm;
};

/* ---------- composition: "level distance" ----------
 * One host peak (right) with guest peaks around it, a foreground diagonal from the
 * bottom-left, a misty valley in the middle, and the upper-left left as empty paper
 * for the name (liu bai).
 * base: the plane's floor (fraction of H). peaks: [centre (of W), half-width (of Wref), height (of H)].
 */
const PLANES = [
  { base: 0.545, detail: 0.009, wl: 240, peaks: [[0.06, 0.2, 0.03], [0.34, 0.2, 0.04], [0.6, 0.12, 0.1], [0.73, 0.1, 0.17], [0.93, 0.13, 0.12]] },
  { base: 0.59, detail: 0.011, wl: 210, peaks: [[0.18, 0.2, 0.035], [0.52, 0.13, 0.07], [0.67, 0.08, 0.15], [0.99, 0.12, 0.15]] },
  { base: 0.665, detail: 0.014, wl: 180, peaks: [[0.4, 0.16, 0.03], [0.69, 0.07, 0.19], [0.8, 0.105, 0.39], [0.93, 0.08, 0.22]] },
  { base: 0.73, detail: 0.017, wl: 160, peaks: [[0.07, 0.13, 0.05], [0.56, 0.11, 0.09], [0.88, 0.12, 0.17]] },
  { base: 0.82, detail: 0.017, wl: 160, peaks: [[0.3, 0.14, 0.04], [0.62, 0.1, 0.12], [1.01, 0.1, 0.13]] },
  { base: 0.94, detail: 0.017, wl: 170, peaks: [[0.02, 0.14, 0.17], [0.22, 0.1, 0.07], [0.5, 0.16, 0.02], [0.84, 0.12, 0.2]] },
  { base: 1.06, detail: 0.018, wl: 160, peaks: [[0.1, 0.15, 0.17], [0.7, 0.16, 0.1], [0.99, 0.12, 0.3]] },
];

/**
 * Pure generator. Returns [{ d, depth }] from far (0) to near (1).
 * @param {number} seed
 * @param {number} W  width in CSS px
 * @param {number} H  height in CSS px
 */
export function ridgeLayers(seed, W, H) {
  const rand = mulberry32(seed);
  const portrait = H / W > 1.15;
  const Wref = Math.max(W, H * 1.2);
  const step = W > 900 ? 4 : 3;
  const pad = 40;
  return PLANES.map((p, i) => {
    const n = gradientNoise1D(rand);
    const depth = i / (PLANES.length - 1);
    // On tall phone screens push the land down so the stacked name keeps clean paper.
    const base = (p.base + (portrait ? 0.07 + depth * 0.015 : 0)) * H;
    const peaks = p.peaks.map(([c, hw, h]) => [
      (c + (rand() - 0.5) * 0.03) * W,
      hw * Wref * (0.92 + rand() * 0.16),
      h * H * (0.9 + rand() * 0.2) * (portrait ? 0.8 : 1),
    ]);
    const warpAmp = 30 + depth * 50;
    const sharp = 1.45 + depth * 0.25; // < 2: cusp-like summits with concave flanks
    const pts = [];
    for (let x = -pad; x <= W + pad; x += step) {
      const xw = x + warpAmp * fbm(n, x / 560 + 9.1, 3); // domain warp: brushed, not fractal
      let mass = 0;
      for (const [cx, hw, h] of peaks) {
        const u = Math.abs((xw - cx) / hw);
        mass += h * Math.exp(-Math.pow(u, sharp) * 2.4);
      }
      // shoulders and sub-peaks scale with the mountain they sit on; valleys stay calm
      const shoulders = fbm(n, xw / (110 + 60 * depth) + 4.4, 4);
      const crest = ridged(n, xw / p.wl + 5.7, 5);
      const roll = fbm(n, x / 980 + 1.7, 2);
      const rough = p.detail * H * (0.55 + Math.min(1.6, mass / (0.12 * H)));
      const y = base - mass * (0.86 + 0.28 * shoulders) - rough * (crest * 1.7 - 0.45) - roll * 0.012 * H;
      pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    const d = `M${pts.join('L')}L${W + pad} ${H + pad}L${-pad} ${H + pad}Z`;
    return { d, depth };
  });
}

/* ---------- per-plane ink filter ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return '#' + pa.map((v, k) => Math.round(lerp(v, pb[k], t)).toString(16).padStart(2, '0')).join('');
};

/**
 * Alpha is built in steps, then flooded with one ink colour:
 * wet contour (blur + low-frequency displacement) → crest-to-mist fade (shape minus a
 * lowered, vertically blurred copy) → pigment pooling (large noise) and granulation
 * (fine noise) → a wet-edge line where pigment dried at the crest → on near planes, an
 * intermittent dry-brush contour that thickens and breaks along the ridge.
 */
function planeFilter(id, t, i, W, H) {
  const color = mixHex('#6a8290', '#14191c', Math.pow(t, 1.1));
  const load = lerp(0.2, 0.86, Math.pow(t, 1.2)); // pigment load
  const wet = lerp(2.2, 0.5, t); // softness of the contour
  const edge = lerp(5, 11, t); // contour wobble
  const drop = lerp(6, 30, t); // crest band before the fade starts
  const fall = lerp(44, 62, t); // length of the fade into mist
  const pool = lerp(0.2, 0.42, t); // pigment pooling strength
  const s = 3 + i * 7;
  const pk = (pool * 2.2).toFixed(3);
  const pb = (1 - pool * 1.35).toFixed(3);
  const rimA = lerp(0.22, 0.55, Math.pow(t, 0.8));
  const contour = t > 0.55;
  return `
<filter id="${id}" filterUnits="userSpaceOnUse" x="-80" y="-40" width="${W + 160}" height="${H + 80}" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${wet.toFixed(2)}" result="soft"/>
  <feTurbulence type="fractalNoise" baseFrequency="${lerp(0.007, 0.012, t).toFixed(4)} ${lerp(0.016, 0.03, t).toFixed(4)}" numOctaves="3" seed="${s}" result="n"/>
  <feDisplacementMap in="soft" in2="n" scale="${edge.toFixed(1)}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
  <feTurbulence type="fractalNoise" baseFrequency="${lerp(0.004, 0.006, t).toFixed(4)} 0.012" numOctaves="3" seed="${s + 1}" result="p"/>
  <feOffset in="shape" dy="${drop.toFixed(0)}" result="lo"/>
  <feTurbulence type="fractalNoise" baseFrequency="${lerp(0.0035, 0.005, t).toFixed(4)} 0" numOctaves="2" seed="${s + 8}" result="mx"/>
  <feColorMatrix in="mx" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  1 0 0 0 0" result="pv"/>
  <feDisplacementMap in="lo" in2="pv" scale="${lerp(80, 120, t).toFixed(0)}" xChannelSelector="R" yChannelSelector="A" result="lod"/>
  <feGaussianBlur in="lod" stdDeviation="0 ${fall.toFixed(0)}" result="lob"/>
  <feComposite in="shape" in2="lob" operator="out" result="wash"/>
  <feColorMatrix in="p" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${pk} 0 0 0 ${pb}" result="pool"/>
  <feComposite in="wash" in2="pool" operator="in" result="pooled"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="${s + 4}" result="g"/>
  <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0 0 0 0.62" result="gran"/>
  <feComposite in="pooled" in2="gran" operator="in" result="grained"/>
  <feComponentTransfer in="grained" result="bodyA0"><feFuncA type="linear" slope="${load.toFixed(3)}"/></feComponentTransfer>
  <feMerge result="bodyA"><feMergeNode in="bodyA0"/></feMerge>
  <feOffset in="shape" dy="${lerp(2.5, 4, t).toFixed(1)}" result="wo"/>
  <feComposite in="shape" in2="wo" operator="out" result="wet0"/>
  <feGaussianBlur in="wet0" stdDeviation="${lerp(1.4, 0.8, t).toFixed(2)}" result="wet1"/>
  <feColorMatrix in="mx" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2 0 0 0 -0.45" result="press"/>
  <feComposite in="wet1" in2="press" operator="in" result="wet2"/>
  <feComponentTransfer in="wet2" result="wetA"><feFuncA type="linear" slope="${(rimA * load * 1.9).toFixed(3)}"/></feComponentTransfer>
  ${contour ? `
  <feComponentTransfer in="shape" result="hard"><feFuncA type="table" tableValues="0 0 1 1"/></feComponentTransfer>
  <feOffset in="hard" dy="${lerp(3.5, 5.5, t).toFixed(1)}" result="ro"/>
  <feComposite in="hard" in2="ro" operator="out" result="rim0"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.3" numOctaves="2" seed="${s + 2}" result="st"/>
  <feColorMatrix in="st" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 0 0 0 -0.7  " result="stm"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.0055 0.002" numOctaves="2" seed="${s + 5}" result="run"/>
  <feColorMatrix in="run" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5 0 0 0 -2.1" result="runs"/>
  <feComposite in="rim0" in2="stm" operator="in" result="rim1"/>
  <feComposite in="rim1" in2="runs" operator="in" result="rim2"/>
  <feGaussianBlur in="rim2" stdDeviation="0.55" result="rim3"/>
  <feComponentTransfer in="rim3" result="rim"><feFuncA type="linear" slope="${lerp(0.55, 0.95, (t - 0.55) / 0.45).toFixed(2)}"/></feComponentTransfer>
  <feMerge result="A"><feMergeNode in="bodyA"/><feMergeNode in="wetA"/><feMergeNode in="rim"/></feMerge>` : `
  <feMerge result="A"><feMergeNode in="bodyA"/><feMergeNode in="wetA"/></feMerge>`}
  <feFlood flood-color="${color}"/>
  <feComposite in2="A" operator="in"/>
</filter>`;
}

/* ---------- mount ---------- */
export function mountShanshui(root, { seed = 1207 } = {}) {
  if (!root) return { render() {}, destroy() {} };
  const layersHost = root.querySelector('[data-layers]') || root;
  let lastW = 0;
  let svgDefs;
  const planes = [];

  let lastH = 0;
  function render() {
    const W = Math.round(root.clientWidth);
    const H = Math.round(root.clientHeight);
    if (!W || !H || (Math.abs(W - lastW) < 2 && Math.abs(H - lastH) < 2)) return;
    lastW = W;
    lastH = H;
    const data = ridgeLayers(seed, W, H);
    const id = (i) => `ss-ink-${i}`;

    if (!svgDefs) {
      svgDefs = document.createElementNS(NS, 'svg');
      svgDefs.setAttribute('width', '0');
      svgDefs.setAttribute('height', '0');
      svgDefs.setAttribute('aria-hidden', 'true');
      svgDefs.style.position = 'absolute';
      root.prepend(svgDefs);
    }
    svgDefs.innerHTML = `<defs>${data.map((p, i) => planeFilter(id(i), p.depth, i, W, H)).join('')}</defs>`;

    data.forEach((p, i) => {
      let el = planes[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'shanshui__plane';
        el.style.setProperty('--i', i);
        el.style.setProperty('--depth', p.depth.toFixed(3));
        // Scroll parallax: near planes sink further as the reader rises into the mist.
        el.style.setProperty('--sink', (0.02 + Math.pow(p.depth, 1.5) * 0.4).toFixed(3));
        el.innerHTML = `<svg xmlns="${NS}" preserveAspectRatio="none"><path/></svg>`;
        // Planes interleave with the mist bands in the markup: a band marked
        // data-after="n" sits in front of plane n and behind plane n + 1.
        const anchor = [...layersHost.querySelectorAll('[data-after]')].find((m) => +m.dataset.after >= i);
        layersHost.insertBefore(el, anchor || null);
        planes[i] = el;
      }
      const svg = el.firstElementChild;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const path = svg.firstElementChild;
      path.setAttribute('d', p.d);
      path.setAttribute('filter', `url(#${id(i)})`);
    });
    root.classList.add('is-ready');
  }

  // Filters re-rasterise on regenerate, so wait until a window drag settles.
  let timer = 0;
  const onResize = () => { clearTimeout(timer); timer = setTimeout(render, 160); };
  const ro = new ResizeObserver(onResize);
  ro.observe(root);
  render();

  // Fallback where CSS scroll-driven animations are missing (e.g. Firefox stable):
  // the veil always follows scroll (contrast); parallax only without reduced motion.
  let detachScroll = () => {};
  if (!CSS.supports('animation-timeline: scroll()')) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const veil = root.querySelector('.shanshui__veil');
    const movers = still ? [] : [...root.querySelectorAll('.shanshui__plane, .shanshui__mist')]
      .map((el) => [el, parseFloat(el.style.getPropertyValue('--sink')) || 0]);
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = innerHeight;
      const p = Math.min(1, Math.max(0, scrollY / (vh * 1.1)));
      for (const [el, sink] of movers) el.style.transform = `translate3d(0, ${(sink * p * vh).toFixed(1)}px, 0)`;
      if (veil) veil.style.opacity = String(Math.min(1, Math.max(0, (scrollY - vh * 0.08) / (vh * 0.87))));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', onScroll, { passive: true });
    update();
    detachScroll = () => removeEventListener('scroll', onScroll);
  }

  return {
    render() { lastW = 0; render(); },
    destroy() { ro.disconnect(); clearTimeout(timer); detachScroll(); planes.forEach((el) => el.remove()); svgDefs?.remove(); },
  };
}
