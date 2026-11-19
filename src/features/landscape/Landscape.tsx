'use client';

import { useEffect, useRef } from 'react';
import { isStill } from '@/features/chrome/still';
import { warmFigureSource } from './engine/figure-source';
import type { PlateStage } from './plates/sink';
import type { Veils } from './plates/veils';
import { watchGlimpseStills } from './glimpse-stills';
import { cadence, gpuOK, limitFor as limitForState, quietNow, saveData, setLive, watchFrames } from './probe';
import { landscape } from './store';
import { currentMain, placeOf, targetsOf } from './targets';
import type { EngineModule, LandscapeHandle } from './types';

/**
 * The landscape: one fixed canvas behind everything, persistent across pages (it lives in the root layout).
 * The engine (./engine) paints the page's scene into its windows (the strip, the closing), the living ground
 * on wide screens, and the faint ink horizon between them on desktops. Decorative.
 *
 * On every device the page opens on its pre-cut still (components/page/Strip): the first screen is complete before
 * any script. The engine is asked for only after the probe (./probe): after the first paint and an idle moment, never
 * under reduced motion, "Still the landscape" or Save-Data, only with a hardware WebGL2 context, and only after 1.5 s
 * of idle frames none over 20 ms, so a page that will not paint fetches 0 engine bytes. The engine's module is then
 * one task, its mount another (the context and the figure worker; the shaders link off the main thread), and its
 * first scene a frame of its own, so no step holds the main thread long on a phone; its first frame lands finished
 * under the still, which fades out. Once live, two slow frames in a rolling second hand the page back to the still.
 * Without a usable renderer html.no-landscape shows the static ridge hint instead. Strict-Mode safe: mountLandscape()
 * replaces any earlier mount on the canvas.
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
/** QA builds only: `window.__inkLive = true` (an init script) skips the probe and mounts regardless (the stills and
 *  cards tools run on a software rasteriser; a test that needs the engine under reduced motion sets it too). */
