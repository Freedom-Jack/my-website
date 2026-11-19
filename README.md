# Qijin Xu: personal site

The personal site of Qijin Xu, Lead AI/ML Architect in Toronto. Every page stands in one long ink-wash handscroll, a
WebGL2 landscape painted behind the text, and moving between pages travels along the painting.

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

| Command                    | What it does                                                                   |
| -------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`              | dev server                                                                     |
| `npm run build`, `start`   | production build and server                                                    |
| `npm run preview`          | QA build on port 3106                                                          |
| `npm run ci`               | type-check, lint, format, unit tests, stills and heroes checks                 |
| `npm run test:e2e`         | Playwright against a build on port 3100                                        |
| `npm run check:compliance` | the hard rules over the sources and the built pages                            |
| `npm run check:links`      | every link on the built site                                                   |
| `npm run check:budgets`    | HTML size and Lighthouse budgets (`-- --write` stamps `content/measured.json`) |
| `npm run build:pdf`        | prints `/resume/` to `public/resume.pdf`                                       |
| `npm run build:stills`     | the painting's still images (needs a QA build on 3100)                         |
| `npm run build:heroes`     | each page's first-frame still (needs a QA build on 3100)                       |
| `npm run build:og`         | link-preview cards (needs a QA build on 3100)                                  |
| `npm run build:scroll`     | the strip of the whole scroll (needs a QA build on 3100)                       |
| `npm run build:ask`        | the "Ask the painting" index (needs a build on 3100)                           |

A QA build: `NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100`.

## Where things are

- Words: `content/`, explained in [CONTENT.md](CONTENT.md).
- The painting: `src/features/landscape/`, explained in [ENGINE.md](src/features/landscape/ENGINE.md).
- CI: `.github/workflows/ci.yml` runs on every pull request and every push to `master`.

## Deploying

Vercel builds every pushed branch as a preview. A push to `master` deploys production. The old addresses redirect
with 301s (`src/lib/redirects.ts`).
