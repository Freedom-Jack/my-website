'use client';

import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { ask as words } from '@content/pages/ask';
import { Arrow } from '@/components/ui/Arrow';
import { Seal } from '@/components/ui/Seal';
import { quiet } from '@/features/chrome/still';
import { normPath } from '@/features/landscape/places';
import type { Step } from './brain';
import { closer, first, modelHere, words as siteWords, type Place, type Said, type Words } from './mind';
import { comeHome, forget, travelTo } from './travel';
import styles from './sheet.module.css';

/**
 * "Ask the painting": the sheet. A sheet of the page's own paper laid over the reading zone, under the band, so the
 * painting stays in view above it and can travel to the place that holds an answer. At the top the question line;
 * under it the examples; then what was found, and in the margin how it was found: the real steps with their real
 * numbers, each set down as it completes.
 *
 * Three honest steps (mind.ts), and the margin says which one answered:
 *   0  a filed question: his line at once, sealed; no model;
 *   1  anything else: a search by word, shown as places (links), never as his answer, with the closer reading
 *      offered under them at its price;
 *   2  the closer reading: the sentence-embedding model in the visitor's own browser; his line, sealed, or an honest
 *      no with the nearest places as links.
 *
 * While it is open the page behind is inert and does not scroll, Tab stays inside, and Escape, "Close" or the door
 * close it: the painting comes home, the window's scroll is where it was and the focus is back where it came from.
 * A link inside it (a "From", a place) closes it and is followed by the site's own navigation.
 */
export interface SheetHandle {
  close(): void;
  focus(): void;
}
export interface SheetProps {
  /** the question it opens with (the tail's example), or '' */
  ask: string;
  /** what opened it: the focus goes back there */
  from: HTMLElement | null;
  /** the host's way to it while it is open (the door closes it; "/" goes to its line) */
  onHandle: (h: SheetHandle | null) => void;
  onClosed: () => void;
}

type View =
  | { kind: 'idle' }
  | { kind: 'said'; by: 'filed' | 'model'; answer: Said; n: number }
  | { kind: 'places'; q: string; w: Words; places: Place[] }
  | { kind: 'private' }
  | { kind: 'unknown'; score: number; floor: number; places: Place[] }
  | { kind: 'error'; places: Place[] }
  | { kind: 'failed' };

interface Mark {
  id: string;
  text: string;
}

const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
const mb = (bytes: number) => (bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0);
const kb = (bytes: number) => Math.max(1, Math.round(bytes / 1024));
/** A score as it is printed: cut to two places, never rounded up (to the floor, say). */
const two = (x: number) => (Math.floor(Math.max(0, x) * 100) / 100).toFixed(2);
/** A short time: the clock's own grain is a tenth of a millisecond. */
const ms = (x: number) => (x < 0.1 ? 'under 0.1' : x < 10 ? x.toFixed(1) : String(Math.round(x)));

/** A link as the corpus names it; on this very page, to the page itself when its anchor is not in the document. */
function hrefHere(href: string): string {
  const [path = '', id] = href.split('#');
  if (!id || normPath(path) !== normPath(location.pathname) || document.getElementById(id)) return href;
  return path;
}

