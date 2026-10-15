# SPEC-R3: round-3 build spec (design demo)

Design lead, 8 October 2026. Binding for the six round-3 builders. Where this file and an older document differ, the order of authority is: Jack's own words → `brief-r3.md` → this spec → `COPY.md` (for words) → `README.md` → `brief.md`.

**Guiding principle (Jack, 8 Oct 2026): reading first, show-off second.** People must first be able to take in the information, then enjoy the site. Every rule below follows from that. When two rules seem to conflict, pick the one that makes the page easier to read.

**Words:** every visible word, title, meta and JSON-LD value comes from `COPY.md` (draft 2, round 3). Builders never write copy. If a word is missing, leave the element out and report it. `OMITTED` in COPY means: build nothing there (no heading, no placeholder, no "coming soon").

Contents:
1. Frozen, retired and hard rules
2. Tiers
3. Section system: passages, rhythm, axes, vista
4. Components
5. Page boot and page modules
6. Router contract (demo only)
7. Transition contract
8. Landscape API additions
9. Per-page structure
10. File ownership, coordination and phases
11. QA and acceptance
12. Open items

---

## 1. Frozen, retired and hard rules

### 1.1 Frozen (must not change by a pixel)

- **The home hero**: `section.screen.hero` and everything inside it, the `.screen`, `.name`, `.hero*`, `.ink-btn` and `.brush--rest` rules that style it, and the landscape's stretch-0 composition at scroll 0. Proof: §11.2 (pixel diff against the baselines in `<scratchpad>/shots/spec-lead/`).
- The only intended change on the hero screen is in the header: "Writing" leaves the nav (§9.4).
- The palette, the three type families, the seal, brush links, ink buttons, ink rows, the A/B/C axes, the article's reading design (measure, progress stroke, author's seal), Contact's single focal point.

### 1.2 Retired this round

| Retired | Replaced by |
|---|---|
| `.screen` (100svh slides) below the hero | `.passage` (§3). `.screen` stays only for the hero, Contact and the 404 (one-screen pages). |
| `data-mist-bank`, the lift into the cloud sea | Landscape states: head, horizon, vista, closing (§8.3) |
| The dark ink flood (`ink-transition.js`, `.is-covered`, `.is-held` from navigation, `ink:nav`/`ink:frame`, view-transition type `ink`, `data-no-wash`) | The pan with a mist sweep (§7), driven by the demo router (§6). `.ink-wash` canvas is kept for the `?transition=edge` variant only. |
| About's pinned sideways handscroll (`about.js` track, snaps, `journey__years`) | A vertical timeline (§9.3) |
| Work's sticky case index and narrow-screen case bar | The "At a glance" table (§4.3, §9.2) |
| Per-paragraph reveals; the 780 ms build on every block | Motion per tier (§2.3) |
| `data-ink-figure` on figures | Supporting-tier fade (figures are supporting). `ink-figures.js` stays in the repo, unused. |
| Cinnabar on About's "Present" | Plain ink. Cinnabar = the seal, plus the home statement's full stop and the 404 line's full stop. Nothing else. |
| Résumé "Print or save as PDF" button | "View résumé (PDF)" (§4.8); the browser's own Print still works. |
| "Writing" in the header nav | Footer scroll map + home "Latest writing" |

### 1.3 Hard rules (unchanged; every builder)

- The only Chinese character anywhere (text, alt, comments, file names, metadata) is 徐, and only as the seal. Never the forbidden motto. Never invented characters for "Qijin". No new Chinese text.
- No phone number anywhere, including the PDF (Jack decided 2026-10-09). No street address. No PMP. Public email: qxjack@gmail.com.
- Never link or copy the OLD PDF (`public/documents/QijinXu_Resume.pdf`). The only PDF is the generated `/resume.pdf`.
- No illustrations of objects (koi, plum, bamboo, boats, buildings, people). Brush-style system **diagrams** are allowed (§4.4). No boxy cards, frames, pills, bento, glass, gradients-as-decoration, icon rows, text-left/picture-right splits.
- Avoid these words in `alt`, `title`, `aria-label` and inline SVG, because the compliance scan treats them as illustration words: photo, portrait, selfie, headshot, house, building, bridge, boat, ship, temple, lantern, crane.
- No git operations. Never use the in-app browser pane. Screenshots only under `<scratchpad>/shots/<your-name>/`. Never bypass a web filter; never change system, security or TLS settings.
- Content is complete with JS off; nothing starts hidden without the `js` class; reduced motion, no-WebGL and print all work; zero console errors.

`<scratchpad>` = `/private/tmp/claude-502/-Users-jackxu-Personal-Projects-my-website/3cd239fe-1aad-42a5-82d2-5903767edb9e/scratchpad`.

---

## 2. Tiers

Three tiers, each with its own type, ink and behaviour. **Paragraph text never animates.** One main element per screen, with supporting content around it.

### 2.1 Tokens (system adds them to `tokens.css`; until then, pages may write `var(--token, <value>)` with the value below)

```css
/* Commissioner: three weights only (outside the frozen hero and header) */
--w-body: 400;            /* body, small print */
--w-ui: 560;              /* labels, links that need weight, table headers, diagram labels */
--w-strong: 700;          /* <strong>, <b> (base.css changes 650 → 700) */

/* MAIN */
--tier-main-font: var(--font-display);   /* Sofia Sans Condensed; the name and big figures use --font-name */
--tier-main-weight: 780;
--tier-main-ink: var(--ink-1);           /* 16.3:1 on paper */

/* SUPPORTING */
--tier-support-font: var(--font-display);
--tier-support-weight: 700;
--tier-support-ink: var(--ink-2);        /* 11.8:1 */
--tier-figure-font: var(--font-name);    /* Sofia Sans Extra Condensed 900 */
--step-figure-s: clamp(2.75rem, 2rem + 3.6vw, 5.5rem);   /* 44 → 84 px: ledger, case and timeline figures */

/* SMALL PRINT */
--tier-small-font: var(--font-body);
--tier-small-size: var(--step--1);       /* 15 → 16 px */
--tier-small-weight: 400;
--tier-small-ink: var(--ink-3);          /* 7.7:1 paper, 6.3:1 on mist-2: safe over the horizon band */
--tier-small-ink-quiet: var(--ink-4);    /* 5.1:1 paper, 4.15:1 on mist-2: ONLY on plain paper or a veil ≥ 0.9 */

/* Annotation ink: margin notes, diagram strokes, band labels */
--ink-annot: var(--wash);                /* #3E5664: 6.8:1 paper, 5.5:1 mist-2 */

/* Every link's resting mark */
--rule-rest: #7B8385;                    /* 3.4:1 on paper */

/* Motion per tier */
--dur-fade: 280ms;                       /* supporting: opacity only, no blur, no shift */
--dur-draw: 520ms;                       /* supporting: one stroke drawing in */
--draw-step: 90ms;                       /* stagger between strokes, in flow order */
/* main below the first screen keeps --dur-reveal (780 ms) with the existing ≤ 5 px blur */
```

The frozen hero and header keep their measured weights (420, 460, 520, 620) because "pixel-identical" outranks the weight rule. `.ink-btn` keeps 620 for the same reason (the hero contains one). Every **new** rule uses only `--w-body`, `--w-ui`, `--w-strong`.

### 2.2 Classes

| Tier | Class | Elements | Type | Ink |
|---|---|---|---|---|
| Main | `.t-main` (or the existing `.name`, `.page-title`) | The name, page titles (h1), the home statement, the closing question, a flagship case title, Contact's address, the 404 line | Sofia Sans Condensed 780 at `--step-4`/`--step-5`; titles `--step-title`; the name `--step-name` | ink-1 |
| Supporting | `.t-support` | Section labels (`.section-title`), project titles (ledger, table, compact cases), figures (`.t-figure`), timeline years, diagram labels, featured repo names | Sofia Sans Condensed 700 at `--step-1`…`--step-3`; figures Extra Condensed 900 at `--step-figure-s` | ink-2 (annotation ink for diagrams) |
| Small print | `.t-small` (+ `.t-small--quiet`) | Dates, meta lines, sources, captions, table headers, figure notes, stack lines, footer, margin notes | Commissioner 400 at `--step--1`, `font-variant-numeric: tabular-nums` | ink-3 (ink-4 only with `--quiet`) |
| Body | none | Paragraphs, list items, the bio, leads | Commissioner 400 at `--step-0` (leads `--step-1`/`--step-2`) | ink-1 (leads ink-2) |

