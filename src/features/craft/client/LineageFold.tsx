'use client';

import type { Lineage } from '../build';
import { fill } from './fill';
import { useSeen } from './Piece';
import styles from '../craft.module.css';

interface Data extends Lineage {
  meta: { commit: string; passages: number; files: number; corpusHash: string };
  words: typeof import('@content/craft/hood').hood.lineage;
}

/**
 * "Where the words came from": the lineage drawn top to bottom, narrow enough for a phone (the content files drawn
 * as one node), its lines drawing themselves in from the files down once it is on screen; beside it the one plain
 * statement and the same record as a list, one fold away (each artefact, what it was made from and how).
 */
export function LineageFold({ data }: { data: Data }) {
  const w = data.words;
  const label = new Map(data.nodes.map((n) => [n.id, n.label]));
  const files = data.nodes.filter((n) => n.kind === 'file');
  const made = data.nodes.filter((n) => n.kind !== 'file');
  const filesId = '__files';
  const filesLabel = `${files.length} content files`;
  const edges = data.edges.map(
    ([a, b, v]) => [label.has(a) && files.some((f) => f.id === a) ? filesId : a, b, v] as const,
  );
  const uniq = [...new Map(edges.map((e) => [`${e[0]}>${e[1]}`, e])).values()];

  // the drawing: rows by longest path from the files; nodes spread across each row
  const depth = new Map<string, number>([[filesId, 0]]);
  for (let pass = 0; pass < made.length; pass += 1)
    for (const [a, b] of uniq) depth.set(b, Math.max(depth.get(b) ?? 0, (depth.get(a) ?? 0) + 1));
  const rows: string[][] = [];
  for (const [id, d] of depth) (rows[d] ??= []).push(id);
  const W = 360;
  const RH = 72;
  const pos = new Map<string, [number, number]>();
  // each row ordered by its parents' mean position (fewer crossings), then spread across the width
  rows.forEach((ids, r) => {
    if (r > 0) {
      const at = (id: string) => {
        const xs = uniq.filter((e) => e[1] === id).map((e) => pos.get(e[0])?.[0] ?? W / 2);
        return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      };
      ids.sort((a, b) => at(a) - at(b));
    }
    ids.forEach((id, i) => pos.set(id, [((i + 0.5) * W) / ids.length, 20 + r * RH]));
  });
  const name = (id: string) => (id === filesId ? filesLabel : (label.get(id) ?? id));

  const kind = new Map(data.nodes.map((n) => [n.id, n.kind]));

  const [ref, seen] = useSeen<HTMLElement>(0.3, true);
  return (
    <div className={styles.lineageView}>
      <figure className={styles.dag} ref={ref} data-seen={seen ? '' : undefined}>
        <svg viewBox={`0 0 ${W} ${rows.length * RH - 36}`} role="img" aria-label={w.drawing}>
          {uniq.map(([a, b]) => {
            const [x1, y1] = pos.get(a)!;
            const [x2, y2] = pos.get(b)!;
            const d = `M${x1} ${y1 + 11} C${x1} ${y1 + 40} ${x2} ${y2 - 36} ${x2} ${y2 - 17}`;
            const delay = { transitionDelay: `${(depth.get(b) ?? 1) * 260 - 200}ms` };
            // one stroke, heavier where the brush came down: the line, then its first third again, wider
            return (
              <g key={`${a}>${b}`}>
                <path d={d} className={styles.edge} pathLength={1} style={delay} />
                <path d={d} className={`${styles.edge} ${styles.edgePress}`} pathLength={1} style={delay} />
              </g>
            );
          })}
          {[...pos].map(([id, [x, y]]) => (
            <text key={id} x={x} y={y} textAnchor="middle" className={styles.svgLabel} data-kind={kind.get(id)}>
              {name(id)}
            </text>
          ))}
        </svg>
      </figure>
      <div className={styles.lineageSay}>
        <p className={styles.result}>
          {fill(w.result, { files: data.meta.files, passages: data.meta.passages, commit: data.meta.commit })}
        </p>
        <details className={styles.fold}>
          <summary>
            <span>{w.listFold}</span>
          </summary>
          <ul className={styles.lineage}>
            {made.map((n) => {
              const ins = data.edges.filter((e) => e[1] === n.id);
              if (!ins.length) return null;
              return (
                <li key={n.id}>
                  <span className={styles.node}>{n.label}</span>
                  {n.hash ? <span className={styles.hash}> {n.hash}</span> : null}
                  <span className={styles.edgeLine}>
                    {[...new Set(ins.map((e) => e[2]))]
                      .map((verb) => {
                        const from = ins.filter((e) => e[2] === verb).map(([a]) => a);
                        const named = from.filter((a) => !files.some((f) => f.id === a)).map(name);
                        if (from.some((a) => files.some((f) => f.id === a))) named.push(filesLabel);
                        return `${w.edges[verb]} ${named.join(', ')}`;
                      })
                      .join('; ')}
                  </span>
                  {n.id === 'passages' ? (
                    <ul className={styles.files}>
                      {files.map((f) => (
                        <li key={f.id}>
                          <code>{f.label}</code> <span className={styles.hash}>{f.hash}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </div>
  );
}
