# Design demo: Qijin Xu, site v2

A static HTML/CSS/JS demo of the redesigned site, built to be approved before the real Next.js build.
There's no build step and no framework: vanilla ES modules, CSS custom properties and one WebGL2 landscape.

**Round 4a (October 2026): a calm page inside a living painting.** Reading first, then the art. A traditional,
readable personal site on cool paper (18 px text, 40 px page titles, the name at 72 px), where **every page opens
on a short painted strip of its own place** in one story-scroll painting and ends on its closing scene. The binding
spec is `SPEC-R4A.md` (the approved plan: `_notes/r4/proposal.md`); every word comes from `COPY.md` (draft 3).

**Round 4b (October 2026): the painting comes alive** (`DESIGN.md` §11 is the scope; the record is `_notes/r4b/RECORD.md`).
On Home and Work at ≥ 1200 px, painted by a hardware GPU, the page's own scene is the page's living ground: the
camera lifts as you scroll, the scene parks beside the reading column and the page ends on its own opening
(`data-ground="living"`; elsewhere, below 1200 px, in Canvas2D and on a software rasteriser, the 4a strip and
closing). Every place has its draft figures (the pavilion, the ferry and jetty, the terraces' farmhouse, the path into
mist), small life (shimmer, smoke, willow sway, a drifting punt), and every closing and the footer's story map show
the page's own place. Its decisions, measurements, open items and lessons: `_notes/r4b/RECORD.md`.

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

Demo switches (never in the production port; remembered for the browser session, except the last two rows, which
are read from each URL and never remembered):

| URL parameter | Effect |
|---|---|
| `?compare=1` / `?compare=0` | the compare panel (bottom right, over empty paper) on / off: Colour Ink · Misted · Rich, and Name 56 · 72 · 96 (Home only); "Compare" folds it to one button (folded by default on phones); "Hide" = `?compare=0` |
| `?palette=ink\|misted\|rich` | the painting's colour without the panel (default misted) |
| `?name=56\|72\|96` | the home name's size without the panel (default 72) |
| `?router=off` / `?router=on` | the demo router off (plain full-page navigations) / on again |
| `?slow=5` / `?slow=1` | route changes play 5× slower (to study frames) / normal |
| `?y=1200`, `?y=#id`, `?t=400` | scroll before effects start; freeze the name's ink settle at 400 ms (`demo.js`) |
| `?ground=4a` | Home and Work with 4a's strip and closing windows instead of the living ground (A/B), and 4a's "Draft art" placement (`html[data-ground4a]`) |
| `?sink=.05,.17,.26&lag=.55&…` | the living ground's 33 tunables, for the art lead's comparisons: the keys of `main.js`'s `TUNE` list (`sink reach ease split seaK soft billow haze hazeK anchor cluster slide slideAt cloud cloudAt rise body curtain reveal revealAt descend vmax lead descAt still core feather swell clear far sky drift lag`), defaults and meanings in `landscape/index.js` `STAGE` (Work's own in `STAGE_AT`), passed as `opts.tune`. Some of them thin the reading veils (`core`, `feather`, `swell`, `clear`, `sky`): a tuned URL can drop text contrast below budget, so judge contrast without them |

The engine's lab pages (`_lab/landscape/`, noindex, never ported) read their own parameters: `strips.html?class=wide|tablet|phone|short&palette=&figures=0&keepout=580&scale=&q=1`; `page.html?stretch=&text=0&state=hero|horizon|closing&y=&go=&short=1&kind=&palette=&still=&slow=&arrival=&figures=&q=1`; `index.html?state=&y=&still=1&ui=0&arrival=none&stretch=&distance=&presence=&horizon=&from=&slow=&bloomMs=&q=1`; `figures.html` (see "Figure sets and small life"); `_studies/hero-a/?y=` is round 1's camera lift, still runnable.

## The pages

Every page boots through `main.js` from its `<body data-*>`: one place along the one painting each (SPEC-R4A §10.0).

