# DESIGN.md: Qijin Xu personal site v2 (the single source of truth)

**Start here.** Any session that continues this redesign reads this file first, then what it points to.
Last updated **2026-10-22**, after the polish round (§12 "The polish round"): the audit, the link-preview cards, the
copy, search and structure fixes, and the engine's veil fix, all uncommitted on `redesign/v2` for Jack's review.
Branches: `redesign/v2` (the build to round 5 step 1 and the painting); `round5/spring-ink` (on top of it: Spring ink,
scroll motion, phone depth bands; not merged, not pushed).

**Status:**
- **Demo 4a** (static HTML/CSS/JS in `design-demo/`) is done. Jack: "overall it looks great".
- **Demo 4b** (§11 A–D) is built in the same folder, at draft quality for the new scenes, and reviewed (art, reader,
  engineer, hard rules, newcomers). The record is `_notes/r4b/RECORD.md` (decisions and why, how each feature works,
  measurements, open items, lessons); how to run the QA probes: README "QA".
- **2026-10-16: Jack reviewed 4b** ("a good baseline for everything") and answered §11.E (answers recorded there).
  4b is committed on `redesign/v2`; the working notes were condensed into `_notes/r4b/RECORD.md` (his answer 15).
- **2026-10-16: the Next.js build (§12) exists** at the repo root (branch `claude/vibrant-chatelet-febd04`, committed
  2026-10-16 as "Build v2", not pushed). Every page is ported from 4b and checked side by side with it on the real GPU; the case pages,
  the content files, CI and the stills tool are in. How it is organised: the root `README.md`; where the words live:
  `CONTENT.md`; what is left and what waits for Jack: §12 "Build status" below.
- **Round 5 (the macro pass) is under way:** Jack's five inputs and the agreed order are in §12 "Round 5". Step 1 (one
  order, one hero system, one ending) and the painting as one handscroll are committed on `redesign/v2`.
  **Steps 2, 3 and 3b are approved and committed on `round5/spring-ink`:** the style "Spring ink" and its elements,
  scroll motion on laptops, depth bands on phones and tablets (§4, §6, §7, §9 carry the new rules).