`.section-title` changes (system) from Commissioner 620 to the supporting face: `font: var(--tier-support-weight) var(--step-2)/1.2 var(--tier-support-font); color: var(--tier-support-ink); letter-spacing: .01em`.

### 2.3 Motion per tier

| Tier | Attribute | Behaviour | Reduced motion | No JS |
|---|---|---|---|---|
| Main, first screen | `data-arrive` / `data-arrive="name"` (existing) | The existing arrival (name legible by ~400 ms; 2.5 s safety net) | 300 ms fade | visible |
| Main, below the first screen | `data-reveal="bloom"` | Ink bloom once: opacity + ≤ 5 px blur + .55 rem settle, `--dur-reveal` (the existing display-text path of `mist-reveal.js`) | 280 ms fade | visible |
| Supporting text, figures, years | `data-reveal="fade"` | Opacity 0 → 1 over `--dur-fade`, no blur, no shift | same | visible |
| Supporting strokes (rules, diagram edges, the timeline path) | `data-draw` on the SVG or rule; strokes carry `pathLength="1"` and `data-order` | Draw in reading or flow order: `stroke-dashoffset` 1 → 0 over `--dur-draw`, `delay = order × --draw-step` | drawn at rest | drawn at rest |
| Small print, paragraphs, lists, captions | none | Never moves. Never put `data-reveal` on them. | — | — |
| Interactive | `.ink-btn`, `.ink-row`, `a.brush` | Unchanged: bloom from the pointer, press rings, brush underline | unchanged | unchanged |

All one-shot effects keep the existing guarantees (`onScrollIn`: play at 90 %, settled by 40 %; `reached()` never hides what is already on screen). Legacy `data-reveal` with no value is treated as `fade` (system). **Nothing is hidden behind hover**: figures, years, roles and outcomes are visible at rest on every device.

### 2.4 Links

