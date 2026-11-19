/**
 * Spring ink's elements: THE one switch table for every new element (scene, motion and interface). Set a flag to false
 * and that element is gone: its engine, effects and figure-set paths are skipped and its <html> class (`el-<name>`,
 * server-rendered, so no flash) is not set, so its CSS does not apply. glimpses and halo compile their shader code out
 * (a GLSL #define: elementDefines); the others' shader code stays compiled in, idle, since the engine leaves their
 * uniforms at rest. Nothing else changes.
 * Read on the main thread (engine, effects, layout), in the figure worker (the sets) and by the boot script.
 *
 * Every element keeps the engine's rules: nothing behind text (the veils, the keep-out, the 40 px text guard), text never
 * moves, ambient motion <= 15 fps and asleep after 45 s, pointer answers <= 30 fps and only while they move, reduced
 * motion and "Still the landscape" = a still frame and still UI, phones calm.
 * On wide screens the stage is THE PLATES (features/landscape/plates): every element here keeps working on them.
 *
 * The preview's panel (features/qa/Switches, QA builds) switches the flags it lists off in this browser.
 *
 * QA builds only (NEXT_PUBLIC_INK_QA=1): a flag is switched off in that browser with localStorage 'ink-elements' =
 * '{"glimpses":false}' or window.__elOff = ['boughs', ...] (injected before the page's scripts). The figure worker gets
 * the same overrides with each layer it draws (figure-source.ts).
 */
export const ELEMENTS = {
  // ---- the painting (engine)
  /** The waterfall falls: broken lights slide down Home's fall, spray breathes at its foot. Home's one living element
   *  (A3): the river's source. */
  waterfall: true,
  /** Contact's signature: the rushes bend in a breeze; the ferryman's pole and the bow drop a ring now and then.
   *  Contact's one living element (A3): the ferry. */
  contactLife: true,
  /** "Still the landscape" lets the painting settle over 0.8 s instead of cutting (reduced motion stays a cut). */
  stillSettle: true,
  /** The framing willow boughs of two first screens (the live site's): Work's willow tip out of the top edge over
   *  the town, and Writing's willow let down from the top-right corner over the lake. On. Off: neither is drawn.
   *  The tail's strip of the whole scroll (tools/build-scroll.ts) is cut with them off: a bough that frames one
   *  page's opening would hang in the middle of the sky of a strip. */
  boughs: true,
  /** The light's bloom in the present pass: a tight halo and a wide soft glow round each place's light, breathing
   *  slowly, Home's the strongest (shaders.ts, compiled in with EL_HALO; the light's core in the scene is the
   *  painting's). ON: the light is Home's named element with the mountain and the fall. QA switches it off for Jack's
   *  side by side (the brief, A3: Home with and without the plum and the light's halo). */
  halo: true,
  // ---- the ask line
  /** Ask the painting: one line on Home. A small language model in the visitor's own browser (hosted with the site,
   *  loaded only when they ask) reads their question about the work; it is answered from the site's own words, and
   *  the painting travels to the place that holds the answer (features/ask). */
  ask: true,
  // ---- the scroll
  /** Windows into the painting, below 1200 px only: at the page's major section breaks a short, full-bleed
   *  window of the page's own place opens in the gap (<Glimpse>, [data-landscape="glimpse"]), each one further along
   *  the place (east, level). Present-only: painted once at idle, slid in the present as the window passes; the
   *  window's own still until then and wherever the painting cannot come (the probe: live only after it). Reduced
   *  motion and Still: each window at its rest pose. At 1200 px and up the windows are not laid out at all.
   *  Subtraction: off, a phone loses the river's progress through the page. Referent: each window looks further along
   *  the river than the one before. Control: the scroll's. Cost: zero scroll-time scenes; the still as the fallback.
   *  Recall: "pictures of the same river kept appearing between the sections, each a little further along." */
  glimpses: true,
  // ---- the chrome
  /** The river line (components/layout/RiverLine): a hairline under the header's row with a tick per stop and a jade
   *  dot that stands under the current page's tick and travels to the next stop as the page scrolls. Subtraction:
   *  off, "where am I on the whole scroll" between the stops is lost and the current page has no mark. Referent: the
   *  reading's distance along the river, the same as the unroll's. Control: the scroll's, on the compositor (a CSS
   *  scroll timeline). Cost: 0 bytes per frame; the finished state (the dot under the stop) is the default CSS;
   *  reduced motion and Still keep it there. Recall: "a dot moved along a line under the menu as I read." */
  riverMark: true,
  // ---- the interface
  /** A small ink dot runs along Work's diagrams' arrows once per hover, in flow order (no glow). */
  flow: true,
  /** Focus and selection: a 2 px ink ring with a jade second line; selection in glow-tinted paper; a jade scrollbar
   *  (effects.css). On: feedback for the keyboard, with the control itself as its referent. */
  focus: true,
  /** Rows: a 1.5 px jade rule drawn in from the left on the row's bottom border on hover and focus (nothing behind
   *  the text). On: feedback with a referent (the row under the hand). */
  rowrule: true,
  /** The scroll, held (src/features/scroll): after the words, one quiet link in the footer opens the handscroll in the
   *  hero's own band and the hand moves the painting (drag, wheel, the arrow keys, a tap on a place); every walk returns
   *  to the one composition; at rest a place may be seen high or deep. Off: no opener, no sheet, no CSS, no hold. */
  scroll: true,
};

