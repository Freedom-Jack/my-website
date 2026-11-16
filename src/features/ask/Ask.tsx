'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ask as words } from '@content/pages/ask';
import { makePanner, type Panner } from '@/features/craft/client/pan';
import { moods } from '@/features/landscape/mood-control';
import type { Answer, Brain, Step } from './brain';
import styles from './ask.module.css';

/**
 * "Ask the painting" (Home's first screen; elements.ts `ask`). One line. A visitor describes a scene, or asks about
 * the work; a small language model in their own browser reads it (brain.ts, ask.worker.ts), and every step it takes
 * is set down beside the line as it happens, with its real numbers. A scene repaints the painting (the mood); a
 * question is answered with a passage of the site's own words, word for word, and the painting travels to the place
 * that holds it. Nothing is fetched until the line is used; nothing typed leaves the browser.
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
    case 'route':
      return fill(s.as === 'scene' ? t.routeScene : t.routeQuestion, {
        scene: two(s.scene),
        question: two(s.question),
      });
    case 'scene':
      return s.found.length
        ? fill(t.scene, { found: s.found.map((f) => `${f.label} ${two(f.score)}`).join(' · ') })
        : t.sceneNone;
    case 'search':
      return fill(t.search, { n: s.passages, score: two(s.score) });
    case 'travel':
      return fill(t.travel, { place: s.place });
  }
}

export function Ask() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const brain = useRef<Brain | null>(null);
  const panner = useRef<Panner | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      brain.current?.destroy();
      panner.current?.destroy();
    },
    [],
  );
  // the inscription has its own paper behind it (plates/veils.ts): it is laid again as the inscription grows
  useEffect(() => {
    document.dispatchEvent(new Event('ink:veils'));
  }, [steps, answer]);

  /** The model's code and files come with the first turn to the line (never before). */
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
    brain.current.warm();
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
    setBusy(false);
    if (a.kind === 'scene') moods.ask(a.mood);
    if (a.kind === 'answer') {
      panner.current ??= makePanner();
      panner.current.focus({ stretch: a.stretch, u: a.u });
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(value);
  };
  const back = () => {
    panner.current?.back();
    setAnswer(null);
    setSteps((prev) => prev.filter((p) => p.kind === 'load'));
  };

  const r = words.result;
  return (
    <section className={styles.ask} aria-label={words.label}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.label} htmlFor="ask-line">
          {words.label}
        </label>
        <div className={styles.line}>
          <input
            ref={input}
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
            aria-describedby="ask-hint"
          />
          <button className={`action action--button ${styles.go}`} type="submit" disabled={busy}>
            {words.go}
            <span className="action__arrow" aria-hidden="true" />
          </button>
        </div>
        {steps.length || answer ? null : (
          <p className={styles.hint} id="ask-hint">
            {words.hint}
          </p>
        )}
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
      </form>

      {/* the inscription: on a wide screen it is written in the painting's own empty corner (data-veil-own: its own
          paper behind it), where an ink painting carries its inscription; below the line elsewhere */}
      <div className={styles.out} aria-live="polite" data-veil-own="" data-on={steps.length || answer ? '' : undefined}>
        {steps.length ? (
          <ol className={styles.trace}>
            {steps.map((s, i) => (
              <li key={`${s.kind}-${i}`} data-kind={s.kind} data-run={s.kind === 'load' && !s.done ? '' : undefined}>
                {s.kind === 'load' && !s.done ? (
                  <i style={{ inlineSize: `${Math.round((s.loaded / s.total) * 100)}%` }} />
                ) : null}
                <span>{line(s)}</span>
              </li>
            ))}
          </ol>
        ) : null}

        {answer?.kind === 'scene' ? (
          <p className={styles.said}>
            {fill(r.scene, { labels: answer.labels.join(', ') })}{' '}
            <button
              type="button"
              className={styles.quiet}
              onClick={() => {
                moods.ask(null);
                back();
              }}
            >
              {r.sceneBack}
            </button>
          </p>
        ) : null}
        {answer?.kind === 'scene-unknown' ? <p className={styles.said}>{r.sceneUnknown}</p> : null}
        {answer?.kind === 'answer' ? (
          <figure className={styles.answer}>
            {/* the passage's closest sentence, word for word (the whole passage is on its page, one click on) */}
            <blockquote>{answer.sentence || answer.text}</blockquote>
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
          </figure>
        ) : null}
        {answer?.kind === 'unknown' ? (
          <p className={styles.said}>
            {fill(r.unknown, { score: two(answer.score), floor: two(answer.floor) })} {r.unknownMore}
          </p>
        ) : null}
        {answer?.kind === 'error' ? <p className={styles.said}>{r.error}</p> : null}
      </div>
    </section>
  );
}
