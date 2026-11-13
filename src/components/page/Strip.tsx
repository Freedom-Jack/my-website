import type { CSSProperties, ReactNode } from 'react';
import heroes from '../../../public/scenes/hero/manifest.json';

/**
 * The painted strip every page opens on: an EMPTY art box the painting fills (the text never depends on it:
 * the layout is the same with JS off, WebGL off, or the engine still loading), then the page's title block.
 *   home, sub: on wide screens (≥ 1200) the title sits in the art's mist (the keep-out: no colour or figures
 *              under it); below, on paper under the art.
 *   doc:       a low band over a document (the Résumé, a note): art only; the h1 follows it, outside.
 * `still`: the page's place on the map (home, work, writing, resume, contact), or a deep page's own opening (case,
 * note: inside its place, the vanguard round): its hero's still (public/scenes/hero/<place>-<class>@1x|2x.webp, cut by
 * build:heroes from the engine's own first frame at each width class) is the first screen's painting from the first
 * paint, before any script (and the no-JS and no-WebGL painting). On wide screens and tablets it is a <picture>
 * source; on phones the <img> is the place's ~1 KB seed (the phone still shrunk and inlined as a data URI, so the first
 * screen's painting costs no request and, being low in entropy, never becomes the LCP element), and the sharp phone
 * still stands over it in a second <picture>, requested with the first paint at low priority (the lead's ruling R5:
 * the first screen is complete when it decodes, well before the painting; above 40 rem its source is a 1 × 1 blank, so
 * laptops and tablets never fetch it). The engine's first frame lands finished under them and they fade out over
 * 300 ms (layout.css .strip__still, html[data-live], the strip's [data-live]). Without one the box is empty until the
 * engine paints it (the 404). On Home, a case, a note and the Résumé (the lead's ruling R9; build-heroes INLINE_SHARP)
 * the seed is the sharp phone@1x still itself (3–6 KB inline): the painting is sharp at first paint and is the LCP at
 * FCP, so only the @2x still is laid over it, and only at DPR 2 and above on phones up to the cut's 430 px (the phone
 * class is cut 430 wide and covers the box at every phone width, never upscaled: the @2x is the same box, so no new LCP
 * candidate; the lead's ruling R12). Work (SEED_ALONE, R12) keeps its seed alone on the first screen: its sharp still
 * is no request there and stands over the seed only where no painting will come (.strip__fallback). A sharp still
 * that fails to load is hidden (the boot script's error listener), so a broken-image box never shows over the seed.
 * Without JS or a landscape, the box shows a faint static ridge hint (layout.css) under the still, if any.
 */
export type HeroPlace = 'home' | 'work' | 'writing' | 'resume' | 'contact' | 'case' | 'note';
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

/** R9, R12: where the inline sharp seed stands alone, with no @2x over it: below DPR 2 (the seed is the 1x still), and
 *  wider than the cut's 430 px, where the seed would be upscaled, so Chrome would count the @2x laid over it as a larger
 *  LCP candidate when it lands (P6 measured it at the old 390 px cut: Lighthouse's 412 px phone put Home's LCP at the
 *  @2x's arrival, 2.6 s). Every phone up to 430 px at DPR 2 and above gets the @2x over the same box. (The fix round
 *  measured the DPR line: at "1.5dppx or less", Lighthouse's phone (412 px, DPR 1.75) fetched the @2x at low priority
 *  before the LCP and Lantern's graph held it: 2.53 s in four runs of five on Home and the case.) */
const SHARP_SEED_ONLY = '(min-width: 431px), (max-resolution: 1.99dppx)';
/** R12: the places whose phone seed stands alone on the first screen (no eager sharp still: Lighthouse's simulation
 *  queued it behind the scripts and made it the LCP at 2.6 s; with the low-entropy seed alone the LCP is the words).
 *  Their sharp still is a CSS background (.strip__fallback), fetched only where it shows: no JS, no landscape, or the
 *  probe's "still". */
const SEED_ALONE: ReadonlySet<HeroPlace> = new Set<HeroPlace>(['work']);

/** The hero's still: one source per width class the tool cut (the engine frames each class differently). */
function HeroStill({ place }: { place: HeroPlace }) {
  const s = HERO.stills[place];
  if (!s) return null;
  const src = (c: HeroClass, d: '1' | '2') => `/scenes/hero/${s[c]!.files[d]}`;
  const set = (c: HeroClass) => `${src(c, '1')} 1x, ${src(c, '2')} 2x`;
  // (the img itself is the narrowest class cut; wider classes are sources before it)
  const base: HeroClass | undefined = (['phone', 'tablet', 'wide'] as const).find((c) => s[c]);
  if (!base) return null;
  const sources = (['wide', 'tablet'] as const).filter((c) => c !== base && s[c] && HERO.classes[c]);
  const seed = base === 'phone' ? s.phone?.seed : undefined;
  // (no <link rel="preload"> for the still: measured on the phone profile, a head preload per width class brought the
  // image 50–90 ms sooner for 31 KB more on the wire and no change to its render time or to Lighthouse)
  return (
    <>
      <picture className="strip__still strip__still--seed">
        {sources.map((c) => (
          <source key={c} media={HERO.classes[c]!.media} srcSet={set(c)} width={s[c]!.box[0]} height={s[c]!.box[1]} />
        ))}
        <img
          src={seed ? `data:image/webp;base64,${seed.data}` : src(base, '1')}
          srcSet={seed ? undefined : set(base)}
          width={s[base]!.box[0]}
          height={s[base]!.box[1]}
          alt=""
          decoding="async"
          fetchPriority="high"
          {...{ elementtiming: 'strip-still' }}
        />
      </picture>
      {seed && SEED_ALONE.has(place) && !seed.sharp ? (
        <span
          className="strip__fallback"
          style={
            {
              '--hero-sharp': `image-set(url('${src('phone', '1')}') 1x, url('${src('phone', '2')}') 2x)`,
            } as CSSProperties
          }
        />
      ) : seed ? (
        <picture className="strip__still strip__still--sharp">
          <source media={seed.sharp ? SHARP_SEED_ONLY : '(min-width: 40rem)'} srcSet={BLANK} />
          <img
            src={seed.sharp ? src('phone', '2') : src('phone', '1')}
            srcSet={seed.sharp ? undefined : set('phone')}
            width={s.phone!.box[0]}
            height={s.phone!.box[1]}
            alt=""
            decoding="async"
            fetchPriority="low"
            {...{ elementtiming: 'strip-still-sharp' }}
          />
        </picture>
      ) : null}
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
  variant: 'home' | 'sub' | 'doc';
  labelledBy?: string;
  children?: ReactNode;
  veil?: number;
  still?: HeroPlace;
}) {
  return (
    <header className={`strip strip--${variant}`} aria-labelledby={labelledBy}>
      <div className="strip__art bleed" data-landscape="strip" data-wake="" aria-hidden="true">
        {still ? <HeroStill place={still} /> : null}
      </div>
      {children ? (
        <div className="strip__text" data-landscape="keepout" data-veil={veil}>
          {children}
        </div>
      ) : null}
    </header>
  );
}
