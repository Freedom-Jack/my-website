import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf } from '@/features/landscape/targets';

/**
 * The search's pan (the attack's A2): on a wide screen with a fine pointer, a focused result moves the painting to its
 * passage's place, but only while the painting is live (`html[data-live="on"]`) and the page's strip is on screen
 * (IntersectionObserver), 150 ms after the focus settles. A result at the page's own view does not move it, and when
 * the focus leaves the results the painting goes back. On a phone it never moves (the "show the place" still instead).
 */
export interface Target {
  stretch: number;
  u: number | null;
}

export function makePanner() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let panned = false;
  let stripOn = false;
  const strip = currentMain()?.querySelector('[data-landscape="strip"]');
  const io =
    strip && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => {
          stripOn = es.some((e) => e.isIntersecting);
        })
      : null;
  if (strip && io) io.observe(strip);
  const wide = () => matchMedia('(pointer: fine)').matches && innerWidth >= 1200;
  const live = () => document.documentElement.getAttribute('data-live') === 'on';

  const go = (t: Target | null) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        const h = landscape.get();
        const main = currentMain();
        if (!h || !main) return;
        const own = placeOf(main).stretch;
        if (!t || (t.stretch === own && t.u === null)) {
          if (panned) {
            panned = false;
            await h.panTo(own);
          }
          return;
        }
        if (!wide() || !live() || !stripOn) return;
        const { cameraFor } = await import('@/features/landscape/engine');
        panned = true;
        await h.panTo(t.u === null ? t.stretch : cameraFor(t.stretch, t.u, 'wide'));
      })();
    }, 150);
  };
  return {
    focus: (t: Target) => go(t),
    back: () => go(null),
    destroy() {
      clearTimeout(timer);
      io?.disconnect();
    },
  };
}
export type Panner = ReturnType<typeof makePanner>;
