import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf } from '@/features/landscape/targets';

/**
 * The search's pan: on a wide screen with a fine pointer, a focused result moves the painting to its passage's place,
 * but only while the painting is live (`html[data-live="on"]`), 150 ms after the focus settles. A result at the page's
 * own view does not move it, and when the focus leaves the results the painting goes back. On a phone it never moves
 * (the "show the place" still instead). The painting stands behind the whole page, so the pan does not wait for the
 * strip to be on screen.
 */
interface Target {
  stretch: number;
  u: number | null;
}

export function makePanner() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let panned = false;
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
        if (!wide() || !live()) return;
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
    },
  };
}
export type Panner = ReturnType<typeof makePanner>;
