# Qijin Xu: personal site (v2)

The personal site of Qijin Xu, Lead AI/ML Architect in Toronto. Every page stands in one long ink-wash handscroll,
a WebGL2 landscape painted behind the text. Moving between pages pans along the painting: from his mountain (Home)
down to the river town (Work), past the still lake (Writing), up through the terraced fields (Résumé), to the ferry
(Contact).

- **Words:** all of them are in `content/`. To edit, read [CONTENT.md](CONTENT.md).
- **Design:** the source of truth is [design-demo/DESIGN.md](design-demo/DESIGN.md), the approved static demo 4b in
  `design-demo/`, and its copy deck [design-demo/COPY.md](design-demo/COPY.md). This app is that demo, built for real,
  as changed by round 5 (DESIGN §12): one painting, and the style "Spring ink" with its scroll motion.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 6 (strict) · MDX 3 · zod 4 · next/font · CSS Modules on
the demo's design tokens · a hand-written WebGL2 engine (Canvas2D and static fallbacks) · Vitest · Playwright ·
ESLint 9 · Prettier · Vercel. Versions are pinned exactly in `package.json`, with `package-lock.json`. Dependabot
proposes updates weekly (`.github/dependabot.yml`).

## Run it

Node 24 (`.node-version`). With [fnm](https://github.com/Schniz/fnm):

```bash
fnm install && fnm use
```

```bash
npm ci
```

```bash
npm run dev
```

The site is then at http://localhost:3000. `.env.local` may hold a `GITHUB_TOKEN` (read-only, public repositories)
for Work's "In the open" list. Without one the build uses GitHub's anonymous rate limit, and if GitHub cannot be
reached it falls back to `content/github/snapshot.json`.

| Command                      | What it does                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                | the dev server                                                                                                                                                                                                  |
| `npm run build`, `npm start` | a production build, served on port 3000 (`-- -p 3100` for the tools below)                                                                                                                                      |
| `npm run ci`                 | type-check, lint, format check, unit tests, the stills' and the heroes' checks: run before every push                                                                                                           |
| `npm run test:e2e`           | Playwright against a built site on port 3100: smoke, navigation, budgets, scroll, phone bands, axe, probe, craft                                                                                                |
| `npm run check:compliance`   | the hard rules over the sources and the built pages                                                                                                                                                             |
| `npm run check:links`        | crawls the built site: every link answers, every outside link is https and allowed                                                                                                                              |
| `npm run check:budgets`      | the HTML gate, Lighthouse (mobile, desktop; warmed, median of 5, min–max beside it) and the phone profile on the QA build on 3100; `-- --no-phone` in CI; `-- --write` stamps the tail (the local release step) |
| `npm run build:pdf`          | prints `/resume/` to `public/resume.pdf` (`-- --check` in CI)                                                                                                                                                   |
| `npm run build:stills`       | cuts the phone bands' (the windows') stills (needs a QA build; `-- --check` in CI)                                                                                                                              |
| `npm run build:og`           | cuts the link-preview cards (`public/og/`) from each page's hero (needs a QA build; `-- --check`)                                                                                                               |
| `npm run build:heroes`       | cuts each page's hero still and the phones' inline seeds (`public/scenes/hero/`) from the engine's own first frame (needs a QA build; `-- --check` in CI)                                                       |
| `npm run format`             | Prettier                                                                                                                                                                                                        |

A **QA build** (`NEXT_PUBLIC_INK_QA=1 npm run build`) exposes the painting to the test tools as `window.__ink` and
`window.__inkEngine`. Production builds leave both out, along with the engine's QA-only code.

## How it is organised

