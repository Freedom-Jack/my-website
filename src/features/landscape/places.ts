/**
 * Where each page stands in the one painting.
 *
 * One river runs the whole scroll: it falls from his mountain (Home), runs past the river town where the work gets
 * done (Work and its cases), opens into the still lake by the pavilion where he writes (Writing, the notes), narrows
 * at the foot of the terraced fields of his record (Résumé) and opens into the crossing, where the ferry brings you
 * across to meet him (Contact). Beyond the water, off the map, the path climbs a lone peak into mist (404). One place
 * per stretch, in the nav's order.
 *
 * The page renders its <main> from this table (components/page/PageMain), and the navigation reads it to
 * prepare the destination's painting before the new page arrives, so the two never disagree.
 */

export type Distance = 'level' | 'high' | 'deep';
export type PageId = 'home' | 'work' | 'case' | 'writing' | 'article' | 'resume' | 'contact' | 'not-found';

export interface Place {
  /** The page's id: <main data-page>, its CSS Module's scope. */
  page: PageId;
  /** Position along the handscroll, one place per stretch: Home 0, Work 1, Writing 2, Résumé 3, Contact 4, 404 5. */
  stretch: number;
  /**
   * The composition the page paints the scroll with: the same on every page (one world, compose.ts WORLD), so a place
   * looks the same from every page and the scenes line up. A page with its own would re-compose the whole scroll
   * while it shows (tests/unit/rules.test.ts keeps them equal).
   */
  distance: Distance;
  presence: number;
  /** 0..1: the desktop ink horizon's presence between the strip and the closing. */
  horizon: number;
  /** 'living' (every page on the map): the page's own scene is its ground on wide screens painted by a hardware GPU. */
  ground: 'living' | '';
  /**
   * The hero's kind: home (the landing page's tall hero) or sub (every other page: the same height, the title at the
   * same place).
   */
  strip: 'home' | 'sub';
  /**
   * Every page on the map ends the same way: on its own closing scene, a different view of the same place, then
   * the footer's scroll map (components/layout/ScrollMap). The 404 lies off the map, so its path just ends in mist
   * (no closing).
   */
  closing: boolean;
  /**
   * A deep page (a case, a note) opens inside its place: its hero looks closer (compose.ts HERO.inside) and further
   * along the place (the scene's Frame.insideU), rather than on the place's postcard. A number names the page's own
   * stretch-local u instead, which <main>'s data-inside carries.
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
    // (a case is a living ground too, and opens inside the town, east of the bridge)
    ground: 'living',
    strip: 'sub',
    closing: true,
    inside: true,
  },
  writing: {
    page: 'writing',
    stretch: 2,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: 'living',
    strip: 'sub',
    closing: true,
  },
  article: {
    page: 'article',
    stretch: 2,
    distance: 'level',
    presence: 1,
    horizon: 0.35,
    // (a note opens inside the lake, the pavilion close)
    ground: 'living',
    strip: 'sub',
    closing: true,
    inside: true,
  },
  resume: {
    page: 'resume',
    stretch: 3,
    distance: 'level',
    presence: 1,
    horizon: 0.35,
    ground: 'living',
    strip: 'sub',
    closing: true,
  },
  contact: {
    page: 'contact',
    stretch: 4,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: 'living',
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

/** The five places in the painting's order: the links of the footer's scroll map (components/layout/ScrollMap) and the
 *  stops of the scroll, held (features/scroll). `still` is the place's key into scroll.json `places`. */
export const SCROLL_MAP = [
  { stretch: 0, label: 'Home', href: '/', still: 'home' },
  { stretch: 1, label: 'Work', href: '/work/', still: 'work' },
  { stretch: 2, label: 'Writing', href: '/writing/', still: 'writing' },
  { stretch: 3, label: 'Résumé', href: '/resume/', still: 'resume' },
  { stretch: 4, label: 'Contact', href: '/contact/', still: 'contact' },
] as const;

/**
 * The way on (components/page/NextPlace): every page but Contact and the 404 ends on the next place downstream. A
 * case ends on the place after the town; a note on the place after the lake. The ending's words come from that
 * page's own content.
 * `inked`: the next place's name is inked into the painting (body.css .inked: behind the place's leaf), where the
 * page's travel has brought the next place under it by the page's end (Home, Writing, a note). Where the travel
 * holds the page's own place beside the words (the engine's hold: Work, a case, the Résumé), that place still
 * stands where the name does, and its roofs or its hill would cover the letters: there the name stands in front.
 */
export const NEXT_PLACE: Readonly<
  Partial<Record<PageId, { page: PageId; href: string; label: string; inked: boolean }>>
> = {
  home: { page: 'work', href: '/work/', label: 'Work', inked: true },
  work: { page: 'writing', href: '/writing/', label: 'Writing', inked: false },
  case: { page: 'writing', href: '/writing/', label: 'Writing', inked: false },
  writing: { page: 'resume', href: '/resume/', label: 'Résumé', inked: true },
  article: { page: 'resume', href: '/resume/', label: 'Résumé', inked: true },
  resume: { page: 'contact', href: '/contact/', label: 'Contact', inked: false },
};
