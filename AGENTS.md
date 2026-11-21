# AGENTS.md

The standing rules for this site, for any agent or person changing it (Claude Code, Codex, Cursor, a human). This is the
one source: `CLAUDE.md` only imports it. Edit rules here, nowhere else. Read this file fully before touching anything.

## Read first, by task

| If you are…                          | Read                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| Changing anything                    | this file, then [docs/DIRECTION.md](docs/DIRECTION.md) (taste, decisions)           |
| Changing words on a page             | [CONTENT.md](CONTENT.md); new words in his voice go to [NEW-WORDS.md](NEW-WORDS.md) |
| Touching the painting, band, a place | [ENGINE.md](src/features/landscape/ENGINE.md)                                       |
| Running, building, deploying         | [README.md](README.md)                                                              |
| Writing Next.js code                 | the managed block at the bottom of this file, then `node_modules/next/dist/docs/`   |

## The site

Qijin Xu's personal site: Lead AI/ML Architect, CGI AI Center of Excellence, Toronto. Next.js 16, React 19, strict
TypeScript, a hand-written WebGL2 painting, deployed on Vercel.

**The one fixed idea:** the whole site lives in one giant Chinese ink handscroll painting. Each page is a place along
the scroll, and moving between pages scrolls along the painting to that place (`src/features/landscape/places.ts`).
Keep that. Everything else is open to redesign from scratch: layout, type, colour, header, footer, components, motion,
page structure. Earlier rounds' choices are not rules.

Fixed means the painting and the travel along it: each page's `stretch` and the pan between places. Adding or
removing a page means adding or removing a place on the scroll (`places.ts`, a figure set in `engine/sets/`, its
stills). Comments in the code describe today's build, not rules.

How the painting meets the page today is the band: at a page's top it stands across the window at full size, and the
page's own title and words are on the paper under it. As the page is read the band rolls up into a ribbon of the
painting under the header's bar, which takes its paper then, so the words have the window. Home alone carries an
inscription in its sky (a few columns of brush script with the seal, the line in English beside it). The engine
paints the band live at 1200 px and up; below that, and before the engine is live, it shows stills cut from the engine
(`public/scenes/band/`). Its numbers live in `src/features/landscape/band.ts`, the `--band-*` and `--ribbon-*` tokens
in `src/styles/tokens.css` and `tools/build-band.ts`. This is current layout and open; changing it means changing
those, `src/styles/band.css` and the engine's framing (`engine/compose.ts`), then cutting the stills again. The
body's shared language (leaves, scene covers, figures, buttons) is `src/styles/leaves.css`. About shares Home's place
on the scroll.

A page stands alone: no page links on to another at its end, and nothing in the painting is a link. The header is the
way to every page. The footer is a closing line (colophon, "Still the landscape", email, seal), not a second header.

What Jack has disliked before: a "webinar" look, bold brush bars, washing the painting out white behind the text,
birds, cherry blossom, colour themes, anything large lettered on the painting, his name in the painting, his
photograph, a site that is all about work, "downstream" links at a page's end, a footer that repeats the header.

## Hard rules (most are checked in CI)

- No phone number anywhere (pages, PDF, JSON, comments). No street address (Toronto, ON, Canada only). No PMP.
- Public email: qxjack@gmail.com.
- Visible name is "Qijin Xu", never with "(Jack)" in it. "Qijin (Jack) Xu" only in titles and search data.
- Chinese appears only as drawings: the 徐 seal and Home's inscription (`content/inscriptions.ts`,
  `public/inscriptions/home.svg`), each drawn as paths. No Chinese text and no CJK font in any page or file. Show Jack any new
  Chinese line (with pinyin and meaning) before using it.
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

## Deployment (Vercel)

Vercel builds every pushed branch as a preview; a push to `master` deploys production. Old addresses redirect with 301s
(`src/lib/redirects.ts`). Versions are exact pins, checked as the latest stable on the day.

## Tests

Tests serve the site, not a design: rewrite or delete any test that only guards a layout or feature being replaced.
Keep the hard-rule checks: `check:compliance`, `check:links`, the résumé PDF gate, the content schemas and the smoke
spec's hard rules on the rendered pages. Today the layout-bound ones are the band tests (e2e and unit), the Ask and
pieces specs, and parts of the smoke, a11y and navigation specs. The inscriptions are drawn by a tool kept outside
the repo (it needs the brush face's outlines); a changed line means drawing its file again. Engine, place and band-number changes also trip
`build:band -- --check` in `npm run ci` (its hash does not cover the CSS), and a changed title trips CI's
`build:og -- --check`: re-cut them once the change settles.

## Working with Jack

- He's not a designer and speaks in feelings. He wants you to lead the art and judge beauty.
- Questions are not instructions: answer first.
- Show him a running preview before anything ships (`npm run preview`, a QA build on port 3106; run it in a Terminal
  tab so it stays up).
- Tell him when work is done, in plain English.
- The repo is public: pushing publishes. `master` deploys production, so never push to it. Commit only when he agrees.
- Screenshots and scratch files go outside the repo.
- Art references: official sources only; never proxies, caches or mirrors past the corporate filter.

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
- Ports: 3006 dev, 3100 QA build for tools and tests, 3106 Jack's preview.
- Gotcha: a build into another folder (`NEXT_DIST_DIR=.next-x`) rewrites `tsconfig.json`; restore it with
  `git checkout -- tsconfig.json` or `format:check` fails.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
