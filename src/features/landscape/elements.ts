/**
 * Spring ink's elements: THE one switch table for every new element (scene, motion and interface). Set a flag to false
 * and that element is gone: its engine, effects and figure-set paths are skipped and its <html> class (`el-<name>`,
 * server-rendered, so no flash) is not set, so its CSS does not apply. silkVeil, air, glimpses, ribbon and halo compile
 * their shader code out (a GLSL #define: elementDefines); the others' shader code stays compiled in, idle, since the
 * engine leaves their uniforms at rest. Nothing else changes.
 * Read on the main thread (engine, effects, layout), in the figure worker (the sets) and by the boot script.
 *
 * Every element keeps the engine's rules: nothing behind text (the veils, the keep-out, the 40 px text guard), text never
 * moves, ambient motion <= 15 fps and asleep after 45 s, pointer answers <= 30 fps and only while they move, reduced
 * motion and "Still the landscape" = a still frame and still UI, phones calm.
 *
 * The vanguard round (05-synthesis.md): every flag carries its answer to the five questions (subtraction, referent,
 * control, cost and fallback, recall: research/DIGEST.md §5); an element that fails subtraction or referent is off.
 * The surface package (P2) switched off the opening ceremony, the page change's mist, the nav's mark, the swash and
 * the story map's sun; the engine package (P3) ruled on the scroll (the unroll in, the camera's travel and the air
 * out), the pointer answers (out) and, by the attack's A3, one named element per place (the swallows, the ribbon and
 * the falling petals out; the plum kept, moved off the light).
 *
 * QA builds only (NEXT_PUBLIC_INK_QA=1): a flag is switched OFF in that browser with localStorage 'ink-elements' =
 * '{"silkVeil":false}' or window.__elOff = ['morning', ...] (injected before the page's scripts), and ON, against the
 * table, with '{"cameraTravels":true}' or window.__elOn = [...]: the side by side the synthesis asks for (the unroll
 * against the camera's travel) runs on one build: {"unroll":false,"cameraTravels":true}. The figure worker gets the
 * same overrides with each layer it draws (figure-source.ts).
 */