- **Step 4 (content) has started:** the review doc for Jack
  (https://claude.ai/code/artifact/65a17a60-ad11-432d-a4dd-6cd2563a472d) waits for his answers.
- **2026-10-20 to 22: the polish round** (§12 "The polish round"): Jack asked for "absolutely the best" with full
  freedom; an eight-lens audit, then every fix that needs no new fact. Uncommitted on `redesign/v2`.
- **Next:** Jack's content answers → drafts beside their pages → a Vercel preview and a real-phone check → launch on
  **qijinxu.com** through the §2 launch gate.
- This order changes the earlier plan, in which the build started at 4a. On 2026-10-14 Jack accepted a short 4b round first ("Sure continue").

**Authority:**
1. Jack's own words.
2. **This file.**
3. `SPEC-R4A.md` (component detail).
4. `COPY.md` (every word; its §10 open items).
5. `README.md`: how to make a page, module APIs, router contract, the QA matrix, demo URL switches, and **the Next.js port table**. Read it before building.
6. `_notes/r4/proposal.md` (the approved round-4 plan and its research).

Where they disagree with this file, this file wins; fix them. Known stale bits elsewhere: COPY §10.7 says the domain is "not bought yet" (it is bought), and SPEC's "order of authority" cites `brief-r4a.md`. That brief lived in a session's temporary folder and was **lost**; its content is folded in here. The lead's QA probes, lost with it, were **rebuilt in `tools/qa/`** for 4b (13 files: the driver `cdp.py`, `compliance.py`, `linkcheck.py`, `budget.py`, `gaps.py`, `contrast.py`, `drift.py`, `frames.py`, `places.py`, `router.py`, `storymap.py`, `measure.js`, `qa_common.py`; how to run them: README "QA"; how 4b was verified: `_notes/r4b/RECORD.md` §6).

---

## 1. Working with Jack (process rules, binding)

- **Who he is:** Qijin Xu, Lead AI/ML Architect, CGI AI Center of Excellence, Toronto. Not an art professional. He speaks in feelings and wants Claude to lead the art and think "a level deeper". Give research-backed reasoning when proposing changes.
- **Demo before build:** show a working demo and get explicit approval before building the real thing.
- **Questions are not instructions:** answer them before editing anything. Report in plain English, and say clearly when work is done.
- **Chinese text:** show any new Chinese text, with pinyin and meaning, before using it. The 徐 seal is pre-approved.
- **Git:**
  - Commit or push only when he asks. The repo `Freedom-Jack/my-website` is **public**, so pushing publishes.
  - Pushing to `master` deploys production. The permission classifier blocks that, so Jack runs those pushes himself.
- **Research screenshots** are for viewing only. Keep them in the session's temporary folder, outside the repo, and **never commit them**. That folder gets wiped repeatedly, so keep tools and notes in the repo.
- **Performance work:** don't start the speed backlog unprompted. Ask before any change that visibly alters the effects. GitHub data is the exception (§10).

## 2. Hard rules (never break)

- **No phone number** anywhere: site, PDF, JSON or comments. Jack decided this on 2026-10-09; the number goes only on copies he sends himself.
- **No street address** (city only: Toronto, ON, Canada). Public email: **qxjack@gmail.com**. **No PMP.**
- **Never publish or link the old PDF** `public/documents/QijinXu_Resume.pdf` (it has his phone number).
  - It was deleted on `master` by 4f4da2b, which is now also in `redesign/v2`.
  - It remains in git **history**, and the live old site (a Dec 2025 deploy) still serves it because newer Vercel builds fail.
  - Jack does **not** want the old site fixed; v2 replaces it.
  - The only PDF is the generated `/resume.pdf`.
- **Chinese characters:** the only one on the site is **徐** (the seal). Never the old site's four-character motto ("zhi xing he yi"). Never invent Chinese for "Qijin".
- **Never bypass his corporate web filter** (no proxies, caches, mirrors or archives). Never change system, security or TLS settings.
- **Honest SEO and AI-agent data:** structured data, sourced claims, JSON résumé. No hidden text or prompt injection. Every figure shown must be in COPY.md's claims ledger.
- **Wuthering Waves:** mood inspiration only, and only its Chinese-style chapters (Jinzhou/Huanglong and Mengzhou). Copy nothing. This comes from Jack's original brief, 2026-10-07.
- **LAUNCH GATE (hard rule):** before going public on qijinxu.com:
  - Purge the old PDF from `my-website`'s history, **or** launch from a fresh repo, **or** make the old repo private.
  - **Then** make `job-application` private. Its GitHub Action renders the LaTeX résumé PDF Jack currently shares as his résumé link; that PDF has the old title and probably the phone. So `qijinxu.com/resume.pdf` must be live first, or his link breaks.
  - Until then, the footer's "Source code" link and Work's `my-website` entry stay withheld.

`python3 tools/qa/compliance.py` enforces most of this. Run it before any commit.

## 3. Identity and facts (confirmed with Jack)

| Item | Value |
|---|---|
| Name shown | **Qijin Xu**. Never "(Jack)" in or beside it, and never "Jack Xu" as a heading. |
| "Jack" on the site | Only the About-me sign-off **"— Jack"** with a small 徐 seal, like a painter's signature (Jack's "Option A"). Set in a real font (Commissioner 560), **never a fake-handwriting font**; a scanned real signature would be the only alternative. On the Résumé, "Goes by Jack" in the contact line. |
| Search/AI names | Titles "Qijin (Jack) Xu · …"; JSON-LD `name` "Qijin Xu", `alternateName` ["Jack Xu", "Qijin (Jack) Xu"] |
| Title | **Lead AI/ML Architect**, AI Center of Excellence, CGI, Toronto (his LinkedIn still says "Lead AI/ML Engineer and Tech Lead"; we suggested he align it) |
| Awards | CGI Impact Award **2024** (the enterprise RAG assistant); **2026** (per his LinkedIn; project unspecified, so don't attribute it) |
| Education | York University, B.Sc. Computer Science, Specialized Honours, **2017–2021**; "GPA 3.9/4.0 · Dean's List" (the honour wording is unconfirmed) |
| Certifications | Azure Solutions Architect Expert (2022); Google Cloud Professional Cloud Developer (2023) |
| Links | GitHub https://github.com/Freedom-Jack · LinkedIn **https://www.linkedin.com/in/qijin-x-4899671a9/** (confirmed) |
| Domain | **qijinxu.com** (Cloudflare Registrar). **Parked; connect only at launch.** The canonical is the `vercel.app` URL until then. |
| Interests (About me / Now) | Basketball, gaming, wuxia and xianxia novels. Building an agent memory system and **Logic Foundry** (an agent that extracts logic buried in old materials into reusable artifacts: docs for people, rubrics for LLM agents, even model weights). Exploring an AI-powered stock app. |

**The hero lead, About me, Now, What I work on and Say hello are APPROVED** (Jack, 2026-10-16: "Approve"; COPY.md marks them). The remaining questions are in COPY §10 and §11.E.

## 4. Design principles

1. **Reading first, show-off second.** Jack: people "first capture the info, then enjoy my website". A normal, readable webpage. Effects support reading and never gate it.
2. **One giant painting, a story-scroll.** One continuous Chinese handscroll (like *Along the River During the Qingming Festival*). Each page is a **place** that pictures what the page is about, and moving between pages pans along the painting. It must look beautiful.
3. **Keep today's landscape.** Jack: "current background looks nice, don't get it wrong". Keep the engine, his mountain's shape and crags, the mist, the cool paper and grain, the pan, and the reduced-motion and no-3D fallbacks. **Keep the mist**: it drifts and parts around the cursor; Jack likes both.
4. **The painting is composed with the page, not wallpaper** (Jack, 2026-10-14; §11.A).
5. **Colour, restrained:** misted blue-green on the mountains (in the style of *A Thousand Li of Rivers and Mountains*) and light colour over ink on the town. **The paper is cool: never yellow, gold, beige or cream.** Cinnabar is for the seal only. Text never sits on colour, save the one brush button's label (pale on deep jade, 9.5:1).
   Round 5, Spring ink (Jack, 2026-10-18: "Approve Spring ink with these elements and the rule changes"):
   - **The painting's air is not the paper's colour:** an ice-blue morning sky and a light brighter than the paper,
     with a bloom (light needs blue round it to read as light). The paper under text stays cool paper.
   - **Jade is the one UI accent beside the seal:** the Home name (#0F3D36, 10.6:1), page titles (#134A47, 8.8:1), the
     one brush button, the nav's current-page tick, focus rings, selection and the scrollbar. Never a glow on words.
   - **Pink only in small painted accents:** Home's plum, the Résumé's blossom tree, Writing's petals.
6. **Figures inside the painting only:** small, in Song-period forms. Kitsch guards:
   - no red lanterns, pagodas, dragons or gold;
   - blank shop signs;
   - no clip-art repetition (seeded variety, broken dry lines, mist swallowing half the town);
   - nothing figurative within 40 px of text.
7. **Layout bans:** no boxy cards, bordered frames, bento grids, glassmorphism, emoji, or a generic "text left, picture right" split. Personality lives in the details: brush underlines, the one brush button, the seal.
8. **Page roles:** Home must not read like a CV (its three "What I work on" teasers are the one deliberate repeat). An About page returns only if Jack writes a 300+ word story. "Now" shows only when there is real content.
9. **Mobile-first and excellent:** 360 px and up, 44 px tap targets, nothing scrolling sideways, and the header in one row at 360 px (wrapping below 340). **Never a hamburger or bottom tab bar.**

## 5. Pages (IA approved 2026-10-09)

| Route | Role | Opens with | Then |
|---|---|---|---|
| `/` | **Home = Jack's "about me"** | Greeting hero: name (about 112 px at 1440, §6), role sentence, "right now" line, *See the work →* · *Résumé* | Colour photo beside **About me** (signed "— Jack" + seal) · *What I work on* (3 problems with proof) · *Now · October 2026* · *Writing* · *Say hello* · the closing scene · *Next: Work →* |
| `/work/` | What he built, how, how well | Market-town strip; "Six projects, newest first" table on the first screen | *How I build* (diagram + "Read as steps") · 2 flagship cases (diagrams fold on phones) · *More work* (4 compact cases, **fold at every width**) · *In the open* (GitHub, auto) · *Next: Résumé →* |
| `/resume/` | Career facts | Terraced-fields strip (low, the "doc" strip); a document header ("Qijin Xu", title, contact line with "Goes by Jack") | Summary · Experience (vertical brush timeline) · Skills · Education · Certifications; **View résumé (PDF)** opens `/resume.pdf` in a new tab; JSON Resume |
| `/contact/` | Who should write, about what | The crossing | Aimed at **collaboration and speaking** (no "hiring" language; his employer can read it): email + Copy, LinkedIn, GitHub, PDF, time zone. Optional later: "For organisers" bios. |
| `/writing/` | Notes | The lake | One note, `/writing/what-is-an-ai-agent/` (typos fixed per Jack; dateModified 2026-10-10). **Not in the nav until there are 3 pieces**; then it goes between Work and Résumé, and the 360 px header must be re-measured. Linked from Home and the footer's story map (not the footer's link line). |
| `/about/` | Redirect to `/` | (meta refresh in the demo; 301 in the build) | |
| 404 | Lone peak; the path into mist | | |

**Header:** the seal plus "Qijin Xu" form one link home (top left). Nav: **Work · Résumé · Contact**. The header is solid and returns on scroll-up.

**Footer:**
- the story map of the whole scroll, with "you are here" (each place links to its page);
- © line · Email · LinkedIn · GitHub · View résumé (PDF);
- "Updated October 2026 · Still the landscape" (a pause toggle, WCAG 2.2.2).

**Redirects** (COPY §8.9; the build makes them 301s):
- `/about/` → `/`
- `/projects` → `/work/`
- `/blog` → `/writing/`
- `/blog/Building-Autonomous-AI-Agents` and `/writing/building-modular-ai-agents/` → the note
- both `/blog/welcome-to-my-*-blog` → `/writing/`
- `/documents/QijinXu_Resume.pdf` → **`/resume/`** (the page, never the new PDF), with the file removed

## 6. Layout and type (exact values: `assets/css/tokens.css`; spec: SPEC-R4A)

- **Fonts:**
  - **Sofia Sans Extra Condensed 900** for the name and figures;
  - **Sofia Sans Condensed ~780** for page titles;
  - **Commissioner** for body and UI, weights 400 / 560 / 700 only;
  - Noto Serif SC, subset to 徐, for the seal only.
- **Sizes (phone → wide):** body 17→18 · lead 18→20 · item titles 18→20 · h2 22→26 · page titles 32→40 · name `clamp(44px, 35px + 2.6vw, 72px)` · small print 14 · **figures 22→26** (equal to h2, so a figure never adds a type size).
  - **Round 5: Home's name stays big:** 1.55 × that clamp (1.42 on phones) in `jade.css`: about 112 px at 1440, 106 at
    1280, 64 at 390. Jack, 2026-10-19: "keep Home's big name and relax the budget".
- **Widths:** a 1200 frame · 680 reading column · 960 wide blocks · title-in-strip ≤ 580 · margin rail 300. Gutters: 16/20 on phones, 32 on tablets, 40 on wide screens. Header 56 / 64 (48 on short screens).
- **Breakpoints:** phone < 640 · tablet 640–1199 · wide ≥ 1200 · short = under 500 tall **and** under 1200 wide.
- **Strip heights (phone / tablet / wide):**
  - home 190–240 (28svh; round 5, was 96–120) / 220 / 440–540 (≈522 at 900 tall);
  - sub 110–170 / 220 / 300–360;
  - doc 88–110 / 160 / 180;
  - short screens 80 / 80 / 64;
  - closing scene 160 / 200 / 240 (96 short);
  - round 5, below 1200 px only: a depth band (§7) 180 / 232; Writing's and Contact's closing 250 / 290.
- **Budgets (1440 / 1280 / 390), SPEC §15.2:**

  | Row | Target |
  |---|---|
  | Home first-screen words | ≥ 120 / 100 / 55 |
  | Subpage first-screen words | ≥ 150 / 120 / 90 |
  | Display-to-text ratio | ≤ 0.25 Home, ≤ 0.10 elsewhere |
  | Type sizes per screen | ≤ 4 |
  | Gaps between sections | 56–80 / 56–72 / 40–56 |
  | Work length | ≤ 5 / 6 / 8 screens |
  | LCP | ≤ 2.5 s |
  | Photo | starts on the first screen at all three sizes |
  | Motion | no text animating on scroll |
  | Contrast | body ≥ 7:1, small text ≥ 4.5:1 on its real background |

- **Accepted exceptions** (SPEC §15.4; don't "fix" them by shrinking type or padding copy):
  - 5 type sizes on Home (the demo-only "Draft art" label), the Résumé, Contact and Writing;
  - short pages (Contact, Writing, the Note, the 404) over 0.10 on wide screens;
  - short pages whose whole content fits the first screen report low word counts;
  - the strip → first section and the closing band are not "gaps";
  - **round 5: Home's big name** (Jack: "keep Home's big name and relax the budget"), as `tests/e2e/budgets.spec.ts`
    checks it: the name at 112 / 106 / 64 px (`--fs-name` × 1.55, × 1.42 up to 40 rem); Home's display-to-text ratio
    up to 0.40; 5 type sizes on Home, and on Work at 1280 × 720 (its section title, sub-heading, table head, text and
    caption share one short screen); Home at 1280 up to 2 words short. Work at 1280 was one of the four typography
    misses in the question that answer settled, so it counts under it;
  - **the polish round (2026-10-22), reported as open questions, not failures:** the Résumé's first screen up to 50
    words short (the shared hero, and its letterhead's explanatory note dropped), and Writing at 390 up to 0.12 (one
    note under a one-sentence intro, until there are more notes).
- **Removed for good:** the 100svh slides, the 294 px name, scroll fade-ins of text, the dark page-flood transition, `?transition=edge`. Mid-page vistas were removed in 4a; §11.A may bring back *composed* scenery between sections.

## 7. The painting (engine `assets/js/landscape/`; API = `mountLandscape()` JSDoc in `landscape/index.js`; palette in `landscape/palette.js`)

**Story (it follows the nav; round 5: one river runs the whole scroll):**
- A fall in his mountain's crag starts the river (**Home**); it runs past the river town where the work gets done (**Work**).
- It opens into the still lake by the pavilion where he writes (**Writing**).
- It narrows again at the foot of the ordered terraced fields of his record (**Résumé**) and opens into the crossing, where the ferry brings you across to meet him (**Contact**).
- Beyond the water, off the map, the path climbs a lone peak into mist (**404**).
- (Demo 4b had a sixth stretch with no page, "the road", between Work and Writing; round 5 removed it. The demo keeps it.)

| Page (stretch) | Place and its one focus | Misted strength · rich | State in 4a | State in 4b (draft art; `landscape/sets/`) |
|---|---|---|---|---|
| Home (0) | His mountain; a tiny traveller on the path; a hut in the ridge's saddle; (round 5) a thin fall in the near crag's cleft, the river's source | azurite + malachite · 0.55 · 0.75 | Draft figures (traveller, hut) | Polished traveller and hut (`home.js`), smoke; the living ground at ≥ 1200 px |
| Work (1) | River market town at a heavy timber rainbow bridge; still crowd; a boat lowering its mast; willows | blue-green hills · 0.40 · 0.60; town in light colour over ink | Draft art | Rebuilt market (`market.js`): back rows in depth mist, willows sway, the stall smokes, the punt drifts; the living ground at ≥ 1200 px |
| Writing and Note (2; 3 in the demo) | The still lake (where the river opens out); an open pavilion with one seated figure | a breath of blue-green · 0.14 · 0.22 (round 5; was ink only) | Lake and reflection | The pavilion on its spit under a pine (`pavilion.js`), shimmer in its reflection |
| Résumé (3; 4 in the demo) | Terraced fields stepping down to the river (round 5: on its far bank) | pale malachite · **0.55** · 0.75 | Low banded terraces (`tech.terr`), no figures | Terraces with level walls, fields, a path and a thatched farmhouse (`terraces.js`), its smoke; phones look closer |
| Contact (4; 5 in the demo) | The crossing: his mountain echoed on the far shore; a ferry at the jetty, turned toward you | indigo water · **0.50** · 0.70 | Water, far shore and echo; no ferry yet | The ferry at the jetty with the ferryman (`ferry.js`), the water's shimmer; (round 5) larger, so it holds the hero's focal area |
| 404 (5; 6 in the demo) | The lone peak beyond the water; the path running into mist | a trace · 0.08 · 0.12 | Lone peak | The path climbing into mist (`path.js`) |

**Round 5: one world** (the build, `src/features/landscape/engine/`; record: §12 "Round 5", step 2):
- **One composition** for every page (`compose.ts` `WORLD`: level, presence 1). Each place's character (Work's valley,
  the reading pages' paler presence, the 404's tall peak) lives in its own massifs, water, technique and relief
  (`Scene.amp`), never in a page's own distance or presence, so a place looks the same from every page and the far range
  is one line from end to end. A unit test keeps every page on it.
- **One river**: its waterline (0.29 scene heights, the town's own) is the scroll's horizon. Waters meet at each seam and
  add up to one; the near bank blends over a wider seam, so the river opens into the lake and the crossing and narrows
  at the terraces gradually. Near hills over a river (its near bank is land) stand whole; over open water they melt in.
- **One hero rule** (`compose.ts` `HERO`): every inner hero puts the waterline 0.66 down its box, at one scale per width
  class (wide: one stretch per box width; tablet 1000, phone 820, short 560 px per stretch) with the place's focus 0.694
  across on wide screens. Home's taller hero keeps its own placement across and its album leaves, on the same horizon
  rule. Closings follow it at 0.8 of the scale, the focus centred; a short page's twin closing looks closer (1.6x) at
  another part of the place. The story map's stills are cut from the same world at one height and one scale.
- **Colour** shifts gradually: pigment seams 0.34 wide (were 0.18). No new pigments.

**Round 5: Spring ink** (the style; record: §12 "Round 5", steps 2, 3, 3b; where it differs from the 4a/4b bullets
below, this wins). Every place, the river, the town and the ferry stay as approved; the style changes (and Home's
phone strip is taller and framed tighter on the peak and its light).
- **What it paints:** a clear spring morning. High-key ice-blue air; one light per place (one table, `engine/lights.ts`,
  read by the shaders, the stills and the story map): Home, Writing and Contact a white light with a heart and a
  bloom (Home's the strongest; Writing's and Contact's also lie on the water as a glitter column), Work, the Résumé
  and the 404 a sky glow only; one brush stroke of thick-thin dry-brush ink along the near crests (crisp near, soft
  far; thinner and slate-indigo on the lake and the crossing); the inner pages' sky graded only inside their own hero
  window, never left of the words.
- **Each place's spring moment:** Home: a hand-painted plum bough (white and pink blossoms), a swallow, the fall in
  its crag, and **one translucent silk ribbon** through the light (Home only: the one Wuthering Waves gesture). Work:
  fresh willows, a pair of swallows in open sky, the bridge and boats mirrored in the river, broken ripple rings.
  Writing: a lake willow, light on the water, petals on it. The Résumé: flooded treads holding the sky, a blossom
  tree, a swallow. Contact: a road of light across the water to the ferry.
- **What moves** (each element one flag in `elements.ts`; all stop under reduced motion and Still; ambient ≤ 15 fps,
  asleep after 45 s): the plum's ~0.5° sway; the ribbon's drift; the morning opening on the first Home load of a
  session (the cloud parts from the light, the plum's ink blooms, the swallow glides in; about 2.3 s, 1.6 s on phones;
  the words on paper from the first frame); the waterfall's lights; Contact's rushes and the ferry's drops; "Still"
  settling over ~0.8 s; the page change as a 340 ms mist dissolve (a long jump dissolves the old place into the new).
  The pointer gets two answers only: one small broken ring on water after a 450 ms rest or a tap (at most two), and
  the plum's gust of 3–5 petals (at most once per 8 s). Nothing follows the mouse.
- **The scroll on laptops (≥ 1200 px; step 3):** every page on the map is a living ground. The camera rises through
  the mist, the place settles beside the words and stays all the way down, and at the end it comes back to the
  opening. Home and Work as in 4b; Writing lifts and drifts 56 px east (its mountain clears the note's rule); the
  Résumé comes down the terraces in four short steps; Contact's ferry and reeds pass faster than the far shore. The
  scroll is a breeze, one wind per place (Home's plum and ribbon, Work's and Writing's willows, Contact's rushes; half
  strength and no petals on phones), and the light swells a little (at most +0.25, barely on short pages).
- **Phones and tablets (< 1200 px; steps 3 and 3b):** the strip parts into two depth layers and sinks into cloud as
  it leaves; the closing comes out of parting mist and ends exactly as approved. At a page's major breaks a **depth
  band** opens (`<Glimpse>`): a full-width band of the ice-blue morning with a piece of the page's own place, each
  further along the place and higher up one climb; as it moves up the screen the near hills sink and the sea of cloud
  climbs. Home 2 (tablets 1), Work 2, the Résumé 2 (before Experience and before Skills, never inside the timeline);
  Writing and Contact none mid-page, their closing (250 / 290 px) rising out of the cloud at the page's end; a phone
  held sideways none. The words never move and keep 40 px of paper round them; nothing in a band is lighter than the
  paper; bands never share a screen. Where the painting cannot draw, a band shows its own still.

- **Pigments:** azurite #2C5C8A (misted #7F9FB8) · malachite #3A806A (#8DB5A4) · timber brown #6B5444 (#8F8078), small areas only · ink grey #2A3034 · indigo wash #3E5664 · cinnabar #B1362B, seal only · paper #EFF1EE. Rejected: ochre glaze #CDB096 (reads beige). In the rich palette the figures run at 1.25. Round 5 adds the ice-blue air (toward #CFE3EE) and the plum's pinks, in small accents only.
- **Behaviour in 4a:**
  - Each page opens with its strip; wide screens put the title in the strip's mist.
  - The strip scrolls away.
  - Desktop only: a faint, ink-only horizon (no pigment, no figures). Phones read on plain paper.
  - Each page ends with a closing scene plus "Next: …".
  - The footer story map is drawn in pale feathered grey washes (4b: the real scenes, see below).
  - The pan between pages travels along the one painting.
  - Figures are drawn once per page (Canvas2D, in a worker where available) and composited with the same mist, grain and bleed. They are prepared before the pan, so they never pop in.
  - The cursor wake is a soft local opening of the mist, with no straight edge.
- **Behaviour in 4b** (on top of 4a's; details in `landscape/index.js` and `_notes/r4b/RECORD.md` §2–§5):
  - **The living ground** (§11.A, `body[data-ground="living"]`: Home and Work), on wide screens (≥ 1200 px) painted by a
    hardware GPU: the page's scene in three depth layers; as you scroll the camera lifts (near crags drop away, the
    middle peaks settle over a sea of mist, the far ranges barely move), the scene parks beside the reading column (Work:
    the town east of the bridge, in the margin, a curtain of mist hiding the rest), and near the end the camera comes down
    to the opening behind "Next: …" (Work: the bridge grows out of the mist east to west across the closing's run-in).
    Text sits on living veils (paper round its own lines, a torn mist edge). Below 1200 px, in Canvas2D and on a software
    rasteriser, the 4a strip and closing (the strip's painting leaves at 0.55 of the scroll); a present governor lowers
    the quality, and on a living page gives the stage up, if the GPU cannot present at 30 fps.
  - **Endings** (§11.B): every closing shows the page's own place (never the road to the next). A short page whose strip
    and closing share a screen (Writing, Contact) shows a different view of it, never the strip's figures or landmark
    again: the lake's west end; the crossing's west, its low far shore over open water (his mountain's echo stays in the
    strip; the view's scale follows the width, so no width brings it, the ferry or the Résumé's terraces in).
  - **The story map** (§11.B): five build-time stills cut from the engine (`tools/build-stills.py`, `assets/img/scenes/`),
    each place's own opening scene, joined in mist into one small handscroll.
  - **Small life** (§11.C): water shimmer, smoke, willow sway, one drifting punt; all stop for reduced motion, Still and
    the idle sleep. Not built (questions for Jack): a walker on the bridge, the ferry's bob.
  - **The mist drift** is gently perceptible in open sky on every page (a sky deck; open sky p99 3–6/255 over 8 s,
    mean 0.5–1.6 because most sky is uniform; text 0).
- **Engine discipline (keep):**
  - no rAF spin; frames only when dirty;
  - ambient drift ≤ 15 fps, sleeping after 45 s idle; wake ≤ 30 fps;
  - DPR caps and the adaptive governor;
  - reduced motion: a still frame;
  - fallbacks: Canvas2D, then paper;
  - text never waits for the painting.
- **Known in 4a (README "Known for 4b"; recheck visually):**
  - In Canvas2D the town's back rows don't dissolve into mist.
  - Work's figure layer takes 20–28 ms in headless CPU raster (spec 15 ms; real devices untested).
  - On phones, Work's strip (framed on the bridge) crosses the town's top row of roofs.
  - Contact's phone strip is about 40% pigment (the spec says about a quarter).

## 8. The photo

`assets/img/qijin-xu-colour.jpg` (720×900, ≤ 80 KB, no metadata), made by `tools/build-photo.swift` (Core Image) from `public/images/selfie.jpg`.
- **Full colour.** The white wall is flattened, lifted, and multiplied into the paper; the shoulders fade into white along their own line in the file itself (`build-photo.swift` step 3d, 4b; 4a's straight CSS mask is gone). No frame, radius, grey, mist, caption or vignette.
- **Placement:** directly below the Home hero. Beside "About me" from 640 px up (tablet 240 + 600, wide 280 + 640); above it on phones (72% wide).
- **Reshoot:** Jack will reshoot later, and swapping is one file. Side daylight, a real smile, someone else holding the camera. The top is undecided: the proposal said "the red top"; Claude's later advice (2026-10-09) was navy, grey or muted green, to blend with the palette.

## 9. Components kept

- **One brush button on the whole site** (round 5): Home's "See the work", a deep-jade loaded stroke whose tail breaks
  into dry brush. No shadow at rest; hover a soft glow and 4 % brighter; press 6 % darker and 1 px down; no bloom, no
  rings, no gloss. Every other action (the Résumé's PDF, Contact's Copy email, a note's "more") is a quiet ink link:
  ink text, the resting underline, jade on hover and focus.
- Dry-brush **link underline** (a resting mark on every link; round 5: a jade-tinted grey, #5D8987).
- **The nav mark** (round 5): the current page's brush tick is jade; at the click it lifts off the old word and is laid
  wet under the new one, inside the pan (back/forward: after the commit). Still when quiet.
- **Focus** (round 5): a plain 2 px deep-jade ring (#134A47, 8.8:1), no glow; on the brush button it sits 3 px off the
  stroke's own box. Selection a pale tint; the scrollbar jade.
- **The name's swash** (round 5): a jade stroke under Home's name, laid after the name settles; one warm sheen runs
  along it once per session when the morning's light is up.
- **Rows and diagrams** (round 5): on hover a 1.5 px jade rule draws in from the left on a row's bottom border; a small
  dark ink dot runs once along a diagram's arrows in flow order. No glow on the interface.
- **Seal**, stamped once per visit; the signature seal is static.
- Indigo **margin notes** (in the rail on wide screens, tap-to-open on phones).
- Brush **diagrams** with "Read as steps".
- **"Still the landscape"** pause.
- The returning header, with a paper band under it on every page (round 5: the sky never sits behind the nav).
- **The story map** (round 5): each place has a dim and a lit still; the current place holds its sun (a warmth, no tick
  bar), a hovered place's light rises. "Visited" places keeping a little light is built but off (a question for Jack).
- A demo-only same-document router with the painting pan. The build uses client navigation and a persistent canvas.

**Demo-only URL switches** (never ported to production):
- `?compare=1/0`: the panel at the bottom **right** (bottom left covered the photo), folded by default on phones; Colour ink / misted / rich; Name 56 / 72 / 96, Home only.
- `?palette=`, `?name=`: the same without the panel.
- `?router=off`
- `?slow=5`
- `?y=`, `?t=`: pre-scroll, and freeze the name's ink settle.
- `?ground=4a`: Home and Work with 4a's strip and closing (A/B against the living ground).
- `?sink=…&lag=…`: the living ground's 33 tunables (the keys of `main.js` `TUNE`; defaults and meanings in
  `landscape/index.js` `STAGE` and `STAGE_AT`), read per URL, never remembered. Some thin the reading veils, so a tuned
  URL is never a contrast measurement.
- In the build they are compiled out with the engine's QA hooks (`opts.tune`, `qa()`, `stats().tune` / `veils` /
  `memory`): README's port table.

**"Draft art" label:** demo-only. It marks unfinished scenes and comes off as each scene is approved. In 4b it is on all
seven pages with a scene (Home, Work, the Résumé, Contact, Writing, the Note, the 404): in the strip's bottom feather, on
Home and Work at ≥ 1200 px in the first screen's top-right sky. Set in ink-3 on a paper reserve. Hidden without JS or
landscape. It is the accepted fifth type size on Home.

## 10. Content pipelines (performance first)

- **Résumé:** the page `/resume/` and `resume.json` are **two hand-kept copies** in the demo; they already differ ("Dean's List" is missing from the JSON). `tools/build-pdf.py` prints `/resume/` to `resume.pdf` (2 pages) and **refuses to write** if a phone pattern or `tel:` appears. **In the build, make `resume.json` the single source** of the page, the PDF (CI, phone gate) and the JSON-LD.
- **GitHub "In the open":**
  - **BUILD time only, never in the visitor's browser** (Jack: performance first here).
  - Demo: `tools/sync-projects.py --discover` (public API) writes static HTML; `data/projects.json` holds only overrides.
  - Rules: public, not a fork, not archived, non-empty; skip placeholders (< 10 KB, or a "To be announced"-style description); never `job-application`; `my-website` hidden until the launch gate; "Recent" (pushed in the last 24 months) vs a quiet "Early work 2019–2020"; GitHub topic `featured` makes a repo featured.
  - Build: fetch server-side (ISR `revalidate: 86400` or a daily Vercel cron); pinned repos via GraphQL with a server token are optional.
- **Shared blocks:** `tools/sync-shared.py` copies three blocks from `_template.html` into every page and sets `aria-current`; it skips redirect stubs and also syncs `_tools/components.html`.
  - head: fonts, CSS, boot script, Person JSON-LD;
  - top: canvas, ink filters, header;
  - bottom: footer.
- **SEO/AI:**
  - per-page titles and meta (COPY §8.1);
  - Person JSON-LD on every page (`image` is the colour photo; `award` lists 2024 and 2026; `sameAs` GitHub and LinkedIn);
  - ProfilePage on `/`; BlogPosting on the note;
  - `resume.json` (JSON Resume), `llms.txt` (facts only, never instructions to AI), `sitemap.xml`, `robots.txt`.
- **Copy conventions (COPY.md header):**
  - plain first person on the site, third person in meta and JSON-LD;
  - **banned words:** revolutionary, cutting-edge, passionate, leverage/leveraging, synergy, seamless, world-class, innovative;
  - curly quotes, en-dash ranges, figures bold at text size;
  - **DRAFT** = built as written, pending Jack; `{{PENDING}}` = leave the element out; **OMITTED** = build nothing, no placeholder;
  - never invent words in Jack's voice.

## 11. OPEN ITEMS: the scope of demo 4b

**A. Bring back "the mountain follows the scroll and becomes the background", and compose the art WITH the page** (Jack, 2026-10-14).
- In rounds 2 and 3 the hero painting moved with the scroll and settled into the page background; Jack misses it. In 4a the painting reads as a separate strip with "all the text sitting on top".
- **Goal:**
  - The opening scene stays behind the page and turns, as you scroll and through mist, into a living background.
  - Text sits in the painting's empty sky and mist; the scenery frames sections; mist bands carry you between sections.
- **The 4a rules this deliberately relaxes, so nothing changes silently:**
  - the "ink-only, no figures" desktop horizon;
  - "phones read on plain paper";
  - the "no mid-page vistas" rule;
  - the strip scrolling away 1:1.
- **What still holds:**
  - readability wins: paper veils under text, never text on colour, the §6 contrast budgets;
  - phones stay calm;
  - the landscape is preserved (§4.3).
- Prototype on Home and Work first, then show Jack.
- **Built in 4b** (the "depth" prototype won, `_notes/r4b/RECORD.md` §1.2): see §7, "Behaviour in 4b". Jack, 2026-10-16: "Yes" (answer 7).

**B. Page endings must match each page's real scene.** The footer story map (grey washes today) and the "Next: …" closing scenes should be small, faithful versions of each page's actual opening scene: the market for Work, his mountain for Home, and so on. This relaxes "the story map stays grey". Jack's words were "that horizontal scroll doesn't match the heroes of each page"; if unsure which strip he meant, do both.
**Built in 4b** (both): every closing shows its own place; the story map is five stills of the real scenes. Awaiting Jack.

**C. The places and their life:**
- The pavilion (Writing), the ferry and jetty (Contact), the terraces given real character (Résumé), and the path into mist (404), all at draft quality with the "Draft art" label.
- Polish Home's traveller and hut and Work's market (§7 known issues).
- **Small life:** water shimmer, a drifting boat, smoke, willow sway. Crowds stand still. Allow one slow walker on the bridge only if it looks like the painting breathing. Everything stops for reduced motion, Still and idle.
- **The "tell the places apart" test:** show the six strips, text hidden, at phone size, to people new to the site. They must sort them into six different places and pick out Work and Contact unaided. Run round 3 as the baseline.
- **Built in 4b** at draft quality (§7 table), with shimmer, smoke, willow sway and the drifting punt; the walker and the ferry's bob are not built (Jack's call). The places test (`tools/qa/places.py`, blind sheet, seed 31, 390 px) was run in the final review with three fresh agents standing in for newcomers: **all three matched all six places (6/6)**. (The workflow first reported a Résumé miss; that was a scoring bug that dropped the accents of "Résumé", not a viewer's error. The tighter phone framing of the terraces made because of it is kept: it also reads better; `_notes/r4b/RECORD.md` §8.3.) Agents are a proxy: rerun it with people new to the site before Jack signs off.

**D. Smaller items:**
- The mist drift is barely visible (4a QA measured ≈ 0.4/255 in the sky over 8 s); make it gently perceptible. **Done** (the sky deck).
- The photo's bottom fade is a straight gradient; make it follow the shoulders. **Done** (in the file, step 3d).
- Hide the "Draft art" label without JS. **Done.**
- Hide the header and actions in print on every page (the closing is already hidden). **Done.**
- At 1440, Home below the hero is one column with about 45% of the width empty on the right. **Done** by the living ground (his mountain parks at the right).
- **Real-phone check:** the iOS Simulator, Jack's own iPhone over home Wi-Fi, and an Android if available. This belongs to 4b, not the performance backlog. **Not done:** it needs Jack's device (and Safari: `texelFetch` on RGBA16F and bitmap premultiply are unjudged).

**State of A–C after 4b:** A, B and C are built at draft quality and reviewed; Jack has not seen them. Open art points for
Jack (`_notes/r4b/RECORD.md` §7.1): Home's About me (photo and text, the page's one wide block) covers the middle peaks
mid-lift, so the painting thins there; the walker and the ferry's bob (C); the places' approval, which removes each
"Draft art" label.

**E. Questions for Jack, and his answers of 2026-10-16** (his words in quotes; where an answer was ambiguous, the
reading below is the art lead's and is marked *confirm*):
1. Approve or rewrite the **DRAFT** words: hero lead, About me, Now, What I work on, Say hello. **Launch needs this.**
   → "Approve". Done (COPY.md marks them APPROVED).
2. **Work's length** is 6.24 / 7.70 / 8.34 screens against ≤ 5 / 6 / 8. Options: (a) accept; (b) fold How I build's drawing behind its "Read as steps" (5.62 / 6.93 / 7.40); (c) fold the flagships' Evidence and Stack (5.83 / 7.19 / 7.83). Claude suggested (b) to Jack on 2026-10-10; he hasn't answered.
   → "A bit too long, maybe keep it concise and have dedicated pages for the rest." **Build:** `/work/` becomes a concise
   index (the six-project table, How I build, In the open); every case gets its own page `/work/<slug>/` (one MDX file each),
   linked from its table row. The length budget then holds by construction.
3. **"At RBC"** appears on Work and the Résumé while the rest of the site keeps clients anonymous. Keep it, or say "a major Canadian bank"?
   → "Yes": read as **keep "At RBC"** (as built). *Confirm.*
4. The honour wording; whether the 2026 award's project may be named; "The hard part" for the two flagship cases (OMITTED until he writes it); his game tools / side projects (OMITTED); "For organisers" bios (OMITTED); keep or drop Work's glossary notes.
   → "Yes" (a several-part question): the built defaults stand: honour wording as built, the 2026 award's project unnamed,
   OMITTED items stay out until he writes them, glossary notes kept. The dedicated case pages (answer 2) are the natural home
   for "The hard part" when he writes it. *Confirm the parts that matter to him.*
   → **Superseded 22 Oct 2026** for the honours and the award: Jack made his career-kit résumé (`resume_ats.tex`) the
   source of truth, so the 2026 award names the email agent, the honours read "First in Class · Dean’s List (all
   semesters)" and education ends in 2020 (COPY.md, Résumé).
5. **The launch-gate route:** a fresh v2 repo (Claude suggested this) vs a history rewrite (irreversible) vs making it private. Then make `job-application` private (§2).
   → "Just commit to the repo and rewrite the old version… Put the old version site into a branch archive/…". **Route:** the same
   repo; v2 replaces the old site on `master`; the old site lives on in a branch **`archive/v1-site`**. Because the repo is public and
   the old résumé PDF (with his phone number) is in its history, every branch, the archive included, must have
   `public/documents/QijinXu_Resume.pdf` purged from history (`git filter-repo`) before anything is pushed, then all branches
   force-pushed. That is irreversible and public: Jack gives the explicit go at launch and runs the pushes (§1). Ask GitHub
   to drop cached views of the old commits if they still serve. Then make `job-application` private once
   `qijinxu.com/resume.pdf` is live.
6. **Off-site consistency:** GitHub profile name "Qijin Xu", company CGI, location Toronto, a photo; LinkedIn title "Lead AI/ML Architect". A similarly named biotech executive competes in name searches.
   → "Will do" (Jack's to-do).

**New with 4b** (the art lead's recommendation in brackets):
7. **Is this the "mountain following my scrolls" he remembers?** The camera lifts, as in round 1: scrolling down, the painting sinks on screen while the text rises, settles beside the reading column, and comes back to the opening at the end. Compare `?ground=4a`. (Keep.)
   → "Yes". Keep; port it.
8. **Short pages' endings** (Writing, Contact): a different view of the same place under "Next: …" (built), or end on the story map alone? (Keep the different view.)
   → "The 'Next' feels off." Art lead's reading: the fixed tour (Home → Work → Résumé → Contact → Home) under a large
   "Next: …" reads like a slide deck. **Build default:** no "Next: …" link. Long pages (Home, Work, the Résumé, the Note, the
   case pages) end on their own closing scene; short pages (Writing, Contact, the 404) end on the story map alone (no twin
   closing). The story map, which links every place, is the way on. *Confirm on the build's first preview.*
9. **Small life:** is it visible enough? It is deliberately quiet (the punt, the hut's smoke, the shimmer). Add the one slow walker on Work's bridge, or the ferry's bob? (Neither: people stand still, as DESIGN §4 says.)
   → "Yes but have an option to toggle it off." **Build:** add the one slow walker on the bridge and the ferry's bob, each only if
   it reads as the painting breathing; and give life a clear off switch: "Still the landscape" (footer) already stops all
   motion, so make it obvious and remembered across visits (not only per session). *Confirm the walker on the first preview.*
10. **Motion while reading** on desktop Home and Work: the mist and life keep breathing at ≤ 15 fps until 45 s idle (4a was still mid-page). Keep, or let it calm once the painting has settled? (Keep; measure on his laptop first.)
   → "Keep it".
11. **Machines without a usable GPU** (software rendering, many remote desktops) get 4a's strip and closing on Home and Work, not the living ground. Acceptable? (Yes.)
   → "Sure if this is the best". Keep.
12. **Print:** printed Work, Contact, Writing, the Note and the 404 no longer carry his name (the header is hidden in print). Add a print-only name line? (Yes, small.)
   → "Sure." **Build:** a small print-only "Qijin Xu · qijinxu.com" line on every page except the Résumé (which has its own header).
13. **The photo's red top** is now the strongest colour beside the blue-green crags: more weight for the reshoot in navy, grey or muted green (§8).
   → "Leave it for now".
14. **Real-phone check:** open the demo on his iPhone (and an Android, Safari on a Mac) before approval; Xcode is not installed, so the iOS Simulator was not available.
   → "Leave it, will check later". Do it on the build's previews (Vercel preview URLs work on any phone).
15. **What to commit:** 4b is uncommitted (about 33 modified and 59 new files, including `_notes/r4b/` with 29 working notes). Commit all, or condense the notes first? Pushing publishes (the repo is public).
   → "Condense first". Done: `_notes/r4b/RECORD.md`; 4b committed on `redesign/v2` (not pushed).

## 12. The real build (Jack approved 4b as the baseline on 2026-10-16)

**Jack's requirements (2026-10-16): "nice organized code structure, latest stacks, easy to update in the future".** So:
- **Latest stable versions, verified on the day** (the versions below are from October 2026 research; re-check each before
  pinning, never from memory), pinned exactly, with a lockfile and Renovate or Dependabot for updates.
- **Organised by feature:** `app/` routes thin; `components/` (ui, layout, sections), `features/landscape/` (the engine as a
  typed module with its hooks), `content/` (all words and data), `lib/`, `styles/` (tokens + CSS Modules); one owner per
  concern; no dead demo code (compare panel, URL tunables, QA hooks compiled out, README port table).
- **Easy to update:** every word and fact lives in content files, never in components: `resume.json` (the single source
  of the web résumé, the PDF and the JSON-LD), one MDX file per writing note and per Work case (answer 2), a small typed
  `site` config (name, links, nav, Now); adding a note or a case is one new file; a short `CONTENT.md` says how.
- **Safe to update:** CI on every push (typecheck, lint, unit tests for the content schemas and the engine's pure parts,
  Playwright smoke tests per route, the compliance gates: phone, CJK, PMP, old PDF; the §6 budgets; link check).
- **New from the 4b answers:** Work's dedicated case pages (2), no "Next: …" link and short pages ending on the story map
  (8), the walker and the ferry's bob plus a remembered off switch for motion (9), a print-only name line (12), the launch
  route (5).

- **Stack:** Next.js 16 App Router on Vercel (the free Hobby plan; custom domains are included). TypeScript strict. MDX via `@next/mdx`, replacing `next-mdx-remote`. Shiki, RSS, and `next/font` self-hosting, which fixes the slow first paint from Google Fonts.
- **Architecture** (port table in README):
  - The landscape canvas lives in `app/layout.tsx`, persistent across routes. Client navigation plus React `<ViewTransition>`; the pan is the transition. `prepare()` runs on link hover or focus.
  - Each effect module becomes a hook or component behind the same API, Strict-Mode safe.
  - Page CSS **must be scoped** (CSS Modules or `@scope`): the demo loads one page stylesheet per document, and the App Router doesn't.
- **Pipelines:** `resume.json` → web résumé + PDF (Playwright in CI, phone gate) + JSON-LD · GitHub list at build or ISR · notes as MDX · the §5 redirects.
- **Environment:**
  - **Node.js is not installed** on Jack's Mac; it's needed.
  - Vercel builds of the old site fail; the cause is unconfirmed. Vercel deprecated Node 20 for builds on 2026-10-01, so set Node 24 in the new project.
  - Turn on Deployment Protection, so old deployment URLs stop serving the old PDF.
- **To re-verify at build time** (from 2026-10-08 research; not re-checked since):
  - next-mdx-remote is archived and affected by CVE-2026-0969;
  - `<ViewTransition>` is stable in React 19.3;
  - `@next/mdx` is at 16.4.0.
- **Launch:**
  - Pass the §2 launch gate by the route of §11.E answer 5 (archive branch, history purge, Jack's go). The DRAFT words are approved (2026-10-16); the 4b scenes are the approved baseline ("Draft art" is a demo-only label and is not ported).
  - Connect **qijinxu.com** (Cloudflare DNS → Vercel) and redirect `my-website-freedomjack.vercel.app` → `qijinxu.com`.
  - Update canonicals, JSON-LD, `llms.txt`, `resume.json` and the résumé contact line to `https://qijinxu.com`.
  - `qijinxu.com/resume.pdf` becomes Jack's résumé link.
- **Performance backlog** (Claude's memory note `website-perf-backlog`; don't start it unprompted; visuals first): a pre-rendered still of each strip, a device check, CI budgets. **Exception: GitHub data must never cost visitors performance.**

### Build status (2026-10-16)

- **Versions** (checked as the latest stable on 2026-10-16, pinned exactly): Next.js and `@next/mdx` 16.4.2, React
  19.3.1, TypeScript 6.0.3, zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1, ESLint 9.39.5, Node 24.22.0. `next-mdx-remote` is not used. Route changes use the demo's own exit / travel / enter
  and the CSS `@view-transition` cross-fade, not React's `<ViewTransition>`. Shiki is not added: no note has code yet.
- **Verified:** Home, Résumé and the Note match the demo pixel for pixel apart from the two removed demo-only bits ("Draft
  art", "Next: …"); Home's, Writing's and Résumé's story-map stills come out byte-identical to the demo's, from the same
  tool settings. CI: type-check, lint, format, 66 unit tests, the stills check, the audit (runtime dependencies), the
  PDF gate, compliance, links, and 35 Playwright tests (a smoke test per route, client navigation, the §6 budgets at
  1440, 1280 and 390).
- **Added from §11.E:** the case pages `/work/<slug>/`, endings without "Next" (round 5: every page but the 404 ends on
  its own closing scene, then the story map), Still remembered across visits (`localStorage`), the print-only name line, the 301 redirects, GitHub at
  build time and daily (ISR), never in the browser. **The walker** (one figure crossing Work's bridge, about 4 px a
  second) and **the ferry's bob** (about a pixel, over a 7 s period) are in. Both are sprites that move on the GPU; Jack
  confirms them on the preview.
- **Open for Jack:**
  1. A case page at 390 is over the display-to-reading budget (.28 > .10): the case's long title is the h1 at title
     size (32 px, two or three lines). Accept it, or set case titles at the section-heading size on phones.
  2. An old address without its trailing slash (`/about`) takes one 308 to `/about/` and then the 301. Next.js adds the
     slash first; a single hop would need middleware.
  3. Deleting `legacy-v1/` (the old app, moved there with `git mv`) and untracking the old `.next/` files the v1 repo
     committed. **Done** (2026-10-22): `legacy-v1/` is removed (78 files) with its entries in the README's tree,
     `tsconfig.json` and the ESLint and Prettier ignores; `0b3c25b` had already untracked the v1 `.next/` files.
  4. The Vercel project: Node 24 comes from `engines` in `package.json`; turn on Deployment Protection; a preview needs
     this branch pushed (public).
- **The engine is strict TypeScript** (2026-10-16, `7923e2a`, from a side session; stills byte-identical).
- **Known locally:** this Mac's network cannot reach `api.github.com`, so local builds use `content/github/snapshot.json`
  (logged as a warning). Vercel's builds fetch live.

### Round 5: the macro pass (Jack's inputs, 2026-10-16)

Jack, after the first preview ("not hard requirements"): (1) the big scroll is not coherent; (2) the heroes differ, at least
in height, and all pages should share something common; (3) no scrolling effect across the pages; (4) a "younger" look,
like Wuthering Waves' Chinese ink style; (5) content after the macro work. Order agreed: **1 structure → 2 style mockups →
3 scroll motion (built in the chosen style) → 4 content.**

**Step 1, structure** (built on the branch as a local preview; waiting for Jack's review):
- **One order everywhere, the painting's** (Jack: "use the painting order, so it maxes out the coherence of the
  painting"). The nav is now Work · Writing · Résumé · Contact, matching the handscroll and the story map. Writing joins the
  nav with one note (the content step will deal with that). The empty road between Work and Writing stays, as deliberate
  mist; it is reconsidered only if it still reads as a gap. (Step 2 removed it.) The header keeps one row down to 360 px: the tight sizes now
  apply up to 416 px, and 8 px between the links at 360.
- **One hero system.** Home keeps its tall hero. Every other page has the same hero: the same height (360 / 300 / 169 at
  1440 / 1280 / 390), with the title at the same place (its first line 200 px above the band's foot on wide screens).
  The Résumé and the Note give up their low art-only band and take the same hero. Their titles move into it, the Note's
  as its article's header. The Résumé's PDF keeps its letterhead exactly, through a print-only copy of the name and the
  title. The engine's framing for the low band (`doc`) is unused; remove it once Jack approves.
- **One ending.** Every page on the road ends on its own closing scene, then the story map. This undoes the build default
  of §11.E answer 8, where Jack's words were only "the 'Next' feels off". On Writing and Contact the closing is the twin
  view the engine already has for short pages. The 404, off the map, has none.

**Jack on the step-1 preview (2026-10-16), two corrections:**
- "For the hero alignment, the text is aligned, but the images/hero background is not." Step 1 aligned the title block.
  Each hero's scene still sits at its own place, height and scale (Work's town centred on a high horizon, Writing's peak
  high with the pavilion far right, the Résumé's hill low and small, Contact's ferry low and tiny). **The scenes must line
  up too:** the same focal area, horizon and scale in every inner hero. That is the engine's framing (compose.ts), so it
  belongs with the painting's recomposition.
- **Point 1 was about the painting, not the nav.** "The big scroll is not coherent" means the painting does not read as one
  handscroll. Five separate vignettes float in mist, with a hole where the empty road is, a different scale and horizon at
  each place, and five abrupt palettes. Making the nav follow the painting's order was right, but it fixes none of that.
  **The painting-coherence session** recomposes it as one continuous scroll:
  - one river the whole length: Home's mountain stream → Work's river town → Writing's lake → it waters the Résumé's
    terraces → Contact's open water;
  - one unbroken far range along the top;
  - real transitions between neighbours (a river bend, trees, a bridge) instead of blank mist;
  - no empty road;
  - one shared horizon and scale, and a palette that shifts gradually along the scroll;
  - plus the aligned hero scenes.
  The panorama is shown to Jack before anything ships.
- Jack asked for the remaining items to run as their own sessions. Running: **painting coherence** (above) and **"younger"
  style mockups** (2–3 directions, mockups only). Held until both land: scroll motion (built in the chosen style on the
  recomposed painting), then content.

**Step 2, the painting as one handscroll and the heroes aligned** (2026-10-16, the painting-coherence session; branch
`claude/practical-faraday-79b0df`):
- **What Jack saw, and its cause.** Each page applied its own composition (Work 'deep' at 0.8, Writing 0.6, the Résumé
  0.5, Contact 0.9, the 404 'high') to the whole world, so the same place looked different from every page, each had its
  own horizon and size, and the stills of the story map never lined up; the water was three unrelated patches; the road
  (stretch 2) was a page-less hole. The heroes shared a box but not a framing: at 1440 the scene's top ran 0.43–0.64
  scene heights and its focus x 893–1123 px; at 390 the scale ran 449–1240 px per stretch (2.8x).
- **Jack's answers** (on the "before" sheets and the plan): "Sure as long as the big scroll is still nice, and have
  distinction in different section. You can have an animation that fly through the transition area, not every pages'
  hero needs to be right next to each other, as long as the transition shows. Just an idea, you decide."
- **The road is removed** (the art lead's call, which Jack left open): the places sit side by side, one per stretch, in
  the nav's order (Home 0, Work 1, Writing 2, Résumé 3, Contact 4, the 404 5), and every seam is a real transition the
  pan flies through: the river bends past a spur, the near bank sinks or rises, the colour shifts. A whole stretch with
  no page would have stayed a hole in the story map (a sixth picture without a label) or a scene nobody stops at.
- **One world** (§7 "Round 5: one world"): one composition for every page; each place's character in its own massifs,
  water, technique and relief; one river from Home's new fall to the crossing, its waterline the scroll's horizon; one
  continuous far range; colour seams twice as wide. Distinction stays: Home's blue-green mountain, Work's town on the
  river, Writing's pale still lake and mirror, the Résumé's malachite terraces on the river's far bank, Contact's indigo
  open water and ferry, the 404's single grey peak.
- **Aligned heroes** (`compose.ts` `HERO`): the same horizon, scale and focal area in every inner hero at 1440, 1280 and
  390 (unit-tested); Home's taller hero on the same horizon rule; closings by the same rule; short pages' twin closings
  look closer at another part of their place (never the strip's landmark twice).
- **Figure sets re-seated:** the moving sets place themselves by one stretch constant `K` (moving a place is one line);
  the terraces stand on the river's far bank (their foot is the waterline; their layer reaches 0.5); the ferry is
  larger (it holds the focal area as the bridge and the pavilion do); Home has a thin fall in its near crag's cleft
  (`home.ts` `waterfall()`), the river's source; the 404's peak is one narrow summit (0.465) on its own relief.
- **Engine additions:** `sceneField` blends the near bank and reports open water (a 12th field; ridge row 8's third
  channel), read by the shader and Canvas2D alike; `planeTop` includes the far shore's lift over water, as painted;
  `Scene.amp` / `ampAt` (CPU only); a QA-only `opts.frame` (a fixed framing for the strip window) for the panorama
  tool and the stills. Work's town, bridge and stage numbers are unchanged (its waterline and near bank are given as it
  always stood on them), so `RIVER_FRONT` and `STAGE_AT[1].arch` hold.
- **The story map** has five equal columns and no road; its stills are cut from the one world at one height range
  (0.18–0.60) and one scale, each centred on its place, so the far range and the river run on from one still into the
  next (`tools/build-stills.ts`; 53 KB for ten files).
- **Verified:** `npm run ci`, the e2e suite (35, the §6 budgets at 1440 / 1280 / 390), compliance, links, the PDF gate;
  panoramas, hero sheets and closings on the real GPU (Metal) before and after. Committed as `fce4c45` (Jack: "You may
  commit for now").

**Step 2b, the river town in the scroll** (2026-10-16; Jack: "Is the town ('Work' part) feel natural overall in the
entire scroll?"). Three independent critiques (Song handscroll practice, one painting, a first-time viewer) found it
**partly natural**: a crisp strip laid on the painting. It started and stopped at full density, there was a hole in the
far range above it, there was no land under its near bank, its banks were ruler-straight over bare paper, nothing joined
it to the mountain or the lake, and it was the darkest ink on the far bank. Jack approved the six fixes in that order.
After a second, adversarial review (which caught a regression on Home, since put back), the result:
- **The far range and a low ridge behind the town** (`shaders.ts`: over the town only, `TOWN` from the river's depth
  profile, just the town's own hills keep misty feet; the far range and the guests run on as they do over the mountain
  and the lake). The town's hills are broad and rounded (guests, not hosts), so no spire stands behind the roofs.
- **Land under the near bank**: an earth wash toned with ink (never beige), a little misted green, a point and a bay in
  the bank away from the bridge, its east end dissolving into mist and reeds. The willows stand in groups of different
  sizes, quieter, rooted (the three larger ones sway).
- **The town grows out of the countryside and goes back into it**: every slot draws its layout from the row's own stream
  as before, so the houses near the bridge are unchanged; at the ends the back rows go first, the front row's houses
  grow smaller and thatched and give way to village trees; a farmhouse grove at the west, a reed hut on posts at the
  east; the stone quay only along the town proper, earth banks and reeds beyond it.
- **A breath further back**: line and tile lighter away from the focus (the bridge, the landmark) and toward the ends;
  the bridge's timber and the hulls cooled; the hulls lighter than the bridge, which stays the darkest ink.
- **The seams are land**: the banks start under his mountain's foot; one broad low headland at the east instead of two
  stray crags; the far bank bends up and back past the hut as the river opens into the lake.
- **The river has a surface**: ripple lines gathered round the bridge and the big boat, torn reflections under the
  hulls, a timber landing stage, water strokes carried on toward the lake.
- **Kept:** the bridge (pinned: its banks do not move within 180 px of its crown), the rows by the bridge, the boats,
  the crowd, the walker, the punt, the landmark; `RIVER_FRONT` and `STAGE_AT[1].arch` hold. Home's and Writing's heroes
  are unchanged (pixel diff at most a few levels). Verified as above, plus contrast on Work, Home and Writing and the
  reduced-motion / Still stops.

(The painting's commits are named "step 2" and "2b"; in the agreed order they finish step 1, and the style is step 2.)

**Steps 2, 3 and 3b: approved and committed on `round5/spring-ink`** (2026-10-19; on top of `redesign/v2`, not
pushed). Designed as mockups in a side session (multi-agent: designers, judges, adversarial
reviewers), then ported. The full record (every fix, proof and rejected option): the mockup's `NOTES.md` and the
side session's `HANDOVER.md`, in session folders that may be wiped; this section is the condensed record. Jack, on
2026-10-19: "put the approved Spring ink look, its elements, the scroll motion and the phone depth bands onto
redesign/v2 on top of the latest commits, run the full checks and commit."

- **Step 2, the style "Spring ink"** (§4.5, §7, §9). Round 1's three directions were rejected ("B and C looks
  absolutely cheap"). Round 2 studied 23 official Wuthering Waves frames (Chinese chapters only; its own site is
  blocked by CGI's filter and was not bypassed) and built five directions in the real engine; the judges' mix,
  "Spring ink", won 3/3. Jack, 2026-10-18: "Go with Spring ink. Do the polish round on the listed weak points. Also
  dont focus on existing arts/background, think for all the elements you can add to make it feel younger and maybe
  more 'Wuthering Waves'". A polish round (the painted plum, the ribbon, a spring moment per inner page, Work's
  swallows in open sky, a clean phone strip foot), then 38 element ideas, 20 prototyped, 11 kept after an adversarial
  round that cut the "game launcher" finish. Jack, 2026-10-18: "Approve Spring ink with these elements and the rule
  changes. Move on to step 3, scroll motion, in this style."
- **Step 3, scroll motion on laptops** (§7). Three systems prototyped; "The camera travels" won 3/3, with grafts (one
  wind per place, the light's swell, parting mist for phone closings); then 11 fixes. Jack, 2026-10-18: "Approve on
  laptops, but phones should do more: give them a longer depth effect while reading."
- **Step 3b, depth bands on phones and tablets** (§7). "Windows into the painting" won 3/3; then a reviewer's 13
  fixes and two last-fix rounds. Jack, 2026-10-19: "Approve the phone scroll as built: no band on phones held
  sideways, one Home band on tablets, keep Home's big name and relax the budget. Move on to step 4, the content."
- **Where it lives:** `src/features/landscape/elements.ts` is the one switch table (17 flags; off = that element's
  engine paths and CSS gone, and for `silkVeil`, `air` and `glimpses` its shader code too, by GLSL `#define`s; the
  others' shader code stays compiled in, skipped by its uniforms; `visited` off); `engine/lights.ts` the one light
  table; `engine/sets/young.ts` the plum, swallow, willow and ripples; `components/page/Glimpse.tsx` the bands;
  `styles/jade.css` and `finish.css` the interface; `effects/finish.ts`, `nav-mark.ts`, `swash.ts`; e2e
  `scroll.spec.ts` and `glimpse.spec.ts`.
- **The rule changes, as approved** (numbered as in the mockup's notes):
  1. jade as the UI accent (the name, the one button, the nav tick); 8. page titles in deep jade; 20. focus, selection
     and scrollbar in jade, no glow;
  2, 12. pink in small painted accents only (Home's plum, the Résumé's blossom tree, Writing's petals);
  3. ice-blue air and a light brighter than the paper; the paper under text stays cool;
  4, 10. Home's phone strip twice as tall (28svh) and framed tighter on the peak and its light;
  5. a paper band under the header on every page;
  6. one brush button on the site; the other actions are quiet ink links;
  7. dry-brush ink along the near summits;
  9, 15. one silk ribbon, at Home's light only;
  11. the plum sways (~0.5°); 13. a third swallow (the Résumé); 14. a lake willow on Writing;
  16. the page change as a 340 ms mist dissolve;
  17. the first Home visit of a session opens on cloud (~2.3 s, 1.6 s on phones);
  18. the pointer answered only by one ring on water and the plum's gust; nothing follows the mouse;
  19. the story map's stills dim and lit (cap 60 → 110 KB, lazy below the fold);
  21, 22. Writing, the Résumé and Contact become living grounds on wide screens, ending on the stage's own end pose;
  23. below 1200 px the strip parts and sinks into cloud as it leaves, the closing comes out of parting mist;
  24. the Résumé comes down in four short steps; 25. Contact travels sideways, Writing drifts 56 px east;
  26. on living pages the footer's rows sit on paper veils;
  28. the scroll is a breeze, one wind per place; 29. one curve of light (at most +0.25), a glow only;
  30. the story map's "visited" light: built, off by default;
  31–36. below 1200 px, a depth band of the page's own place at its major breaks (Home 2, tablets 1; Work 2; the Résumé
     2), 180 px on phones (its outer 40 px paper and mist), column-wide on tablets, the sky a full-width ice-blue band
     on phones; none inside a section; none on a phone held sideways; Writing and Contact end on their place rising
     out of the cloud; a band without the painting shows its own still;
  and §6: Home's name stays big, its budget relaxed.
- **Tried and cut:** the silk thread through every page, the silk-curtain page wipe (now the plain mist dissolve), the
  lit wake edge, pointer parallax, the light shafts through the saddle (Home's bloom keeps its three soft shafts), the
  page-change swallow, section dividers, the button's gloss and
  press rings, the story map's caret tick, the waterfall glint; "the way on" (Home's and the Résumé's sideways ending,
  rule 27, withdrawn); on phones, a third Home band ("Now"), a band inside the Résumé's timeline, and a slim 110 px
  band on sideways phones (the alternative, the place in the right margin, kept only as a still).
- **Known open:**
  - **No real-device test yet** (iOS Safari, Android Chrome: the URL bar's resizes, a mid-range GPU at DPR 3, battery).
    Every number so far is this Mac's GPU with a phone emulated.
  - **The Canvas2D fallback paints Spring ink's figure sets and misted palette, without the shader work** (no
    ice-blue air or light, no dry-brush ink, none of the painting's elements, no scroll motion; the bands keep their
    stills), and software GL keeps the approved strips and closings, with no parting and no air.
  - **Memory on phones is 4–9 MB more per page** at DPR 3 (each band's own view and figure layer; Work +8.2 MB).
  - For Jack: the story map's "visited" light (built, off: on or off?); the bands' views are taste (numbers in the
    engine's `GLIMPSE.at`).

**Step 4, the content: started** (2026-10-19). A review by five reader lenses, an editor, and provenance and value
critics; nothing invents a fact or Jack's voice, and nothing in the repo is edited yet. The doc for Jack, "Step 4, the
content" (https://claude.ai/code/artifact/65a17a60-ad11-432d-a4dd-6cd2563a472d): 14 questions (1–5 first:
"Canada's largest", the two hard parts, what "Lead" means, what the 90% / 321% / 525% mean), 14 DRAFT edits from
existing words only, 6 section ideas, housekeeping fixes, what we keep. **Waiting for Jack's answers.** Next: drafts
shown beside their pages, then applied on the real branch with his OK.


### The polish round (2026-10-20 to 22; Jack: "absolutely the best", "full freedom", no requirements)

**The brief.** Jack (2026-10-20): the site must attract every employer who sees it and serve his future as an entrepreneur,
"appealing even to Apple's CEO"; "you have full freedom". The content step (above) was still waiting on his 14 answers, so
the rule of this round was: **nothing invents a fact, a number, an opinion or a habit; every change reuses words and facts
already in `content/`, or adds structure, craft and plumbing.** The words at the root are now the build's `content/` files
(CONTENT.md); COPY.md stays the demo's deck and the claims ledger.

**How it was run.** An audit as a multi-agent workflow (eight lenses, each a fresh agent on the real GPU with the real
screenshots: an Apple-calibre design critic, a mobile critic, a hiring manager / recruiter / CTO, a founder / investor, a
copy editor, a web-platform engineer, an interaction reviewer, a first-time visitor), each finding scored by judges (rules
and taste; visitor value; engineering risk), then a completeness critic. 124 findings; the ones below were done, the rest
are recorded as open (needing Jack) or skipped (against an approved decision). The lenses agreed the site was already
unusually honest and consistent; the misses were in what a visitor could not see or find.

**Built, uncommitted on `redesign/v2`** (each line names what and why; the files: `git diff`):
- **Link previews.** One 1200 × 630 card per page, cut from the page's own hero by `tools/build-og.ts`
  (`npm run build:og`, against a QA build on :3100): the inner pages' strip cut 150 px taller and shifted up, the title
  at the name's size, "Qijin Xu · Lead AI/ML Architect" above it; Home's card is a cover too (the name, one line, the
  painting). `public/og/` + `manifest.json`; `src/lib/seo.ts` gives every page `og:image`, `twitter:card`
  summary_large_image and the profile fields on Home; a case or a note without a card falls back to its section's.
  Why: a shared link on LinkedIn, Slack or iMessage was bare text; it is the first impression a recruiter gets.
- **The marks.** `src/app/apple-icon.png` (the seal on paper, 180), `public/favicon.ico` (16/32/48: the blind request
  Safari, Slack and feed readers make), `src/app/manifest.ts` and `appleWebApp.title`, so a home-screen shortcut says
  "Qijin Xu", not the cut-short title.
- **Copy and search, from existing words only.** Case pages carry a `metaDescription` naming him and the result; Home's,
  the Résumé's and Contact's snippets say CGI; llms.txt covers all six projects, the two awards without ambiguity
  ("2026 (project not named on this site)"), a Now line built from Home's own lines, and links every case; the Writing
  intro's second sentence (not Jack's words) is dropped and its taglines are one; "About 90%", "less manual work",
  "dual-state dynamic", "RAG assistant" (not "chatbot"), the serial comma and lowercase "present" everywhere; the agent's
  diagram steps and descriptions say "What comes out:"; the hockey summary names AttentiveVision; the note's two leftover
  headings are gone and its byline says "Updated"; Home's "All writing →" shows only when Home cannot list every note;
  the 2019 internship in two bullets; awards before certifications; Dean's List in `/resume.json`; the 404's one robots
  tag; `Content-Disposition` names the PDF "Qijin-Xu-Resume.pdf".
- **Structure.** The Work table shows each project's role under its title (his path at a glance) and its public evidence
  as a quiet line under the outcome (the Evidence column was a dash in four rows of six). A **colophon**
  (`src/components/page/Colophon.tsx`, `site.bio`) ends every case and the note: the seal and the author line, so a page
  reached from a search says whose work it is. "In the open": Logic Foundry (public since 2026-10-13) is listed as a
  prototype under Recent, from `overrides.json` and the refreshed `snapshot.json`; the 2019 – 2020 course work always
  folds behind its heading (a real h3 in the summary). Case pages' sections are sections with h2 labels (a `dt` cannot
  hold a heading; the Outcome is now one keystroke away for a screen reader), the same look. Breadcrumbs, images,
  publisher and the site on the cases' and the note's structured data; the feed advertised on every page, a quiet
  "RSS feed" link on Writing, `lastBuildDate`.
- **Craft (the design and mobile lenses).** "Now · October 2026" breathes; the quiet action links share the one UI weight
  (560); Home's second lead on the scale (18 px); the footer's dots centred and "Still the landscape" on its line; the
  story map's labels in the nav's voice from 640 and its art 52 px on phones; the colophon's seal 36 px (was 44, the largest on the site);
  Contact's labels on their values' baseline, the "Copied" stamp beside the words it used to cover; the table heads in
  the deep jade; the Résumé's letterhead without its explanatory note and with its actions on the column, the site's own
  address on the PDF only; the Work table's role line in small print on phones; the header one row down to 360 px, the
  nav on its own row at 356 and under (`--header-gap`; `tests/e2e/header.spec.ts`); the flagship diagram folds wherever the tall drawing shows (tablets too),
  the tall drawing capped at a phone's width there.
- **Interaction.** Back and Forward return the reader to where they were (`Navigation.tsx`, per path for the session;
  `tests/e2e/navigation.spec.ts`); the current nav item eases to the top; a Work row is one target on phones; the
  folds ease open (`::details-content`, where supported); the summaries and note toggles answer in jade; a tap is
  answered in jade, never the system's blue box; a folded diagram draws in when revealed; the returning header needs
  24 px of a finger's travel, 8 of a wheel's; the note's reading stroke starts at scroll 0; a page title focused after a
  page change keeps the announcer, not a jade frame; "Still the landscape" says what it does (a tooltip and a hidden
  description); Contact shows his local time beside the time zone (`LocalTime`, nothing without JS).
- **Platform.** Fonts in the latin subset only (66 KB of unused latin-ext preloads gone); the stills, the photo and the
  cards cacheable for a day; `frame-ancestors 'none'` and `X-Frame-Options`; CORS on `/resume.json` and `/llms.txt`;
  `color-scheme: only light` (Android's auto-dark could invert the paper under an un-inverted painting); print: a case's
  evidence prints its addresses and the sheet gets the wide drawing.
- **The engine (two framing changes; stills regenerated).** (1) **A veil follows rendered text only** (`textBands`,
  engine/index.ts): text folded away in a closed `<details>` still answered `getClientRects` with boxes laid out below
  the fold, so Work's last section veiled its own closing on phones and tablets (an empty band at the hub page's end:
  the mobile lens's one must). (2) The river's wide closing looks a little east of the bridge (`Frame.closingU` 0.69,
  compose.ts): a wide closing is 1.25 stretches wide, and centred on the bridge its left edge cut Home's east crag, the
  darkest ink on every case page.

**Open for Jack (needs his facts, his photo or his call; nothing built):**
1. The "hard part" of the two flagship cases, what "Lead" covers (team, decisions, stakeholders), and the basis of the
   headline numbers (90 %, 525 %, 321 %): the content doc's questions 2–5. Every hiring lens named these the biggest gap.
2. A professional photo (§8: side daylight, eye level, a real smile, a plain top, air above the hair): the one element
   below the rest of the page. One-file swap.
3. LinkedIn's headline and the GitHub profile (name, company, location, bio, the placeholder repos' READMEs and the
   "anounced" typo): the first off-site clicks contradict the site.
4. Design questions to show side by side, not to decide here: the short pages' endings on wide screens (Writing's and
   Contact's end pose parked in the right third; a taller end box recomposed centre-left would change an approved
   round-5 ending), the brush button's hover (an approved 4 % lift that is below notice on the dry-brush texture), the
   diagram's flow bead (approved, but too small to see), the resting underline on row titles, the Note's lake closing
   showing 0.4 of the Résumé's terraces, hover states sticking after a tap on touch screens (a `(hover: hover)` guard
   over ~32 rules), the sideways-phone strips (80 px), a real-device check (28svh of a real phone's viewport is ~199 px,
   not the 236 reviewed), "prototype" in Now's Logic Foundry line, outside links in the same tab versus a new one.
5. The pronunciation of "Qijin" and two sentences on why a Chinese handscroll and what the seal is: both in his voice.

**Skipped (against an approved decision or not worth it):** a third hero line of proof (the hero is approved copy and
the photo must start on the first screen); moving About's "I also build for myself" to Now; the statement line on Home
(4a retired it to Work on purpose); flipping subpage titles to "<page> · Qijin (Jack) Xu" (§3 fixes the form); a
wall-clock test on Now's month (a CI time bomb; the unit test compares it with the content dates instead); PDF Author
metadata (a new dependency for a small gain); the photo through the image optimizer (its baked fade edge).

## 13. Running the demo and its tools

```bash
python3 design-demo/_tools/serve.py 4173
```
That serves http://localhost:4173 with the designed 404. In the Claude desktop app, use the `.claude/launch.json` config "design-demo".

| Tool | Purpose |
|---|---|
| `tools/qa/cdp.py` | Headless Chrome driver (real scrolling, hover, clicks, true phone viewports, bursts, print/PDF, console). Screenshots go outside the repo only (`$QA_OUT`). |
| `tools/qa/compliance.py` | Hard-rule sweep: phone, address, PMP, old PDF, CJK, motto, JSON-LD, images, PDF pages |
| `tools/qa/linkcheck.py` | Internal links, fragments and SVG-filter ids; external links https and allow-listed (needs the server) |
| `tools/build-pdf.py` | `/resume/` → `resume.pdf`, with the phone gate |
| `tools/sync-shared.py [--check]` | Shared head / top / bottom blocks into every page |
| `tools/sync-projects.py [--discover] [--check]` | GitHub "In the open", at build time |
| `tools/build-photo.swift` | The colour photo pipeline |
| `tools/build-stills.py [--check]` | The footer story map's scene stills, cut from the engine (regenerate after any engine or scene change) |
| `tools/qa/budget.py`, `gaps.py`, `contrast.py`, `drift.py`, `frames.py`, `places.py`, `router.py`, `storymap.py` | The QA probes (§6 budgets, gaps, contrast on the painted background, mist drift, frames, the places test, router, story map); usage: README "QA". On this Mac prefix `CDP_ARGS='--use-angle=metal --enable-gpu --ignore-gpu-blocklist'` to judge the painting on the real GPU |

**QA matrix (README):** 1440×900, 1280×720, 1024×768, 768×1024, 390×844 DPR 3, 375×667, 360×800, 320×640, 844×390, plus reduced motion, no-WebGL (`CDP_ARGS="--disable-3d-apis"`), print, and router bursts.

**Folders:**
- `assets/` (CSS: tokens, base, layout, components, effects, `pages/*`; JS: main, router, header, story-map, compare, disclosure, effects, `pages/*`, `landscape/*` with `landscape/sets/` (each place's figure set); SVG; the photo; `img/scenes/` (the story map's stills)).
- `_lab/landscape/` (engine lab pages: index, strips, wake, bench, figures (a figure set's layer alone), …).
- `_notes/r4b/RECORD.md` (the 4b record, condensed from the round's 28 working notes: decisions, how each feature works, measurements, open items, lessons).
- `_studies/` (the round-1 hero studies A/B/C; A's engine won, C's typography won).
- `_notes/r4/` (the round-4 research: `layouts.md` with 31 measured personal sites, `ia.md`, `scenes.md`, `identity.md`, `audit.md`; `proposal.md`; `prototypes/` with wireframes and scene sketches).
- `SPEC-R3.md` (previous round, partly superseded).

## 14. History in one paragraph

- **Round 1:** three hero studies; the WebGL ink landscape won.
- **Round 2:** 8 pages, "Shan Shui Scroll", a full-screen hero, ink effects.
- **Round 3:** answered "too sparse, PowerPoint-like, transitions not smooth" with content-sized sections, three type tiers, the pan transition, water scenes and the photo. It still felt "huge, CV-like".
- **Round 4:** researched 31 real personal sites, leading to the readable layout, Home as "about me", the narrative painting, colour and the colour photo.
- **Demo 4a** implemented that. Jack: "looks great", plus the two points in §11.A–B, and he agreed to finish with a short 4b round in a fresh session.
- **Demo 4b** (2026-10-15, one long session run as multi-agent workflows): two prototypes of the scroll-following background ("settle", "depth") judged by three lenses; depth won and was refined in three adversarially reviewed rounds; six figure-set artists painted the places in parallel; the closings and the story map now show each page's own place; small life; the QA probes rebuilt; a final real-GPU review with two fix rounds. Record: `_notes/r4b/RECORD.md`.
- **Round 5** (2026-10-16 to 19, on the Next.js build): one order, one hero, one ending; the painting as one
  handscroll; the style "Spring ink" with its elements; scroll motion on laptops; depth bands on phones; then the
  content (§12 "Round 5").
