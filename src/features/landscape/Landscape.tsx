'use client';

import { useEffect, useRef } from 'react';
import { isStill } from '@/features/chrome/still';
import { warmFigureSource } from './engine/figure-source';
import type { PlateStage } from './plates/sink';
import { cadence, gpuOK, limitFor as limitForState, quietNow, saveData, setLive, watchFrames } from './probe';
import { landscape } from './store';
import { currentMain, placeOf, targetsOf } from './targets';
import type { EngineModule, LandscapeHandle } from './types';

/**
 * The live painting: the engine's canvas and its plates, inside the band (components/layout/Band), persistent across
 * pages. Decorative.
 *
 * Every device opens on the band's still (the same stage, cut ahead), so the first screen is complete before any
 * script. The engine itself is for wide screens with a hardware GPU: it is asked for only at 1200 px and up and only
 * after the probe (./probe.ts), so a phone, a tablet and a page that will not paint fetch 0 engine bytes and run no
 * frame; there the still is the painting, moved by the page's own scroll timeline. Once live the stage lands finished
 * over the still, and its layers (the plates) move with the scroll on the compositor. A window narrowed under 1200 px
 * rests the engine; widened again, it resumes. Strict-Mode safe: mountLandscape() replaces any earlier mount.
 */
const afterFirstPaint = () =>
  new Promise<void>((resolve) => {
    if (document.visibilityState === 'hidden') resolve();
    else requestAnimationFrame(() => setTimeout(resolve, 0));
  });
/** The browser's next idle moment, at the latest after `timeout` ms (at once where requestIdleCallback is missing). */
const whenIdle = (timeout: number) =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 0);
  });
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const QA = process.env.NEXT_PUBLIC_INK_QA === '1';
/** QA builds only: `window.__inkLive = true` (an init script) skips the probe and mounts regardless (the tools that
 *  cut the stills run it so). */
const qaForced = () => QA && (window as unknown as { __inkLive?: boolean }).__inkLive === true;
/** The stage's width class (engine/compose.ts widthClass: 1200 px, as px). */
const WIDE = '(min-width: 1200px)';