export const ELEMENTS = {
  // ---- the painting (engine)
  /** Morning opens: Home's first full load of a session, the light rises and opens, two banks of cloud part from it,
   *  the plum blooms from its root, the swallow flies in, the ribbon unfurls after the light (shorter on phones).
   *  OFF (P2): the first screen is finished at first paint, the still being its first frame (the still-first boot
   *  already runs no arrival); off loses a 2.3 s wait and nothing a reader needs; its only recall was "it took a
   *  while to appear". */
  morning: false,
  /** Water you can stir: one small, flat, broken ink ring where the pointer rests over open water (>= 450 ms) or a
   *  tap lands; at most two at once, never over a reflection; the ferry's own drops use the same grammar. OFF (P3, the
   *  synthesis: "the pointer stir and petals" are cut): off, a visitor loses nothing they came for; its referent was
   *  the pointer itself, which the digest's anti-patterns name; recall: "it rippled when I hovered". The ferry's own
   *  drops (contactLife) keep the ring. */
  stir: false,
  /** The plum answers: a damped nudge of Home's bough, and three to five of its own petals let go one after another
   *  and drift down with the breeze (at most once every 8 s). OFF (P3, with stir: nothing answers the pointer). */
  plumGust: false,
  /** The waterfall falls: broken lights slide down Home's fall, spray breathes at its foot. Home's one living element
   *  (A3): the river's source. */
  waterfall: true,
  /** Contact's signature: the rushes bend in a breeze; the ferryman's pole and the bow drop a ring now and then.
   *  Contact's one living element (A3): the ferry. */
  contactLife: true,
  /** "Still the landscape" lets the painting settle over 0.8 s instead of cutting (reduced motion stays a cut). */
  stillSettle: true,
  /** Home's plum bough: the one spring accent, entering from the top-right corner, its blossoms in three sizes, its
   *  slow swing (~0.5 deg at ~0.08 Hz) kept; moved off the light (A3: it crossed the halo). Subtraction: off, Home's
   *  first screen is winter. Referent: the season of the one painting. Control: none needed (a still thing that
   *  breathes). Cost: a sprite in the figure layer, 0 frames of its own. Recall: "a plum bough over his mountain".
   *  QA switches it off for Jack's side by side (the brief, A3). */
  plum: true,
  /** The swallows: Home's one swallow gliding across the open sky (and its three far birds), Work's pair low over the
   *  river, the Résumé's one sweeping over the fields. OFF (P3, A3: one named element per place; "no swallow on
   *  Home", "Work's swallows go", "the Résumé's swallow goes"): off, a visitor loses a second moving thing in three
   *  places, none of which is the place's own; the critic read Home's first frame as a collage. */
  swallows: false,
  /** The silk mist-ribbon: one long S from behind Home's host peak through the light, twisting and torn by the mist
   *  (shaders.ts, compiled in with EL_RIBBON). OFF (P3, A3: "no silk ribbon on Home"): off, the light stands alone
   *  as the painting's one bright thing; the ribbon had no referent but ornament, and crossed the plum. */
  ribbon: false,
  /** Falling petals: the few that let go of Home's plum and drift down, and the ones that fall through Writing's air
   *  over the lake (the petals lying on the still water stay: they are paint, not motion). OFF (P3, A3: "Writing's
   *  petals go"; one living element per place: Home's is the fall, Writing's the shimmer). */
  petals: false,
  /** The light's bloom in the present pass: a tight halo and a wide soft glow round each place's light, breathing
   *  slowly, Home's the strongest (shaders.ts, compiled in with EL_HALO; the light's core in the scene is the
   *  painting's). ON: the light is Home's named element with the mountain and the fall. QA switches it off for Jack's
   *  side by side (the brief, A3: Home with and without the plum and the light's halo). */
  halo: true,
  // ---- the scroll
  /**
   * THE UNROLL (P3; direction A, "The handscroll, unrolled", the jury's winner for the scroll). On wide screens the
   * living ground is the handscroll: the page's three depth layers are painted once at the hero framing, wider to the
   * east by the page's travel, and slid west in the present pass as the page scrolls, linearly: the end of a page
   * stands `share` (0.6) of the way to the next place's hero, and the page change's pan carries the rest (a click
   * never jumps back). No lift, no parting, no cloud, no descent: once the reading starts, a standing curtain of mist
   * keeps the middle and near layers out from under the reading column, and the far ranges run on behind the words
   * under their own paper. Below 1200 px the strip drifts west as it leaves, the closing comes in from the east, and
   * Work's and the Résumé's windows look east along the place, level.
   * Subtraction: off, the reader loses "the next page lies downstream, already in view" and the reading's place on the
   * river. Referent: distance along the river = how far down the page you have read. Control: native scroll, linear,
   * reverses and stops with the hand; nothing exists only inside it (the ending is text). Cost: present-only, 0 scenes
   * while scrolling; reduced motion and Still: the hero pose, then one cut to the end pose once the ending is on
   * screen. Recall: "the painting slid along with my reading, and the next page was already there."
   */
  unroll: true,
  /** The camera travels (the approved round-5 motion): on wide screens the scene's depth layers part as you scroll
   *  (near crags and the plum drop away fastest, the middle settles over a sea of mist, the far range barely moves),
   *  the place parks beside the reading column and the camera comes down to the closing view at the end, with each
   *  place's own choreography (places' STAGE_AT). Below 1200 px the strip's and the closing's layers part as they
   *  leave and gather as they arrive, with mist rising between them. OFF (P3, the synthesis: parallax in kind, no
   *  referent a reader is told about, its one recall "the background moved"); KEPT in the engine as the QA
   *  alternative until Jack has seen both side by side ({"unroll":false,"cameraTravels":true} in a QA build), by the
   *  one switch table. Where both are on, the unroll wins. */
  cameraTravels: false,
  /** The scroll's air (a wind on the figures only): the scroll's speed is a breeze. Home's plum leans on a damped
   *  spring and two or three of its petals blow off it, the silk ribbon bows and its twist runs along it, Work's
   *  willows stream and Contact's rushes bend; all of it settles within 1.5 s of the scroll stopping. OFF (P3): one
   *  scroll motion only, the unroll; a second one, whose referent ("the scroll is a wind") no reader is told, fails
   *  subtraction (off, nothing is lost but a stir) and recall. The figures' own small life (the willows' sway, the
   *  rushes in the breeze, the bough's swing) stays: it is the painting's, not the scroll's. */
  air: false,
  /** Windows into the painting, below 1200 px only: at the page's major section breaks a short, full-bleed
   *  window of the page's own place opens in the gap (<Glimpse>, [data-landscape="glimpse"]), each one further along
   *  the place (the unroll: east, level; the camera's travel: higher in one climb). Present-only: painted once at
   *  idle, slid in the present as the window passes; the window's own still until then and wherever the painting
   *  cannot come (the probe: live only after it). Reduced motion and Still: each window at its rest pose. At 1200 px
   *  and up the windows are not laid out at all. Subtraction: off, a phone loses the river's progress through the
   *  page. Referent: each window looks further along the river than the one before. Control: the scroll's. Cost: zero
   *  scroll-time scenes; the still as the fallback. Recall: "pictures of the same river kept appearing between the
   *  sections, each a little further along." */
  glimpses: true,
  // ---- the page change
  /** The page change as a mist dissolve (340 ms): mist gathers and clears across the hero window only, right of the
   *  words; a long jump cross-dissolves the old place into the new one. OFF (P2, the attack's A10): one grammar, the
   *  river's: the painting pans on to the next place under a plain crossfade of the words (features/navigation); a
   *  second device for the same moment fails subtraction, and the dissolve had no referent of its own. */
  silkVeil: false,
  /** The nav's current-page mark lifts off the old word at the click and is laid wet under the new one. OFF (P2): the
   *  river line's dot is the current page's one mark and travels with the reading (riverMark); nothing is lifted or
   *  laid. */
  navMark: false,
  // ---- the chrome
  /** The river line (components/layout/RiverLine): a hairline under the header's row with a tick per stop and a jade
   *  dot that stands under the current page's tick and travels to the next stop as the page scrolls. Subtraction:
   *  off, "where am I on the whole scroll" between the stops is lost and the current page has no mark. Referent: the
   *  reading's distance along the river, the same as the unroll's. Control: the scroll's, on the compositor (a CSS
   *  scroll timeline). Cost: 0 bytes per frame; the finished state (the dot under the stop) is the default CSS;
   *  reduced motion and Still keep it there. Recall: "a dot moved along a line under the menu as I read." */
  riverMark: true,
  // ---- the interface
  /** The name's swash laid down after the name's ink settle, and one warm wet sheen along it, once, when the morning's
   *  light is up (the first load only). OFF (P2): the name at a fifth of the screen is the gesture; the swash was
   *  ornament with no referent. */
  swash: false,
  /** The story map: the current place holds its sun (a warmth, not a disc, no tick); hovering another raises its light.
   *  OFF (P2): the story map is gone (the river line in the header carries "you are here"; the tail names the places). */
  sun: false,
  /** A small ink dot runs along Work's diagrams' arrows once per hover, in flow order (no glow). */
  flow: true,
  /** Focus and selection: a 2 px ink ring with a jade second line; selection in glow-tinted paper; a jade scrollbar
   *  (effects.css). On: feedback for the keyboard, with the control itself as its referent. */
  focus: true,
  /** Rows: a 1.5 px jade rule drawn in from the left on the row's bottom border on hover and focus (nothing behind
   *  the text). On: feedback with a referent (the row under the hand). */
  rowrule: true,
  /** The story map kept a little light on the places visited this session. Off: the story map is gone (P2). */
  visited: false,
};

