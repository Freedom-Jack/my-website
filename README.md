# Qijin Xu: personal site (v2)

The personal site of Qijin Xu, Lead AI/ML Architect in Toronto. Every page stands in one long ink-wash handscroll,
a WebGL2 landscape painted behind the text. Moving between pages pans along the painting: from his mountain (Home)
down to the river town (Work), past the still lake (Writing), up through the terraced fields (Résumé), to the ferry
(Contact).

- **Words:** all of them are in `content/`. To edit, read [CONTENT.md](CONTENT.md).
- **Design:** the source of truth is [design-demo/DESIGN.md](design-demo/DESIGN.md), the approved static demo 4b in
  `design-demo/`, and its copy deck [design-demo/COPY.md](design-demo/COPY.md). This app is that demo, built for real.

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

| Command                      | What it does                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                | the dev server                                                                                |
| `npm run build`, `npm start` | a production build, served on port 3000 (`-- -p 3100` for the tools below)                    |
| `npm run ci`                 | type-check, lint, format check, unit tests, stills check: run before every push               |
| `npm run test:e2e`           | Playwright against a built site on port 3100: a smoke test per route, navigation, the budgets |
| `npm run check:compliance`   | the hard rules over the sources and the built pages                                           |
| `npm run check:links`        | crawls the built site: every link answers, every outside link is https and allowed            |
| `npm run build:pdf`          | prints `/resume/` to `public/resume.pdf` (`-- --check` in CI)                                 |
| `npm run build:stills`       | cuts the footer's story-map stills from the engine (needs a QA build; `-- --check` in CI)     |
| `npm run format`             | Prettier                                                                                      |

A **QA build** (`NEXT_PUBLIC_INK_QA=1 npm run build`) exposes the painting to the test tools as `window.__ink` and
`window.__inkEngine`. Production builds leave both out, along with the engine's QA-only code.

## How it is organised

```
content/                 every word: site.ts, resume.json, pages/*.ts, work/*.mdx, writing/*.mdx, github/
src/app/                 thin routes: metadata, data loading, and one feature component each
src/components/          shared building blocks
  layout/                header, footer, the story map, "Still the landscape", the boot script, ink filters
  page/                  PageMain (every page's <main>), Strip (its opening scene), Closing (its end scene)
  ui/                    Seal, InkButton, MarginNote, Diagram
src/features/            one folder per feature, each owning its components, logic and CSS Module
  landscape/             the painting: places.ts (where each page stands), Landscape.tsx (the one persistent
                         canvas), engine/ (the WebGL2 engine; types.ts is its contract)
  navigation/            route changes as pans along the painting: exit, travel, arrival, focus, announce
  chrome/                current page, the returning header, Still, the 404's lost mark
  effects/               brush links, ink buttons, diagram draw-in, the seal, arrival
  home/ work/ writing/ resume/ contact/ github/     the pages and their data
src/lib/                 typography, inline markup, dates, SEO and JSON-LD, redirects, the compliance patterns,
                         the MDX plugin (mdx/rehype-site.mjs)
src/styles/              the design system: tokens, base, layout, effects, components (global, from the demo)
tools/                   build-pdf, build-stills, compliance, linkcheck (TypeScript, run by Node 24 directly)
tests/unit/              content schemas and counts, GitHub rules, the engine's pure parts (Vitest)
tests/e2e/               smoke, navigation and the DESIGN §6 budgets (Playwright; support/measure.js is the
                         demo's own probe)
design-demo/             the approved static demo, its notes and its QA tools: reference only, never deployed
legacy-v1/               the old site, kept until its removal is approved
```

**A page** is a route in `src/app/` that renders a feature component inside `PageMain`. `PageMain` reads the page's
place from `src/features/landscape/places.ts` (its stretch of the painting, how strongly the scene shows, whether
it ends on a closing scene) and writes it onto `<main>`. The navigation reads the same table to prepare the next
page's painting before it arrives, so the two never disagree.

**The painting** is one fixed canvas in the root layout, mounted once after the first paint. It survives route
changes and is safe under Strict Mode. Everything else talks to it only through `mountLandscape()` and its handle
(`types.ts`). It respects reduced motion and the footer's "Still the landscape" switch, which is remembered across
visits. Without WebGL it paints in Canvas2D; without JavaScript it shows a static ridge.

**After changing the engine, its figure sets, a palette, a place or a strip height**, regenerate the story-map
stills (CI fails until you do). Use two terminals:

```bash
NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100
```

```bash
npm run build:stills
```

## Checks

CI (`.github/workflows/ci.yml`) runs on every push and pull request:

1. type-check, lint, format check, unit tests;
2. the stills check and a runtime-dependency audit;
3. a QA production build, then the built site's own checks: the résumé PDF matches the résumé and holds no phone
   number, the hard rules (no phone, no street address, no project-management credential, no link to the old
   résumé file, no CJK text but the seal), every link, and the Playwright suite (a smoke test per route, client
   navigation, the DESIGN §6 budgets at 1440, 1280 and 390).

## Deploying

Vercel builds every pushed branch as a preview. **A push to `master` deploys production**, so only Jack pushes
there. The old addresses (`/about/`, `/projects/`, `/blog/…`, the old résumé file) redirect with 301s
(`src/lib/redirects.ts`). The launch gate is DESIGN.md §2 and the launch steps are §12. Each one waits for Jack's go.
