# CLAUDE.md

@AGENTS.md is Next.js's own note for agents (rewritten by `next dev`; commit it as it is).

## The site

Qijin Xu's personal site: Lead AI/ML Architect, CGI AI Center of Excellence, Toronto. Next.js 16, React 19, strict
TypeScript, a hand-written WebGL2 painting, Vercel.

**The one fixed idea:** the whole site lives in one giant Chinese ink handscroll painting. Each page is a place along
the scroll, and moving between pages scrolls along the painting to that place (`src/features/landscape/places.ts`).
Keep that. Everything else is open to redesign from scratch: layout, type, colour, header, footer, components, motion,
page structure. Earlier rounds' choices are not rules.

Fixed means the painting and the travel along it: each page's `stretch` and the pan between places. Adding or
removing a page means adding or removing a place on the scroll (`places.ts`, a figure set in `engine/sets/`, its
stills). Comments in the code describe today's build, not rules.

How the painting meets the page today is the band: one fixed band across the top of the window, the page's title
inscribed in its sky, the words rising under it on plain paper. The engine paints it live at 1200 px and up; below
that, and before the engine is live, it shows stills cut from the engine (`public/scenes/band/`). Its numbers live in
`src/features/landscape/band.ts`, the `--band-*` tokens in `src/styles/tokens.css` and `tools/build-band.ts`. This is
current layout and open; changing it means changing those, `src/styles/band.css` and the engine's framing
(`engine/compose.ts`), then cutting the stills again.

What Jack has disliked before: a "webinar" look, bold brush bars, washing the painting out white behind the text,
birds, cherry blossom, colour themes.

## Hard rules (most are checked in CI)

- No phone number anywhere (pages, PDF, JSON, comments). No street address (Toronto, ON, Canada only). No PMP.
- Public email: qxjack@gmail.com.
- Visible name is "Qijin Xu", never with "(Jack)" in it. "Qijin (Jack) Xu" only in titles and search data.
- The only Chinese character is the 徐 seal, drawn as a path. Show Jack any new Chinese text (with pinyin and meaning)
  before using it.
- Never link or publish the old résumé file; its old address redirects to `/resume/`. The only PDF is the generated
  `/resume.pdf`.
- Launch gate: the old résumé PDF is still in this repo's git history. Before qijinxu.com goes public, the history is
  purged (or the repo goes private), and only then is `job-application` made private. Until then no page links to
  this repository. `check:compliance` and `check:links` fail on such a link while `showSourceCode` in
  `content/site.ts` is false.
- Never bypass the corporate web filter. Never change system, security or TLS settings.
- Every fact, figure and claim about Jack comes from `content/` (the résumé, the pages, the cases). Never invent one.
  New words in his voice go into [NEW-WORDS.md](NEW-WORDS.md) for his approval. Search and AI data say only what the
  page says: no hidden text, no instructions to AI agents.

## Performance (not negotiable)

Fast and smooth everywhere, with the painting running. On Jack's laptop: no scroll lag, never a frozen tab. On a phone
(390 px, CPU 4× slower, slow 4G): LCP ≤ 2.5 s, CLS ≤ 0.05, no task over 100 ms, INP ≤ 200 ms, under 2 % of scroll
frames over 20 ms. Lighthouse mobile ≥ 95, desktop ≥ 99. Nothing runs when nothing moves. Design for this from the
start, and never buy speed by cutting the beauty. Measure with `npm run check:budgets` on a QA build, on the real GPU,
with the machine quiet (CI doesn't run it). It covers loading, a scroll, the Ask door and the travel between pages, on
a phone and on a laptop, and the idle page. The numbers above are the bar and fail the run; the rest (byte sizes, font
counts, FCP, Speed Index, TBT, heap, the still's time) are guides, and master already misses four of them (the
baseline is in PR #36's description). Add new pages to its route list.

## Tests

Tests serve the site, not a design: rewrite or delete any test that only guards a layout or feature being replaced.
Keep the hard-rule checks: `check:compliance`, `check:links`, the résumé PDF gate, the content schemas and the smoke
spec's hard rules on the rendered pages. Today the layout-bound ones are the band tests (e2e and unit), the Ask and
pieces specs, and parts of the smoke, a11y and navigation specs. Engine, place and band-number changes also trip
`build:band -- --check` in `npm run ci` (its hash does not cover the CSS), and a changed title trips CI's
`build:og -- --check`: re-cut them once the change settles.

## Working with Jack

- He's not a designer and speaks in feelings. He wants you to lead the art and judge beauty.
- Questions are not instructions: answer first.
- Show him a running preview before anything ships (`npm run preview`, a QA build on port 3106; run it in a Terminal
  tab so it stays up).
- The repo is public: pushing publishes. `master` deploys production, so never push to it. Commit only when he agrees.
- Screenshots and scratch files go outside the repo.
- Versions are exact pins, checked as the latest stable on the day.

## Code

- `content/`: every word ([CONTENT.md](CONTENT.md)). `content/resume.json` is the one source of the résumé page,
  the PDF and the JSON-LD. Words waiting for Jack's approval: [NEW-WORDS.md](NEW-WORDS.md).
- `src/app/`: thin routes. `src/features/<feature>/`: components, logic and CSS. `src/components/`: shared.
  `src/styles/`: global CSS. `src/lib/`: pure helpers.
- `src/features/landscape/`: the painting. Read [ENGINE.md](src/features/landscape/ENGINE.md) before changing it.

## Commands

Node 24 (`.node-version`; if `npm` is missing, prefix `PATH="$HOME/.local/share/fnm/aliases/default/bin:$PATH"`).

- `npm run dev`, `npm run build`, `npm start`, `npm run preview`
- `npm run ci`: type-check, lint, format, unit tests, the band stills' check (`build:band -- --check`)
- `npm run test:e2e`: Playwright against a QA build on port 3100
- `npm run check:compliance`, `npm run check:links`, `npm run check:budgets`
- `npm run build:band`, `build:og`, `build:pdf`, `build:ask`: regenerate assets from a QA build
  (`NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100`)
