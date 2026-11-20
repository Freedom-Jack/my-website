'use client';

import { type ComponentType, useEffect, useRef, useState } from 'react';
import { workCraft } from '@content/pages/work-craft';
import { fill } from './fill';
import styles from '../craft.module.css';

/**
 * One live piece of "Under the hood", open on its case's page, under a hairline. Nothing of it loads until the
 * reader is within half a screen of it; then its module and its JSON (/craft/<kind>.json) arrive together. Until
 * then the piece says, in the record's voice, how much data it will fetch (measured at build). The room it will take
 * is kept from the start (craft.module.css), so nothing under it moves when it comes.
 */
export type PieceKind = 'lineage' | 'mask' | 'eval';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each piece reads its own JSON shape
type View = ComponentType<{ data: any }>;

const loaders: Record<PieceKind, () => Promise<View>> = {
  lineage: () => import('./LineageFold').then((m) => m.LineageFold),
  mask: () => import('./MaskFold').then((m) => m.MaskFold),
  eval: () => import('./EvalFold').then((m) => m.EvalFold),
};

export function Piece({ kind, size }: { kind: PieceKind; size: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'far' | 'loading' | 'failed' | { View: View; data: unknown }>('far');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      setState('loading');
      Promise.all([
        loaders[kind](),
        fetch(`/craft/${kind}.json`).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<unknown>;
        }),
      ])
        .then(([View, data]) => setState({ View, data }))
        .catch(() => setState('failed'));
    };
    if (typeof IntersectionObserver === 'undefined') {
      load();
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: '50% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [kind]);

  return (
    <div ref={ref} className={styles.piece} aria-busy={state === 'loading'} data-piece={kind}>
      {state === 'far' ? (
        <p className="rec">{fill(workCraft.hood.open, { kb: Math.max(1, Math.round(size / 1024)) })}</p>
      ) : null}
      {state === 'loading' ? <p className="rec">{workCraft.hood.loading}</p> : null}
      {state === 'failed' ? <p className="small soft">{workCraft.hood.failed}</p> : null}
      {typeof state === 'object' ? <state.View data={state.data} /> : null}
    </div>
  );
}

/** Is this element on screen (a share of it)? For the pieces that answer the reader's arrival. `once`: it stays
 *  seen from the first time it was (a drawing draws in once, a test runs once). */
export function useSeen<T extends Element>(share = 0.35, once = false) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        const on = es.some((e) => e.isIntersecting);
        if (once && !on) return;
        setSeen(on);
        if (once) io.disconnect();
      },
      { threshold: share },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [share, once]);
  return [ref, seen] as const;
}
