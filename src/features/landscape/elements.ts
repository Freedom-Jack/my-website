/**
 * Spring ink's elements: THE one switch table for every new element (scene, motion and interface). Set a flag to false
 * and that element is gone: its engine, effects and figure-set paths are skipped and its <html> class (`el-<name>`,
 * server-rendered, so no flash) is not set, so its CSS does not apply. Only silkVeil, air and glimpses compile their
 * shader code out (a GLSL #define: elementDefines); the others' shader code stays compiled in, idle, since the engine
 * leaves their uniforms at rest. Nothing else changes.
 * Read on the main thread (engine, effects, layout), in the figure worker (the sets) and by the boot script.
 *
 * Every element keeps the engine's rules: nothing behind text (the veils, the keep-out, the 40 px text guard), text never
 * moves, ambient motion <= 15 fps and asleep after 45 s, pointer answers <= 30 fps and only while they move, reduced
 * motion and "Still the landscape" = a still frame and still UI, phones calm.
 *
 * QA builds only (NEXT_PUBLIC_INK_QA=1): localStorage 'ink-elements' = '{"silkVeil":false}', or window.__elOff =
 * ['morning', ...] injected before the page's scripts, switches flags off in that browser for an "off" frame. The figure
 * worker always reads the table.
 */
export const ELEMENTS = {
  // ---- the painting (engine)
  /** Morning opens: Home's first full load of a session, the light rises and opens, two banks of cloud part from it,
   *  the plum blooms from its root, the swallow flies in, the ribbon unfurls after the light (shorter on phones). The
   *  words are on paper from the first paint. */
  morning: true,
  /** Water you can stir: one small, flat, broken ink ring where the pointer rests over open water (>= 450 ms) or a
   *  tap lands; at most two at once, never over a reflection; the ferry's own drops use the same grammar. */
  stir: true,
  /** The plum answers: a damped nudge of Home's bough, and three to five of its own petals let go one after another
   *  and drift down with the breeze (at most once every 8 s). */
  plumGust: true,
  /** The waterfall falls: broken lights slide down Home's fall, spray breathes at its foot (they rise with the morning). */
  waterfall: true,
  /** Contact's signature: the rushes bend in a breeze; the ferryman's pole and the bow drop a ring now and then. */
  contactLife: true,
  /** "Still the landscape" lets the painting settle over 0.8 s instead of cutting (reduced motion stays a cut). */
  stillSettle: true,
  // ---- the scroll
  /** The camera travels: every page on the map is a living ground. On wide screens the scene's depth layers part as
   *  you scroll (near crags and the plum drop away fastest, the middle settles over a sea of mist, the far range barely
   *  moves), the place parks beside the reading column and the camera comes down to the closing view at the end, with
   *  each place's own choreography (places' STAGE_AT). Below 1200 px the strip's and the closing's layers part as they
   *  leave and gather as they arrive, with mist rising between them. Reduced motion and Still: rest frames only. */
  cameraTravels: true,
  /** The scroll's air (a wind on the figures only): the scroll's speed is a breeze. Home's plum leans on a damped
   *  spring and two or three of its petals blow off it, the silk ribbon bows and its twist runs along it, Work's
   *  willows stream and Contact's rushes bend; all of it settles within 1.5 s of the scroll stopping. The light swells
   *  a little as the camera rises and as you read on (near the light only). A jump (a route swap, an anchor) is not a
   *  speed. Off under reduced motion, Still, Canvas2D; half strength and no petals on phones. */
  air: true,
  /** Windows into the painting, below 1200 px only: at the page's major section breaks a short, full-bleed
   *  window of the page's own place opens in the gap (<Glimpse>, [data-landscape="glimpse"]), and the camera has
   *  travelled further into the place each time (the near crags, then higher in the mist, then above the sea of cloud;
   *  the closing brings it back down). Each window's depth layers part as it passes through the viewport and mist
   *  feathers it into the paper. Present-only: it shows the strip's own painted layers (no new scene, no new texture).
   *  Reduced motion and Still: each window at its rest pose. At 1200 px and up the windows are not laid out at all. */
  glimpses: true,
  // ---- the page change
  /** The page change as a mist dissolve (340 ms): mist gathers and clears across the hero window only, right of the
   *  words; a long jump cross-dissolves the old place into the new one (the words cross-fade under paper). */
  silkVeil: true,
  /** The nav's current-page mark lifts off the old word at the click and is laid wet under the new one. */
  navMark: true,
  // ---- the interface
  /** The name's swash laid down after the name's ink settle, and one warm wet sheen along it, once, when the morning's
   *  light is up (the first load only). */
  swash: true,
  /** The story map: the current place holds its sun (a warmth, not a disc, no tick); hovering another raises its light. */
  sun: true,
  /** A small ink dot runs along Work's diagrams' arrows once per hover, in flow order (no glow). */
  flow: true,
  /** Focus and selection: a plain 2 px jade ring; selection in glow-tinted paper; a jade scrollbar. */
  focus: true,
  /** Rows: a 1.5 px jade rule drawn in from the left on the row's bottom border (no wash behind the text). */
  rowrule: true,
  /** The story map keeps a little light on the places visited this session (sessionStorage, this tab only; no
   *  words). Off by default: it is not scroll motion, so it stays a choice of its own. */
  visited: false,
};

