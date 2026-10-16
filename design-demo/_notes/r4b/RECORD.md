# Demo 4b: the record

**What 4b was.** A short round after demo 4a, agreed by Jack on 2026-10-14 ("Sure continue"), built on 2026-10-15 in
one long session run as multi-agent workflows. Scope (DESIGN.md §11): **A** the painting follows the scroll and becomes
the page's background (the "living ground"); **B** every closing and the footer's story map show the page's real scene;
**C** the places drawn (pavilion, ferry, terraces, the path into mist) with small life; **D** small fixes (drift, the
photo's fade, Draft art without JS, print).

**Jack's verdict, 2026-10-16:** "I think it is a good baseline for everything". He answered every DESIGN §11.E question
(recorded there); the answers that shape the build are quoted in §1.2 below.

**Authoritative docs:** `DESIGN.md` (decisions, the §11.E answers, §12 the real build), `README.md` (running the demo,
making a page, module APIs, tools, QA, the Next.js port table), `COPY.md` (every word). The current numbers live in the
code's comments: `STAGE` / `STAGE_AT` in `landscape/index.js`, THE SET API and THE LIFE API atop `landscape/figures.js`,
`SCENES` in `landscape/compose.js`. Where this record and the code disagree, the code is current.

This file replaces the round's 28 working notes, for the session that builds the real site. Code is named by file and
function, not line.

---

## 1. Decisions and why

### 1.1 What Jack asks for, every round

Information first at a readable scale; the painting present and continuous (never sparse); each page's scene meaning
something within one giant painting. His "hard to read" was round 3's scale (a 294 px name, 50svh wordless vistas),
never text over mist. His words:
- **2026-10-08:** "hero looks nice, but the rest of the page feels like a powerpoint" · "I can see the Shanshui effect,
  the transparent one, (Is it the mist drift? But it doesnt follow my mouse, it follow the scrolling), it is nice" ·
  "all the pages' background is together coherent and maybe form a big painting".
- **2026-10-09:** "I want people to first can capture the info, then enjoy my website, not the other way around." ·
  "reading website experience first, skill show off after" · "each background just looks like similar" · "Btw current
  background looks nice, so dont get it wrong." · "you dont have to stick with ink theme" · "it should be one giant
  painting …, and it should look nice" · "I still like the mist effect."
- **2026-10-14 (Toronto), on 4a:** "So overall, it looks great." · "the mountain drawing at the hero, it was following
  my scrolls and eventually becomes the background. And also the ink paints feels more background rather than coherent
  with the webpage, right now all the text sits on top." · "that horizontal scroll doesn't match the heroes of each pages."

### 1.2 The decisions of 4b

| Decision | Why (Jack's words where he gave them) |
|---|---|
| **The living ground is "depth"**, not "settle" (§2) | Two prototypes on the 4a engine, scored art / reader / engineer: settle 6.5 / **7.5** / **7.5**, depth **7.5** / 7 / 6; they tied on every hard number. Depth is round 1's study-A camera lift, the motion Jack remembers; settle read as a sticky background. Depth's costs were desktop-only and fixable. 2026-10-16, is this the motion he remembers: "Yes". |
| **Grafts from settle** | Home's resting pose (the right massif with hut and traveller, low over the sea of mist); "Draft art" in the first screen's top-right sky; Work parked as one whole cluster; the phone leaf. Dropped: settle's upward follow, and depth's creep while reading. |
| **Only on wide screens with a hardware GPU** | Canvas2D's living present cost 44–48 ms p50 (2 ms on the 4a path). Everything else keeps 4a's strip and closing: "Sure if this is the best". Phones read on paper with zero frames (living veils there ate Home's hut). |
| **Motion while reading kept** | Mist and life breathe at ≤ 15 fps until 45 s idle. "Keep it". |
| **Every closing shows its own place** (§3.6) | "that horizontal scroll doesn't match the heroes of each pages". Never the road to the next page. |
| **No "Next: …" link in the build** | "The 'Next' feels off": a fixed tour under a large "Next:" reads like a slide deck. Long pages end on their own closing; short pages (Writing, Contact, the 404) end on the story map alone. |
| **The story map is five build-time stills** (§5.1) | Faithful by construction, zero runtime cost, no JS. |
| **The drift became perceptible on every page** (§2.3) | 4a measured about 0.4/255: it looked frozen. |
| **Small life stays quiet; people stand still** (§4) | The ferry stays moored (a 1 px warp read as jitter). For the build Jack wants the bridge walker and the ferry's bob: "Yes but have an option to toggle it off". |
| **The photo's fade is in the file** (§5.2) | Chrome's PDF dropped 4a's CSS mask and printed a hard rectangle. |
| **Print hides the header and actions** (§5.3) | Ink-button labels printed blank. A print-only name line for the build: "Sure." |
| **Home's quiet mid-lift left as it is** (§7.1) | Every remedy breaks an agreed rule; his call. |
| **Work becomes a concise index** | "A bit too long, maybe keep it concise and have dedicated pages for the rest": one page per case in the build. |

### 1.3 Earlier rounds: what failed, never to repeat

| Round | The scroll | What went wrong |
|---|---|---|
| 1, study A (`_studies/hero-a/`, runnable, `?y=`) | Camera lift: planes sink by depth², a cloud sea rises, the name in empty sky | Nothing: the "first design" Jack misses; 4b's depth stage reproduces it |
| 2 | Lift to 1.6 vh, then frozen; mist banks at 1.3× scroll; a scene repaint per scroll frame | The painting left: non-paper 18 % → 4–6 % by screen 4 ("sparse", "PowerPoint") |
| 3 | A frozen hero, then a squashed ink horizon (today's band constants); 50svh wordless vistas | Every page the same band (0.4–2.4 % apart); vistas read as gaps; a 294 px name |
| 4a | Strip and closing scroll away 1:1; phones on paper | "All the text sits on top" (Claude's diagnosis: "wallpaper with text laid on top") |

So: scenery at every depth, each page its own; no empty half-screens; 4a's type scale; a solid returning header; never
freeze approved art. **Never revive:** Contact's lantern or any warm glow, the ochre glaze #CDB096, "hero
pixel-identical", `?transition=edge`, wordless vistas, a transparent returning header. **Not adopted:** per-scroll
scene repaints, one pre-rendered "ground" view (settle), mist-band markers, interludes.

---

## 2. The living background

### 2.1 The engine's model (4a's, kept; the port must keep it)

One fixed full-viewport canvas. **SCENE** (expensive) paints each view into its own buffer only when its key changes:
the windows (`wins`: strip, closing), the desktop horizon (`hzv`, 4a pages), 4b's three stage layers. **PRESENT** (cheap,
every frame) composites them at their live positions, adds what moves (drift, wake, sweep, life), then the veils, then
grain. **A scroll costs one present, never a scene** (SwiftShader: a full-viewport scene 36–42 ms, a present 5.7–7.7 ms).
Never put a time uniform in SCENE.

| Piece | Where | Rule |
|---|---|---|
| Loop | `request`, `pace`, `frame`, `draw` | No rAF spin: dirty flags. Waits on the GPU fence ≤ 400 ms; sleeps until a draft's settle, the wake (+33 ms) or the drift (+70 ms). |
| Scene key | `paintWin` | Framing, buffer size, palette, spec, keep-out, note, figure alphas (a 300 ms fade repaints ≈ 18 times), arrival, draft. **Never the scroll.** |
| Buffer | `resize` | 0.75 × min(DPR, 2) × quality, long side ≤ 1920; a height change < 12 % never rebuilds. |
| Governor | `govern` | Motion scenes > 45 ms (mean of 12): drafts at 0.5, then quality × 0.8 (floor 0.5); a full scene 150 ms after motion. Software GL starts at 0.6. A per-scroll repaint must count as moving. |
| Phones | `onScroll` | No window near (`winIO`, 30 % margin), no horizon, no stage: returns early. **A phone reading on paper requests zero frames.** |
| Context loss | `hooks.restored` | Every new texture must be re-made here. `view()` silently clamps to `MAX_TEXTURE_SIZE`. |

- **Two window slots, hard-wired:** PRESENT's `uWin*[2]` arrays, samplers `uWin0` / `uWin1` (picked by a ternary),
  gl.js's packing and binding, and `wins` change together. A third window or another full-viewport layer needs all four.
- **Scene alpha is mist admittance, not opacity** (sky 0.18, water 0.36, figures 0.3, keep-out 0.5); any readback
  (stills, thumbnails) must force alpha to 255. The 4b depth layers carry real coverage instead.
- **The world** (`compose.js`): x in stretches. Windows use `HS` 1.6 and the desktop composition
  `resolve(curSpec, 1.6)`, so a phone sees a crop of the same painting. `widthClass`: wide ≥ 1200, short < 500 tall,
  tablet ≥ 640, else phone. Feathers are top and bottom only. Reflections mirror ridge planes only: a figure set draws
  its own.

### 2.2 Veils and keep-outs

- **Veils** (`measureVeil`) are viewport rects re-measured every scroll frame (4a once read them on resize only, and stale
  veils washed the windows). At most `VEILS` (12), largest visible area first; strength `data-veil`, default 0.72;
  from 0.9 a paper reserve on its own text lines only (`textBox`), half feather. The engine itself gives the Draft-art
  note and any keep-out without a veil a 0.95 reserve. 4a pages veil the element's **box** (a full-width `.sec` veils
  the empty right half too).
- `col = mix(col, PAPER, veil)` runs after everything but grain: every new layer goes before it, and every moving term
  is gated by (1 − veil)(1 − keep).
- **Keep-outs** (`measureKeep`): box-relative, measured on layout only, one right edge per window (`keepR`). The place's
  figurative point (`frame.keepU`) stays ≥ 180 px right of it; no pigment left of it; mist opaque 140 px left → clear
  140 px right; no figure within 40 px; no wake. The engine understands only "text left, scene right"; text above a
  scene needs another mechanism.
- **"Never text on colour" comes from the keep-out, not the veils:** a 0.72 veil over ink leaves small print at 4.2:1,
  and over pigment it tints.

### 2.3 Drift and wake

- `time` starts at 40 and moves only while `drifting()` (WebGL, no reduced motion or Still, a window or the stage on
  screen), eased by `driftT` (45 s idle → stop over 2 s). So anything on `uTime` stops in every required case for free,
  hidden tabs included.
- Two decks (warps 0.0021, 0.0045, 0.0080), `smoothstep(.36, .74, …)`, `mix(col, MIST, mist·adm·0.6)` ≤ 0.8; the wake
  re-samples with the same constants.
- **Why 4a's sky looked frozen (≈ 0.4/255): tone, not speed.** MIST − PAPER is ≈ 6/255 at sky admittance 0.18; more gain
  busies the mountain bands first; × 2 speed gives × 1.3 change.
- **The fix, on every page:** a sky deck toward MIST2 gated by luminance, keep-out and veil (`STAGE.sky` 0.45), clock
  × 1.25 (`STAGE.drift`); the mist gated off veils; the veil's tear on its edge only (≥ 6 CSS px out). Before, drift
  reached p99 2/255 through a 0.72 veil and its inside pulsed 13 %.
- **Measured** (`drift.py --stops`, the last two refine rounds on SwiftShader, 7 pages × 1440 / 390, 8 s; the final
  real-GPU review reported the sky unchanged): open sky **mean 0.5–1.6/255, p99 3–6** (Work at 390: 2.45 / 10),
  2–10× 4a's (4a's mean 0.13–0.67 at 1440); text 0.00 / 0 / 0; reduced motion and Still 0 frames. The mean stays low
  because most open sky is uniform paper where the mist field is thin; **p99 is the honest measure** of where it moves.
  The judging brief's "mean ≈ 1–3" was a target, not a result. A stronger deck (`?sky=.6&drift=1.6`) raised the means
  only to 1.61 (Home) and 0.65 (Résumé) and greyed the still sky: not adopted.
- **Known, accepted miss:** `drift.py` still grades the sky by a mean of 3–6/255 (its docstring and `verdict_sky`), so
  it prints "sky too faint" on every 4b page. Read its p99 column instead, or regrade the probe on p99.
- **Wake:** fine pointer, `[data-wake]`, radius 0.128 vh (84–136 px), ≤ 30 fps; inside a window box the mist uses the
  window's world point even where its feather is 0 (else a seam).

### 2.4 The stage (Home and Work, wide screens)

All in `landscape/index.js` unless noted.

- **Gate, `stageOn()`:** `data-ground="living"`, ≥ 1200 px, WebGL on a hardware GPU (not `software`), no `stageVeto`.
  Otherwise 4a's strip and closing, the strip's painting leaving inside its box at `lag` (0.55) of the scroll. A living
  page's closing is framed as its opening on every path.
- **Layers** (`paintStage()`, `stageCrops()`): the planes split at `split` into far / middle / near, each painted once
  with coverage alpha (`uPlanes` in SCENE); far at half resolution, the others cropped. A pan or the bloom paints one
  combined layer per frame; at rest the three replace it with a glide (`sepK`, `GLIDE_TAU` 150 ms, steps capped at
  50 ms). A pan from a lifted pose first **holds** (`HOLD_MS` 180 × √pose) on the three layers, easing pose, cloud, step
  and curtain to 0; `finishPan()` re-reads the scroll targets at `tween.to` (why: §8.1). Memory: `drop4a()` on entering,
  `dropStage()` on leaving; Home 1440 DPR 2 holds 10.0 MB (4a 17.0; the first depth prototype ≈ 28).
- **Lift** (`readStage()`, `stageU()`, PRESENT's stage block): progress 1 − (1 − s / `reach`)^`ease`, each layer to its
  fixed `sink`, then still. The sea keeps to the deepest sink (`seaSink()`), so nothing standing above it in the opening
  goes under. A haze deck, the sea's drifting body, a mid-lift cloud (`cloudAt`; sky deck × `rise`). A `still` stretch
  before the descent; short pages lift less (`liftF` to 0.5, then 0.3).
- **Work's step and curtain** (`measureSlide()`): under the thick cloud (`slideAt`) the scene steps, either way, so world
  x `anchor` meets the widest band's veil edge, only as far as keeps `cluster` on screen (a leftward step paints the
  layers wider, `st.ext`). Left of the anchor a billowing curtain hides the middle and near layers, so the margin holds
  the town east of the bridge whatever text passes. The step is kept to the end.
- **Descent:** end pose E0 = the opening lowered so its strip bottom meets the closing's bottom. It runs over the
  closing's run-in (`lead` 0) at every size, no layer faster than `vmax` (0.5) of the scroll (before `vmax`: up to
  2.03). The far layer ends as low as that allows; middle and near end on E0 where the place has a cloud, the excess
  (`jump`) taken hidden inside it (`descAt`; `hid` and `stCloudTop()` in shaders.js).
- **Bridge reveal** (`revealTarget()`, `curtSweep`): `STAGE_AT[1].arch` (west foot, crown, east end) against the text
  bands. Target = max(clearance smoothstep, growth over `revealAt` of the descent), 1 at the page end; `revK` follows at
  `reveal` (0.9 s), sweeping east to west, so no pop on one wheel tick.
- **Living veils** (`measureVeil()`, `textBands()`, PRESENT): paper round each **band** of lines (a new band where lines
  ≥ `BAND_TOL` 160 px wider start, or after ≥ `BAND_MIN` 100 px of narrower ones; pictures, figures, tables and diagrams
  count as text). Solid to `core`, then a `feather` with mist tongues (`swell`) from anisotropic linear noise over a
  softplus floor, 1.9× longer over dark ink, billowing along top and bottom edges; shrunk beside narrow margins (`kr`,
  continuous round corners), widened up to 1.8× at 2592 px beside a block only; mist and sky deck thin over `clear`.
  On a living page every veil, keep-out and note becomes one, at full strength; `data-veil` is ignored.
- **Reduced motion, Still** (`quantized()`): two quiet changes only (the settled pose past 0.5 vh; the end pose only
  once the arch shows whole). No glide, cloud or reveal motion; the reveal's growth term is 0.
- **Present governor** (`governPresent()`): plain presents are sampled by their GPU fence wait; 12 averaging ≥ 30 ms
  drop quality × 0.8 (floor 0.5); still slow at 0.5 sets `stageVeto` (4a windows for that mount).

### 2.5 Tunables (`STAGE`; Work's own in `STAGE_AT[1]`, in brackets)

| Group | Defaults |
|---|---|
| Lift | `sink` .05, .17, .26 (.06, .24, .24) vh; `reach` 1; `ease` 2; `split` 2, 3; `still` .25 |
| Sea, haze | `seaK` 1; `soft` .06; `billow` .035; `body` .45, 1; `haze` .56; `hazeK` .75 |
| Cloud | `cloud` 0 (1); `cloudAt` .1, .3, .62, .88 (.25, .37, .53, .65); `rise` 1 |
| Step, curtain | `anchor` −1 (1.755); `cluster` 0 (.175); `slide` −1; `slideAt` .38, .52; `curtain` 0 (1); `reveal` .9; `revealAt` .45, 1; `arch` (Work: 1.482, .204 / 1.572, .323 / 1.655, .291) |
| Descent | `descend` 1; `vmax` .5; `lead` 0; `descAt` .02, .3, .55, .88 |
| Veils (CSS px) | `core` 40; `feather` 56; `swell` 72; `clear` 170 |
| Other | `far` .5; `sky` .45; `drift` 1.25; `lag` .55 |

The 33 URL keys (`main.js` `TUNE`) are demo-only and never ported: a tuned URL can thin the veils
(`?core=0&feather=0&swell=0&clear=0&sky=3` put "Next:" at 6.38:1, under the 7:1 budget). Retired: `follow`, `settle`,
`rates`, `sea`, `dmax`, `curtLift` (why: §8.1).

### 2.6 What it measured (real GPU: ANGLE Metal, quality 1, governor samples 0)

Scene renders on scroll 0; phone frames reading on paper 0; ambient ≤ 14 fps, asleep after 45 s; text under veils
0 / 0 / 0 over 8 s on every page (open sky: §2.3); body p5 ≥ 7.27 (the "Next:" label), small ≥ 6.44, C* under text
≤ 3.3; layer speed ≤ 0.5 of the scroll at 1440–2560. Right margin painted on screens 2–4 at 1440 (prototype): Home
35–53 % (4a 4–15 %), Work 18–23 % (4a 1–2 %).

### 2.7 Canvas2D (and software GL)

Canvas2D is static (no drift, wake, sweep or life; the differences are listed in README "Module APIs"). Living pages show
4a's strip and closing there and on software GL, so Canvas2D's `stage()`, `curtained()` and the living branch of
`veilMask()` are unreachable under the gate: candidates to drop in the port.

- **Software GL pays more than 4a on the same path (performance backlog, on purpose).** On SwiftShader, 4b's 4a path
  presents at ≈ 1.8× 4a's cost at the same quality: 33 ms against 18.6 ms at quality 0.5. The extra is 4b's sky deck
  and small life (life alone +14–27 %, §4). `governPresent()` drops quality 0.6 → 0.5 on the first scroll, leaving idle
  presents at 32.8–33.4 ms (52–60 ms at 0.6 with the stage, before the gate). Every visitor without a usable GPU gets
  this path. Not cut: cutting it would visibly change the drift (DESIGN §1: ask first). On a real GPU life costs nothing
  measurable.
- **Canvas2D still paints 4a's foot-mist bands** as horizontal light bands across the peaks (e.g. a 45 px band across
  Home's peaks): `plane()`'s foot gradient in canvas2d.js, in 4a too, not the veils. A billowed foot band was tried and
  changed nothing (reverted). Open in all three refine rounds, and this is the fallback that gets ported (§7.2).

---

## 3. Places, figure sets and endings

### 3.1 The figure-set contract (beyond the figures.js header)

The binding contract is THE SET API and THE LIFE API atop `landscape/figures.js` (`meta`, `draw(env)`, every `env`
field, anchor kinds and params). World px: 1440 per stretch, 900 per scene height. What the header does not say:

- **Registry:** `sets/<name>.js` plus one line in `sets/index.js`; nothing else knows about sets (stretch 2 has none).
  Keep content inside 13–87 % of `meta.rect` (the shader melts the ends) and cut the rect to what windows see. Layers
  clamp at 4096 px a side (`layerSize`) without rescaling the drawing transform: a bigger layer is silently misregistered.
- **Ground:** at a waterline use `sceneField(u, P, out)` (`[1]` far waterline, `[7]` near bank), never `planeTop(l ≤ 2)`.
  Terraced crests are rounded per view by 3.5 % of its width: seat things on lips, 0.008–0.014 under the crest.
- **Module cycle:** figures.js imports the sets and they import it, so a set's top level runs before figures.js's
  constants exist. Reading `D`, `VH_PX` or `LIFE_KINDS` at a set's top level, or a syntax error in any set, kills every
  page's painting. Open the lab on a set before handing it over.
- **Randomness:** one stream per element, `own('house', row, i)` from `streams(SEED, PINS)` (4a's single stream re-rolled
  everything after one added draw). The market's row layout shares `own('row', r)`, so a new draw in a row's layout loop
  re-rolls that row. 4b repainted everything, so every PINS is empty.
- **Brushes:** copy a shared brush into the set to change it; fold it back in a separate reviewed step. Waiting: home.js
  `traveller`, `thatchedHut`; the market's `rib`, `folk`, `rainbow`, `pollard`. Wanted: one shared `rock()`.
- **Life:** anchors are never drawn statically. A `sprite: true` boat is cut out of the WebGL layer and drifts, so its box
  must hold the whole boat (hull, reflection, poler, pole) and nothing else. A slot's anchors go only into windows of
  its own variant (strip or closing), or twin pages doubled their shimmer.
- **`env.cls`** lets a set cull what a width class never sees (unused; est. −30 % on phones).
- **Verify** (lab usage: README "Figure sets"): the figure lab at each width class and palette (no ink in the melt ends,
  longest step < 8 ms), then the page, then the other sets' hashes unchanged (`window.figLab.render`).

### 3.2 The places

| Place | Set · rect · plane / phase | What it draws |
|---|---|---|
| Home | `home.js` · [0.64, 0.97, 0.06, 0.34] · 3 / 1 | The traveller (u 0.788, ≥ 12.5 CSS px on a 320 phone) climbing a pale path toward a thatched hut on a rock ledge |
| Work | `market.js` · [1.08, 2.04, 0.14, 0.42] · 2 / 1 | The river town (after the Qingming Festival scroll) and its blank-signed landmark; the woven-beam rainbow bridge (`skew: 0.75`, a painter's licence: 1 reads as a ramp); a boat lowering its A-frame mast toward the stern; pollarded willows; a still crowd |
| Writing, the Note | `pavilion.js` · [3.78, 4.22, 0.10, 0.37] · 2 / 1 | One corner (Ma Yuan, Xia Gui): a spit, an open pavilion, a seated scholar, a leaning pine; its reflection drawn in the layer (the shader mirrors only the far shore) |
| Résumé | `terraces.js` · [4.16, 5.0, 0.1, 0.34] · 2 / 0 | Level walls at y = z − (0.30 + 0.26·sp(u))·(broad(u) − z), one shared noise so they nest (crest-parallel bands read as contour hatching); fields, a zig-zag path, a farmhouse. Phones look closer (scale 760, band 0.12–0.31, u 0.7) |
| Contact | `ferry.js` · [5.5, 6.06, 0.1, 0.4] · 2 / 1 | A boat bow toward you, its bench empty ("the seat is yours"), the ferryman in faded indigo, a jetty on posts |
| 404 | `path.js` · [6.6, 7.1, 0.12, 0.54] · 2 / 0 | A path climbing the lone peak into a cloud it never leaves; one bare tree; no figure |

### 3.3 Reference hashes and cost

Hashes: `figLab.render`, misted, first 12 hex digits, 2026-10-16, this Mac's Chrome; compare old and new code in one
browser to prove the port pixel-identical (older market hashes are stale: the punt moved). Cost: warm-worker ms per
layer, budget 15.

| Set (stretch) | 1440 @1 | Phone @2 | Life anchors | ms, 1440 @1 / @2 |
|---|---|---|---|---|
| home (0) | `ae42739c5d61` | 270 `c2235ef092d1` | smoke | 1.9 / 2.5 |
| market (1) | `aa6e608c7797` | 1300 `c20b339a8356` | shimmer, punt (sprite), smoke, 3 willows | 8.5 / 12.9 |
| pavilion (3) | `dacfdccf935c` | 560 `416fc522e148` | shimmer | 3.8 / 4.2 |
| terraces (4) | `89572c4cefaa` | 760 `f9ff2b9fa9fe` | smoke | 8.1 / 9.5 |
| ferry (5) | `123b2947f504` | 560 `ff0ea6841649` | shimmer, moored boat | 1.6 / 3.1 |
| path (6) | `f7ec174d6392` | 450 `b6a897753bc3` | none | 1.4 / 3.2 |

Only the market at 1680 @2 is over budget (15.4–16.0 ms, 2.5 of it readback and premultiply). It fell from 20.2 to
8.8 ms by resampling its ribbons every 1–3 px on a noise table (the kit's `stroke()` takes 0.5–1.6 px steps and three
noise lookups a point). Its cost is points and pixels, not draw calls: one `Path2D` per colour is **slower** in Chrome
(1,500 polygons: 2.4 ms as separate fills, 14.7 ms as one path). `stats().figureMs` is the *last* layer drawn and reads
5–10× high headless: never budget from it.

### 3.4 Kitsch guards, and what read wrong

**Guards** (DESIGN §4.6): Song forms; no lanterns, pagodas, dragons, gold, red or warm light; blank signs; dry broken
lines; mist over part of each scene; timber small and greyed; nothing figurative within 40 px of text. **A landmark
shown twice on one screen is "the same stamp twice"**, even a ridge.

**Replaced because they read wrong:** a path drawn as a contour or white ribbon (kerbs, a highlighter: paths are bare
paper); round parasols at the strip's foot (mushrooms); a straight rope toward the bridge (a cable); jetty braces (a
fence); a tree behind a ridge (a finial); a path along terrace lips (a Great Wall); neutral grey beside malachite
(pink). The scene greys figure ink, so reflections need alpha up to about 0.6.

### 3.5 Engine changes made for the places

New framings for Work's phone strip and the 404's wide strip (`compose.js`); level terrace bands that give way where the
layer draws walls (`figSpan()`); a river mist keyed by depth (`SCENES[1].water.front` = `RIVER_FRONT`; `frontAt()`,
canvas2d.js `riverMist()`), so the town's back rows dissolve.

**`water.front` is a hand-measured copy of `market.js`.** Measure with the rows table cut to row 1: the top pixel with
alpha > 24 per 0.005 bin at 1440 @2, widened a bin, + 0.002. Re-measure whenever the town or the bridge moves (then
rebuild the stills), or the mist eats the front row or spares a back row. It was measured with the punt at u 1.905 (now
1.84, a sprite), so the bump near 1.905 may be its pole. Better: let the set export it.

### 3.6 Endings: each closing shows its own place

Phones and tablets frame the closing as their opening does. Wide screens use an authored band,
`SCENES[k].frame.closing.wide { scale, band, right, hug?, keepU? }`, about 0.7 of the opening (Home's and Work's apply
only off the living ground). The format is documented above `SCENES` in `compose.js`.

- **`keepU`:** the keep-out keeps the place's leftmost figurative point ≥ `KEEP_GAP` (180 px) right of the text, so the
  figures always show. **`hug`:** exactly 180 px, so 1920+ shows the place's own mist, not the neighbour.
- **Twins:** where strip and closing share a screen (`twinNow()`: Writing, Contact), the closing shows another view with
  none of the strip's figures or landmark (close-ups, then Contact's mountain echo, were the same stamp twice; fixed-scale
  views grew with the width into the neighbour). So a twin is a **span** (`spanFrame()`): the box right of the text holds
  exactly `[u0, u1]` at any width (Writing's lake west end, wide [0, 0.6]; Contact west along the crossing, wide
  [−0.08, 0.49]). A closing that sees no figures draws no layer (`closingSees()`).
