/**
 * Where each page stands in the one painting (DESIGN.md §7, design-demo/README "The pages").
 *
 * A traveller sets out from his mountain (Home) and comes down to the river town where the work gets done
 * (Work and its cases), climbs through the terraced fields of his record (Résumé) and reaches the ferry
 * (Contact). Off the road, by the still lake, is the pavilion where he writes (Writing, the notes). Off the
 * road entirely, the path fades into mist (404).
 *
 * The page renders its <main> from this table (components/page/PageMain), and the navigation reads it to
 * prepare the destination's painting before the new page arrives, so the two never disagree.
 */

export type Distance = 'level' | 'high' | 'deep';
export type PageId = 'home' | 'work' | 'case' | 'writing' | 'article' | 'resume' | 'contact' | 'not-found';

export interface Place {
  /** The page's id: <main data-page>, its CSS Module's scope. */
  page: PageId;
  /** Position along the handscroll: Home 0, Work 1, (the road 2: no page), Writing 3, Résumé 4, Contact 5, 404 6. */
  stretch: number;
  /** The composition preset ("three distances"). */
  distance: Distance;
  /** 0..1: how strongly the page's scene shows in its strip and closing. */
  presence: number;
  /** 0..1: the desktop ink horizon's presence between the strip and the closing. */
  horizon: number;
  /** 'living' (Home, Work): the page's own scene is its ground on wide screens painted by a hardware GPU. */
  ground: 'living' | '';
  /** The strip's kind: home (the tall hero), sub (a subpage), doc (a low band over a document). */
  strip: 'home' | 'sub' | 'doc';
  /** Long pages end on their own closing scene; short ones (Writing, Contact, the 404) on the story map alone. */
  closing: boolean;
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
    distance: 'deep',
    presence: 0.8,
    horizon: 0.55,
    ground: 'living',
    strip: 'sub',
    closing: true,
  },
  case: {
    page: 'case',
    stretch: 1,
    distance: 'deep',
    presence: 0.8,
    horizon: 0.55,
    ground: '',
    strip: 'sub',
    closing: true,
  },
  writing: {
    page: 'writing',
    stretch: 3,
    distance: 'level',
    presence: 0.6,
    horizon: 0.5,
    ground: '',
    strip: 'sub',
    closing: false,
  },
  article: {
    page: 'article',
    stretch: 3,
    distance: 'level',
    presence: 0.45,
    horizon: 0.35,
    ground: '',
    strip: 'doc',
    closing: true,
  },
  resume: {
    page: 'resume',
    stretch: 4,
    distance: 'level',
    presence: 0.5,
    horizon: 0.35,
    ground: '',
    strip: 'doc',
    closing: true,
  },
  contact: {
    page: 'contact',
    stretch: 5,
    distance: 'level',
    presence: 0.9,
    horizon: 0.5,
    ground: '',
    strip: 'sub',
    closing: false,
  },
  'not-found': {
    page: 'not-found',
    stretch: 6,
    distance: 'high',
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

/** The footer's story map: the five places in the painting's order (not the nav's), each a link. */
export const STORY_MAP = [
  { stretch: 0, label: 'Home', href: '/', still: 'home' },
  { stretch: 1, label: 'Work', href: '/work/', still: 'work' },
  { stretch: 3, label: 'Writing', href: '/writing/', still: 'writing' },
  { stretch: 4, label: 'Résumé', href: '/resume/', still: 'resume' },
  { stretch: 5, label: 'Contact', href: '/contact/', still: 'contact' },
] as const;
