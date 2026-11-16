'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ask as words } from '@content/pages/ask';
import { Seal } from '@/components/ui/Seal';
import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf } from '@/features/landscape/targets';
import type { Answer, Brain, Step } from './brain';
import styles from './ask.module.css';

/**
 * "Ask the painting" (Home's body, round 7; elements.ts `ask`): the page's moment. A visitor asks about the work; a
 * small language model in their own browser reads the question (brain.ts, ask.worker.ts), measures it against every
 * line of this site, and every step it takes is set down beside the line as it happens, with its real numbers: the
 * tokens, the vector, the three closest lines and how close each came. The answer is a line of the site's own words,
 * word for word, sealed with his seal (found, not written); on a wide screen the painting then travels to the place
 * that holds it (the section keeps the right of the frame open, so the place is seen to arrive), on a phone that
 * place's own picture comes up under the answer. Under a floor it says it does not
 * know. Nothing is fetched until the line is used; nothing typed leaves the browser.
 * (Round 6's other half, a scene that repainted the painting by hour and weather, is gone.)
 */
const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
const mb = (bytes: number) => (bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0);
const two = (x: number) => Math.max(0, x).toFixed(2);

function line(s: Step): string {
  const t = words.trace;
  switch (s.kind) {
    case 'load':
      return s.done
        ? fill(t.loaded, { total: mb(s.total) })
        : fill(t.loading, { got: mb(s.loaded), total: mb(s.total) });
    case 'read':
      return fill(t.read, { n: s.tokens });
    case 'embed':
      return fill(t.embed, { dim: s.dim, ms: Math.max(1, Math.round(s.ms)) });
    case 'guard':
      return t.guard;
    case 'search':
      return fill(t.search, { n: s.lines });
    case 'travel':
      return fill(t.travel, { place: s.place });
  }
}

/** The place's own first frame, at phone size (public/scenes/hero): what a phone shows instead of the pan. */
const STILLS = ['home', 'work', 'writing', 'resume', 'contact'];