export function Landscape() {
  const ref = useRef<HTMLCanvasElement>(null);
  const platesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const html = document.documentElement;
    if (!canvas) return;
    let dead = false;
    let started = false;
    let handle: LandscapeHandle | null = null;
    let stopWatch: (() => void) | null = null;
    let plates: PlateStage | null = null;
    const wide = matchMedia(WIDE);
    // QA builds only: the probe's marks (why the still stands)
    const mark = (name: string) => {
      if (QA) performance.mark(`ink:${name}`);
    };
    /** No painting will come: the still is the page's painting. */
    const stillHere = (why: string) => {
      mark(`still:${why}`);
      setLive('still');
      html.classList.add('no-landscape');
      landscape.set(null);
    };
    const boot = async () => {
      if (started || dead) return;
      started = true;
      try {
        setLive('probing');
        const forced = qaForced();
        // the checks that need no frame: the width, the quiet forms, Save-Data (never a byte of the engine without them)
        if (!wide.matches) {
          started = false; // (a window widened later asks again, onWide below)
          return stillHere('narrow');
        }
        if (!forced && quietNow()) {
          started = false; // ("Still the landscape" switched off later asks again, onStill below)
          return stillHere('quiet');
        }
        if (!forced && saveData()) return stillHere('save-data');
        // the engine's module is asked for after the first paint and an idle moment: never on the words' critical path
        await afterFirstPaint();
        await whenIdle(1500);
        if (dead) return;
        if (!forced && !gpuOK()) return stillHere('gpu');
        mark('gpu:ok');
        // the cadence: 1.5 s of frames with nothing else due (one retry: a one-off hiccup is not a slow machine)
        if (!forced) {
          let ok = await cadence();
          if (!ok && !dead) {
            mark('probe:retry');
            await wait(1000);
            ok = await cadence();
          }
          if (dead) return;
          if (!ok) return stillHere('cadence');
        }
        // the figure worker is spawned with the engine's request, so its chunk downloads beside the engine's
        warmFigureSource();
        const [mod, sink]: [EngineModule, typeof import('./plates/sink')] = await Promise.all([
          import('./engine'),
          import('./plates/sink'),
        ]);
        if (dead) return;
        await whenIdle(500);
        if (dead) return;
        plates ??= platesRef.current ? sink.createPlateStage(platesRef.current) : null;
        // the mount is a task of its own, at an idle moment and after a rendered frame, so its reads of the page's
        // boxes find the layout clean
        await whenIdle(500);
        await afterFirstPaint();
        if (dead) return;
        const main = currentMain();
        const place = main ? placeOf(main) : null;
        // the band's still is the first screen's painting: the engine's first frame waits for the page's figures and
        // lands finished over it (no bloom: the still is already the settled painting)
        const still = !!document.querySelector('.band__still img');
        handle = mod.mountLandscape(canvas, {
          stretch: place?.stretch ?? 0,
          distance: place?.distance ?? 'level',
          presence: place?.presence ?? 1,
          palette: 'misted',
          ...(main ? targetsOf(main) : {}),
          plates,
          still: isStill(),
          arrival: still ? 'none' : 'bloom',
          firstFrame: still ? 'complete' : 'now',
        });
        html.classList.toggle('no-landscape', handle.mode === 'static');
        landscape.set(handle);
        if (QA)
          Object.assign(window as unknown as { __ink?: LandscapeHandle; __inkEngine?: EngineModule }, {
            __ink: handle,
            __inkEngine: mod,
          });
        if (handle.mode !== 'webgl' && !forced) {
          // no WebGL after all (a context refused at the mount): the still is the painting
          setLive('still');
          html.classList.add('no-landscape');
          if (handle.mode === 'canvas2d') handle.pause();
          return;
        }
        setLive('on');
        // live: two slow frames inside a rolling second hand the page back to its still (the engine rests). The watch
        // starts once the first frame has landed and settled; none while the plates show (the reading state draws
        // nothing per frame, so a slow frame there is not the painting's).
        if (!forced) {
          const h = handle;
          const limitFor = () => {
            try {
              return limitForState(h.stats());
            } catch {
              return 20;
            }
          };
          const busy = () => limitFor() !== 20;
          void (async () => {
            const t0 = performance.now();
            while (!dead && busy() && performance.now() - t0 < 8000) await wait(200);
            await wait(1000);
            if (dead) return;
            if ((h.stats() as { plates?: { on?: boolean } }).plates?.on) return;
            stopWatch = watchFrames(
              () => {
                setLive('still');
                html.classList.add('no-landscape');
                handle?.pause();
              },
              { limitFor },
            );
          })();
        }
      } catch (err) {
        console.warn('landscape unavailable', err);
        html.classList.add('no-landscape');
        setLive('still');
        landscape.set(null);
      }
    };
    void boot();
    // "Still the landscape" switched off later on a page that opened still: the painting may come now (the same probe)
    const onStill = (e: Event) => {
      if (!(e as CustomEvent<{ on: boolean }>).detail?.on && !started) void boot();
    };
    document.addEventListener('ink:still', onStill);
    // the window crosses 1200 px: under it the engine rests and the still is the painting; over it the engine comes
    // (or comes back)
    const onWide = () => {
      if (dead) return;
      if (!wide.matches) {
        if (handle && handle.mode === 'webgl') {
          handle.pause();
          html.classList.add('no-landscape');
          setLive('still');
          landscape.set(null);
        }
        return;
      }
      if (handle && handle.mode === 'webgl') {
        html.classList.remove('no-landscape');
        landscape.set(handle);
        handle.resume();
        handle.refresh();
        setLive('on');
      } else if (!started) void boot();
    };
    wide.addEventListener('change', onWide);
    return () => {
      dead = true;
      stopWatch?.();
      document.removeEventListener('ink:still', onStill);
      wide.removeEventListener('change', onWide);
      handle?.destroy();
      plates?.destroy();
      plates = null;
      landscape.reset();
      html.classList.remove('no-landscape');
      html.removeAttribute('data-live');
    };
  }, []);

  return (
    <>
      {/* THE PLATES in two leaves: what lies behind the place (the sky, the light, the far ranges) and the place itself
          with everything in front of it. The wrapper has no box of its own (display: contents). */}
      <div ref={platesRef} className="plates">
        <div className="plates__back">
          <canvas data-plate="1" />
        </div>
        <div className="plates__fore">
          <div className="plates__front">
            <div className="plates__in">
              <canvas data-plate="2" />
              <canvas data-plate="3" />
            </div>
          </div>
          <canvas data-plate="4" />
          <canvas data-plate="5" />
        </div>
      </div>
      <canvas ref={ref} className="landscape" />
    </>
  );
}