const qaForced = () => QA && (window as unknown as { __inkLive?: boolean }).__inkLive === true;

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
    // THE PLATES (round 6): on wide screens the stage is the page's own layers, moved by the browser (plates/sink.ts),
    // and the paper behind the words is the page's own too (plates/veils.ts), scrolling with them. Round 7: both
    // modules come with the engine's request, after the probe (they serve nothing before the painting comes, and
    // every kilobyte of script before the first screen has settled counts on a phone).
    let plates: PlateStage | null = null;
    let veils: Veils | null = null;
    // the windows' stills below the fold get their sources as the reader nears them (R5; the navigation does the same
    // for every later page)
    const stopStills = watchGlimpseStills(currentMain());
    // (round 7: the tail's scroll in miniature gets its pictures the same way; the tail stays across pages)
    const stopTail = watchGlimpseStills(document.querySelector<HTMLElement>('.site-footer'));
    // QA builds only: the probe's marks (tests/e2e/probe.spec.ts reads them: why the still stands)
    const mark = (name: string) => {
      if (QA) performance.mark(`ink:${name}`);
    };
    /** No painting will come: the still is the page's painting (and the closing keeps the static ridge hint). */
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
        // the checks that need no frame: the quiet forms, Save-Data, a hardware GPU (never a byte of the engine without them)
        const forced = qaForced();
        if (!forced && quietNow()) {
          started = false; // (a quiet form: "Still the landscape" switched off later asks again, onStill below)
          return stillHere('quiet');
        }
        if (!forced && saveData()) return stillHere('save-data');
        // the engine's module is asked for after the first paint and an idle moment (the budgets' rule: it is never on
        // the words' critical path)
        await afterFirstPaint();
        await whenIdle(1500);
        if (dead) return;
        if (!forced && !gpuOK()) return stillHere('gpu');
        mark('gpu:ok');
        // the cadence: 1.5 s of frames with nothing else due (one retry: a one-off hiccup is not a slow phone)
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
        // the figure worker is spawned with the engine's request, so its chunk (the sets) downloads beside the
        // engine's and the page's figures are drawn by the time the engine mounts (the engine takes the source over)
        warmFigureSource();
        // (typed as the contract, so the engine's real signature is checked against it)
        const [mod, sink, veiling]: [EngineModule, typeof import('./plates/sink'), typeof import('./plates/veils')] =
          await Promise.all([import('./engine'), import('./plates/sink'), import('./plates/veils')]);
        if (dead) return;
        // (the plates and the veils are made in a task of their own, at an idle moment: with the engine's evaluation
        // they made one task of 230 ms on a throttled phone)
        await whenIdle(500);
        if (dead) return;
        plates ??= platesRef.current ? sink.createPlateStage(platesRef.current) : null;
        veils ??= plates ? veiling.createVeils() : null;
        // the module's evaluation was one task; the mount is another, at the next idle moment and after a rendered
        // frame, so its reads of the page's boxes find the layout clean (a font swap or a style change laid out inside
        // the mount's task cost it 50-70 ms on a phone)
        await whenIdle(500);
        await afterFirstPaint();
        if (dead) return;
        const main = currentMain();
        const place = main ? placeOf(main) : null;
        // the strip's still (components/page/Strip) is the first screen's painting: the engine's first frame then waits
        // for the page's figures and lands finished under it (no bloom: the still is already the settled painting)
        const still = !!main?.querySelector('[data-landscape="strip"] .strip__still');
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
        // QA builds only: the probes judge the painting through the handle, and tools/build-heroes.ts remounts
        // the engine module itself to cut the heroes' stills
        if (QA)
          Object.assign(window as unknown as { __ink?: LandscapeHandle; __inkEngine?: EngineModule }, {
            __ink: handle,
            __inkEngine: mod,
          });
        if (handle.mode !== 'webgl' && !forced) {
          // no WebGL after all (a context refused at the mount): the still is the painting; Canvas2D would paint a
          // plainer one over it, so it rests
          setLive('still');
          if (handle.mode === 'canvas2d') handle.pause();
          return;
        }
        setLive('on');
        // live: two frames over 20 ms inside a rolling second hand the page back to its still (the engine rests).
        // The watch starts once the engine's first frame has landed and settled (the boot is sliced and gated by the
        // task budget, not by this rule: at native speed the first scene costs one 33 ms frame). R4 (01-budgets.md):
        // frames during the painting's own motion (a pan, an arrival, a sweep) count at 33 ms, so a phone that janks
        // only during pans is handed back to its still too; frames while the engine is pending for another reason (a
        // scene or a layer on its way: no engine frames then) are not counted. What it catches is a slow place to
        // read, and a slow page change.
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
            // (THE PLATES: no watch. The reading state draws nothing per frame, so a slow frame there is not the
            // painting's, and the watch itself was a second loop at the display's rate)
            if ((h.stats() as { plates?: { on?: boolean } }).plates?.on) return;
            stopWatch = watchFrames(
              () => {
                setLive('still');
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
    return () => {
      dead = true;
      stopWatch?.();
      stopStills();
      stopTail();
      document.removeEventListener('ink:still', onStill);
      handle?.destroy();
      plates?.destroy();
      plates = null;
      veils?.destroy();
      veils = null;
      landscape.reset();
      html.classList.remove('no-landscape');
      html.removeAttribute('data-live');
    };
  }, []);

  return (
    <>
      {/* THE PLATES in two leaves (round 7): what lies behind the place (the sky, the light, the far ranges) and the
          place itself with everything in front of it. Words a page inks INTO the painting (styles/body.css .inked)
          stand between the two, so a peak or a roof passes in front of the letters as the scroll slides. The wrapper
          has no box of its own (display: contents): each leaf is a layer of the page's root. */}
      <div ref={platesRef} className="plates" aria-hidden="true">
        <div className="plates__back">
          <canvas data-plate="1" />
          <canvas data-plate="10" />
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
      <canvas ref={ref} className="landscape" aria-hidden="true" />
    </>
  );
}