export function Ask() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [n, setN] = useState(0); // (the answers so far: the seal is pressed anew for each)
  const brain = useRef<Brain | null>(null);
  const away = useRef(false);

  /** The painting goes to the place that holds the answer (wide screens with a live painting), or comes back. */
  const travel = async (to: { stretch: number; u: number | null } | null) => {
    const h = landscape.get();
    const main = currentMain();
    if (!h || !main) return;
    const own = placeOf(main).stretch;
    if (!to || (to.stretch === own && to.u === null)) {
      if (away.current) {
        away.current = false;
        await h.panTo(own);
      }
      return;
    }
    const wide = matchMedia('(pointer: fine)').matches && innerWidth >= 1200;
    if (!wide || document.documentElement.getAttribute('data-live') !== 'on') return;
    const { cameraFor } = await import('@/features/landscape/engine');
    away.current = true;
    await h.panTo(to.u === null ? to.stretch : cameraFor(to.stretch, to.u, 'wide'));
  };

  useEffect(
    () => () => {
      brain.current?.destroy();
      if (away.current) void travel(null);
    },
    [],
  );
  // the words keep their own mist behind them (plates/veils.ts): it is laid again as the answer grows
  useEffect(() => {
    document.dispatchEvent(new Event('ink:veils'));
  }, [steps, answer]);

  /** The line's own code comes when the visitor turns to it; the model's files only when they ask (brain.ts). */
  async function wake() {
    if (brain.current) return brain.current;
    const { createBrain } = await import('./brain');
    brain.current = createBrain((s) =>
      setSteps((prev) => {
        // (the fetch's line counts up in place; every other step is a line of its own)
        const i = s.kind === 'load' ? prev.findIndex((p) => p.kind === 'load') : -1;
        return i >= 0 ? prev.map((p, j) => (j === i ? s : p)) : [...prev, s];
      }),
    );
    return brain.current;
  }

  async function run(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    setSteps((prev) => prev.filter((p) => p.kind === 'load'));
    const b = await wake();
    const a = await b.ask(q);
    setAnswer(a);
    setN((k) => k + 1);
    setBusy(false);
    if (a.kind === 'answer') void travel({ stretch: a.stretch, u: a.u });
    else void travel(null);
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(value);
  };
  const back = () => {
    void travel(null);
    setAnswer(null);
    setSteps((prev) => prev.filter((p) => p.kind === 'load'));
  };

  const r = words.result;
  const search = steps.find((s) => s.kind === 'search');
  return (
    <section className={`part spread ${styles.ask}`} aria-labelledby="ask-title">
      <div className={styles.main} data-veil="">
        <p className="tag">{words.tag}</p>
        <h2 className="h-ink" id="ask-title">
          {words.label}
        </h2>
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.line}>
            <input
              id="ask-line"
              className={styles.input}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => void wake()}
              placeholder={words.placeholder}
              maxLength={160}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-labelledby="ask-title"
              aria-describedby="ask-hint"
            />
            <button className={`action action--button ${styles.go}`} type="submit" disabled={busy}>
              {words.go}
              <span className="action__arrow" aria-hidden="true" />
            </button>
          </div>
          <p className={styles.tries}>
            <span>{words.tryLabel}</span>
            {words.tries.map((t) => (
              <button
                type="button"
                key={t}
                disabled={busy}
                onClick={() => {
                  setValue(t);
                  void run(t);
                }}
              >
                {t}
              </button>
            ))}
          </p>
          {steps.length ? null : (
            <p className={styles.hint} id="ask-hint">
              {words.hint}
            </p>
          )}
        </form>

        {/* the answer: his own line, word for word, sealed (found, never written) */}
        <div className={styles.out} aria-live="polite">
          {answer?.kind === 'answer' ? (
            <figure className={styles.answer}>
              {/* the line that answers, with the short lines that stand beside it on its page (a list's other items)
                  in a lighter ink; the page itself is one click on */}
              <blockquote>
                {answer.before.map((t) => (
                  <p key={t} className={styles.beside}>
                    {t}
                  </p>
                ))}
                <p className={styles.said}>
                  {answer.said}
                  <span className={`${styles.seal} stamp`} key={n}>
                    <Seal id="seal-carve-ask" />
                  </span>
                </p>
                {answer.after.map((t) => (
                  <p key={t} className={styles.beside}>
                    {t}
                  </p>
                ))}
              </blockquote>
              <figcaption>
                <span>
                  {r.from}{' '}
                  <Link href={answer.href} prefetch={false}>
                    {answer.source}
                  </Link>
                  . {r.answerNote}
                </span>{' '}
                <button type="button" className={styles.quiet} onClick={back}>
                  {r.back}
                </button>
              </figcaption>
              {/* a phone: the place that holds the answer, as its own picture (a wide screen's painting travels there) */}
              {STILLS[answer.stretch] ? (
                // eslint-disable-next-line @next/next/no-img-element -- a pre-cut still, lazy, phones only
                <img
                  className={styles.place}
                  src={`/scenes/hero/${STILLS[answer.stretch]}-phone@2x.webp`}
                  alt=""
                  width={430}
                  height={186}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </figure>
          ) : null}
          {answer?.kind === 'private' ? <p className={styles.plain}>{r.private}</p> : null}
          {answer?.kind === 'unknown' ? (
            <p className={styles.plain}>
              {fill(r.unknown, { score: two(answer.score), floor: two(answer.floor) })} {r.unknownMore}
            </p>
          ) : null}
          {answer?.kind === 'error' ? <p className={styles.plain}>{r.error}</p> : null}
        </div>

        {/* what the model did, as it does it: its steps with their real numbers, then the three closest lines and how
            close each came (the model's own scores): the first is the answer when it clears the floor */}
        {steps.length ? (
          <div className={styles.did}>
            <p className="tag">{words.trace.title}</p>
            <div className={styles.cols}>
              <ol className={styles.trace}>
                {steps.map((s, i) => (
                  <li
                    key={`${s.kind}-${i}`}
                    data-kind={s.kind}
                    data-run={s.kind === 'load' && !s.done ? '' : undefined}
                  >
                    {s.kind === 'load' && !s.done ? (
                      <i style={{ inlineSize: `${Math.round((s.loaded / s.total) * 100)}%` }} />
                    ) : null}
                    <span>{line(s)}</span>
                  </li>
                ))}
              </ol>
              {search && search.kind === 'search' && search.top.length ? (
                <ol className={styles.top} aria-hidden="true">
                  {search.top.map((t, i) => (
                    <li key={t.source} data-first={i === 0 && t.score >= search.floor ? '' : undefined}>
                      <span className={styles.score}>{two(t.score)}</span>
                      <span className={styles.bar}>
                        <i style={{ inlineSize: `${Math.round(Math.min(1, t.score) * 100)}%` }} />
                      </span>
                      <span className={styles.where}>{t.source}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