export type ElementName = keyof typeof ELEMENTS;

const QA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INK_QA === '1';

/** QA overrides in this browser (none in production, none in the worker). */
// (globalThis, never `typeof window`: the bundler folds `typeof window` to "object" in client code, the figure worker
// included, where window is not defined; reading it there threw and sent every Home layer to the main-thread fallback,
// which has no sprites)
function qaOff(): Set<string> {
  const off = new Set<string>();
  const g = globalThis as unknown as { document?: unknown; localStorage?: Storage; __elOff?: unknown };
  if (!QA || !g.document) return off;
  try {
    const o = JSON.parse(g.localStorage?.getItem('ink-elements') || '{}') as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) if (v === false) off.add(k);
  } catch {
    /* no storage: the defaults */
  }
  const w = g.__elOff;
  if (Array.isArray(w)) for (const k of w) off.add(String(k));
  return off;
}

/** Is this element on (the table, then any QA override)? */
export function elementOn(name: ElementName): boolean {
  if (!ELEMENTS[name]) return false;
  return !qaOff().has(name);
}
/** Short alias (the engine and the sets). */
export const el = elementOn;

/** The switches the present shader reads, as GLSL #defines (an element that is off is not compiled in). */
export function elementDefines(): string {
  return [
    elementOn('silkVeil') ? '#define EL_SILK_VEIL 1' : '',
    elementOn('air') ? '#define EL_AIR 1' : '',
    elementOn('glimpses') ? '#define EL_GLIMPSE 1' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The <html> classes of the elements that are on (server-rendered by the root layout). */
export const elementClasses = (): string =>
  (Object.keys(ELEMENTS) as ElementName[])
    .filter((k) => ELEMENTS[k])
    .map((k) => `el-${k}`)
    .join(' ');

/** The boot script's part (in <head>, before first paint): QA builds drop the classes of switched-off elements. */
export function bootElements(): string {
  if (!QA) return '';
  return `try{var O=[];try{var J=JSON.parse(l&&l.getItem('ink-elements')||'{}');for(var k in J)if(J[k]===false)O.push(k)}catch(e){}if(Array.isArray(w.__elOff))O=O.concat(w.__elOff);O.forEach(function(n){h.classList.remove('el-'+n)})}catch(e){}`;
}

/** Is this interface element on right now (its <html> class: the flag, a QA override or a runtime toggle)? */
export const fxOn = (k: ElementName): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains(`el-${k}`);
