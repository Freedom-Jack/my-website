'use client';

import { type ComponentType, useEffect, useRef, useState } from 'react';
import { workCraft } from '@content/pages/work-craft';
import { Inline, InlineLink } from '@/lib/inline';
import { measured } from './bytes';
import styles from '../craft.module.css';

/**
 * The body of one "Under the hood" fold: nothing loads until its <details> first opens; then its module and its JSON
 * (/craft/<kind>.json) arrive together, counted by the search's status line (bytes.ts). The fold opens with the JSON's
 * tie to a production claim and the link to its case (A16's order: tie, result, table), then the fold's own view.
 */
export type FoldKind = 'lineage' | 'mask' | 'eval';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each fold reads its own JSON shape
type Fold = ComponentType<{ data: any }>;
/** the part of every fold's JSON this body reads: its words' tie and case (content/craft/hood.ts) */
interface Tied {
  words?: { tie?: string; case?: string };
}

const loaders: Record<FoldKind, () => Promise<Fold>> = {
  lineage: () => import('./LineageFold').then((m) => m.LineageFold),
  mask: () => import('./MaskFold').then((m) => m.MaskFold),
  eval: () => import('./EvalFold').then((m) => m.EvalFold),
};

export function FoldBody({ kind }: { kind: FoldKind }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'closed' | 'loading' | 'failed' | { View: Fold; data: unknown }>('closed');

  useEffect(() => {
    const details = ref.current?.closest('details');
    if (!details) return;
    let started = false;
    const open = () => {
      if (!details.open || started) return;
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
        .catch(() => {
          started = false;
          setState('failed');
        });
    };
    details.addEventListener('toggle', open);
    open();
    return () => details.removeEventListener('toggle', open);
  }, [kind]);

  return (
    <div ref={ref} aria-busy={state === 'loading'}>
      {state === 'loading' ? <p className="small">{workCraft.hood.loading}</p> : null}
      {state === 'failed' ? <p className="small">{workCraft.hood.failed}</p> : null}
      {typeof state === 'object' ? (
        <>
          <Tie words={(state.data as Tied).words} />
          <state.View data={state.data} />
        </>
      ) : null}
    </div>
  );
}

function Tie({ words }: Tied) {
  if (!words?.tie || !words.case) return null;
  return (
    <p className={styles.tie}>
      <Inline text={words.tie} /> <InlineLink href={`/work/${words.case}/`}>{workCraft.hood.caseLink} →</InlineLink>
    </p>
  );
}
