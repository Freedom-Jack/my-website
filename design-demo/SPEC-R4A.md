# SPEC-R4A: demo 4a build spec

Design lead, 9 October 2026 (with Jack's answers of 10 October). **Binding for the 4a builders: engine, system, home, work, resume, misc.**

*Revision 2 (same day): the section margins now match the measured wireframe (§2.2); the photo recipe flattens the uneven wall before the lift (§9.2); the horizon handover has its own engine contract (§12.6); "In the open" overrides carry a `year` (§13.6); the Note's typo fixes and `dateModified` (§10.6); the compact cases' label order (§9.9); Jack's 10 October answers closed four open items (§16); and COPY.md is now draft 3 (round 4a), so every section reference here resolves.*

*Revision 3 (10 October, integration): this file now records 4a as built. Folded in: the builders' measured deviations (section margins 42 / 52 / 58, sparse rail placement, the footer's `ul` and `.site-footer__base`, `span.next__to`, the photo's mask and the photo tool's defaults, "Show details" while closed on wider screens); the integration fixes (one shared 44 px hit area, figures capped at 26 px, a low title block in wide sub strips, the doc strip at 180 px on wide screens, a margin-note group that runs down the rail, a table restack that keeps a cell's text together, the Draft-art note in ink-3, veils that follow their text on scroll); the engine's framing changes (§12.4); the lead's budget rulings (§15.4); and phase 3's retirement of round 3's CSS blocks (`tokens.css`, `components.css`; no page used them, pixel-checked). Where this file and the pages differ, the pages were checked against the rulings here.*

*Revision 4 (10 October, fixer, from the art QA): every strip frames a band of its scene so its summits sit whole under the top feather (§6.2, §12.4 item 8); Writing, the Résumé, Contact and the 404 get their own silhouettes and crops (terraced fields, mostly water, a still reflection, a single peak; §10.0, §12.3, §12.4 item 9) and the Résumé's and Contact's misted strengths rise to .55 / .50; the cursor's wake is a soft local opening with no straight edge (§7.3); the story map is drawn in pale feathered washes (§5); the compare panel moves bottom right and folds (§9.10); Work's More work folds at every width and its flagship diagrams fold on phones (§9.7, §9.9, §15.4 ruling 1).*

**Order of authority** when two documents differ: Jack's own words → `brief-r4a.md` (binding decisions and copy) → `_notes/r4/proposal.md` (the approved plan) → **this spec** → `COPY.md` (every word) → `README.md` → `SPEC-R3.md` (round 3; superseded wherever this file says something different) → `brief.md` (hard rules).

**Principle: reading first, then the art.** A visitor must be able to read who Jack is and what he built at a normal, calm scale, on a phone first. Then the painting rewards them. Jack wants it to **look beautiful** and to **keep the mist** (the drifting mist and the mist parting around the cursor). When two rules seem to conflict, pick the one that reads better; when two readable options remain, pick the more beautiful one.

**Words:** every visible word, title, meta and JSON-LD value comes from `COPY.md` (draft 3, round 4a). Builders never write copy. `OMITTED` in COPY means build nothing there. Items marked **DRAFT** in COPY are built exactly as written (Jack reviews them in the demo).

Contents:
0. Contracts at a glance
1. Scope, kept, removed, hard rules
2. Tokens: type, space, layout, breakpoints, colour
3. Layout primitives
4. The header
5. The footer story map
6. The painted strip
7. The fixed canvas, its windows and the horizon handover
8. The closing scene and "Next"
9. Components
10. Pages: structure on wide screens and phones
11. Content moves
12. Landscape API additions (engine)
13. System contracts (boot, router, transition, tools)
14. File ownership, coordination and phases
15. QA and acceptance
16. Open items

`<scratchpad>` = `/private/tmp/claude-502/-Users-jackxu-Personal-Projects-my-website/f2140497-9874-4e25-9f37-7060d4d7e4c9/scratchpad` (the only scratchpad; ignore older paths in earlier briefs).

---

## 0. Contracts at a glance

| Contract | Shape | Owner → users |
|---|---|---|
| Page config | `<body data-page data-stretch data-distance data-presence data-horizon>` (§10 table) | pages → main.js, router, engine |
| Strip | `header.strip.strip--{home\|sub\|doc}` > `div.strip__art[data-landscape="strip"][data-wake][aria-hidden]` + `div.strip__text[data-landscape="keepout"][data-veil="0.85"]` (+ `p.strip__note`) | system CSS; pages markup; engine reads |
| Closing | `nav.closing[aria-label="Next page"]` > `p.closing__next` (keep-out) + `div.closing__art[data-landscape="closing"][data-wake][aria-hidden]` | system CSS; pages markup; engine reads |
| Veils | `data-veil` on each `section.sec` (horizon desktop only) | pages → engine |
| Engine | `mountLandscape(canvas, { …, strip, closing, keepout, palette, figures })`; handle `+ setPalette(p)`, `+ prepare(stretch)`, `rebind({ strip, closing, keepout, veil, wake, horizon })`; exports `+ framingAt()`, `+ PALETTES` (§12) | engine → system |
| Demo switches | `?compare=1`, `?palette=ink\|misted\|rich`, `?name=56\|72\|96` → `sessionStorage['ink:compare'\|'ink:palette'\|'ink:name']` → `html.is-compare`, `html[data-palette]`, `html[data-name-size]` before first paint; events `ink:palette`, `ink:name` (§9.10) | system |
| Page modules | unchanged from round 3: `export default { init({ main, config, landscape, signal }), destroy() }`, declared with `data-page-module` | pages → main.js |
| Projects | `<!-- @data:projects -->…<!-- /@data:projects -->` in `work/index.html`, rendered at BUILD time by `tools/sync-projects.py --discover` (§13.6). Zero client JS, never a browser call to GitHub | system → work |
| Photo | one file, `/assets/img/qijin-xu-colour.jpg`, 720 × 900, ≤ 80 KB, no metadata; `img.hello__photo` (§9.2) | home (file via `tools/build-photo.swift`) |
| Router events | unchanged: `route:start`, `route:swap`, `route:end`, `route:fallback` | system |
| Words | `COPY.md` draft 3: §0 global (header, footer, shared labels, demo switches), §1 Home, §2 the `/about/` stub, §3 Work, §4 Writing and the Note, §5 Résumé, §6 Contact, §7 404, §8 titles, meta and JSON-LD, §9 claims, §10 open items | design lead → every builder |

---

## 1. Scope, kept, removed, hard rules

### 1.1 What 4a is

The reading fix (layout, type, header, footer, content moves on every page), the greeting hero with Jack's colour photo and "About me", the colour palette with a compare switch, **every page opening on its own painted strip**, and two scenes in place at **draft quality, labelled "Draft art"**: Home's traveller and hut, and Work's river market at the rainbow bridge. Other pages show their own colour and crop of today's painting (Contact keeps the crossing, Writing the lake). The real places (ferry, terraces, pavilion, life) are 4b.

### 1.2 Kept from round 3

Ink buttons (brush swatch, pointer bloom, press rings), dry-brush link underlines and the brush mark on the current nav item, the seal and its once-per-session stamp, the sideways pan with the pale mist sweep between pages, **the drifting mist and the mist parting around the cursor (inside the strip's sky)**, "Still the landscape", margin notes (right rail on wide screens, inline toggles below), the returning header (now solid), diagrams with "Read as steps", the vertical brush timeline (now on Résumé, drawn still), the router and page-module contracts, reduced motion, the no-WebGL and no-JS fallbacks, print, zero console errors.

### 1.3 Removed

| Removed | Notes |
|---|---|
| Text fade-ins on scroll: every `data-reveal`, and every `data-arrive` except the name | `mist-reveal.js` is no longer imported (file kept unused, like `ink-figures.js`). Budget: **0** text animating on scroll. Diagram strokes may still draw in (they are not text). |
| The name's ink arrival as an entrance | Readable at first paint (opacity 1 always); a settle of ≤ 400 ms (§9.1). |
| Vistas (`.passage--vista`, `data-vista`, `--vista-h*`) | Replaced by the closing scene at each page's end (§8). The engine's `vistas` option is ignored. |
| `?transition=edge` | `transition.js` loses `edge()` and `variant()`; the `.ink-wash` canvas leaves the template; `--dur-route-edge` is deleted; the boot script clears `sessionStorage['ink:transition']`. |
| The frozen hero (`section.screen.hero`, the pixel-diff baselines, `.name__aka/__given/__rest`) | The hero is new (§10.1). |
| `.screen` one-screen slides (Contact, 404) | Every page opens on a strip. |
| The 12-column passage system (`.passage*`, `.on-a/b/c/ab/bc/abc`, `--axis-*`) | Replaced by the frame and the reading column (§3). |
| Ledger, grey byline, home statement, home closing question, About page | §11. |
| Cinnabar anywhere but the seal | The home statement's and the 404 line's red full stops become plain ink. Cinnabar = the seal (header and signature) only. |
| `data-landscape="head"`, `data-landscape-descend` | Replaced by `data-landscape="strip"` and `"closing"`; the engine keeps them as aliases for one round. |
| `/about/` as a page | A redirect stub (§10.8). |

### 1.4 Hard rules (every builder)

- The only Chinese character anywhere (text, alt, comments, file names, metadata) is 徐, and only as the seal. Never the forbidden motto. Never invented characters for "Qijin". No new Chinese text.
- No phone number anywhere, PDF included. No street address. No PMP. Public email: qxjack@gmail.com.
- Never link or copy the OLD PDF (`public/documents/QijinXu_Resume.pdf`). The only PDF is the generated `/resume.pdf`.
- People, buildings, boats and bridges are allowed **inside the painting only** (drawn by the engine on canvas). Never as icons, SVG, UI or illustrations in HTML. Keep these words out of `alt`, `title`, `aria-label` and inline SVG (the compliance scan flags them): photo, portrait, selfie, headshot, house, building, bridge, boat, ship, temple, pavilion, lantern, crane.
- **Text never sits on colour.** Pigment lives inside the painting, never under text, never as a UI or text colour. No yellow, gold, beige or cream anywhere. Paper stays `#EFF1EE`.
- No boxy cards, frames, pills, bento, glass, decorative gradients, icon rows, shadows.
- No git operations. Never use the in-app browser pane. Screenshots only under `<scratchpad>/shots/<your-name>/`; open and judge every image. Never bypass a web filter; never change system, security or TLS settings.
- Content complete with JS off; nothing starts hidden; reduced motion, no-WebGL and print work; zero console errors; no horizontal scroll from 320 to 1440 px; every link and button at least 44 × 44 px.

---

## 2. Tokens (system: `tokens.css`, a new "Round 4a" block)

Pages may write `var(--token, <value>)` with the values below until system lands them. Round-3 tokens stay defined until phase 3, but no new rule may use the retired ones (`--step-name`, `--step-title`, `--step-figure*`, `--step-4/5`, `--rhythm-passage`, `--vista-h*`, `--axis-*`, `--tier-main-*`).

### 2.1 Type scale

Fluid between 390 px and 640 px, constant above 640 (the proposal's phone and tablet/wide values), except the name, which scales continuously to 1440.

```css
--fs-small:  .875rem;                                     /* 14: meta, dates, captions, table heads, footer */
--fs-body:   clamp(1.0625rem, .965rem + .4vw, 1.125rem);  /* 17 → 18 */
--fs-lead:   clamp(1.125rem, .93rem + .8vw, 1.25rem);     /* 18 → 20: hero lead, page intros, Work's statement */
--fs-item:   clamp(1.125rem, .93rem + .8vw, 1.25rem);     /* 18 → 20: h3, row titles */
--fs-h2:     clamp(1.375rem, .985rem + 1.6vw, 1.625rem);  /* 22 → 26: section headings, "Next: …", the email */
--fs-title:  clamp(2rem, 1.22rem + 3.2vw, 2.5rem);        /* 32 → 40: page titles (h1) */
--fs-name:   clamp(2.75rem, 2.1875rem + 2.6vw, 4.5rem);   /* 44 @ ≤ 346 · 45 @ 390 · 68 @ 1280 · 72 @ ≥ 1423 (base-v2: clamp(44px, 35px + 2.6vw, 72px)) */
--fs-figure: clamp(1.375rem, 1.0825rem + 1.2vw, 1.625rem); /* 22 → 26 (= --fs-h2, so a figure never adds a type size): a case's summary figure, timeline years */
--fs-nav:    .9375rem;                                    /* 15; 16 from 640; 14 at ≤ 375 */
--fs-brand:  1.0625rem;                                   /* 17: "Qijin Xu" in the header; 16 at ≤ 375 */

--lh-body: 1.6;  --lh-lead: 1.55;  --lh-item: 1.3;  --lh-h2: 1.25;  --lh-title: 1.1;  --lh-name: 1.02;  --lh-small: 1.45;
```

| Role | Family and weight | Size | Ink |
|---|---|---|---|
| The name (Home only) | Sofia Sans Extra Condensed 900, `letter-spacing: -.005em` | `--fs-name` | ink-1 |
| Page titles (h1) | Sofia Sans Condensed 780 | `--fs-title` | ink-1 |
| Section headings (h2), "Next: …" | Commissioner 700, `letter-spacing: -.01em` | `--fs-h2` | ink-1 |
| Item headings (h3), row titles | Commissioner 700 | `--fs-item` | ink-1 |
| Lead / intro | Commissioner 400 | `--fs-lead` | ink-1 |
| Body | Commissioner 400, FLAR `--flare-body` | `--fs-body` | ink-1 |
| Small print | Commissioner 400, tabular figures | `--fs-small` | ink-3 (`#434C50`, 7.7:1); ink-4 only on plain paper |
| UI labels, nav, table heads | Commissioner 560 | per role | ink-1 / ink-3 |
| Summary figures, timeline years | Sofia Sans Extra Condensed 900 | `--fs-figure` (22 → 26) | ink-2 |

- Commissioner uses exactly three weights: `--w-body` 400, `--w-ui` 560, `--w-strong` 700 (`b`, `strong`, h2, h3, the brand). `.ink-btn` labels move to 560 (the frozen-hero exception is gone).
- **At most four type sizes per screen** (chrome excluded). Figures inside sentences are bold at text size (`<b>90%</b>`), never enlarged.
- Measure: body ≤ 680 px (`--measure-read`), about 60–72 characters.

### 2.2 Space

```css
--space-section:    clamp(2.625rem, 1.65rem + 4vw, 3.25rem); /* the margin between sections: 42 @ ≤ 390 → 52 @ 640 */
@media (min-width: 75rem) { :root { --space-section: 3.625rem; } } /* 58 from 1200 */
--space-head:       .75rem;                                   /* h2 → its first line (12; 14 from 640) */
--space-item:       clamp(1.5rem, .72rem + 3.2vw, 2rem);      /* rows and list items: 24 → 32 */
--space-para:       .9em;                                     /* between paragraphs */
--space-strip-text: clamp(1.25rem, .9rem + 1.4vw, 1.75rem);   /* strip → title, below the strip: 20 → 28 */
```

**Why these margins are smaller than the proposal's "space between sections" (72 / 64 / 52):** that row is the *visible* gap the audit's `measure.js` reads (the last text line of one section to the next heading), which adds the leading and the rows' padding to the margin. Never raise the margin to the visible target. *As built (system, measured):* the wireframe's 36 / 52 / 56 came from sections that all ended in padded rows; sections ending in a text line read 35 / 54 with them, so the margins are **42 / 52 / 58**. Measured visible gaps between sections (lead, 10 Oct): 58–74 at 1440 and 1280, 43–54 at 390, all inside §15.2.

The round-3 fluid scale `--space-3xs … --space-3xl` stays for small paddings and gaps inside components. Row hairlines: `border-top: 1px solid var(--rule)` with `padding-block: .875rem` (typographic rules, never boxes).

### 2.3 Layout widths

```css
--frame:          75rem;     /* 1200: the page frame, centred */
--gutter:         1.25rem;   /* 20 phone; 16 at ≤ 360; 32 from 640; 40 from 1200 */
--measure-read:   42.5rem;   /* 680: the reading column */
--measure-wide:   60rem;     /* 960: tables, diagrams, the About-me block */
--strip-text-max: 36.25rem;  /* 580: the title block inside a wide strip */
--rail-gap:       3rem;      /* 48: reading column → margin rail */
--rail-w:         18.75rem;  /* 300: the margin rail (wide only) */
--header-h:       3.5rem;    /* 56 phone; 64 from 640; 48 on short screens */
```

At 1440: frame x 120–1320, reading column x 120–800, rail x 848–1148, wide blocks x 120–1080.

### 2.4 Breakpoints

| Name | Query | Notes |
|---|---|---|
| phone | `(max-width: 39.99rem)` (< 640) | mobile-first base styles |
| tablet | `(min-width: 40rem)` (640–1199) | strip above the title; notes as toggles |
| wide | `(min-width: 75rem)` (≥ 1200) | title in the strip's mist; margin rail |
| short | `(max-height: 31.25rem) and (max-width: 74.99rem)` (< 500 tall) | sideways phones: 80 px strips, 48 px header |
| tight header | `(max-width: 23.4375rem)` (≤ 375) | nav 14 px, gaps 10, seal 24, brand 16 |
| header wrap | `(max-width: 21.1875rem)` (< 340) | the nav wraps to a second row |
| narrow gutter | `(max-width: 22.5rem)` (≤ 360) | gutter 16 |
| horizon | `(min-width: 64rem) and (min-aspect-ratio: 1/1)` | desktop and landscape tablets only; the engine reads it (§7.4) |

Strip heights per breakpoint are in §6.2. Use `svh`, never `vh`, for anything tied to the viewport's height. Respect `env(safe-area-inset-*)` in the header, footer and compare panel.

### 2.5 Colour

UI colours are unchanged: paper `#EFF1EE`, mist-1 `#E3E8E5`, mist-2 `#D5DCD9`, ink-1…5, wash `#3E5664`, cinnabar `#B1362B` (seal only), `--rule`, `--rule-rest` (`#7B8385`, every link's resting mark). **The pigments below are engine-only** (`landscape/palette.js`): they never become CSS tokens, text or UI colours.

| Pigment | Deep | Misted | Used for |
|---|---|---|---|
| Azurite | `#2C5C8A` | `#7F9FB8` | peaks, strongest on Home |
| Malachite | `#3A806A` | `#8DB5A4` | slopes, willows, terraces |
| Timber brown (red ochre toned with ink) | `#6B5444` | `#8F8078` | bridge, boats, timber, earth paths: small areas only |
| Ink grey (existing) | `#2A3034` | — | tile roofs, outlines |
| Indigo wash (existing) | `#3E5664` | — | far ranges, water, clothes |

Dropped and forbidden: the ochre glaze `#CDB096` (beige) and any lamp or lantern glow (yellow).

---

## 3. Layout primitives (system: `layout.css`, `components.css`)

```html
<main id="main" tabindex="-1" class="frame">
  <header class="strip strip--sub">…</header>           <!-- the page opens on its strip (§6) -->
  <section class="sec" aria-labelledby="x-title" data-veil>
    <h2 class="sec__title" id="x-title">…</h2>
    <p>…</p>
  </section>
  …
  <nav class="closing" aria-label="Next page">…</nav>    <!-- the page ends on its closing scene (§8) -->
</main>
```

| Class | Rule |
|---|---|
| `.frame` | `width: min(var(--frame), 100% - 2 * var(--gutter)); margin-inline: auto`. `<main>` is the frame; the header and footer use an inner `.frame`. `body { overflow-x: clip }` so full-bleed children never cause sideways scroll. |
| `.bleed` | full-bleed child of the frame: `margin-inline: calc(50% - 50vw)` (strip art, closing art). |
| `.sec` | a section: `margin-block-start: var(--space-section)`; children capped at `--measure-read` unless `.wide`. |
| `.sec__title` | h2 (§2.1), `margin-block-end: var(--space-head)`. Optional `span.sec__date` (small print) inside it. |
| `.wide` | `max-width: var(--measure-wide)` (tables, diagrams, the About-me block). |
| `.has-rail` | wide only: `display: grid; grid-template-columns: minmax(0, var(--measure-read)) minmax(0, var(--rail-w)); column-gap: var(--rail-gap)`, **sparse** auto-placement in source order (never `dense`, which piles the notes at the top); children `grid-column: 1`, `.margin-note` `grid-column: 2`, `.wide` `grid-column: 1 / -1`. A case's `dl.case__body` and its `dd`s carry the rail by subgrid; a group of notes inside a `dd` (`.margin-notes`, made by `margin-note.js`) is absolute in its own grid area, so it runs on down the rail beside the next terms instead of stretching its `dd` (no `display: contents`, so `dd` semantics are untouched). Below wide: one column. |
| `.lead` | `--fs-lead`/`--lh-lead`, `max-width: 34em`. |
| `.small` | small print (§2.1). |
| `.rows` | `ul/ol[role=list]` of `li.row` separated by hairlines; `.rows--plain` without hairlines, `gap: .375rem`. |
| `.row__title` | h3 (§2.1). A row whose title is a link covers the row with the link's `::after` and washes on hover (`.ink-row`). |
| `.more` | a trailing "… →" link line after a list: `margin-block-start: var(--space-s)`. |

`data-veil` on each `section.sec` (and the table and diagram blocks): the engine thickens mist behind them where the desktop horizon is shown (§7.4). Default 0.72; small print blocks that can sit over the horizon use `data-veil="0.9"`.

---

## 4. The header (system: `_template.html` `@shared:top`, `layout.css`, `header.js`, `nav.js`, `seal.js`)

```html
<header class="site-header">
  <div class="site-header__inner frame">
    <a class="home-link" href="/">
      <span class="seal" aria-hidden="true"><svg class="seal__mark" viewBox="0 0 64 64" focusable="false">…carved 徐…</svg></span>
      <span class="home-link__name">Qijin Xu</span><span class="visually-hidden">, home</span>
    </a>
    <nav class="site-nav" aria-label="Main">
      <ul class="site-nav__list" role="list">
        <li><a class="brush" href="/work/">Work</a></li>
        <li><a class="brush" href="/resume/">Résumé</a></li>
        <li><a class="brush" href="/contact/">Contact</a></li>
      </ul>
    </nav>
  </div>
</header>
```

- **One home link:** the seal and the words "Qijin Xu" are one `<a>` (accessible name "Qijin Xu, home", which begins with the visible label). Seal 28 px (24 at ≤ 375), gap 10 px (8), brand Commissioner 700 at `--fs-brand`, ink-1, `min-height: 44px`. On `/` it carries `aria-current="page"` with no extra mark (the seal is the mark).
- **Nav:** Work · Résumé · Contact, Commissioner 560 at `--fs-nav` (15; 16 from 640; 14 at ≤ 375), gaps 14 px (28 from 640; 10 at ≤ 375), each link `min-height: 44px`, `display: inline-flex; align-items: center`. The current page keeps its brush mark (`aria-current="page"`; the Note marks nothing in the nav). No resting underline on nav links.
- **Fit:** one row at 360 px (measured in the wireframe); below 340 the nav wraps under the home link (`flex-wrap: wrap`, height auto). No menu button.
- **Height:** `--header-h` 56 / 64 / 48 (short). The header sits in normal flow, on paper, directly above the strip; the strip's top edge feathers out of the paper below it.
- **Returning, solid:** `header.js` arms once the strip's art box (`[data-landscape="strip"]`) has scrolled away (bottom ≤ 0). Then it is sticky and hidden; scrolling up ≥ 8 px brings it back **solid**: `background: var(--paper)`, a 1 px `--mist-2` bottom rule, no gradient, no shadow. Scrolling down ≥ 8 px slides it away (`--dur-header`, 220 ms; reduced motion: 120 ms fade). At the very top it is static again. Never `visibility: hidden` or `inert`; focus inside pins it; `html { scroll-padding-top: calc(var(--header-h) + .75rem) }`.
- **Seal stamp:** `seal.js` stamps the header seal once per session (unchanged). It never stamps the signature seal.

---

## 5. The footer story map (system: `@shared:bottom`, `layout.css`, new `story-map.js`; strip art: engine `stripSVG()`)

The whole painting as a thin map of the journey, one mark per place, each linking to its page. Then one line of links and the "updated" line. About 150 px tall on desktop (round 3: 366).

```html
<footer class="site-footer">
  <div class="frame">
    <nav class="story-map" aria-label="All pages">
      <div class="story-map__art" aria-hidden="true"></div>
      <ol class="story-map__list" role="list">
        <li data-stretch="0"><a class="brush" href="/">Home</a></li>
        <li data-stretch="1"><a class="brush" href="/work/">Work</a></li>
        <li data-stretch="3"><a class="brush" href="/writing/">Writing</a></li>
        <li data-stretch="4"><a class="brush" href="/resume/">Résumé</a></li>
        <li data-stretch="5"><a class="brush" href="/contact/">Contact</a></li>
      </ol>
    </nav>
    <div class="site-footer__base">                       <!-- as built: one row from 1200 (© + links left, "Updated" right) -->
      <div class="site-footer__line">
        <p class="site-footer__copy"><span class="nowrap">© 2026 Qijin Xu · Toronto</span></p>
        <ul class="site-footer__links" role="list">
          <li><a class="brush" href="mailto:qxjack@gmail.com">Email</a></li>
          <li><a class="brush" href="https://www.linkedin.com/in/qijin-x-4899671a9/">LinkedIn</a></li>
          <li><a class="brush" href="https://github.com/Freedom-Jack">GitHub</a></li>
          <li><a class="brush" href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf">View résumé (PDF)<span class="visually-hidden">, opens in a new tab</span></a></li>
        </ul>
      </div>
      <p class="site-footer__updated">Updated <time datetime="2026-10">October 2026</time><span class="still"> · <button class="still-toggle brush" type="button" aria-pressed="false">Still the landscape</button></span></p>
    </div>
    <p class="visually-hidden" id="route-announcer" aria-live="polite" aria-atomic="true"></p>
  </div>
</footer>
```

- **Geography, not nav order.** The map runs along the scroll, world 0 → 6 (stretches 0–5): Home (0) · Work (1) · *the road out of town (2), unlabelled* · Writing (3) · Résumé (4) · Contact (5). The 404 (6) lies off the map.
- **Art:** `stripSVG({ from: 0, to: 6, width: 600, height: 36 })` (28 px tall below 640), in greys (the story map is UI: no pigment), drawn as pale ink washes (each plane a gradient of `--strip-ink` at about 26 / 36 / 46 % at its crests, dissolving toward its foot; softened by a 0.6 px blur) and feathered into the paper at its left, right and bottom by a mask (revision 4: the flat, opaque silhouettes read as a chart), cached in `sessionStorage['ink:strip:v3']`. Only the current place's tick is in ink-1. From 640: the labels sit in a 6-column grid matching the art (`li[data-stretch="n"] { grid-column: n + 1 }`; column 3 stays empty); each label's hit area also covers its column of the art (≥ 44 px tall). Below 640: the five labels in one flex row (`justify-content: space-between`, wrap allowed), each ≥ 44 px tall; ticks still mark their places on the art.
- **You are here:** the current page's label has `aria-current="page"` (the Note marks Writing `"true"`; the 404 marks none), its brush mark, and a short ink-1 tick on the art above its stretch's centre.
- **Links line:** separators are CSS (`· ` before each link after the first, `aria-hidden` generated content); on phones the line wraps after the © group. "Writing" is not repeated here: it is in the map. Small print, ink-3.
- Without JS: the art is hidden, the labels and lines remain. "Still the landscape" is hidden without JS. Hidden in print.
- **4b hook:** `stripSVG({ marks: true })` will add one small glyph per place (bridge arc, ferry, terraces). Not in 4a.

---

## 6. The painted strip

Every page opens with a short, unframed, full-bleed band of its own scene. It fades into the paper; it has no border, no box, no shadow.

### 6.1 Markup (pages write it; system styles it; the engine paints it)

```html
<header class="strip strip--home" aria-labelledby="name">
  <div class="strip__art bleed" data-landscape="strip" data-wake aria-hidden="true"></div>
  <div class="strip__text" data-landscape="keepout" data-veil="0.85">
    <h1 class="name" id="name" data-arrive="name">Qijin Xu</h1>
    <p class="lead">…</p>
  </div>
  <p class="strip__note small">Draft art</p>      <!-- Home and Work only, in 4a -->
</header>
```

- `.strip__art` is an **empty box** that reserves the strip's height. Text never depends on the painting: layout is identical with JS off, WebGL off, or the engine still loading.
- Variants: `strip--home` (Home), `strip--sub` (Work, Writing, Contact, 404), `strip--doc` (Résumé, the Note: a document's low band; its text is **always below** the art, at every width).
- `p.strip__note` ("Draft art"): Commissioner 400, 14 px, **ink-3** (ink-4 measured 4.4–4.8:1 against the darkest grain of the painted feather; ink-4 is for plain paper only), `position: absolute; right: 0; top: calc(var(--strip-h) - 1.75rem)`, so it sits in the art's bottom feather. The engine finds the note by itself (the strip art's sibling `.strip__note`) and keeps paper behind its line and no figure or pigment under it; pages add no attribute. Never on colour. Removed in 4b.
- No JS: `html:not(.js) .strip__art { background: url(/assets/svg/ridge-hint.svg) right bottom / auto 70% no-repeat; }` (pale; same box).
- Print: strips are `display: none` (the text block stays).

### 6.2 Heights (system tokens; the art box gets `min-height: var(--strip-h)`)

| | phone (< 640) | tablet (640–1199) | wide (≥ 1200) | short (< 500 tall, < 1200 wide) |
|---|---|---|---|---|
| `--strip-home` | `clamp(96px, 14svh, 120px)` (118 @ 390 × 844) | 220 px | `clamp(440px, 58svh, 540px)` (522 @ 900) | 80 px |
| `--strip-sub` | `clamp(110px, 20svh, 170px)` (169 @ 844) | 220 px | `clamp(300px, 40svh, 360px)` (360 @ 900) | 80 px |
| `--strip-doc` | `clamp(88px, 12svh, 110px)` | 160 px | **180 px** (the low end of the proposal's 180–220: documents open on their text) | 64 px |
| `--closing-h` (§8) | 160 px | 200 px | 240 px | 96 px |

Feathers, painted by the engine (not CSS masks; `compose.js` `FEATHER`): top / bottom 24 / 26 px on phones and sideways phones, 30 / 36 on tablets, 40 / 56 on wide screens; `strip--doc` half of each. Left and right run off the screen edges, as a handscroll does. **The strip never cuts a summit** (revision 4): the engine frames a band of the scene with its highest summits (the far range included) just under the top feather and its ground above the bottom one, so only the mist dissolves into the paper (§12.4 item 8).

### 6.3 Title in the mist (wide) and below the strip (narrow)

- **Wide (≥ 1200), `strip--home` and `strip--sub`:** art and text share one grid cell. `.strip { display: grid }`, `.strip__art, .strip__text { grid-area: 1 / 1 }`, `.strip__text { align-self: center; max-width: var(--strip-text-max); padding-block: var(--space-l); position: relative; z-index: 1 }`. The art stretches if the text is taller (`height: 100%` of the cell, never less than `--strip-h`). The title block sits at the frame's left edge (x 120 at 1440); the scene's figures stand to its right. **`strip--sub` (as built): the title block sits low in the band** (`align-self: end; padding-block: var(--space-l) var(--space-m)`): centred in 300–360 px, a subpage's short intro left 140–200 px of blank paper before its first section; low, the intro reads with the content it introduces (≈ 93–108 px), and the band's upper left stays sky. Home's strip stays centred (its block fills the band).
- **Below 1200, and `strip--doc` at every width:** the art first, full-bleed; then the text on paper with `padding-top: var(--space-strip-text)`.
- **The keep-out zone** (engine-enforced, §7.3): around the text block's rect R (only where R overlaps the art):
  - no pigment under R; the mist ramps from opaque at `R.right − 140 px` to clear at `R.right + 140 px` (noise-broken, so it reads as mist, not a gradient edge), over the strip's full height;
  - nothing figurative within 40 px of R, and every figure layer's focus at least 180 px right of `R.right`;
  - the text's veil (`data-veil="0.85"`) thickens paper-coloured mist behind the lines;
  - **acceptance:** body text ≥ 7:1 and small print ≥ 4.5:1 against the measured background; no pixel with chroma > 6 (in 0–255 units) inside R.

---

## 7. The fixed canvas, its windows and the horizon handover (engine)

One fixed, full-viewport WebGL canvas stays (it is what makes the sideways pan possible). The page's DOM boxes tell it where to paint.

### 7.1 Windows

| Window | Element | What is painted inside it |
|---|---|---|
| strip | `[data-landscape="strip"]` | the page's scene at its strip framing (§12.4), its palette, its figure layer, drifting mist and the cursor's wake |
| closing | `[data-landscape="closing"]` | the page's scene at its closing framing: the road toward the next place (§8) |
| horizon (desktop only) | the viewport's bottom band | today's faint ink horizon: no colour, no figures (§7.4) |

Outside the windows the canvas is paper. The engine reads each window's `getBoundingClientRect()` on scroll (passive, one read per animation frame) and on resize.

### 7.2 Scroll-linked, 1:1

A window's scene is anchored to its box: as the page scrolls, the scene moves up exactly with the box (a present-pass offset; **no scene re-render while scrolling**). The heavy scene render for a window happens on mount, on resize (debounced 150 ms), on a width-class change, on a palette change, during a pan (governed drafts, one full-quality frame ~150 ms after it stops) and, for the closing, once at idle after load (before it can be reached).

### 7.3 Inside the strip's sky: mist drift and cursor parting (Jack: keep it)

- **Drift:** the ambient mist keeps drifting inside the strip and closing windows (present pass, ≤ 15 fps, eases to a stop after 45 s idle, as today). It rests in the horizon band. Nothing drifts while no window is on screen.
- **Wake:** fine pointers only; never touch, reduced motion or Still. Allowed inside `[data-wake]` windows, multiplied by (1 − keep-out mask) and (1 − veil), so it never touches text. It parts the **mist only**: never moves or tints ink, colour or figures. (Ruled 10 Oct: round 3's response is kept whole, including its haze lift, where the parted mist lets the ink beneath read up to 20 % truer; that is the effect Jack liked.) Round-3 timing and acceptance unchanged (50 ms lag, 120 ms attack, 700 ms release, closes over 600–800 ms; ≥ 3/255 over sky, ≤ 0.5/255 under veiled text). *Revision 4:* the wake is a **soft local opening**: its radius is 12.8 % of the viewport's height clamped to 84–136 CSS px (half strength ≈ 95 px from the path at 900 tall; round 3's 0.29 vh filled a 520 px strip), and every term is a smooth sum over the trail (the opening is the strongest capsule; the mist is pushed outward from the path and drawn a little along it, capped), never one segment's pick, which had left a straight seam through the newest trail point. Measured with the drift stopped (`_lab/landscape/wake.html`): ≈ 7/255 within 80 px, gone by ≈ 200 px, ≥ 5/255 over sky, text ≤ 0.33/255, on SwiftShader and a real GPU.
- **Arrival:** on a full page load the strip blooms (the wet front, far planes to near, ~1.2 s). Text never waits for it.

### 7.4 The horizon handover (desktop only)

- Shown only when the `horizon` media query (§2.4) matches. Phones and portrait tablets read on plain paper (`hzK ≡ 0`).
- `hzK = smoothstep(0.35, 0, strip.bottom / vh) × (1 − smoothstep(1, 0.7, closing.top / vh))`: the horizon fades in as the strip's bottom edge rises from 35 % of the viewport to the top, and fades out again as the closing scene's top rises from the bottom of the viewport to 70 %, so the two never overlap.
- The horizon is round 3's: ridges flattened and sunk so their crests sit in the bottom 25 % of the viewport, presence = `data-horizon`, **ink only, never figures, never pigment**, mist resting. Veils (`data-veil` on sections) thicken behind text so it is never under text.
- Rendered once per page at idle; present-only afterwards.
- When no window is visible and `hzK = 0`, the engine stops requesting frames entirely (a phone reading on paper costs nothing).

### 7.5 Page changes

- The camera pans along world x from the old stretch to the new (round 3: 600 ms `cubic-out`, the pale sweep ≤ mist-2, pans of more than 2 stretches spliced under thick mist).
- Each window's framing (focus, scale) interpolates from the old page's to the new page's over the pan; window rects are read live, so the pan plays in whatever window is on screen (a click on "Next" at the page's end starts the pan in the closing; after the swap the new strip carries it).
- **Figures are prepared before the pan:** the router calls `landscape.prepare(stretch)` when the destination is prefetched (hover, focus, `pointerdown`). The old figure layer fades out over the first 30 % of the pan; the new one fades in through the sweep's mist over the last 40 %. If it is not ready by then, it fades in through mist within 300 ms of becoming ready. It never pops in.
- Back/forward: content is instant; the painting pans in 400 ms (round 3).

### 7.6 Fallbacks and budgets

- Reduced motion or Still: no bloom, no drift, no wake, no sweep; pans cut; figures appear with a 150 ms fade.
- Canvas2D (no WebGL, or context lost): the same windows, framings, palettes and figures, static; no wake, drift or sweep.
- No JS: §6.1.
- Budgets: ≤ 1 ms CPU per present frame on desktop; scene buffer at 0.75 × DPR, long side ≤ 1920; DPR capped at 2 on phones (1.5 if the governor reports slow frames); figure layers drawn at min(2, DPR) × their window's CSS size, once per (stretch, width class, palette), off the main thread when `OffscreenCanvas` in a module worker is available (else in idle chunks of ≤ 8 ms), **never while scrolling**; pause when the tab is hidden.

---

## 8. The closing scene and "Next"

Each page ends with its own place once more, framed on the road toward the next place, and a single link onward. It replaces round 3's vistas and end buttons. (On phones each page shows its place twice: arriving and leaving.)

```html
<nav class="closing" aria-label="Next page">
  <p class="closing__next" data-landscape="keepout">
    <a class="next" href="/work/"><span class="next__label">Next:</span> <span class="next__to">Work</span><span class="next__arrow" aria-hidden="true"> →</span></a>
  </p>
  <div class="closing__art bleed" data-landscape="closing" data-wake aria-hidden="true"></div>
</nav>
```

- `nav.closing` is the last child of `<main>`, `margin-block-start: var(--space-section)`. The footer follows on paper.
- `.next`: Commissioner 700 at `--fs-h2`, ink-1, resting brush mark under `span.next__to` (the destination); `.next__label` 560 in ink-3. Hit area ≥ 44 px tall (the shared hit area, §9.11; the link itself is 41–42 px on phones).
- The closing's link stays vertically centred in its art on wide screens: the space above it is the closing scene's own (it is not a gap between sections, §15.4).
- **Wide:** the link sits in the art's mist at the frame's left, vertically centred (same grid-stack as §6.3; keep-out applies). **Below 1200:** the link on paper, then the art (`--closing-h`), which feathers into the footer's paper.
- Destinations: Home → **Work** · Work → **Résumé** · Writing → **Résumé** · Note → **Writing** · Résumé → **Contact** · Contact → **Home** (the ferry carries you back across to his mountain) · 404: no closing (its path ends in mist).
- The closing art is hidden in print and without JS shows nothing (the link remains).

---

## 9. Components

### 9.1 The name (Home only; system CSS, home markup)

`h1.name` "Qijin Xu": `font: 900 var(--fs-name)/var(--lh-name) var(--font-name)`, `letter-spacing: -.005em`, ink-1, one line at every width (it is short), `padding-block-end: .06em` so the Q's tail and the j's descender clear the lead. Metric-matched fallback (`'Name Fallback'`, Impact scaled) so it never reflows. **Visible at first paint** (opacity 1, never hidden by an entrance class). `data-arrive="name"` gives an ink settle of ≤ 400 ms: the `#ink-arrive` displacement relaxes from scale 8 to 0 (reduced motion: none). The 2.5 s safety net stays. The compare switch can set it to 56 / 72 / 96 (§9.10).

### 9.2 The photo and "About me" (`.hello`; system CSS, home markup, home file)

```html
<section class="hello wide" aria-labelledby="about-title" data-veil="0.88">
  <img class="hello__photo" src="/assets/img/qijin-xu-colour.jpg" width="720" height="900"
       alt="Qijin Xu in glasses and a red sweater, head and shoulders" decoding="async" fetchpriority="high">
       <!-- alt from COPY §1.2 -->
  <div class="hello__text">
    <h2 class="sec__title" id="about-title">About me</h2>
    <p>…</p> …
    <p class="signoff">…</p>                        <!-- §9.3 -->
  </div>
</section>
```

- **Placement:** directly below the strip. Phone: the photo first at `width: 72%; max-width: 20rem` (252 × 315 at 390), then the text. Tablet: `grid-template-columns: 15rem minmax(0, 37.5rem); column-gap: 2.5rem`. Wide: `17.5rem minmax(0, 40rem); column-gap: 3rem` (photo x 120–400, text from x 448). `align-items: start`; the photo's top aligns with the h2's cap height. Asymmetric, never 50/50.
- **Blended in, in colour** (brief-r4a §2): the file's white wall is lifted to white so `mix-blend-mode: multiply` turns it into the paper exactly; the bottom of the shoulders soft-fades into the paper. *As built:* `mask-image: linear-gradient(to bottom, #000 83%, transparent 100%), linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)` (+ `-webkit-`): the fade starts at 83 % so more of the shoulders shows, and an 8 % side feather that only the sweater reaches softens where it meets the frame. No border, radius, frame, shadow, caption, grey, mist, vignette or radial mask (no floating head). No motion, no hover. Forced colours: `mix-blend-mode: normal; mask-image: none`.
- **Acceptance:** at 1440 and 390, the mean colour difference between the photo's outer 4 px ring (top, left, right) and the paper is ≤ 2 ΔE; no visible rectangle edge in a screenshot; the face reads warm and alive.
- **The file** (`/assets/img/qijin-xu-colour.jpg`), produced by `tools/build-photo.swift` (§13.7) from `public/images/selfie.jpg`:
  1. crop x 240–2140, y 250–2625 (1900 × 2375, 4:5); resize to **720 × 900** (Lanczos);
  2. grade: saturation × 0.90; warm the skin a touch (mid-tones R × 1.02, B × 0.98); shadows lean toward the painting's blue-green (below 35 % luminance: R −2 %, G +1 %, B +2 %); +3 % mid-tone exposure to pay for the multiply;
  3. **flatten, then lift the wall.** The source wall is not flat: it greys toward the right, and a ceiling-corner line crosses the top-right of the crop, so a plain gain would leave a grey ghost edge after the multiply. (a) Wall mask: pixels with luminance > 0.62 and chroma < **0.10** (as built: the wall has a warm cast, blue 10–18 levels below red and green, which 0.06 dropped; skin and the sweater sit at 0.15 and above), eroded 8 px away from the hair, skin, glasses and sweater, feathered 12 px. (b) Wall light: a heavy blur (σ ≈ 8 % of the width) of the luminance inside the mask, filled outward. (c) Divide the masked pixels by the wall light and scale so the wall maps to 255; outside the mask apply the same gain only through a soft shoulder that protects skin highlights and the sweater. Afterwards every wall pixel is ≥ 250 in R, G and B, the corner line is gone (no step > 2/255 along it), and the face is unchanged in tone;
  4. JPEG at ImageIO quality **0.55** (as built; ImageIO's scale, ≈ libjpeg 0.75), ≈ 70 KB, **≤ 80 KB**, sRGB, **no EXIF, XMP or IPTC** (verify with `sips -g all` and `mdls`).
  One `<img>`, one file: the reshoot is a one-file swap (re-run the tool on the new source). No `<picture>` (the compliance scan allows exactly one image element). The old grey `assets/img/qijin-xu.jpg` is deleted once the new file is in.
- `fetchpriority="high"`, not lazy: the photo starts on the first screen at 1440, 1280 and 390.

### 9.3 The About-me signature (system CSS, home markup)

```html
<p class="signoff">
  <span class="signoff__name">— Jack</span>
  <span class="seal seal--sign" aria-hidden="true"><svg class="seal__mark" viewBox="0 0 64 64" focusable="false">…same carved 徐, mask id "seal-carve-sign"…</svg></span>
</p>
```

- Like a painter's signature and seal at the end of the note: `display: flex; justify-content: flex-end; align-items: center; gap: .5rem; margin-block-start: var(--space-s)`, right-aligned to the text column.
- `.signoff__name`: Commissioner 560 at `--fs-lead`, `font-variation-settings: 'FLAR' 60`, `letter-spacing: .02em`, ink-2. Never a handwriting font, never italics faked.
- `.seal--sign`: 24 px square (22 below 640), cinnabar, the same carved-stone filter as the header seal, `rotate: -2deg; translate: 0 .08em`. Static: no stamp, no motion. Hidden in forced colours (the name remains).
- Screen readers read "— Jack"; the seal is decorative.

### 9.4 The Now block (system CSS, home markup)

```html
<section class="sec now" aria-labelledby="now-title" data-veil>
  <h2 class="sec__title" id="now-title">Now <span class="sec__date small">· <time datetime="2026-10">October 2026</time></span></h2>
  <ul class="rows rows--plain" role="list">
    <li><b>Building:</b> …</li>
    <li><b>Exploring:</b> …</li>
    <li><b>Off-hours:</b> …</li>
  </ul>
</section>
```

Dated, three lines, body size, no links (brief-r4a §3: the projects are not linked yet). The date is small print inside the heading (weight 400). Shown only while COPY has a Now block; it disappears with no placeholder if removed.

### 9.5 Rows (What I work on, Writing, In the open "Recent")

`ul.rows[role=list] > li.row.ink-row > h3.row__title > a.brush.brush--rest` + `p.row__line` (+ `p.row__meta.small` before the title for kind and date). The title link covers the row (`::after`); figures inside lines are `<b>`. A trailing `p.more > a.brush.brush--rest` ("All six projects →", "All writing →").

### 9.6 Table (Work; round-3 component, kept)

`div.table-wrap.wide > table.table[role=table]` with caption, `thead`, rows, `th[scope=row]` project links, `td[data-label]`; hairlines only; restacks below 48rem. Work's table drops the Kind column (four columns: Years · Project · Outcome · Evidence). Year cells never wrap. Type, so Work's first screen keeps to three sizes (40 / 20 / 14): "Six projects, newest first" is the section's heading (`h2.sec__title#glance-title`, set at `--fs-item` 700 here) and the table takes `aria-labelledby="glance-title"` instead of a visible caption; heads 560 at `--fs-small`, ink-3; every cell at `--fs-small` (14) with `--lh-small`, project cells Commissioner 700 ink-1 (never the condensed display face), other cells 400 ink-1. Restacked below 48rem: the project at `--fs-body` 700, then each value at `--fs-small` with its label. *As built:* the label hangs in a left column (`td::before`, absolute) and the cell's own contents flow beside it as one run of text, so a cell with inline markup (`<strong>`, `<a>`, `<b>`) never splits into the label column; no wrapper is needed.

### 9.7 Diagram (Work; round-3 component, kept)

Unchanged anatomy (wide and tall SVGs, `details` "Read as steps", `data-draw` strokes). *Revision 4:* `figure.diagram[data-fold="phone"]` (Work's two flagship cases) folds its drawing behind its own "Read as steps" below 40rem (opened: the steps, then the drawing and its caption); How I build keeps its drawing open. New limits: the tall variant renders **no taller than 85svh on a 390 × 844 phone** (`max-height: 85svh; width: auto; margin-inline: auto`; owners compress tall viewBoxes to ≤ 400 × 760 if needed); the wide variant shows at container width ≥ 60rem, so it appears on wide screens inside `.wide`. Labels never animate.

### 9.8 Margin notes (Work; round-3 component, threshold changed)

Right after the paragraph each note annotates: `aside.margin-note.small#note-x[aria-label="Note: X"]`. **Wide (≥ 75rem):** in the right rail (`.has-rail`), annotation ink, beside its paragraph. **Below 75rem:** `margin-note.js` turns it into a "Note: X" toggle that opens inline (threshold moves from 64rem to 75rem). No JS: inline, open.

### 9.9 Compact cases that open on tap (Work; system `disclosure.js`)

```html
<details class="case case--compact" id="fraud-model" data-collapse="phone" open>
  <summary class="case__summary">
    <h3 class="case__title" id="fraud-model-title">Fraud loss-ratio model</h3>
    <p class="case__fig"><b class="fig">321%</b> <span class="small">lift in recovered fraud losses</span></p>
    <p class="case__meta small">CGI · 2021 – 2023 · Data engineer</p>
  </summary>
  <dl class="case__body">…Context · What I did · Outcome · Evidence · Stack (the flagships' order, minus "The hard part")…</dl>
</details>
```

- In the HTML every compact case is `open` (complete with JS off). *Revision 4:* Work's compact cases carry `data-collapse="always"` and fold at every width (the page was 56 % over its length budget on desktop). `disclosure.js` (`initDisclosure(root) → destroy()`) closes `details[data-collapse="always"]` at every width and `details[data-collapse="phone"]` below 40rem at boot, except the one that is (or contains) the URL's hash target; opens the target on `hashchange` and on arrival from another page; reopens the ones it closed when the viewport grows past 40rem; opens all on `beforeprint`. The summary shows a "Show details"/"Hide details" affordance via CSS only (a small-print chevron, `aria-hidden`), and is ≥ 44 px tall. *As built:* on phones always; on wider screens "Show details" appears only while a case is closed (open is the default there). Each compact case's one-line Summary (COPY §3.3) opens its details (`p.case__lede`, first inside them): the always-visible row stays title, figure and meta (ruled, §15.4). The last case (or, from 64rem, the last row of two) ends on its text, not on a row's padding.
- Anchors (`/work/#fraud-model`) still land on the heading under the header.

### 9.10 The compare panel (`?compare=1`; system `compare.js`, `components.css`)

Demo-only switches, small and unobtrusive, never in the production port.

- **Enable:** `?compare=1` stores `sessionStorage['ink:compare'] = '1'` (survives navigation); `?compare=0` removes it. The inline boot script sets `html.is-compare` before first paint. `?palette=…` and `?name=…` also work without the panel (QA).
- **State before paint** (boot script): `html[data-palette]` from `sessionStorage['ink:palette']` (`ink` | `misted` | `rich`; default `misted`), `html[data-name-size]` from `sessionStorage['ink:name']` (`56` | `72` | `96`; default `72`).
- **Panel** (injected by `compare.js` only under `html.is-compare`; not in the HTML):
  ```html
  <aside class="compare" aria-label="Demo switches">
    <p class="compare__row"><span class="compare__label" id="cmp-colour">Colour</span>
      <span role="group" aria-labelledby="cmp-colour">
        <button type="button" data-palette="ink" aria-pressed="false">Ink</button>
        <button type="button" data-palette="misted" aria-pressed="true">Misted</button>
        <button type="button" data-palette="rich" aria-pressed="false">Rich</button></span></p>
    <p class="compare__row" data-only="name"><span class="compare__label" id="cmp-name">Name</span>
      <span role="group" aria-labelledby="cmp-name">…56 · 72 · 96…</span></p>
    <button type="button" class="compare__hide">Hide</button>
  </aside>
  ```
  The Name row shows only when the page has an `h1.name` (re-checked on `route:swap`). Position: `fixed`, **bottom-right** (revision 4: bottom-left covered Home's photo and the résumé's timeline), `inset-block-end: max(.75rem, env(safe-area-inset-bottom))`, `inset-inline-end: var(--gutter)`; a "Compare" button (`aria-expanded`, `sessionStorage['ink:compare-open']`) folds it to that one button, folded by default below 40rem; paper at 0.94 with a 1 px `--mist-2` outline; 14 px Commissioner; the pressed button gets the brush mark; buttons ≥ 44 px tall. Above content, below the header (`z-index: calc(var(--z-header) - 1)`). Hidden in print. "Hide" sets `?compare=0` behaviour.
- **Effects:** Colour → `html[data-palette]`, `sessionStorage`, `landscape.setPalette(p)` and the `ink:palette` event (`detail: { palette }`). Name → `html[data-name-size]`, `sessionStorage`, the `ink:name` event. CSS:
  ```css
  html[data-name-size="56"] { --fs-name: clamp(2.5rem, 2.125rem + 1.52vw, 3.5rem); }   /* 40 @ 390 → 56 @ 1440 */
  html[data-name-size="96"] { --fs-name: clamp(3rem, 2.0625rem + 4.38vw, 6rem); }      /* 50 @ 390 → 96 @ 1440 */
  ```
- **Port:** not ported (README).

### 9.11 Links and buttons (round 3, kept)

`a.brush` with its resting 1 px `--rule-rest` underline and the dry-brush draw on hover; `.brush--display` for large titles. `.ink-btn` brush swatch: at most one per screen, label Commissioner 560 at `--fs-body`, `min-height: 48px`. "View résumé (PDF)" markup unchanged (new tab, hidden suffix, never `download`).

**Tap targets (as built, `layout.css`):** a standalone link shorter than 44 px (an `.actions` row's quiet link, a `.more` "… →" line, the closing's `.next`) gets an invisible hit area, `::before { position: absolute; inset-inline: 0; inset-block: min(0px, 50% - 22px) }`: centred on the link, max(44 px, its own height) tall. Nothing moves and the brush marks stay where they are. Header, story map, footer links and buttons are 44 px boxes. **Policy: links inside a sentence** (Say hello, the résumé's product-page link, the Note's citations) take WCAG 2.2 SC 2.5.8's inline exception: they cannot reach 44 px without overlapping lines, and the key ones repeat at 44 px in the footer and on Contact.

---

## 10. Pages

### 10.0 Page config

| Route | `data-page` | stretch · scene | distance | presence | horizon | strip | misted strength | Figures (4a) | Next |
|---|---|---|---|---|---|---|---|---|---|
| `/` | `home` | 0 · peak | level | 1 | .6 | home | .55 (azurite-led) | traveller, hut (draft) | Work |
| `/work/` | `work` | 1 · river | deep | .8 | .55 | sub | .40 hills + light colour on the town | river market at the rainbow bridge (draft) | Résumé |
| `/writing/` | `writing` | 3 · lake | level | .6 | .5 | sub | 0 (ink) | — | Résumé |
| `/writing/what-is-an-ai-agent/` | `article` | 3 · lake | level | .45 | .35 | doc | 0 | — | Writing |
| `/resume/` | `resume` | 4 · terraced fields | level | .5 | .35 | doc | .55 (pale malachite on the terraces) | — | Contact |
| `/contact/` | `contact` | 5 · crossing, mostly water | level | .9 | .5 | sub | .50 (indigo water) | — | Home |
| `/404.html` | `not-found` | 6 · lone-peak | high (revision 4: one tall host over a low far range) | 1 | .5 | sub | 0 | — | (none) |
| `/about/` | stub | — | — | — | — | — | — | — | — |

Stretch 2 (the road out of town) has no page; it is crossed in pans and drawn in the story map.

### 10.1 Home `/` (owner: home). About 3 desktop screens, 4 on phones. COPY §1.

| # | Block | Markup |
|---|---|---|
| 1 | Strip (hero) | `header.strip.strip--home` (§6): `h1.name` "Qijin Xu", `p.lead` (the lead), `p.lead` (the second line), `p.hero__actions` with one `.ink-btn` "See the work →" and `a.brush.brush--rest` "Résumé"; `p.strip__note` "Draft art". Keep-out on `.strip__text`. |
| 2 | About me | `section.hello.wide` (§9.2): photo, h2 "About me", four paragraphs, the signature (§9.3) |
| 3 | What I work on | `section.sec`: h2, `ul.rows` of three rows (titles link to Work's anchors), `p.more` "All six projects →" |
| 4 | Now | `section.sec.now` (§9.4) |
| 5 | Writing | `section.sec`: h2 "Writing", one row (meta "Note · April 20, 2025", title link, description), `p.more` "All writing →" |
| 6 | Say hello | `section.sec`: h2, one paragraph with the email, LinkedIn and GitHub links |
| 7 | Closing | `nav.closing` "Next: Work" (§8) |

```
HOME 1440 × 900                                                    HOME 390 × 844
+--------------------------------------------------------------+   +------------------------------------+
| [seal] Qijin Xu                      Work  Résumé  Contact   |   | [seal] Qijin Xu  Work Résumé Contact| 56
|~~~~~~~~~~~~~~~~~ STRIP 522, the mountain, misted blue-green ~|   |░ STRIP 118: hut, traveller ≥ 12 px ░|
| Qijin Xu (72)                 mist  /\  peaks (azurite)       |   | Qijin Xu (45)                      |
| Lead AI/ML Architect at CGI's AI …  /  \ [hut]                |   | Lead AI/ML Architect at CGI's AI … |
| … production AI for banks and insurers … (20)   . traveller   |   | Right now I'm leading an agent …   |
| Right now I'm leading an agent …                              |   | [ See the work → ]   Résumé        |
| [ See the work → ]  Résumé                       Draft art    |   | +--------------------+             |
|~~~~~~~~~~~~~~~~~ fades into the paper ~~~~~~~~~~~~~~~~~~~~~~~|   | | colour, 252 wide   |  photo top  |
| (photo 280, wall = paper)   About me (26)                      |   | |                    |  ≈ y 620    |
|  colour, fades at shoulders  I've spent the last five years … |   +------------------------------------+
+--------------------------------------------------------------+   then About me, signature, What I work on,
 then signature, What I work on, Now, Writing, Say hello,           Now, Writing, Say hello, closing, footer
 closing "Next: Work" (240 of painting), footer
```

Home's WebSite and ProfilePage JSON-LD go in its page head (COPY §8.3, §8.4); `og:type` = `profile`. No page module unless needed.

### 10.2 Work `/work/` (owner: work). ≤ 5 desktop screens, ≤ 6 at 1280, ≤ 8 on phones. COPY §3.

| # | Block | Markup |
|---|---|---|
| 1 | Strip | `header.strip.strip--sub`: h1 "Work" (`.page-title`) + `p.lead` intro; `p.strip__note` "Draft art" |
| 2 | Six projects | `section.sec.wide` with the table (§9.6) as the index, **on the first screen** at 1440 (all six rows in view; first row near y 520) |
| 3 | How I build | `section.sec`: h2, `p.lead` (the statement, plain ink full stop), `p` (its line), `figure.diagram.wide` (§9.7) with caption and "Read as steps" |
| 4 | Two flagship cases | `article.sec.case.case--flagship.has-rail#rag-assistant` and `#proprietary-language-agent`: h2 title, `p.case__meta.small`, `p.case__fig` (`b.fig` at `--fs-figure` + small note), `p.case__summary`, `figure.diagram.wide`, then `dl.case__body`: Context · What I did · (The hard part: OMITTED until Jack writes it) · Outcome · Evidence · Stack; margin notes after the paragraph that first uses each term |
| 5 | More work | `section.sec`: h2, four `details.case.case--compact[data-collapse="phone"][open]` (§9.9), anchors unchanged |
| 6 | In the open | `section.sec#open`: h2, intro, `<!-- @data:projects -->…<!-- /@data:projects -->` (generated, §13.6), `p.more` "All repositories on GitHub →" |
| 7 | Side projects | OMITTED (needs Jack's words about his game tools) |
| 8 | Closing | `nav.closing` "Next: Résumé" |

```
WORK 1440 × 900                                                    WORK 390 × 844
+--------------------------------------------------------------+   +------------------------------------+
| [seal] Qijin Xu                     _Work_ Résumé  Contact   |   | [seal] Qijin Xu _Work_ Résumé Cont.|
|~~~~ STRIP 360 ~~~ mist ~~~ blue-green hills, roofs, crowd ~~~|   |░ STRIP 169: the bridge, its crowd, ░|
| Work (40)              mist   ___ the rainbow bridge ___ boat |   |░ the boat lowering its mast         ░|
| Most of what I build runs inside client systems … (20)        |   | Work (32)                          |
|~~~~~~~~~~~~~~~~~~~~ fades into the paper ~~~~~~ Draft art ~~~|   | Most of what I build runs …        |
| Six projects, newest first                                    |   | Six projects, newest first         |
| Years       Project                Outcome          Evidence  |   | 2025 – present                     |
| 2025 – now  Agent for a …          Projected 50% …  Client …  |   | Agent for a proprietary …          |
| … five more rows, all in view …                               |   | Projected 50% less manual work …   |
+--------------------------------------------------------------+   +------------------------------------+
```

`pages/work.js` only if something remains (the sticky index is long gone). CollectionPage JSON-LD unchanged. Each case keeps its `id`, so every link from Home lands.

### 10.3 Résumé `/resume/` (owner: resume). Prints to two pages. COPY §5.

| # | Block | Markup |
|---|---|---|
| 1 | Strip | `header.strip.strip--doc` art only (the shore in pale malachite; terraces in 4b), no text inside |
| 2 | Document header | `header.cv-head`: h1 "Qijin Xu" (`.page-title`, 40/32), `p.cv-head__role` "Lead AI/ML Architect" (`--fs-lead`, 560), `p.cv-head__contact.small` (Goes by Jack · Toronto, ON, Canada · email · GitHub · LinkedIn · site; the no-phone comment stays, digit-free), `p.cv-head__actions`: `.ink-btn` "View résumé (PDF)" (no arrow) · `a.brush.brush--rest` "JSON Resume" · `p.small` the note |
| 3 | Summary | `section.sec`: h2 + paragraph |
| 4 | Experience | `section.sec`: h2, `ol.timeline`: per role `li.timeline__entry`: the start year at the left rail (`span.timeline__year`, `--fs-figure`, ink-2, `aria-hidden`; the full dates are in the text), then h3 role title, `p.small` organisation · place · dates (`<time>`), `ul` bullets (body). One vertical dry-brush stroke joins the years (`svg` at 50 % annotation ink, **drawn still**, no `data-draw`). Rail 96 px (56 below 640), gap 24, text ≤ 680 |
| 5 | Skills | `section.sec`: `dl` of four groups |
| 6 | Education | `section.sec`: one entry, dates 2017 – 2021, then "GPA 3.9/4.0 · Dean’s List" only (the honour's wording is still pending: never add one) |
| 7 | Certifications and awards | `section.sec`: four lines (two certifications, CGI Impact Award 2024 with its project, CGI Impact Award 2026 with **no** project) |
| 8 | Closing | `nav.closing` "Next: Contact" (hidden in print) |

- **Print** (`@media print`, the source of `/resume.pdf`): no strip, closing, header, footer, story map, actions or compare panel; ink only; the timeline's years and stroke print in ink; two pages on Letter and A4; `break-inside: avoid` per entry; the print footer line (COPY §5).
- `pages/resume.js` keeps only "settle before print". After any résumé change: `python3 tools/build-pdf.py` (2 pages, phone gate).
- `resume.json` per COPY §8.7.

### 10.4 Contact `/contact/` (owner: misc). COPY §6.

| # | Block | Markup |
|---|---|---|
| 1 | Strip | `header.strip.strip--sub`: h1 "Contact" + `p.lead` intro (in the mist on wide) |
| 2 | The address | `section.sec.contact` (`data-veil`): `p.small` "Email", `p.contact__email > a.brush` qxjack@gmail.com at `--fs-h2` (26), Commissioner 560, + "Copy email" button (`pages/contact.js`, live-region "Copied"); then `dl.contact__list`: GitHub · Freedom-Jack, LinkedIn · Qijin Xu, Résumé · View résumé (PDF); `p.small` the location line |
| 3 | For organisers | OMITTED (needs Jack's OK and bios) |
| 4 | Closing | `nav.closing` "Next: Home" (the crossing, framed on his mountain on the far shore) |

`pages/contact.js` stays a default-export module (copy button).

### 10.5 Writing `/writing/` (owner: misc). COPY §4.1.

Strip (`strip--sub`, the lake) with h1 "Writing" + intro; `section.sec` with `ul.rows` (one row: meta "Note · April 20, 2025", title link, description); closing "Next: Résumé".

### 10.6 The Note `/writing/what-is-an-ai-agent/` (owner: misc). COPY §4.2.

Strip (`strip--doc`, the lake, no text inside); h1 (`.page-title`, 40/32) below it; byline `p.small` "Qijin Xu · Note · April 20, 2025 · Typos fixed October 10, 2026" (the name links to `/`; two `<time>` elements); the body in `.prose` (680, reading progress stroke kept; no contents nav); the end: the author's seal colophon (round 3; its one-shot stamp is not text, so it stays), the author line, `.ink-btn` "More about Qijin" → `/`; then the closing "Next: Writing" (it replaces the separate "All writing" link).

- **The typo fixes (Jack, 10 Oct: "fix all typos"):** paste the body from COPY §4.2 exactly; its "Typo fixes" list records every change. Grammar and spelling only: Jack's voice, meaning, structure and claims are unchanged, and the Google Cloud quotation is never edited.
- **BlogPosting** (COPY §8.5): add `"dateModified": "2026-10-10"`; `datePublished` stays 2025-04-20; `author` stays the `#person` reference (the Person's `url` is `/`).
- The table keeps its round-3 markup (labelled by its h3); only cell words change.

### 10.7 404 (owner: misc). COPY §7.

Strip (`strip--sub`, the lone peak, its path into mist) with h1 "Page not found" + the line (plain ink full stop); `p` with "Back to home" (`.ink-btn`) and "See the work" (`a.brush.brush--rest`). No closing. `robots: noindex`.

### 10.8 `/about/` redirect stub (owner: misc). COPY §2.

A minimal standalone page (no shared blocks, so `sync-shared.py` skips it): `<meta http-equiv="refresh" content="0; url=/">`, `<link rel="canonical" href="https://my-website-freedomjack.vercel.app/">`, `<meta name="robots" content="noindex">`, an inline `location.replace('/')`, the `<title>` and the one visible line from COPY §2, styled by an inline `<style>` with paper and ink only. Delete `assets/css/pages/about.css`. `/about/` leaves the sitemap; README and COPY §8.9 record the 301 for the build. Every internal link to `/about/` is changed (the Note's byline and button, llms.txt).

---

## 11. Content moves

| Round 3 | Demo 4a |
|---|---|
| Home hero: "Qijin (Jack) Xu", role line, positioning | Home strip: "Qijin Xu", the lead and the second line (COPY §1.1) |
| Home statement + line ("A model is only as good as the system around it.") | Work › How I build, as its lead and line; no cinnabar |
| Home ledger (six projects) | Work's table (already there); Home keeps three teasers in "What I work on" (the one deliberate repeat) |
| Home "How I build" diagram | Work › How I build |
| Home vista; Work vista; About vista | Removed; each page ends on its closing scene |
| Home "In brief" (grey byline, 56-word bio, "More about me") | Home "About me": colour photo, Jack's words (DRAFT), signature |
| Home "Latest writing" | Home "Writing" (same entry) |
| Home closing question (a consulting pitch) | Home "Say hello" (collaboration and speaking) + the closing "Next: Work" |
| About: h1, lead, bio | Retired (Home's About me); `/about/` → `/` |
| About: the vertical timeline | Résumé › Experience, with the résumé's words, drawn still |
| About: "What I work with" (five plain-language groups) | Retired; the résumé's four skill lines stay |
| About: education and credentials | Résumé only (education 2017 – 2021; awards 2024 and 2026) |
| About: end buttons | Retired |
| Work: Kind column | Dropped (four columns fit the first screen) |
| Work: "Read the résumé" end button | The closing "Next: Résumé" |
| Work: "In the open" from a hand allowlist | Auto-discovered at build time; the allowlist becomes optional overrides |
| Contact line ("If you're building AI that has to hold up in production…") | The intro for collaboration and speaking |
| Contact: LinkedIn text "Qijin (Jack) Xu" | "Qijin Xu" |
| Note byline "Qijin (Jack) Xu" → `/about/`; button "More about Jack" → `/about/`; "All writing" link | "Qijin Xu" → `/`; "More about Qijin" → `/`; the closing "Next: Writing" |
| Note body, typos kept verbatim | Typos fixed (COPY §4.2 list); "Typos fixed October 10, 2026" in the byline; BlogPosting `dateModified` 2026-10-10 |
| Résumé: education dates pending; one Impact Award | Education 2017 – 2021 (GPA and Dean's List only); CGI Impact Award 2024 and 2026 on the résumé, `resume.json` and Person `award` |
| Résumé h1 "Qijin (Jack) Xu" | "Qijin Xu", with "Goes by Jack" in the contact line |
| Footer: "© 2026 Qijin (Jack) Xu · Toronto, Canada"; six-page scroll map | "© 2026 Qijin Xu · Toronto"; the five-place story map |
| Header: seal only as the home link; nav Work · About · Résumé · Contact | Seal + "Qijin Xu" as one link; nav Work · Résumé · Contact |
| Person JSON-LD name "Qijin (Jack) Xu"; ProfilePage on `/about/` | Name "Qijin Xu", alternate names "Jack Xu" and "Qijin (Jack) Xu"; ProfilePage on `/` |

---

## 12. Landscape API additions (engine)

Keep the existing contract of `mountLandscape()` and its handle. **Add only.** Land no-op stubs of every new option, method and export first (phase 0), so system and pages can call them on day one.

### 12.1 New mount options

```ts
mountLandscape(canvas, {
  // round 3, unchanged: stretch, distance, presence, veil, arrival, fromStretch, fromDistance, fromPresence,
  //   panDuration, arrivalMs, veilStrength, grain, tide, ambient, pointer, quality, reducedMotion, wake, horizon, still
  strip?:   Element | null,          // [data-landscape="strip"]: window 1 (§7.1). Alias: head (round 3)
  closing?: Element | null,          // [data-landscape="closing"]: window 2. Alias: descend (round 3)
  keepout?: Iterable<Element>,       // [data-landscape="keepout"]: text blocks; each applies to the window it overlaps
  palette?: 'ink' | 'misted' | 'rich',   // default 'misted' (§12.3)
  figures?: boolean,                 // default true; false hides figure layers (lab, QA)
  horizonMedia?: string,             // default '(min-width: 64rem) and (min-aspect-ratio: 1/1)' (§7.4)
  widthClass?: 'wide' | 'tablet' | 'phone' | 'short',   // lab / QA only: frame as this class whatever the viewport
  // vistas: ignored from now on
})
```

### 12.2 New and changed handle methods

```ts
setPalette(p: 'ink' | 'misted' | 'rich'): void
    // one governed scene redraw per visible window; figure layers re-tinted or redrawn (cached per palette);
    // dispatches 'landscape:palette' on the canvas. Still / reduced motion: switches at once.
prepare(stretch: number): Promise<void>
    // draws that stretch's figure layers (strip and closing framings, current width class and palette)
    // off the main thread; resolves when ready, at once if it has none or they are cached. Idempotent.
rebind(o: { strip?, closing?, keepout?, veil?, wake?, horizon? }): void
    // after a route swap (existing method, new keys); re-reads geometry and framings
setState(s: 'hero' | 'horizon' | 'closing' | null): void
    // QA override: 'hero' forces hzK 0, 'horizon' forces 1, 'closing' forces the closing framing in the strip; null = scroll-driven
stats(): { …round 3,
  palette, widthClass: 'wide' | 'tablet' | 'phone' | 'short',
  windows: { strip: { top, height, visible }, closing: { top, height, visible } },
  hzK, figures: Record<number, 'none' | 'pending' | 'ready'>, figureMs, figureSlots, framing: { strip, closing } }
```

`panTo`, `sweep`, `setVeil`, `setStill`, `refresh`, `pause`, `resume`, `destroy` keep their meaning; `destroy()` removes every new listener, worker and texture.

### 12.3 Palettes (`landscape/palette.js`, DOM-free, exported as `PALETTES` and `PIGMENTS`)

Strength per scene (0 = ink only):

| Scene (stretch) | ink | misted (default) | rich |
|---|---|---|---|
| peak (0, Home) | 0 | .55 | .75 |
| river (1, Work) | 0 | .40 (hills) | .60 |
| path (2, the road) | 0 | .30 | .45 |
| lake (3, Writing) | 0 | 0 | 0 |
| shore (4, Résumé) | 0 | .55 (malachite-led, on the terraces; revision 4, was .25) | .75 |
| crossing (5, Contact) | 0 | .50 (indigo water; revision 4, was .20) | .70 |
| lone-peak (6, 404) | 0 | 0 | 0 |

- **Mountains** take misted blue-green, in the manner of *A Thousand Li of Rivers and Mountains*: azurite toward the crests, malachite on the lower slopes, graded by height above each plane's foot; far planes take the misted values, near planes approach the deep values; **the mist always lies over the colour**, and colour dissolves into the plane's mist band exactly as the ink does. At "misted", pigment covers at most about a quarter of a strip's pixels. Target the look of row B of `_notes/r4/img/sketch-colour.png` ("misted") and row C ("rich"); never row D (ochre glaze).
- **The town, boats and people** take light colour over ink: grey tile (ink grey at 45–60 %), timber brown on bridge, boats and timber, pale indigo on clothes (25–35 %), some white robes, willows in misted malachite. No red, yellow, gold or beige. Under `ink`, figures are drawn in ink greys only.
- **Never:** pigment under a keep-out, in the horizon, in the story map, or anywhere near text. Pans interpolate strength between scenes.

### 12.4 Strip framing per page and width (`compose.js` data + `framingAt()`)

The engine owns framing; pages only provide boxes. `framingAt(stretch, widthClass, { width, height, keepoutRight }, kind: 'strip' | 'closing') → { worldLeft, worldTop, scale, focus: [x, y] }` is DOM-free (lab and QA can call it).

| Scene | Focus (stretch-local) | wide (≥ 1200) | tablet (640–1199) | phone (< 640) | closing framing |
|---|---|---|---|---|---|
| peak (Home) | the traveller on the path at u ≈ .71; the hut on a ledge at u ≈ .76 | today's scale (one stretch = the viewport width); the scene's right edge at the screen's right; vertical band from 8 % above the host summit to the path's foot; focus ≥ `keepoutRight + 180` | 1440 CSS px per stretch; focus at 62 % of the width, its ground at 80 % of the height | 1224 CSS px per stretch, so **the traveller is ≥ 12 CSS px tall**; focus at 60 % width | the road running down to the right, toward the river town (u ≈ .95 → 1.1) |
| river (Work) | the bridge's centre, u ≈ .565 | the wireframe framing (right edge at right; the town and bridge right of the mist ramp); **at 1280 the bridge's left foot is ≥ `keepoutRight + 180`** (no per-width hacks: the keep-out rule decides) | 1440 px per stretch, bridge at 55 % | 1440 px per stretch, bridge centred; the whole arch inside the strip | the town's far end and the road on toward the fields (u ≈ .85 → 1.05) |
| lake (Writing, Note) | the open water and far shore, u ≈ .5 | today's lake, shore at the right | centred on the water | centred on the water | the shore where the road resumes (u ≈ .9) |
| shore (Résumé) | the slopes above the shore, u ≈ .7 | a low band (doc strip): far shore and slopes | same | same | the shore stepping down toward the crossing (u ≈ .95) |
| crossing (Contact) | the water before the jetty, u ≈ .55 | open water; the far-shore echo of the home peak at right | centred | centred | **the echo of his mountain across the water** (u ≈ .84) |
| lone-peak (404) | the peak, u ≈ .78 | the peak at right, its path into mist | centred | centred | — |

Short screens use the phone scale unless a scene has its own `short` framing. Each width class is re-framed on resize across a breakpoint (figures redrawn for the new class, cached).

**As built (engine, accepted by the lead on 10 Oct for beauty and legibility; `compose.js` is the data):**
1. **Home, phone:** 600 CSS px per stretch (not 1224): a wider album leaf with the crag, the hut and the traveller, the figures drawn larger (`big`) so he stays ≥ 12 (13) px tall.
2. **Work, short (sideways phones):** 1000 px per stretch (not the phone's 1440): at 80 px tall the arch was a sliver.
3. **Résumé, phone:** 760 px per stretch: its host hill is a plateau that reads as a mesa when seen close.
4. **Wide document strips** (`strip--doc`: Résumé, the Note) frame the band around the scene's focus (`framingAt(…, { doc: true })`), where the tall strip's top line showed only sky.
5. **Home, short (lead):** 900 px per stretch, focus at 70 % width: its view ends near u 1.06, before the river town's figure layer (u 1.08), so the 80 px sliver stays on his mountain with the hut and the traveller.
6. **Work's scene (stretch 1) is recomposed** as a river with a near bank, misty far feet (`shore: 0`) and a range of peaks behind the town; the story map (`stripSVG`) shows a river at stretch 1 too.
7. `framingAt`'s box takes an optional `doc` flag; frames take optional `keepU` (the leftmost figurative point the keep-out rule keeps clear) and `short`. All additive.
8. **(Revision 4) Band framings: no strip cuts a summit.** A narrow frame may give `band: [y0, y1]` (+ `u`, `fx`, `uMin`, `uMax`, `fbIn`, `slack`; `cband`/`cu`/`cfx` for the closing; `cscale` keeps a closing's own scale): `bandFrame()` sets the summits `y1` just under the top feather and the ground `y0` above the bottom one, fitting the scale to the box within 0.8–1.15 of the class's nominal `scale` (the figure layers are drawn at the nominal one). Wide frames may give `band`, `docBand`, `docScale` and `right`. Before stretch 0 and after stretch 6 the world is a quiet far range in mist (no wrap-around). Home, phone: ≈ 270 px per stretch, the whole mountain with the hut and the traveller (≥ 12 px; 12.4 at 360), ending at u 1.06 before the town; tablet ≈ 620. Work's hills behind the town are a little lower, so their summits sit inside the wide strip.
9. **(Revision 4) Each place its own silhouette and crop:** the Résumé's terraced fields (`STRETCHES[4]` low rounded hills; `tech.terr`: banded slopes with dry lips and paler wet fields in malachite; ridges row 8), Contact's crossing mostly water (the far shore high in the band, the water in pale indigo with indigo ripples), Writing's still lake (`water.mirror`: the reflection whole, barely torn, few strokes), the 404's single peak (`STRETCHES[6]`, the high distance). Canvas2D draws the terraces, the mirror and the indigo too.

### 12.5 Figure layers (draft) (`landscape/figures.js`, `landscape/figures.worker.js`)

Canvas2D brushwork in Song oblique projection, ported and raised from `_notes/r4/prototypes/sketch/ink.js` and `things.js` (study LingDong Huang's MIT-licensed *{Shan, Shui}\** for structure only; keep its notice in any ported file). Seeded and deterministic. Data per scene in `compose.js` (`SCENES[k].figures`). Composited in the present pass inside the window: a faint bleed halo (blurred copy under the crisp one), paleness by depth, the plane's mist band over the feet, grain on top, and the drifting mist passing over the figures (an alpha mask), so they are painted *into* the paper, never pasted on.

- **Home (stretch 0): the traveller and the hut.** A tiny traveller in a white robe with a cone hat and a staff, leaning slightly, on a path drawn as a **soft wash** (not dashes) at the foot of the host peak, climbing toward the hut. The hut stands on a ledge, **grounded** (a ledge stroke and mist at its foot), roof in grey tile or timber-brown thatch, never beige, a dotted tree beside it. *As built:* the ledge is seated below the lowest crest point across its whole width (the crest climbs steeply there, so a ledge at the hut's centre overhung the sky), in the saddle where the near ridge meets the crag, with a pale mist band at its foot.
- **Work (stretch 1): the river market at the rainbow bridge.** The river runs across the band (reserved paper); the town faces it from the far bank in broken rows (Song forms: gently lifted hip-gable roofs in grey tile, open shopfronts, parasol stalls; blank signs), mist swallowing half the town; the **heavy woven-timber arch** of the bridge (timber brown), its crowd standing still; moored boats with mat roofs and one coming down to the bridge **lowering its mast**; stronger willows on the near bank.
- Draft quality is acceptable in 4a, but fix the sketch's known faults first (proposal Appendix B): vector-clean houses in identical rows, the thin bridge arc, beige roofs, weak willows, the floating hut, the dashed path. Broken dry lines, irregular geometry, wash pooling, seeded variety.
- **Kitsch guards:** Song-period forms only; no red lanterns, pagodas, dragons or gold; no text on signs (the seal stays the only character); nothing figurative within 40 px of text; people never walk in 4a (no figure motion at all in 4a; water shimmer, smoke and willow sway are 4b).
- Budget: ≤ 15 ms per layer on desktop (allow 3–5× on a mid-range phone), once per (stretch, class, palette); never per frame; never while scrolling.

### 12.6 The horizon handover (engine contract; behaviour in §7.4)

Round 3's single scroll state (`head` → 'hero' → 'horizon', driven by the head's bottom edge) becomes two independent layers on the one canvas, so the strip's scene and the horizon never fight:

| Layer | Driven by | Contents | Never |
|---|---|---|---|
| Window scenes (strip, closing) | each window's live rect, 1:1 with the page (§7.2) | the page's scene, palette, figures, drift, wake | painted outside its window's box |
| Horizon band | `hzK` (§7.4) and the `horizonMedia` query | round 3's 'horizon' composition (crests in the bottom 25 % of the viewport) at `horizon` presence, ink only, mist at rest | pigment, figures, wake, drift; showing through text (the sections' veils thicken paper mist over it); on phones or portrait tablets |

- `hzK` is computed once per frame from the two rects already read for the windows (no extra layout reads); it eases at most 0.12 per frame, so a fast scroll never pops the band in.
- **Veils are viewport rects and follow their text:** every scroll frame re-measures them (as round 3 did). *Fixed in integration:* 4a had re-measured them only on resize, so after a scroll the stale veils washed whatever window slid under them (the "pale closing" reports on every page) and could leave text over unveiled horizon ink. Keep-outs and the note stay box-relative and are measured on measure frames only. While the strip and the band are both partly on screen they share one paper: the strip's bottom feather fades to paper, and the band rises from below; they never overlap in the same pixels.
- `rebind({ strip, closing, horizon })` after a swap re-reads both rects and recomputes `hzK` before the first present, so a page entered mid-scroll (back/forward) shows the right state at once.
- `setState('hero')` forces `hzK = 0`, `'horizon'` forces 1 (the strip still paints in its box), `'closing'` puts the closing framing into the strip (lab); `'vista'` is accepted and ignored.
- `stats()` reports `hzK`, `windows`, and `framing`; with `hzK = 0` and no window visible, `frames` stops increasing (§7.4).
- Reduced motion and Still: `hzK` snaps to 0 or 1 at the half-way point (as round 3's horizon did); Canvas2D draws the band once, statically.
- Aliases for one round: `head` is read as `strip`, `descend` as `closing`; `vistas` is ignored.

### 12.7 Other exports

`sceneAt(stretch)` unchanged. `stripSVG({ from, to, width, height })` unchanged for 4a (greys; the lake and crossing as water lines); `marks` is reserved for 4b. `PALETTES`, `PIGMENTS`, `framingAt` new.

### 12.8 Lab (`_lab/landscape/`)

Add `strips.html`: every page's strip and closing at the four width classes side by side, with `?palette=`, `?figures=0`, `?class=`, `?keepout=580`, the text-hidden "tell the places apart" sheet, and the keep-out chroma check (§6.3 acceptance). Keep the existing lab pages working.

---

## 13. System contracts

### 13.1 Template and shared blocks (`_template.html`, `sync-shared.py`)

- `@shared:head`: the boot script (adds the compare, palette and name state of §9.10 and clears `ink:transition`); modulepreloads (drop `mist-reveal.js`, `scroll-map.js`; add `story-map.js`, `compare.js`, `disclosure.js`, `landscape/palette.js`, `landscape/figures.js`); fonts (unchanged families: Commissioner `wght,FLAR`, Sofia Sans Condensed 600–800, Sofia Sans Extra Condensed 900, the seal glyph subset); CSS; the Person JSON-LD (COPY §8.2, `data-shared`).
- `@shared:top`: skip link, the landscape canvas, the ink filters (seal-stone, ink-feather, ink-bloom, ink-arrive), the header (§4).
- `@shared:bottom`: the footer (§5). The `.ink-wash` canvas is removed.
- `sync-shared.py` sets `aria-current` on the home link, the nav and the story map per page (the Note: Writing `"true"` in the map, nothing in the nav; the 404: none), and skips redirect stubs (`about/`, `writing/building-modular-ai-agents/`).

### 13.2 `main.js`

- `config` gains `palette` (from `html[data-palette]`, default `misted`).
- The landscape elements for a `<main>`: `{ strip: main.querySelector('[data-landscape="strip"]'), closing: main.querySelector('[data-landscape="closing"]'), keepout: main.querySelectorAll('[data-landscape="keepout"]'), veil: main.querySelectorAll('[data-veil]'), wake: main.querySelectorAll('[data-wake]'), horizon: config.horizon }`.
- Mount with those, plus `stretch, distance, presence, palette, still, arrival: 'bloom'`.
- `bootChrome()`: seal, nav, header, story map, still, compare (only under `html.is-compare`), arrival (the name settle only), landscape, router.
- `bootMain(main)`: brush links, ink buttons, margin notes, disclosure, `afterLayout()`, diagrams, the page module, then `landscape.rebind(…)`. No mist-reveal.

### 13.3 Router (`router.js`)

Round-3 contract unchanged, plus: after a prefetch is parsed, `landscape.prepare(Number(dest.body.dataset.stretch))`; on swap, `rebind` with the new elements (§13.2); the compare panel refreshes on `route:swap`; the `?transition=` switch is gone. `/about/` is a stub with a meta refresh: the router never intercepts links to it (no internal link remains anyway).

### 13.4 Transition (`transition.js`)

Exit (160 ms) and enter (260 ms) as round 3; `travel()` = `panTo` + `sweep`; the quiet form under reduced motion and Still. `edge()` and `variant()` are deleted.

### 13.5 Small modules (system)

| Module | API |
|---|---|
| `header.js` | `initHeader() → { reset(), destroy() }`; arms on the strip art's bottom (§4); solid look |
| `story-map.js` (replaces `scroll-map.js`) | `initStoryMap({ strip }) → { update(), destroy() }`; `strip` resolves to `stripSVG`; ticks for the five places |
| `compare.js` | `initCompare({ getLandscape }) → { destroy() }` (§9.10) |
| `disclosure.js` | `initDisclosure(root) → destroy()` (§9.9) |
| `margin-note.js` | threshold 75rem (§9.8) |
| `arrival.js` | the name settle (§9.1) and the 2.5 s safety net only |
| `diagram.js`, `brush-link.js`, `ink-button.js`, `seal.js`, `still.js`, `nav.js` | unchanged APIs (`nav.js` also marks the home link) |

### 13.6 "In the open", auto-discovered at build time (`tools/sync-projects.py`, `data/`)

Jack: *"it should be able to look at my GitHub page and discover and update automatically… don't slow down the website just for live updating repos."* So the list is fetched **at build time** and baked into static HTML. **Never** call GitHub from the visitor's browser; zero client JS for it.

- `python3 tools/sync-projects.py --discover`: GET `https://api.github.com/users/Freedom-Jack/repos?per_page=100&sort=pushed` (public, no token, `User-Agent` set, 10 s timeout). Writes the filtered snapshot to `data/github.json` (name, description, size, fork, archived, pushed_at, created_at, topics, html_url, sorted), then renders. On a network error it leaves the page untouched and exits non-zero (never blanks the section).
- `python3 tools/sync-projects.py`: renders offline from `data/github.json` + `data/projects.json`. `--check`: offline, exits 1 if the markup is stale.
- `data/projects.json` becomes **optional overrides**: `{ "updated", "repos": [ { "name", "line"?, "year"?: number, "group"?: "featured" | "recent" | "early", "order"?: number, "hidden"?: true, "demo"?: "https://…" } ] }`, one object per line. It is served publicly, so it never names an excluded repo; the deny-list lives in the tool. Migrate today's four entries into it with their `line` and `year` (2020, 2019, 2019, 2019), so the Early-work table reads exactly as now.
- **Year** shown for a repo: its override `year`, else the year of `created_at`. "Updated {Month YYYY}" always comes from `pushed_at`.
- **Rules** (in order): public; not a fork; not archived; size > 0; **deny** `job-application` always and `my-website` (case-insensitive; hidden until its history is clean); **skip placeholders** (size < 10 KB, or a description matching `^(tba|to be (announced|anounced)|coming soon)\.?$`, case-insensitive); needs a description or an override `line`; the line is the override's, else the GitHub description, trimmed, ending with a full stop, ≤ 160 characters, refused if it has CJK or a phone pattern.
- **Groups:** a repo with the topic `featured` (or override `group: "featured"`) first; **Recent** = pushed within the last 24 months of the build date, newest first; **Early work** = the rest, newest first then by name, headed "Early work, {first}–{last}" when the last year ≤ 2020, else "Earlier work, {first}–{last}". A group with no entries renders nothing (no heading, no placeholder).
- **Markup** between the markers: Recent/featured as `h3` + `ul.rows` (title link to the repo, the line, `p.row__meta.small` "Updated {Month YYYY}" from `pushed_at`, "Live demo" link if any); the older group as `h3` + `table.table.table--quiet` (Year · Repository · What it is, caption visually hidden).
- **Today's expected output** (API checked 9 Oct 2026: 8 public repos, no forks, no topics): Recent: nothing (`ai-stock-insight` is 7 KB, `northstar-agent-memory` is 1 KB with the description "To be anounced", `My-website` and `job-application` are denied). So no "Recent" heading renders. Early work, 2019–2020: world_qlearning, aStar-pathFinding, cryptology, reddit-tfidf, with the existing lines as overrides. The skipped repos appear automatically once real code lands (and a description or an override line exists).
- **Build note (README):** the Next.js version fetches at build time in a server component with ISR (`revalidate: 86400`) or a daily Vercel cron rebuild, optionally adding pinned repos via GraphQL with a server-side token. Never client-side.

### 13.7 `tools/build-photo.swift` (system builds it; home runs it)

`swift tools/build-photo.swift <source.jpg> <out.jpg> [--crop x,y,w,h] [--size 720x900] [--sat .90] [--warm .02] [--shadow-tint -.02,.01,.02] [--lift auto] [--quality .75]`: Core Image, the recipe of §9.2, writes no metadata, prints the output size in KB and the wall's minimum channel. Home tunes the flags and judges the result; the final file must be reproducible with the flags recorded in the tool's header comment. Until it lands, home may lay out with the old file.

### 13.8 `tools/build-pdf.py`

Unchanged (phone gate, two pages). Run by resume after any résumé change.

---

## 14. File ownership, coordination and phases

### 14.1 Ownership (each file has exactly one writer)

| Owner | Files |
|---|---|
| **engine** | `assets/js/landscape/**` (incl. new `palette.js`, `figures.js`, `figures.worker.js`; framing and figure data in `compose.js`), `_lab/**` |
| **system** | `assets/css/tokens.css`, `base.css`, `layout.css`, `effects.css`, `components.css`; every `assets/js/*.js` outside `pages/` and `landscape/` (incl. `main.js`, `router.js`, `transition.js`, `header.js`, new `story-map.js`, `compare.js`, `disclosure.js`; deletes `scroll-map.js`); `assets/svg/**`; `_template.html` and therefore every `@shared:*` block in every page; the generated `@data:projects` block; `tools/**` (`sync-shared.py`, `sync-projects.py`, `build-pdf.py`, new `build-photo.swift`); `_tools/**`; `data/**`; `README.md` |
| **home** | `index.html` (outside the shared blocks), `assets/css/pages/home.css`, `assets/js/pages/home.js` (only if needed), `assets/img/**` (the photo file, made with `build-photo.swift`; deletes the old `qijin-xu.jpg`) |
| **work** | `work/**` (outside the shared and `@data:projects` blocks), `assets/css/pages/work.css`, `assets/js/pages/work.js` |
| **resume** | `resume/**`, `resume.json`, `resume.pdf` (built with `tools/build-pdf.py`), `assets/css/pages/resume.css`, `assets/js/pages/resume.js` |
| **misc** | `contact/**`, `writing/**` (the index, the Note, the old-URL stub), `404.html`, `about/**` (the new stub), `llms.txt`, `sitemap.xml`, `robots.txt`, `assets/css/pages/contact.css`, `writing.css`, `article.css`, `not-found.css` (deletes `about.css`), `assets/js/pages/contact.js`, `writing.js`, `article.js` |
| **design lead** | `COPY.md`, `SPEC-R4A.md` (builders read only) |
| **lead (QA)** | `<scratchpad>/compliance.py`, `<scratchpad>/linkcheck.py` (the 4a allow-list, §15.3) |
| nobody | `_studies/**`, `_notes/**`, `SPEC-R3.md` (the round-3 record), everything outside `design-demo/` |

### 14.2 Coordination rules

- Only system edits `_template.html` and the shared blocks; page owners resync **their own** files with `python3 tools/sync-shared.py --only <file>`; only system runs the full sync (phase 0 and phase 3).
- Re-read before editing (a sync can rewrite your file); never overwrite a whole page file you did not just read.
- Missing shared pieces: write the markup exactly as specified, use `var(--token, value)` fallbacks, report the gap. Never create shared CSS or JS in your own files; never edit another owner's file.
- Page CSS: layout only (placement and spacing with tokens). No new colours, fonts, weights, shadows or motion.
- Words only from COPY.md. A gap: leave it out and report it.

### 14.3 Phases

| Phase | Who | Deliverable |
|---|---|---|
| 0 (first) | engine | No-op stubs: the new options, `setPalette`, `prepare`, `framingAt`, `PALETTES`, `PIGMENTS`; aliases `head` → `strip`, `descend` → `closing` |
| 0 (first) | system | Round-4a tokens; `layout.css` (frame, header, strip, closing, footer, story map, `.sec`, `.wide`, `.has-rail`); `components.css` (`.hello`, `.signoff`, `.now`, `.rows`, `.case*`, `details` cases, `.compare`, `.strip__note`); `_template.html` (header, footer, boot script, Person JSON-LD); `main.js` wiring; `header.js`, `story-map.js`, `compare.js`, `disclosure.js`, `arrival.js`; edge variant removed; `build-photo.swift`; one full sync |
| 1 | home, work, resume, misc | Pages built to §10 against the contracts |
| 1 | engine | Windows (§7), framing (§12.4), palettes (§12.3), the horizon handover, figure layers for Home and Work (§12.5), `prepare()`, the lab |
| 1 | system | `sync-projects.py --discover`, router `prepare`/`rebind`, `margin-note.js` threshold |
| 2 | engine | Beauty pass on the two draft scenes at 390 first, then 1440 and 1280 |
| 3 | system + lead | Full sync; retire unused round-3 CSS classes and tokens; README updated to these contracts (incl. the Next.js port rows for the strip, closing, palette and build-time GitHub list); global QA (§15) |

---

## 15. QA and acceptance

### 15.1 Every builder, on their own pages

```sh
S=<scratchpad>
python3 $S/bin/cdp.py '[{"viewport":[1440,900,1,false]},{"goto":"http://localhost:4173/work/"},{"wait":2600},{"shot":"'$S'/shots/<you>/work-1440.png"},{"console":true}]'
python3 $S/bin/cdp.py '[{"viewport":[390,844,3,true]},{"goto":"http://localhost:4173/work/"},{"wait":2600},{"shot":"'$S'/shots/<you>/work-390-full.png","full":true}]'
```

Sizes: 1440 × 900, 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844 (DPR 3), 375 × 667, 360 × 800, 320 × 640 (header and footer), 844 × 390 (sideways phone). Also reduced motion, no WebGL (`CDP_ARGS="--disable-3d-apis"`), no JS (`CDP_ARGS="--blink-settings=scriptEnabled=false"`), print for the résumé, and `?compare=1` with each palette and name size. **Open and judge every image.**

### 15.2 The 4a budget (measure and report every row)

| Measure | 1440 × 900 / 1280 × 720 / 390 phone |
|---|---|
| Words on Home's first screen (name, lead, photo top) | ≥ 120 / ≥ 100 / ≥ 55 |
| Words on a subpage's first screen | ≥ 150 / ≥ 120 / ≥ 90 |
| Display type ÷ readable text (area) | Home ≤ 0.25; others ≤ 0.10 |
| Largest text: the name / page titles | ≈ 72 / 68 / 45; ≤ 40 / 40 / 32 |
| Type sizes per screen (chrome excluded) | ≤ 4 |
| Space between sections (the visible gap, measured as `_notes/r4/prototypes/proposal-check/run-v2.py` does) | 56–80 / 56–72 / 40–56 px |
| Work's length (screens) | ≤ 5 / ≤ 6 / ≤ 8 |
| The colour photo starts on the first screen | yes, at all three (target top ≈ 618 / 536 / 620 px) |
| Text animating on scroll | 0 (`document.querySelectorAll('[data-reveal]').length === 0`; `[data-arrive]` only on `.name`) |
| Sideways scrolling | none from 320 to 1440 px |
| Contrast | body ≥ 7:1, small print ≥ 4.5:1, on the measured real background (strip text included) |
| Tap targets | every link and button ≥ 44 × 44 px |
| Header | one row at 360; wraps below 340 |
| LCP (localhost, 390, 4× CPU throttle) | name or photo; target ≤ 2.5 s, report the number |

### 15.3 Feature acceptance

- **Strips:** each page opens on its own strip; text never sits on colour (§6.3 chroma check); on wide screens the title sits in mist and nothing figurative comes within 40 px of it; at 1280 Work's bridge clears the intro by ≥ 180 px; on phones Home's traveller is ≥ 12 CSS px tall and Work's whole arch is inside the strip; the six strips with text hidden at 390 read as different places (the lead runs the "tell the places apart" sheet from the lab).
- **Mist:** drift visible in the strip's sky at rest; the wake parts the mist around a fine pointer in the strip (≥ 3/255 over sky) and never under text (≤ 0.5/255); nothing moves under reduced motion or Still; after 45 s idle the loop sleeps; with no window on screen and no horizon, the engine requests no frames (`stats().frames` stops increasing).
- **Horizon:** desktop only; fades in as the strip leaves and out before the closing; ink only; never figures or pigment.
- **Closing:** every page but the 404 ends on its own scene and "Next: …" to the right destination (§8); the pan starts from the closing when its link is clicked.
- **Palettes:** `?palette=ink|misted|rich` switch live through the panel without a reload; no yellow, gold or beige in any palette (sample the town's roofs and paths); the story map stays grey.
- **Photo:** colour, alive, edges dissolve into the paper (≤ 2 ΔE ring), shoulders fade; one `<img>`; file 720 × 900, ≤ 80 KB, no metadata.
- **Signature:** "— Jack" with the small seal, right-aligned at the end of About me.
- **In the open:** `sync-projects.py --discover` then `--check` pass; today's output matches §13.6; the browser makes no request to `api.github.com`.
- **Router:** round-3 checks still pass (swap ~160 ms, readable ~350 ms, focus on the h1, announcer, back/forward scroll, five round trips with no duplicate behaviour); `prepare()` is called on hover; figures never pop in.
- **Compliance and links:** `python3 $S/compliance.py` and `python3 $S/linkcheck.py` pass with the lead's 4a allow-list: exactly one `<img>` (index.html, `/assets/img/qijin-xu-colour.jpg`, 720 × 900, no metadata), `Person.image` = that file's absolute URL, two seal uses on Home (header and signature), the `/about/` stub allowed, and **`_notes/**` skipped like `_studies/**`** (the research notes hold the Chinese painting titles "for Jack's reading only" and the wireframe screenshots; today they are the scan's only failures; they are never linked and never ported). `resume.pdf` regenerated, two pages, phone gate passed.
- **The Note:** every change in COPY §4.2's typo list is in the page and nothing else differs (diff the page's text against COPY); the byline shows both dates; BlogPosting has `dateModified` 2026-10-10.
- **Names:** in visible text (and `alt`, `aria-label`), "Jack" appears exactly twice site-wide: the signature "— Jack" on Home and "Goes by Jack" on the Résumé (and so in the PDF). The GitHub handle **Freedom-Jack** (Contact's GitHub line, the résumé's `github.com/Freedom-Jack`, repository URLs) is an account name, not his name, and does not count. Never inside or next to the name. "Qijin (Jack) Xu" appears only in `<title>`, meta descriptions, `og:title`/`og:description` and JSON-LD `alternateName`; `llms.txt` says "Qijin Xu, known as Jack". The home link's accessible name is "Qijin Xu, home".
- Zero console errors on every page (the "GPU stall due to ReadPixels" warnings are screenshot readback).

### 15.4 The lead's budget rulings (10 October, integration)

Measured with the audit's `measure.js` (as `run-v2.py` does) plus the lead's probes (`<scratchpad>/lead/budget.py`, `gaps.py`). Where a §15.2 row collides with the complete COPY or with a structure Jack approved, the reading wins and the row is reported, not forced:

1. **Work's length** (7.8 / 9.7 / 10.0 screens against ≤ 5 / 6 / 8). *Revision 4:* "More work" now folds at every width and the two flagship diagrams fold on phones: **6.24 / 7.70 / 8.34**, still over and put to Jack (README: accept; fold How I build's drawing too, 7.40 on phones; fold the flagships' Evidence and Stack, 5.83 / 7.19 / 7.83; or trim copy).
2. **Words on a subpage's first screen:** a page whose whole content is on its first screen (Contact, Writing, the 404) **meets the row's intent** (everything is readable at once); its count (15–46) is reported, not padded. With the doc strip at 180 px, the Résumé (148 / 118 / 94) and the Note (146 / 116 / 126) are 2–4 words short at 1440 and 1280; accepted.
3. **Display type ÷ readable text:** measured on the first screen and per page. Short pages (Contact, Writing, the Note, the 404) exceed 0.10 on wide screens only because a 40 px title and 26 px headings sit over little copy; type stays at the spec's sizes. Single screens that are mostly a diagram (Work) exceed it because their 26 px h2 counts as display; accepted.
4. **Type sizes per screen (≤ 4):** met on Work, the Note and the 404. Accepted at 5: **Home** (the fifth is the demo-only "Draft art" label, 14 px, removed in 4b), **the Résumé** (a document's real hierarchy: name 40, section 26, role 20, body 18, meta 14), **Contact** (title 40, the email 26, the intro 20, rows 18, labels 14) and **Writing** (only while "Next" shares its first screen). Figures now cap at 26 px (= h2), which removed Work's only 5-size screen and one size from every résumé screen.
5. **Space between sections** is measured between sections. The strip → first section (≈ 93–113 at 1440) and the last section → the closing's link (≈ 165–180 at 1440, the closing scene's own band) are not between-section gaps.
6. **Compact cases' one-line Summary** (COPY §3.3) opens the details, not the summary row (the always-visible row stays title, figure, meta).

---

## 16. Open items

**Resolved by Jack (10 Oct), built in 4a:** the title is **Lead AI/ML Architect** everywhere (site, résumé, PDF, JSON-LD, `llms.txt`); a second **CGI Impact Award, 2026** (no project named); education **2017 – 2021**; the LinkedIn URL is **https://www.linkedin.com/in/qijin-x-4899671a9/** on every page, `sameAs`, `resume.json`, `llms.txt` and the PDF (no "pending LinkedIn" note anywhere); **fix the Note's typos** (COPY §4.2); "In the open" is **auto-discovered at build time** (§13.6); Contact is for **collaboration and speaking**.

**Still for Jack** (also in COPY §10): approve or rewrite the DRAFT words (the hero lead, About me and Now are drafted from his answers; What I work on and Say hello from existing facts); "The hard part" for the two flagship cases; his game tools (Side projects); whether he wants "For organisers" bios on Contact; whether the 2026 award's project may be named; the degree's honour wording; the photo reshoot; the glossary notes on Work; the Writing intro; Contact's closing going "Next: Home" (the ferry back across to his mountain); certification verification links; the domain.

**Decisions taken in this spec** (flag if the lead disagrees):
1. **Stretches keep their round-3 numbers**, so the engine's seams and compositions stay: Home 0, Work 1, the road 2 (no page), Writing 3, Résumé 4, Contact 5, 404 6. The journey reads: the mountain → the river town → the road out of town → the still lake just off the road → the terraces stepping down to the shore → the ferry. Work → Résumé crosses three stretches under the sweep's mist.
2. **The story map has visible labels**, so "Writing" is not repeated in the footer's links line (the proposal listed it there because its wireframe map had no labels).
3. **Résumé and the Note use a low "doc" strip with the title below it at every width**: documents read on paper.
4. **The photo is a single JPEG** (no AVIF `<picture>`), to keep the reshoot a one-file swap and the compliance rule of one image element.
5. **The 404 has no closing scene**: its path ends in the mist.
6. **Diagram strokes keep their one-shot draw-in**; they are not text.
7. **Titles use " · " after the search phrase** ("Qijin (Jack) Xu · Work"), the proposal's own form, replacing round 3's " — ". `WebSite.name` and `og:site_name` are "Qijin Xu" (the name), with "Qijin (Jack) Xu" and "Jack Xu" as `alternateName` (COPY §8).
8. **The Note's byline shows "Typos fixed October 10, 2026"**, so the visible page and `dateModified` agree.
9. **Compact cases use the flagships' label order** (Context · What I did · Outcome · Evidence · Stack), so every case reads the same way.
10. **(Integration, 10 Oct) Wide sub strips set their title block low in the band** (§6.3); Home's stays centred.
11. **(Integration) One shared hit area** makes every standalone link ≥ 44 px tall without moving anything; inline links in sentences take WCAG 2.5.8's inline exception (§9.11).
12. **(Integration) The budget rulings of §15.4.**
