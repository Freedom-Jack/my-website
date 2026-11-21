# Editing the site's words

Every word on the site lives in `content/`. Code never holds copy, so changing what the site says never means touching
a component. Run `npm run dev`, edit, and the page updates. Before you push, run `npm run ci`; it checks every content
file (the schemas, the hard rules, the counts below).

| To change                                                                                                 | Edit                                                    |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Name, title, email, city, profiles, jobs, education, skills, awards, certificates                         | `content/resume.json`                                   |
| A page's own words (Home, Work, Writing, Résumé, Contact, 404)                                            | `content/pages/<page>.ts`                               |
| A project (its page `/work/<slug>/` and its entry on Work)                                                | `content/work/<slug>.mdx`                               |
| A note (`/writing/<slug>/`)                                                                               | `content/writing/<slug>.mdx`                            |
| The nav, the tail's words, the bio line, the site's address, search data                                  | `content/site.ts`                                       |
| The tail's measured number (written by `npm run check:budgets -- --write`, never by hand)                 | `content/measured.json`                                 |
| The "In the open" repositories on Work                                                                    | `content/github/overrides.json`                         |
| A project's brush diagram                                                                                 | `content/work/diagrams/<name>.wide.svg` and `.tall.svg` |
| "Under the hood": its label, the three pieces' titles, the size and loading lines                         | `content/pages/work-craft.ts` (`hood`)                  |
| The three pieces' ties and cases, their long words, the eval set                                          | `content/craft/hood.ts`, `content/craft/eval.ts`        |
| "Ask the painting": the door's two words in the header                                                    | `content/pages/ask-door.ts`                             |
| "Ask the painting": the field in the header, the panel, the examples, the trace, what it says when unsure | `content/pages/ask.ts`                                  |
| A case page's shared words: "internal figure", the NDA line                                               | `content/pages/case.ts`                                 |
| Where a project's figure comes from (`public-source`, `internal`, `projected`)                            | `content/work/<slug>.mdx` (`figure.basis`)              |
| What `/llms.txt` tells AI agents                                                                          | `content/pages/llms.ts`                                 |

A page stands alone: nothing at its end links on to another page. The header's nav (`content/site.ts` `nav`) is the
way to every page.

## What stands where

Each page's title is inscribed in the painting's band, most with one line under it; the rest rises under the band.

