# Design demo: Qijin Xu, site v2

A static HTML/CSS/JS demo of the redesigned site, built to be approved before the real Next.js build.
There's no build step and no framework: vanilla ES modules, CSS custom properties and one WebGL2 landscape.

**Round 4a (October 2026): a calm page inside a living painting.** Reading first, then the art. A traditional,
readable personal site on cool paper (18 px text, 40 px page titles, the name at 72 px), where **every page opens
on a short painted strip of its own place** in one story-scroll painting and ends on its closing scene. The binding
spec is `SPEC-R4A.md` (the approved plan: `_notes/r4/proposal.md`); every word comes from `COPY.md` (draft 3).

- **Words:** every word comes from `COPY.md` (the single source of truth). Leave out `{{PENDING}}` and `OMITTED` items: build nothing there. Items marked DRAFT are built exactly as written.
- **Hard rules:**
  - The seal is the only place a Chinese character may appear, and it may only be the seal glyph (the header's seal and the About-me signature's). That covers visible text, alt text, comments, file names and metadata.
  - No phone number anywhere, the PDF included (Jack decided 2026-10-09). No street address. No PMP. Public email: qxjack@gmail.com.
  - The only PDF is `/resume.pdf`, printed from `/resume/` by `tools/build-pdf.py`. Never link or copy the OLD résumé file from the Next.js repo.
  - People, buildings, boats and bridges live **inside the painting only** (drawn by the engine on canvas), never as icons, SVG, UI or HTML illustrations. Text never sits on colour; pigment never becomes a UI colour; cinnabar is the seal's only. No yellow, gold, beige or cream. No cards, frames, pills, bento, glass, decorative gradients, icon rows or shadows.
  - "Qijin Xu" is the name everywhere visible. "Jack" appears visibly only in the signature "— Jack" (Home) and "Goes by Jack" (Résumé). "Qijin (Jack) Xu" lives only in titles, meta and JSON-LD `alternateName`.

## Run it

```sh
cd design-demo
python3 _tools/serve.py 4173       # then open http://localhost:4173/
```

`_tools/serve.py` is `python3 -m http.server` with two demo-only differences: an unknown path gets the designed `/404.html` with a real 404 status (the way Vercel serves it), and every response is `no-store`, so edits show on reload.
Serve the folder at the web root: every URL is root-relative (`/assets/...`), so pages work at any depth, and folder routes work (`work/index.html` is `/work/`).

Demo switches (remembered for the browser session; never in the production port):

| URL parameter | Effect |
|---|---|
| `?compare=1` / `?compare=0` | the compare panel (bottom right, over empty paper) on / off: Colour Ink · Misted · Rich, and Name 56 · 72 · 96 (Home only); "Compare" folds it to one button (folded by default on phones); "Hide" = `?compare=0` |
| `?palette=ink\|misted\|rich` | the painting's colour without the panel (default misted) |
| `?name=56\|72\|96` | the home name's size without the panel (default 72) |
| `?router=off` / `?router=on` | the demo router off (plain full-page navigations) / on again |
| `?slow=5` / `?slow=1` | route changes play 5× slower (to study frames) / normal |
| `?y=1200`, `?y=#id`, `?t=400` | scroll before effects start; freeze the name's ink settle at 400 ms (`demo.js`) |

## The pages

Every page boots through `main.js` from its `<body data-*>`: one place along the one painting each (SPEC-R4A §10.0).

| Route | `data-page` | stretch · scene | distance | presence | horizon | strip | misted colour | Next | Owner |
|---|---|---|---|---|---|---|---|---|---|
| `/` | `home` | 0 · peak (the traveller and the hut, draft) | level | 1 | .6 | home | .55 | Work | home |
| `/work/` | `work` | 1 · river (the market at the rainbow bridge, draft) | deep | .8 | .55 | sub | .40 | Résumé | work |
| (no page) | | 2 · path (the road out of town) | | | | | .30 | | |
| `/writing/` | `writing` | 3 · lake (a still reflection) | level | .6 | .5 | sub | 0 | Résumé | misc |
| `/writing/what-is-an-ai-agent/` | `article` | 3 · lake | level | .45 | .35 | doc | 0 | Writing | misc |
| `/resume/` | `resume` | 4 · terraced fields | level | .5 | .35 | doc | .55 | Contact | resume |
| `/contact/` | `contact` | 5 · crossing (mostly water) | level | .9 | .5 | sub | .50 | Home | misc |
| `/404.html` | `not-found` | 6 · lone-peak | high | 1 | .5 | sub | 0 | (none) | misc |
| `/about/`, `/writing/building-modular-ai-agents/` | redirect stubs (`noindex`, meta refresh; 301s in the build) | | | | | | | | misc |

