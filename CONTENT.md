# Editing the site's words

Every word on the site lives in `content/`. Code never holds copy, so changing what the site says never means touching
a component. Run `npm run dev`, edit, and the page updates. Before you push, run `npm run ci`; it checks every content
file (the schemas, the hard rules, the counts below).

| To change                                                                         | Edit                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Name, title, email, city, profiles, jobs, education, skills, awards, certificates | `content/resume.json`                                   |
| A page's own words (Home, Work's index, Contact, Writing, Résumé, 404)            | `content/pages/<page>.ts`                               |
| A project (its page `/work/<slug>/` and its row in Work's table)                  | `content/work/<slug>.mdx`                               |
| A note (`/writing/<slug>/`)                                                       | `content/writing/<slug>.mdx`                            |
| The nav, the footer's "Updated", the author line, the site's address, search data | `content/site.ts`                                       |
| The "In the open" repositories on Work                                            | `content/github/overrides.json`                         |
| A project's brush diagram                                                         | `content/work/diagrams/<name>.wide.svg` and `.tall.svg` |

## The résumé: one file, three outputs

`content/resume.json` ([JSON Resume](https://jsonresume.org/schema) plus a few page-only fields) is the single source of:

- the web résumé, `/resume/`;
- the PDF, `/resume.pdf`, which is printed from that page;
- the machine-readable copy, `/resume.json`, and the Person data search engines read.

Its facts follow Jack's own résumé, `resume_ats.tex` in [Freedom-Jack/career-kit](https://github.com/Freedom-Jack/career-kit):
when that changes, bring the facts across here (titles, dates, figures, awards). Where the tex only condenses a role
to fit one page, this file keeps its fuller wording. Never copy its phone number, and never link its PDF (DESIGN §2).

After changing it, regenerate the PDF:

```bash
npm run build && npm start
```

```bash
npm run build:pdf
```

The PDF tool refuses to write a file that contains a phone number or runs past two pages. The schema
(`src/features/resume/schema.ts`) refuses unknown fields, so a `phone` field fails the build.

## Inline markup

Content strings (in `.ts` and `.json` files, and inside MDX) understand four things and nothing else. HTML is never
interpreted.

| Write            | Get                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**90%**`        | a figure in bold at text size                                                                                                                                               |
| `[text](/work/)` | a link: an on-site address moves through the painting, any other address leaves the site                                                                                    |
| `{Azure OpenAI}` | words kept together on one line                                                                                                                                             |
| `{{years}}`      | the career length in words ("five"); `{{years+}}` gives the figure ("5+"). Both count from August 2021, when full-time work began (`CAREER_START`, `src/lib/typography.ts`) |

Typography is automatic: a non-breaking space between a number and its unit ("50,000 users"), short hyphenated
compounds kept whole ("LLM-powered"). Use real punctuation: ’ “ ” – —.

## Add a project

1. Copy `content/work/rag-assistant.mdx` to `content/work/<slug>.mdx`. The file name becomes the address,
   `/work/<slug>/`, so use lowercase words joined by hyphens.
2. Fill in the front matter. Every field is commented in that file. `order` puts it in Work's table (1 is the
   newest, and every order is unique). `evidence` is a list of public links; leave it empty for client work.
3. Write the body under these headings, each optional: `## Context`, `## What I did`, `## Outcome`, `## Evidence`,
   `## Stack`. A glossary note goes right after the paragraph it explains:
   `<Note term="RAG">Retrieval-augmented generation. …</Note>`.
4. If it has a diagram, add `content/work/diagrams/<name>.wide.svg` and `<name>.tall.svg` (copy an existing pair:
   strokes carry `data-order` for the draw-in) and set `diagram.name`.
5. **Update the counts.** The words say how many projects there are: "Six projects, newest first" and "All six
   projects →" in `content/pages/work.ts`, and "All six projects →" in `content/pages/home.ts`. The unit tests fail
   until they match the number of files.

6. Optional: give it its own link-preview card. Until then a shared link shows Work's. With a QA build served on
   port 3100 (README, "After changing the engine…"), run `npm run build:og -- --pages work-<slug>`.

Home's "What I work on" rows link to cases by address (`content/pages/home.ts`); add one there if the new project
belongs on Home.

## Add a note

1. Copy `content/writing/what-is-an-ai-agent.mdx` to `content/writing/<slug>.mdx` (the address is
   `/writing/<slug>/`).
2. Set `title`, `published` (an ISO date such as `'2026-11-02'`), `description` (the Writing list's line) and
   `metaDescription`. When you later change its words, set `modified` and say what changed in `modifiedNote` (one
   quiet word, such as "Updated": the byline prints it before the date); the byline and the search data follow.
3. Write it in Markdown. Use `##` and `###` headings, tables, links, and `<Quote cite="https://…">…</Quote>` for a
   quotation from a source.

The Writing list, the feed (`/writing/feed.xml`) and the sitemap pick it up on their own. Its link-preview card is
Writing's until `npm run build:og -- --pages writing-<slug>` cuts its own (as for a project). `content/pages/llms.ts`
describes Writing in words for AI agents, so mention the new note there if it matters.

## "In the open" (GitHub)

Work's "In the open" section lists public repositories, fetched from GitHub at build time and refreshed daily. It
never runs in the visitor's browser. `content/github/overrides.json` gives a repository its year and its one line,
or hides it (`"hidden": true`). Without an override, a repository shows its own GitHub description, as long as that
reads as a proper sentence; placeholders and near-empty repositories are skipped. Older repositories fold behind
"Early work". `snapshot.json` is the fallback when GitHub cannot be reached (refresh it with
`python3 design-demo/tools/sync-projects.py --discover`, or add a repository's API record by hand). Two
repositories are never shown until the launch gate is cleared (`src/features/github/rules.ts`).

## The rules every word follows

These are checked on every push (`npm run check:compliance`, and the unit tests). A breach fails the build.

- No phone number anywhere: pages, the PDF, the JSON, comments.
- No street address. The city only: Toronto, ON, Canada.
- No project-management certification.
- The public email is qxjack@gmail.com.
- The only Chinese character on the site is the seal's, and it is drawn as a path, never typed as text.
- Visible text says "Qijin Xu". "Jack" appears only in the About-me sign-off ("— Jack") and "Goes by Jack". The
  search phrase "Qijin (Jack) Xu" lives in page titles and search data only.
- Any new Chinese text is shown to Jack before it is used.
