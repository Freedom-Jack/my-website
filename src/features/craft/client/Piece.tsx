'use client';

import { type ComponentType, useEffect, useRef, useState } from 'react';
import { workCraft } from '@content/pages/work-craft';
import { Inline, InlineLink } from '@/lib/inline';
import { measured } from './bytes';
import { fill } from './fill';
import styles from '../craft.module.css';

/**
 * One live piece of "Under the hood", open on the page. Nothing of it loads until the reader is within half a screen
 * of it; then its module and its JSON (/craft/<kind>.json) arrive together, counted by the search's status line
 * (bytes.ts). Until then the piece says how much data it will fetch (measured at build). It opens with the JSON's tie
 * to a production claim and the link to its case, then its own view.
 */
export type PieceKind = 'lineage' | 'mask' | 'eval';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each piece reads its own JSON shape
type View = ComponentType<{ data: any }>;
/** the part of every piece's JSON this body reads: its words' tie and case (content/craft/hood.ts) */
interface Tied {
  words?: { tie?: string; case?: string };
}

const loaders: Record<PieceKind, () => Promise<View>> = {
  lineage: () => import('./LineageFold').then((m) => m.LineageFold),
  mask: () => import('./MaskFold').then((m) => m.MaskFold),
  eval: () => import('./EvalFold').then((m) => m.EvalFold),
};

export function Piece({
  kind,
  size,
  here,
}: {
  kind: PieceKind;
  size: number;
  /** the case this page is (a case page shows the piece tied to it): the tie then carries no link to itself */
  here?: string;
}) {
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
      measured(() =>
        Promise.all([
          loaders[kind](),
          fetch(`/craft/${kind}.json`).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.json() as Promise<unknown>;
          }),
        ]),
      )
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
    <div ref={ref} className={styles.pieceBody} aria-busy={state === 'loading'} data-piece={kind}>
      {state === 'far' ? (
        <p className="mono">{fill(workCraft.hood.open, { kb: Math.max(1, Math.round(size / 1024)) })}</p>
      ) : null}
      {state === 'loading' ? <p className="mono">{workCraft.hood.loading}</p> : null}
      {state === 'failed' ? <p className="small">{workCraft.hood.failed}</p> : null}
      {typeof state === 'object' ? (
        <>
          <Tie words={(state.data as Tied).words} here={here} />
          <state.View data={state.data} />
        </>
      ) : null}
    </div>
  );
}

function Tie({ words, here }: Tied & { here?: string | undefined }) {
  if (!words?.tie || !words.case) return null;
  return (
    <p className={styles.tie}>
      <Inline text={words.tie} />
      {words.case === here ? null : (
        <>
          {' '}
          <InlineLink href={`/work/${words.case}/`}>{workCraft.hood.caseLink} →</InlineLink>
        </>
      )}
    </p>
  );
}

/** Is this element on screen (a share of it)? For the pieces that run by themselves once they are seen. */
export function useSeen<T extends Element>(share = 0.35) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => setSeen(es.some((e) => e.isIntersecting)), { threshold: share });
    io.observe(el);
    return () => io.disconnect();
  }, [share]);
  return [ref, seen] as const;
}
