import type { CSSProperties, ReactNode } from 'react';
import heroes from '../../../public/scenes/hero/manifest.json';

/**
 * The painted strip every page opens on: an empty art box the painting fills (the text never depends on it:
 * the layout is the same with JS off, WebGL off, or the engine still loading), then the page's title block.
 *   home, sub: on wide screens (≥ 1200) the title sits in the art's mist (the keep-out: no colour or figures
 *              under it); below, on paper under the art.
 * `still`: the page's place on the map (home, work, writing, resume, contact), or a deep page's own opening (case,
 * note: inside its place): its hero's still (public/scenes/hero/<place>-<class>@1x|2x.webp, cut by build:heroes from
 * the engine's own first frame at each width class) is the first screen's painting from the first paint, before any
 * script (and the no-JS and no-WebGL painting). On wide screens and tablets it is a <picture> source; on phones the
 * <img> is the place's ~1 KB seed (the phone still shrunk and inlined as a data URI, so the first screen's painting
 * costs no request and, being low in entropy, never becomes the LCP element), and the sharp phone still stands over it
 * in a second <picture>, requested with the first paint at low priority (the first screen is complete when it
 * decodes, well before the painting; above 40 rem its source is a 1 × 1 blank, so laptops and tablets never fetch
 * it). The engine's first frame lands finished under them and they fade out over 300 ms (layout.css .strip__still,
 * html[data-live], the strip's [data-live]). Without one the box is empty until the engine paints it (the 404).
 * On Home, a case, a note and the Résumé (build-heroes INLINE_SHARP) the seed is the sharp phone@1x still itself
 * (3–6 KB inline): the painting is sharp at first paint and is the LCP at FCP, so only the @2x still is laid over it,
 * and only at DPR 2 and above on phones up to the cut's 430 px (the phone class is cut 430 wide and covers the box at
 * every phone width, never upscaled: the @2x is the same box, so no new LCP candidate). Work (SEED_ALONE) keeps its
 * seed alone: with JavaScript its sharp still is never requested, even where no painting comes (the probe answers
 * that only after the scripts, and a sharp still arriving then would be Work's LCP); it stands over the seed only
 * without JavaScript (.strip__fallback). A sharp still that fails to load is hidden (the boot script's error
 * listener), so a broken-image box never shows over the seed.
 * Without JS or a landscape, the box shows a faint static ridge hint (layout.css) under the still, if any.
 */
type HeroPlace = 'home' | 'work' | 'writing' | 'resume' | 'contact' | 'case' | 'note';
type HeroClass = 'wide' | 'tablet' | 'phone';
interface HeroEntry {
  box: [number, number];
  files: Record<'1' | '2', string>;
  /** The phone's seed (phone class only): the inline first frame, base64 WebP. */
  seed?: { file: string; bytes: number; data: string; sharp?: boolean };
}
interface HeroManifest {
  classes: Partial<Record<HeroClass, { media: string; viewport: [number, number] }>>;
  stills: Partial<Record<HeroPlace, Partial<Record<HeroClass, HeroEntry>>>>;
}
const HERO = heroes as unknown as HeroManifest;
/** A 1 × 1 transparent GIF: the sharp phone still's source above 40 rem (no request there). */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Where the inline sharp seed stands alone, with no @2x over it: below DPR 2 (the seed is the 1x still), and wider
 *  than the cut's 430 px, where the seed is upscaled, so Chrome would count the @2x laid over it as a larger LCP
 *  candidate when it lands (an upscaled seed puts Home's LCP at the @2x's arrival: 2.6 s on Lighthouse's phone). Every
 *  phone up to 430 px at DPR 2 and above gets the @2x over the same box. (The DPR line is 1.99dppx: at 1.5dppx,
 *  Lighthouse's phone (412 px, DPR 1.75) would fetch the @2x at low priority before the LCP, and Lantern's graph would
 *  hold the LCP for it: 2.53 s on Home and the case.) */
const SHARP_SEED_ONLY = '(min-width: 431px), (max-resolution: 1.99dppx)';
/** The places whose phone seed stands alone (no eager sharp still: Lighthouse's simulation queues it behind the
 *  scripts and makes it the LCP, 2.6 s; with the low-entropy seed alone the LCP is the words). Their sharp still is a
 *  CSS background (.strip__fallback), shown (and so fetched) only without JavaScript: where the probe keeps the still,
 *  the seed stays (a sharp still that late becomes the LCP again: 2.9 s on Lighthouse's phone). */
const SEED_ALONE: ReadonlySet<HeroPlace> = new Set<HeroPlace>(['work']);

/** The hero's still: one source per width class the tool cut (the engine frames each class differently). */
function HeroStill({ place }: { place: HeroPlace }) {
  const s = HERO.stills[place];
  const phone = s?.phone;
  const seed = phone?.seed;
  if (!s || !phone || !seed) return null;
  const src = (c: HeroClass, d: '1' | '2') => `/scenes/hero/${s[c]!.files[d]}`;
  const set = (c: HeroClass) => `${src(c, '1')} 1x, ${src(c, '2')} 2x`;
  // (the img itself is the phone cut, its inline seed; the wider classes are sources before it)
  const sources = (['wide', 'tablet'] as const).filter((c) => s[c] && HERO.classes[c]);
  // (no <link rel="preload"> for the still: measured on the phone profile, a head preload per width class brings the
  // image 50–90 ms sooner for 31 KB more on the wire, with no change to its render time or to Lighthouse)
  return (
    <>
      <picture className="strip__still strip__still--seed">
        {sources.map((c) => (
          <source key={c} media={HERO.classes[c]!.media} srcSet={set(c)} width={s[c]!.box[0]} height={s[c]!.box[1]} />
        ))}
        <img
          src={`data:image/webp;base64,${seed.data}`}
          width={phone.box[0]}
          height={phone.box[1]}
          alt=""
          decoding="async"
          fetchPriority="high"
          {...{ elementtiming: 'strip-still' }}
        />
      </picture>
      {SEED_ALONE.has(place) ? (
        <span
          className="strip__fallback"
          style={
            {
              '--hero-sharp': `image-set(url('${src('phone', '1')}') 1x, url('${src('phone', '2')}') 2x)`,
            } as CSSProperties
          }
        />
      ) : (
        <picture className="strip__still strip__still--sharp">
          <source media={seed.sharp ? SHARP_SEED_ONLY : '(min-width: 40rem)'} srcSet={BLANK} />
          <img
            src={seed.sharp ? src('phone', '2') : src('phone', '1')}
            srcSet={seed.sharp ? undefined : set('phone')}
            width={phone.box[0]}
            height={phone.box[1]}
            alt=""
            decoding="async"
            fetchPriority="low"
            {...{ elementtiming: 'strip-still-sharp' }}
          />
        </picture>
      )}
    </>
  );
}

export function Strip({
  variant,
  labelledBy,
  children,
  veil = 0.85,
  still,
}: {
  variant: 'home' | 'sub';
  labelledBy?: string;
  children: ReactNode;
  veil?: number;
  still?: HeroPlace;
}) {
  return (
    <header className={`strip strip--${variant}`} aria-labelledby={labelledBy}>
      <div className="strip__art bleed" data-landscape="strip" data-wake="" aria-hidden="true">
        {still ? <HeroStill place={still} /> : null}
      </div>
      <div className="strip__text" data-landscape="keepout" data-veil={veil}>
        {children}
      </div>
    </header>
  );
}