- **Layers drawn for what shows them:** key `k|distance:presence|scale|palette|dpr|mode|cls`, drawn for the window's own
  composition. This fixed the Note reusing Writing's layer (its lake sits 22.5 world px lower) and Home's closing showing
  Work's town off its waterline (4a keyed by stretch only). A closing shares the strip's layer within `LAYER_SHARE`
  [0.6, 1.16], else draws its own at `nominal`; stand-ins only within `LAYER_STANDIN` [0.4, 1.16]; `FIG_KEEP` 6 (LRU). A
  neighbour's layer shows only if drawn for this composition, never requested at rest. The router's
  `prepare(stretch, { distance, presence })` draws ahead.
- **For the build:** no "Next: …" link (answer 8). Short pages end on the story map alone, so twins need not be ported;
  the wide closings were tuned with "Next" over them and must be judged again without it.

---

## 4. Small life

**What moves:** shimmer on open water (Work's river, Contact, Writing's lake, the Note); smoke (Home's hut, the Résumé's
farmhouse, Work's cook stall); Work's three near-bank willows sway; one punt drifts on Work. Contact's ferry stays
moored (a 1 px warp of a 20 px boat at a jetty read as jitter). The `walker` kind is accepted and ignored.

**How it works** (the module contract: README "Figure sets"):
- Sprites: the worker's `'gpu'` output cuts each `sprite: true` boat into its own ImageBitmap, so the moving boat leaves
  no ghost. gl.js `probeBitmaps()` checks that bitmaps upload premultiplied; otherwise the bytes path runs and the boat
  stays moored. Canvas2D keeps it painted in.
- `lifeU()` (from `presentU()`) culls keep-outs and fills ≤ 8 entries for **one view per frame**, only for views of the
  slot's own variant (`variantOf()`).
- gl.js compiles PRESENT twice (plain, and `#define LIFE_ON 1`); the life program runs only while something moves on
  screen. In PRESENT the order is life's tap offset, then `lifeLay`, then the cloud hide (`Mi *= 1 - hid`), so life goes
  under the cloud with its layer.

**Tunables:** `LIFE_AMP` (index.js): shimmer 0.3 (0.24 on phones), willow 1.2 CSS px (0.7 on phones). Lake damping
`(1.0 - 0.7 * mirror)` in `lifePrep` (≤ 4/255). The punt (`sets/market.js`): u 1.84 (moved from 1.905 so its cut box
clears a willow), 1.6 world px/s, range u 1.76–1.93.

**What stops it:** no timer of its own (it rides the ambient frames, ≤ 15 fps); `uLifeK.x` = 0 under reduced motion and
Still; it eases out over 2 s after 45 s idle; it fades from ≈ 110 CSS px of any veiled box to none within 40 px.

**Measured:** text 0.00/255, no added frames; no measurable cost on a real GPU; the bitmap path halves figure-layer
time. SwiftShader: +14–27 % per present (with the sky deck, ≈ 1.8× 4a's present: §2.7) and +1.0–2.7 s settle (a
second shader JIT); a CPU rasteriser pays for every branch (the first version doubled even the 404's present).

**For the build (answer 9):** the walker on the bridge (`rainbow()` in market.js returns `deckAt(t, w)` for its path)
and the ferry's bob (it needs a sprite, not a warp; the ferry's anchor has none yet and its rope would have to stretch),
each only if it reads as the painting breathing; and an obvious off switch remembered across visits (Still is
`sessionStorage['ink:still']` today).

---

## 5. Story map, photo and the small fixes

### 5.1 The story map (`tools/build-stills.py`; layout in README "The chrome")

Rules learned:
- Draw each still whole and show a masked window of it, so a feather never meets the still's edge.
- Neighbours crossfade over the same stretch with complementary ramps (separate fades left paper holes, 180 px at 1440).
- The art is .37 of a column from 640 px; any smaller and a window outruns its still.
- The 1.75rem gap keeps figures ≥ 40 px from the labels (lowest measured 41.7).
- Phone windows use the labels' widths in em: re-measure if the font or the words change.

**The tool** (flags and `--check`: README "Tools") remounts each page's engine at 1440 × 900, DPR 2, with `ground: ''`
(a living page would mount the stage, which has no strip framing: "no strip window"), no veils, keep-outs or wake,
`quality: 1.5` and `ambient: false` (deterministic bytes), then maps each `PLACES` rect through
`stats().framing.strip`. `still: true` was rejected: it left figure layers unshown. Caps: 16 KB a still, 60 KB in all
(now 56,176 B). `--check` hashes the engine JS with its comments, so a comment edit means regenerating (byte-identical
stills). **Regenerate after any engine, set, palette, body-config or strip-height change**, then run
`tools/qa/storymap.py`.

### 5.2 The photo's shoulder fade (`tools/build-photo.swift` step 3d)

Baked into the JPEG; no CSS mask. Under multiply, fading to white looks the same as masking; Chrome's PDF dropped 4a's
mask and printed a hard rectangle; the baked fade survives forced colours and refits on a reshoot (it derives from the
wall mask). Defaults: width .17, neck .14, edge 1.0 (flags: README "Tools"); `--fade off` reproduces 4a's file
byte for byte. Output 720 × 900, 64.5 KB. Rejected: a side taper (a narrow bust), a band parallel to the shoulder (it faded the ear), a three-anchor bowl
(a banned oval vignette), a hand-fit SVG mask.

### 5.3 The §11.D fixes and the final review's CSS

- **Draft art** is hidden without JS or a landscape (`html:not(.js) .strip__note`, `html.no-landscape .strip__note`);
  demo-only, not ported.
- **Print** hides `.site-header`, `.actions`, `.ink-btn` (ink buttons printed blank: `background-clip: text`), plus the
  strip art, the closing and the footer, so printed pages carry no name; the build adds a print-only
  "Qijin Xu · qijinxu.com" line on every page except the Résumé. Work prints to 12 A4 pages.
- **Header focus made the page jump:** the sticky header's controls carry
  `scroll-margin-top: calc(-3 * var(--header-h) - .75rem - 4px)`.
- **200 % zoom on a 390 phone:** below 14.99rem, `.nowrap`, the contact address (a `<wbr>` after "@"), the stacked table
  and the Résumé's contact line wrap.

---

## 6. QA tools and how 4b was verified

### 6.1 Running the probes (usage details: README "QA")

- Server: `python3 _tools/serve.py 4173`; `QA_OUT` outside the repo.
- **Real GPU:** prefix `CDP_ARGS='--use-angle=metal --enable-gpu --ignore-gpu-blocklist'` and check `stats().software`
  is false; SwiftShader shows 4a's strip on the living pages, at quality 0.6.
- **Settle** with `cdp.SETTLE_JS` (what it waits for: README "QA"). Never wait on `stats().draft` (it stayed true for a
  window drafted and then scrolled away); never use fixed waits (they catch the bloom under load).
- **Judging hooks:** `qa({ veils: false })` (the painting alone), `setState()`, `?ground=4a` (A/B), `stats().stage`
  (`phase`, `ready`, `prog`, `desc`, `sink`, `reveal`, `archGap`; full list in README "Module APIs").
- Each probe's flags and targets are in README "QA". The places sheet's answer key goes to the console only; seeds 7 and
  31 are spent.

### 6.2 The final review

Real GPU; five reviewers (art, reader, engineer, hard rules, newcomers); two fix rounds.

Findings fixed: Canvas2D froze on load (TBT 3.6–5.7 s, now 66–191 ms, better than 4a on Home and Work; §8.1); no
stage floor on slow renderers (the GPU gate, `governPresent()`, `stageVeto`); header focus jumped the page and text was
lost at 200 % zoom (§5.3); twin closings repeated figures, then Contact's mountain (spans, §3.6); Work's margin showed a
bridge stump (`anchor` 1.755, `cluster` .175, `measureSlide()` both ways); the bridge popped in on the last tick
(`revealAt`). Not changed: Home's quiet mid-lift (§7.1).

**After round 2, real GPU:** compliance, linkcheck and the three `--check` tools pass; console sweep 0 errors (real GPU, SwiftShader, Canvas2D); contrast no failing line
(worst body p5 7.27, "Next:"; C* p95 ≤ 3.3); drift text 0.00 (sky: §2.3), reduced motion and Still 0 frames; re-renders 0; router
all pass; storymap 70 / 70; budget fails only the known 404 at 390; gaps in target; 7,280 `framingAt()` results
against the restore point differed only in Contact's intended twin closings; places (seed 31, three fresh agents)
6 / 6 (§8.3).

---

## 7. Known issues and open items (for the build)

### 7.1 For Jack

1. **Home is quiet mid-lift:** 9.6 % painted at scroll 300 vs 15 % at the top (≈ 12 % at 1280). About me, the page's
   one wide block (x 120–1080 at 1440, on screen over scroll 150–800), veils the middle peaks; `qa({ veils: false })`
   shows the massif fully present. Each remedy breaks a rule: a step under the cloud loses the hut and traveller;
   peaks through the veil break "never text on colour"; a one-column About me undoes 4a's photo beside the text.
2. **The traveller climbs toward his hut**, but DESIGN §7 says he "sets out from his mountain" (a flip in `draw()`).
3. **Possible figures:** a ferry passenger; a figure on the terraces' path; a second plume at Work's cook stall; reeds
   and an empty mooring post for Contact's ending (new art drawn only into the closing).
4. **Confirm on the first preview:** the walker, the endings without "Next", and the places test with real people new
   to the site (a fresh seed).
5. **The story map's figures are true to the painting's scale:** at 1440 and DPR 1 the hut and the traveller are 2–4 px
   specks, the ferry and the pavilion about 6–8 px (retina and phones draw from the 2× stills). The scroll's own
   proportion, tiny figures in a large landscape, not a defect; but it is the thing to look at with Jack.

### 7.2 Art, life and the fallbacks

- **Worst kitsch risk:** plane 2's needle crest behind Work's town (u ≈ 1.76) reads as a pagoda or stupa; it lives in
  `ridges.js` / `compose.js`, not the set.
- Flat washes; figures that read as signs at 8–25 px; the bridge's long near flight; the 404's regular switchbacks (and
  its lower legs lost at 1280); the ferry could grow ≈ 15 % on phones; Home and the Résumé are the most alike pair;
  willows and stall smoke are rarely seen at ≥ 1200.
- **Market:** the old trees are back-row trees by depth, so the river mist (`water.front`, §3.5) dissolves them,
  though the artist wanted them to break the roofline. On phone strips 135 px tall or less the bridge's near foot falls
  below the strip (the arch and crown still read).
- **The punt fades out ≈ 30 s after a fresh load,** when it reaches the mist at the left end of its range (by the big
  boat), and comes back from the right after ≈ 2 minutes of drift time; the 45 s idle sleep often stops it first.
  Whoever judges the life should know this.
- **Two terrace models:** the shader's terraced fields (`paddy` in SCENE, shaders.js) use their own sag noise, not
  terraces.js's `sp`, so the bands share the walls' character but not their exact sag.
- **Canvas2D's foot-mist bands** still cross the peaks as horizontal light bands (§2.7): open, and ported with the
  fallback.
- **Software GL presents at ≈ 1.8× 4a's cost** (§2.7): left for Jack's performance backlog; ask before cutting.

### 7.3 The living ground

- Tall windows: the far ranges end above the opening (Work 146–629 px, Home ≈ 100).
- Work's end pose at 1440 / 1280 is 93 / 101 px left of the opening; at 1440 the crown clears the last table's mist only
  ≈ 50 px before the end (a reader who stops short sees the east end).
- The hold delays a pan from a lifted pose up to 180 ms (transition.js's "≤ 650 ms" no longer holds); unjudged at 2560.
- `STAGE_AT[1].arch` follows `market.js`'s bridge (`X(1.565)`, skew .75): if it moves, shoot Work's end with
  `?curtain=0` and the text hidden, and convert with `stats().stage.framing`.
- Not built: mist bands between sections. Tablets use the phone path.

### 7.4 Not verified anywhere

- **Safari:** ImageBitmap premultiply, `texelFetch` on RGBA16F ridges, uniform-indexed `uWinR[lv]`. A spec-certain worker
  alternative: `createImageBitmap(canvas, { premultiplyAlpha: 'premultiply' })`.
- Real phones ("Leave it, will check later": use the Vercel previews), other GPUs, real 1366 / 1920 / 2560 panels.
- The 404 at 390 fails display ÷ readable (.63, as in 4a). Work's length (6.24 / 7.70 / 8.34 screens) goes with
  answer 2's case pages.

### 7.5 Stale text to fix while porting

- Comments: `sets/ferry.js` (its old closing); `assets/css/layout.css` (the closing "framed on the road toward the next
  place").
- COPY §10: 10.7 calls the domain unbought (bought 2026-10-09); 10.19's "Next: Home" is moot.
- The flagged-words rule (no photo, house, bridge, boat, pavilion, lantern … in alt, title, aria-label, inline SVG) is
  unchecked by `compliance.py`.
- Unanswered from earlier rounds: Writing's intro is not his words; certification links; back / forward as a 400 ms pan
  or a cut; a colophon per painting; testimonials and talks; a pronunciation line.

---

## 8. Lessons and gotchas

### 8.1 Engine

- **A new engine attribute takes three edits:** `main.js` `landscapeTargets` (and config), the engine's `rebind`, its
  JSDoc. The router copies every `body` `data-*` generically.
- **The returning header arms on the strip art's bottom** (`header.js` `ANCHORS`).
- **Figure layers must be keyed by everything that places them** (§3.6). They are baked into SCENE, so life moves only in
  PRESENT (scene repaints at 15 fps cost 10–20×; DOM sprites would sit above mist and veils).
- **Veil edges:** clamp or smoothstep plateaus in the swell pin the edge to a ruled line (the noise texture spreads only
  ±0.15, so gains must be large); a room factor that switched at a box's side made a seam; a strong second octave made
  "flames" on summits; one veil per block covered a 960 px diagram's width beside 680 px text (hence bands).
- **Stage motion:** a pan overwrote the scroll targets (hence `finishPan()`); the combined layer puts every plane at one
  depth, so switching to it on a lifted pose jumped (hence the hold and the glide); a re-seeded wake trail held 20 fps
  idle.
- **Retired tunables:** `dmax` 1.6 started the counter-directional descent ≈ 1.1 screens early on tall windows, during
  reading; `curtLift` popped the bridge in one tick; anchor 1.625 left a sheared arch stump for 3–4 screens; curtain
  patches showed hidden flecks; the reveal's growth fed reduced motion's switch (a sheared arch early), so it is 0 when
  `quantized()`.
- **Not adopted:** a stronger sky deck (§2.3); for Home 1280, `slide` 70–150 (the hut leaves) or a
  middle-only step (a new ruled peak).
- **Canvas2D froze** because GPU-backed canvases (the worker's `'bitmap'` output, `idleDraw`, three canvas2d.js sprites)
  were read back into CPU canvases. Every canvas but the `'gpu'` output must be `willReadFrequently: true`.

### 8.2 Integration

- **A conflict with no textual overlap:** life's anchors went into every window while the endings tagged windows by
  variant, so twin pages doubled their shimmer. After a merge, test the features' cross-product, not each alone.
- `prepare()` must pass the destination's `distance` and `presence`, or the Note's layer is drawn for Writing's
  composition and pops in after the pan.
- A `resume.pdf` rebuild changes only its timestamps: restore the committed bytes rather than commit a binary no-op.

### 8.3 Process

- **Parallel engine work: isolated copies plus patches.** Each builder worked in its own copy from byte-identical bases
  and handed over a patch. The integrator took a restore point, applied the patches in a fixed order (living, scenes,
  endings, life), cross-checked every file two builders touched with a three-way `git merge-file -p` to stdout,
  resolved conflicts by hand keeping every builder's change, and removed `patch`'s `.orig` leftovers. Each fix round
  also took a restore point and proved its refactors with a before/after sweep (e.g. every `framingAt()` result).
- **Settle on `stats()`, never on the clock** (§6.1). The first predicate, built on `stats().draft`, never completed.
- **The real-GPU prefix:** SwiftShader is a different renderer (quality 0.6, the 4a path on living pages). Judge the art
  only with the prefix and `stats().software` false.
- **Overnight timings were inflated.** From 01:15 to 10:15 EDT the headless Chrome ran at background priority (launched
  from a background-priority watcher) while other agents' Chromes loaded the machine (load average 38–57 on 18 cores):
  settle took 5–24 s instead of ≈ 3, the drift ran at 2.6–7 fps, times were 2.5–6× high. Counts, layout and pixels were
  unaffected. Note load and process priority with every timing; judge timings on the real GPU, machine quiet.
- **The places-test scoring bug.** The workflow's scorer stripped the accents from "Résumé" before comparing with the key
  "resume", counted every correct Résumé answer as wrong, and reported "newcomers confused the Résumé with Home". A fix
  round tightened the Résumé's phone framing (kept: it reads better). In fact all three viewers scored 6 / 6. Normalise
  accents and test a scorer against its own key first. Agents are only a proxy for people new to the site.
- **Session temp folders get wiped:** the round-4a brief and the lead's first QA probes were lost with one. Anything that
  must last goes in the repo (hence `tools/qa/` and this record); screenshots and sheets never do.