Also served: `/resume.pdf` (generated), `/resume.json` (JSON Resume), `/llms.txt`, `/robots.txt`, `/sitemap.xml`, and `/data/*.json` (the build-time GitHub snapshot and Jack's overrides).
`/_tools/components.html` is an internal specimen sheet of the shared components (noindex, never linked); its header, footer and canvas are the real shared blocks, so it shows the strip, closing and components painted by the real engine.

## Folder map

```
design-demo/
  index.html  work/ writing/ resume/ contact/ 404.html   one index.html per route
  about/                              the old About URL: a redirect stub to /
  writing/what-is-an-ai-agent/        the Note; writing/building-modular-ai-agents/ is its redirect stub
  resume.pdf  resume.json  llms.txt  robots.txt  sitemap.xml
  data/github.json                    the build-time snapshot of Jack's public repos (tools/sync-projects.py --discover)
  data/projects.json                  Jack's optional overrides for "In the open" (one repo per line)
  _template.html                      the commented page skeleton; its @shared blocks are copied into every page
  COPY.md  SPEC-R4A.md  SPEC-R3.md    every word / the round-4a spec / the round-3 record (design lead; builders read only)
  tools/sync-shared.py                copies the shared blocks into the pages (--check, --only)
  tools/sync-projects.py              "In the open": GitHub at build time -> static HTML in work/index.html (--discover, --check)
  tools/build-pdf.py                  prints /resume/ to resume.pdf, with the phone-number gate
  tools/build-photo.swift             Home's colour photo from the source selfie (crop, grade, wall into paper, no metadata)
  _tools/serve.py                     the demo server; _tools/components.html: the component specimens
  assets/
    css/
      tokens.css        colours, the ink ladder, weights, the 4a type scale, space, the frame, breakpoints, strip heights,
                        motion, layers, font fallbacks (round 3's scale retired in phase 3)
      base.css          reset, paper, the landscape canvas, typography, focus, skip link, print, forced colours
      layout.css        the frame, header (+ the returning header), the painted strip, sections, rows, the margin rail,
                        the closing scene and "Next", the footer and its story map
      effects.css       brush links, the ink button, ink rows, the seal stamp, the name's ink settle, draw-ins, route changes
      components.css    the photo and About me, the signature, Now, figures, cases, table, brush diagram, margin notes,
                        the compare panel (round 3's components retired in phase 3)
      pages/<page>.css  one file per page, layout only
    js/
      main.js           boots the chrome once and every <main> (bootMain); exports config, ready, bootMain, site, destroy
      router.js         DEMO ONLY: the same-document router (fetch, swap <main>, head, page CSS, history, focus, announce)
      transition.js     exit / travel (pan + mist sweep) / enter; the quiet form; restore
      header.js         the returning header          story-map.js    the footer's story map and "you are here"
      still.js          "Still the landscape"         nav.js          aria-current, the stacked header
      compare.js        DEMO ONLY: the compare panel  disclosure.js   cases that fold to their summary (Work)
      margin-note.js    margin notes and their toggles                 diagram.js      data-draw strokes
      brush-link.js  ink-button.js  arrival.js (the name's settle)  seal.js  demo.js
      mist-reveal.js    retired (round 3's text reveals), not loaded by main.js
      ink-figures.js, ink-transition.js   retired (round 2), not loaded
      pages/<page>.js   page modules (export default { init, destroy }), only where a page needs one
      landscape/        the generative ink landscape (engine): index.js is the only entry
    svg/                swash, brush, brush-2, brush-trace, arrow, wash-row, paper grain and fibres (no-landscape
                        fallback), ridge-hint (no-JS strip fallback), seal (icon)
    img/qijin-xu-colour.jpg   Home's photo (720 × 900, no metadata); a reshoot replaces this one file (build-photo.swift)
  _lab/landscape/       the engine's lab (noindex): index.html, strip.html, strips.html (every page's strip and closing),
                        wake.html (the cursor's wake alone, with the drift stopped, for measuring it)
  _studies/  _notes/    the hero studies and the round-4 research (reference only; never linked, never ported)
```

## Making a page

1. Start from `_template.html`. Its head, header, footer (story map, links, "Still the landscape", route announcer), canvas, ink filters and the Person JSON-LD are shared blocks.
2. Fill the page head from COPY.md §8.1. Set `<body data-page data-stretch data-distance data-presence data-horizon>` (table above).
3. Write the page inside `<main id="main" tabindex="-1" class="frame">`:
   - it **opens on its strip**: `header.strip.strip--home|sub|doc` > `div.strip__art.bleed[data-landscape="strip"][data-wake][aria-hidden="true"]` (an EMPTY box) + `div.strip__text[data-landscape="keepout"][data-veil="0.85"]` with the h1 (`h1.name` on Home, `h1.page-title` elsewhere) and its lead (+ `p.strip__note.small` "Draft art" on Home and Work in 4a). Résumé and the Note use `strip--doc` and put the h1 below the strip, outside it;
   - then sections: `section.sec[data-veil] > h2.sec__title` + content (reading column 680; `.wide` 960);
   - it **ends on its closing scene** (every page but the 404): `nav.closing[aria-label="Next page"] > p.closing__next[data-landscape="keepout"] > a.next` + `div.closing__art.bleed[data-landscape="closing"][data-wake][aria-hidden="true"]`.
   - No text fades in on scroll: no `data-reveal`, and no `data-arrive` except `data-arrive="name"` on Home's h1.
4. Page layout goes in `assets/css/pages/<page>.css`, linked as `<link rel="stylesheet" href="/assets/css/pages/<page>.css" data-page-style>`. Layout only: placement and spacing with tokens; no new colours, fonts, weights, shadows or motion.
5. Page behaviour (optional) goes in `assets/js/pages/<page>.js`, declared as `<script type="module" src="/assets/js/pages/<page>.js" data-page-module></script>`:
   ```js
   export default {
     init({ main, config, landscape, signal }) { … },   // landscape: Promise<handle|null>; signal aborts after destroy()
     destroy() { … },                                    // undo everything init() did; safe to call twice
   };
   ```
   No side effects at import. Register listeners with `{ signal }`. Never keep references to an old `<main>`, never import `main.js`, never call `landscape.panTo/destroy/pause/setState/setPalette`. A page without behaviour has no module and no tag. **A page script without `data-page-module` is treated as legacy: the router falls back to full page loads to and from that page.**
6. Page-specific JSON-LD goes in the page head (WebSite and ProfilePage on Home, CollectionPage on Work, BlogPosting on the Note). The shared Person JSON-LD carries `data-shared` and is never swapped.
7. Resync your page's shared blocks if the template changed: `python3 tools/sync-shared.py --only <your/page.html>`.

### Shared files
`tokens.css`, `base.css`, `layout.css`, `effects.css`, `components.css`, every `assets/js/*.js` (not `pages/`, not `landscape/`), `assets/svg/*`, `_template.html`, `tools/**`, `_tools/**`, `data/**`, and the blocks marked `<!-- @shared:… -->` in every page belong to the design-system owner. A change there is made in the shared file (or in `_template.html`), then `python3 tools/sync-shared.py` rewrites the shared blocks of every page (and of `_tools/components.html`) and sets `aria-current` on the home link, the header nav and the story map (`--check` verifies; `--only <file>…` limits it; redirect stubs, which have a `<meta http-equiv="refresh">`, are skipped). Missing shared pieces are reported to the owner, never created in page files; use `var(--token, value)` fallbacks meanwhile.

## Type, space and layout (SPEC-R4A §2)

| Role | Face | Size (phone → from 640) | Ink |
|---|---|---|---|
| The name (Home only) | Sofia Sans Extra Condensed 900 | `--fs-name`: 44–45 → 72 (one clamp to 1440) | ink-1 |
| Page titles (h1) | Sofia Sans Condensed 780 | `--fs-title` 32 → 40 | ink-1 |
| Section headings (h2), "Next: …", the email | Commissioner 700 | `--fs-h2` 22 → 26 | ink-1 |
| Item headings (h3), row titles | Commissioner 700 | `--fs-item` 18 → 20 | ink-1 |
| Lead | Commissioner 400 | `--fs-lead` 18 → 20 | ink-1 |
| Body | Commissioner 400, FLAR 18 | `--fs-body` 17 → 18 | ink-1 |
| Small print | Commissioner 400, tabular | `--fs-small` 14 | ink-3 (7.7:1); ink-4 on plain paper only |
| Figures (case summaries, timeline years) | Sofia Sans Extra Condensed 900 (`.fig`) | `--fs-figure` 22 → 26 (= h2, so a figure never adds a type size) | ink-2 |

- Commissioner uses three weights only: `--w-body` 400, `--w-ui` 560, `--w-strong` 700. At most four type sizes per screen (chrome excluded). Figures inside sentences are `<b>` at text size.
- Frame `--frame` 1200, gutter 20 / 16 (≤ 360) / 32 (from 640) / 40 (from 1200); reading column `--measure-read` 680, wide blocks `--measure-wide` 960, strip title block `--strip-text-max` 580, rail `--rail-w` 300 after `--rail-gap` 48; header `--header-h` 56 / 64 / 48 (short). At 1440: frame x 120–1320, column x 120–800, rail x 848–1148.
- Space: `--space-section` 42 → 52 → 58 (the margin; the visible gap the budget measures is ≈ 41 / 56 / 56 after a line, ≈ 55 / 72 / 72 after rows), `--space-head` 12 / 14, `--space-item` 24 → 32, `--space-para` .9em, `--space-strip-text` 20 → 28; rows are hairlines (`border-top: 1px solid var(--rule)`, padding .875rem), never boxes.
- Breakpoints: phone `< 40rem`, tablet `40–74.99rem`, wide `≥ 75rem`, short `max-height: 31.25rem and max-width: 74.99rem`, tight header `≤ 23.4375rem`, header wrap `< 21.1875rem`, narrow gutter `≤ 22.5rem`. The engine reads its own horizon query (`min-width: 64rem and min-aspect-ratio: 1/1`).
- Strip heights (`--strip-home/-sub/-doc`, `--closing-h`): phones 96–120 / 110–170 / 88–110 / 160; tablet 220 / 220 / 160 / 200; wide 440–540 / 300–360 / 180 / 240; short 80 / 80 / 64 / 96. `svh`, never `vh`.
- **Every strip shows whole mountains** (fixer, 10 Oct): the engine frames each page's strip on a *band* of its scene (`compose.js`, `bandFrame`), its highest summits (the far range included) just under the painted top feather and its ground above the bottom one; only the mist dissolves into the paper. Feathers (engine, CSS px, top / bottom): phones 24 / 26, tablets 30 / 36, wide 40 / 56, a document's strip half of each. On phones Home's strip is a wider album leaf (≈ 270 px per stretch): the whole mountain with the hut and the traveller (≥ 12 CSS px tall), the view ending before the river town; its "Draft art" note sits at the lower left there (the figures are at the lower right).
- Colour: paper `#EFF1EE`, mist `#E3E8E5` / `#D5DCD9`, the ink ladder `--ink-1…5`, `--wash`, `--rule`, `--rule-rest` (every link's resting mark), `--ink-annot`, `--cinnabar` (the seal only). The painting's pigments (azurite, malachite, timber brown) are engine-only (`landscape/palette.js`).

## Shared classes and attributes

| Use | Markup |
|---|---|
| Frame | `main.frame`; `.bleed` (full-bleed child: strip and closing art); `body` clips sideways overflow |
| Strip | above (Making a page). Wide (≥ 1200, home and sub): art and text share one grid cell, the title in the art's mist at the frame's left: Home's block vertically centred, a subpage's **low in the band** (`align-self: end`), so its intro sits close to the content it introduces. Below 1200, and `strip--doc` everywhere: art first, then the text on paper. No JS or no landscape: a faint static ridge hint in the same box (its left side feathers into the paper). `.strip__note` (ink-3) sits in the art's bottom feather, right; the engine finds it by itself (the art's sibling) and keeps paper behind it, so pages add no attribute. |
| Section | `section.sec[data-veil]` > `h2.sec__title` (+ `span.sec__date.small` inside it, e.g. "Now · October 2026"; `.sec__title--item` sets an h2 at item size, e.g. Work's "Six projects, newest first"), `h3.sec__sub` for a sub-heading. Children capped at 680 unless `.wide`. `p.lead`, `.small` (+ `.small--quiet`), `.actions` (a row of one `.ink-btn` and quiet links, baselines shared) |
| Rows | `ul/ol.rows[role=list] > li.row.ink-row` > `p.row__meta.small` (optional, before the title) + `h3.row__title > a.brush.brush--rest` (covers the row) + `p.row__line`; `.rows--plain` without hairlines; then `p.more > a.brush.brush--rest` ("All six projects →") |
| Margin rail | `.has-rail` (wide only): the reading column + the rail, sparse placement in source order (never `dense`). Children sit in the column; `aside.margin-note.small#note-x[aria-label="Note: X"]` right after its paragraph sits beside it in the rail; `.wide` children span both. A case's `dl.case__body` and its `dd`s carry the rail through by subgrid (or any `.rail-sub`), so a note inside a `dd` still reaches the rail; a group of notes there (`.margin-notes`, made by `margin-note.js`) is absolute in its rail cell and runs on down beside the next terms instead of stretching its `dd`. Below 75rem the notes become "Note: X" toggles (`margin-note.js`). |
| Photo + About me (Home) | `section.hello.wide[data-veil="0.88"] > img.hello__photo[width=720][height=900][alt][decoding=async][fetchpriority=high]` + `div.hello__text` (`h2.sec__title`, paragraphs, the signature). Phone: photo 72% (≤ 20rem) above; tablet 240 + 600; wide 280 + 640. `mix-blend-mode: multiply` (the file's white wall becomes the paper) and a fade at the shoulders (bottom 83 → 100%, an 8% side feather only the sweater reaches). No border, radius, caption, grey or vignette. |
| Signature | `p.signoff > span.signoff__name` "— Jack" + `span.seal.seal--sign[aria-hidden]` (the carved seal SVG, mask id `seal-carve-sign`), right-aligned; never stamped |
| Now | `section.sec.now > h2.sec__title` (with `span.sec__date`) + `ul.rows.rows--plain` of three `<b>Label:</b>` lines |
| Figure | `b.fig` (or `span.fig`): Sofia Sans Extra Condensed 900 at `--fs-figure`, ink-2 (a case's summary figure; résumé timeline years) |
| Flagship case (Work) | `article.sec.case.case--flagship.has-rail#id` > `h2.sec__title`, `p.case__meta.small`, `p.case__fig` (`b.fig` + `span.small`), `p.case__summary`, `figure.diagram.wide`, `dl.case__body` (dt Context · What I did · Outcome · Evidence · Stack, each with its dd) |
| Compact case (Work) | `details.case.case--compact[data-collapse="always"][open]#id > summary.case__summary` (`h3.case__title`, `p.case__fig`, `p.case__meta.small`) + `dl.case__body`. Open in the HTML (complete with JS off and in print); `disclosure.js` folds them at every width except the hash target (`data-collapse="phone"` folds below 40rem only). "Show details" / "Hide details" is CSS. |
| Table | `div.table-wrap.wide > table.table[role=table][aria-labelledby]` (caption optional), `thead` heads 560 ink-3, every table cell at 14 px, project `th[scope=row]` 700; hairlines only; below 48rem each row restacks (project at body size, values with their `data-label`, the label hanging in a left column so a cell's text and inline markup stay together; no wrapper needed). `.table--quiet`: the "Early work" table. Year cells never wrap. |
| Brush diagram | `figure.diagram.wide` with `.diagram__art--wide` (container ≥ 60rem) and `.diagram__art--tall` (≤ 85svh on phones), each `role="img"` with its own `<title>`/`<desc>` and `data-draw`; bands, nodes, edges (`pathLength="1"`, `data-order`), labels; `figcaption.diagram__caption.small`, `details.diagram__steps` "Read as steps". `figure.diagram[data-fold="phone"]` (Work's two flagship cases): on phones the drawing folds behind its own "Read as steps" (opened: the steps, then the drawing and caption); How I build keeps its drawing open |
| Closing | `nav.closing` > `p.closing__next` > `a.next` (`span.next__label` "Next:", `span.next__to` the destination with a resting brush trace, `span.next__arrow[aria-hidden]` " →") + `div.closing__art.bleed`. Wide: the link vertically centred in the art's mist; below: the link on paper, then the art. |
| Tap targets | Every standalone link and button is ≥ 44 px: header, story map and footer links are 44 px boxes; a shorter standalone link (`.actions > a.brush`, `.more > a`, `.next`) gets the shared invisible hit area (`::before`, centred, max(44 px, its height), `layout.css`), so nothing moves. **Links inside a sentence** take WCAG 2.2 SC 2.5.8's inline exception (policy): they can't reach 44 px without overlapping lines, and the key ones repeat at 44 px in the footer and on Contact. |
| "View résumé (PDF)" | `<a class="brush brush--rest" href="/resume.pdf" target="_blank" rel="noopener" type="application/pdf">View résumé (PDF)<span class="visually-hidden">, opens in a new tab</span></a>` (on the résumé page: the one `.ink-btn`, no arrow). Never `download`. The router never intercepts it. |
| "In the open" (Work) | `<!-- @data:projects --><!-- /@data:projects -->` inside `section.sec#open` (direct children of the section); `tools/sync-projects.py` fills it |
| Primary button (one per screen at most) | `<a class="ink-btn" href><span class="ink-btn__ink" aria-hidden="true"></span><span class="ink-btn__label">Label<span class="ink-btn__arrow" aria-hidden="true"></span></span></a>` (label 560 at body size, ≥ 48 px) |
| Landscape hooks | `data-landscape="strip"` / `"closing"` (the windows), `data-landscape="keepout"` (text the painting keeps clear of colour and figures), `data-veil[="0–1"]` (mist behind text where the desktop horizon shows; default .72; ≥ .9 a paper reserve), `data-wake` (where the cursor may part the mist: the strip and the closing art). Round 3's `data-landscape="head"` and `data-landscape-descend` are read as aliases for one round. |
| Misc | `.nowrap`, `.visually-hidden` (real accessibility needs only), `data-router="off"` on a link that must load the full page. `.accent` is now plain ink (cinnabar is the seal's only). |

## The chrome

- **Header** (`_template.html`, `layout.css`, `nav.js`, `seal.js`): one home link, the seal and the words "Qijin Xu" (accessible name "Qijin Xu, home"; `aria-current="page"` on `/`, no extra mark), then Work · Résumé · Contact (560, 15 / 16 / 14 px, 44 × 44 targets, the current page brush-marked). One row at 360; below 340 the nav takes a row of its own (`.site-header.is-stacked`). In normal flow, on paper, above the strip.
- **Returning header** (`header.js`): armed once the strip's art has scrolled away (its bottom ≤ 0). Then sticky and hidden; scrolling up ≥ 8 px brings it back **solid** (paper and a 1 px mist-2 rule, no gradient or shadow), down ≥ 8 px slides it away (220 ms; reduced motion: a 120 ms fade); at the very top it is static again. Never `visibility:hidden` or `inert`: focus inside pins it; `scroll-padding-top` keeps anchors clear of it.
- **Story map** (`story-map.js`): the footer's map of the whole painting (the engine's `stripSVG()` of world 0 → 6, drawn as pale ink washes: each plane a gradient of `--strip-ink` at about 26 / 36 / 46 % at its crests dissolving toward its foot, softened, and the whole map feathered into the paper at its left, right and bottom by a mask (`layout.css`); cached in `sessionStorage['ink:strip:v3']`), five labels laid out by geography (`li[data-stretch]`: Home 0 · Work 1 · the road 2, unlabelled · Writing 3 · Résumé 4 · Contact 5; the 404 lies off the map). From 640 the labels sit in a six-column grid under their places and each label's hit area covers its column of the art; below, one row. A small tick hangs over every place; the current page's is taller, in ink-1, with its label's brush mark (`aria-current`: the Note marks Writing `"true"`, the 404 none). Without JS: the labels only.
- **Footer lines**: "© 2026 Qijin Xu · Toronto" · Email · LinkedIn · GitHub · View résumé (PDF), and "Updated October 2026 · Still the landscape" (on one row from 1200). Separators are CSS, only where the links share a line. Every link ≥ 44 × 44.
- **Still the landscape** (`still.js`): a toggle (`aria-pressed`) that stops all ambient motion for the session (`landscape.setStill`) and turns route changes into their quiet form. `sessionStorage['ink:still']`; `html.is-still` is set before first paint. Hidden without JS. Event: `ink:still`.
- **Compare panel** (`compare.js`, DEMO ONLY): see "Demo switches". Colour → `html[data-palette]`, `landscape.setPalette(p)`, event `ink:palette` (`{ palette }`); Name → `html[data-name-size]` (`--fs-name`), event `ink:name` (`{ size }`). Fixed bottom-right (over the empty paper beside the column and the rail; bottom-left it covered Home's photo and the résumé's timeline), under the header, buttons ≥ 44 px; "Compare" (`aria-expanded`, `sessionStorage['ink:compare-open']`) folds it to that one button, folded by default below 40rem; hidden in print.
- **Route announcer**: `#route-announcer` (polite live region in the footer) reads the new page's title after an in-site page change.

## Route changes (demo router)

`router.js` previews the Next.js client navigation in one document: the canvas, header and footer persist and `<main>` swaps.

- **Intercepted:** primary-button clicks with no modifier on same-origin `http(s)` links with no `target` (or `_self`), no `download`, no `type`, no `rel~=external`, no `data-router="off"`, no file extension in the path (so `/resume.pdf`, `/resume.json`, `/llms.txt` load normally), and not a redirect stub (`/about/`, the Note's old URL; any page that turns out to be a meta-refresh stub falls back quietly). A different hash on the same page is left to the browser; the same page without a hash scrolls to the top. Clicking the current page (or Back) while a navigation is still leaving calls it off.
- **Forward:** prefetch on hover, focus or press (cached 30 s), parsed with DOMParser and validated (`main#main`, `body[data-page]`); **as soon as it is parsed, `landscape.prepare(stretch)` draws the destination's figure layers off the main thread**, so they are ready before the pan and never pop in. 0 ms: the old text sinks into the mist (160 ms). ≤ 50 ms: `panTo(dest, 600 ms, cubic-out)` + the pale `sweep()` (the pan plays in whatever window is on screen: a click on "Next" starts it in the closing). 160 ms, in one task: page module `destroy()`, `<main>` replaced, `<body>` `data-*` copied, head swapped (title, description, robots, canonical, alternate, `og:*`, page JSON-LD), the page stylesheet replaced by one adopted `CSSStyleSheet`, `pushState`, instant scroll, nav / story map / header updated, `bootMain()`, then **one `rebind()` with the new strip, closing, keep-outs, veils and wake regions** (`site.targets(main)`); the engine recomputes the horizon handover before its first present. Then the enter (h1 first, 260 ms). Focus moves to the new h1 (or the hash target); the announcer reads the title. Readable ≈ 350 ms.
- **Back/forward:** content swaps at once; the scroll position is restored (and again after margin notes and compact cases fold); the painting pans back in 400 ms. Scroll restoration is manual while the router runs (`history.state = { ink, key, y }`).
- **Quiet form** (reduced motion or Still): a 150 ms cross-fade; the painting cuts at the swap; no sweep.
- **Fallback** to a normal navigation: fetch error, non-OK status other than 404, a page that isn't a site page, a legacy page script, any exception during the swap, or no swap within 3 s.
- **Events** on `document`: `route:start { from, to, kind }`, `route:swap { from, to }`, `route:end { to, readyAt }`, `route:fallback { to, reason }`.
- Full-document navigations keep `@view-transition { navigation: auto; }` with the default 260 ms cross-fade. Round 3's `?transition=edge`, its `.ink-wash` canvas, `edge()` and `variant()` are gone.

## Module APIs

Every `init*` is idempotent (bound elements are skipped) and returns `destroy()` (or an object with `destroy()`).

| Module | API |
|---|---|
| `main.js` | Boots the chrome once and the current `<main>`. Exports `config` (live getters over `<body>` and `<html>`: `page`, `stretch`, `distance`, `presence`, `horizon`, `palette`), `ready` (Promise of `{ config, landscape, entrance }`), `bootMain(main, { module?, rebind?, afterLayout? }) → Promise<destroy>` (order: brush links, ink buttons, margin notes, disclosure, `afterLayout()`, draw-ins, the page module, then `landscape.rebind`), `site` (`landscape`, `landReady`, `nav`, `header`, `storyMap`, `still`, `compare`, `entrance`, `firstMain`, `targets(main)`, `destroyMain()`, `bootMain(main, o)`), `destroy()`. Mounts the landscape with `stretch, distance, presence, palette, strip, closing, keepout, veil, wake, horizon` (+ the aliases `head`, `descend`), `still`, `arrival: 'bloom'`. |
| `router.js` | `initRouter(site) → { navigate(href), destroy() }`. Off under `?router=off`, without `fetch`/`DOMParser`/`pushState`/`replaceSync`/`adoptedStyleSheets`, and on a page with a legacy page script. Feature-detects `landscape.prepare` and `rebind`. |
| `transition.js` | `exit(main, { dir, signal }) → Promise`, `enter(main, { dir, signal }) → Promise`, `travel(landscape, { to, distance, presence, dir, back })`, `cut(landscape, …)`, `restore(main)`, `quiet() → boolean`. No side effects at import. |
| `header.js` | `initHeader() → { reset(), destroy() }` (`reset()` after a swap). |
| `story-map.js` | `initStoryMap({ strip }) → { update(), destroy() }`; `strip` resolves to the engine's `stripSVG`. |
| `compare.js` | `initCompare({ getLandscape }) → { destroy() }` (does nothing unless `html.is-compare`). |
| `disclosure.js` | `initDisclosure(root) → destroy()`: `details[data-collapse="always"]` (folded at every width) and `details[data-collapse="phone"]` (below 40rem). |
| `still.js` | `initStill({ getLandscape }) → { on, apply(handle), destroy() }`; `isStill()`. |
| `nav.js` | `initNav() → { update(), destroy() }`; `markCurrent(links)`; `norm(path)`. |
| `margin-note.js` | `initMarginNotes(root)`: toggles below 75rem (`button.margin-note__toggle[aria-expanded][aria-controls]` + `div.margin-note__body[hidden]`), grouping of consecutive notes; `destroy()` restores the markup. |
| `diagram.js` | `initDiagrams(root)`: every `[data-draw]`; strokes `[data-order]` draw in order once (triggered at 90 % of the viewport, settled by 40 %). Drawn at rest under reduced motion, Still, no JS, print, forced colours. |
| `arrival.js` | `initArrival() → { finish(), seek(ms), release(), destroy() }`: the name's ink settle (#ink-arrive displacement 8 → 0 in 400 ms; the name is readable at first paint); the 2.5 s safety net calls `finish()`. |
| `brush-link.js`, `ink-button.js`, `seal.js` | Constant pen speed and alternating strokes; ink bloom from the pointer and press rings; the header's seal stamped once per session (never the signature's). |
| `landscape/index.js` | (engine; **its JSDoc is the contract**, SPEC-R4A §12) `mountLandscape(canvas, opts)`. New options: the windows `strip` and `closing` (aliases `head`, `descend` for one round), `keepout`, `palette`, `figures`, `horizonMedia`, and `widthClass` (lab and QA only: frame as that class whatever the viewport); `vistas` is ignored. Handle: `+ setPalette(p)` (one governed redraw per window; fires a bubbling `landscape:palette` on the canvas), `+ prepare(stretch) → Promise` (draws that stretch's figure layer off the main thread; idempotent: the router calls it after every prefetch parse and again on navigate), `rebind({ strip, closing, keepout, veil, wake, horizon })` (re-reads boxes and framings, recomputes `hzK` before the first present), `setState('hero'\|'horizon'\|'closing'\|null)` (QA), and `stats()` (+ `palette`, `widthClass`, `windows`, `framing`, `hzK`, `figures`, `figureMs`, `figureSlots`). Exports `stripSVG`, `sceneAt`, `PALETTES`, `PIGMENTS`, `framingAt(stretch, cls, { width, height, keepoutRight, doc }, kind)`. The engine finds the strip's `.strip__note` by itself. Veils are viewport rects and are re-measured on every scroll frame (they follow their text); keep-outs are box-relative. |

**Inline boot script** (first in the shared head; it reads no styles): adds `html.js`, `.is-sealed`, `.is-still` and (demo) `.is-compare`, `[data-palette]`, `[data-name-size]` from the URL and `sessionStorage`; clears the retired `ink:transition`; adds `.is-arrived` after 3 s whatever happens.

## Tools

```sh
python3 tools/sync-shared.py [--check] [--only page.html …]   # shared blocks + aria-current; skips redirect stubs
python3 tools/sync-projects.py --discover                     # GitHub API -> data/github.json -> work/index.html
python3 tools/sync-projects.py [--check]                      # offline render from the snapshot + overrides
python3 tools/build-pdf.py [--out path] [--text]              # /resume/ -> resume.pdf, phone-number gate
swift -O tools/build-photo.swift <source.jpg> <out.jpg> […]   # Home's colour photo (see its header for the flags)
```

- **"In the open" is auto-discovered at build time** (Jack, 10 Oct: "discover and update automatically… don't slow down the website"). `--discover` reads `https://api.github.com/users/Freedom-Jack/repos` (public, no token), writes the candidates to `data/github.json` and renders static HTML between the `@data:projects` markers. **The visitor's browser never calls GitHub; there is zero client JS for it.** Rules: public, not a fork, not archived, not empty; never `job-application` or `my-website` (the deny-list lives in the tool); placeholders skipped (under 10 KB, or described as "TBA" / "To be announced" / "coming soon"; they appear by themselves once real code lands); a description or an override line. Groups: the topic `featured` first; "Recent" (pushed within 24 months of the snapshot); "Early work, {first}–{last}". Empty groups render nothing. `data/projects.json` holds Jack's optional overrides, one per line: `{ "name", "line"?, "year"?, "group"?, "order"?, "hidden"?, "demo"? }`. Today (snapshot 10 Oct 2026): no Recent; Early work 2019–2020, four repos.
- **`build-photo.swift`** (Core Image + ImageIO): crop x 240–2140, y 250–2625 of the selfie (4:5), Lanczos to 720 × 900; a light grade (saturation × .90, warm mid-tones, shadows toward the painting's blue-green, +3 % mid-tone exposure for the multiply); then it **flattens the uneven wall before lifting it** (a wall mask eroded clear of hair, skin, glasses and sweater; the wall's light from a heavy normalised blur; divide, then a knee), so the wall and the ceiling-corner line become pure white and the page's multiply turns them into the paper exactly; JPEG (quality .55 on ImageIO's scale, ~70 KB) with every EXIF/XMP/IPTC/comment segment stripped. It reports the size, the wall's whiteness, the corner-line step and the frame edge's colour difference on the paper. A reshoot is a one-file swap: run it on the new source.
- **`build-pdf.py`** prints `http://localhost:4173/resume/` with headless Chrome into a temporary file, then refuses it if the page source or the PDF's own text contains a phone-number pattern or a `tel:` link, or if the extraction cannot find the name, city and email. Only then is `resume.pdf` written. Run it after any résumé change.

## QA

```sh
S=<scratchpad>
python3 tools/sync-shared.py --check && python3 tools/sync-projects.py --check
python3 $S/bin/cdp.py '[{"viewport":[390,844,3,true]},{"goto":"http://localhost:4173/"},{"wait":2600},{"shot":"/abs/path/shot.png"},{"console":true}]'
python3 $S/compliance.py && python3 $S/linkcheck.py
```

- Sizes: 1440 × 900, 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844 (DPR 3), 375 × 667, 360 × 800, 320 × 640 (header and footer), 844 × 390 (sideways phone). Also reduced motion (`{"reduced_motion":true}`), no WebGL (`CDP_ARGS="--disable-3d-apis"`), no JS (`CDP_ARGS="--blink-settings=scriptEnabled=false"`), print (`{"media":"print"}`), and `?compare=1` with each palette and name size. Zero console errors (the "GPU stall due to ReadPixels" warnings are screenshot readback). No sideways scroll from 320 to 1440. Every link and button ≥ 44 × 44.
- **The 4a budget** (SPEC-R4A §15.2): Home's first screen ≥ 120 / 100 / 55 words (1440 / 1280 / 390), a subpage's ≥ 150 / 120 / 90; display ÷ readable text ≤ .25 on Home, ≤ .10 elsewhere; ≤ 4 type sizes per screen; the photo starts on the first screen at all three; `document.querySelectorAll('[data-reveal]').length === 0` and `[data-arrive]` only on `.name`; Work ≤ 5 / 6 / 8 screens.
- **Router:** listen for `route:*`; check the swap at ~160 ms, `document.activeElement` (the h1), `#route-announcer`, one `<main>`, one adopted sheet, back/forward `scrollY`, a burst of clicks 100 ms apart ending on the last page clicked, and `prepare()` called on hover (wrap `site.landscape.prepare`). Judge frames with `?slow=5`.
- Forced colours can't be emulated by cdp.py; check Windows High Contrast by hand before launch.
- **The lead's QA scripts** (scratchpad, `lead/`): `budget.py` (the §15.2 rows with the audit's `measure.js` plus a probe for tap targets, overflow, the photo and the name rule), `gaps.py` (visible gaps between sections), `contrast.py` (text against its real painted background, text hidden), `router.py` (all 20 ordered pairs of the five mapped pages by real clicks, Writing ↔ the Note, the 404 to every page, back/forward, a click burst, and the pan's stretch sampled every frame), `closing.py`, `shoot.py`, `screens.py`, `sheet.py`.
- **Compliance (4a allow-list):** `compliance.py` skips `_studies/` and `_notes/`; allows exactly one `<img>` (Home's colour photo, 720 × 900, ≤ 80 KB, no metadata), `Person.image` = that photo's absolute URL, seals as the seal's own `<text class="seal__glyph">` (one per page; two on Home, the Note and the specimen sheet), and redirect stubs without a Person block. `linkcheck.py` skips `_notes/` too.

## Status of demo 4a (integration and fixes, 10 October 2026)

Measured in headless Chrome (SwiftShader; quality 0.6, so the art looks softer than on a real GPU) at 1440 × 900 / 1280 × 720 / 390 × 844:

| Budget row (SPEC-R4A §15.2) | Result |
|---|---|
| Home's first-screen words (≥ 120 / 100 / 55) | 148 / 116 / 56: met |
| Subpage first-screen words (≥ 150 / 120 / 90) | Work 175 / 138 / 90 met; Résumé 148 / 118 / 94 and the Note 146 / 116 / 126 (2–4 words short at 1440 and 1280, accepted); Contact 42–45, Writing 46 and the 404 15 show their whole content on screen one (§15.4 ruling) |
| Display ÷ readable text (Home ≤ .25, others ≤ .10) | first screens: Home .09 / .12 / .10, Work .02 / .03 / .03, Résumé .10 / .07 / .03 met; Contact, Writing, the Note and the 404 .16–.30 on desktop (short pages, §15.4) |
| Largest text | name 72 / 68 / 45; titles 40 / 40 / 32: met |
| Type sizes per screen (≤ 4) | Work, the Note, the 404: met. 5 on Home (the demo-only "Draft art"), the Résumé, Contact, Writing (with "Next" on screen one): accepted (§15.4) |
| Space between sections (56–80 / 56–72 / 40–56) | 58–74 / 60–72 / 43–54: met (Work's More work → In the open: 58 / 58 / 42 measured to the folded cases' "Show details" line; the text-node probe reads 89 / 89 / 72 because that line is CSS-generated) |
| Work's length (≤ 5 / 6 / 8 screens) | **6.24 / 7.70 / 8.34** (was 7.8 / 9.7 / 10.0): "More work" now folds at every width and the two flagship diagrams fold behind "Read as steps" on phones. Still over by 1.2 / 1.7 / 0.3 screens: **a choice for Jack** (below) |
| Colour photo on the first screen | top at 616 / 541 / 589: met |
| Text animating on scroll | 0 `data-reveal`; `data-arrive` on the name only: met |
| Sideways scrolling | none at 320, 339, 360, 375, 768, 1024, 844 × 390, 1280, 1440 on every page: met |
| Contrast on the real background | body and lead 15–16:1, small print 7.0–7.8:1, "Next:" 7.1–7.5:1, the Draft-art note 7.0–7.7:1; pigment chroma under strip text ≤ 4: met |
| Tap targets | no standalone link or button under 44 px on any page at the three sizes (inline links in sentences: the WCAG exception): met |
| Header | one row at 360 and up (56 / 64 / 48 px); wraps at 339 and 320: met |
| LCP (390, 4× CPU, cold) | Home median 2.20 s (1.37–2.20; the photo; first paint is the gate), Work 1.32, Résumé 0.82, Contact 1.72, the Note 1.93: met (real phones untested: 4b) |

Also verified: the router across all 20 ordered pairs of the five mapped pages, Writing ↔ the Note, the Note → Home, the 404 → every page, back/forward with scroll restoration and a click burst, at 1440 and 390 (one `<main>`, focus on the h1, the announcer, one adopted sheet, `aria-current` and the map's tick, `prepare()` on hover, and a monotonic pan ending on the destination's stretch; pans over two stretches splice under the mist as designed); the mist drifts in the strip's sky and parts around a fine pointer as a soft, local opening (fixer: no straight edge; ≈ 7/255 mean within 80 px of the pointer, gone by ≈ 200 px, ≥ 5/255 over open sky; measured with the drift stopped in `_lab/landscape/wake.html` on SwiftShader and on a real GPU, Apple M5 Max through Metal) while text under its veil stays still (≤ 0.33/255); reduced motion paints no frames; a phone reading on paper requests no frames; no-WebGL paints every window and figure in Canvas2D with the palette and a clean console; no JS shows the content and the ridge hint; the compare panel; `resume.pdf` (2 pages, phone gate); `compliance.py` and `linkcheck.py` pass; `sync-shared.py --check` and `sync-projects.py --check` pass.

**Fixes of 10 October (fixer):**
- Every strip holds whole mountains at 320–1440 and sideways (above); Home's phone and tablet strips were cut flat by their top edge.
- The six places tell apart with the text hidden: Home's misted blue-green mountain; Work's market at the bridge; the Résumé's **terraced fields**, low and banded in pale malachite (new `tech.terr`); Contact's crossing, **mostly water** in pale indigo with the far shore and the echo of his mountain; Writing's **still lake with its whole reflection** (new `water.mirror`); the 404's **single peak** (the high distance: one tall host over a low far range). Misted strengths: Résumé .55, Contact .50 (were .25 / .20); rich .75 / .70. Measured strip colour with the text hidden (mean / max chroma, paper ≈ 3): Résumé 6.3 / 33 at 1440 and 7.7 / 32 at 390, Contact 5.1 / 26 and 7.7 / 26 (before: 4.6 / 17 and 4.2 / 17); under rich 7.9–10.0 / 40–41; the ink-only pages 3.1–4.3 / 10–13.
- The compare panel sits bottom right and folds to "Compare"; the story map is pale, feathered ink washes; Work folds as above; the cursor's wake is local and seamless.

Known for 4b: in Canvas2D the town's back rows don't dissolve into mist; Work's figure layer takes 20–28 ms in headless CPU raster (spec 15 ms; real devices untested); on phones Work's strip, framed on the bridge, crosses the town's top row of roofs; Contact's phone strip is about 40 % pigment (water), above the spec's "about a quarter" (it is mostly water by design); the router QA's three "BAD" lines (`work(y2400)`, `back x2`, `burst`) are the same sequence artefacts as in the integration run, not regressions.

**Work's length, a choice for Jack** (all words kept at the approved scale; measured 10 Oct): (a) accept 6.24 / 7.70 / 8.34 screens; (b) fold How I build's drawing behind its "Read as steps" too: on phones only, 8.34 → 7.40 (meets ≤ 8); at every width 5.62 / 6.93 / 7.40; (c) fold each flagship's Evidence and Stack behind "Show details": 5.83 / 7.19 / 7.83; (d) trim copy (the only way to reach 5 / 6 at 1440 / 1280 without hiding more).

## Port to Next.js 16 (App Router)

| Demo | Next.js |
|---|---|
| `tokens.css`, `base.css`, `layout.css`, `effects.css`, `components.css` | `app/styles/*.css` imported once in `app/layout.tsx`. Fonts through `next/font/google` (keep the name's fitted fallback from `tokens.css` as an explicit `@font-face`). Round 3's blocks are already gone (phase 3). |
| `_template.html` shared blocks | `app/layout.tsx`: `<Header/>` (the home link and nav), `<Footer/>` (story map, links, Still toggle, announcer), `<InkDefs/>`, `<Landscape/>`, Person JSON-LD. Per-page `export const metadata`. |
| The painted strip and the closing | `<Strip variant="home\|sub\|doc">` and `<Closing next="/work/">` server components rendering the empty art boxes and the text; the landscape client component reads their rects (`data-landscape`). |
| Inline boot script | `<Script strategy="beforeInteractive">`; `suppressHydrationWarning` on `<html>` for the classes and attributes it adds. The compare switches are not ported. |
| `main.js` chrome / `bootMain` | A `<SiteProvider>` client component in the layout (chrome once) and a per-route client boundary for `bootMain` (effects scoped to the route's `<main>`). Page config from each route's `layout.tsx` (`stretch`, `distance`, `presence`, `horizon`). |
| `router.js` | Next.js client navigation itself (`<Link>` prefetches: call `landscape.prepare(stretch)` from the link's `onMouseEnter`/`onFocus`/`onPointerDown`; `usePathname` drives `nav`, `storyMap`, `header.reset()` and `landscape.rebind()`); focus and announcement in a `useEffect` on pathname. `/about/` and the old URLs are 301s in `next.config` `redirects()`. |
| `transition.js` | `<ViewTransition>` (or `startViewTransition` around `router.push`) for exit/enter, plus `travel()` (`panTo` + `sweep`) from the route change; the quiet form under reduced motion and Still. |
| Page modules (`export default { init, destroy }`) | Client components: `init` in `useEffect`, `destroy` as its cleanup; `signal` = an `AbortController` per effect. |
| Page CSS (`pages/<page>.css`, swapped as one adopted sheet) | Route CSS Modules (`composes:` from the shared CSS) or `@scope (main[data-page='x'])`, because App Router keeps global CSS loaded after navigation. |
| `header.js`, `story-map.js`, `still.js`, `nav.js`, `disclosure.js` | `<ReturningHeader>`, `<StoryMap>` (the art rendered on the server from `stripSVG()`), `<StillToggle>` (context), `<Nav>`, `<CompactCase>` (`<details>` + an effect). |
| `diagram.js`, `margin-note.js` | `<Diagram>` (two SVGs + `<details>`), `<MarginNote>`. |
| `landscape/` | `useLandscape(ref, opts)` around `mountLandscape()` (Strict-Mode safe); `rebind()` on route change; `setPalette` never exposed in production. |
| `tools/sync-projects.py`, `data/` | The Work page (a server component) fetches the GitHub repos API **at build time** with ISR (`revalidate: 86400`) or a daily Vercel cron rebuild, optionally adding pinned repos via GraphQL with a server-side token; the same rules as a tested module; Jack's overrides as a JSON file. **Never client-side.** |
| `tools/build-photo.swift` | A one-off asset step (run when a new photo arrives); the output goes to `public/`, served through `next/image` with explicit `width`/`height` and `priority`. |
| `tools/build-pdf.py` | A build step (Playwright `page.pdf()` on `/resume/`) with the same phone gate, output to `public/resume.pdf`. |
| `demo.js`, `compare.js`, `_lab/`, `_tools/` | Not ported (Vercel serves `app/not-found.tsx`). |

## Open items for Jack (copy-level; not changed in the demo)

- **LAUNCH GATE (hard rule): the public repos still expose the old résumé file.** `Freedom-Jack/my-website` still holds the old PDF with the phone number (in files and history), and `Freedom-Jack/job-application` is public. Before launch: purge the file from `my-website` (or launch from a fresh repo, or make it private) and make `job-application` private. Until then the footer's "Source code" link and Work's `my-website` entry stay withheld (COPY.md; the GitHub tool denies both).
- Still for Jack (COPY §10, SPEC-R4A §16): approve or rewrite the DRAFT words (hero, About me, Now; What I work on and Say hello); "The hard part" of the two flagship cases; his game tools (Side projects); "For organisers" bios on Contact; whether the 2026 award's project may be named; the degree's honour wording; the photo reshoot; the glossary notes on Work; the Writing intro; Contact's closing "Next: Home"; certification verification links; the domain.