Every link has a visible resting mark; hover only enriches it (the brush draws over it). System changes `a.brush` so that, at rest, it shows `text-decoration: underline 1px var(--rule-rest)` with `text-underline-offset: .3em` (display titles: `.brush--display` keeps its thinner brush band, and gets a resting brush trace at 35 % like today's `.brush--touch`). Exempt, by convention: the header nav (position says "navigation"; the current page keeps its brush mark), the seal, and `.ink-btn` buttons. The footer scroll map labels are links and get the resting mark.

### 2.5 Contrast over the landscape

Small print never sits on bare mountain. Measured minimum backgrounds (grey level, 0–255) for 4.5:1: ink-4 needs ≥ 227, ink-3 ≥ 186, wash ≥ 198. Rules:
- Small print uses `--tier-small-ink` (ink-3) by default. Use `--quiet` (ink-4) only on plain paper or inside a veil ≥ 0.9.
- Every passage's content block carries `data-veil` (default 0.72). A small-print block that can sit in the bottom 30 % of the viewport over the horizon band (ledger sources, table, captions) sits inside a veiled block. The footer keeps today's ground mist (`.site-footer::before`, no veil box, because a box cuts the closing vista's crests); if its small print measures below 4.5:1 over a page's horizon, system adds a `data-veil="0.95"` reserve to the footer's text block only.
- Cinnabar is never used for text other than the two full stops (§1.2).

---

## 3. Section system: passages, rhythm, axes, vista

### 3.1 Passages

Below the hero, every section is a passage sized to its content. No `min-height` on passages except the vista and the home closing.

```html
<section class="passage passage--index" aria-labelledby="work-title">
  <div class="passage__inner" data-veil>
    <h2 class="section-title on-a" id="work-title">Selected work</h2>
    …
  </div>
</section>
```

| Class | Use | Notes |
|---|---|---|
| `.passage` | Every section below the head | `padding-block: var(--rhythm-passage)`; `padding-inline: var(--gutter)` |
| `.passage__inner` | The one content block (the 12-column grid, the veil) | `display: grid`; 1 column below 48rem, `repeat(12, minmax(0,1fr))` with `column-gap: var(--col-gap)` from 48rem; `row-gap: var(--rhythm-row)`; `grid-auto-flow: row dense` (margin notes, §4.5). Without the landscape it gets today's `.focal::before` paper mist (system copies that rule). |
| `--lead` | A statement with its line (home 1.2) | `padding-block-end: var(--space-l)`, so the passage after it reads as its continuation |
| `--index` | Ledger, tables, row lists | — |
| `--reading` | Running text at B, margin notes at C | measure `var(--measure)` |
| `--figure` | A diagram as the passage's object | the figure spans A–C |
| `--vista` | Wordless landscape (§3.4) | — |
| `--closing` | Home's closing (keeps `data-landscape-descend`) | `min-height: calc(100svh - var(--footer-h))`, content in the upper half (as today) |
| `--end` | A page's last action row (one ink button) | `padding-block-end: var(--space-2xl)` |

Interior page heads keep `header.page-head` (layout.css), now with `min-height: 0` by default (system) and `data-landscape="head"` (§8.3). A page that wants its scene to breathe under the title may set `min-height: 46svh` on its own head.

### 3.2 Rhythm (tokens, system)

```css
--rhythm-passage: var(--space-xl);   /* 48 → 68 px each side: 96 → 136 px between two passages */
--rhythm-head: var(--space-l);       /* section label → its body */
--rhythm-row: var(--space-m);        /* rows of a ledger, timeline, list; grid row-gap */
--rhythm-para: .9em;                 /* between paragraphs in a reading passage */
--vista-h: 50svh;                    /* desktop and landscape tablets */
--vista-h-portrait: 36svh;           /* @media (max-aspect-ratio: 3/4) */
```

Density target at 1440×900 for every non-vista viewport: about 90+ words **or** one visual object, at least two of the axes in use, at most one main-tier element.

### 3.3 Axes A/B/C

The three text lines of the 12-column grid are unchanged (at 1440: A 78 px, B 407 px, C 955 px). Children of `.passage__inner` place themselves with:

| Class | Grid columns (≥ 48rem) | Typical content |
|---|---|---|
| `.on-a` | 1 / 4 | section labels, figures, years, photo, small-print labels |
| `.on-b` | 4 / 9 | running text, titles, the bio (cap at `--measure`) |
| `.on-c` | 9 / 13 | margin notes, meta, sources, companion lines |
| `.on-ab` | 1 / 9 | statements |
| `.on-bc` | 4 / 13 | wide rows, long lists |
| `.on-abc` | 1 / 13 | tables, diagrams |

Below 48rem every child is `1 / -1` (axis A only). Outside a grid, use the existing `--axis-b`/`--axis-c` offsets. Nested rows (ledger, timeline) use `grid-template-columns: subgrid`. The existing `.at-b`, `.at-c`, `.at-start`, `.at-wide` stay for `.screen` pages.

### 3.4 Vista

```html
<div class="passage passage--vista" data-vista data-wake aria-hidden="true"></div>
```

Half a screen of painting, no words (`min-height: var(--vista-h)`, portrait `var(--vista-h-portrait)`). At most one per page, and only on long pages (home, Work, About). The landscape rises from the horizon to the page's full scene while the vista crosses the viewport (§8.3); the mouse wake is strongest here. No veil, no content, no focusable element. Reduced motion and "Still": the same space, a static scene.

---

## 4. Components

CSS for every component lives in a new shared file, `assets/css/components.css` (system), loaded after `effects.css`. Behaviour lives in shared modules (system). Page builders write markup exactly as below and may only add **layout** for their own page in their page CSS.

### 4.1 Returning header (system: `layout.css`, `assets/js/header.js`)

- **At rest at the top:** exactly as today (static, transparent over the landscape). Pixel-identical on the hero, except for the removed "Writing".
- **Below the page head** (`[data-landscape="head"]` has scrolled away): scrolling down ≥ 8 px hides it; scrolling up ≥ 8 px brings it back as a fixed bar.
- **States:** `.site-header.is-pinned` (fixed, `translate: 0 0`), `.is-unpinned` (fixed, `translate: 0 -100%`), neither (static). Slide `var(--dur-header)` = 220 ms, `--ease-out`. Reduced motion: opacity 0 ↔ 1 in 120 ms, no slide.
- **Look when pinned:** paper with a soft mist edge, no border, no shadow: `background: linear-gradient(to bottom, rgb(var(--paper-rgb) / .94) 0 72%, rgb(var(--paper-rgb) / 0))` with the bottom padding extended by 1.25 rem for the fade.
- **Keyboard:** never `visibility: hidden` or `inert`. `focusin` inside the header pins it. `html { scroll-padding-top: calc(var(--header-h) + var(--space-s)) }` so focused elements and anchors are never under it (WCAG 2.4.11).
- **API:** `initHeader() → destroy()`. The router calls `header.reset()` after a swap (static, top).

### 4.2 Ledger (CSS: system; markup: home)

Six project rows: figure · title + line · organisation, years and role · source.

```html
<ol class="ledger" role="list">
  <li class="ledger__row ink-row">
    <p class="ledger__figure t-figure" data-reveal="fade">~90%</p>
    <p class="ledger__note t-small">of questions resolved without a person</p>
    <h3 class="ledger__title t-support"><a class="brush brush--display" href="/work/#rag-assistant">Enterprise RAG assistant</a></h3>
    <p class="ledger__line">An LLM support assistant …</p>
    <p class="ledger__meta t-small">CGI · 2023 – 2024 · Architect</p>
    <p class="ledger__source t-small"><a class="brush brush--rest" href="https://www.cgi.com/…">CGI product page</a></p>
  </li>
  …
</ol>
<p class="ledger__foot t-small">Figures come from my project work. …</p>
```

- Figure leads ("mAP ≥") are `<span class="ledger__lead">` inside the figure, at .55 em. "50% projected": the word "projected" is `<span class="ledger__lead">` after the number, inside `.ledger__figure`, same face and ink, at .55 em, on the same line: part of the figure, never small print, never dropped.
- **≥ 64rem:** the row is a subgrid over the 12 columns: figure + note at A (rows 1–2), title + line at B, meta + source at C, first baselines aligned. **48–64rem:** figure + note at A, everything else at B–C. **< 48rem:** meta, title, figure with its note on one line, line, source.
- Rows are separated by `--rhythm-row` of space, no rules or boxes. The whole row washes on hover (`.ink-row`), the title link's hit area covers the row (`::after`, as `.index__title`). Figures, notes, meta and sources are visible at rest everywhere.
- Figures fade (`data-reveal="fade"`); nothing else in a row moves.

### 4.3 Scannable table (CSS: system; markup: work)

```html
<div class="table-wrap">
  <table class="table" role="table">
    <caption class="table__caption t-small">Six projects, newest first</caption>
    <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Years</th>…</tr></thead>
    <tbody role="rowgroup">
      <tr role="row">
        <td role="cell" data-label="Years">2025 – present</td>
        <th scope="row" role="rowheader"><a class="brush brush--rest" href="#proprietary-language-agent">Agent for …</a></th>
        <td role="cell" data-label="Kind">LLM agent</td> …
      </tr>
    </tbody>
  </table>
</div>
```

- Explicit roles keep table semantics when the narrow layout changes `display` (same technique as the article's `.compare`).
- Headers: small print, `--w-ui`, ink-3, no uppercase, no tracking. Project cells: supporting face 700 at `--step-1`, ink-2. Other cells: body size. Years: tabular figures.
- Rows separated by a 1 px `--rule` hairline (typographic, not a box). No zebra fills, no outer border.
- **< 48rem:** each row restacks as a block: the project first, then `Years`, `Kind`, `Outcome`, `Evidence` as small-print labels (`td::before { content: attr(data-label) }`) with their values.
- `.table--quiet` (the "Early work" list): small-print size throughout, no caption shown (`.visually-hidden`), project cell in body font 560.

### 4.4 Brush diagram (CSS + `assets/js/diagram.js`: system; SVG drawing: the page that owns it)

```html
<figure class="diagram" data-diagram="how-i-build">
  <svg class="diagram__art diagram__art--wide" viewBox="0 0 1200 560" role="img" aria-labelledby="dg-hib-t dg-hib-d" data-draw>
    <title id="dg-hib-t">How I build</title>
    <desc id="dg-hib-d">Three layers. …</desc>
    <g class="diagram__bands">…</g>
    <g class="diagram__edges"><path class="diagram__edge" pathLength="1" data-order="1" d="…"/>…</g>
    <g class="diagram__nodes"><path class="diagram__node" d="…"/>…</g>
    <g class="diagram__labels"><text class="diagram__label" x y>Sources</text><text class="diagram__sub" x y>…</text>…</g>
  </svg>
  <svg class="diagram__art diagram__art--tall" viewBox="0 0 400 980" role="img" aria-labelledby="dg-hib-t2 dg-hib-d2" data-draw>…same nodes, stacked…</svg>
  <figcaption class="diagram__caption t-small">The generic shape of the systems I build: …</figcaption>
  <details class="diagram__steps">
    <summary>Read as steps</summary>
    <ol><li>Sources feed ETL/ELT pipelines.</li>…</ol>
  </details>
</figure>
```

- **One spec, two layouts.** `.diagram { container-type: inline-size }`. `--wide` shows at container width ≥ 60rem; `--tall` below (the same nodes stacked top to bottom). The hidden one is `display: none`, so only one is in the accessibility tree. Each SVG has its own `<title>`/`<desc>` (same words; ids must be unique per page).
- **Size and legibility.** Reserve the box with the viewBox aspect ratio (no layout shift). Wide: `max-width: 1200px` (scale ≤ 1). In user units: label 21 (Commissioner `--w-ui`, ink-2), sub-label 19 (400, ink-3), band label 19 (`--w-ui`, `--ink-annot`). Tall (viewBox 400 wide): label 19, sub-label 17. That keeps rendered text ≥ 15 px at the smallest size each layout shows at.
- **Drawing conventions.** Bands (strata): full-width washes with feathered ends (gradient-faded, no stroke), `--wash` at 5 % (top), 8 % (middle), 11 % (bottom): palest on top, darkest underneath. Nodes: ink pools, irregular closed paths filled with `--wash` at 14–18 %, no outline. Edges: `--ink-annot`, 2.5 units, round caps, a small brush-tick arrowhead drawn as part of the same path. Return flows are a second, offset stroke. Texture (dry-brush grain) may sit on the static bands as a mask or the shared `#ink-feather` filter; **never put a filter on an animated path**. No pictures, icons or objects. No cinnabar. Meaning never rides on colour alone (every band and node is labelled in text).
- **Draw-in.** `diagram.js` `initDiagrams(root) → destroy()`: with JS and motion, edges start at `stroke-dashoffset: 1` (class `is-pending`), and when the figure reaches the 90 % line they draw in flow order (`data-order`), `--dur-draw` each, `--draw-step` apart, `--ease-ink`; all are finished by the 40 % line or if jumped past (`onScrollIn`). Labels and nodes never move. Reduced motion, "Still", no JS, print: drawn at rest.
- **"Read as steps".** A native `<details>` (keyboard and screen-reader ready without JS), closed by default. `summary` set like a link with a resting mark, `--w-ui`. The ordered list at axis B, body size.
- **Budget.** ≤ 15 KB per SVG pair, hand-written paths, labels as real `<text>` (never outlined).

### 4.5 Margin notes (CSS + `assets/js/margin-note.js`: system; content: work)

```html
<p class="on-b">… A LangGraph dual-state, dynamic workflow coordinates vLLM-served models …</p>
<aside class="margin-note on-c t-small" id="note-vllm" aria-label="Note: vLLM">
  <p><b class="margin-note__term">vLLM:</b> An open-source engine for serving large language models.</p>
</aside>
```

- The aside comes **right after the paragraph** it annotates (source order = reading order).
- **≥ 64rem:** it sits at C beside its paragraph (`grid-auto-flow: row dense` in `.passage__inner` or the case grid puts it in that row), `align-self: start`, `--ink-annot` colour, small print.
- **< 64rem:** `margin-note.js` (`initMarginNotes(root) → destroy()`) turns each aside into a toggle: it inserts `<button class="margin-note__toggle" type="button" aria-expanded="false" aria-controls="note-vllm-body">Note: vLLM</button>` and wraps the content in `<div class="margin-note__body" id="note-vllm-body" hidden>`. Tap opens it inline, right after its paragraph. It re-lays on resize across 64rem. No hover behaviour anywhere.
- **No JS:** the aside shows inline after the paragraph, always open.

### 4.6 Photo byline (CSS: system; markup and image file: home; home page only)

```html
<figure class="byline on-a">
  <img class="byline__photo" src="/assets/img/qijin-xu.jpg" width="480" height="640"
       alt="Qijin (Jack) Xu, head and shoulders" loading="lazy" decoding="async">
  <figcaption class="byline__caption t-small">Qijin (Jack) Xu · Toronto, Canada</figcaption>
</figure>
```

- **Treatment:** straight edges (no radius, frame, border, shadow, mask or mist fade), author-photo scale: `width: min(100%, 13.5rem)` on desktop, `9.5rem` on phones. Ink-neutral: `filter: grayscale(1) contrast(1.04); mix-blend-mode: multiply` so the wall becomes the paper and the red shirt can't fight the seal. No motion, no hover, no reveal. Forced colours: no blend.
- **Placement:** the photo at A, the "In brief" heading and bio at B (asymmetric, never 50/50); on phones the photo and caption first, then the bio full width. Never in the hero, never floating text around it.
- **The file:** `assets/img/qijin-xu.jpg`, 480×640 (3:4), JPEG ≈ quality 80, ≤ 80 KB, **no metadata** (re-encode from `public/images/selfie.jpg` with `sips`; verify with `mdls` that no GPS/camera fields exist). A reshoot replaces this one file; nothing else changes.
- **Search:** Person `image` (COPY 8.2) points to the absolute URL of this file; `robots.txt` must not disallow `/assets/img/`.

### 4.7 Footer: scroll map and "Still the landscape" (system: `_template.html` `@shared:bottom`, `assets/js/scroll-map.js`, `assets/js/still.js`; strip art: engine's `stripSVG()`)

```html
<footer class="site-footer">   <!-- keeps today's ground mist (.site-footer::before); no veil box -->
  <nav class="scroll-map" aria-label="All pages">
    <div class="scroll-map__art" aria-hidden="true"></div>
    <ol class="scroll-map__list" role="list">
      <li><a class="brush" href="/">Home</a></li> <li><a class="brush" href="/work/">Work</a></li>
      <li><a class="brush" href="/about/">About</a></li> <li><a class="brush" href="/writing/">Writing</a></li>
      <li><a class="brush" href="/resume/">Résumé</a></li> <li><a class="brush" href="/contact/">Contact</a></li>
    </ol>
  </nav>
  <p>© 2026 Qijin (Jack) Xu · Toronto, Canada</p>
  <ul class="site-footer__links" role="list">… Email · GitHub · LinkedIn · View résumé (PDF) …</ul>
  <p>Updated <time datetime="2026-10">October 2026</time> · <button class="still-toggle brush" type="button" aria-pressed="false">Still the landscape</button></p>
</footer>
```

- **Scroll map:** a 36 px strip of the whole painting, stretches 0 → 6 in six equal columns, with the six labels in a matching 6-column grid underneath (wraps to 3 × 2 below 22.5rem). Each label's hit area also covers its column of the strip (≥ 44 px tall). The current page: `aria-current="page"` (the Note: Writing `aria-current="true"`; the 404: none), its brush mark drawn, and a short ink-1 tick on the strip above it. `scroll-map.js` (`initScrollMap() → { update(), destroy() }`) fills `.scroll-map__art` with `stripSVG()` once per session (cache the string in `sessionStorage['ink:strip']`) and moves the mark on `update()`. Without JS the art is hidden and the labels remain. Hidden in print.
- **"Still the landscape":** a toggle with a constant label and `aria-pressed`. Pressed = all ambient motion stops (`landscape.setStill(true)`, §8.2; page transitions fall back to the reduced-motion form) and the brush mark stays drawn. Stored in `sessionStorage['ink:still'] = '1'`; the inline boot script adds `html.is-still` before first paint. Hidden without JS (`html:not(.js) .still-toggle { display: none }`). Reduced-motion users are already still; the button still works for them.

### 4.8 "View résumé (PDF)" link (markup: each page that offers it)

```html
<a class="brush brush--rest" href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf">View résumé (PDF)<span class="visually-hidden">, opens in a new tab</span></a>
```

On the résumé page it is the one ink button (`.ink-btn`, same attributes, no arrow). Never `download`. The router never intercepts it (`target`, `type` and the `.pdf` extension each exclude it). Where it appears: résumé actions, home closing, About's end, Contact, footer line 2 (COPY sections 0, 1.8, 2, 5, 6).

### 4.9 "In the open" (data: system; section markup and placement: work)

- **Data file** `design-demo/data/projects.json` (system creates it from COPY 3.2; served publicly, so it never names excluded repos):

```json
{
  "updated": "2026-10-08",
  "projects": [
    { "group": "early", "year": 2020, "name": "world_qlearning", "url": "https://github.com/Freedom-Jack/world_qlearning", "line": "A Q-learning agent …" },
    { "group": "early", "year": 2019, "name": "aStar-pathFinding", "url": "…", "line": "…" }
  ]
}
```

  One object per line. Fields: `group` (`"featured"` | `"early"`), `year` (number), `name` (the GitHub repo name), `url` (must start with `https://github.com/Freedom-Jack/`), `line` (Jack's words, one sentence or two, ends with a full stop, no year), optional `demo` (https URL). Adding a repo = adding one line, then running the tool.
- **Tool** `tools/sync-projects.py [--check]` (system, stdlib) validates the file (fields, URL prefix, a deny-list of repos that must never appear, no CJK, no phone pattern) and rewrites only the markup between `<!-- @data:projects -->` and `<!-- /@data:projects -->` in `work/index.html` (the work builder places the two markers inside `section#open`). Static HTML, so it reads with JS off.
- **Generated markup:** featured entries (none today, so **nothing** is rendered for them: no heading, no empty list) as `ul.index.open-index` rows: `h3.index__title > a.brush.brush--display`, `p.index__line`, `p.t-small` year (and "Live demo" link if `demo`). Early entries as `h3.section-sub` "Early work, 2019–2020" (range from the data; `.section-sub` is defined in §4.10) plus `table.table.table--quiet` (Year · Repository · What it is), newest first, then name.

### 4.10 Other shared bits (system)

- `#route-announcer`: `<p class="visually-hidden" id="route-announcer" aria-live="polite" aria-atomic="true"></p>` in `@shared:bottom`.
- `h1[tabindex="-1"]:focus { outline: none }` (focus target after a route change; keyboard focus rings elsewhere unchanged).
- `strong, b { font-weight: var(--w-strong) }`.
- `.section-sub`: a sub-heading inside a passage (h3): supporting face 700 at `--step-1`, ink-2, `margin-block: var(--rhythm-head) var(--space-s)`.
- The Person JSON-LD `<script>` in `@shared:head` gets `data-shared` and the `image` property (COPY 8.2).

---

## 5. Page boot and page modules

### 5.1 `main.js` (system) is split in two

- `bootChrome()` runs once per document: seal, nav, returning header, footer scroll map, still toggle, header/footer brush links, the first-screen arrival (+ 2.5 s safety net), the landscape mount, the router.
- `bootMain(main) → Promise<destroy>` runs for the current `<main>` on load and after every route swap: `initBrushLinks(main)`, `initInkButtons(main)`, `initMistReveal(main)`, `initDiagrams(main)`, `initMarginNotes(main)`, then the page module (§5.2), then `landscape.rebind(…)` (§8.2).
- Exports: `config` (a live getter, updated on swap), `ready` (Promise of `{ config, landscape, entrance }`, kept for compatibility), `bootMain`, `destroy()`.
- Mount options passed to the landscape: `stretch`, `distance`, `presence`, `horizon` (body `data-horizon`, default 0.6), `head`, `vistas`, `descend`, `veil`, `wake`, `still`, `arrival: 'bloom'` on a full load.

### 5.2 Page module contract (every `assets/js/pages/<page>.js`)

- **Declaration:** in PAGE ASSETS, `<script type="module" src="/assets/js/pages/<page>.js" data-page-module></script>`. Pages with no behaviour have no module and no tag (a missing module must never be requested: a 404 is a console error).
- **Shape:** no side effects at import (no DOM, `window` or `sessionStorage` access at module top level, no auto-run):

```js
export default {
  /** Bind behaviour inside `main`. Idempotent. */
  init({ main, config, landscape, signal }) { … },   // landscape: Promise<handle|null>; signal: AbortSignal
  /** Undo everything init() did. Safe to call twice. */
  destroy() { … },
};
```

- **Rules:** register listeners with `{ signal }` (aborted right after `destroy()`) or remove them in `destroy()`; never keep references to an old `<main>`; never call `landscape.panTo()`, `destroy()`, `pause()` or `setState()`; never import `main.js` (use `ctx`); no module-level "bound" flags that survive `destroy()`.
- Page CSS stays `<link rel="stylesheet" href="/assets/css/pages/<page>.css" data-page-style>` (add `data-page-style`). The router swaps it (§6.3); pages need no CSS scoping in the demo.

---

## 6. Router contract (demo only)

The demo previews the Next.js behaviour: one document, the canvas persists, content swaps. File: `assets/js/router.js` (system), started by `bootChrome()`.

### 6.1 What it intercepts

A primary-button click (no Ctrl/Meta/Shift/Alt) on an `a[href]` whose URL is same-origin, `http(s)`, with no `target` (or `_self`), no `download`, no `type`, no `rel~="external"`, no `data-router="off"`, and a path with no file extension (so `/resume.pdf`, `/resume.json`, `/llms.txt` load normally). Same path with only a different hash: not intercepted (the browser scrolls). Same path and no hash: scroll to top, no fetch. Everything else (`mailto:`, external, new tab) is untouched.

### 6.2 Forward navigation, step by step

| t (ms) | Step |
|---|---|
| 0 | `preventDefault()`. Abort any navigation in flight (an `AbortController` per navigation). Start the fetch (or use the prefetch). Start the exit (§7). |
| pointerenter / focus / pointerdown (earlier) | Prefetch: `fetch(url, { signal })` of the HTML and of its page stylesheet's text; cache per URL (`Map`, 30 s; reused by back/forward). |
| when the HTML arrives (typically < 50) | Parse with `DOMParser`. Validate: `main#main` exists and `body[data-page]` exists. Read the destination's `data-stretch`, `-distance`, `-presence`, `-horizon`. Call `landscape.panTo(…)` and the sweep (§7). Build the new page stylesheet: `new CSSStyleSheet({ baseURL })` + `replaceSync(cssText)`. Start `import()` of the new page module. |
| 160 (exit done; or when the HTML arrives, if later) | **Swap, in one synchronous task:** 1) current page module `destroy()`, abort its signal, run the old `bootMain` destroy; 2) replace `main#main` with the imported new `<main>`; 3) copy every `data-*` attribute of the new `<body>` onto `<body>` (remove ones it lacks); 4) swap head items (§6.3); 5) replace the page stylesheet (§6.3); 6) `history.pushState(state, '', url)` (after `replaceState` stored the old entry's `scrollY`); 7) scroll (§6.5); 8) `nav.update()`, `scrollMap.update()`, `header.reset()`. |
| 160 | `bootMain(newMain)`; the enter animation starts (§7); focus and announce (§6.4). |
| > 3000 without a swap | Fallback (§6.6). |

### 6.3 What is swapped

- `<main id="main">` (whole element). The header, footer, canvases, ink filters and announcer persist.
- `<body>` `data-*` attributes (`data-page`, `-stretch`, `-distance`, `-presence`, `-horizon`).
- Head: `title`, `meta[name="description"]`, `meta[name="robots"]`, `link[rel="canonical"]`, `link[rel="alternate"]`, every `meta[property^="og:"]`, every `script[type="application/ld+json"]:not([data-shared])`. Removed when the new page lacks them.
- Page CSS: the initial `link[data-page-style]` is removed at the first swap; afterwards exactly one adopted page sheet is in `document.adoptedStyleSheets` (appended after the document sheets, so the cascade order matches a full load). Old and new page sheets are never active at once, so bare page selectors cannot collide.
- Page module: `link`/`script[data-page-module]` of the new document → `import(src)` → `default.init(ctx)`.
- Never swapped: shared head (fonts, tokens, `main.js`, preloads, the Person JSON-LD), `@shared:top`, `@shared:bottom`.

### 6.4 Focus and announce

After the swap, the new `h1` gets `tabindex="-1"` (if it has none) and `focus({ preventScroll: true })`. For a URL with a hash, focus goes to the target element instead (`tabindex="-1"` if needed). 50 ms later `#route-announcer` is emptied, then set to `document.title`. `html.is-routed` is added at the first swap and kept (it turns off per-element `data-arrive` animations for swapped content, §7.3).

### 6.5 Scroll

`history.scrollRestoration = 'manual'` while the router is on. Every entry's state is `{ key, y }`; `y` is refreshed with `replaceState` on `pagehide` and before each push. On a push: `scrollTo({ top: 0, behavior: 'instant' })`, or the hash target's top minus `scroll-padding-top`. On popstate: after the swap, `scrollTo({ top: state.y, behavior: 'instant' })` on the next frame **before** `bootMain`, so reveals see the final position (`reached()` settles everything above it). Never smooth-scroll a route change (some page CSS sets `scroll-behavior: smooth`).

### 6.6 Back/forward and fallback

- **popstate** to another path: no exit, no enter, no sweep: the content swaps at once from the cache (or a fetch), the scroll is restored, focus moves to the h1, the title is announced. The landscape pans back over `--dur-route-back-pan` (400 ms, cubic-out) behind content that is already readable; reduced motion or "Still": it cuts. popstate within the same path (hash only): ignored.
- **Fallback to a normal navigation** (`location.assign(url)`; on popstate `location.reload()`): fetch error or non-OK status other than 404 (the designed 404 page is swapped in like any page), parse failure, no `main#main`, no `body[data-page]`, any exception during the swap, or no swap after 3 s.
- **Off switch (QA):** `?router=off` sets `sessionStorage['ink:router']='off'` (`?router=on` clears it). Also off when `fetch`, `DOMParser`, `history.pushState` or `CSSStyleSheet.prototype.replaceSync` is missing.

### 6.7 Events (on `document`, for QA and future modules)

`route:start` `{ from, to, kind: 'push'|'pop' }` · `route:swap` `{ from, to }` (after the DOM swap, before `bootMain`) · `route:end` `{ to, readyAt }` (after the enter finished) · `route:fallback` `{ to, reason }`.

---

## 7. Transition contract

Retire the flood. **The painting's sideways pan is the transition**, with a pale mist sweep. File: `assets/js/transition.js` (system), called by the router: `exit({ dir }) → Promise`, `enter(main, { dir }) → Promise`, `variant()`.

### 7.1 Timings (forward, default "mist")

Tokens (system, `tokens.css`): `--dur-route-exit: 160ms; --dur-route-enter: 260ms; --route-step: 50ms; --route-shift: 16px; --route-blur: 3px; --dur-route-pan: 600ms; --dur-route-sweep: 420ms; --dur-route-back-pan: 400ms; --dur-route-reduced: 150ms; --dur-header: 220ms`.

| t (ms) | What happens |
|---|---|
| 0 | The pressed control gives its own press feedback (rings / brush). The old `<main>` sinks into mist: opacity 1 → 0 over 160 ms (`cubic-bezier(.5,0,.75,0)`), moving `--route-shift` against the travel; only the old h1 also blurs to 3 px. `pointer-events: none` on it. Header and footer stay still. |
| ≤ 50 | `landscape.panTo(dest, { duration: 600, ease: 'cubic-out', distance, presence })` and `landscape.sweep({ dir, duration: 420 })`. `dir` = sign(destStretch − currentStretch) (1 = travel right, the scenery slides left). |
| 160 | Swap (§6.2). New content condenses in: the new h1 from opacity 0, 3 px blur and `--route-shift` along the travel to rest over 260 ms (`--ease-ink`); every other top-level block of the new `<main>` together, `--route-step` (50 ms) later, opacity and shift only (no blur). |
| ≈ 350 | **Readable** (h1 and lead above 90 % opacity). |
| ≈ 470 | Text settled. |
| ≤ 650 | Landscape settled; sweep gone. **No dark frame at any time; the cursor never shows "busy".** |

The mist sweep (engine, §8.2): a pale bank moving in the travel direction, never darker than mist-2 `#D5DCD9`, densest around 160–240 ms (over the seam). For jumps of more than 2 stretches it thickens to hide the middle of the pan, so five scenes never whip past.

### 7.2 Variant: thin wet edge (`?transition=edge`)

`?transition=edge` (or `mist`) is stored in `sessionStorage['ink:transition']`, so it survives router navigations. Same exit, enter, pan and timings, but no sweep: a single vertical wet edge (≤ 20 % of the viewport width, alpha ≤ 0.6, pale indigo wash with a darker tide line at its leading side) crosses the viewport in the travel direction over 450 ms (`--ease-in-out`), drawn on the existing `.ink-wash` canvas (`pointer-events: none` always; ≤ 4 ms CPU per frame, paint only the band). It never covers text at full opacity. The pigment noise may be copied from `ink-transition.js`, which is then no longer imported.

### 7.3 Other cases

- **First load and deep links:** today's arrival (name legible by ~400 ms, bloom ~1.2 s). No router involvement.
- **Swapped content and `data-arrive`:** under `html.is-routed`, `[data-arrive]` and `[data-arrive] > *` have no animation and `[data-arrive="name"]` no filter (the route enter replaces them).
- **Reduced motion or "Still":** a 150 ms cross-fade (exit 60 ms, enter 90 ms, opacity only); no pan (the landscape cuts at the swap), no sweep, no edge.
- **Back/forward:** instant content, 400 ms pan (§6.6).
- **Full-document navigations** (fallback, typed URL, reload): `@view-transition { navigation: auto; }` stays inline with the default 260 ms root cross-fade; every `ink`-type rule is removed.

---

## 8. Landscape API additions (engine)

Keep the existing contract of `mountLandscape()` and its handle. **Add only.** Land no-op stubs of every new method and option first (resolved promises, empty SVG string), so system and pages can call them on day one.

### 8.1 New mount options

| Option | Type | Meaning |
|---|---|---|
| `head` | `Element` | The page head (`[data-landscape="head"]`). While it is on screen the landscape shows the page's full scene (state `hero`). |
| `vistas` | `Iterable<Element>` | `[data-vista]` passages (§3.4). |
| `wake` | `Iterable<Element>` | `[data-wake]` regions where the mouse wake is allowed. |
| `horizon` | `number` 0..1 | Presence in the horizon state (body `data-horizon`, default 0.6). |
| `still` | `boolean` | Start stilled (§8.2 `setStill`). |
| `descend`, `veil` | (existing) | Unchanged. `banks` is ignored from now on (no page passes it). |

### 8.2 New handle methods

```ts
rebind(o: { head?, vistas?, descend?, veil?, wake?, horizon? }): void   // after a route swap; re-reads geometry
panTo(stretch, o?: { duration?, distance?, presence?, ease?: 'whip' | 'cubic-out' }): Promise<void>
                                                                         // `ease` added; default stays 'whip'
sweep(o?: { dir?: 1 | -1, duration?: number /* 420 */ }): Promise<void> // the pale mist bank of a page change
setStill(on: boolean): void      // ambient drift, wake, sweeps, bloom and pans off (pans and state blends snap);
                                 // scroll-driven states and veils still update, without animation
setState(s: 'hero' | 'horizon' | 'vista' | 'closing' | null): void       // QA/lab override; null = scroll-driven
```

Exports from `landscape/index.js` (DOM-free, usable without mounting): `stripSVG(o)` (re-exported from a new `landscape/strip.js`) and `sceneAt(stretch) → string`. `stats()` adds `state`, `stateK`, `scene`, `wake`, `still`. The veil limit rises from 4 to at least 6 blocks. `pause()`/`resume()` keep their meaning (a hard freeze, used for hidden tabs); the footer control uses `setStill`, because a frozen frame would stop the veils following the text.

### 8.3 States (scroll-driven, read from the elements above)

| State | When | What you see | Cost |
|---|---|---|---|
| `hero` | The head's bottom edge is below 35 % of the viewport | The page's full scene at its presence (home at scroll 0 = today's frame, pixel for pixel) | as today |
| `horizon` | Blend `k = smoothstep` as the head's bottom goes from 100 % to 35 % of the viewport | Ridges sink so their crests sit in the bottom 25 % of the viewport (20 % on portrait); presence = `horizon`. Targets: no ridge ink above 70 % of the viewport height on desktop; 8–12 % of pixels not paper. **No lift into a cloud sea.** | Re-rendered during the blend (governed drafts), then still: present-pass only while scrolling |
| `vista` | A `[data-vista]` crosses the viewport: `k = 1 − smoothstep(0, .5, |centre − .5 vh| / vh)` | The horizon rises back to the full scene; mist parts; the wake is strongest | one scene redraw while blending |
| `closing` | Home only, `[data-landscape-descend]`: as today | Descends back to the head composition, then sinks a little so the near crest rises above the footer | as today |

Reduced motion: static scene in `hero`, static horizon below it (no blends; it switches once the head has gone), static scene inside a vista.

### 8.4 Scenes per stretch

| Stretch | Page | Scene (`sceneAt`) | This round |
|---|---|---|---|
| 0 | Home | `peak` | **Unchanged** (frozen hero). No falls this round. |
| 1 | Work | `river` | Optional: rapids and terraced slopes only if they look genuinely good beside today's composition; otherwise today's stretch 1 under the name `river`. |
| 2 | About | `path` | Today's stretch 2. |
| 3 | Writing, Note | `lake` | **New.** Wide reserved water and sky: below the waterline ≥ 55 % of the scene is reserved paper; a faint mirrored ridge (y′ = 2·waterY − y) at ≤ 35 % of its source's ink, broken by a few horizontal ripple gaps; the palest boneless wash on the site; the waterline dissolves into mist (no hard horizontal line); the seam to the shore is a shoreline. |
| 4 | Résumé | `shore` | Today's stretch 4. |
| 5 | Contact | `crossing` | **New.** Open water in the near and middle distance (reserved paper with sparse long, low washes); a far shore at 62–70 % down a desktop viewport whose summit silhouette echoes stretch 0's host peak at 35–50 % scale and the palest ink; the seam to the 404 is mist. Contact moves to `data-distance="level"`. |
| 6 | 404 | `lone-peak` | Today's stretch 6. |

Seams stay continuous: a pan always crosses water or mist, never a cut. No sails, roofs, people or other figurative traces.

### 8.5 Mouse wake

Fine pointers only, never touch, never under reduced motion or "Still". Allowed only inside a `[data-wake]` rect (home hero, vistas, Contact's section, the 404's section) and multiplied by (1 − veil), so it never touches text. Response: half-strength radius ≈ 0.24 vh (≈ 215 px at 900), position lag ≈ 50 ms, strength attack 120 ms and release 700 ms; the mist is dragged along the pointer's velocity and the wake closes over 600–800 ms. Acceptance (mean |ΔL| over a 60 px disc, pointer there vs away): ≥ 6/255 over mid ink, ≥ 3/255 over sky, ≤ 0.5/255 under veiled text. Present pass only (≤ 0.2 ms CPU per frame).

### 8.6 Strip for the footer

`stripSVG({ from = 0, to = 6, width = 600, height = 36 }) → string`: inline SVG markup (`viewBox="0 0 {width} {height}"`, `preserveAspectRatio="none"`, `aria-hidden="true"`, `focusable="false"`), three planes of silhouettes sampled from the same world ridges and scene presets (the lake and crossing as water lines with their far shores), equal width per stretch. Colours as CSS variables with fallbacks: `var(--strip-far, #B9C2C4)`, `var(--strip-mid, #7B8385)`, `var(--strip-near, #434C50)`, water `var(--strip-water, #B9C2C4)`. ≤ 10 KB, coordinates rounded to 0.1, deterministic (same string every call).

### 8.7 Budgets

No new per-frame CPU above 1 ms on desktop; horizon frames are present-only; context loss still falls back to Canvas2D (which shows the states as static frames, with no wake or sweep); `destroy()` removes every new listener.

---

## 9. Per-page structure

Stretch · scene · distance · presence · horizon go on `<body>` as `data-stretch`, (scene is implied by the stretch), `data-distance`, `data-presence`, `data-horizon`. Every page head carries `data-landscape="head"`. Words: the COPY section named in each row.

### 9.1 Home `/` (owner: home) · stretch 0 · `peak` · level · presence 1 · horizon 0.6

| # | Section | Markup | Tier and motion | Landscape | COPY |
|---|---|---|---|---|---|
| 0 | Hero | **Unchanged** `section.screen.hero`; add only `data-landscape="head" data-wake` | name main (arrival) | `hero`, wake on | 1.1 |
| 1 | Statement | `section.passage.passage--lead`: h2 `.t-main.on-ab` with the cinnabar full stop (`data-reveal="bloom"`), the line `.on-b` at `--step-2` | main + body | → `horizon` | 1.2 |
| 2 | Selected work | `section.passage.passage--index`: h2 `.section-title.on-a`, `ol.ledger.on-abc` (6 rows, §4.2), foot note, "All case studies" | supporting + small print | horizon | 1.3 |
| 3 | How I build | `section.passage.passage--figure`: h2 `.section-title.on-a`, `figure.diagram.on-abc` (§4.4) | diagram = this screen's main object; strokes draw | horizon | 1.4 |
| 4 | Vista | `div.passage.passage--vista` (§3.4) | none | `vista`, wake on | 1.5 |
| 5 | In brief | `section.passage.passage--reading`: `figure.byline.on-a` (§4.6); h2 `.section-title.on-b` + bio `.on-b` at `--step-1` + "More about me" | body; no motion | horizon | 1.6 |
| 6 | Latest writing | `section.passage.passage--index`: h2 `.section-title.on-a`; at B: kind · date (small print), title (h3 link, `.index__title`), description; "All writing" | supporting + small print | horizon | 1.7 |
| 7 | Closing | `section.passage.passage--closing[data-landscape-descend]`: h2 `.t-main` (bloom), line, links (GitHub · LinkedIn · View résumé (PDF)) | main | `closing` (bookend) | 1.8 |

About 5.5–6 viewports at 1440×900. No Now block, no "In the open" on home, no `data-mist-bank`. Home needs no page module unless the builder adds one.

### 9.2 Work `/work/` (owner: work) · stretch 1 · `river` · deep · presence .8 · horizon .55

| # | Section | Markup and notes | COPY |
|---|---|---|---|
| 0 | Head | `header.page-head[data-landscape="head"]`: h1 "Work" + intro (arrival). No case index beside it. | 3 header |
| 1 | At a glance | `section.passage.passage--index`: the table (§4.3), `.on-abc`, newest first | 3.1 |
| 2 | Flagship 1 | `article#rag-assistant.passage.case.case--flagship`: meta (small) → h2 title (`.t-main`, bloom) → summary → `figure.diagram` → `dl` Context · What I did · Stack · Outcome (figure "About 90%" at C, fade) · Evidence (small print). Labels at A, text at B. Margin notes (§4.5) after the paragraph that first uses each term. | Case 1 |
| 3 | Flagship 2 | `article#proprietary-language-agent…`, same anatomy | Case 2 |
| 4 | Vista | §3.4 (`data-vista data-wake`) | — |
| 5 | More work | `section.passage` with h2 "More work", then four `article.case.case--compact` with h3 titles (supporting), anchors `#fraud-model`, `#data-operations`, `#insurance-data-platform`, `#hockey-vision`; same five labels and words, compact type, figure at C; no diagram, no notes | 3 "More work", Cases 3–6 |
| 6 | In the open | `section#open.passage`: h2, intro, `<!-- @data:projects -->…<!-- /@data:projects -->` (§4.9), "All repositories on GitHub" | 3.2 |
| 7 | End | `.passage--end`: one ink button "Read the résumé" | 3.3 |

Remove `case-index`, `case-bar` and the sticky behaviour; `pages/work.js` is deleted or reduced to a default-export module if anything remains. Each case is an `<article>` with its own `id` and heading; the CollectionPage JSON-LD stays as it is.

### 9.3 About `/about/` (owner: about-writing) · stretch 2 · `path` · high · presence .8 · horizon .55

| # | Section | Markup and notes | COPY |
|---|---|---|---|
| 0 | Head | `header.page-head[data-landscape="head"]`, h1 + lead (arrival) | 2 header |
| 1 | Bio | `section.passage.passage--reading`: paragraphs at B (`--measure`), first paragraph's run-in kept; no motion | 2 bio |
| 2 | The path so far | `section#experience.passage` (timeline CSS lives in `about.css`): h2 + intro; `ol.timeline` of five `li.timeline__entry#path-YYYY`, each: year at A (`.t-figure`, `aria-hidden`, fade), then at B: h3 chapter line (supporting), dates · place (small print, `<time>`), title and organisation, details list (body), sources (small links). A thin vertical brush path joins the years at A (`svg[data-draw]`, one stroke, draws as the section is reached). Newest first. No pin, no sideways motion, no year nav. | 2 experience |
| 3 | Vista | §3.4 | — |
| 4 | What I work with | `section.passage`: five groups: name (h3, supporting) at A, line at B, tools at B–C (plain comma lines, never pills) | 2 skills |
| 5 | Education and credentials | `section.passage`: four entries, small print details | 2 education |
| 6 | End | `.passage--end`: "Read the résumé" ink button + "View résumé (PDF)" link | 2 end |

No photo on About. ProfilePage `dateModified` 2026-10-08. `pages/about.js` is deleted (nothing needs JS); `about.css` loses the handscroll rules.

### 9.4 Writing `/writing/` (owner: about-writing) · stretch 3 · `lake` · level · presence .6 · horizon .5

Head (h1 "Writing" + intro, arrival, `data-landscape="head"`), then one `section.passage.passage--index` with `ul.index.posts`: per entry, kind · date at A (small print), title (h2 `.index__title`, link) and description at B. One entry today. No vista (short page), no wake. **Writing is no longer in the header nav** (system removes it from `_template.html`; `sync-shared.py` stops marking it). COPY 4.1.

### 9.5 Note `/writing/what-is-an-ai-agent/` (owner: about-writing) · stretch 3 · `lake` · level · presence .45 · horizon .35

- New folder `writing/what-is-an-ai-agent/index.html`, `data-page="article"` (keeps `pages/article.css`/`.js`, converted to the module contract).
- Head: h1 (main), byline "Qijin (Jack) Xu · Note · April 20, 2025" (name links to `/about/`), `data-landscape="head"`.
- Body: the finished sections only, word for word (COPY 4.2), in `.prose` at B with the reading progress stroke. **No contents nav** (three headings), no outline set, no empty headings, no `<hr>`.
- End: the author's seal colophon (stamped once), the author line, "More about Jack" ink button, "All writing".
- Head metadata: COPY 8.1 (Note row), `og:type` article, BlogPosting COPY 8.5.
- **Redirect stub** `writing/building-modular-ai-agents/index.html` (COPY 4.3): a minimal standalone page (no shared blocks): `<meta http-equiv="refresh" content="0; url=/writing/what-is-an-ai-agent/">`, `<link rel="canonical" href="https://my-website-freedomjack.vercel.app/writing/what-is-an-ai-agent/">`, `<meta name="robots" content="noindex">`, an inline `location.replace(...)`, and the visible line with its link. `sync-shared.py` skips any file with a meta refresh (system).

### 9.6 Résumé `/resume/` (owner: resume-contact) · stretch 4 · `shore` · level · presence .45 · horizon .35

Unchanged structure (letterhead, summary, experience, skills, education, certifications), with:
- Actions: "View résumé (PDF)" as the one ink button (§4.8), "JSON Resume" link, the new note line (COPY 5). The print button and its handler go; `pages/resume.js` keeps only the "settle everything before print" behaviour, as a default-export module.
- In the contact list, exactly one comment where a phone line would go, with no digits: `<!-- No phone line: Jack decided 2026-10-09 that the public résumé and PDF stay phone-free. -->`.
- Year figures in the margin: fade instead of ink-in. Small print measured against §2.5.
- `@media print` remains the source of the PDF: two pages on Letter and A4, ink only, no landscape, header, footer, scroll map or actions.
- `resume.pdf`: built by `python3 tools/build-pdf.py` (system tool) once the print CSS is final; rebuilt after any résumé change.

### 9.7 Contact `/contact/` (owner: resume-contact) · stretch 5 · `crossing` · **level** (was high) · presence .9

One screen (`section.screen.contact`, add `data-landscape="head" data-wake`). Unchanged except: the Résumé row (COPY 6) after LinkedIn with the PDF link; `data-distance="level"`. The address stays the one main element. `pages/contact.js` becomes a default-export module.

### 9.8 404 (owner: resume-contact) · stretch 6 · `lone-peak` · deep · presence 1

Unchanged content (COPY 7); add `data-landscape="head" data-wake` on its section. The footer scroll map (shared) is the way back; nothing is current. Its full stop stays cinnabar.

---

## 10. File ownership, coordination and phases

### 10.1 Ownership (each file has exactly one writer)

| Owner | Files |
|---|---|
| **engine** | `assets/js/landscape/**` (incl. new `strip.js`), `_lab/**` |
| **system** | `assets/css/tokens.css`, `base.css`, `layout.css`, `effects.css`, new `components.css`; every `assets/js/*.js` outside `pages/` and `landscape/` (`main.js`, `nav.js`, `mist-reveal.js`, `brush-link.js`, `ink-button.js`, `arrival.js`, `seal.js`, `demo.js`, `ink-figures.js`, `ink-transition.js`, new `router.js`, `transition.js`, `header.js`, `scroll-map.js`, `still.js`, `diagram.js`, `margin-note.js`); `assets/svg/**`; `_template.html` and therefore every `@shared:*` block in every page; `tools/**` (`sync-shared.py`, new `sync-projects.py`, `build-pdf.py`); `_tools/**`; `README.md`; `data/projects.json` (schema and contents) |
| **home** | `index.html` (outside the shared blocks), `assets/css/pages/home.css`, `assets/js/pages/home.js` (if any), `assets/img/**` |
| **work** | `work/**` (outside the shared blocks and the `@data:projects` block), `assets/css/pages/work.css`, `assets/js/pages/work.js` |
| **about-writing** | `about/**`, `writing/**` (incl. the new Note folder and the redirect stub), `assets/css/pages/about.css`, `writing.css`, `article.css`, `assets/js/pages/about.js`, `writing.js`, `article.js` |
| **resume-contact** | `resume/**`, `contact/**`, `404.html`, `resume.json`, `llms.txt`, `sitemap.xml`, `robots.txt`, `resume.pdf`, `assets/css/pages/resume.css`, `contact.css`, `not-found.css`, `assets/js/pages/resume.js`, `contact.js` |
| **design lead** | `COPY.md`, `SPEC-R3.md` (builders read only) |
| nobody | `_studies/**`, everything outside `design-demo/` |

### 10.2 Coordination rules

- **Shared blocks:** only system edits `_template.html`. Page owners never hand-edit `@shared:*` or `@data:*` blocks. System adds `python3 tools/sync-shared.py --only <file>…` so a page owner can resync **their own** files; only system runs the full sync, at the start (phase 0) and at the end (phase 3).
- **Re-read before editing.** A shared-block sync can rewrite your file between your read and your edit; if an edit fails as stale, re-read and redo it. Never overwrite a whole page file you did not just read.
- **Missing pieces:** if your page needs a shared class, token or API that is not there yet, write the markup exactly as specified, use `var(--token, value)` fallbacks, and list the gap in your report. Never create shared CSS/JS in your own files, and never edit another owner's file.
- **Page CSS** may lay out its own sections and tune spacing with tokens. No new colours, fonts, weights, shadows or motion outside §2.3.
- **Words** only from COPY.md. Any gap: leave it out and report it.

### 10.3 Phases

| Phase | Who | Deliverable |
|---|---|---|
| 0 (first) | engine | No-op stubs of every new option and method (§8), so calls never throw |
| 0 (first) | system | Tokens (§2.1, §3.2, §7.1), `components.css` with all component classes, `_template.html` (nav without Writing, footer scroll map + still toggle, announcer, `data-shared` + `image` on Person JSON-LD), `main.js` split with the page-module loader, `sync-shared.py --only` and stub-skip; one full sync |
| 1 | home, work, about-writing, resume-contact | Pages built to §9 against the contracts; page modules converted to default exports |
| 1 | engine | States, wake, `lake`, `crossing`, `stripSVG`, `setStill`, `sweep`, `rebind`, `ease` |
| 1 | system | `header.js`, `diagram.js`, `margin-note.js`, `scroll-map.js`, `still.js`, `mist-reveal` variants, `data/projects.json` + `sync-projects.py`, `build-pdf.py` |
| 2 | system | `router.js` + `transition.js` (mist and edge) |
| 3 | system + lead | Full sync, `README.md` updated to these contracts, global QA (§11) |

---

## 11. QA and acceptance

### 11.1 Every builder, on their own pages

```sh
S=<scratchpad>
python3 $S/bin/cdp.py '[{"viewport":[1440,900,1,false]},{"goto":"http://localhost:4173/work/"},{"wait":2600},{"shot":"'$S'/shots/<you>/work-1440.png"},{"console":true}]'
python3 $S/bin/cdp.py '[{"viewport":[390,844,3,true]},{"goto":"http://localhost:4173/work/"},{"wait":2600},{"shot":"'$S'/shots/<you>/work-390-full.png","full":true}]'
```

- 1440×900 and 390×844 DPR 3 (320 px for anything in the header or footer); full-page shots and scrolled viewports. **Open and judge every image.**
- Reduced motion (`{"reduced_motion":true}`), no WebGL (`CDP_ARGS="--disable-3d-apis"`), no JS (`CDP_ARGS="--blink-settings=scriptEnabled=false"`), print where relevant (`{"media":"print"}`).
- Zero console errors (the "GPU stall due to ReadPixels" warnings are screenshot readback, not the site).
- `python3 $S/linkcheck.py` passes; `python3 $S/compliance.py` passes except the two expected round-3 items the lead will allow-list (the `/resume.pdf` links and the one `<img>` on home).
- One main element per screen at most; density target (§3.2); every figure and source visible at rest on a phone; no text blurred or hidden at rest; small print contrast per §2.5; no horizontal scroll at 320–1440.
- Tier audit (system ships a `{"eval"}` snippet in README): no Commissioner weight outside {400, 560, 700} except the frozen hero, header and `.ink-btn`; no `data-reveal` on `p`, `li`, `dd`, `figcaption` or small print.

### 11.2 The hero is pixel-identical (home, system and engine must all pass this)

```sh
python3 $S/bin/cdp.py '[{"viewport":[1440,900,1,false]},{"reduced_motion":true},{"goto":"http://localhost:4173/"},{"wait":2500},{"shot":"'$S'/shots/<you>/hero-1440-rm.png"}]'
python3 $S/bin/pngdiff.py $S/shots/spec-lead/baseline-hero-1440-rm.png $S/shots/<you>/hero-1440-rm.png --top 96
python3 $S/bin/cdp.py '[{"viewport":[390,844,3,true]},{"reduced_motion":true},{"goto":"http://localhost:4173/"},{"wait":2500},{"shot":"'$S'/shots/<you>/hero-390-rm.png"}]'
python3 $S/bin/pngdiff.py $S/shots/spec-lead/baseline-hero-390-rm.png $S/shots/<you>/hero-390-rm.png --top 216
```

Pass: ≤ 0.5 % of pixels below the header differ by more than 8/255 (two baseline runs differ by 0.000 % at 1440 and 0.002 % at 390). `--top` skips the header band, where only "Writing" disappears.

### 11.3 Router and transition (system)

- Burst every 50 ms from the click (`{"burst":…,"every":50,"count":16}`): no frame darker than the paper and mist; old text gone by ~160 ms; new h1 readable by ~350 ms; text settled by ~470 ms; `landscape.stats().stretch` at its destination by ~650 ms. Same with `?transition=edge`.
- Back/forward: content readable in the first frame after popstate; scroll position restored exactly; focus on the h1 (`document.activeElement`); `#route-announcer` holds the new title.
- Cross-page anchors (`/work/#hockey-vision` from home) land on the heading under the header. `/resume.pdf` opens a new tab; `/resume.json` and `mailto:` are untouched.
- Every page module's `destroy()` leaves no listeners (navigate A → B → A → B five times: no duplicate behaviour, no errors). `?router=off` gives plain navigations.
- Reduced motion and "Still": 150 ms cross-fade, landscape cuts.

### 11.4 Landscape (engine)

Lab pages in `_lab/landscape/` for: each state (`setState`), the lake and crossing scenes, the sweep, the wake measurement (§8.5 acceptance), `stripSVG()` output. Shots at 1440 and 390 of `/writing/` and `/contact/` show the new scenes. No-WebGL fallback shows the states statically.

---

## 12. Open items

**For Jack** (also listed in COPY.md section 10):
1. **Phone number** (10.8): still pending. The PDF is printed from the public page, so a phone in the PDF also sits in the page's HTML. Recommendation: keep the public PDF phone-free and add the number only to copies you send.
2. **The Note's title** (10.9): "What is an AI agent?" (your own words from the piece) replaces "Building Modular AI Agents with Python and LLMs", and the URL moves to match. Keep it? May we fix the eight typos?
3. **Home short bio** (10.10): 56 words written only from your About facts. Approve or rewrite.
4. **Photo**: the current selfie, shown in grey at author size on home only; alt "Qijin (Jack) Xu, head and shoulders", caption "Qijin (Jack) Xu · Toronto, Canada". Reshoot when ready (one file swap).
5. **Glossary notes on Work** (10.11): six public definitions (RAG, LangChain, LangGraph, vLLM, EBNF, PII). Keep or drop.
6. **Who the closing is for** (10.12): hiring, speaking, collaboration, or consulting while at CGI?
7. **Writing intro** (10.13): "I write when I’ve learned something worth passing on." Keep, rewrite or drop.
8. **Back/forward**: content is instant and the painting pans back in 400 ms. Prefer a hard cut?
9. Still open from earlier: graduation dates (10.1), the LinkedIn URL (10.2), certification verification links (10.4), `ai-stock-insight` (10.6). Launch gates: purge the old PDF from `my-website` (or launch from a fresh repo) and make `job-application` private.

**For the lead (not Jack):**
- `compliance.py` needs a round-3 allow-list: links to exactly `/resume.pdf` and one `<img>` (home, `/assets/img/qijin-xu.jpg`); keep failing on any other `.pdf` or image.
- Re-run `linkcheck.py` after the Note moves: nothing may link the old article URL except the redirect stub's own canonical.
- After phase 3, update the README's port table: `router.js` → Next.js client navigation; `transition.js` → `<ViewTransition>` in each `page.tsx` plus `panTo`/`sweep` from the route change; the page-module contract → client components with `useEffect`.
