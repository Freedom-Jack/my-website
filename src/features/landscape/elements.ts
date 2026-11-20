/**
 * The switch table: one flag per painted element. Set a flag to false and that element is gone: its engine and
 * figure-set paths are skipped and its <html> class (`el-<name>`, server-rendered) is not set. glimpses and halo
 * compile their shader code out (GLSL #defines: elementDefines); the others' shader code stays compiled in, idle,
 * with its uniforms at rest. Read on the main thread (the engine), in the figure worker (the sets) and by the boot
 * script. Every element keeps the engine's rules: ambient motion at most 30 fps on the plates and asleep after a
 * minute without input (engine/index.ts PLATE_MS, PLATE_IDLE), a still frame under reduced motion and "Still the
 * landscape".
 *
 * QA builds only (NEXT_PUBLIC_INK_QA=1): a flag is switched off in one browser by localStorage 'ink-elements' =
 * '{"halo":false}' (the preview's panel, features/qa/Switches, writes it) or by window.__elOff = ['boughs', ...]
 * (injected before the page's scripts). The figure worker gets the same overrides with each layer it draws
 * (figure-source.ts).
 */
export const ELEMENTS = {
  // ---- the painting (engine)
  /** The waterfall falls: broken lights slide down Home's fall, spray breathes at its foot. Home's one living element:
   *  the river's source. */
  waterfall: true,
  /** Contact's one living element, the ferry: the rushes bend in a breeze; the ferryman's pole and the bow drop a ring
   *  now and then. */
  contactLife: true,
  /** "Still the landscape" lets the painting settle over 0.8 s instead of cutting (reduced motion stays a cut). */
  stillSettle: true,
  /** The framing willow boughs of two first screens: Work's willow tip out of the top edge over the town, and
   *  Writing's willow let down from the top-right corner over the lake. Off: the painting is seen as a band of the
   *  scroll that stands back and unrolls (styles/band.css), and a bough that frames one first screen would hang in
   *  the middle of the sky of that band, as it would in the tail's strip of the whole scroll. */
  boughs: false,
  /** The light's bloom: a tight halo and a wide soft glow round each place's light, breathing slowly, Home's the
   *  strongest (shaders.ts, compiled in with EL_HALO). Off: the light keeps only its core, which the scene paints. */
  halo: true,
  // ---- how the painting meets the page
  /** Windows into the painting between a page's sections (the engine's glimpse windows). Off: the painting is the
   *  band alone (styles/band.css); the page has no windows, and the engine compiles their shader code out. */
  glimpses: false,
};

export type ElementName = keyof typeof ELEMENTS;

const QA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INK_QA === '1';

/** QA builds only: the flags switched off in this browser. In the worker (no document, no storage) only the list the
 *  engine passes with each layer (figure-source.ts) counts. */
// (globalThis, never `typeof window`: the bundler folds `typeof window` to "object" in client code, the figure worker
// included, where window is not defined: reading it there throws, and the worker's layers fall back to the main thread)
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

/** Is this interface element on, by its <html> class (the flag, unless a QA override switched it off)? */
export const fxOn = (k: ElementName): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains(`el-${k}`);
