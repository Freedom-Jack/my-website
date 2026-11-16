'use client';

import { useEffect, useState } from 'react';
import { ELEMENTS, type ElementName } from '@/features/landscape/elements';
import { MOODS } from '@/features/landscape/mood';
import { moods } from '@/features/landscape/mood-control';
import styles from './switches.module.css';

/**
 * The preview's switch panel (QA builds only: NEXT_PUBLIC_INK_QA=1; the root layout renders it nowhere else).
 * Every element of features/landscape/elements.ts is one switch here, so each thing can be seen on and off on the
 * same page. A switch writes this browser's override (localStorage 'ink-elements', the table's own QA mechanism)
 * and reloads the page: the engine compiles its shaders for the elements that are on, so a switch is a fresh load.
 */
const KEY = 'ink-elements';
const OPEN = 'ink-switches-open';

type Overrides = Partial<Record<ElementName, boolean>>;

const GROUPS: { title: string; items: [ElementName, string][] }[] = [
  {
    title: 'New in this round',
    items: [
      ['hours', 'The painting keeps time: dawn, day, dusk, night by your clock'],
      ['weather', 'Falling snow and rain when a scene asks for them'],
      ['depth', 'Depth: the layers answer the pointer'],
      ['ask', 'Ask the painting: the line on Home (a real model in the browser)'],
      ['nameSeal', 'The seal beside the name'],
      ['corner', 'The plum bough in the first screen’s corner'],
    ],
  },
  {
    title: 'The painting',
    items: [
      ['morning', 'The opening: the light rises, the silk unfurls, the swallow flies in'],
      ['swallows', 'Swallows: Home, Work and the Résumé'],
      ['ribbon', 'The silk ribbon through Home’s light'],
      ['petals', 'Falling petals: Home’s plum, Writing’s lake'],
      ['plum', 'Home’s plum bough'],
      ['plumGust', 'The plum answers the pointer: a gust, petals let go'],
      ['waterfall', 'The waterfall falls'],
      ['halo', 'The light’s bloom'],
      ['stir', 'Water you can stir: rest the pointer on it, or tap'],
      ['air', 'The scroll is a wind: the plum leans, willows stream'],
      ['contactLife', 'Contact: the rushes bend, the ferry drops rings'],
      ['stillSettle', '“Still the landscape” settles instead of cutting'],
    ],
  },
  {
    title: 'The page',
    items: [
      ['silkVeil', 'The page change as a mist dissolve'],
      ['glimpses', 'Windows into the painting between sections (phones)'],
      ['riverMark', 'The river line under the header'],
      ['navMark', 'The nav’s brush mark, lifted and laid'],
      ['swash', 'The name’s swash'],
      ['sun', 'The story map’s sun'],
      ['visited', 'A light on the places visited'],
      ['flow', 'The dot that runs along Work’s diagrams'],
      ['focus', 'Ink focus rings and selection'],
      ['rowrule', 'The jade rule under a hovered row'],
    ],
  },
];
const MOTION: ElementName[] = ['unroll', 'cameraTravels'];

function read(): Overrides {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>;
    const o: Overrides = {};
    for (const [k, v] of Object.entries(j)) if (k in ELEMENTS && typeof v === 'boolean') o[k as ElementName] = v;
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
  const camera = on('cameraTravels') && !on('unroll');
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
      <fieldset className={styles.group}>
        <legend>The scroll’s motion</legend>
        <label className={styles.row}>
          <input
            type="radio"
            name="ink-motion"
            checked={!camera}
            onChange={() => write({ ...over, unroll: true, cameraTravels: false })}
          />
          <span>
            <b>The unroll</b> (live now): the painting slides along the river as you read
          </span>
        </label>
        <label className={styles.row}>
          <input
            type="radio"
            name="ink-motion"
            checked={camera}
            onChange={() => write({ ...over, unroll: false, cameraTravels: true })}
          />
          <span>
            <b>The camera travels</b> (round 5): the layers part, the camera rises through mist and comes back down
          </span>
        </label>
      </fieldset>
      <fieldset className={styles.group}>
        <legend>The hour, now (no reload)</legend>
        <p className={styles.chips}>
          <button type="button" onClick={() => moods.ask(null)}>
            your clock
          </button>
          {Object.keys(MOODS).map((name) => (
            <button type="button" key={name} onClick={() => moods.ask(MOODS[name])}>
              {name}
            </button>
          ))}
        </p>
      </fieldset>
      {GROUPS.map((g) => (
        <fieldset className={styles.group} key={g.title}>
          <legend>{g.title}</legend>
          {g.items
            .filter(([k]) => !MOTION.includes(k))
            .map(([k, label]) => (
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
