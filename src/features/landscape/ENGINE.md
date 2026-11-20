# The painting

One WebGL2 handscroll, shown in a fixed band across the top of every page. Windows 1200 px and wider with a hardware
GPU run it live; everywhere else the band shows stills cut from it. The code is the documentation. This file lists
the map and the traps.

## Map

- `places.ts`: where each page stands on the scroll (stretch 0 Home … 5 the 404), the way on (`NEXT_PLACE`) and the
  tail's map (`SCROLL_MAP`). `PageMain` and the navigation both read it.
- `band.ts`: the band's numbers (`BAND`). `band-geometry.ts`: each page's seat and travel on the scroll, from the
  engine's own framing; the server and the tools run it, never the browser.
- `elements.ts`: one on/off flag per painted element. Off skips its code and its `el-<name>` class.
- `engine/index.ts`: the loop, the camera, the views. `engine/renderer.ts`: the contract with the two painters
  (`gl.ts`, `canvas2d.ts`). `engine/shaders.ts`, `compose.ts` (each scene's framing), `palette.ts`, `lights.ts`.
- `engine/figures.ts` + `engine/sets/*.ts`: everything that isn't a mountain (town, boats, pavilion…), drawn in a
  worker (`figures.worker.ts`).
- `plates/sink.ts`: the page's side of the live stage. The engine develops each depth layer once into a canvas (a
  plate); the sink lays the plates out and moves them on a scroll timeline.
- `Landscape.tsx`: the plates and the engine's canvas, inside the band. It asks for the engine only at 1200 px and up
  and only after the live probe (`probe.ts`). `targets.ts` reads what a page's `<main>` tells the painting,
  `types.ts` is the engine's contract, `store.ts` holds the live handle.
- Outside this folder: `src/components/layout/Band.tsx` and `BandStill.tsx`, `src/styles/band.css`, the `--band-*`
  tokens in `src/styles/tokens.css`, `src/components/page/PageMain.tsx` (the engine's anchor, `--band-inside`,
  `--travel`), `Inscription.tsx` and `NextPlace.tsx` (what is inscribed in the band), `src/features/navigation/`
  (a page change: `band.ts` lifts the band, `flight.ts` flies the strip where the engine does not run),
  `tools/build-band.ts` and `public/scenes/band/` (the stills).

## Traps

- **SCENE vs PRESENT.** A scene paints a view into its own buffer only when its framing changes. PRESENT composites
  every frame and adds what moves. Never put time into SCENE, or every frame repaints.
- PRESENT has exactly two window slots (`uWin0`, `uWin1`, each with its front layer `uWinN0`, `uWinN1`). Adding a
  third touches `shaders.ts`, `gl.ts` and the `wins` packing together.
- Scene alpha is mist admittance, not opacity.
- Every new texture must be re-made in `hooks.restored` (context loss).
- Figure sets never call `Math.random`: use `own(...)` from `streams(SEED)` so a set draws the same every time. A
  syntax error in one set breaks every page's painting.
- **The canvas is the band's own box**, not the window: `.landscape` fills `.band__clip`, which is
  `100vw / --band-zoom` wide, and the scroll scales the band. So the engine sizes itself from the canvas's layout
  size (`clientWidth`, never its rect) and frames from the window's width (`innerWidth`). What it frames the stage
  from is the anchor, `.band-anchor` (`[data-landscape="strip"]` in `PageMain`): the strip's box at the page's top,
  out of the flow and never seen.
- **The plates' rules** (measured, `plates/sink.ts`): plain layers moved by a transform, and plain rectangular clips.
  No mask, filter or blend mode on the band or anything in it, and no opacity on a box that holds plates: one of
  them costs 15 to 25 % GPU on every scroll frame. The mist at the band's foot is a gradient over the clip's edge.
- Nothing runs when nothing moves. While a page is read, the plates and the still move on the page's scroll timeline
  and the engine draws nothing; the plates' small life is at most 30 fps and sleeps after a minute without input
  (`PLATE_MS`, `PLATE_IDLE`). Below 1200 px no engine byte is fetched. Keep it that way.
- **The stills** (`public/scenes/band/`: each page kind in two parts for wide screens and two for phones, plus
  `transit.webp`, the whole scroll as one strip). They are the painting from the first paint on every device, and
  the live stage lands over them, so the two must stand in the same place: `BandStill` places the parts by the
  manifest's numbers, in window widths of the cut. Cut them with `npm run build:band` from a QA build on port 3100
  (Google Chrome, this machine's GPU).
- **What hashes the stills:** every `.ts` file under `engine/` (comments too), `elements.ts`, `places.ts`, `band.ts`,
  `band-geometry.ts` and `tools/build-band.ts` itself. `npm run build:band -- --check` (in `npm run ci`) fails
  until they are cut again. Only a run that cuts every page writes the hash, and only a run that cuts all five
  places cuts `transit.webp`: `--pages` leaves the check failing.
- The band's numbers stand in three places: `band.ts`, the `--band-*` tokens (three width classes: 1200 px and up,
  640 to 1199, under 640) and the phone's and tablet's numbers in `tools/build-band.ts` (`PHONE`, `PHONE_AT`,
  `TABLET_X`, `TALL`). `tests/unit/band.test.ts` holds the wide tokens, the geometry and the stills to the engine;
  the phone's and tablet's numbers agree by hand. The tokens and `band.css` are not hashed: after changing them,
  look at a phone and a tablet yourself.
- A new page kind needs a `PageId` and a place in `places.ts`, its scene and figure set (`engine/compose.ts`,
  `engine/sets/`), its route and phone seat in `tools/build-band.ts` (`ROUTES`, `PHONE_AT`), then a full cut.
- States on `<html>`: `data-live` = `probing` | `on` | `still`; `data-plates="on"` (the plates show and the engine's
  canvas is hidden); `no-landscape` (the still is the painting); `is-still` ("Still the landscape").
- QA builds (`NEXT_PUBLIC_INK_QA=1`): an init script `window.__inkLive = true` skips the probe; `window.__ink` is
  the handle (`stats()`). A flag is switched off in one browser by the preview's panel
  (`src/features/qa/Switches.tsx`), localStorage `ink-elements` = `{"name":false}`, or `window.__elOff`.

## No longer here

The closing scene, the glimpse windows, the text keep-outs, the plates' paper veils and edges, the paper band under
the header, and the hero, glimpse and scroll stills with their tools. The engine still holds the code for a closing
window, keep-outs, veils, wake regions, glimpses and its below-1200 px windows, and `targets.ts` still looks for
them, but no page gives it any and the `glimpses` and `boughs` flags are off. The long comments at the top of
`engine/index.ts`, in `types.ts` and in `probe.ts` still describe that layout.
