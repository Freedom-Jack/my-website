/**
 * P4 "Interface finish": the two page-level effects that need a little script (finish.css draws them).
 *   rowrule  each row (.ink-row, and Work's table rows, given .rule-row here) learns where the pointer entered
 *            (--x) and how far its rule must reach to cover the row from there (--rfar); CSS brushes the rule out.
 *   flow     each brush diagram gets, per edge, a light (glow, body, core: three clones of the edge's line, without
 *            its arrowhead) and a tip (the arrowhead). On hover/focus of the figure, or a tap on the drawing, one
 *            bead of light runs along each edge in flow order (data-order; equal orders run together), each edge
 *            starting as the previous one is three-quarters through (final round: a small ink dot with a
 *            short tapering tail; no glow, the arrowhead does not light). Once per hover, with a 4 s rest; it never loops. Labels and nodes never move.
 * Both read their element's flag at the moment they act (fxOn), so a runtime toggle is honoured.
 * Nothing under reduced motion or Still (the row rule then simply appears: finish.css).
 */
import { fxOn } from '@/features/landscape/elements';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = () => document.documentElement.classList.contains('is-still');
const SVGNS = 'http://www.w3.org/2000/svg';

// ------------------------------------------------------------------------------------------------ rowrule
function rowRules(root: ParentNode, signal: AbortSignal) {
  for (const tr of root.querySelectorAll<HTMLElement>('table.table tbody tr')) tr.classList.add('rule-row');
  const rows = [...root.querySelectorAll<HTMLElement>('.ink-row, .rule-row')];
  const place = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    const bleed = Math.abs(parseFloat(getComputedStyle(el).getPropertyValue('--bleed')) || 0);
    const x = clientX - r.left;
    el.style.setProperty('--x', `${x.toFixed(1)}px`);
    el.style.setProperty('--rfar', `${Math.round(Math.max(x, r.width - x) + bleed + 8)}px`);
  };
  for (const el of rows) {
    el.addEventListener('pointerenter', (e) => fxOn('rowrule') && place(el, e.clientX), { signal });
    el.addEventListener(
      'focusin',
      () => {
        if (!fxOn('rowrule')) return;
        const r = el.getBoundingClientRect();
        place(el, r.left + Math.min(r.width * 0.3, 160));
      },
      { signal },
    );
  }
  return () => rows.forEach((el) => el.classList.contains('rule-row') && el.classList.remove('rule-row'));
}

// ------------------------------------------------------------------------------------------------ flow
interface Edge {
  order: number;
  lights: SVGPathElement[]; // glow, body, core
  tip: SVGPathElement | null;
  len: number; // the line's length in user units (for the bead's size)
}

/** Split an edge's d into its line (the first subpath) and its arrowhead (the rest). */
function split(d: string): [string, string] {
  const i = d.indexOf('M', 1);
  return i < 0 ? [d, ''] : [d.slice(0, i), d.slice(i)];
}

function rig(svg: SVGSVGElement): Edge[] {
  const host = svg.querySelector('.diagram__edges');
  if (!host) return [];
  const layer = document.createElementNS(SVGNS, 'g');
  layer.setAttribute('class', 'diagram__flows');
  layer.setAttribute('aria-hidden', 'true');
  host.after(layer); // above the edges, below the labels
  const edges: Edge[] = [];
  for (const p of host.querySelectorAll<SVGPathElement>('.diagram__edge')) {
    const [line, head] = split(p.getAttribute('d') || '');
    const probe = document.createElementNS(SVGNS, 'path');
    probe.setAttribute('d', line);
    const lights = ['glow', 'body', 'core'].map((k) => {
      const c = document.createElementNS(SVGNS, 'path');
      c.setAttribute('class', `diagram__flow diagram__flow--${k}`);
      c.setAttribute('d', line);
      c.setAttribute('pathLength', '1');
      layer.append(c);
      return c;
    });
    let tip: SVGPathElement | null = null;
    if (head) {
      tip = document.createElementNS(SVGNS, 'path');
      tip.setAttribute('class', 'diagram__flow diagram__flow--tip');
      tip.setAttribute('d', head);
      layer.append(tip);
    }
    layer.append(probe);
    const len = probe.getTotalLength();
    probe.remove();
    edges.push({ order: Number(p.getAttribute('data-order')) || 0, lights, tip, len });
  }
  return edges;
}

/** One run of light through the drawing, in flow order. Returns when it is done. */
function run(edges: Edge[]): number {
  const orders = [...new Set(edges.map((e) => e.order))].sort((a, b) => a - b);
  const DUR = 620; // per edge
  const NEXT = 0.72; // the next edge starts when this one is this far through
  const ease = 'cubic-bezier(.45, .05, .35, 1)';
  let end = 0;
  orders.forEach((o, i) => {
    const t0 = i * DUR * NEXT;
    for (const e of edges.filter((x) => x.order === o)) {
      // (final round) the bead: a 3 px dark-jade ink dot with a 10 px tail tapering behind it (1 px over its last
      // 10 units, 2 px over the nearest 5, the dot itself a round cap), whatever the edge's length; no glow
      const u = 1 / Math.max(1, e.len);
      const parts: [SVGPathElement, number, number][] = [
        [e.lights[0]!, Math.min(0.6, 11 * u), 0.55],
        [e.lights[1]!, Math.min(0.4, 5 * u), 0.8],
        [e.lights[2]!, Math.min(0.1, 0.5 * u), 0.95],
      ];
      for (const [el, len, op] of parts) {
        // the dash covers [front - len, front]; front runs 0 -> 1 (pathLength 1); the gap never repeats
        el.animate(
          [
            { strokeDasharray: `${len} 3`, strokeDashoffset: len, opacity: 0 },
            { opacity: op, offset: 0.12 },
            { opacity: op, offset: 0.82 },
            { strokeDasharray: `${len} 3`, strokeDashoffset: len - 1, opacity: 0 },
          ],
          { duration: DUR, delay: t0, easing: ease, fill: 'none' },
        );
      }
    }
    end = t0 + DUR;
  });
  return end;
}

function flows(root: ParentNode, signal: AbortSignal) {
  for (const fig of root.querySelectorAll<HTMLElement>('figure.diagram')) {
    let rigged: Map<SVGSVGElement, Edge[]> | null = null;
    let busy = 0; // until when (performance.now) a run or its rest lasts
    const go = () => {
      if (!fxOn('flow') || reduced() || still()) return;
      const now = performance.now();
      if (now < busy) return;
      rigged ??= new Map();
      // the drawing on screen (wide or tall: the other is display:none)
      const svg = [...fig.querySelectorAll<SVGSVGElement>('svg.diagram__art')].find((s) => s.getClientRects().length);
      if (!svg) return;
      if (!rigged.has(svg)) rigged.set(svg, rig(svg));
      const ms = run(rigged.get(svg)!);
      busy = now + ms + 4000;
    };
    fig.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && go(), { signal });
    fig.addEventListener('focusin', go, { signal });
    fig.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType !== 'mouse' && (e.target as Element).closest('svg.diagram__art')) go();
      },
      { signal },
    );
  }
}

export function initFinish(root: ParentNode): () => void {
  const ctrl = new AbortController();
  const undoRows = rowRules(root, ctrl.signal);
  flows(root, ctrl.signal);
  return () => {
    ctrl.abort();
    undoRows();
  };
}
