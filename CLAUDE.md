# CLAUDE.md

Guidance for Claude Code in this repository. @AGENTS.md holds Next.js's own notes for agents (it is rewritten by
`next dev`; commit it as it is).

## Read first

- [design-demo/DESIGN.md](design-demo/DESIGN.md): the source of truth. §1 is the process rules, §2 the hard rules
  and the launch gate, §11.E Jack's answers, §12 the build plan.
- [README.md](README.md) explains how the app is organised. [CONTENT.md](CONTENT.md) explains where every word lives.
- The approved look is demo 4b in `design-demo/`. Any visual change is checked side by side with it, on the real GPU (DESIGN §13).

## Commands

Node 24 (`.node-version`). `npm run dev` · `npm run build` · `npm start` · `npm run ci` (type-check, lint, format
check, unit tests, stills check) · `npm run test:e2e` (needs a build on port 3100) · `npm run check:compliance` ·
`npm run check:links` · `npm run build:pdf` · `npm run build:stills`. The table in README.md says what each does.

## How the code is organised

- `content/` holds every word. Pages never hard-code copy. resume.json is the only source of the résumé page, the
  PDF and the Person JSON-LD.
- `src/app/` routes are thin: metadata, loading data, one feature component.
- `src/features/<feature>/` owns that feature's components, logic and CSS Module. `src/components/` holds what
  several features share. `src/lib/` holds pure helpers.
- `src/styles/` is the global design system ported from the demo (tokens, base, layout, effects, components).
  CSS Modules only place a page's blocks and tune spacing with tokens. They add no new colours, fonts, sizes or
  motion.
- `src/features/landscape/engine/` is the demo's WebGL2 engine as JavaScript modules behind a typed contract
  (`types.ts`). Change it only with the engine's own docs in mind (design-demo/README.md, "The landscape engine, inside" and "Figure sets and small life").
  After any change to the engine, a figure set, a palette, a place or a strip height, regenerate the stills
  (`npm run build:stills`, which needs a QA build).
- `places.ts` is the one table of where each page stands in the painting. `PageMain` and the navigation both read
  it.

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