export type ElementName = keyof typeof ELEMENTS;

const QA = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_INK_QA === '1';

/** The QA overrides in this browser (none in production): flag -> on or off. In the worker (no document, no storage)
 *  only the lists the engine passes with each layer (figure-source.ts) count. */
// (globalThis, never `typeof window`: the bundler folds `typeof window` to "object" in client code, the figure worker
// included, where window is not defined; reading it there threw and sent every Home layer to the main-thread fallback,
// which has no sprites)
function qaOverrides(): Map<string, boolean> {
  const o = new Map<string, boolean>();
  if (!QA) return o;
  const g = globalThis as unknown as {
    document?: unknown;
    localStorage?: Storage;
    __elOff?: unknown;
    __elOn?: unknown;
  };
  if (g.document) {
    try {
      const j = JSON.parse(g.localStorage?.getItem('ink-elements') || '{}') as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) if (typeof v === 'boolean') o.set(k, v);
    } catch {
      /* no storage: the defaults */
    }
  }
  if (Array.isArray(g.__elOff)) for (const k of g.__elOff) o.set(String(k), false);
  if (Array.isArray(g.__elOn)) for (const k of g.__elOn) o.set(String(k), true);
  return o;
}

/** Is this element on (the table, unless a QA override says otherwise)? */
export function elementOn(name: ElementName): boolean {
  const o = qaOverrides().get(name);
  return o === undefined ? ELEMENTS[name] : o;
}
/** Short alias (the engine and the sets). */
export const el = elementOn;

/** QA only: the overrides to hand the figure worker with a layer (it reads no storage and no window). */
export function qaOverrideLists(): { on: string[]; off: string[] } | undefined {
  if (!QA) return undefined;
  const on: string[] = [];
  const off: string[] = [];
  for (const [k, v] of qaOverrides()) (v ? on : off).push(k);
  return on.length || off.length ? { on, off } : undefined;
}

/** The switches the present shader reads, as GLSL #defines (an element that is off is not compiled in). */
export function elementDefines(): string {
  return [
    elementOn('silkVeil') ? '#define EL_SILK_VEIL 1' : '',
    elementOn('air') ? '#define EL_AIR 1' : '',
    elementOn('glimpses') ? '#define EL_GLIMPSE 1' : '',
    elementOn('ribbon') ? '#define EL_RIBBON 1' : '',
    elementOn('halo') ? '#define EL_HALO 1' : '',
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

/** The boot script's part (in <head>, before first paint): QA builds drop the classes of elements switched off and add
 *  those switched on (localStorage 'ink-elements' with true / false values, window.__elOff, window.__elOn). */
export function bootElements(): string {
  if (!QA) return '';
  return `try{var O=[],N=[];try{var J=JSON.parse(l&&l.getItem('ink-elements')||'{}');for(var k in J){if(J[k]===false)O.push(k);else if(J[k]===true)N.push(k)}}catch(e){}if(Array.isArray(w.__elOff))O=O.concat(w.__elOff);if(Array.isArray(w.__elOn))N=N.concat(w.__elOn);O.forEach(function(n){h.classList.remove('el-'+n)});N.forEach(function(n){h.classList.add('el-'+n)})}catch(e){}`;
}

/** Is this interface element on right now (its <html> class: the flag, a QA override or a runtime toggle)? */
export const fxOn = (k: ElementName): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains(`el-${k}`);
