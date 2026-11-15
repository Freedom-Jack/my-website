/**
 * Where each page stands in the one painting (DESIGN.md §7, design-demo/README "The pages").
 *
 * One river runs the whole scroll (round 5): it falls from his mountain (Home), runs past the river town where
 * the work gets done (Work and its cases), opens into the still lake by the pavilion where he writes (Writing, the
 * notes), narrows at the foot of the terraced fields of his record (Résumé) and opens into the crossing, where the
 * ferry brings you across to meet him (Contact). Beyond the water, off the map, the path climbs a lone peak into
 * mist (404). One place per stretch, in the nav's order.
 *
 * The page renders its <main> from this table (components/page/PageMain), and the navigation reads it to
 * prepare the destination's painting before the new page arrives, so the two never disagree.
 */

// (with its extension: tools/build-stills.ts loads this file in Node's own TypeScript, which resolves no bare paths)
import { ELEMENTS } from './elements.ts';

/** The scroll motion (elements.ts unroll, or the camera's travel): every page on the map is a living ground; with
 *  neither on, only Home and Work are (4b). */
const TRAVEL: 'living' | '' = ELEMENTS.unroll || ELEMENTS.cameraTravels ? 'living' : '';
/** The unroll: the deep pages (a case, a note) are living ground too, and open inside their place (`inside`). */
const DEEP: 'living' | '' = ELEMENTS.unroll ? 'living' : '';

export type Distance = 'level' | 'high' | 'deep';
export type PageId = 'home' | 'work' | 'case' | 'writing' | 'article' | 'resume' | 'contact' | 'not-found';

export interface Place {
  /** The page's id: <main data-page>, its CSS Module's scope. */
  page: PageId;
  /** Position along the handscroll: Home 0, Work 1, Writing 2, Résumé 3, Contact 4, 404 5 (round 5: one place per
   *  stretch; the road, a stretch with no page between Work and Writing, is gone). */
  stretch: number;
  /**
   * The composition the page paints the scroll with: the same on every page (round 5: one world, compose.ts WORLD), so
   * a place looks the same from every page and the scenes line up. A page with its own would re-compose the whole
   * scroll while it shows (tests/unit/rules.test.ts keeps them equal).
   */
  distance: Distance;
  presence: number;
  /** 0..1: the desktop ink horizon's presence between the strip and the closing. */
  horizon: number;
  /** 'living' (Home, Work): the page's own scene is its ground on wide screens painted by a hardware GPU. */
  ground: 'living' | '';
  /**
   * The hero's kind (round 5: one hero system): home (the landing page's tall hero) or sub (every other page: the
   * same height, the title at the same place). 'doc' (the low art-only band the Résumé and the Note had)
   * is unused; it and the engine's framing for it go once Jack approves the round-5 heroes.
   */
  strip: 'home' | 'sub' | 'doc';
  /**
   * Every page on the map ends the same way: on its own closing scene, a different view of the same place, then
   * the footer's story map. The 404 lies off the map, so its path just ends in mist (no closing).
   */
  closing: boolean;
  /**
   * (the vanguard round) A deep page (a case, a note) opens INSIDE its place: its hero looks closer (compose.ts
   * HERO.inside) and further along the place (the scene's Frame.insideU), rather than on the place's postcard. A page
   * may name its own stretch-local u instead (A2's sub-anchors: a case's own quay in the town), which <main>'s
   * data-inside carries as a number.
   */
  inside?: boolean | number;
}

export const PLACES: Readonly<Record<PageId, Place>> = {
  home: {
    page: 'home',
    stretch: 0,
    distance: 'level',
    presence: 1,
    horizon: 0.6,
    ground: 'living',
    strip: 'home',
    closing: true,
  },
  work: {
    page: 'work',
    stretch: 1,
    distance: 'level',
    presence: 1,
    horizon: 0.55,
    ground: 'living',
    strip: 'sub',
    closing: true,
  },
  case: {
    page: 'case',
    stretch: 1,
    distance: 'level',
    presence: 1,
    horizon: 0.55,
    // (the unroll: a case is a living ground too, and opens inside the town, east of the bridge)
    ground: DEEP,
    strip: 'sub',
    closing: true,
    inside: !!DEEP,
  },
  writing: {
    page: 'writing',
    stretch: 2,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: TRAVEL,
    strip: 'sub',
    closing: true,
  },
  article: {
    page: 'article',
    stretch: 2,
    distance: 'level',
    presence: 1,
    horizon: 0.35,
    // (the unroll: a note opens inside the lake, the pavilion close)
    ground: DEEP,
    strip: 'sub',
    closing: true,
    inside: !!DEEP,
  },
  resume: {
    page: 'resume',
    stretch: 3,
    distance: 'level',
    presence: 1,
    horizon: 0.35,
    ground: TRAVEL,
    strip: 'sub',
    closing: true,
  },
  contact: {
    page: 'contact',
    stretch: 4,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: TRAVEL,
    strip: 'sub',
    closing: true,
  },
  'not-found': {
    page: 'not-found',
    stretch: 5,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: '',
    strip: 'sub',
    closing: false,
  },
};

/** A path as the site writes it: a trailing slash on every page route, none on files (/resume.pdf). */
export function normPath(path: string): string {
  const p = path.split(/[?#]/)[0] || '/';
  if (p.endsWith('/') || /\.[a-z0-9]+$/i.test(p)) return p;
  return `${p}/`;
}

/**
 * The place a path leads to, before its page has arrived. A path that turns out not to exist renders the
 * 404, whose own <main> then corrects the painting (features/navigation).
 */
export function placeForPath(path: string): Place {
  const p = normPath(path);
  if (p === '/') return PLACES.home;
  if (p === '/work/') return PLACES.work;
  if (/^\/work\/[^/]+\/$/.test(p)) return PLACES.case;
  if (p === '/writing/') return PLACES.writing;
  if (/^\/writing\/[^/]+\/$/.test(p)) return PLACES.article;
  if (p === '/resume/') return PLACES.resume;
  if (p === '/contact/') return PLACES.contact;
  return PLACES['not-found'];
}

/** The five places in the painting's order (not the nav's), each a link: the river line's stops and the tail's names
 *  (the vanguard round; before it, the footer's story map, whose stills tools/build-stills.ts still names). */
export const STORY_MAP = [
  { stretch: 0, label: 'Home', href: '/', still: 'home' },
  { stretch: 1, label: 'Work', href: '/work/', still: 'work' },
  { stretch: 2, label: 'Writing', href: '/writing/', still: 'writing' },
  { stretch: 3, label: 'Résumé', href: '/resume/', still: 'resume' },
  { stretch: 4, label: 'Contact', href: '/contact/', still: 'contact' },
] as const;

/**
 * The way on (the vanguard round's endings, components/page/NextPlace): every page but Contact and the 404 ends on
 * the next place downstream. A case ends on the place after the town; a note on the place after the lake. The
 * ending's words come from that page's own content.
 */
export const NEXT_PLACE: Readonly<Partial<Record<PageId, { page: PageId; href: string; label: string }>>> = {
  home: { page: 'work', href: '/work/', label: 'Work' },
  work: { page: 'writing', href: '/writing/', label: 'Writing' },
  case: { page: 'writing', href: '/writing/', label: 'Writing' },
  writing: { page: 'resume', href: '/resume/', label: 'Résumé' },
  article: { page: 'resume', href: '/resume/', label: 'Résumé' },
  resume: { page: 'contact', href: '/contact/', label: 'Contact' },
};