```
content/                 every word: site.ts, resume.json, pages/*.ts, work/*.mdx, writing/*.mdx, github/
src/app/                 thin routes: metadata, data loading, and one feature component each
src/components/          shared building blocks
  layout/                the header and its river line (RiverLine), the tail (Tail, TailNames: the colophon, the build
                         stamp, "Still the landscape", the five names, the email, the seal), the boot script, ink filters
  page/                  PageMain (every page's <main>), Strip (its opening scene and first screen), NextPlace (the
                         ending: "Downstream · <next place> →"), Closing (its end scene), Glimpse (an empty depth
                         band at a section break, painted below 1200 px)
  ui/                    Seal, TextAction (the one action on a screen, with its drawn arrow), MarginNote, Diagram
src/features/            one folder per feature, each owning its components, logic and CSS Module
  landscape/             the painting: places.ts (where each page stands), Landscape.tsx (the one persistent
                         canvas), elements.ts (THE switch table of Spring ink's elements and scroll motion),
                         engine/ (the WebGL2 engine; types.ts is its contract, lights.ts the one table of each
                         place's light, sets/ the places' figures, sets/young.ts the plum, swallow and willow)
  navigation/            route changes as pans along the painting under a plain crossfade of the words
  chrome/                current page, the returning header, Still, the 404's lost mark
  effects/               diagram draw-in, row rules and the diagram's flow dot (finish.ts)
  home/ work/ writing/ resume/ contact/ github/     the pages and their data
src/lib/                 typography, inline markup, dates, figures (the poster numeral's split), the build stamp,
                         SEO and JSON-LD, redirects, the compliance patterns, the MDX plugin (mdx/rehype-site.mjs)
src/styles/              the design system: tokens, base, layout, effects, components (global, from the demo);
                         effects.css holds the interface elements, each behind its html.el-* class (focus, the row
                         rule, the flow dot)
tools/                   build-pdf, build-stills, build-heroes, build-og, compliance, linkcheck (TypeScript, run by Node 24
                         directly); glsl-loader.cjs (the build's loader for the engine's shaders: comments out)
tests/unit/              content schemas and counts, GitHub rules, the engine's pure parts (Vitest)
tests/e2e/               smoke, navigation and the DESIGN §6 budgets (Playwright; support/measure.js is the
                         demo's own probe); scroll.spec.ts (the scroll motion: quiet modes, smoothness, seams,
                         memory); glimpse.spec.ts (the phone and tablet depth bands); probe.spec.ts (the live
                         probe: the quiet forms fetch no engine byte, the still is in the HTML and hands over)
design-demo/             the approved static demo, its notes and its QA tools: reference only, never deployed
```

**A page** is a route in `src/app/` that renders a feature component inside `PageMain`. `PageMain` reads the page's
place from `src/features/landscape/places.ts` (its stretch of the painting, how strongly the scene shows, whether
it ends on a closing scene, and the next place downstream for its ending) and writes it onto `<main>`. The
navigation reads the same table to prepare the next page's painting before it arrives, so the two never disagree.

