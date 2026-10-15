# Copy deck: Qijin Xu, site v2

Single source of truth for every word on the redesigned site. Builders paste text straight from here.

- **Status:** draft 3 (round 4a), 9 Oct 2026, with Jack's answers of 9–10 Oct 2026 (`brief-r4a.md`); builder notes updated at integration, 10 Oct (no copy changed). Build spec: `SPEC-R4A.md`. The approved plan: `_notes/r4/proposal.md`. Draft 2 (round 3) is superseded; nothing from it is built unless it is repeated here.
- **How to read this file:**
  - Text after a **bold label** is the copy. Paste it exactly, punctuation included.
  - Lines in *[italic brackets]* are notes for builders. Do not paste them.
  - **DRAFT** marks words written for Jack's review: built exactly as written in demo 4a, then replaced by his own words or his edits. Drafts from Jack's own answers (9–10 Oct) say so; drafts from existing facts say so too.
  - `{{PENDING: …}}` marks a fact Jack must confirm. In the demo, **leave that element out** rather than guessing (section 10).
  - **OMITTED (needs Jack's words)** marks a place where a block could go but no honest copy exists yet. Build nothing there: no heading, no placeholder, no "coming soon".
- **Hard rules baked in:** no phone number (decided 9 Oct 2026), no street address, no PMP. The only Chinese character anywhere is 徐, and only inside the seal (the header's and the About-me signature's). Never link or publish the OLD résumé PDF from the Next.js repo; it contains a phone number. The NEW PDF, `/resume.pdf`, is printed from `/resume/` with no phone number and is linked as "View résumé (PDF)". Contact is aimed at collaboration and speaking: no "hire me" language anywhere (his employer can read the site).
- **The name rule (Jack, 9 Oct 2026): Qijin is the name; Jack is the voice.** Everything visible says **Qijin Xu**: the hero, the header link, the footer, bylines, the résumé heading, the photo's alt text. "Jack" never sits inside or beside the name. It appears visibly in exactly two places: the About-me signature "— Jack" and the résumé's "Goes by Jack". *[The GitHub handle "Freedom-Jack" (Contact, the résumé's contact line, repository links) is an account name and does not count.]* Search engines keep the phrase "Qijin (Jack) Xu" in `<title>`, meta descriptions and JSON-LD `alternateName` (section 8). Never brackets, a smaller "Jack" inside the name, "Jack Xu" as a heading, or a fake-handwriting font.
- **Round-4a changelog (what changed since draft 2):**
  - Home becomes the "about me" page: the hero is "Qijin Xu" plus Jack's sentence (1.1); then his colour photo with "About me" and his signature (1.2); What I work on (1.3); Now (1.4); Writing (1.5); Say hello (1.6); the closing "Next: Work" (1.7).
  - `/about/` becomes a redirect stub to `/` (section 2). Its timeline, skills and credentials live on the Résumé only.
  - Work gains "How I build" (the statement and the diagram, moved from Home) and drops the table's Kind column; "In the open" is auto-discovered from GitHub at build time (3.4).
  - Header: the seal plus the words "Qijin Xu" as one home link; nav Work · Résumé · Contact. Footer: a five-place story map.
  - The Note's typos are fixed (4.2, with a list of every change).
  - Facts confirmed by Jack (10 Oct): the title Lead AI/ML Architect everywhere; a second CGI Impact Award (2026); education 2017 – 2021; the LinkedIn URL.
  - SEO: `ProfilePage` moves to `/`; Person `name` "Qijin Xu" with `alternateName` "Jack Xu" and "Qijin (Jack) Xu"; `Person.image` is the new colour photo; titles use " · ".
- **Voice:** plain, confident, first person on the site; third person in meta descriptions and structured data. Short sentences. Numbers carry the weight; inside sentences they are bold at text size, never enlarged. Banned words: revolutionary, cutting-edge, passionate, leverage/leveraging, synergy, seamless, world-class, innovative.
- **Typography in copy:** curly apostrophes (’) and quotes in visible text (straight ones in JSON), en dash for ranges (Aug 2023 – Dec 2024), `≥` and `~` as written, thin "·" separators.

---

## 0. Global (every page)

### Routes *[old routes get 301s, see 8.9]*

| Page | Path |
|---|---|
| Home (who I am: the "about me" page) | `/` |
| Work | `/work/` |
| Writing | `/writing/` |
| Note | `/writing/what-is-an-ai-agent/` |
| Résumé | `/resume/` |
| Résumé PDF (generated from `/resume/`) | `/resume.pdf` |
| JSON Resume | `/resume.json` |
| Contact | `/contact/` |
| 404 | any unknown path |
| Old About URL (redirect stub, `noindex`) | `/about/` → `/` |
| Old article URL (redirect stub, `noindex`) | `/writing/building-modular-ai-agents/` → `/writing/what-is-an-ai-agent/` |

### Header

- **Home link (one link: the seal and the name together):** the seal, then **Qijin Xu**
  - **Visually hidden suffix inside the link:** , home *[So the accessible name is "Qijin Xu, home": it begins with the visible words.]*
  - *[The seal glyph 徐 is decorative (`aria-hidden="true"`), white on cinnabar. No other Chinese text anywhere. On `/` the link carries `aria-current="page"`.]*
- **Nav labels, in order:** Work · Résumé · Contact
  *[Writing stays out of the header until there are three pieces. It is reached from Home (1.5) and the footer's story map. When the third piece is published, add it between Work and Résumé.]*
- **Nav landmark label:** Main
- **Skip link:** Skip to content

### Footer

- **Story map (the whole painting as a thin map of the journey; each place is a link), in this order:** Home · Work · Writing · Résumé · Contact
  - **Landmark label (`aria-label` of its `<nav>`):** All pages
  - *[Links: `/`, `/work/`, `/writing/`, `/resume/`, `/contact/`. The order follows the painting (Home 0, Work 1, the road 2 unlabelled, Writing 3, Résumé 4, Contact 5), not the nav. The current page carries `aria-current="page"` (the Note marks Writing with `aria-current="true"`; the 404 marks none); its brush mark is the "you are here". No visible words name the map or the painting.]*
- **Line 1 (copyright):** © 2026 Qijin Xu · Toronto
- **Line 1, links after it:** Email · LinkedIn · GitHub · View résumé (PDF)
  *[Email → `mailto:qxjack@gmail.com`; LinkedIn → https://www.linkedin.com/in/qijin-x-4899671a9/; GitHub → https://github.com/Freedom-Jack; View résumé (PDF) → `/resume.pdf` in a new tab (see "Shared link and button text"). "Writing" is not repeated here: it is in the story map.]*
  *[WITHHELD since 2026-10-08: "Source code" → https://github.com/Freedom-Jack/my-website stays off until that public repo no longer holds the old résumé file (in files or history). Restore it after Jack confirms.]*
- **Line 2:** Updated October 2026 · Still the landscape
  *["Updated": in the real build, generate this from the last content change. A visible, honest "updated" date helps search engines and AI agents judge freshness.]*
  *["Still the landscape" is a toggle button (`aria-pressed`), not a link. Pressed: all ambient landscape motion stops for the rest of the session. The label never changes; the pressed state shows as its drawn brush mark. Hidden without JavaScript.]*

### Shared link and button text

- **PDF link label:** View résumé (PDF)
  - **Visually hidden suffix (appended inside the link):** , opens in a new tab
  - *[`href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf"`. It opens the browser's own PDF viewer. Never `download`. Never the old file. Every other link opens in the same tab, so no other hint is needed.]*
- **Closing link at the end of a page:** Next: {page} → *[e.g. "Next: Work →". "Next:" is its label (lighter); the arrow is `aria-hidden`. The landmark label of the closing `<nav>` is "Next page". Destinations: Home → Work · Work → Résumé · Writing → Résumé · Note → Writing · Résumé → Contact · Contact → Home · the 404 has none.]*
- **Closing landmark label:** Next page
- **Draft-art label (demo 4a only, Home's and Work's strips):** Draft art *[Small print in the strip's bottom feather, on paper. Removed when the scenes are finished (4b).]*
- **Copy-email button:** Copy email
- **Copy-email confirmation (live region):** Copied
- **Route announcement (visually hidden live region, after an in-site page change):** the new page's `<title>`, exactly. *[No extra words.]*
- **Diagram text-equivalent toggle:** Read as steps
- **Margin note toggle on narrow screens:** Note: {term} *[e.g. "Note: vLLM". The term comes from the note's own bold term.]*
- **Compact case toggle (shown by CSS beside the summary, `aria-hidden`):** Show details / Hide details *[On phones always; on wider screens, where the cases start open, "Show details" only while a case is closed. The `<summary>` itself is the control; screen readers announce it as expanded or collapsed.]*

### Demo switches (`?compare=1` only; never in the production build)

- **Panel label (`aria-label`):** Demo switches
- **Row 1 label:** Colour · **buttons:** Ink · Misted · Rich *[Misted is the default.]*
- **Row 2 label (Home only):** Name · **buttons:** 56 · 72 · 96 *[72 is the default.]*
- **Button:** Hide
- **Fold button** (folds the panel to this one button and back; folded by default on phones): Compare *[fixer, 10 Oct: the panel moved to the bottom right, clear of Home's photo and the résumé's timeline]*

---

## 1. Home `/`

*[Round 4a: Home is Jack's "about me" page: a greeting, not a résumé header. Order: 1.1 hero (the strip) · 1.2 About me (photo, words, signature) · 1.3 What I work on · 1.4 Now · 1.5 Writing · 1.6 Say hello · 1.7 closing. No text fades in on scroll. Retired from draft 2: the "Qijin (Jack) Xu" hero, the statement and the six-row ledger (both move to Work: 3.2 and 3.1), "How I build" (moves to Work, 3.2), the vista, "In brief" with the grey byline, "Latest writing" (now 1.5), and the consulting-style closing question.]*

### 1.1 Hero (inside the painted strip) — DRAFT (from Jack's answers, 9 Oct)

- **h1:** Qijin Xu
- **Lead (one paragraph):** Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. I design and ship production AI for banks and insurers: LLM agents, retrieval systems, and the data platforms underneath them.
- **Second line (its own paragraph):** Right now I’m leading an agent that reads and documents legacy code written in a proprietary language.
- **Primary button:** See the work → `/work/` *[the one `.ink-btn`; the arrow is drawn, `aria-hidden`]*
- **Secondary link:** Résumé → `/resume/`
- **Draft-art label:** Draft art *[section 0]*
- *[Nothing else in the hero: no "(Jack)", no role stack, no pronunciation line (Jack has not asked for one), no scroll cue.]*

### 1.2 About me (the photo beside Jack's words) — DRAFT (from Jack's answers, 9 Oct)

- **Photo file:** `/assets/img/qijin-xu-colour.jpg` *[720 × 900, made from `public/images/selfie.jpg` by `tools/build-photo.swift` (SPEC-R4A §9.2): full colour, light grade, the wall made into paper, the shoulders fading into it. No metadata. A reshoot replaces this one file.]*
- **Photo alt text:** Qijin Xu in glasses and a red sweater, head and shoulders
- *[No caption under the photo.]*
- **h2:** About me
- **Paragraphs, in order:**

  I’ve spent the last five years putting AI into production at CGI: LLM agents, RAG platforms, and the data systems they stand on. Along the way the work earned two CGI Impact Awards, but the part I enjoy most is still the architecture: how the pieces fit, where the system can break, and how you know it works.

  I’m optimistic about AI because it isn’t floating on hype. It sits on real foundations, from cloud platforms and chipmakers to industries like manufacturing and finance that are already seeing the gains.

  I also build for myself. If a tool can make my own work easier, I usually end up building it.

  Away from the keyboard, I play basketball, play games, and read wuxia and xianxia novels.

- **Signature (last line, right-aligned, with the small seal after it):** — Jack
  *[The em dash and a space, then "Jack". The small 徐 seal beside it is decorative (`aria-hidden`), static, never stamped. Screen readers read "— Jack".]*
- *["five years" counts full-time work from Aug 2021; in the real build, compute it. "two CGI Impact Awards" is Jack's own claim (2024 and 2026, section 9); it appears in this prose only, never as a figure.]*

### 1.3 What I work on — DRAFT (from existing facts)

- **h2:** What I work on
- *[Three rows. Each row: a title that links to the case on Work, and one line of proof. Figures inside the lines are bold at text size (shown here in `**`). Every figure is in the claims ledger (section 9).]*

| Title (link) | Line |
|---|---|
| Assistants that answer from your own knowledge → `/work/#rag-assistant` | About **90%** of questions resolved without a person, for **50,000+** users of an insurance support assistant. |
| Agents for code nobody documented → `/work/#proprietary-language-agent` | An agent that documents legacy code in a proprietary language and pulls out its business rules: a projected **50%** less manual work. |
| Data platforms AI can stand on → `/work/#insurance-data-platform` | **99.9%** uptime on Canada’s largest auto-insurance policy-history database, 2 TB on SQL Server. |

- **Link after the rows:** All six projects → `/work/`

### 1.4 Now — DRAFT (from Jack's answers, 9–10 Oct)

- **h2:** Now
- **Date (small print inside the heading, after the word):** · October 2026 *[`<time datetime="2026-10">October 2026</time>`. Update the date whenever the lines change.]*
- **Lines, in order (the label is bold):**
  - **Building:** an agent memory system, and Logic Foundry, an agent that turns logic buried in old materials into reusable artifacts: docs for people, rubrics for AI agents, even model weights.
  - **Exploring:** an AI-powered stock app.
  - **Off-hours:** basketball, games, and a long xianxia novel.
- *[No links: these projects have no public repositories with content yet. If this block is ever removed, it disappears with no placeholder.]*

### 1.5 Writing

- **h2:** Writing
- **Kind and date:** Note · April 20, 2025 *[`Note · <time datetime="2025-04-20">April 20, 2025</time>`]*
- **Title (link):** What is an AI agent? → `/writing/what-is-an-ai-agent/`
- **Description:** What an AI agent is, and how it differs from an AI assistant.
- **Link:** All writing → `/writing/`

### 1.6 Say hello — DRAFT (from Jack's decision on who should write)

- **h2:** Say hello
- **Line:** For collaborations on production AI, or an invitation to speak or write about agents and retrieval, email me at qxjack@gmail.com. I’m also on LinkedIn and GitHub.
  *["qxjack@gmail.com" is a `mailto:` link; "LinkedIn" → https://www.linkedin.com/in/qijin-x-4899671a9/; "GitHub" → https://github.com/Freedom-Jack.]*

### 1.7 Closing

- **Link:** Next: Work → `/work/` *[The closing scene: the road running down from his mountain toward the river town.]*

---

## 2. `/about/`: redirect stub (`noindex`)

*[Jack, 9 Oct 2026: Home is his "about me" page. Demo: a minimal standalone page that redirects at once (meta refresh and `location.replace('/')`), with `canonical` pointing to `/`, no shared blocks, paper and ink only. Real build: a 301 from `/about/` to `/` (8.9). No internal link points here.]*

- **`<title>`:** Qijin (Jack) Xu · About
- **Visible line (for the moment before the redirect, or with JS and refresh both off):** This page has moved. About me is now on the home page. *["the home page" is the link, `/`.]*

---

## 3. Work `/work/`

### Header (inside the painted strip)

- **h1:** Work
- **Intro:** Most of what I build runs inside client systems, so the code is private. Here is what each project was, what I did, and what changed. Where a public page exists, it’s linked.
- **Draft-art label:** Draft art *[section 0]*

*[Round 4a page order (SPEC-R4A §10.2): strip · 3.1 Six projects (the table, on the first screen) · 3.2 How I build · Case 1 and Case 2 (flagships) · 3.3 More work (Cases 3–6, compact) · 3.4 In the open · (3.5 Side projects: OMITTED) · 3.6 closing. Every case keeps its anchor, so every link from Home still lands.]*

*[Every case uses the same labels, in this order: Context · What I did · (The hard part: flagships only, OMITTED until Jack writes it) · Outcome · Evidence · Stack. Stack is a plain comma-separated line, not tags. Each case opens with its figure and the figure's note, then its summary.]*

### 3.1 Six projects, newest first (the index)

- **h2:** Six projects, newest first *[The table is labelled by this heading (`aria-labelledby`); no separate caption.]*
- **Column headers:** Years · Project · Outcome · Evidence *[Round 4a: the Kind column is dropped, so all six rows fit the first screen.]*
- *[The Project cell is the row header (`th scope="row"`) and links to the case anchor. Evidence links open in the same tab.]*

| Years | Project (→ anchor) | Outcome | Evidence |
|---|---|---|---|
| 2025 – present | Agent for a proprietary programming language → `#proprietary-language-agent` | Projected 50% less manual work. In progress. | Client work, no public page |
| 2023 – 2024 | Enterprise RAG assistant for insurance support → `#rag-assistant` | ~90% of questions resolved without a person; 50,000+ users; 525% ROI in 12 months | CGI product page · CGI article *[links: the two Case 1 evidence URLs]* |
| 2023 – 2024 | Lineage and rule automation with LLMs → `#data-operations` | 80% less manual work on AxiomSL rule updates | Client work, no public page |
| 2021 – 2023 | Fraud loss-ratio model → `#fraud-model` | 321% lift in recovered fraud losses versus a top-five bank benchmark | Client work, no public page |
| 2021 – 2023 | Insurance policy-history data platform → `#insurance-data-platform` | 99.9% uptime; median queries under 200 ms | Client work, no public page |
| 2020 – 2021 | Computer vision for hockey broadcast video → `#hockey-vision` | mAP ≥ 70% on event detection | Vector Institute article *[link: the Case 6 evidence URL]* |

### 3.2 How I build (moved from Home)

- **h2:** How I build
- **Statement (the lead):** A model is only as good as the system around it.
  *[Plain ink full stop: no cinnabar anywhere but the seal.]*
- **Line:** For five years I’ve built those systems: the data underneath, the retrieval in the middle, and the agents and guardrails on top.
  *["five years" counts full-time work from Aug 2021. In the real build, compute it from that date.]*
- *[One brush-style system diagram. Generic: no client, product or data names beyond the public tools listed here. Labels are real SVG text. The wide version reads left to right in three horizontal bands; the tall version stacks the same nodes top to bottom and is never taller than a phone screen.]*
- **SVG `<title>`:** How I build
- **SVG `<desc>`:** Three layers. At the bottom, data flows from many sources through pipelines into an index. In the middle, retrieval pulls context from that index. On top, an agent workflow takes a request, calls models with that context, passes guardrails and returns the answer.
- **Band labels (top band first):**
  - The agents and guardrails on top
  - The retrieval in the middle
  - The data underneath
- **Node labels (label, then its small sub-label where given):**
  - Top band: Request · Agent workflow (sub: LangGraph) · Models (sub: vLLM) · Guardrails (sub: PII filtering, EBNF) · Answer
  - Middle band: Retrieve · Context
  - Bottom band: Sources · ETL/ELT pipelines · Lineage (sub: OpenLineage) · Index (sub: FAISS, Pinecone)
  - *[Edges, in draw order: Sources → ETL/ELT pipelines → Index; ETL/ELT pipelines → Lineage; Request → Agent workflow; Agent workflow → Retrieve; Retrieve → Index; Index → Context; Context → Models; Agent workflow → Models; Models → Guardrails; Guardrails → Answer.]*
- **Figure caption:** The generic shape of the systems I build: data underneath, retrieval in the middle, agents and guardrails on top. No client detail.
- **Toggle:** Read as steps
- **Steps (ordered list):**
  1. Sources feed ETL/ELT pipelines.
  2. Lineage records where each piece of data came from and how it moved (OpenLineage).
  3. The prepared data is indexed for search (FAISS or Pinecone).
  4. A request reaches the agent workflow (LangGraph), which decides the next step.
  5. Retrieval finds the relevant context in the index.
  6. The workflow calls vLLM-served models with that context.
  7. Guardrails: PII filtering keeps personal information out, and EBNF grammars keep every output well-formed.
  8. The answer, document or extracted rule goes back to whoever asked.

### Case 1 `#rag-assistant` (flagship)

- **h2:** Enterprise RAG assistant for insurance support
- **Meta line:** CGI · 2023 – 2024 · Architect
- **Figure:** About 90%
- **Figure note:** of questions resolved without a person
- **Summary:** An LLM-powered assistant that answers routine insurance questions on its own.
- **Diagram (generic shape, no client detail):**
  - **SVG `<title>`:** How the RAG assistant works
  - **SVG `<desc>`:** A customer’s question goes to retrieval, which finds passages in the insurer’s own knowledge base. An LLM, orchestrated with LangChain, answers from those passages, and the answer goes back to the customer.
  - **Node labels:** Customer question (sub: several languages) · Retrieval (sub: RAG) · Insurer’s knowledge base · LLM (sub: LangChain) · Answer (sub: around the clock)
  - **Band label under the nodes:** Runs across Azure, AWS and GCP
  - *[Edges, in draw order: Customer question → Retrieval; Retrieval → Insurer’s knowledge base; Insurer’s knowledge base → Retrieval (the passages come back; draw as a return stroke); Retrieval → LLM; LLM → Answer.]*
  - **Figure caption:** The generic shape of the assistant, simplified. No client detail.
  - **Toggle:** Read as steps
  - **Steps:**
    1. A customer asks a routine question about a policy or a claim, in one of several languages.
    2. Retrieval finds the relevant passages in the insurer’s own knowledge base.
    3. An LLM, orchestrated with LangChain, answers from those passages.
    4. The answer goes back to the customer, around the clock. About 90% of questions are resolved without a person.
    5. The system runs across Azure, AWS and GCP.
- **Context:** Insurance support teams spend much of their day on routine questions about policies and claims. The goal was an assistant that answers them from the insurer’s own knowledge base, in several languages, around the clock.
- **What I did:** I architected and shipped the system: retrieval-augmented generation over insurance knowledge bases, built with LangChain across Azure, AWS and GCP.
- **The hard part:** OMITTED (needs Jack's words: the hardest decision, what didn't work, how he knew it worked; kept generic). *[Build nothing: no label, no placeholder.]*
- **Outcome:** About 90% of questions resolved without a person, across a user base of 50,000+. 525% return on investment within 12 months. CGI Impact Award 2024.
- **Evidence:**
  - CGI product page: Multi-language AI-driven chatbot for insurance → https://www.cgi.com/canada/en-ca/insurance-chatbot
  - CGI article: AI chatbots for insurance are transforming customer service → https://www.cgi.com/canada/en-ca/article/insurance/ai-chatbots-insurance-are-transforming-customer-service
  - **Evidence note:** Both pages describe the product. They don’t name contributors or publish these figures.
- **Stack:** Python, LangChain, LLMs, RAG, Azure, AWS, GCP
- **Glossary notes (margin on wide screens, "Note: {term}" toggles below; definitions of public tools, no claims about Jack):**
  - **RAG:** Retrieval-augmented generation. The model answers from passages retrieved from a knowledge base, not from its training alone.
  - **LangChain:** An open-source framework for building applications on language models.

### Case 2 `#proprietary-language-agent` (flagship)

- **h2:** Agent for a proprietary programming language
- **Meta line:** CGI AI Center of Excellence · 2025 – present · Lead
- **Figure:** Projected 50% *["Projected" is part of the figure, set as its lead in the same face and ink; never small print, never dropped.]*
- **Figure note:** less manual work for the support team
- **Summary:** An agent that reads legacy code in a proprietary language, documents it, and extracts the business rules inside.
- **Diagram (generic shape, no client detail):**
  - **SVG `<title>`:** How the agent works
  - **SVG `<desc>`:** Legacy scripts in a proprietary language go into a LangGraph workflow, which coordinates vLLM-served models with retrieval. Guardrails keep personal information out and keep every output well-formed. Out come documentation, business rules and code prepared for migration.
  - **Node labels:** Legacy scripts (sub: proprietary language) · LangGraph workflow (sub: dual-state, dynamic) · Retrieval · Models (sub: vLLM) · Documentation · Business rules · Migration readiness
  - **Guardrail band label (spans the workflow and the models):** Guardrails: PII filtering · EBNF grammar
  - *[Edges, in draw order: Legacy scripts → LangGraph workflow; LangGraph workflow → Retrieval; Retrieval → LangGraph workflow (return stroke); LangGraph workflow → Models; Models → LangGraph workflow (return stroke); LangGraph workflow → Documentation; → Business rules; → Migration readiness. The guardrail band is a pale wash behind the workflow and the models, not a step in the sequence.]*
  - **Figure caption:** The generic shape of the agent, simplified. No client detail.
  - **Toggle:** Read as steps
  - **Steps:**
    1. Legacy scripts written in the proprietary language come in.
    2. A LangGraph dual-state, dynamic workflow coordinates the work.
    3. It coordinates vLLM-served models with retrieval.
    4. PII filtering keeps personal information out.
    5. EBNF grammars constrain every output, so it is always well-formed.
    6. Out come documentation, extracted business rules and code prepared for migration.
- **Context:** A client’s business rules live in legacy scripts written in a proprietary programming language. The scripts need maintaining and documenting now, and migrating later. Because the language is proprietary, general-purpose models can’t be trusted with it out of the box.
- **What I did:** I lead the agent’s design and delivery. A LangGraph dual-state, dynamic workflow coordinates vLLM-served models with retrieval. EBNF grammars constrain outputs so they are always well-formed, and PII filtering keeps personal information out. The agent writes documentation, extracts business rules and supports migration readiness.
- **The hard part:** OMITTED (needs Jack's words). *[Build nothing.]*
- **Outcome:** Projected 50% reduction in manual work for the support team. In progress.
- **Evidence:** Client work, no public page.
- **Stack:** Python, LangGraph, vLLM, RAG, EBNF structured outputs, PII filtering
- **Glossary notes (margin; definitions of public tools, no claims about Jack):**
  - **LangGraph:** An open-source library for building agents as graphs of steps that share state.
  - **vLLM:** An open-source engine for serving large language models.
  - **EBNF:** Extended Backus–Naur form, a notation for grammars. A model constrained by a grammar can only produce output the grammar allows.
  - **PII:** Personally identifiable information: data that identifies a person, such as a name or an email address.

### 3.3 More work (Cases 3–6, compact)

- **h2:** More work
- *[Four compact cases: their titles are h3. The summary row (always visible) holds the title, the figure with its note, and the meta line; the one-line **Summary** opens the details (first inside them), then the labelled details follow (Context · What I did · Outcome · Evidence · Stack). The details open on tap at every width (fixer, 10 Oct: the page was far over its length budget); with JS off, and in print, everything is open. No diagrams, no glossary notes. Anchors unchanged.]*

#### Case 3 `#fraud-model`

- **h3:** Fraud loss-ratio model
- **Figure:** 321%
- **Figure note:** lift in recovered fraud losses
- **Meta line:** CGI · 2021 – 2023 · Data engineer
- **Summary:** A loss-ratio model that recovers more fraud losses than a top-five bank’s benchmark.
- **Context:** Unrecovered fraud shows up directly in the loss ratio. The benchmark to beat was a model from a top-five bank.
- **What I did:** I built and shipped a gradient-boosting plus logistic-regression model, with batch scoring in a Python and T-SQL pipeline.
- **Outcome:** 321% lift in recovered fraud losses versus the top-five bank benchmark.
- **Evidence:** Client work, no public page.
- **Stack:** Python, T-SQL, SQL Server, gradient boosting, logistic regression

#### Case 4 `#data-operations`

- **h3:** Lineage and rule automation with LLMs
- **Figure:** 80%
- **Figure note:** less manual work on AxiomSL rule updates
- **Meta line:** CGI · 2023 – 2024 · Data architect
- **Summary:** Two tools that put language models to work on data operations: tracing incidents and updating rules.
- **Context:** When a report breaks, someone has to trace the data back through several systems by hand. At RBC, AxiomSL rules were also updated by hand.
- **What I did:** I built an OpenLineage-based lineage tool that documents multi-source data flows automatically and uses an LLM to suggest likely root causes. I also automated AxiomSL rule updates at RBC with an LLM, keeping governance controls in place.
- **Outcome:** 80% less manual work on AxiomSL rule updates. Shorter investigations across about three incidents a month.
- **Evidence:** Client work, no public page.
- **Stack:** Python, OpenLineage, LLMs, AxiomSL

#### Case 5 `#insurance-data-platform`

- **h3:** Insurance policy-history data platform
- **Figure:** 99.9%
- **Figure note:** uptime
- **Meta line:** CGI · 2021 – 2023 · Data engineer
- **Summary:** Kept Canada’s largest auto-insurance policy-history database fast and available, and built the data marts on top.
- **Context:** A 2 TB SQL Server database of automobile-insurance policy history, with finance, analytics and delivery teams depending on reports built from it each month.
- **What I did:** I managed the database and built production ETL/ELT pipelines for 22+ micro data marts, each under six tables and on a monthly SLA.
- **Outcome:** 99.9% uptime. Median queries under 200 ms. Report runtime cut from 30 minutes to 5.
- **Evidence:** Client work, no public page.
- **Stack:** SQL Server, T-SQL, PostgreSQL, Python, ETL/ELT

#### Case 6 `#hockey-vision`

- **h3:** Computer vision for hockey broadcast video
- **Figure:** mAP ≥ 70% *["mAP ≥" is the figure's lead (smaller, same face). Never "30 fps".]*
- **Figure note:** on event detection, across 18 hours of game video
- **Meta line:** Elder Laboratory, York University · 2020 – 2021 · Research assistant
- **Summary:** Models that watch a hockey broadcast and work out what is happening.
- **Context:** AttentiveVision, a startup co-founded by York professor James Elder, set out to give amateur hockey a broadcast-style viewing experience by following the play automatically.
- **What I did:** I trained a CNN-LSTM stack for event detection on broadcast video, built real-time player tracking with a Kalman filter and OpenPose, and ran an active-learning annotation loop for goals, timeouts and penalties.
- **Outcome:** mAP ≥ 70% on event detection across 18 hours of game video. Tracking under 100 ms at 30 FPS. Labels reached Cohen’s kappa ≥ 0.92.
- **Evidence:**
  - Vector Institute: Amateur hockey given professional viewing experience courtesy of machine vision startup co-founded by Vector researcher (March 7, 2022) → https://vectorinstitute.ai/amateur-hockey-given-professional-viewing-experience-courtesy-of-machine-vision-startup-co-founded-by-vector-researcher/
  - **Evidence note:** The article describes the project. It doesn’t name individual contributors.
- **Stack:** Python, PyTorch, TensorFlow, OpenCV, OpenPose, CNN-LSTM, Kalman filter

### 3.4 In the open `#open` (auto-discovered at build time)

*[Jack, 10 Oct 2026: "it should be able to look at my GitHub page and discover and update automatically… don't slow down the website just for live updating repos." So `tools/sync-projects.py --discover` reads the public GitHub API at BUILD time and writes static HTML between the `@data:projects` markers (SPEC-R4A §13.6). Zero client JavaScript; the visitor's browser never calls GitHub. No star counts, contribution heatmaps, widgets or language dots. `data/projects.json` holds optional overrides only (Jack's own lines, years, order, hides). Checked 9 Oct 2026: 8 public repos, 0 forks.]*

- **h2:** In the open
- **Intro:** Most of my code belongs to clients. These are the public pieces.
- **Featured (h3):** Featured *[Rendered only when a repo has the GitHub topic `featured` (or an override `"group": "featured"`). None today: then nothing renders, no heading, no empty row.]*
- **Recent (h3):** Recent *[Repos pushed in the last 24 months that pass the rules. None today: then nothing renders. Each row: the repo name (link), its line (the override `line`, else its GitHub description, ending with a full stop), then small print "Updated {Month YYYY}" from its last push, and "Live demo" if an override gives one.]*
  - **Row meta:** Updated {Month YYYY}
  - **Demo link (optional):** Live demo
- **Early work (h3):** Early work, 2019–2020 *[The years come from the rows. If the newest year is after 2020 the heading becomes "Earlier work, {first}–{last}".]*
- **Table caption (visually hidden):** Early public repositories
- **Column headers:** Year · Repository · What it is
- **Rows today, in this order (override lines and years; the repo name is the link):**

| Year | Repository (link) | What it is |
|---|---|---|
| 2020 | world_qlearning → https://github.com/Freedom-Jack/world_qlearning | A Q-learning agent that learns to cross an M×N grid world, with notes on how the discount and learning rates change convergence. |
| 2019 | aStar-pathFinding → https://github.com/Freedom-Jack/aStar-pathFinding | Solves the 8-puzzle in Prolog with A*, cycle-checking A* and IDA*, using misplaced-tile and Manhattan-distance heuristics. Course project. |
| 2019 | cryptology → https://github.com/Freedom-Jack/cryptology | Java code and notes on cryptography, from Caesar and Vigenère ciphers to RSA, Miller–Rabin primality testing, digital signatures and HMAC. |
| 2019 | reddit-tfidf → https://github.com/Freedom-Jack/reddit-tfidf | Finds the most significant terms in Reddit comments with TF-IDF, using MapReduce and Spark over the Pushshift and Reddit APIs. Team project. |

- **Link:** All repositories on GitHub → https://github.com/Freedom-Jack
- *[Never listed: `job-application` (personal application materials). Withheld: this site's own repo, until its public history no longer holds the old résumé file. Skipped as placeholders until real code lands: repos under 10 KB, or described as "TBA", "To be announced/anounced" or "coming soon" (today: the agent-memory scaffold and the stock-app design doc). The deny-list lives in the tool; the public data file never names an excluded repo.]*

### 3.5 Side projects

- OMITTED (needs Jack's words: which games his tools are for, what they do, a screenshot or repo). *[Build nothing.]*

### 3.6 Closing

- **Link:** Next: Résumé → `/resume/` *[The closing scene: the town's far end and the road on toward the fields.]*

---

## 4. Writing `/writing/`

*[Writing stays out of the header nav until there are three pieces; it is reached from Home (1.5) and the footer's story map. The one existing article is published as an honestly dated Note.]*

### 4.1 Index

- **h1 (in the strip's mist on wide screens):** Writing
- **Intro:** Notes on building AI systems that work outside the demo. I write when I’ve learned something worth passing on. *[Still for Jack to confirm (10.13).]*
- **Entry kind and date:** Note · April 20, 2025 *[`Note · <time datetime="2025-04-20">April 20, 2025</time>`]*
- **Entry title (link):** What is an AI agent? → `/writing/what-is-an-ai-agent/`
- **Entry description:** What an AI agent is, and how it differs from an AI assistant.
- **Closing link:** Next: Résumé → `/resume/`
- *[No filters, no pagination, no empty states. New pieces go on top, each with its kind (Note or Essay), date, title and description.]*

### Placeholder posts: dropped

- `welcome-to-my-first-blog` ("Welcome to My Blog") and `welcome-to-my-second-blog` (author "Your Name") are template filler. They are not published; both old URLs 301 to `/writing/` (8.9).

### 4.2 Note page `/writing/what-is-an-ai-agent/`

*[Why these choices:
- **Date:** 2025-04-20 is the first git commit of the MDX file. The old front-matter date (2024-04-15) can't be verified, so it is not used anywhere.
- **Title:** Jack's own question from the first paragraph, word for word. The old title promised a build the piece doesn't contain.
- **Body:** only the finished sections. Every empty heading is dropped. No contents list (three headings).
- **Typos (Jack, 10 Oct 2026: fix them all):** grammar and spelling only. Jack's voice, meaning, structure and claims are unchanged; the Google Cloud quotation is never edited. Every change is listed under "Typo fixes" below.]*

- **h1:** What is an AI agent?
- **Byline:** Qijin Xu · Note · April 20, 2025 · Typos fixed October 10, 2026
  *["Qijin Xu" links to `/`. Two `<time>` elements: `datetime="2025-04-20"` and `datetime="2026-10-10"`. The second date matches the BlogPosting's `dateModified` (8.5).]*
- **Body (paste exactly; headings and words as below, curly quotes as typeset):**

  > **h2:** Concepts and definitions
  >
  > **h3:** What is an AI agent
  >
  > Let’s start with something “textbook”: **What is an AI agent?**
  >
  > According to a [Google Cloud blog post](https://cloud.google.com/discover/what-are-ai-agents),
  >
  > *(blockquote, cite = that URL)* AI agents are software systems that use AI to pursue goals and complete tasks on behalf of users. They show reasoning, planning, and memory and have a level of autonomy to make decisions, learn, and adapt.
  >
  > So AI agents are something that should be capable of finishing certain tasks in a domain, kind of like a less general AGI (artificial general intelligence), but one step forward from the traditional reactive AI.
  >
  > The key of an AI agent revolves around the following components:
  >
  > **Core components of an AI agent**:
  > - **Perceive:** Gathers input (text, images, sounds, etc.) and outputs from intermediate steps.
  > - **Reason:** Makes decisions using logic, rules, or machine learning (often an LLM these days).
  > - **Action:** Performs actions (like creating files/folders, or even interacting with the software).
  >
  > **h3:** Difference between an AI agent and an AI assistant
  >
  > An AI agent is one step further than an AI assistant. Most of the publicly available AI tools on the market nowadays usually fall into the category of AI assistants. As you can tell from the core components, the key difference lies in the **“action”** step:
  > - An **AI agent** is capable of completing tasks on your behalf, often by interacting with external tools or systems.
  > - An **AI assistant**, on the other hand, typically offers suggestions, guidance, or information — but you are the one who takes action.
  >
  > *(table, labelled by the h3 above)*
  >
  > | Aspect | AI Agent | AI Assistant |
  > |---|---|---|
  > | Definition | A system that perceives, reasons, and **acts** autonomously to achieve goals. | A user-facing tool that helps with tasks, typically via conversation. |
  > | Autonomy | Often operates independently and can make decisions on its own. | Usually reactive — waits for input and responds accordingly. |
  > | Examples | Auto-GPT, GitHub Copilot, Cursor. | ChatGPT, Siri, Alexa. |
  > | Goal | Completes multi-step tasks or goals, possibly without human input. | Assists a user with specific queries or tasks, often answering one by one. |
  > | Tools/Actions | Can access external tools, call APIs, plan steps, and act without prompts. | Uncommon today, but may use tools, like ChatGPT GPTs. |

- **Typo fixes (10 Oct 2026; every change, nothing else):**
  1. h3 "What is AI agent" → "What is an AI agent"
  2. "So AI agents is something" → "So AI agents are something"
  3. "should be capable to finish certain tasks" → "should be capable of finishing certain tasks"
  4. "(Artificial general intelligence)" → "(artificial general intelligence)"
  5. "The key of an AI agent revolve around" → "The key of an AI agent revolves around"
  6. "Core components of an AI Agent" → "Core components of an AI agent"
  7. "or even interact with the software" → "or even interacting with the software"
  8. h3 "Difference between AI agent vs AI assistant" → "Difference between an AI agent and an AI assistant"
  9. "AI agent is one step forward than AI assistant, most of the publicly available AI tools on the market nowadays usually falls into the category of AI assistant." → "An AI agent is one step further than an AI assistant. Most of the publicly available AI tools on the market nowadays usually fall into the category of AI assistants."
  10. Table: "often answer one by one" → "often answering one by one"
  11. Table: "Uncommon today but may use tools, like ChaGPT GPTs." → "Uncommon today, but may use tools, like ChatGPT GPTs."
- **Dropped (empty headings in the MDX, not published):** Breakdown of AI agent components (Perceive, Reason, Memory, Human in the loop, Action) · Design and Build (Modularity, Abstract Base Classes, Standardize the Output Format with dataclasses) · Implementation (Architecture) · Performance booster for AI agent (Optimization, Context, Top_K) · the horizontal rule.
- **End-of-note author line (beside the author's seal):** Qijin Xu is a Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. He designs and ships production AI: LLM agents, RAG systems and data platforms.
- **Button:** More about Qijin → `/`
- **Closing link:** Next: Writing → `/writing/` *[Replaces round 3's separate "All writing" link.]*

### 4.3 Redirect stub `/writing/building-modular-ai-agents/` (`noindex`)

*[The draft-1 URL of the article. Demo: a minimal page that redirects at once (meta refresh and `location.replace`), with `canonical` pointing to the Note. Real build: a 301 (8.9).]*

- **`<title>`:** Qijin (Jack) Xu · What is an AI agent?
- **Visible line (for the moment before the redirect, or with JS and refresh both off):** This note has moved: What is an AI agent? *[the title is the link]*

---

## 5. Résumé `/resume/`

*[Structured and printable. Plain HTML that prints cleanly on A4 and Letter paper in two pages; `@media print` hides the strip, closing, header, footer, story map, actions and demo switches. No phone number (decided 9 Oct 2026), no address. This page's print stylesheet IS the source of `/resume.pdf` (built by `tools/build-pdf.py`), so the page and the PDF can never disagree. The strip above it is art only: no words in it.]*

### Header

- **h1:** Qijin Xu
- **Title:** Lead AI/ML Architect
- **Contact line:** Goes by Jack · Toronto, ON, Canada · qxjack@gmail.com · github.com/Freedom-Jack · linkedin.com/in/qijin-x-4899671a9 · my-website-freedomjack.vercel.app
  *[Links: the email (`mailto:`), https://github.com/Freedom-Jack, https://www.linkedin.com/in/qijin-x-4899671a9/, and the site's home. Swap the domain if a custom one is chosen.]*
  *[DECIDED: no phone number anywhere, in the page or the PDF. One HTML comment in the contact list records the decision; it must not contain digits.]*

### Actions (screen only, hidden in print)

- **Button:** View résumé (PDF) → `/resume.pdf` *[the page's one `.ink-btn`, no arrow; new tab, `rel="noopener"`, hidden suffix ", opens in a new tab"]*
- **Link:** JSON Resume → `/resume.json`
- **Note:** This page is the current résumé. The PDF is made from this page, and a machine-readable copy is available as JSON Resume.

### Summary

- **h2:** Summary

Lead AI/ML Architect with 5+ years building production AI and the data systems beneath it. Architected an LLM-powered RAG assistant that resolved about 90% of questions on its own for 50,000+ users and returned 525% ROI within 12 months (CGI Impact Award 2024). Now leading a LangGraph agent for a proprietary programming language, projected to cut manual work by 50%. Earlier, built a fraud loss-ratio model with a 321% lift over a top-five bank benchmark.

### Experience

- **h2:** Experience
- *[The vertical brush timeline (moved from the old About page), drawn still: newest first. Each entry: its start year at the left rail (a visual index only, `aria-hidden`; the full dates are in the text), then the role (h3), then organisation · place · dates in small print, then the bullets. The rail years are: 2025, 2023, 2021, 2020, 2019.]*

#### Lead AI/ML Architect, AI Center of Excellence
- **Organisation · place · dates:** CGI Inc. · Toronto, ON · Jan 2025 – Present
- Lead an AI agent for a proprietary programming language: LangGraph dual-state dynamic workflow, vLLM-served LLMs with RAG, EBNF structured outputs and PII filtering. It writes documentation, extracts business rules, maintains legacy scripts and prepares for migration. Projected 50% labour reduction.

#### Data Architect & Engineering Lead, Senior Consultant
- **Organisation · place · dates:** CGI Inc. · Toronto, ON · Aug 2023 – Dec 2024
- CGI Impact Award 2024: architected and shipped an LLM-powered enterprise RAG chatbot (LangChain; Azure, AWS, GCP). About 90% autonomous resolution for a 50,000+ user base; 525% ROI within 12 months. Product page: cgi.com/canada/en-ca/insurance-chatbot
  *[The product-page text links to https://www.cgi.com/canada/en-ca/insurance-chatbot.]*
- Built an OpenLineage-based lineage tool that auto-documents multi-source data flows, with LLM-assisted root-cause suggestions. Reduced investigation time across about 3 incidents per month.
- Automated AxiomSL rule updates at RBC with an LLM: 80% less manual updating, governance controls preserved.

#### Data Engineer, Consultant
- **Organisation · place · dates:** CGI Inc. · Toronto, ON · Aug 2021 – Jul 2023
- Managed Canada’s largest automobile-insurance policy-history database (2 TB, SQL Server): 99.9% uptime, median queries under 200 ms.
- Built production ETL/ELT pipelines for 22+ micro data marts (under 6 tables each, monthly SLAs) for finance, analytics and delivery teams. Report runtime cut from 30 to 5 minutes.
- Shipped a gradient-boosting and logistic-regression loss-ratio model, batch-scored in a Python/T-SQL pipeline: 321% lift in recovered fraud losses versus a top-five bank benchmark.

#### Research Assistant, Computer Vision (part-time)
- **Organisation · place · dates:** Elder Laboratory, York University · Toronto, ON · May 2020 – Aug 2021
- Worked on AttentiveVision’s computer-vision pipeline for hockey broadcast video (PyTorch, TensorFlow, OpenCV). Trained a CNN-LSTM stack reaching mAP ≥ 70% on event detection across 18 hours of game video.
- Built real-time player tracking with a Kalman filter and OpenPose: under 100 ms latency at 30 FPS, for live speed and heat-map analytics.
- Built an event-detection annotation loop (goals, timeouts, penalties) with active learning, raising label reliability to Cohen’s kappa ≥ 0.92.

#### Full-Stack Developer Intern
- **Organisation · dates:** Nascent Digital · May 2019 – Aug 2019
- Built features in React, TypeScript and Node.js, including major parts of the company homepage rewrite.
- Shipped TELUS product pages with UX, QA and DevOps, design to deploy in 7 days.
- Introduced visual-regression testing (Nightwatch.js, Puppeteer), removing about 90% of manual QA checks.

### Skills

- **h2:** Skills
- **Languages:** Python, Java, Go, SQL (T-SQL, PostgreSQL), TypeScript/JavaScript, C++
- **AI/ML:** PyTorch, JAX, LangGraph, RAG, agent workflows, Model Context Protocol (MCP), LLMs, vLLM, OpenAI API, FAISS, Pinecone
- **Data and streaming:** Apache Spark, Kafka, Airflow, OpenLineage, Redis
- **Cloud and systems:** Azure, GCP, AWS, Docker, Kubernetes, Terraform, microservices, gRPC, CI/CD

### Education

- **h2:** Education
- **Entry:** **York University**, Toronto, ON. B.Sc. Computer Science, Specialized Honours, 2017 – 2021.
- **Detail:** GPA 3.9/4.0 · Dean’s List
  *[Jack, 10 Oct 2026: graduated 2021. The honour's wording is still pending (10.1): add nothing beyond these two items.]*

### Certifications and awards

- **h2:** Certifications and awards
- Microsoft Certified: Azure Solutions Architect Expert (2022)
- Google Cloud Professional Cloud Developer (2023)
- CGI Impact Award (2024), for the enterprise RAG assistant
- CGI Impact Award (2026)
  *[Per Jack and his LinkedIn (10 Oct 2026). Never attribute the 2026 award to a project.]*

### Print footer (print only)

Qijin Xu · qxjack@gmail.com · my-website-freedomjack.vercel.app/resume/

### Closing (screen only)

- **Link:** Next: Contact → `/contact/` *[The closing scene: the shore stepping down toward the crossing.]*

---

## 6. Contact `/contact/`

- **h1 (in the strip's mist on wide screens):** Contact
- **Intro:** I’m always glad to hear about collaborations on production AI, and invitations to speak or write about agents, retrieval and AI architecture.
- **Email label (small print):** Email
- **Email (the focal point, `mailto:` link):** qxjack@gmail.com
- **Button beside it:** Copy email *(confirmation: Copied)*
- **List, in order (label · link text → URL):**
  - GitHub · Freedom-Jack → https://github.com/Freedom-Jack
  - LinkedIn · Qijin Xu → https://www.linkedin.com/in/qijin-x-4899671a9/
  - Résumé · View résumé (PDF) → `/resume.pdf` *[new tab, hidden suffix ", opens in a new tab"]*
- **Location line:** Based in Toronto, Canada (Eastern Time).
- **For organisers:** OMITTED (needs Jack's OK and two short bios). *[Build nothing.]*
- **Closing link:** Next: Home → `/` *[The crossing: the ferry carries you back across to his mountain on the far shore.]*
- *[No form. No "hire me" language.]*

---

## 7. 404

- **h1 (in the strip's mist on wide screens):** Page not found
- **Line:** This path fades into the mist. *[Plain ink full stop.]*
- **Primary button:** Back to home → `/`
- **Secondary link:** See the work → `/work/`
- *[`<meta name="robots" content="noindex">`. No closing scene: the path ends in mist. The footer's story map gives the way back onto every page; nothing is marked current.]*

---

## 8. SEO and AI-agent layer

*Everything below is visible on the site or describes visible content. No hidden text, no keyword stuffing, no instructions aimed at AI agents.*

### 8.1 Titles and meta descriptions

*[Titles lead with the exact search phrase "Qijin (Jack) Xu", then " · " and the page (round 4a; round 3 used " — "). Descriptions stay at or under 160 characters (all measured).]*

| Page | `<title>` | Meta description |
|---|---|---|
| Home | Qijin (Jack) Xu · Lead AI/ML Architect | Qijin (Jack) Xu is a Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. He designs and ships production AI: LLM agents, RAG and data platforms. |
| Work | Qijin (Jack) Xu · Work | Six projects by Qijin (Jack) Xu: a RAG assistant serving 50,000+ users, LLM agents, a fraud model and data platforms, with outcomes and sources. |
| Writing | Qijin (Jack) Xu · Writing | Notes by Qijin (Jack) Xu on AI agents and the production AI systems around them. |
| Note `/writing/what-is-an-ai-agent/` | Qijin (Jack) Xu · What is an AI agent? | What an AI agent is, and how it differs from an AI assistant. A short note by Qijin (Jack) Xu. |
| Résumé | Qijin (Jack) Xu · Résumé | Résumé of Qijin (Jack) Xu, Lead AI/ML Architect in Toronto: LLM agents, RAG, data engineering and cloud. On the web, as a PDF and as JSON. |
| Contact | Qijin (Jack) Xu · Contact | Write to Qijin (Jack) Xu, Lead AI/ML Architect in Toronto, about collaborations on production AI or invitations to speak: qxjack@gmail.com. |
| 404 | Qijin (Jack) Xu · Page not found | This page doesn’t exist. Head back to the home page of Qijin (Jack) Xu. |
| `/about/` stub | Qijin (Jack) Xu · About | *(none; `noindex`)* |
| Old article stub | Qijin (Jack) Xu · What is an AI agent? | *(none; `noindex`)* |

- **Open Graph / social:** `og:title` = the page title; `og:description` = the meta description; `og:site_name` = Qijin Xu; `og:type` = `profile` on Home (the profile page), `article` on the Note, `website` elsewhere; `og:locale` = `en_CA`; `og:url` = the canonical URL.
- **OG image text (one per site is fine):** Qijin Xu / Lead AI/ML Architect · Toronto. *[Paper background with an ink ridge and the seal. No other Chinese text.]*
- **Canonical:** absolute URL with a trailing slash on every page. The `/about/` stub's canonical is the home page.
- **`<html lang="en-CA">`.**

### 8.2 Person JSON-LD (every page, in the root layout)

*[Domain is the current Vercel URL; swap it everywhere if a custom domain is chosen (10.7). Visible text and this data say the same things. `name` is the real name; "Jack Xu" and "Qijin (Jack) Xu" are alternate names (schema.org: an alias). `url` is the home page, which is the profile page. `image` is Home's colour photo. The `<script>` carries `data-shared` so the demo router never swaps it.]*

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://my-website-freedomjack.vercel.app/#person",
  "name": "Qijin Xu",
  "givenName": "Qijin",
  "familyName": "Xu",
  "alternateName": ["Jack Xu", "Qijin (Jack) Xu"],
  "description": "Lead AI/ML Architect at CGI's AI Center of Excellence in Toronto. Designs and ships production AI for banks and insurers: LLM agents, retrieval-augmented generation (RAG) systems and the data platforms beneath them.",
  "url": "https://my-website-freedomjack.vercel.app/",
  "email": "mailto:qxjack@gmail.com",
  "image": "https://my-website-freedomjack.vercel.app/assets/img/qijin-xu-colour.jpg",
  "jobTitle": "Lead AI/ML Architect",
  "worksFor": {
    "@type": "Organization",
    "name": "CGI",
    "legalName": "CGI Inc.",
    "url": "https://www.cgi.com/",
    "sameAs": "https://en.wikipedia.org/wiki/CGI_Inc."
  },
  "hasOccupation": {
    "@type": "Occupation",
    "name": "Lead AI/ML Architect",
    "occupationLocation": { "@type": "City", "name": "Toronto" },
    "skills": "LLM agents, LangGraph, retrieval-augmented generation, vLLM, data engineering, Apache Spark, Kafka, Azure, AWS, GCP"
  },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Toronto",
    "addressRegion": "ON",
    "addressCountry": "CA"
  },
  "alumniOf": {
    "@type": "CollegeOrUniversity",
    "name": "York University",
    "url": "https://www.yorku.ca/",
    "sameAs": "https://en.wikipedia.org/wiki/York_University"
  },
  "hasCredential": [
    {
      "@type": "EducationalOccupationalCredential",
      "name": "Bachelor of Science in Computer Science, Specialized Honours",
      "credentialCategory": "degree",
      "dateCreated": "2021",
      "recognizedBy": { "@type": "CollegeOrUniversity", "name": "York University", "url": "https://www.yorku.ca/" }
    },
    {
      "@type": "EducationalOccupationalCredential",
      "name": "Microsoft Certified: Azure Solutions Architect Expert",
      "credentialCategory": "certification",
      "dateCreated": "2022",
      "recognizedBy": { "@type": "Organization", "name": "Microsoft", "url": "https://www.microsoft.com/" }
    },
    {
      "@type": "EducationalOccupationalCredential",
      "name": "Google Cloud Professional Cloud Developer",
      "credentialCategory": "certification",
      "dateCreated": "2023",
      "recognizedBy": { "@type": "Organization", "name": "Google Cloud", "url": "https://cloud.google.com/" }
    }
  ],
  "award": ["CGI Impact Award 2024", "CGI Impact Award 2026"],
  "knowsAbout": [
    "Artificial intelligence",
    "Machine learning",
    "Large language models",
    "AI agents",
    "LangGraph",
    "Retrieval-augmented generation",
    "Model Context Protocol",
    "vLLM",
    "Computer vision",
    "Data engineering",
    "Data lineage",
    "Apache Spark",
    "Apache Kafka",
    "Microsoft Azure",
    "Amazon Web Services",
    "Google Cloud Platform",
    "Python"
  ],
  "sameAs": [
    "https://github.com/Freedom-Jack",
    "https://www.linkedin.com/in/qijin-x-4899671a9/"
  ]
}
```

*[When Jack supplies verification links (Credly, Microsoft Learn transcript, Google Cloud credential), add `"url": "<verification link>"` to each certification. That makes them checkable, not just claimed.]*

### 8.3 WebSite JSON-LD (Home only)

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://my-website-freedomjack.vercel.app/#website",
  "url": "https://my-website-freedomjack.vercel.app/",
  "name": "Qijin Xu",
  "alternateName": ["Qijin (Jack) Xu", "Jack Xu"],
  "inLanguage": "en-CA",
  "publisher": { "@id": "https://my-website-freedomjack.vercel.app/#person" }
}
```

### 8.4 ProfilePage JSON-LD (Home only; moved from `/about/`)

*[Home is the profile page now. `mainEntity` references the full Person block (8.2), which is on the same page; the real build may emit both as one `@graph`. `dateModified` is the date of the last change to Home's words.]*

```json
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": "https://my-website-freedomjack.vercel.app/#page",
  "url": "https://my-website-freedomjack.vercel.app/",
  "name": "Qijin (Jack) Xu · Lead AI/ML Architect",
  "inLanguage": "en-CA",
  "isPartOf": { "@id": "https://my-website-freedomjack.vercel.app/#website" },
  "dateModified": "2026-10-10",
  "mainEntity": { "@id": "https://my-website-freedomjack.vercel.app/#person" }
}
```

### 8.5 BlogPosting JSON-LD (the Note)

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "What is an AI agent?",
  "description": "What an AI agent is, and how it differs from an AI assistant.",
  "datePublished": "2025-04-20",
  "dateModified": "2026-10-10",
  "inLanguage": "en-CA",
  "url": "https://my-website-freedomjack.vercel.app/writing/what-is-an-ai-agent/",
  "mainEntityOfPage": "https://my-website-freedomjack.vercel.app/writing/what-is-an-ai-agent/",
  "author": { "@id": "https://my-website-freedomjack.vercel.app/#person" },
  "keywords": ["AI agents", "AI assistants"]
}
```

*[`datePublished` is the MDX file's first git commit. `dateModified` 2026-10-10 is the typo fixes (4.2), shown in the byline too. Change it whenever the words change.]*

### 8.6 CollectionPage JSON-LD (Work)

*[Keep round 3's block (`@id` `…/work/#page`, `author` and `about` the `#person`, `hasPart`: one `CreativeWork` per case with its `@id` and `url` at the anchor, `name` = the case's heading, `description` = its summary, `creator` the `#person`, `citation` = its evidence URLs where they exist). Change only two values:]*

- **`name`:** Qijin (Jack) Xu · Work
- **`description`:** the Work meta description (8.1)
- *[Don't put outcome numbers in structured data that aren’t also visible on the page.]*

### 8.7 JSON Resume `/resume.json`

*[JSON Resume schema v1.0.0. Mirrors the HTML résumé. No phone, no address. JSON Resume has no field for a nickname, so "Goes by Jack" stays on the page only.]*

```json
{
  "$schema": "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
  "basics": {
    "name": "Qijin Xu",
    "label": "Lead AI/ML Architect",
    "email": "qxjack@gmail.com",
    "url": "https://my-website-freedomjack.vercel.app/",
    "summary": "Lead AI/ML Architect with 5+ years building production AI and the data systems beneath it. Architected an LLM-powered RAG assistant that resolved about 90% of questions on its own for 50,000+ users and returned 525% ROI within 12 months (CGI Impact Award 2024). Now leading a LangGraph agent for a proprietary programming language, projected to cut manual work by 50%. Earlier, built a fraud loss-ratio model with a 321% lift over a top-five bank benchmark.",
    "location": {
      "city": "Toronto",
      "region": "ON",
      "countryCode": "CA"
    },
    "profiles": [
      { "network": "GitHub", "username": "Freedom-Jack", "url": "https://github.com/Freedom-Jack" },
      { "network": "LinkedIn", "username": "qijin-x-4899671a9", "url": "https://www.linkedin.com/in/qijin-x-4899671a9/" }
    ]
  },
  "work": [
    {
      "name": "CGI Inc.",
      "location": "Toronto, ON",
      "url": "https://www.cgi.com/",
      "position": "Lead AI/ML Architect, AI Center of Excellence",
      "startDate": "2025-01",
      "highlights": [
        "Lead an AI agent for a proprietary programming language: LangGraph dual-state dynamic workflow, vLLM-served LLMs with RAG, EBNF structured outputs and PII filtering.",
        "The agent writes documentation, extracts business rules, maintains legacy scripts and prepares for migration. Projected 50% labour reduction."
      ]
    },
    {
      "name": "CGI Inc.",
      "location": "Toronto, ON",
      "url": "https://www.cgi.com/",
      "position": "Data Architect & Engineering Lead, Senior Consultant",
      "startDate": "2023-08",
      "endDate": "2024-12",
      "highlights": [
        "CGI Impact Award 2024: architected and shipped an LLM-powered enterprise RAG chatbot (LangChain; Azure, AWS, GCP). About 90% autonomous resolution for a 50,000+ user base; 525% ROI within 12 months.",
        "Built an OpenLineage-based lineage tool that auto-documents multi-source data flows, with LLM-assisted root-cause suggestions; reduced investigation time across about 3 incidents per month.",
        "Automated AxiomSL rule updates at RBC with an LLM: 80% less manual updating, governance controls preserved."
      ]
    },
    {
      "name": "CGI Inc.",
      "location": "Toronto, ON",
      "url": "https://www.cgi.com/",
      "position": "Data Engineer, Consultant",
      "startDate": "2021-08",
      "endDate": "2023-07",
      "highlights": [
        "Managed Canada's largest automobile-insurance policy-history database (2 TB, SQL Server): 99.9% uptime, median queries under 200 ms.",
        "Built production ETL/ELT pipelines for 22+ micro data marts (under 6 tables each, monthly SLAs); report runtime cut from 30 to 5 minutes.",
        "Shipped a gradient-boosting and logistic-regression loss-ratio model, batch-scored in Python/T-SQL: 321% lift in recovered fraud losses versus a top-five bank benchmark."
      ]
    },
    {
      "name": "Elder Laboratory, York University",
      "location": "Toronto, ON",
      "position": "Research Assistant, Computer Vision (part-time)",
      "startDate": "2020-05",
      "endDate": "2021-08",
      "highlights": [
        "Worked on AttentiveVision's computer-vision pipeline for hockey broadcast video (PyTorch, TensorFlow, OpenCV); CNN-LSTM event detection reached mAP >= 70% across 18 hours of game video.",
        "Real-time player tracking with a Kalman filter and OpenPose: under 100 ms latency at 30 FPS.",
        "Active-learning annotation loop for goals, timeouts and penalties; label reliability reached Cohen's kappa >= 0.92."
      ]
    },
    {
      "name": "Nascent Digital",
      "position": "Full-Stack Developer Intern",
      "startDate": "2019-05",
      "endDate": "2019-08",
      "highlights": [
        "Built features in React, TypeScript and Node.js, including major parts of the company homepage rewrite.",
        "Shipped TELUS product pages with UX, QA and DevOps, design to deploy in 7 days.",
        "Introduced visual-regression testing (Nightwatch.js, Puppeteer), removing about 90% of manual QA checks."
      ]
    }
  ],
  "education": [
    {
      "institution": "York University",
      "url": "https://www.yorku.ca/",
      "area": "Computer Science",
      "studyType": "Bachelor of Science, Specialized Honours",
      "startDate": "2017-09",
      "endDate": "2021",
      "score": "3.9/4.0"
    }
  ],
  "awards": [
    {
      "title": "CGI Impact Award",
      "date": "2024",
      "awarder": "CGI",
      "summary": "For architecting and shipping an LLM-powered enterprise RAG chatbot."
    },
    {
      "title": "CGI Impact Award",
      "date": "2026",
      "awarder": "CGI"
    }
  ],
  "certificates": [
    { "name": "Microsoft Certified: Azure Solutions Architect Expert", "date": "2022", "issuer": "Microsoft" },
    { "name": "Google Cloud Professional Cloud Developer", "date": "2023", "issuer": "Google Cloud" }
  ],
  "publications": [
    {
      "name": "What is an AI agent?",
      "publisher": "Personal site of Qijin Xu",
      "releaseDate": "2025-04-20",
      "url": "https://my-website-freedomjack.vercel.app/writing/what-is-an-ai-agent/"
    }
  ],
  "skills": [
    { "name": "Languages", "keywords": ["Python", "Java", "Go", "SQL (T-SQL, PostgreSQL)", "TypeScript/JavaScript", "C++"] },
    { "name": "AI/ML", "keywords": ["PyTorch", "JAX", "LangGraph", "RAG", "Agent workflows", "Model Context Protocol (MCP)", "LLMs", "vLLM", "OpenAI API", "FAISS", "Pinecone"] },
    { "name": "Data and streaming", "keywords": ["Apache Spark", "Kafka", "Airflow", "OpenLineage", "Redis"] },
    { "name": "Cloud and systems", "keywords": ["Azure", "GCP", "AWS", "Docker", "Kubernetes", "Terraform", "Microservices", "gRPC", "CI/CD"] }
  ],
  "meta": {
    "canonical": "https://my-website-freedomjack.vercel.app/resume.json",
    "version": "v1.0.0",
    "lastModified": "2026-10-10"
  }
}
```

### 8.8 `/llms.txt` (plain-language site summary for AI agents)

*[Follows the llms.txt convention. Facts only, each one also visible on the site. No instructions to the reader.]*

```text
# Qijin Xu

> Qijin Xu, known as Jack, is a Lead AI/ML Architect at CGI's AI Center of Excellence in Toronto, Canada. He designs and ships production AI for banks and insurers: LLM agents, retrieval-augmented generation (RAG) systems and the data platforms beneath them. 5+ years of experience.

Key facts (details and sources on the linked pages):
- Architected an LLM-powered RAG support assistant: about 90% autonomous resolution for 50,000+ users, 525% ROI within 12 months. CGI Impact Award 2024.
- CGI Impact Award 2026.
- Leads a LangGraph agent for a proprietary programming language (vLLM, RAG, EBNF structured outputs, PII filtering). Projected 50% reduction in manual work.
- Built a fraud loss-ratio model with a 321% lift in recovered fraud losses versus a top-five bank benchmark.
- B.Sc. Computer Science, Specialized Honours, York University, 2017–2021 (GPA 3.9/4.0).
- Microsoft Certified: Azure Solutions Architect Expert (2022). Google Cloud Professional Cloud Developer (2023).

## Pages
- [Home](https://my-website-freedomjack.vercel.app/): who he is, in his own words, and what he works on now
- [Work](https://my-website-freedomjack.vercel.app/work/): six projects with context, outcomes, evidence links and stack, and his public repositories
- [Résumé](https://my-website-freedomjack.vercel.app/resume/): the résumé
- [Résumé (PDF)](https://my-website-freedomjack.vercel.app/resume.pdf): the same résumé as a PDF
- [JSON Resume](https://my-website-freedomjack.vercel.app/resume.json): machine-readable résumé
- [Writing](https://my-website-freedomjack.vercel.app/writing/): notes, including "What is an AI agent?" (2025)
- [Contact](https://my-website-freedomjack.vercel.app/contact/): qxjack@gmail.com, for collaborations on production AI and invitations to speak

## Public evidence
- [CGI insurance chatbot product page](https://www.cgi.com/canada/en-ca/insurance-chatbot)
- [CGI article on AI chatbots for insurance](https://www.cgi.com/canada/en-ca/article/insurance/ai-chatbots-insurance-are-transforming-customer-service)
- [Vector Institute article on the AttentiveVision hockey project](https://vectorinstitute.ai/amateur-hockey-given-professional-viewing-experience-courtesy-of-machine-vision-startup-co-founded-by-vector-researcher/)
- [GitHub: Freedom-Jack](https://github.com/Freedom-Jack)
- [LinkedIn](https://www.linkedin.com/in/qijin-x-4899671a9/)
```

### 8.9 Redirects, sitemap, robots

- **301 redirects:**
  - `/about/` → `/` *[round 4a; the demo serves a `noindex` meta-refresh stub there (section 2)]*
  - `/projects` → `/work/`
  - `/blog` → `/writing/`
  - `/blog/Building-Autonomous-AI-Agents` → `/writing/what-is-an-ai-agent/`
  - `/writing/building-modular-ai-agents/` → `/writing/what-is-an-ai-agent/` *[the demo serves a `noindex` stub there (4.3)]*
  - `/blog/welcome-to-my-first-blog` and `/blog/welcome-to-my-second-blog` → `/writing/`
  - `/documents/QijinXu_Resume.pdf` → `/resume/` *[The OLD PDF contains his phone number. Remove the file from `public/` in the real build. Never redirect it to the new `/resume.pdf`: old links should land on the page, not silently on a different file.]*
- **Sitemap:** `/`, `/work/`, `/writing/`, `/writing/what-is-an-ai-agent/`, `/resume/`, `/contact/`, `/resume.json` and `/resume.pdf`. Never the 404, `/about/` or the old article URL. `lastmod` from content changes (2026-10-10 for every page changed in round 4a).
- **robots.txt:** `User-agent: *`, `Allow: /` and a `Sitemap:` line (unchanged).

---

## 9. Claims ledger

*[Every number and award on the site, where it comes from, and whether a stranger can check it. Keep this current; it is the honesty audit for "sourced claims". A build check should fail if a figure shown anywhere is missing from this table.]*

| Claim | Appears on | Source | Publicly verifiable? |
|---|---|---|---|
| ~90% autonomous resolution, 50,000+ users | Home (What I work on), Work, Résumé, llms.txt | Résumé PDF; old about.ts | The product is public (CGI product page). The figures are not on any public page. |
| 525% ROI within 12 months | Work, Résumé, llms.txt | Résumé PDF; old about.ts | No |
| CGI Impact Award 2024 (the RAG assistant) | Work, Résumé, JSON-LD, resume.json, llms.txt | Résumé PDF; old about.ts | No public page found |
| CGI Impact Award 2026 (no project named) | Résumé, JSON-LD, resume.json, llms.txt | Per Jack and his LinkedIn (10 Oct 2026) | No public page found |
| "two CGI Impact Awards" | Home (About me) | Jack's own words; the two rows above | Follows from the two rows above |
| "for banks and insurers" | Home (hero), Person description, llms.txt | Jack's own words; the cases: RBC (a bank), the insurance assistant and the insurance policy-history database | Follows from the cases |
| Projected 50% labour reduction (proprietary-language agent) | Home (What I work on), Work, Résumé, llms.txt | Résumé PDF | No. A projection, labelled as one. |
| 80% less manual AxiomSL updating at RBC | Work, Résumé | Résumé PDF | No |
| About 3 incidents a month (lineage tool) | Work, Résumé | Résumé PDF | No. No % improvement claimed. |
| Canada’s largest auto-insurance policy-history database, 2 TB | Home (What I work on), Work, Résumé | Résumé PDF | No. "Largest" is an unsourced superlative. |
| 99.9% uptime, <200 ms median queries | Home (uptime), Work, Résumé | Résumé PDF | No |
| 22+ data marts, report runtime 30 → 5 min | Work, Résumé | Résumé PDF | No |
| 321% lift in recovered fraud losses vs a top-five bank benchmark | Work, Résumé, llms.txt | Résumé PDF | No |
| mAP ≥ 70%, 18 h video; <100 ms at 30 FPS; kappa ≥ 0.92 | Work, Résumé | Résumé PDF | The project is public (Vector Institute article). The figures are not. |
| ~90% fewer manual QA checks, 7-day TELUS pages | Résumé | Old about.ts only | No |
| GPA 3.9/4.0, Dean’s List | Résumé, resume.json, llms.txt | Résumé PDF | No |
| B.Sc. 2017 – 2021 | Résumé, JSON-LD (degree `dateCreated`), resume.json, llms.txt | Per Jack (10 Oct 2026); the old site said the same | No |
| Azure Solutions Architect Expert (2022), GCP Professional Cloud Developer (2023) | Résumé, JSON-LD, resume.json, llms.txt | Résumé PDF; about.ts | Not yet. Verifiable once credential links are supplied. |
| 5+ years / "five years" | Home (About me), Work (How I build), Résumé, llms.txt | Résumé PDF; full-time work from Aug 2021 | Follows from the dated roles |

---

## 10. Open items (resolve before launch)

1. **Graduation date and honour.** Dates RESOLVED (Jack, 10 Oct 2026): 2017 – 2021, graduated 2021. Still open: the honour's wording (the résumé said "First in Class", the old site "First Class with Distinction"). Until then only "GPA 3.9/4.0 · Dean’s List".
2. **LinkedIn URL.** RESOLVED (Jack, 10 Oct 2026): https://www.linkedin.com/in/qijin-x-4899671a9/ everywhere (every page, `sameAs`, resume.json, llms.txt, the PDF).
3. **Job title.** RESOLVED (Jack, 10 Oct 2026): Lead AI/ML Architect everywhere: site, résumé, PDF, JSON-LD and llms.txt. (His LinkedIn says "Lead AI/ML Engineer and Tech Lead": see "Off-site consistency".)
4. **Certification status and verification links.** Open. Google Cloud Professional certifications are valid for two years and Microsoft role-based ones renew yearly. "2022/2023" is when they were earned, which is true either way. Verification links would make both checkable.
5. **The article.** RESOLVED in round 3: published as a dated Note with only its finished sections (4.2).
6. **GitHub section.** RESOLVED (Jack, 10 Oct 2026): auto-discovered at build time (3.4). Placeholder repos (the agent-memory scaffold, the stock-app design doc) appear by themselves once they hold real code and a description.
7. **Domain.** Open. Not bought yet. Keep `my-website-freedomjack.vercel.app` as the canonical; a custom domain is the largest single SEO lever left. Swap every URL here when it exists.
8. **Phone number.** RESOLVED 9 Oct 2026: none on the public site or PDF. Add the number only to copies Jack sends directly.
9. **The Note's title and typos.** RESOLVED (Jack, 10 Oct 2026): keep the title "What is an AI agent?"; fix the typos (4.2 lists every change).
10. **DRAFT words for Jack to approve or rewrite:** the hero lead and second line (1.1), About me (1.2) and Now (1.4), all drafted from his own answers; What I work on (1.3) and Say hello (1.6), drafted from existing facts. A text-only swap.
11. **Glossary notes on Work (Cases 1 and 2).** Open. Short public definitions of RAG, LangChain, LangGraph, vLLM, EBNF and PII: keep or drop?
12. **Who should write.** RESOLVED (Jack, 9 Oct 2026): collaboration and speaking; no hiring language (1.6, 6).
13. **Writing intro.** Open. "I write when I’ve learned something worth passing on." is a statement about Jack's habits written in draft 1, not by Jack. Keep, rewrite or drop.
14. **"The hard part" of the two flagship cases.** Open (OMITTED): the hardest decision, what didn't work, how he knew it worked, kept generic.
15. **Side projects (his game tools).** Open (OMITTED): which games, what the tools do, a screenshot or repo.
16. **"For organisers" on Contact.** Open (OMITTED): two short bios with Copy buttons, only if Jack wants speaking invitations handled there.
17. **The 2026 Impact Award's project.** Open: may it be named? Until then it is listed with the year only.
18. **The photo.** Open: the reshoot (side daylight, a real smile, someone else holding the camera, the red top) is a one-file swap.
19. **Contact's closing.** Open: "Next: Home" (the ferry back across to his mountain). Confirm it reads well.

### Off-site consistency (Jack’s to-do, outside this repo)

- GitHub profile: the name shows "Jack Xu" with no company or location. Set the name to "Qijin Xu" (the site's name; "Jack" can go in the bio), the company to CGI, the location to Toronto, and the website to the site URL. A consistent name helps search engines tell him apart from others with similar names (a search for "Qijin Xu" also surfaces a biotech executive of a similar name).
- LinkedIn headline: it says "Lead AI/ML Engineer and Tech Lead". Change it to "Lead AI/ML Architect, AI Center of Excellence, CGI" to match the site, résumé and PDF, and list the 2026 Impact Award there with its year.
- Old résumé PDF (LaTeX): update the title to "Lead AI/ML Architect" and drop the phone number before sharing it anywhere public. The site's own PDF (`/resume.pdf`) is generated from `/resume/`.
- GitHub: to feature a repo on Work, add the topic `featured` to it on GitHub (or one override line in `data/projects.json`), then rebuild. A repo with real code and a description appears under "Recent" on its own.
- Google Search Console: verify the domain and submit the sitemap after launch.
