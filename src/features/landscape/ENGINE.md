# The painting

One WebGL2 handscroll behind every page, with a Canvas2D fallback and still images where neither runs. The code is
the documentation. This file lists only the traps.

## Map

- `places.ts`: where each page stands on the scroll (stretch 0 Home … 5 the 404). `PageMain` and the navigation both
  read it.
- `elements.ts`: one on/off flag per painted element and per scroll motion. Off skips its code and its `el-<name>`
  class.
- `engine/index.ts`: the loop, the camera, the views. `engine/renderer.ts`: the contract with the two painters
  (`gl.ts`, `canvas2d.ts`). `engine/shaders.ts`, `compose.ts` (each scene's framing), `palette.ts`, `lights.ts`.
- `engine/figures.ts` + `engine/sets/*.ts`: everything that isn't a mountain (town, boats, pavilion…), drawn in a
  worker (`figures.worker.ts`). `plates/`: the wide-screen stage.

## Traps

- **SCENE vs PRESENT.** A scene paints a view into its own buffer only when its framing changes. PRESENT composites
  every frame and adds what moves. Never put time into SCENE, or every frame repaints.
- PRESENT has exactly two window samplers (`uWin0`, `uWin1`). Adding a third touches `shaders.ts`, `gl.ts` and the
  `wins` packing together.
- Scene alpha is mist admittance, not opacity. Any readback (stills) forces alpha to 255.
- Every new texture must be re-made in `hooks.restored` (context loss).
- Figure sets never call `Math.random`: use `own(...)` from `streams(SEED, …)` so a set draws the same every time. A
  syntax error in one set breaks every page's painting.
- The loop sleeps when nothing moves. Keep it that way: a phone reading on paper should request no frames.
- After changing the engine, a set, a palette, a light, `elements.ts`, a place, or a strip or band height, rebuild the
  stills and heroes from a QA build on port 3100 (`npm run build:stills`, `npm run build:heroes`). CI fails until
  you do.
- QA builds (`NEXT_PUBLIC_INK_QA=1`) can flip flags in one browser: localStorage `ink-elements` =
  `{"name":false}`, or `window.__elOff` / `window.__elOn`.
