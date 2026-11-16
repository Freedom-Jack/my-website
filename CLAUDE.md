# CLAUDE.md

Guidance for Claude Code in this repository. @AGENTS.md holds Next.js's own notes for agents (it is rewritten by
`next dev`; commit it as it is).

## Read first

- [design-demo/DESIGN.md](design-demo/DESIGN.md): the source of truth. §1 is the process rules, §2 the hard rules
  and the launch gate, §11.E Jack's answers, §12 the build plan.
- [README.md](README.md) explains how the app is organised. [CONTENT.md](CONTENT.md) explains where every word lives.
- The Vanguard round (2026-11-02 to 13, DESIGN §12 "Vanguard") rebuilt the whole site on `redesign/v3` with the
  performance budgets as CI gates; its record lists every overturned decision, the DRAFT words and the facts that wait
  for Jack. Until Jack approves that build, the approved look is the one below.
- **Round 6** (DESIGN §12 "Round 6", on `redesign/v5`, from 2026-11-15) is the current work: the live site kept as
  the base, the lag fixed (the plates), what the Vanguard round switched off brought back, and new things on Home
  (the moods, "Ask the painting"). Its brief cancels the Vanguard round's tests and byte budgets, and for this round
  the "approved look" and the frozen design system below are where the work starts, not a fence. New words wait in
  [NEW-WORDS.md](NEW-WORDS.md).
- Round 7 (2026-11-16, DESIGN §12 "Round 7") is on `redesign/v6` and waits for Jack's verdict: the first screen of
  every page is the live site's; everything below it and the footer are new (`src/styles/body.css`: the painting
  the whole width, the words in its mist on one twelve-column grid, words inked between the painting's two leaves,
  the tail with the scroll in miniature). New words are listed in [NEW-WORDS.md](NEW-WORDS.md). Its preview:
  `NEXT_PUBLIC_INK_QA=1 npx next build && NEXT_PUBLIC_INK_QA=1 npx next start -p 3106`.
- The approved look is the build on `round5/spring-ink` itself (DESIGN §12 "Round 5": the one painting, the style
  "Spring ink", its scroll motion and phone depth bands), and demo 4b in `design-demo/` for everything round 5 did not
  change. Any visual change is checked side by side with them, on the real GPU (DESIGN §13); the screenshots stay
  outside the repo.

## Commands

Node 24 (`.node-version`). `npm run dev` · `npm run build` · `npm start` · `npm run ci` (type-check, lint, format
check, unit tests, stills check) · `npm run test:e2e` (needs a build on port 3100) · `npm run check:compliance` ·
`npm run check:links` · `npm run check:budgets` (the HTML gate, Lighthouse and the phone profile against the
budgets; `-- --write` stamps the tail, the local release step) · `npm run build:pdf` · `npm run build:stills` ·
`npm run build:heroes` · `npm run build:og` · `npm run build:ask` (the ask line's index; needs the build served) ·
`npm run preview` (the QA build with the switch panel, on port 3105; it only says so when one is already running
there). The table in README.md says what each does.

## How the code is organised

- `content/` holds every word. Pages never hard-code copy. resume.json is the only source of the résumé page, the
  PDF and the Person JSON-LD.
- `src/app/` routes are thin: metadata, loading data, one feature component.
- `src/features/<feature>/` owns that feature's components, logic and CSS Module. `src/components/` holds what
  several features share. `src/lib/` holds pure helpers.
- `src/styles/` is the global design system ported from the demo (tokens, base, layout, effects, components).
  CSS Modules only place a page's blocks and tune spacing with tokens. They add no new colours, fonts, sizes or
  motion.
- `src/features/landscape/engine/` is the demo's WebGL2 engine in strict TypeScript (typed from the demo's
  JavaScript without changing a pixel), behind the contract in `types.ts`; `engine/renderer.ts` is the contract
  between the engine and its two painters, `figures.ts` the figure sets' API. Change it only with the engine's own docs in mind (design-demo/README.md, "The landscape engine, inside" and "Figure sets and small life").
  After any change to the engine, a figure set, a palette, a light, `elements.ts`, a place, or a strip or band height,
  regenerate the stills (`npm run build:stills`, which needs a QA build).
- `src/features/landscape/elements.ts` is the one switch table of Spring ink's elements and the scroll motion: a new
  element gets a flag there, and off must mean gone.
- `src/features/landscape/plates/` is the stage as page layers on wide screens (round 6): the engine develops each
  depth layer into a canvas there and the browser moves them. **Never put a CSS mask, filter or blend mode on
  `.plates` or anything inside it, nor opacity on a box that holds plates** (it costs 15–25 % GPU on every scroll
  frame; DESIGN §12 "Round 6"). A single plate's own opacity is fine (the band's plate is let go that way).
- `src/features/ask/` is "Ask the painting": the model's worker, the tokenizer and encoder (shared with
  `tools/build-ask.ts`), the routing and retrieval. The model's files are in `public/models/`; its words in
  `content/pages/ask.ts`. It never writes an answer: an answer is a line of the site's own words. `questions.ts`
  files each line under the questions it answers (an index, never shown); after any change to the words, the
  questions or the scene's anchors, run `npm run build:ask` against a served build (a unit test fails until then).
- `src/features/qa/` is the preview's switch panel (QA builds only).
- `places.ts` is the one table of where each page stands in the painting. `PageMain` and the navigation both read
  it.
- `src/styles/body.css` is the body's design system (round 7): the grid, the name-face titles and their brush
  rules, the ink numerals, the pointer's wash, the ending, the tail. A page's CSS Module only places its blocks on
  the grid. A block of words below the first screen carries `data-veil` so the mist lies behind it
  (`features/landscape/plates/veils.ts`); `.inked` puts display words between the painting's two leaves.
- Never a CSS mask, filter or blend mode on the plates or anything in them, and no opacity on a box that holds
  plates (15 to 25 % GPU on every scroll frame). Never a pseudo-element with a ground of its own over a block of
  words (axe can no longer decide their contrast): use a real element. An image below the first screen gets its
  source through `data-src` and `data-near` (`glimpse-stills.ts`), not `loading="lazy"` alone.
- The first screen of every page (the navigation, the title, the opening lines, the painting beside them and its
  scroll motion) is the part Jack likes: change nothing there without his word, and add nothing to the painting.

## Rules that are not negotiable (DESIGN §1, §2)

- No phone number anywhere, no street address (city only), no project-management credential. The public email is
  qxjack@gmail.com. The only Chinese character is the seal's (drawn as a path). Visible text never says "(Jack)".
- Never link to or publish the old résumé file. It redirects to /resume/, never to /resume.pdf.
- Never bypass the corporate web filter, and never change system, security or TLS settings.
- Screenshots and research go to a scratchpad outside the repo.
- `master` deploys production: never push to it. Pushing any branch publishes it (the repo is public). Commit only
  when Jack agrees. Launch steps (the history purge, force-pushes, the domain, repository visibility) wait for his
  explicit go.
- Questions from Jack are not instructions: answer first. Show a demo or a preview before building, and show any
  new Chinese text before using it.
- Versions are exact pins, checked as the latest stable on the day they change, never from memory.
