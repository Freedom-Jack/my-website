/**
 * Where each page stands in the one painting.
 *
 * One river runs the whole scroll: it falls from his mountain (Home), runs past the river town where the work gets
 * done (Work and its cases), opens into the still lake by the pavilion where he writes (Writing, the notes), narrows
 * at the foot of the terraced fields of his record (Résumé) and opens into the crossing, where the ferry brings you
 * across to meet him (Contact). About stands on his mountain too, beside Home. Beyond the water, off the map, the path climbs a lone peak into mist (404). One place
 * per stretch, in the nav's order.
 *
 * The page renders its <main> from this table (components/page/PageMain), and the navigation reads it to
 * prepare the destination's painting before the new page arrives, so the two never disagree.
 */

export type Distance = 'level' | 'high' | 'deep';
export type PageId = 'home' | 'about' | 'work' | 'case' | 'writing' | 'article' | 'resume' | 'contact' | 'not-found';

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
  /** 0..1: the ink horizon's presence where the engine paints it (it does not under the stage). */
  horizon: number;
  /** 'living' (every page): the page's own scene is painted as the stage, the band's live painting on wide screens
   *  with a hardware GPU (styles/band.css). */
  ground: 'living' | '';
  /**
   * A deep page (a case, a note) opens inside its place: its band looks closer (compose.ts HERO.inside) and further
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
  },
  about: {
    page: 'about',
    stretch: 0,
    distance: 'level',
    presence: 1,
    horizon: 0.6,
    // (About stands where Home does, on his mountain: the two pages share the place)
    ground: 'living',
  },
  work: {
    page: 'work',
    stretch: 1,
    distance: 'level',
    presence: 1,
    horizon: 0.55,
    ground: 'living',
  },
  case: {
    page: 'case',
    stretch: 1,
    distance: 'level',
    presence: 1,
    horizon: 0.55,
    // (a case is a living ground too, and opens inside the town, east of the bridge)
    ground: 'living',
    inside: true,
  },
  writing: {
    page: 'writing',
    stretch: 2,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: 'living',
  },
  article: {
    page: 'article',
    stretch: 2,
    distance: 'level',
    presence: 1,
    horizon: 0.35,
    // (a note opens inside the lake, the pavilion close)
    ground: 'living',
    inside: true,
  },
  resume: {
    page: 'resume',
    stretch: 3,
    distance: 'level',
    presence: 1,
    horizon: 0.35,
    ground: 'living',
  },
  contact: {
    page: 'contact',
    stretch: 4,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: 'living',
  },
  'not-found': {
    page: 'not-found',
    stretch: 5,
    distance: 'level',
    presence: 1,
    horizon: 0.5,
    ground: 'living',
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
  if (p === '/about/') return PLACES.about;
  if (p === '/work/') return PLACES.work;
  if (/^\/work\/[^/]+\/$/.test(p)) return PLACES.case;
  if (p === '/writing/') return PLACES.writing;
  if (/^\/writing\/[^/]+\/$/.test(p)) return PLACES.article;
  if (p === '/resume/') return PLACES.resume;
  if (p === '/contact/') return PLACES.contact;
  return PLACES['not-found'];
}

/** The five places in the painting's order, one per stretch. `still` is the place's key into the band manifest's
 *  transit `places` (public/scenes/band/manifest.json): where it stands along the whole scroll's strip, which the
 *  flight between two pages uses where the engine does not run. */
export const SCROLL_MAP = [
  { stretch: 0, label: 'Home', href: '/', still: 'home' },
  { stretch: 1, label: 'Work', href: '/work/', still: 'work' },
  { stretch: 2, label: 'Writing', href: '/writing/', still: 'writing' },
  { stretch: 3, label: 'Résumé', href: '/resume/', still: 'resume' },
  { stretch: 4, label: 'Contact', href: '/contact/', still: 'contact' },
] as const;

/**
 * The place downstream of each page: how far the painting unrolls while the page is read (band-geometry: a share of
 * the way to it). A case counts from the place after the town; a note from the place after the lake. No page links
 * to it: a page stands alone, and the way to every other page is the header's.
 */
export const NEXT_PLACE: Readonly<Partial<Record<PageId, { page: PageId; href: string; label: string }>>> = {
  home: { page: 'work', href: '/work/', label: 'Work' },
  about: { page: 'work', href: '/work/', label: 'Work' },
  work: { page: 'writing', href: '/writing/', label: 'Writing' },
  case: { page: 'writing', href: '/writing/', label: 'Writing' },
  writing: { page: 'resume', href: '/resume/', label: 'Résumé' },
  article: { page: 'resume', href: '/resume/', label: 'Résumé' },
  resume: { page: 'contact', href: '/contact/', label: 'Contact' },
};