export type ElementName = keyof typeof ELEMENTS;

const QA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INK_QA === '1';

/** QA builds only: the flags switched off in this browser. In the worker (no document, no storage) only the list the
 *  engine passes with each layer (figure-source.ts) counts. */
// (globalThis, never `typeof window`: the bundler folds `typeof window` to "object" in client code, the figure worker
// included, where window is not defined; reading it there threw and sent every Home layer to the main-thread fallback,
// which has no sprites)
function qaOff(): Set<string> {
  const off = new Set<string>();
  const g = globalThis as unknown as { document?: unknown; localStorage?: Storage; __elOff?: unknown };
  if (g.document) {
    try {
      const j = JSON.parse(g.localStorage?.getItem('ink-elements') || '{}') as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) if (v === false) off.add(k);
    } catch {
      /* no storage: the defaults */
    }
  }
  if (Array.isArray(g.__elOff)) for (const k of g.__elOff) off.add(String(k));
  return off;
}

/** Is this element on (the table, unless a QA override switches it off)? */
export function elementOn(name: ElementName): boolean {
  if (!QA) return ELEMENTS[name];
  return ELEMENTS[name] && !qaOff().has(name);
}
/** Short alias (the engine and the sets). */
export const el = elementOn;

/** QA only: the flags switched off, to hand the figure worker with a layer (it reads no storage and no window). */
export function qaOverrideLists(): { off: string[] } | undefined {
  if (!QA) return undefined;
  const off = [...qaOff()];
  return off.length ? { off } : undefined;
}

/** The switches the present shader reads, as GLSL #defines (an element that is off is not compiled in). */
export function elementDefines(): string {
  return [elementOn('glimpses') ? '#define EL_GLIMPSE 1' : '', elementOn('halo') ? '#define EL_HALO 1' : '']
    .filter(Boolean)
    .join('\n');
}

/** The <html> classes of the elements that are on (server-rendered by the root layout). */
export const elementClasses = (): string =>
  (Object.keys(ELEMENTS) as ElementName[])
    .filter((k) => ELEMENTS[k])
    .map((k) => `el-${k}`)
    .join(' ');

/** The boot script's part (in <head>, before first paint): QA builds drop the classes of elements switched off
 *  (localStorage 'ink-elements' with false values, window.__elOff). */
export function bootElements(): string {
  if (!QA) return '';
  return `try{var O=[];try{var J=JSON.parse(l&&l.getItem('ink-elements')||'{}');for(var k in J){if(J[k]===false)O.push(k)}}catch(e){}if(Array.isArray(w.__elOff))O=O.concat(w.__elOff);O.forEach(function(n){h.classList.remove('el-'+n)})}catch(e){}`;
}

/** Is this interface element on right now (its <html> class: the flag, a QA override or a runtime toggle)? */
export const fxOn = (k: ElementName): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains(`el-${k}`);