/** A line of content with [links](/in/it). */
function Linked({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <a key={m.index} href={m[2]}>
        {m[1]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

export function Sheet({ ask, from, onHandle, onClosed }: SheetProps) {
  const t = words.trace;
  const r = words.result;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const probe = useRef<HTMLElement>(null);
  const [value, setValue] = useState(ask);
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [trace, setTrace] = useState<Mark[]>([]);
  const [busy, setBusy] = useState(false); // (the closer reading is under way)
  const [leaving, setLeaving] = useState(false);
  const seq = useRef(0); // (the question being answered: an older one's steps are dropped)
  const answers = useRef(0);
  const gone = useRef(false);
  const release = useRef<((back: boolean) => void) | null>(null);
  const was = useRef<{ y: number; moved: boolean } | null>(null);
  const hover = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = usePathname();

  /** A step is set down (one that counts up, the model's arrival, in place; the painting's last journey, last). */
  const mark = (id: string, text: string) =>
    setTrace((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      if (i < 0) return [...prev, { id, text }];
      if (id === 'travel') return [...prev.filter((m) => m.id !== id), { id, text }];
      return prev.map((m, j) => (j === i ? { id, text } : m));
    });
  const unmark = (id: string) => setTrace((prev) => prev.filter((m) => m.id !== id));

  // ------------------------------------------------------------------ opening and closing
  // The sheet lies under the settled band. Near a page's top the band still stands at full size, so the window is
  // first scrolled, smoothly, to where it has settled (the sheet's top is under the band until then); then the page
  // behind is held: inert, and its scroll locked where it stands.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const behind = [...document.querySelectorAll<HTMLElement>('#main, .tail, .skip-link')];
    const door = document.querySelector<HTMLElement>('.ask-door');
    for (const el of behind) el.inert = true;
    door?.setAttribute('aria-expanded', 'true');
    const band = document.querySelector('.band');
    const rest = probe.current?.offsetHeight ?? 0;
    const run = probe.current?.offsetWidth ?? 0;
    was.current ??= { y: scrollY, moved: false };
    if (band && rest && band.getBoundingClientRect().height > rest + 2 && scrollY < run) {
      was.current.moved = true;
      scrollTo({ top: run, behavior: quiet() ? 'instant' : 'smooth' });
    }
    html.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'stable';
    let released = false;
    release.current = (back) => {
      if (released) return;
      released = true;
      for (const el of behind) el.inert = false;
      door?.setAttribute('aria-expanded', 'false');
      html.style.overflow = '';
      html.style.scrollbarGutter = '';
      if (!back) return forget(); // (a page change takes the painting, the scroll and the focus from here)
      comeHome();
      if (was.current?.moved) scrollTo({ top: was.current.y, behavior: quiet() ? 'instant' : 'smooth' });
      (from?.isConnected ? from : door)?.focus({ preventScroll: true });
    };
    return () => release.current?.(false);
  }, [from]);

  /** @param back  true: closed by the reader (everything goes back where it was); false: a link was followed */
  const leave = useCallback(
    (back: boolean) => {
      if (gone.current) return;
      gone.current = true;
      seq.current += 1;
      clearTimeout(hover.current);
      onHandle(null);
      release.current?.(back);
      if (quiet()) return onClosed();
      setLeaving(true);
      setTimeout(onClosed, 200);
    },
    [onHandle, onClosed],
  );

  useEffect(() => {
    onHandle({ close: () => leave(true), focus: () => input.current?.focus() });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      leave(true);
    };
    // a link, inside the sheet or in the header: the site's own navigation has it (features/navigation, at the
    // document); the sheet only gets out of its way
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('a[href]')) leave(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      onHandle(null);
    };
  }, [onHandle, leave]);

  // Back or Forward while it is open: the page under it is another page now
  const opened = useRef(pathname);
  useEffect(() => {
    if (opened.current !== pathname) leave(false);
  }, [pathname, leave]);

  /** Tab stays inside the sheet. */
  const onTab = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !root.current) return;
    const stops = [...root.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input')];
    const at = stops.indexOf(document.activeElement as HTMLElement);
    const to = e.shiftKey ? (at <= 0 ? stops.length - 1 : -1) : at === stops.length - 1 ? 0 : -1;
    if (to < 0 || !stops[to]) return;
    e.preventDefault();
    stops[to].focus();
  };

  // ------------------------------------------------------------------ the painting
  const travel = async (to: { stretch: number; u: number | null; place: string }, mine: number) => {
    const went = await travelTo(to);
    if (seq.current !== mine) return;
    if (went) mark('travel', fill(t.travel, { place: to.place }));
    else unmark('travel');
  };
  /** A place under the pointer or the focus: the painting goes there once it has rested on it a moment. */
  const visit = (p: Place) => {
    clearTimeout(hover.current);
    const mine = seq.current;
    hover.current = setTimeout(() => void travel(p, mine), 150);
  };

  // ------------------------------------------------------------------ the three steps
  /** Step 2: the model's reading (asked for, or at once when the model is already in the browser). */
  const read = async (q: string, w: Words, places: Place[], mine: number) => {
    setBusy(true);
    if (modelHere()) mark('load', fill(t.loaded, { total: mb(modelHere()) }));
    const a = await closer(q, w, (s: Step) => {
      if (seq.current !== mine) return;
      if (s.kind === 'load')
        mark(
          'load',
          s.done ? fill(t.loaded, { total: mb(s.total) }) : fill(t.loading, { got: mb(s.loaded), total: mb(s.total) }),
        );
      else if (s.kind === 'read') mark('read', fill(t.read, { n: s.tokens }));
      else if (s.kind === 'embed') mark('embed', fill(t.embed, { dim: s.dim, ms: ms(s.ms) }));
      else if (s.kind === 'guard') mark('guard', t.guard);
      else {
        mark('search', fill(t.search, { n: s.lines }));
        if (s.top[0]) mark('closest', fill(t.closest, { score: two(s.top[0].score), floor: two(s.floor) }));
      }
    });
    if (seq.current !== mine) return;
    setBusy(false);
    if (a.kind === 'answer') {
      setView({ kind: 'said', by: 'model', answer: a, n: ++answers.current });
      void travel(a, mine);
    } else if (a.kind === 'unknown') setView({ kind: 'unknown', score: a.score, floor: a.floor, places });
    else if (a.kind === 'private') setView({ kind: 'private' });
    else setView({ kind: 'error', places });
  };

  /** Steps 0 and 1 (and 2 at once, when the model is already here), for the question numbered `mine`. */
  const answerTo = async (q: string, mine: number) => {
    let w: Words;
    try {
      w = await siteWords();
    } catch {
      if (seq.current === mine) setView({ kind: 'failed' });
      return;
    }
    if (seq.current !== mine) return;
    mark('words', fill(t.words, { n: w.lines.length, kb: kb(w.bytes) }));
    const f = first(q, w);
    if (f.kind === 'filed') {
      mark('filed', t.filed);
      setView({ kind: 'said', by: 'filed', answer: f.answer, n: ++answers.current });
      void travel(f.answer, mine);
    } else if (f.kind === 'private') {
      mark('guard', t.guard);
      setView({ kind: 'private' });
    } else {
      mark('lexical', fill(t.lexical, { n: f.passages, ms: ms(f.ms) }));
      mark(
        'count',
        f.places.length === 0 ? t.none : f.places.length === 1 ? t.one : fill(t.count, { n: f.places.length }),
      );
      if (modelHere()) await read(q, w, f.places, mine);
      else setView({ kind: 'places', q, w, places: f.places });
    }
  };
  const run = (text: string) => {
    const q = text.trim();
    if (!q) return input.current?.focus();
    const mine = ++seq.current;
    clearTimeout(hover.current);
    comeHome(); // (another question: the painting returns to the page's own place)
    setBusy(false);
    setTrace([]);
    void answerTo(q, mine);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(value);
  };

  // it opens on its line; or, opened by an example, with that question asked (the focus on the sheet itself, so a
  // phone's keyboard stays down over the answer). The site's words are asked for at once: about 8 KB.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (ask) {
      root.current?.focus({ preventScroll: true });
      void answerTo(ask.trim(), ++seq.current);
    } else {
      input.current?.focus({ preventScroll: true });
      void siteWords().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as it opens
  }, []);

  // what was found is brought into view when it comes while the sheet is scrolled past it (a phone, after "Read
  // closer", which stands under the places)
  const out = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = out.current;
    const box = root.current;
    if (!el || !box || view.kind === 'idle') return;
    const over = el.getBoundingClientRect().top - box.getBoundingClientRect().top - 72; // (clear of the band's mist)
    if (over < 0) box.scrollBy({ top: over, behavior: quiet() ? 'instant' : 'smooth' });
  }, [view]);

  // ------------------------------------------------------------------ what is shown
  const placeRows = (places: Place[]) => (
    <ol className={styles.places} role="list">
      {places.map((p) => (
        <li key={p.id}>
          <a
            className={styles.place}
            href={hrefHere(p.href)}
            onPointerEnter={(e) => (e.pointerType === 'mouse' ? visit(p) : undefined)}
            onFocus={() => visit(p)}
          >
            <span className={`rec ${styles.where}`}>{p.source}</span>
            <span className={`small ${styles.snippet}`}>
              {p.snippet.map(([text, hit], i) => (hit ? <mark key={i}>{text}</mark> : text))}
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
  const answer = (v: Extract<View, { kind: 'said' }>) => (
    <figure className={styles.answer}>
      {/* his line, word for word, with the short lines that stand beside it on its page (a list's other items) in a
          lighter ink; the seal is pressed at its end: found, not written */}
      <blockquote>
        {v.answer.before.map((line) => (
          <p key={line} className={`small ${styles.beside}`}>
            {line}
          </p>
        ))}
        <p className={`lead ${styles.said}`}>
          {v.answer.said}
          <span className={styles.seal} key={v.n}>
            <Seal id="seal-carve-ask" />
          </span>
        </p>
        {v.answer.after.map((line) => (
          <p key={line} className={`small ${styles.beside}`}>
            {line}
          </p>
        ))}
      </blockquote>
      <figcaption className={styles.from}>
        <p className="rec">
          {r.from} <a href={hrefHere(v.answer.href)}>{v.answer.source}</a>
        </p>
        <p className={styles.note}>{v.by === 'filed' ? r.filedNote : r.answerNote}</p>
      </figcaption>
    </figure>
  );

  return (
    <div
      ref={root}
      className={styles.sheet}
      id="ask-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-title"
      tabIndex={-1}
      data-leaving={leaving ? '' : undefined}
      onKeyDown={onTab}
    >
      {/* (the band's settled height and the scroll over which it settles, as lengths: read as the sheet opens) */}
      <i ref={probe} className={styles.probe} aria-hidden="true" />
      <div className={`row ${styles.in}`}>
        <h2 className={`label ${styles.title}`} id="ask-title">
          {words.label}
        </h2>
        <button type="button" className={styles.close} onClick={() => leave(true)}>
          {words.close}
        </button>

        <form className={styles.form} onSubmit={submit}>
          <div className={styles.line}>
            <input
              ref={input}
              className={styles.input}
              type="text"
              name="q"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={words.placeholder}
              maxLength={160}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-labelledby="ask-title"
              aria-describedby="ask-hint"
            />
            <button type="submit" className={`go ${styles.go}`}>
              <span className="go__words">{words.go}</span>
              <Arrow />
            </button>
          </div>
          <p className={styles.tries}>
            <span className="label">{words.tryLabel}</span>
            {words.tries.map((q) => (
              <button
                type="button"
                key={q}
                onClick={() => {
                  setValue(q);
                  run(q);
                }}
              >
                {q}
              </button>
            ))}
          </p>
        </form>

        {/* what was found: his own line, sealed; or places; or an honest no */}
        <div ref={out} className={styles.out} aria-live="polite">
          {view.kind === 'said' ? answer(view) : null}
          {view.kind === 'places' ? (
            <>
              {view.places.length ? (
                <>
                  <h3 className="label">{r.places}</h3>
                  {placeRows(view.places)}
                </>
              ) : (
                <p className="say">{r.none}</p>
              )}
            </>
          ) : null}
          {view.kind === 'private' ? <p className={`say ${styles.no}`}>{r.private}</p> : null}
          {view.kind === 'unknown' ? (
            <>
              <p className={`say ${styles.no}`}>
                {fill(r.unknown, { score: two(view.score), floor: two(view.floor) })}
              </p>
              <p className={`small soft ${styles.more}`}>
                <Linked text={r.unknownMore} />
              </p>
              {view.places.length ? (
                <div className={styles.nearest}>
                  <h3 className="label">{r.nearest}</h3>
                  <ul className="rec" role="list">
                    {view.places.map((p) => (
                      <li key={p.id}>
                        <a href={hrefHere(p.href)} onFocus={() => visit(p)}>
                          {p.source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}
          {view.kind === 'error' ? (
            <>
              {view.places.length ? (
                <>
                  <h3 className="label">{r.places}</h3>
                  {placeRows(view.places)}
                </>
              ) : (
                <p className="say">{r.none}</p>
              )}
              <p className={`small soft ${styles.more}`}>{r.error}</p>
            </>
          ) : null}
          {view.kind === 'failed' ? <p className={`say ${styles.no}`}>{r.failed}</p> : null}
        </div>

        {/* the margin. The next step, offered at its price: never taken for the visitor (once the model is here it
            costs nothing more, and a typed question is read by it at once). Then, before anything is asked, what
            this is; after, how the answer was found, step by step. */}
        <aside className={styles.margin}>
          {view.kind === 'places' ? (
            <div className={styles.offer}>
              <p className={styles.hint}>{r.closerCost}</p>
              <button
                type="button"
                className={`go ${styles.closer}`}
                disabled={busy}
                onClick={() => void read(view.q, view.w, view.places, seq.current)}
              >
                <span className="go__words">{r.closer}</span>
                <Arrow />
              </button>
            </div>
          ) : null}
          {trace.length ? (
            <>
              <h3 className="label">{t.title}</h3>
              <ol className={`rec ${styles.trace}`} role="list">
                {trace.map((m) => (
                  <li key={m.id}>{m.text}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className={styles.hint} id="ask-hint">
              {words.hint}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
