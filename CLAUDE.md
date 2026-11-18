# CLAUDE.md

@AGENTS.md is Next.js's own note for agents (rewritten by `next dev`; commit it as it is).

## The site

Qijin Xu's personal site: Lead AI/ML Architect, CGI AI Center of Excellence, Toronto. Next.js 16, React 19, strict
TypeScript, a hand-written WebGL2 painting, Vercel.

**The one fixed idea:** the whole site lives in one giant Chinese ink handscroll painting. Each page is a place along
the scroll, and moving between pages scrolls along the painting to that place (`src/features/landscape/places.ts`).
Keep that. Everything else is open to redesign from scratch: layout, type, colour, header, footer, components, motion,
page structure. Earlier rounds' choices are not rules.

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
  purged (or the repo goes private), and only then is `job-application` made private. Until then the "Source code"
  link stays hidden (`content/site.ts` `showSourceCode`).
- Never bypass the corporate web filter. Never change system, security or TLS settings.
- Every fact, figure and claim about Jack comes from `content/` (the résumé, the pages, the cases). Never invent one.
  New words in his voice go into [NEW-WORDS.md](NEW-WORDS.md) for his approval. Search and AI data say only what the
  page says: no hidden text, no instructions to AI agents.

## Performance (not negotiable)

Fast and smooth everywhere, with the painting running. On Jack's laptop: no scroll lag, never a frozen tab. On a phone
(390 px, CPU 4× slower, slow 4G): LCP ≤ 2.5 s, CLS ≤ 0.05, no task over 100 ms, INP ≤ 200 ms, under 2 % of scroll
frames over 20 ms. Lighthouse mobile ≥ 95, desktop ≥ 99. Nothing runs when nothing moves. Design for this from the
start, and never buy speed by cutting the beauty. Measure with `npm run check:budgets` on a QA build, on the real GPU,
with the machine quiet (CI doesn't run it). Its byte limits are guides, not the bar.

## Tests

Tests serve the site, not the old design: rewrite or delete any test that only guards a layout or feature being
replaced. Keep the hard-rule checks: `check:compliance`, the résumé PDF gate and the content schemas.

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
- `npm run ci`: type-check, lint, format, unit tests, stills and heroes checks
- `npm run test:e2e`: Playwright against a build on port 3100
- `npm run check:compliance`, `npm run check:links`, `npm run check:budgets`
- `npm run build:stills`, `build:heroes`, `build:og`, `build:pdf`, `build:scroll`: regenerate assets from a QA build
  (`NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100`)
