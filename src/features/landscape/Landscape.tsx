'use client';

import { useEffect, useRef } from 'react';
import { isStill } from '@/features/chrome/still';
import { landscape } from './store';
import { currentMain, placeOf, targetsOf } from './targets';
import type { EngineModule, LandscapeHandle } from './types';

/**
 * The landscape: one fixed canvas behind everything, persistent across pages (it lives in the root layout).
 * The engine (./engine) paints the page's scene into its windows (the strip, the closing), the living ground
 * on Home and Work on wide screens, and the faint ink horizon between them on desktops. Decorative.
 *
 * It loads on its own, after the page's first paint: the text never waits for the painting (the first mount
 * compiles shaders and paints a whole scene in one task). Without a usable renderer html.no-landscape shows
 * the static ridge hint instead. Strict-Mode safe: mountLandscape() replaces any earlier mount on the canvas.
 */
const afterFirstPaint = () =>
  new Promise<void>((resolve) => {
    if (document.visibilityState === 'hidden') resolve();
    else requestAnimationFrame(() => setTimeout(resolve, 0));
  });

export function Landscape() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const html = document.documentElement;
    if (!canvas) return;
    let dead = false;
    let handle: LandscapeHandle | null = null;
    void (async () => {
      try {
        // (typed as the contract, so the engine's real signature is checked against it)
        const [mod]: [EngineModule, void] = await Promise.all([import('./engine'), afterFirstPaint()]);
        if (dead) return;
        const main = currentMain();
        const place = main ? placeOf(main) : null;
        handle = mod.mountLandscape(canvas, {
          stretch: place?.stretch ?? 0,
          distance: place?.distance ?? 'level',
          presence: place?.presence ?? 1,
          palette: 'misted',
          ...(main ? targetsOf(main) : {}),
          still: isStill(),
          arrival: 'bloom',
        });
        html.classList.toggle('no-landscape', handle.mode === 'static');
        landscape.set(handle);
        // QA builds only: the probes judge the painting through the handle, and tools/build-stills.ts remounts
        // the engine module itself (no veils, a fixed resolution) to cut the story map's stills
        if (process.env.NEXT_PUBLIC_INK_QA === '1')
          Object.assign(window as unknown as { __ink?: LandscapeHandle; __inkEngine?: EngineModule }, {
            __ink: handle,
            __inkEngine: mod,
          });
      } catch (err) {
        console.warn('landscape unavailable', err);
        html.classList.add('no-landscape');
        landscape.set(null);
      }
    })();
    return () => {
      dead = true;
      handle?.destroy();
      landscape.reset();
      html.classList.remove('no-landscape');
    };
  }, []);

  return <canvas ref={ref} className="landscape" aria-hidden="true" />;
}