- **Home** (`content/pages/home.ts`). In the band: the name and `first.title`. First screen: `first.verb`, the
  proof (`first.proof`; its figure is the case's own), the dated line (`hero.lead[1]`, `first.now`) and the awards
  (`content/resume.json` `awards`). Then "What I work on" (`workOn`; each row's numeral is its case's figure), the
  current role (the first in `content/resume.json` `work`: its position and highlights, as the résumé has them),
  "About me" with the portrait and "Now" (`about`, `now`), the two newest notes, and "Say hello" (`hello`). There is
  no Ask section on Home: Ask is the door in the header.
- **Work** (`content/pages/work.ts`). In the band: `title` and `index.title`. Then the thesis (`build.statement`)
  beside `intro`; the projects as one list in two scales (the two with the lowest `order` large, with figure,
  summary, outcome and evidence; the rest as a ruled set); "How I build" (`build.line`, its diagram); "In the open"
  (`open`). There is no search box: the search is Ask's first step.
- **A case** (`content/work/<slug>.mdx`, `content/pages/case.ts`). In the band: its title, organisation, years and
  role. Then the figure with its measure and basis beside the summary, the body part by part, the way back and the
  cases on either side. Three cases also carry a live piece of "Under the hood" (`case` in `content/craft/hood.ts`
  names the page).
- **Writing** (`content/pages/writing.ts`). In the band: `title` and `intro`. The newest note stands open (its
  date, title and `description`, `read`). Under `from`: that note's first table, if it has three columns or more,
  as a comparison the reader turns row by row. Older notes follow as a list. Then the three live pieces (title from
  `content/pages/work-craft.ts`, tie from `content/craft/hood.ts`), each linking to its case, and the feed.
- **Résumé** (`content/resume.json`; labels in `content/pages/resume.ts`). In the band: `title`. The page's own
  heading is his name.
- **Contact** (`content/pages/contact.ts`). In the band: `title` and the `where` line. Then `intro`, the address,
  `copy`, `response`, the three `ways`, and under `bio.label` the portrait (Home's) beside `bio` from
  `content/site.ts`.
- **The 404** (`content/pages/not-found.ts`). In the band: `title` and `line`. Then the two ways back.
- **Every page.** The header: `nav` in `content/site.ts` and the Ask door. The tail: Ask's line (`invite`,
  `tailTry`), the map of the scroll, `tail` in `content/site.ts`. Every page but Contact and the 404 ends on the
  next place's name, inscribed in the band.

## The résumé: one file, three outputs

`content/resume.json` ([JSON Resume](https://jsonresume.org/schema) plus a few page-only fields) is the single source of:

- the web résumé, `/resume/`;
- the PDF, `/resume.pdf`, which is printed from that page;
- the machine-readable copy, `/resume.json`, and the Person data search engines read.

Its facts follow Jack's own résumé, `resume_ats.tex` in [Freedom-Jack/career-kit](https://github.com/Freedom-Jack/career-kit):
when that changes, bring the facts across here (titles, dates, figures, awards). Where the tex only condenses a role
to fit one page, this file keeps its fuller wording. Never copy its phone number, and never link its PDF (AGENTS.md, hard rules).

After changing it, regenerate the PDF:

```bash
npm run build && npm start -- -p 3100
```

```bash
npm run build:pdf
```

The PDF tool refuses to write a file that contains a phone number or runs past two pages. The schema
(`src/features/resume/schema.ts`) refuses unknown fields, so a `phone` field fails the build. Home prints the first
role and the awards from this file too, and Ask answers from it (see "After any change of words").

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
2. Fill in the front matter. Every field is commented in that file. `order` places it on Work (1 is the newest, and
   every order is unique); the two lowest are the large entries. `evidence` is a list of public links; leave it empty
   for client work. `figure.basis` says where the figure comes from.
3. Write the body under these headings, each optional: `## Problem`, `## My part`, `## The hard part`,
   `## Outcome and status`, `## Evidence`, `## Stack`. A glossary note goes right after the paragraph it explains:
   `<Note term="RAG">Retrieval-augmented generation. …</Note>`.
4. If it has a diagram, add `content/work/diagrams/<name>.wide.svg` and `<name>.tall.svg` (copy an existing pair:
   strokes carry `data-order` for the draw-in) and set `diagram.name`, its caption and its steps. The page draws it
   after "My part".
5. **Update the counts.** The words say how many projects there are: "Six projects, newest first", "All six
   projects →" and the description's "Six projects by …" in `content/pages/work.ts`, "All six projects →" in
   `content/pages/home.ts`, and "six projects" in `content/pages/llms.ts`. The unit tests fail until Work's and
   Home's counts match the number of files (`tests/unit/content.test.ts`); one more pins the number of cases to six
   (`tests/unit/craft.test.ts`, "six different quays"): change it with them.
6. Rebuild the Ask index (see "After any change of words").
7. Cut its link-preview card: with a QA build served on port 3100 (README, "A QA build"), run
   `npm run build:og -- --pages work-<slug>`. Until then a shared link shows Work's card, and CI fails.

Home's "What I work on" rows link to cases by address (`content/pages/home.ts`); add one there if the new project
belongs on Home.

## Add a note

1. Copy `content/writing/what-is-an-ai-agent.mdx` to `content/writing/<slug>.mdx` (the address is
   `/writing/<slug>/`).
2. Set `title`, `kind` (`Note` or `Essay`), `published` (an ISO date such as `'2026-11-02'`), `description` (the
   line Writing and Home show) and `metaDescription`. When you later change its words, set `modified` and say what
   changed in `modifiedNote` (one quiet word, such as "Updated": the byline prints it before the date); the byline
   and the search data follow.
3. Write it in Markdown. Use `##` and `###` headings, tables, links, and `<Quote cite="https://…">…</Quote>` for a
   quotation from a source.
4. Rebuild the Ask index (see "After any change of words").
5. Cut its link-preview card, as for a project: `npm run build:og -- --pages writing-<slug>`.

The newest note is the one Writing opens; the others move into the list under it. Writing's comparison is the newest
note's first table, so a new note without a table of three columns or more leaves Writing without one. Home shows
the two newest. The feed (`/writing/feed.xml`) and the sitemap pick it up on their own. `content/pages/llms.ts`
names the notes in words for AI agents, so add the new one there.

## After any change of words

"Ask the painting" answers with the site's own lines, so its index is built from them
(`public/ask/index.json`). After changing a page's words, a case, a note or the résumé, serve a build on port 3100
and run:

```bash
npm run build:ask
```

A unit test fails while the index is older than the words (`tests/unit/craft.test.ts`). `npm run build:ask` itself
fails when a line that a question is filed under has changed (`src/features/ask/questions.ts` names each line by its
opening words): fix the entry there. The three examples in `content/pages/ask.ts` (`tries`) are filed questions, so
they are answered at once, with no model: keep them so (`tests/unit/ask.test.ts` checks it).

A link-preview card carries its page's title and the line under it. After changing either, cut the card again from
a QA build on port 3100: `npm run build:og -- --pages <id>` (`home`, `work`, `writing`, `resume`, `contact`,
`work-<slug>`, `writing-<slug>`). CI runs `npm run build:og -- --check`, which names the stale ones and any case or
note without a card of its own.

## "In the open" (GitHub)

Work's "In the open" section lists public repositories, fetched from GitHub at build time and refreshed daily. It
never runs in the visitor's browser. `content/github/overrides.json` gives a repository its year and its one line,
or hides it (`"hidden": true`). Without an override, a repository shows its own GitHub description, as long as that
reads as a proper sentence; placeholders and near-empty repositories are skipped. Older repositories fold behind
"Early work". `snapshot.json` is the fallback when GitHub cannot be reached (refresh it by hand from
`https://api.github.com/users/Freedom-Jack/repos`). Two
repositories are never shown until the launch gate is cleared (`src/features/github/rules.ts`).

## The rules every word follows

These are checked on every push (`npm run check:compliance`, and the unit tests). A breach fails the build.

- No phone number anywhere: pages, the PDF, the JSON, comments.
- No street address. The city only: Toronto, ON, Canada.
- No project-management certification.
- The public email is qxjack@gmail.com.
- Chinese appears only as drawings: the seal's character and Home's inscription (`content/inscriptions.ts`: the
  pinyin, the English and the drawing's size; the drawing is `public/inscriptions/home.svg`). Never typed as text. A
  new or changed line is shown to Jack first, then drawn.
- Visible text says "Qijin Xu". "Jack" appears only in the Résumé's "Goes by Jack". The search phrase
  "Qijin (Jack) Xu" lives in page titles and search data only.
- Any new Chinese text is shown to Jack before it is used.
- New words in Jack's voice that he has not approved are marked `NEW WORDS (for Jack)` or `DRAFT` where they stand
  and listed in `NEW-WORDS.md` at the repo's root, for his approval.
- Approved words taken off a page are held, word for word, beside the ones shown (`held` in
  `content/pages/home.ts`: Now's off-hours line, which About's last paragraph already says), for Jack's call.
