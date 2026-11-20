'use client';

import { useEffect, useState } from 'react';
import { ELEMENTS, type ElementName } from '@/features/landscape/elements';
import styles from './switches.module.css';

/**
 * The preview's switch panel (QA builds only: NEXT_PUBLIC_INK_QA=1; the root layout renders it nowhere else).
 * Each element listed here can be switched off in this browser, so it can be seen on and off on the same page. A
 * switch writes this browser's override (localStorage 'ink-elements' = {"name": false}, the table's own QA mechanism)
 * and reloads the page: the engine compiles its shaders for the elements that are on, so a switch is a fresh load.
 */
const KEY = 'ink-elements';
const OPEN = 'ink-switches-open';

type Overrides = Partial<Record<ElementName, boolean>>;

const GROUPS: { title: string; items: [ElementName, string][] }[] = [
  {
    title: 'The painting',
    items: [
      ['waterfall', 'The waterfall falls'],
      ['halo', 'The light’s bloom'],
      ['contactLife', 'Contact: the rushes bend, the ferry drops rings'],
      ['stillSettle', '“Still the landscape” settles instead of cutting'],
    ],
  },
];

function read(): Overrides {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>;
    const o: Overrides = {};
    for (const [k, v] of Object.entries(j)) if (k in ELEMENTS && v === false) o[k as ElementName] = v;
    return o;
  } catch {
    return {};
  }
}
function write(o: Overrides) {
  // (only what differs from the table is kept)
  const out: Overrides = {};
  for (const [k, v] of Object.entries(o) as [ElementName, boolean][]) if (v !== ELEMENTS[k]) out[k] = v;
  try {
    if (Object.keys(out).length) localStorage.setItem(KEY, JSON.stringify(out));
    else localStorage.removeItem(KEY);
    sessionStorage.setItem(OPEN, '1');
  } catch {
    /* no storage: nothing to switch */
  }
  location.reload();
}

export function Switches() {
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState<Overrides | null>(null);
  useEffect(() => {
    // (a person's tool: an automated browser, a test or a screenshot, never gets it)
    if (navigator.webdriver) return;
    // (read after hydration: the server renders the closed tab)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOver(read());
    try {
      if (sessionStorage.getItem(OPEN)) setOpen(true);
    } catch {
      /* closed */
    }
  }, []);
  if (!over) return null;
  const on = (k: ElementName) => over[k] ?? ELEMENTS[k];
  const set = (k: ElementName, v: boolean) => write({ ...over, [k]: v });
  const changed = Object.keys(over).length;
  const close = () => {
    setOpen(false);
    try {
      sessionStorage.removeItem(OPEN);
    } catch {
      /* ignore */
    }
  };
  if (!open)
    return (
      <button type="button" className={styles.tab} onClick={() => setOpen(true)}>
        Switches{changed ? ` · ${changed} changed` : ''}
      </button>
    );
  return (
    <aside className={styles.panel} aria-label="Preview switches">
      <header className={styles.head}>
        <strong>Switches</strong>
        <span className={styles.note}>preview only · a switch reloads the page</span>
        <button type="button" className={styles.x} onClick={close} aria-label="Close the switches">
          ×
        </button>
      </header>
      {GROUPS.map((g) => (
        <fieldset className={styles.group} key={g.title}>
          <legend>{g.title}</legend>
          {g.items.map(([k, label]) => (
            <label className={styles.row} key={k}>
              <input type="checkbox" checked={on(k)} onChange={(e) => set(k, e.target.checked)} />
              <span>
                {label}
                {over[k] !== undefined && over[k] !== ELEMENTS[k] ? <em className={styles.diff}> changed</em> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      <footer className={styles.foot}>
        <button type="button" onClick={() => write({})} disabled={!changed}>
          Back to the build’s own settings
        </button>
      </footer>
    </aside>
  );
}