| Route | `data-page` | stretch · scene (figures: `landscape/sets/`) | distance | presence | horizon | ground | strip | misted colour | Next | Owner |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | `home` | 0 · peak (the traveller and the hut, draft) | level | 1 | .6 | living | home | .55 | Work | home |
| `/work/` | `work` | 1 · river (the market at the rainbow bridge, draft) | deep | .8 | .55 | living | sub | .40 | Résumé | work |
| (no page) | | 2 · path (the road out of town) | | | | | | .30 | | |
| `/writing/` | `writing` | 3 · lake (a still reflection; the pavilion on its spit, draft) | level | .6 | .5 | | sub | 0 | Résumé | misc |
| `/writing/what-is-an-ai-agent/` | `article` | 3 · lake (the pavilion, draft) | level | .45 | .35 | | doc | 0 | Writing | misc |
| `/resume/` | `resume` | 4 · terraced fields (the farmhouse and its path, draft) | level | .5 | .35 | | doc | .55 | Contact | resume |
| `/contact/` | `contact` | 5 · crossing (mostly water; the ferry at the jetty, draft) | level | .9 | .5 | | sub | .50 | Home | misc |
| `/404.html` | `not-found` | 6 · lone-peak (the path into mist, draft) | high | 1 | .5 | | sub | 0 | (none) | misc |
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
  tools/build-photo.swift             Home's colour photo from the source selfie (crop, grade, wall into paper, the
                                      shoulder fade, no metadata)
  tools/build-stills.py               the footer story map's scene stills, cut from the engine (--check)
  tools/qa/                           the QA probes: cdp.py (driver), compliance.py, linkcheck.py, budget.py, gaps.py,
                                      contrast.py, drift.py, frames.py, places.py, router.py, storymap.py, measure.js,
                                      qa_common.py (how to run them: ## QA below)
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
      landscape/        the generative ink landscape (engine): index.js is the only entry; sets/ holds each place's
                        figure set (home, market, pavilion, terraces, ferry, path; the API: figures.js's header and
                        "Figure sets and small life" below)
    svg/                swash, brush, brush-2, brush-trace, arrow, wash-row, paper grain and fibres (no-landscape
                        fallback), ridge-hint (no-JS strip fallback), seal (icon)
    img/qijin-xu-colour.jpg   Home's photo (720 × 900, no metadata); a reshoot replaces this one file (build-photo.swift)
    img/scenes/         the story map's stills (<place>@1x|2x.webp + manifest.json; tools/build-stills.py)
  _lab/landscape/       the engine's lab (noindex): index.html, strip.html, strips.html (every page's strip and closing),
                        wake.html (the cursor's wake alone, with the drift stopped, for measuring it), figures.html (a
                        figure set's layer alone), bench.html, min.html, page.html
  _studies/  _notes/    the hero studies, the round-4 research and the round-4b record (_notes/r4b/RECORD.md; reference only;
                        never linked, never ported)
```

## Making a page

1. Start from `_template.html`. Its head, header, footer (story map, links, "Still the landscape", route announcer), canvas, ink filters and the Person JSON-LD are shared blocks.
2. Fill the page head from COPY.md §8.1. Set `<body data-page data-stretch data-distance data-presence data-horizon>` (table above), plus `data-ground="living"` on a page whose scene is its living ground (4b: Home and Work).
3. Write the page inside `<main id="main" tabindex="-1" class="frame">`:
   - it **opens on its strip**: `header.strip.strip--home|sub|doc` > `div.strip__art.bleed[data-landscape="strip"][data-wake][aria-hidden="true"]` (an EMPTY box) + `div.strip__text[data-landscape="keepout"][data-veil="0.85"]` with the h1 (`h1.name` on Home, `h1.page-title` elsewhere) and its lead (+ `p.strip__note.small` "Draft art" while the page's scene is a draft: in 4b on all seven pages with a scene; it comes off as each scene is approved). Résumé and the Note use `strip--doc` and put the h1 below the strip, outside it;
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
| Strip | above (Making a page). Wide (≥ 1200, home and sub): art and text share one grid cell, the title in the art's mist at the frame's left: Home's block vertically centred, a subpage's **low in the band** (`align-self: end`), so its intro sits close to the content it introduces. Below 1200, and `strip--doc` everywhere: art first, then the text on paper. No JS or no landscape: a faint static ridge hint in the same box (its left side feathers into the paper). `.strip__note` (ink-3, "Draft art") sits in the art's bottom feather, right; on a living page at ≥ 1200 px in the first screen's top-right sky (`top: 2.5rem`), on Home's phone strip and on the Note at the lower left; hidden with no JS or no landscape (`html.no-landscape`). The engine finds it by itself (the art's sibling) and keeps paper behind its line, so pages add no attribute. |
| Section | `section.sec[data-veil]` > `h2.sec__title` (+ `span.sec__date.small` inside it, e.g. "Now · October 2026"; `.sec__title--item` sets an h2 at item size, e.g. Work's "Six projects, newest first"), `h3.sec__sub` for a sub-heading. Children capped at 680 unless `.wide`. `p.lead`, `.small` (+ `.small--quiet`), `.actions` (a row of one `.ink-btn` and quiet links, baselines shared) |
| Rows | `ul/ol.rows[role=list] > li.row.ink-row` > `p.row__meta.small` (optional, before the title) + `h3.row__title > a.brush.brush--rest` (covers the row) + `p.row__line`; `.rows--plain` without hairlines; then `p.more > a.brush.brush--rest` ("All six projects →") |
| Margin rail | `.has-rail` (wide only): the reading column + the rail, sparse placement in source order (never `dense`). Children sit in the column; `aside.margin-note.small#note-x[aria-label="Note: X"]` right after its paragraph sits beside it in the rail; `.wide` children span both. A case's `dl.case__body` and its `dd`s carry the rail through by subgrid (or any `.rail-sub`), so a note inside a `dd` still reaches the rail; a group of notes there (`.margin-notes`, made by `margin-note.js`) is absolute in its rail cell and runs on down beside the next terms instead of stretching its `dd`. Below 75rem the notes become "Note: X" toggles (`margin-note.js`). |
| Photo + About me (Home) | `section.hello.wide[data-veil="0.88"] > img.hello__photo[width=720][height=900][alt][decoding=async][fetchpriority=high]` + `div.hello__text` (`h2.sec__title`, paragraphs, the signature). Phone: photo 72% (≤ 20rem) above; tablet 240 + 600; wide 280 + 640. `mix-blend-mode: multiply` (the file's white wall becomes the paper). The shoulders' fade is in the file (`build-photo.swift` step 3d: the body dissolves into white along its own shoulder line), so there is no CSS mask (4a's straight bottom fade is gone). No border, radius, caption, grey or vignette. |
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
| Landscape hooks | `data-landscape="strip"` / `"closing"` (the windows), `data-landscape="keepout"` (text the painting keeps clear of colour and figures: one right edge per window, so the engine understands only "text left, scene right"), `data-veil[="0–1"]` (paper mist behind text; default .72; ≥ .9 a reserve over the element's own text lines only, with half the feather; the engine adds a .95 reserve by itself for the Draft-art note and any keep-out without a veil; at most 12 veils at once, the largest visible first), `data-wake` (where the cursor may part the mist: the strip and the closing art). On every page the drifting mist and the sky deck keep off veiled text and only a veil's edge tears. **On a living page** (Home, Work at ≥ 1200 px on a hardware GPU) every veil, keep-out and note is cut per band of text lines (`textBands()`: a new band where the lines get ≥ 160 px wider, or after ≥ 100 px of narrower ones; pictures, tables and diagrams count as text) at full strength, and the `data-veil` value is ignored. Round 3's `data-landscape="head"` and `data-landscape-descend` are read as aliases for one round. |
| Misc | `.nowrap`, `.visually-hidden` (real accessibility needs only), `data-router="off"` on a link that must load the full page. `.accent` is now plain ink (cinnabar is the seal's only). |

## The chrome

- **Header** (`_template.html`, `layout.css`, `nav.js`, `seal.js`): one home link, the seal and the words "Qijin Xu" (accessible name "Qijin Xu, home"; `aria-current="page"` on `/`, no extra mark), then Work · Résumé · Contact (560, 15 / 16 / 14 px, 44 × 44 targets, the current page brush-marked). One row at 360; below 340 the nav takes a row of its own (`.site-header.is-stacked`). In normal flow, on paper, above the strip.
- **Returning header** (`header.js`): armed once the strip's art has scrolled away (its bottom ≤ 0). Then sticky and hidden; scrolling up ≥ 8 px brings it back **solid** (paper and a 1 px mist-2 rule, no gradient or shadow), down ≥ 8 px slides it away (220 ms; reduced motion: a 120 ms fade); at the very top it is static again. Never `visibility:hidden` or `inert`: focus inside pins it; `scroll-padding-top` keeps anchors clear of it.
- **Story map** (`story-map.js`, `layout.css`, demo 4b): the footer's map of the whole painting as one small handscroll: each place's own opening scene in miniature, five build-time stills cut from the real engine (`tools/build-stills.py` → `assets/img/scenes/<place>@1x|2x.webp` + `manifest.json`; record: `_notes/r4b/RECORD.md` §5.1), plain `<img alt="">` in the aria-hidden art of the shared footer, multiplied into the paper. Each still is drawn whole with its focus over its label, inside a soft window (`.story-map__scene`, a CSS mask) that reaches its neighbours: two neighbours feather over the same stretch with complementary, slanted ramps, so the row is one painting at every width; the road (stretch 2, no page) is one gap of mist (on wide screens about half a column with Writing's far range threading through, on phones a 10-17 px breath); the row's ends feather out before the screen's edge. Five labels laid out by geography (`data-stretch`: Home 0 · Work 1 · the road 2 · Writing 3 · Résumé 4 · Contact 5; the 404 lies off the map). The map is one grid whose art and labels are subgrids, so a scene, its tick and its label share a column: from 640 six equal columns, below 640 each label's width with the free space spread between them (the labels never closer than .5rem). When the labels do not fit one row (large text; a container query on the footer frame) they wrap in a flex row and the art keeps the geography. Each label's hit area covers its column of the art. The art sits 1.75rem above the labels, so its figures stay ≥ 40 px from their text (DESIGN 4.6). A small tick hangs over every place; the current page's is taller, in ink-1 (CSS `:has()` on the label's `aria-current`, mirrored as `.is-here` by `story-map.js`), with its label's brush mark (the Note marks Writing `"true"`, the 404 none). Works without JS. **Regenerate the stills after any engine or scene change** (`--check` says when they are stale); `tools/qa/storymap.py` measures it all.
- **Footer lines**: "© 2026 Qijin Xu · Toronto" · Email · LinkedIn · GitHub · View résumé (PDF), and "Updated October 2026 · Still the landscape" (on one row from 1200). Separators are CSS, only where the links share a line. Every link ≥ 44 × 44.
- **Still the landscape** (`still.js`): a toggle (`aria-pressed`) that stops all ambient motion for the session (`landscape.setStill`) and turns route changes into their quiet form. `sessionStorage['ink:still']`; `html.is-still` is set before first paint. Hidden without JS. Event: `ink:still`.
- **Compare panel** (`compare.js`, DEMO ONLY): see "Demo switches". Colour → `html[data-palette]`, `landscape.setPalette(p)`, event `ink:palette` (`{ palette }`); Name → `html[data-name-size]` (`--fs-name`), event `ink:name` (`{ size }`). Fixed bottom-right (over the empty paper beside the column and the rail; bottom-left it covered Home's photo and the résumé's timeline), under the header, buttons ≥ 44 px; "Compare" (`aria-expanded`, `sessionStorage['ink:compare-open']`) folds it to that one button, folded by default below 40rem; hidden in print.
- **Route announcer**: `#route-announcer` (polite live region in the footer) reads the new page's title after an in-site page change.
- **Print, zoom, focus** (4b final review): print hides `.site-header`, `.actions` and `.ink-btn` (ink-button labels print blank: `background-clip: text`) along with the strip art, the closing and the footer, so printed pages carry no name (the build adds a print-only "Qijin Xu · qijinxu.com" line, DESIGN §11.E.12). Below 14.99rem (200 % zoom on a phone) `.nowrap`, the contact address (a `<wbr>` after "@"), the stacked table and the résumé's contact line wrap. The sticky header's controls carry `scroll-margin-top: calc(-3 * var(--header-h) - .75rem - 4px)`, so focusing them never scrolls the page.

## Route changes (demo router)

`router.js` previews the Next.js client navigation in one document: the canvas, header and footer persist and `<main>` swaps.

- **Intercepted:** primary-button clicks with no modifier on same-origin `http(s)` links with no `target` (or `_self`), no `download`, no `type`, no `rel~=external`, no `data-router="off"`, no file extension in the path (so `/resume.pdf`, `/resume.json`, `/llms.txt` load normally), and not a redirect stub (`/about/`, the Note's old URL; any page that turns out to be a meta-refresh stub falls back quietly). A different hash on the same page is left to the browser; the same page without a hash scrolls to the top. Clicking the current page (or Back) while a navigation is still leaving calls it off.
- **Forward:** prefetch on hover, focus or press (cached 30 s), parsed with DOMParser and validated (`main#main`, `body[data-page]`); **as soon as it is parsed, `landscape.prepare(stretch, { distance, presence })` draws the destination's figure layers, for its own composition, off the main thread**, so they are ready before the pan and never pop in. 0 ms: the old text sinks into the mist (160 ms). ≤ 50 ms: `panTo(dest, 600 ms, cubic-out)` + the pale `sweep()` (the pan plays in whatever window is on screen: a click on "Next" starts it in the closing). 160 ms, in one task: page module `destroy()`, `<main>` replaced, `<body>` `data-*` copied, head swapped (title, description, robots, canonical, alternate, `og:*`, page JSON-LD), the page stylesheet replaced by one adopted `CSSStyleSheet`, `pushState`, instant scroll, nav / story map / header updated, `bootMain()`, then **one `rebind()` with the new strip, closing, keep-outs, veils and wake regions** (`site.targets(main)`); the engine recomputes the horizon handover before its first present. Then the enter (h1 first, 260 ms). Focus moves to the new h1 (or the hash target); the announcer reads the title. Readable ≈ 350 ms. On Home and Work's living ground, a pan from a lifted pose first **holds** up to 180 ms (`HOLD_MS`) while the camera comes back down, so the painting arrives up to 180 ms after the 600 ms pan (transition.js's "≤ 650 ms" does not include it).
- **Back/forward:** content swaps at once; the scroll position is restored (and again after margin notes and compact cases fold); the painting pans back in 400 ms. Scroll restoration is manual while the router runs (`history.state = { ink, key, y }`).
- **Quiet form** (reduced motion or Still): a 150 ms cross-fade; the painting cuts at the swap; no sweep.
- **Fallback** to a normal navigation: fetch error, non-OK status other than 404, a page that isn't a site page, a legacy page script, any exception during the swap, or no swap within 3 s.
- **Events** on `document`: `route:start { from, to, kind }`, `route:swap { from, to }`, `route:end { to, readyAt }`, `route:fallback { to, reason }`.
- Full-document navigations keep `@view-transition { navigation: auto; }` with the default 260 ms cross-fade. Round 3's `?transition=edge`, its `.ink-wash` canvas, `edge()` and `variant()` are gone.

## Module APIs

Every `init*` is idempotent (bound elements are skipped) and returns `destroy()` (or an object with `destroy()`).

| Module | API |
|---|---|
| `main.js` | Boots the chrome once and the current `<main>`. Exports `config` (live getters over `<body>` and `<html>`: `page`, `stretch`, `distance`, `presence`, `horizon`, `ground`, `palette`), `ready` (Promise of `{ config, landscape, entrance }`), `bootMain(main, { module?, rebind?, afterLayout? }) → Promise<destroy>` (order: brush links, ink buttons, margin notes, disclosure, `afterLayout()`, draw-ins, the page module, then `landscape.rebind`), `site` (`landscape`, `landReady`, `nav`, `header`, `storyMap`, `still`, `compare`, `entrance`, `firstMain`, `targets(main)`, `destroyMain()`, `bootMain(main, o)`), `destroy()`. Mounts the landscape with `stretch, distance, presence, palette, strip, closing, keepout, veil, wake, horizon, ground` (+ the aliases `head`, `descend`), `still`, `arrival: 'bloom'` and (demo only) `tune`. |
| `router.js` | `initRouter(site) → { navigate(href), destroy() }`. Off under `?router=off`, without `fetch`/`DOMParser`/`pushState`/`replaceSync`/`adoptedStyleSheets`, and on a page with a legacy page script. Feature-detects `landscape.prepare` and `rebind`. |
| `transition.js` | `exit(main, { dir, signal }) → Promise`, `enter(main, { dir, signal }) → Promise`, `travel(landscape, { to, distance, presence, dir, back })`, `cut(landscape, …)`, `restore(main)`, `quiet() → boolean`. No side effects at import. |
| `header.js` | `initHeader() → { reset(), destroy() }` (`reset()` after a swap). |
| `story-map.js` | `initStoryMap() → { update(), destroy() }`: moves `aria-current` and the ticks' `.is-here` after a route change; draws nothing (a `strip` option is accepted and ignored). |
| `compare.js` | `initCompare({ getLandscape }) → { destroy() }` (does nothing unless `html.is-compare`). |
| `disclosure.js` | `initDisclosure(root) → destroy()`: `details[data-collapse="always"]` (folded at every width) and `details[data-collapse="phone"]` (below 40rem). |
| `still.js` | `initStill({ getLandscape }) → { on, apply(handle), destroy() }`; `isStill()`. |
| `nav.js` | `initNav() → { update(), destroy() }`; `markCurrent(links)`; `norm(path)`. |
| `margin-note.js` | `initMarginNotes(root)`: toggles below 75rem (`button.margin-note__toggle[aria-expanded][aria-controls]` + `div.margin-note__body[hidden]`), grouping of consecutive notes; `destroy()` restores the markup. |
| `diagram.js` | `initDiagrams(root)`: every `[data-draw]`; strokes `[data-order]` draw in order once (triggered at 90 % of the viewport, settled by 40 %). Drawn at rest under reduced motion, Still, no JS, print, forced colours. |
| `arrival.js` | `initArrival() → { finish(), seek(ms), release(), destroy() }`: the name's ink settle (#ink-arrive displacement 8 → 0 in 400 ms; the name is readable at first paint); the 2.5 s safety net calls `finish()`. |
| `brush-link.js`, `ink-button.js`, `seal.js` | Constant pen speed and alternating strokes; ink bloom from the pointer and press rings; the header's seal stamped once per session (never the signature's). |
| `landscape/index.js` | (engine; **its JSDoc is the contract**, SPEC-R4A §12) `mountLandscape(canvas, opts)`. New options: the windows `strip` and `closing` (aliases `head`, `descend` for one round), `keepout`, `palette`, `figures`, `horizonMedia`, and `widthClass` (lab and QA only: frame as that class whatever the viewport); `vistas` is ignored. Handle: `+ setPalette(p)` (one governed redraw per window; fires a bubbling `landscape:palette` on the canvas), `+ prepare(stretch, { distance, presence }?) → Promise` (draws that stretch's figure layer for that composition off the main thread; idempotent: the router calls it with the destination's composition after every prefetch parse and again on navigate), `rebind({ strip, closing, keepout, veil, wake, horizon })` (re-reads boxes and framings, recomputes `hzK` before the first present), `setState('hero'\|'horizon'\|'closing'\|null)` (QA; on a living page it forces the stage's opening, settled or end pose), `qa({ veils: false })` (QA: empties the veils, to judge the painting alone), `ground: 'living'` (4b, `data-ground`: the page's scene as its living ground on wide screens painted by a hardware GPU; the present governor gives it up if its presents stay slow at the lowest quality), and `stats()`: + `palette`, `widthClass`, `windows`, `framing`, `hzK`, `renderer`, `software`, `quality`, `presentMs`, `ground`; `figures` (`figures[k]` stays `'pending'` while a closing's own layer draws), `figureMs` (the last layer only; 5–10× high headless), `figureSlots` (with `v` strip\|closing, `scale`, `standIn`), `figureLayers` (every layer key and its status); `stageVeto`, `govPresent` (the present governor's samples, ms); `life { n, kinds, k, bitmaps }`; `pending` (true while a window, the horizon, a pan, a figure layer fading in or, on the stage, a glide, the layer split or the bridge reveal is unfinished: the settle probes wait on it); `stage` on a living page (`on, y, ready, phase` hero\|lifting\|settled\|descending\|end, `prog, desc, descP, sink` (px per layer), `endSink, endMid, jumpPx, span, liftF, slide, curtain, reveal, revealT, arch, archGap, framing, crops`), else null. Exports `stripSVG`, `sceneAt`, `PALETTES`, `PIGMENTS`, `framingAt(stretch, cls, { width, height, keepoutRight, doc, twin }, kind)` (its result also carries `nominal`, the scale the window's figure layer is drawn at). The engine finds the strip's `.strip__note` by itself. Veils are viewport rects and are re-measured on every scroll frame (they follow their text); keep-outs are box-relative. |

**Inline boot script** (first in the shared head; it reads no styles): adds `html.js`, `.is-sealed`, `.is-still` and (demo) `.is-compare`, `[data-palette]`, `[data-name-size]` from the URL and `sessionStorage`; clears the retired `ink:transition`; adds `.is-arrived` after 3 s whatever happens.

### The landscape engine, inside (for the `useLandscape` port)

- **SCENE and PRESENT.** SCENE paints each view (the strip and closing windows, the desktop horizon, the living stage's three layers) into its own buffer only when the view's key changes (`paintWin`: framing, size, palette, spec, keep-out, note, figure alphas, arrival, draft; never the scroll). PRESENT composites them every frame and adds what moves (drift, wake, sweep, life), then the veils (`mix(col, PAPER, veil)`), then grain. A scroll costs one present, never a scene. Never put a time uniform in SCENE; every new layer goes before the veils and every moving term is gated by (1 − veil)(1 − keep).
- **Loop and governors.** No rAF spin: dirty flags, a GPU-fence wait ≤ 400 ms, sleep until a draft's settle, the wake (≤ 30 fps) or the drift (≤ 15 fps; asleep after 45 s idle). `govern()`: motion scenes averaging > 45 ms (12 samples) draw drafts at 0.5, then lower quality × 0.8 (floor 0.5); a full scene follows 150 ms after motion. `governPresent()` (4b): 12 plain presents averaging ≥ 30 ms of GPU wait lower quality × 0.8 (floor 0.5); still slow at 0.5 on a living page sets `stageVeto`. `onScroll` returns early when no window, horizon or stage is near: **a phone reading on paper requests zero frames**.
- **The living stage** (`stageOn()`: `data-ground="living"`, ≥ 1200 px, WebGL on a hardware GPU, no `stageVeto`): three depth layers painted once (far at half resolution, middle and near cropped by `stageCrops()`); pans and the bloom paint one combined layer per frame; a pan from a lifted pose first holds (`HOLD_MS` 180), poses glide (`GLIDE_TAU` 150 ms, `sepK`). `drop4a()` frees the 4a views on entering, `dropStage()` the stage on leaving (Home 1440 at DPR 2: about 10 MB, against 4a's 17). Tunables: `STAGE` / `STAGE_AT` in `index.js`.
- **Hard limits.** PRESENT has exactly two window slots: `uWin*[2]`, the samplers `uWin0` / `uWin1` (a ternary pick), gl.js's packing and `wins` change together for a third. Scene alpha is mist admittance, not opacity (sky 0.18, water 0.36, figures 0.3, keep-out 0.5), so any readback of a window (stills, thumbnails) forces alpha to 255; the depth layers carry coverage. `view()` clamps to `MAX_TEXTURE_SIZE` silently; `layerSize` clamps a figure layer at 4096 px a side without rescaling its drawing. Every new texture must be re-made in the renderer's `hooks.restored` (context loss).
- **Canvas2D and software WebGL.** Canvas2D is static: no drift, wake, sweep, shimmer or life (sprites cut from a layer are baked back); veils are a ¼-resolution CPU mask rebuilt every scroll frame; figures lack the bleed halo and the separate 40 px and Draft-art guards; one pigment tint per plane; 100–400 ms a scene. Living pages show 4a's strip and closing there, on software WebGL and after `stageVeto` (the strip's painting leaving at `lag` .55), so Canvas2D's `stage()`, `curtained()` and the living branch of `veilMask()` are unreachable: drop them in the port.
- **A new engine option or page attribute takes three edits:** `main.js` `landscapeTargets` (and `config`), the engine's `rebind`, and its JSDoc contract. The router copies every `body` `data-*` generically.

### Figure sets and small life

(The build, round 5: the engine is `src/features/landscape/engine/`, one world painted with one composition, the road
gone, one river; each set places itself by its own stretch constant `K`, so moving a place is one line. DESIGN §7
"Round 5: one world" and §12 "Round 5" step 2. What follows describes the demo, whose numbers are the 4b ones.)

- **Add or edit a place:** `assets/js/landscape/sets/<name>.js` (`meta` + `draw(env)`, in world px: 1440 per stretch, 900 per scene height) plus one line in `sets/index.js`; nothing else changes. The binding contract is the header of `figures.js` (THE SET API, THE LIFE API). Keep content inside 13–87 % of `meta.rect` (the ends melt). The "Draft art" label is the page's `.strip__note`, not the set's.
- **Rules that break every page if ignored:** a set's top level runs before `figures.js`'s constants exist (the modules import each other), so read `D`, `VH_PX` and `LIFE_KINDS` only inside `draw()`; a syntax error in any set kills every page's painting. Never `Math.random`: one stream per element, `own(...keys)` from `streams(SEED, PINS)`. To change a shared brush, copy it into the set and fold it back into the kit in a separate, reviewed step.
- **The lab:** `/_lab/landscape/figures.html?set=market` (or `?stretch=1`), with `&scale=` (CSS px per stretch; default every width class), `&dpr=2`, `&palette=ink|misted|rich|all`, `&zoom=1`, `&life=0`, `&worker=1` (draw through the real worker, errors with line numbers). Each tile's caption shows its size, time, yields, longest step, ink in the melt ends, the life anchors and a SHA-256. Scripted (through `tools/qa/cdp.py`, after `wait_for` `window.ready === true`): `window.figLab.render({ stretch, scale, dpr, palette?, worker? })` → `{ width, height, ms, steps, longest, life, sha, melt }`, where `sha` is the hash of the bytes the page uploads: the check that an edit, or the port, leaves the other sets pixel-identical (reference hashes: RECORD.md §3.3).
- **Life anchors:** `anchor(env, kind, { x, y, w, h }, params)` in world px. Kinds: `smoke` (`src`), `willow` (`foot`, `s`, `sway`), `boat` (`L`, `dir`, `speed`, `range`, `sprite`), `shimmer` (`waterline`), `walker` (`path`; ignored today). A `boat` with `sprite: true` is cut out of the layer by the worker's `'gpu'` output (an ImageBitmap; `'bytes'` without bitmap support, `'bitmap'` for Canvas2D, which keeps it painted in), so its box must hold the whole boat and nothing else. The anchors are read by `index.js` `lifeU()` (one view holds life per frame, only views of the slot's own variant) and `shaders.js` `lifePrep` / `lifeLay`; gl.js compiles PRESENT twice by replacing the line `#define LIFE ` with `#define LIFE_ON 1`; texture units 7–9.
- **Closings** (`compose.js` `SCENES[k].frame.closing`, documented above `SCENES`): `wide { scale, band, right, hug?, keepU? }`, per-class overrides, and `twin` views (a short page whose strip and closing share a screen), which may be a `span: [u0, u1]` (the box right of the text holds exactly that much at any width). The keep-out keeps the place's `keepU` at least `KEEP_GAP` (180 px) right of the text; `hug` puts it exactly there. Figure layers are keyed `k|distance:presence|scale|palette|dpr|mode|cls` and drawn for the window that shows them; a closing shares the strip's layer within `LAYER_SHARE` [0.6, 1.16], else draws its own at `nominal`; stand-ins only within `LAYER_STANDIN` [0.4, 1.16]; `FIG_KEEP` 6.
- **After moving Work's town or bridge** (`sets/market.js`): re-measure the river's depth profile `SCENES[1].water.front` (exported as `RIVER_FRONT`, read by `shaders.js` `frontAt()` and `canvas2d.js` `riverMist()`), or the river mist eats the front row or spares a back row; re-measure `STAGE_AT[1].arch` (shoot Work's end with `?curtain=0` and the text hidden, convert with `stats().stage.framing`); then rebuild the stills (method: RECORD.md §3.5, §7.3).

## Tools

```sh
python3 tools/sync-shared.py [--check] [--only page.html …]   # shared blocks + aria-current; skips redirect stubs
python3 tools/sync-projects.py --discover                     # GitHub API -> data/github.json -> work/index.html
python3 tools/sync-projects.py [--check]                      # offline render from the snapshot + overrides
python3 tools/build-pdf.py [--out path] [--text]              # /resume/ -> resume.pdf, phone-number gate
swift -O tools/build-photo.swift <source.jpg> <out.jpg> […]   # Home's colour photo (see its header for the flags)
python3 tools/build-stills.py [--check] [--places a,b] [--preview dir] [--base url]   # the story map's stills, cut from the engine
python3 tools/qa/storymap.py [--fonts 16,20,24]               # the story map measured: alignment, windows, seams, road, clearance
```

- **"In the open" is auto-discovered at build time** (Jack, 10 Oct: "discover and update automatically… don't slow down the website"). `--discover` reads `https://api.github.com/users/Freedom-Jack/repos` (public, no token), writes the candidates to `data/github.json` and renders static HTML between the `@data:projects` markers. **The visitor's browser never calls GitHub; there is zero client JS for it.** Rules: public, not a fork, not archived, not empty; never `job-application` or `my-website` (the deny-list lives in the tool); placeholders skipped (under 10 KB, or described as "TBA" / "To be announced" / "coming soon"; they appear by themselves once real code lands); a description or an override line. Groups: the topic `featured` first; "Recent" (pushed within 24 months of the snapshot); "Early work, {first}–{last}". Empty groups render nothing. `data/projects.json` holds Jack's optional overrides, one per line: `{ "name", "line"?, "year"?, "group"?, "order"?, "hidden"?, "demo"? }`. Today (snapshot 10 Oct 2026): no Recent; Early work 2019–2020, four repos.
- **`build-photo.swift`** (Core Image + ImageIO): crop x 240–2140, y 250–2625 of the selfie (4:5), Lanczos to 720 × 900; a light grade (saturation × .90, warm mid-tones, shadows toward the painting's blue-green, +3 % mid-tone exposure for the multiply); then it **flattens the uneven wall before lifting it** (a wall mask eroded clear of hair, skin, glasses and sweater; the wall's light from a heavy normalised blur; divide, then a knee), so the wall and the ceiling-corner line become pure white and the page's multiply turns them into the paper exactly; then (step 3d, 4b) **the shoulder fade**: the body dissolves into white along its own shoulder line, the face and neck untouched (`--fade off` reproduces 4a's file); JPEG (quality .55 on ImageIO's scale, 64.5 KB) with every EXIF/XMP/IPTC/comment segment stripped. Fade flags: `--fade auto|off`, `--fade-width .17`, `--fade-neck .14`, `--fade-edge 1`, `--debug-fade fade.png`; a rebuild with the defaults is byte-identical. It reports the size, the wall's whiteness, the corner-line step and the frame edge's colour difference on the paper. A reshoot is a one-file swap: run it on the new source.
- **`build-stills.py`** remounts each mapped page's engine at 1440 × 900, DPR 2, on the strip path (it forces `ground: ''`: a living page would mount the stage, which has no strip framing), with no veils, keep-outs or wake, a fixed `quality` and no ambient drift, so the same inputs give the same bytes. Its crop table `PLACES` (top of the tool) must stay in step with `layout.css`'s `--focus` / `--fade-b` and `_template.html`'s image sizes (`--check` verifies). `--check` (no browser) fails when an input changed (any `assets/js/landscape/**/*.js`, comments included; `main.js`; the mapped pages' `<body>` config; the strip-height tokens; the tool's table and settings), when a still differs from the manifest, or when a cap is broken (16 KB a still, 60 KB in all). `--places` rebuilds some stills but keeps the old input hash, so `--check` stays stale until a full run. `--preview` must be outside the repo. Regenerate after any engine, set, palette, page-config or strip-height change, then run `tools/qa/storymap.py`.
- **`build-pdf.py`** prints `http://localhost:4173/resume/` with headless Chrome into a temporary file, then refuses it if the page source or the PDF's own text contains a phone-number pattern or a `tel:` link, or if the extraction cannot find the name, city and email. Only then is `resume.pdf` written. Run it after any résumé change.

## QA

The probes live in `tools/qa/` (stdlib Python 3.9 and JS evaluated in the page). Images, sheets and JSON go to `$QA_OUT`
only, a folder outside the repo (the tools refuse repo paths; without it, `<tmp>/design-demo-qa`). How 4b was verified,
and the lessons from it: `_notes/r4b/RECORD.md` §6 and §8.3.

```sh
python3 tools/sync-shared.py --check && python3 tools/sync-projects.py --check && python3 tools/build-stills.py --check
python3 tools/qa/compliance.py && python3 tools/qa/linkcheck.py          # hard rules; links (needs the server)
python3 tools/qa/budget.py --matrix     # DESIGN §6 budgets; the other probes: the table below
python3 tools/qa/cdp.py '[{"viewport":[390,844,3,true]},{"goto":"http://localhost:4173/"},{"settle":30000},{"shot":"/abs/scratch/shot.png"},{"console":true}]'
```

Every probe takes `--base` (default `http://localhost:4173`), `--pages` (`home, work, resume, contact, writing, note, 404`), `--vps` (presets `1440` = 1440 × 900, `1280` = 1280 × 720, `390` = 390 × 844 at DPR 3 with mobile and touch, plus the matrix sizes `1024, 768, 375, 360, 339, 320, 844x390`), `--query` (appended to every URL, e.g. `palette=rich`), `--json PATH` (outside the repo) and `--timeout` (settle per page, default 60000 ms). Exit 0 = everything in target (accepted exceptions do not fail), 1 = something out.

| Probe | What it checks (targets) |
|---|---|
| `compliance.py`, `linkcheck.py` | The hard rules (phone, address, PMP, old PDF, CJK, motto, JSON-LD, images, PDF pages); internal links, fragments, SVG-filter ids, external links https and allow-listed (needs the server) |
| `budget.py [--matrix]` | DESIGN §6 per page × 1440 / 1280 / 390 (words counted by the 4a rule, display ÷ readable, type sizes, largest text, the photo, reveals, Work's length, tap targets); `--matrix` adds sideways overflow and the header at every matrix size |
| `gaps.py` | Visible space between sections: 56–80 / 56–72 / 40–56 px |
| `contrast.py [--shots] [--positions 0,0.25,…]` | Every text line against its real background with the glyphs hidden: body and lead p5 ≥ 7:1, small print and SVG diagram labels ≥ 4.5:1, background C* p95 ≤ 6 |
| `drift.py [--at 0,1.2] [--stops] [--idle]` | Mist change over 8 s: under text ≤ 0.5/255; open sky as measured in 4b, mean 0.5–1.6/255 and p99 3–6 (most open sky is uniform, so p99 is the honest measure). The tool still grades the sky's mean against 3–6 and prints "sky too faint" on every 4b page: a known, accepted miss (`_notes/r4b/RECORD.md` §2.3). `--stops`: reduced motion and Still paint 0 frames in 3 s; `--idle`: 0 frames after 50 s without input |
| `frames.py` | A real wheel scroll top to bottom: re-renders (scenes beyond first paints) 0; presents on paper 0 on phones; idle ≤ 15 fps where art shows, 0 where none does |
| `places.py --seed N [--pure] [--endings]` | The blind "tell the places apart" sheet at 390 (`--pure`: the painting alone; `--endings`: opening, closing and story map per page). The answer key is printed to the console only. Seeds 7 (its key is published) and 31 (shown to agent testers) are spent: real testers need another seed |
| `router.py [--burst]` | Home → Work → Résumé → Contact → Home, back × 4, forward × 4 (checks: **Router** below) |
| `storymap.py [--fonts 16,20,24] [--shots]` | The story map: alignment, labels, every window inside its still, neighbours meeting in mist, the road, figures ≥ 40 px from labels, large-text reflow |

- **Settle, never sleep.** Every probe waits with `cdp.SETTLE_JS` (the `{"settle": ms}` step): no arrival bloom, pan or sweep, nothing pending (`stats().pending`), no figure layer drawing, the newest scene a full-quality one (`fullAt >= draftAt`) with no draft in the last 400 ms, and the fonts loaded. It does not use `stats().draft` (it stays true for a window drafted and then scrolled away, so a settled page never satisfies it), and fixed waits catch the painting mid-bloom under CPU load. On a living page also check `stats().stage.ready`.
- **`cdp.py` steps** (besides the old ones): `{"wait_for": "<js>", "timeout", "every", "required"}`, `{"settle": ms}`, `{"eval": "…", "save": "/abs.json"}`, `{"cdp": "Method", "params": {…}, "save"}` (any raw CDP call), `{"shot": path, "clip": [x, y, w, h]}`; an unknown step prints `[skip]`. As a library: `Chrome()`, `Runner(tab).step(…)`, `capture()`, `evaluate()`.
- **Never measure contrast with tuned URLs** (`?core=`, `?feather=`, `?swell=`, `?clear=`, `?sky=` thin the veils).
- **Judge the painting on a real GPU:** `CDP_ARGS='--use-angle=metal --enable-gpu --ignore-gpu-blocklist'` before any
  tool runs headless Chrome on this Mac's GPU (ANGLE Metal). Without it Chrome uses SwiftShader, a software rasteriser:
  the engine then lowers its quality (0.6) and keeps 4a's strip and closing on the living pages (`stageOn()` needs a
  hardware GPU), and life's second shader adds 1–3 s of settle, so use it only to check the software path. Any probe of the
  living ground (contrast, drift, frames, the art) needs the prefix. Check `stats().quality` and `stats().software` first.
- Sizes: 1440 × 900, 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844 (DPR 3), 375 × 667, 360 × 800, 320 × 640 (header and footer), 844 × 390 (sideways phone); the living ground also at 1920 × 1200 and 2560 × 1440. Also reduced motion (`{"reduced_motion":true}`), no WebGL (`CDP_ARGS="--disable-3d-apis"`), no JS (`CDP_ARGS="--blink-settings=scriptEnabled=false"`), print (`{"media":"print"}`), and `?compare=1` with each palette and name size. Zero console errors (the "GPU stall due to ReadPixels" warnings are screenshot readback). No sideways scroll from 320 to 1440. Every link and button ≥ 44 × 44.
- **The 4a budget** (SPEC-R4A §15.2, DESIGN §6): Home's first screen ≥ 120 / 100 / 55 words (1440 / 1280 / 390), a subpage's ≥ 150 / 120 / 90; display ÷ readable text ≤ .25 on Home, ≤ .10 elsewhere; ≤ 4 type sizes per screen; the photo starts on the first screen at all three; `document.querySelectorAll('[data-reveal]').length === 0` and `[data-arrive]` only on `.name`; Work ≤ 5 / 6 / 8 screens.
- **Router:** `tools/qa/router.py --burst` (listen for `route:*`; the swap at ~160 ms, `document.activeElement` (the h1), `#route-announcer`, one `<main>`, one adopted sheet, back/forward `scrollY`, a burst of clicks 100 ms apart ending on the last page clicked, and `prepare()` called on hover). Judge frames with `?slow=5`.
- Forced colours can't be emulated by cdp.py; check Windows High Contrast by hand before launch.
- **Compliance (4b allow-list):** `compliance.py` skips `_studies/` and `_notes/`; allows Home's colour photo (720 × 900, ≤ 80 KB, no metadata) as the one content `<img>` and the story map's ten scene stills (`assets/img/scenes/<place>@1x|2x.webp`, decorative, each ≤ 16 KB, ≤ 60 KB together, only inside the footer's aria-hidden art), `Person.image` = the photo's absolute URL, seals as the seal's own `<text class="seal__glyph">` (one per page; two on Home, the Note and the specimen sheet), and redirect stubs without a Person block. `linkcheck.py` skips `_notes/` too.

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
| The painted strip and the closing | `<Strip variant="home\|sub\|doc">` and `<Closing>` server components rendering the empty art boxes (and the strip's text); the landscape client component reads their rects (`data-landscape`). **No "Next: …" link** (DESIGN §11.E answer 8): `<Closing>` takes no `next` prop and holds only the art. It renders on the long pages (Home, Work, the Résumé, the Note, Work's case pages); the short pages (Writing, Contact, the 404) render no closing and end on the story map alone, so the demo's twin views are not ported. The wide closings were tuned with "Next" over them: judge them again without it (`_notes/r4b/RECORD.md` §3.6). |
| Inline boot script | `<Script strategy="beforeInteractive">`; `suppressHydrationWarning` on `<html>` for the classes and attributes it adds. The compare switches are not ported. |
| `main.js` chrome / `bootMain` | A `<SiteProvider>` client component in the layout (chrome once) and a per-route client boundary for `bootMain` (effects scoped to the route's `<main>`). Page config from each route's `layout.tsx` (`stretch`, `distance`, `presence`, `horizon`, `ground`: `data-ground="living"` on Home and Work). |
| `router.js` | Next.js client navigation itself (`<Link>` prefetches: call `landscape.prepare(stretch)` from the link's `onMouseEnter`/`onFocus`/`onPointerDown`; `usePathname` drives `nav`, `storyMap`, `header.reset()` and `landscape.rebind()`); focus and announcement in a `useEffect` on pathname. `/about/` and the old URLs are 301s in `next.config` `redirects()`. |
| `transition.js` | `<ViewTransition>` (or `startViewTransition` around `router.push`) for exit/enter, plus `travel()` (`panTo` + `sweep`) from the route change; the quiet form under reduced motion and Still. |
| Page modules (`export default { init, destroy }`) | Client components: `init` in `useEffect`, `destroy` as its cleanup; `signal` = an `AbortController` per effect. |
| Page CSS (`pages/<page>.css`, swapped as one adopted sheet) | Route CSS Modules (`composes:` from the shared CSS) or `@scope (main[data-page='x'])`, because App Router keeps global CSS loaded after navigation. |
| `header.js`, `story-map.js`, `still.js`, `nav.js`, `disclosure.js` | `<ReturningHeader>`, `<StoryMap>` (static: the build-time scene stills from `public/`), `<StillToggle>` (context), `<Nav>`, `<CompactCase>` (`<details>` + an effect). |
| `diagram.js`, `margin-note.js` | `<Diagram>` (two SVGs + `<details>`), `<MarginNote>`. |
| `landscape/` | `useLandscape(ref, opts)` around `mountLandscape()` (Strict-Mode safe); `rebind()` on route change; `setPalette` never exposed in production. The demo and QA hooks are **never ported** (behind a dev-only flag, compiled out of production): `opts.tune`, `qa()`, `setState()`, `stats().tune`, `stats().veils` and `stats().memory`, and `memory()` in `gl.js` and `canvas2d.js`. |
| URL tunables (`main.js` `TUNE`, the 33 living-ground keys) and `?ground=4a` | **Never ported.** The art lead's comparison switches: a shareable URL could thin the reading veils (`?core=0&feather=0&swell=0&clear=0&sky=3` measured "Next:" at 6.38:1, under the 7:1 body budget). The chosen numbers live in `STAGE` / `STAGE_AT`. |
| `tools/sync-projects.py`, `data/` | The Work page (a server component) fetches the GitHub repos API **at build time** with ISR (`revalidate: 86400`) or a daily Vercel cron rebuild, optionally adding pinned repos via GraphQL with a server-side token; the same rules as a tested module; Jack's overrides as a JSON file. **Never client-side.** |
| `tools/build-photo.swift` | A one-off asset step (run when a new photo arrives); the output goes to `public/`, served through `next/image` with explicit `width`/`height` and `priority`. |
| `tools/build-pdf.py` | A build step (Playwright `page.pdf()` on `/resume/`) with the same phone gate, output to `public/resume.pdf`. |
| `tools/build-stills.py` | A build step (Playwright on the built pages, the same crop table) whose WebP stills go to `public/`; `--check` in CI fails when the engine changed and the stills did not. |
| `demo.js`, `compare.js`, `_lab/`, `_tools/` | Not ported (Vercel serves `app/not-found.tsx`). |

## Open items for Jack (copy-level; not changed in the demo)

Jack answered these on 2026-10-16 (DESIGN §11.E has his answers and the launch route; §12 the build); the list stays as the demo's record.

- **LAUNCH GATE (hard rule): the public repos still expose the old résumé file.** `Freedom-Jack/my-website` still holds the old PDF with the phone number (in files and history), and `Freedom-Jack/job-application` is public. Before launch: purge the file from `my-website` (or launch from a fresh repo, or make it private) and make `job-application` private. Until then the footer's "Source code" link and Work's `my-website` entry stay withheld (COPY.md; the GitHub tool denies both).
- Still for Jack (COPY §10, SPEC-R4A §16): approve or rewrite the DRAFT words (hero, About me, Now; What I work on and Say hello); "The hard part" of the two flagship cases; his game tools (Side projects); "For organisers" bios on Contact; whether the 2026 award's project may be named; the degree's honour wording; the photo reshoot; the glossary notes on Work; the Writing intro; Contact's closing "Next: Home"; certification verification links; the domain.
