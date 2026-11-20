# Qijin Xu: personal site

The personal site of Qijin Xu, Lead AI/ML Architect in Toronto. The whole site is one long ink-wash handscroll: each
page is a place along it, the painting stands in a band across the top of the window with the page's title inscribed
in it, and moving between pages travels along the painting.

Next.js 16 · React 19 · TypeScript (strict) · MDX · zod · a hand-written WebGL2 engine · Vitest · Playwright ·
Vercel. Versions are pinned exactly in `package.json`.

## Run it

Node 24 (`.node-version`):

```bash
npm ci
```

```bash
npm run dev
```

`.env.local` may hold a read-only `GITHUB_TOKEN` for Work's "In the open" list: it raises GitHub's rate limit. When
GitHub cannot be reached, the build falls back to `content/github/snapshot.json`.

| Command                          | What it does                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | dev server                                                                                                  |
| `npm run build`, `start`         | production build and server                                                                                 |
| `npm run preview`                | QA build, served on port 3106                                                                               |
| `npm run ci`                     | type-check, lint, format check, unit tests, the band stills' check                                          |
| `npm run typecheck`, `lint`      | the first two of those on their own                                                                         |
| `npm run format`                 | Prettier, writing (`format:check` only checks)                                                              |
| `npm test`, `npm run test:watch` | unit tests (Vitest)                                                                                         |
| `npm run test:e2e`               | Playwright against a QA build on port 3100                                                                  |
| `npm run check:compliance`       | the hard rules over the sources and the built pages                                                         |
| `npm run check:links`            | every link on the served site (port 3100)                                                                   |
| `npm run check:budgets`          | the speed check: Lighthouse, a phone, a laptop, the idle page (`-- --write` stamps `content/measured.json`) |
| `npm run build:pdf`              | prints `/resume/` to `public/resume.pdf` (needs a build on 3100)                                            |
| `npm run build:band`             | the painting's still images (needs a QA build on 3100; `-- --check` in CI)                                  |
| `npm run build:og`               | link-preview cards (needs a QA build on 3100; `-- --check` in CI)                                           |
| `npm run build:ask`              | the "Ask the painting" index (needs a build on 3100)                                                        |

A QA build: `NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100`. A second build beside a served one names
its own folder: `NEXT_DIST_DIR=.next-tools` (`next.config.ts`).

## Where things are

- Words: `content/`, explained in [CONTENT.md](CONTENT.md). Words waiting for approval: [NEW-WORDS.md](NEW-WORDS.md).
- Pages: `src/app/` (thin routes) and `src/features/<feature>/` (Home, Work, Writing, Résumé, Contact, Ask).
- The painting: `src/features/landscape/`, explained in [ENGINE.md](src/features/landscape/ENGINE.md). How it meets
  the page: `src/components/layout/Band.tsx`, `src/styles/band.css`.
- Shared styles: `src/styles/` (tokens, base, band, shell, prose).
- Tests: `tests/unit/` and `tests/e2e/`. Tools: `tools/`.
- CI: `.github/workflows/ci.yml` runs on every pull request and every push to `master`.
- Rules for anyone changing the site, person or model: [CLAUDE.md](CLAUDE.md).

## Deploying

Vercel builds every pushed branch as a preview. A push to `master` deploys production. The old addresses redirect
with 301s (`src/lib/redirects.ts`).