**The surface** (the vanguard round, `design-demo/DESIGN.md` §12): two faces (the name face for the name, the page
titles and the figures as poster numerals; Familjen Grotesk for everything read or pressed) and the system mono for
facts (`.mono`); four type sizes on the first screen; every word, title and link in ink, with jade only as marks
(the river line's dot under the current page, the second line of a focus ring, the row rule on hover, the diagram's
flow dot); the seal once per page, at the tail. The header's river line (`RiverLine`) carries "you are here" and
travels with the reading (a CSS scroll timeline); every page but Contact ends on `NextPlace` ("Downstream ·
Work →" with that page's own sentence); the tail replaces the footer and the story map. The strip is a grid of two
rows on wide screens: the band row is fixed at the strip's height (so the still is a pure crop of the painting), and
a title block taller than the band runs onto the paper below it. The tail's build stamp prints the short commit and
the build day (`src/lib/build.ts`); a measured number appears only once CI has written `content/measured.json`.

**The painting** is one fixed canvas in the root layout. Every page opens on its pre-cut still (`public/scenes/hero/`,
cut by `build:heroes` from the engine's own first frame; on phones a ~1 KB seed inlined in the HTML; on Home, a case, a
note and the Résumé the sharp phone still itself), so the first screen is complete before any script. The engine is fetched only after the live probe (`features/landscape/probe.ts`):
after the first paint and an idle moment, never under reduced motion, "Still the landscape" or Save-Data, only with a
hardware WebGL2 context, and only after 1.5 s of idle frames none over 20 ms; its shaders link off the main thread
(`KHR_parallel_shader_compile`), its first scene is a frame of its own, and its first frame lands finished under the
still, which fades out (the figure sets travel in the worker's chunk; the main thread keeps their metas,
`engine/figure-meta.ts`). Two slow frames in a rolling second hand the page back to its still. It survives route
changes and is safe under Strict Mode. Everything else talks to it only through `mountLandscape()` and its handle
(`types.ts`). Without a hardware GPU or JavaScript the still is the painting (and the static ridge marks the closing).

**The scroll motion is the unroll** (`elements.ts` `unroll`; the vanguard round, 05-synthesis.md "The scroll
motion"): on wide screens the page's three depth layers are painted once at the hero framing, wider to the east by the
page's travel, and slid west in the present pass, linearly with the scroll (0 scenes while scrolling), so the page's
end stands 60 % of the way to the next place's hero and the page change's pan carries the rest, from where the slide
left the painting (`engine/index.ts` `UNROLL`). Where the next place lies beyond an empty reach (Work's town before
the lake, the Résumé's terraces before the crossing) the travel stops where the place's last named thing
(`compose.ts` `Frame.holdU`) would go under the curtain, so the margin shows a drawn place to the end. A standing
curtain of mist keeps the middle and near layers out from under the reading column once the reading starts; the far
ranges run on behind the words under their own paper. The near framing elements whose roots lie past the frame's
east edge (Home's plum bough, Writing's willow) are sprites pinned to the frame (`figures.ts` `LifeParams.pinned`):
the painting slides under them and no cut end comes into view. The next place's figures stand in the reach at a
lighter resolution; its full layer, drawn ahead by a link's intent, is shown or held only while it fits the memory
gate beside the page's own (`figBudget`, `fitsBeside`, `fitsAhead`). A
case and a note open inside their place, closer and further along it (`places.ts` `inside`, `compose.ts`
`HERO.inside`), each with its own still; `compose.ts` `cameraFor(k, u)` gives the camera position for a part of a
place (the search's sub-anchors). Below 1200 px the strip's painting drifts west as it leaves, the closing's comes in
from the east, and the depth bands look east along the place. Reduced motion and Still make the unroll one cut. The
approved camera's travel stays in the engine as the QA alternative (`cameraTravels`, off; a QA build switches
`{"unroll":false,"cameraTravels":true}`).

**The elements** of the Spring ink style (the river line's mark, focus, the row rule, the plum, the light's halo, and
so on; the morning, the page change's mist, the nav mark, the swash, the story map's sun, the pointer's rings and
gust, the air, the swallows, the ribbon and the falling petals are off since the vanguard round: one named element
per place) and the scroll motion (`unroll`, `cameraTravels`, `glimpses`) each have one flag in
`src/features/landscape/elements.ts`, with its answer to the five questions. Off means gone: its engine paths are
skipped and its `el-<name>` class on `<html>` is not set, so its CSS does not apply. `silkVeil`, `air`, `glimpses`,
`ribbon` and `halo` also compile their shader code out (GLSL `#define`s); the other elements' shader code stays
compiled in, skipped by its uniforms. A QA build can switch flags off, or on against the table, in one browser
(localStorage `ink-elements` with true / false values, or `window.__elOff` / `window.__elOn`; the figure worker gets
the same overrides). The Canvas2D fallback paints Spring ink's figure sets and misted palette, without the shader
work: no ice-blue air or light, no dry-brush ink, none of the painting's elements, no scroll motion; the depth bands
keep their stills.

**The depth bands** (below 1200 px): a page marks a section break with `<Glimpse still="home-0" />` (`phone` for phones
only). The engine paints the page's own place into it, framed by its table `GLIMPSE` (and the unroll's poses,
`GLIMPSE_UNROLL`) in `engine/index.ts`; until it does, and where it cannot, the band shows its still
(`public/scenes/glimpse/`, cut by `build:stills`) as a lazy, low-priority `<img>`, fetched only near the viewport.

**After changing the engine, its figure sets, a palette, a light, `elements.ts`, a place, or a strip or band
height**, regenerate the stills: the story map's (dim and lit, per place), each depth band's and the heroes' with
their seeds (CI fails until you do). Use two terminals:

```bash
NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100
```

```bash
npm run build:stills
```

```bash
npm run build:heroes
```

## Checks

CI (`.github/workflows/ci.yml`) runs on every push and pull request:

1. type-check, lint, format check, unit tests;
2. the stills check and a runtime-dependency audit;
3. a QA production build, then the built site's own checks: the résumé PDF matches the résumé and holds no phone
   number, the hard rules (no phone, no street address, no project-management credential, no link to the old
   résumé file, no CJK text but the seal), every link, and the Playwright suite (a smoke test per route, client
   navigation, the first screen's budgets at 1440, 1280 and 390 (and Home at 375 and 360), the scroll motion, the
   depth bands, Back's scroll position, the header's one row and its river line at 375 and 360);
4. the budgets: the HTML gate (≤ 30,000 B gzip per route) and Lighthouse mobile and desktop, warmed, the median of
   five (`check:budgets -- --no-phone`). CI writes nothing and runs no phone profile (it has no GPU).

**The release step (local, on the real GPU).** Before a release commit, on a QA build serving on 3100:
`npm run check:budgets -- --write` runs every gate, the phone profile included, and from a passing run writes Home's
mobile LCP, its first-load transfer, the date and the commit into `content/measured.json`, which the tail prints
("Lighthouse mobile, simulated"). Commit that file with the tree.

## Deploying

Vercel builds every pushed branch as a preview. **A push to `master` deploys production**, so only Jack pushes
there. The old addresses (`/about/`, `/projects/`, `/blog/…`, the old résumé file) redirect with 301s
(`src/lib/redirects.ts`). The launch gate is DESIGN.md §2 and the launch steps are §12. Each one waits for Jack's go.
