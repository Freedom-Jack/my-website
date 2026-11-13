'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { workCraft } from '@content/pages/work-craft';
import { kb, measured, onBytes } from './bytes';
import { fill } from './fill';
import type { Result, SearchRuntime } from './searchRuntime';
import type { Panner } from './pan';
import styles from '../craft.module.css';

/**
 * "Search these pages" on Work (the vanguard round; the attack's A2, A5, A11, A15, A16): a label, a box and one status
 * line. Nothing of the search loads before the box's first focus (its runtime and /craft/corpus.json, both counted by
 * the status line); every query is scored in the browser and no request carries it. Keyboard: Down moves into the
 * results (one tab stop, a roving tabindex), Up and Down move through them, Enter opens one, Escape clears. Hidden
 * without JavaScript (craft.module.css, html.js). Words: content/pages/work-craft.ts `search`.
 */
type State = 'idle' | 'loading' | 'ready' | 'failed';

export function Search({ size }: { size: number }) {
  const t = workCraft.search;
  const id = useId();
  const [state, setState] = useState<State>('idle');
  const [q, setQ] = useState('');
  const [rt, setRt] = useState<SearchRuntime | null>(null);
  const [bytes, setBytes] = useState(0);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false);
  const loading = useRef<Promise<void> | null>(null);
  const panner = useRef<Panner | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => onBytes(setBytes), []);
  useEffect(() => {
    const m = matchMedia('(pointer: coarse)');
    const on = () => setCoarse(m.matches);
    on();
    m.addEventListener('change', on);
    return () => {
      m.removeEventListener('change', on);
      panner.current?.back();
      panner.current?.destroy();
    };
  }, []);

  const load = () => {
    if (loading.current) return loading.current;
    setState('loading');
    loading.current = measured(async () => {
      const [mod, data] = await Promise.all([
        import('./searchRuntime'),
        fetch('/craft/corpus.json').then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<Parameters<typeof import('./searchRuntime').makeSearch>[0]>;
        }),
      ]);
      panner.current = mod.makePanner();
      setRt(mod.makeSearch(data));
    })
      .then(() => setState('ready'))
      .catch(() => {
        setState('failed');
        loading.current = null;
      });
    return loading.current;
  };

  const results: Result[] = rt && q.trim() ? rt.query(q) : [];
  const status =
    state === 'ready' && rt
      ? fill(t.ready, { n: rt.meta.passages, sha: rt.meta.corpusHash.slice(0, 7), kb: kb(bytes) })
      : state === 'idle'
        ? fill(t.idle, { kb: Math.max(1, Math.round(size / 1024)) })
        : t[state];

  const links = () => [...(list.current?.querySelectorAll<HTMLAnchorElement>('a[data-hit]') ?? [])];
  const move = (i: number) => {
    const ls = links();
    if (!ls.length) return;
    const n = (i + ls.length) % ls.length;
    setActive(n);
    ls[n]!.focus();
  };
  const clear = () => {
    setQ('');
    setActive(0);
    setShown(null);
    panner.current?.back();
    input.current?.focus();
  };

  return (
    <form
      className={styles.search}
      role="search"
      aria-labelledby={`${id}-label`}
      onSubmit={(e) => {
        e.preventDefault();
        input.current?.blur();
        list.current?.scrollIntoView({ block: 'start' });
      }}
    >
      <label className={styles.label} id={`${id}-label`} htmlFor={`${id}-q`}>
        {t.label}
      </label>
      <div className={styles.field}>
        <input
          ref={input}
          id={`${id}-q`}
          className={styles.input}
          type="search"
          name="q"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t.placeholder}
          value={q}
          onFocus={() => void load()}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            void load();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              clear();
            } else if (e.key === 'ArrowDown' && results.length) {
              e.preventDefault();
              move(0);
            }
          }}
          aria-describedby={`${id}-status ${id}-hint`}
          aria-controls={`${id}-results`}
        />
        <button type="submit" className={`action action--button ${styles.submit}`}>
          {t.submit}
        </button>
      </div>
      <p className={styles.status} id={`${id}-status`} role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      <p className="visually-hidden" id={`${id}-hint`}>
        {t.hint}
      </p>
      <div
        ref={list}
        id={`${id}-results`}
        className={styles.results}
        onFocus={(e) => {
          const r = results.find((x) => x.id === (e.target as HTMLElement).dataset.hit);
          if (r) panner.current?.focus(r);
        }}
        onBlur={(e) => {
          if (!list.current?.contains(e.relatedTarget as Node | null)) panner.current?.back();
        }}
        onKeyDown={(e) => {
          const i = links().indexOf(document.activeElement as HTMLAnchorElement);
          if (i < 0) return;
          const keys: Record<string, () => void> = {
            ArrowDown: () => move(i + 1),
            ArrowUp: () => (i === 0 ? input.current?.focus() : move(i - 1)),
            Home: () => move(0),
            End: () => move(-1),
            Escape: clear,
          };
          const act = keys[e.key];
          if (!act) return;
          e.preventDefault();
          act();
        }}
      >
        {q.trim() && state === 'ready' ? (
          results.length ? (
            <>
              <p className={styles.count}>{results.length === 1 ? t.one : fill(t.count, { n: results.length })}</p>
              <ol className={styles.hits} role="list">
                {results.map((r, i) => (
                  <li className={styles.hit} key={r.id}>
                    <Link href={r.href} className={styles.text} data-hit={r.id} tabIndex={i === active ? 0 : -1}>
                      {r.text}
                    </Link>
                    <p className={styles.source}>
                      <span>{r.source}</span>
                      {coarse ? (
                        <button
                          type="button"
                          className={styles.show}
                          aria-expanded={shown === r.id}
                          onClick={() => setShown(shown === r.id ? null : r.id)}
                        >
                          {shown === r.id ? t.hide : t.show}
                          <span className="visually-hidden">: {r.place}</span>
                        </button>
                      ) : (
                        <span className={styles.place}> · {r.place}</span>
                      )}
                    </p>
                    {!coarse && r.matched.length ? (
                      <p className={styles.matched}>
                        <span
                          className={styles.rel}
                          style={{ inlineSize: `${Math.round(r.rel * 100)}%` }}
                          aria-hidden="true"
                        />
                        {t.matched} {r.matched.join(', ')}
                      </p>
                    ) : null}
                    {coarse && shown === r.id ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a pre-cut still, lazy, at phone size
                      <img
                        className={styles.still}
                        src={r.still}
                        alt={fill(t.stillAlt, { place: r.place })}
                        loading="lazy"
                        decoding="async"
                        width={390}
                        height={169}
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className={styles.count}>{t.none}</p>
          )
        ) : null}
      </div>
    </form>
  );
}
