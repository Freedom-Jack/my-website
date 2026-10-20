# Scenes as story: one painting, one place per page

Round 4 research for Jack's point 1 and his remark about colour. Research only: nothing in the repo or in `design-demo/` was changed.
Sketch: `r4/sketch/index.html` (open it with `?only=market`, `?only=colour` or `?only=phone`). Screenshots: `shots/scenes/`.

## TL;DR

- **What Jack means:** the site is **one narrative painting**, a handscroll like *Along the River During the Qingming Festival*. Each page is a place in it, and the place pictures what the page is about: Work is a busy riverside market because that is where his work happens. Today the scenes differ only in where the mountains stand, so they look alike. He is right.
- **Recommended story (Mapping A, "The traveller's journey"):** Home is the mountain with a tiny traveller (him). Work is the river market at a rainbow bridge. About is the road through the hills. Writing is a pavilion by the still lake. Résumé is terraced fields. Contact is a ferry waiting at the crossing. Each scene gets **one** small figurative focus, and the landscape stays the main subject.
- **Colour: yes, as misted blue-green.** The Song mineral palette (azurite on peaks, malachite on slopes, red ochre for earth, timber and paths) at about half strength, under mist, on unchanged cool paper. The clearest win of the sketch (strip B, `sketch-colour.png`). Full strength is too loud; ochre over whole mountains turns dusty beige.
- **One palette, weighted per scene:** strongest blue-green on Home, warm ochre roofs and boats on Work, ink only on Writing, indigo and one lantern on Contact. That alone makes the pages distinct.
- **Feasibility (I built a sketch):** a procedural ink market with roofs, stalls, a rainbow bridge, boats and about 150 tiny figures. At page scale it reads as a calm Song river town; on a 390 px phone it is charming and clear. Up close it still looks like clean vector illustration, not brushwork. Reaching the mountains' quality is real art work: about 2 to 3 weeks for the market alone.
- **Technique:** LingDong Huang's *{Shan, Shui}\** (MIT, © 2018, untouched since 2018) draws trees, houses, pagodas, boats and people as SVG polylines. Study its structure; don't drop it in, because its thin line-art does not match our wash engine. Ours would draw the "things" with Canvas2D into a texture and lay them into the WebGL painting with the same mist, grain and ink bleed.
- **Biggest risks:** kitsch (red lanterns, pagodas, theme-park China), a clip-art look (even outlines, flat fills, repeated sprites), and figures behind text. Avoid them with small scale, one focus per scene, mist eating whole parts, and nothing figurative where text sits.

---

## 1. Decoding the idea

Jack is describing the oldest use of the handscroll: **a story you travel through**, an arm's length at a time. The Qingming scroll moves from quiet countryside to a crowded river, the Rainbow Bridge and the city gate (814 people, 28 boats and 30 buildings over about 5.25 m). Painting theory calls this *woyou*, "travelling while lying down".

Our site already has the structure: one landscape, a stretch per page, a sideways pan between them. What is missing is **meaning**. Every stretch is "mountains, slightly rearranged"; the README even says stretch 1 "river" is "today's mountains under that name" (`lab-s0…s5-1440.png`). Jack wants each stretch to *say* something:

1. **Wayfinding by metaphor:** you know you are on Work because you are in the market.
2. **A story about him:** together, one journey with one protagonist.
3. **The current quality stays:** add to the landscape, never replace it.

His colour remark is the same idea: the Song court painted its grand panoramas in blue-green, not only black ink.

## 2. Three page-to-scene mappings

### Mapping A: "The traveller's journey" (recommended)

> A traveller sets out from his mountain, comes down to the river town where the work gets done, looks back along the road that brought him there, rests at a lakeside pavilion to write, passes the ordered fields of his record, and reaches the ferry where you can cross over to meet him.

| Page (stretch) | Scene | The one figurative focus | Why it fits | Colour weight | Size |
|---|---|---|---|---|---|
| **Home** (0) | The host peak, as today | A tiny traveller in white (hat, staff) on a path; a thatched hut above the mist | The protagonist. The real photo below the hero then reads as "the figure in the painting, then the person" | Strongest: azurite peaks | S |
| **Work** (1) | A riverside market town at a rainbow bridge | The bridge and its crowd; a boat lowering its mast to pass under; stalls, willows | Busy, productive, client-facing. (A bridge joins two banks, as an architect does: for Jack, never spelled out on the site) | Blue-green hills; light-ochre roofs, boats, earth | **L** |
| **About** (2) | A winding road up through the hills from a village | The traveller again, small, mid-climb | His journey; the road can echo the vertical timeline | Malachite hills, ochre road | M |
| **Writing** (3) | The still lake (built) | An open pavilion on the headland, one seated figure | Quiet thought | Ink only | M |
| **Résumé** (4) | Terraced fields stepping down to the shore | Orderly terraces, one farmhouse | Order, years of steady work, rows like a record (cheap: shader-drawn) | Pale malachite, low presence | S–M |
| **Contact** (5) | The crossing (built), home peak echoed on the far shore | A ferry waiting at a jetty, a ferryman, one lantern | An invitation to cross; the far shore leads back to him | Indigo water, the one warm light | M |
| **404** (6) | The lone peak | The path running out into mist | "You've wandered off the road" | Ink only | S |

If the layout research merges About into Home, the road becomes Home's wordless vista: the traveller's road under the bio.

### Mapping B: "One day on the river"

Time of day carries the story: dawn on the peak (Home), the morning market (Work), the road at noon (About), late afternoon at the pavilion (Writing), evening fields (Résumé), dusk at the crossing with a lantern (Contact).

- **For:** colour tells the pages apart before any figure appears. Elegant.
- **Against:** dusk darkens the painting behind text (a contrast risk); the paper can't be tinted, so "time" lives only in the pigment; it says less about *him*.

### Mapping C: "Landmarks only" (the cautious option)

Each page gets one built landmark and no recurring person: a hermit's hut (Home), the rainbow bridge with moored boats (Work), a mountain-pass gate (About), the pavilion (Writing), a carved stone stele by the road (Résumé: a record cut in stone, with illegible marks and **no characters**), the ferry jetty (Contact).

- **For:** least kitsch risk and maintenance; closest to today's engine. **Against:** a market without people is not a market; a weaker story.

**My recommendation:** Mapping A, in phases (section 7), with B's best idea folded in: each scene's colour weight follows the story.

## 3. Colour: blue-green and light crimson-ochre

**What the tradition is.**

- **Blue-green landscape** (*qinglü shanshui*): mineral **azurite** and **malachite** over ink. Its peak is Wang Ximeng's *A Thousand Li of Rivers and Mountains* (1113, painted at 18; 51.5 × 1191.5 cm; Palace Museum), still hugely popular: the dance drama it inspired was a sensation at the 2022 Spring Festival Gala and still touring in 2025.
- **Red ochre** (from hematite) is the earth colour: rocks, tree trunks and soil (People's Daily, 29 July 2024).
- **Light crimson-ochre** (*qianjiang*): ink with a pale red-ochre wash on rocks and trees, from the Southern Song on (JAANUS).
- **Cinnabar** stays the seal's alone.

Blue-green practice is commonly described as azurite on peaks, malachite on slopes, ochre at feet and banks. I used that gradient as a design choice; I found no technical study of the layer order on Wang's scroll itself.

**What I saw in the sketch** (`sketch-colour.png`, the same range painted four ways):

- **A, ink only (today):** handsome but monochrome; part of why every page feels the same.
- **B, misted blue-green at about half strength: the winner.** Still clearly ink, mist and paper unchanged, but alive and cool, and Song rather than generic. It will also suit Jack's colour photo far better than an all-grey page.
- **C, full mineral strength:** stunning alone, far too loud behind text; the blue-to-green bands look like a digital gradient.
- **D, ochre glaze over whole mountains:** dusty, close to the beige Jack dislikes. **Ochre only on small things** (roofs, boats, paths, earth).

**Proposed palette (pigments inside the painting only, never as UI or text colours):**

| Pigment | Deep | Misted (what the site mostly shows) | Used for |
|---|---|---|---|
| Azurite | `#2C5C8A` | `#7F9FB8` | Peaks; strongest on Home |
| Malachite | `#3A806A` | `#8DB5A4` | Slopes, willows, terraces |
| Red ochre | `#9E6640` | `#CDB096` | Earth, paths, timber, boats, thatch: small areas only |
| Indigo wash (existing) | `#3E5664` | — | Far ranges, water, dusk |
| Cinnabar (existing) | `#B1362B` | — | The seal only, unchanged |

**Rules:** the paper stays `#EFF1EE`, never tinted. Mist always lies over the colour. Colour covers at most about 20% of a scene, at about 0.5 strength (0.55 on Home's head), and sinks with the landscape while you read. The UI keeps ink, indigo annotation and the seal.

**Per scene:** Home 0.55 (azurite-led) · Work 0.40 (hills) plus ochre accents · About 0.45 (malachite-led) · Writing 0 (ink) · Résumé 0.25 · Contact 0.2 indigo plus one warm lantern · 404 0.
The shader change is small. It adds a height-graded pigment layer per plane, like the sketch's `paintRanges()`.

## 4. Technique

### LingDong Huang's *{Shan, Shui}\** (shan-shui-inf)

- **Licence:** MIT, "Copyright (c) 2018 Lingdong Huang" (github.com/LingDong-/shan-shui-inf). We may study it and port parts, provided the notice stays in any ported file. The last push was December 2018.
- **What it draws** (from reading its source): mountains (`Mount.mountain`, `flatMount`, `distMount`, `rock`), eight tree types, architecture (`Arch.hut`, `box`, `rail`, `roof`, `pagroof`), whole buildings (`arch01` is a house with a railing and 0 to 2 people; `arch02`/`arch04` are tiered pavilions; `arch03` is a seven-storey pagoda), `boat01` (a boat with a punting boatman), a `transmissionTower01` easter egg, water, and people (`Man.man`).
- **How it draws:** everything is an SVG polyline string. Its `stroke()` turns a path into a variable-width polygon (width = sin(πt) × noise), which is the same trick my sketch uses. A figure is a 9-joint skeleton with robes "clothed" by Bézier curves and width functions (sleeve, body, head), plus hats and a stick. Placement is rule-based: pavilions on mountain tops, houses with people on flat ground, boats on water. It renders in chunks for infinite scrolling.
- **Verdict:** an excellent structural reference, a wrong drop-in: thin grey line-art on white, and SVG that would sit *on* our WebGL painting rather than *in* it.

### 2024–2026 scan (honest)

I found almost no new procedural or WebGL Chinese painting work with figures. Recent effort went to **AI generation** (Perlin noise plus Stable Diffusion, ControlNet and AnimateDiff; Discover Artificial Intelligence, 2025/26; an NCU thesis, 2024). Wrong for us: not deterministic, heavy, not live, and exactly the "AI-generated look" Jack dislikes.

The useful references:

- **Codrops, "Still" (9 Sep 2026):** a WebGPU ink-wash garden (Three.js TSL): noise-thresholded wash edges, an `fwidth`-steady contour, a silk-weave overlay. Useful compositing ideas; Japanese in style.
- **The Palace Museum's animated Qingming** (128 m at the 2010 Expo; 4D in 2018; a Microsoft Research Asia pan-and-zoom version): the precedent for "tiny life" in a classical scroll.

### How the scenes would plug into our engine

1. **Data:** `SCENES[k].things` in `compose.js`, a short seeded list per scene (for example `{ kind: 'bridge', x: 0.62, plane: 2 }`), plus a **phone focus x** so the portrait camera centres it (on Work, the bridge).
2. **Drawing:** a new `landscape/things.js` paints them with Canvas2D brush strokes (the sketch's `ink.js`/`things.js` are a first draft), on an `OffscreenCanvas` in a worker, once per arrival or resize. Never per frame.
3. **Resolution:** the scene framebuffer runs at **0.75 × DPR** (capped at 1920 px), which would turn 0.5 px linework to mush. Draw things at 1.5–2 × CSS px and composite them in the PRESENT pass, inside their bounding box (one extra texture lookup there).
4. **Same ink treatment:** a bleed halo (a blurred copy under the crisp one, as in the sketch), paleness by depth, the plane's foot dissolving into its mist band, granulation and grain on top, and an alpha mask so drifting mist passes over the town.
5. **Tiny life** (present pass, within today's ≤15 fps ambient budget): water shimmer, one or two boats drifting a few px a second, a smoke wisp from a stall, willow strands swaying (a UV wobble in each willow's box), and on Contact a slow lantern glow (<0.5 Hz, no flicker). **People stay still**: walking figures look like a game. All of it stops under reduced motion, "Still the landscape" and 45 s idle, as today.
6. **Fallbacks:** the Canvas2D fallback draws the same things (one code path). The footer strip gets one glyph per scene (bridge arc, pavilion roof, ferry), so it reads as a story map. Hidden in print.
7. **Mobile cost:** the sketch's things layer (about 300 objects) took 10–13 ms of draw calls on headless desktop Chrome at 1440 × 560 and 1170 × 780 device px (a lower bound; rasterising is deferred). Allow 3–5 × on a mid-range phone, once per arrival. About 3.6 MB of GPU memory per texture at 1170 × 780. Fine once; never per frame.
8. **Accessibility:** the canvas stays `aria-hidden`; nothing figurative under text (a keep-out zone matching the head's text block, plus the reading veil); no flashing (WCAG 2.3.1); the pause control exists (2.2.2). Optionally one small "colophon" caption per page names the painting ("The painting: a river market at the rainbow bridge") so nobody, screen-reader users included, misses the metaphor. Those words need Jack's approval.

### Where the scenes are seen

Each page head shows its scene as a **wide band**, not a full-screen slide (about 45–55 % of the viewport on desktop, 30–40 % on a phone), with the title on paper beside or below it. The painting then sinks to the low horizon for reading (as today) and returns once in the vista. That answers "Should sub pages have hero section as well?": each page opens with its own place, at normal reading scale (coordinate with the layout research). `sketch-phone-390.png` shows how well a scene band works on mobile.

## 5. The feasibility sketch: what it shows

Built in `r4/sketch/`, standalone (no engine code). The mountains come from a CPU port of the engine's recipe; the things are procedural Canvas2D brushwork in Song oblique projection (fronts, tops and right-hand sides).

| Screenshot | Verdict |
|---|---|
| `sketch-market-v1.png` | First try: a "runway" street in Western perspective, like an architectural model. **Lesson:** use the scroll's logic: the river runs *across*, the town faces it, things barely shrink with distance. |
| `sketch-market-v6.png` (1440, Work head) | At page scale: a calm Song river town under blue-green hills, text zone clean, mist handing over to the paper. Recognisably "the market at the bridge". |
| `sketch-market-v6-zoom.png` (2×) | The bridge, crowd and mast-lowering boat work. Houses still look like clean vector illustration (even lines, flat fills); willows are the weakest. Needed: broken dry lines, irregular geometry, wash pooling, mist swallowing whole houses. |
| `sketch-phone-390.png` (DPR 3) | **The best result.** As a band above the title, the bridge, crowd and boat are charming and legible. A phone is a hand-held album leaf: one detail, well framed. |
| `sketch-colour.png` | B beautiful; C too loud; D dusty. |
| `sketch-home-traveller-1x.png`, `-zoom.png` | The traveller works at about 16 px (white robe, hat, staff, pale mist behind). But **the hut floats** (things need ground and mist at their foot) and the path reads as dashes; paths must be soft washes. |

**Overall:** yes, it can look beautiful, at the right scale and with restraint, but not cheaply. The landscape took several rounds; the things will too.

## 6. Risks, and how to avoid them

| Risk | Looks like | Avoid by |
|---|---|---|
| **Kitsch / inaccuracy** | Red lanterns, pagodas, dragons, gold; Japanese- or Qing-looking houses | Song restraint: Qingming-era forms (hip-gable roofs with gentle eaves, open shopfronts, parasol stalls, timber arch bridge, mat-roofed boats), muted mineral colour, cinnabar for the seal only, one lantern on the whole site, no Chinese text |
| **Clip-art / pasted on** | Even outlines, flat fills, repeated sprites, floating houses | Seeded variety, broken dry lines, bleed halo, wash not outline at distance, ground and mist under every thing, composited in the shader (not an SVG overlay) |
| **Game look** | Walking crowds, a SimCity town | Figures never walk; motion only in water, smoke, willows, drifting boats; one crowd on the whole site |
| **Hurting reading** | Detail behind paragraphs | Text keep-out zones; things only in the head band and vista; horizon state behind reading |
| **Effort / maintenance** | Weeks of tuning, seven scenes to QA | Phasing, one focus per scene, deterministic seeds, a "things" view in the lab, shared code with the fallback and strip |
| **Performance** | Phone jank | Draw once per arrival in a worker, capped texture size, tiny life inside the existing budget, sleep when idle |

## 7. Recommendation and phasing

1. **Phase 1 (about 3–4 weeks):**
   - the site palette and per-scene colour weights in the shader (small);
   - **Work's market** (the big one: what Jack asked for, and the proof of concept);
   - Home's traveller and hut (this changes the round-3 "hero pixel-identical" rule, so Jack must lift it);
   - Contact's ferry and lantern;
   - each scene shown as the page-head band.
2. **Phase 2:** the Writing pavilion, the About road, the Résumé terraces, and tiny life (water, smoke, willows, drifting boats).
3. **Phase 3:** the 404, the story glyphs in the footer strip, and the optional colophon lines.

At every phase, judge the result at 390 px first: that is where the scenes look best and where most visitors will be.

**Decisions only Jack can make:**
1. Are people, buildings and boats now welcome **inside the painting only**? This reverses the round-1 "no illustrations" rule; they would never appear as icons or as UI.
2. Which story: A (journey, recommended), B (one day) or C (landmarks)?
3. Misted blue-green across the site, including on the Home hero? This retires the frozen hero.
4. May a tiny figure stand for him? And is ochre warmth acceptable on small things, given his "no yellow" rule?

## Sources

- Along the River During the Qingming Festival (dimensions, counts, sections): https://en.wikipedia.org/wiki/Along_the_River_During_the_Qingming_Festival
- Wang Ximeng, *A Thousand Li of Rivers and Mountains* (1113, age 18, 51.5 × 1191.5 cm, azurite and malachite, Palace Museum): https://en.wikipedia.org/wiki/Wang_Ximeng
- Blue-green shan shui (origins, Li Sixun, "great" and "little" blue-green): https://en.wikipedia.org/wiki/Blue-green_shan_shui
- People's Daily, 29 Jul 2024, pigments of the Thousand Li scroll (azurite, malachite; ochre for rocks, trunks and soil): https://paper.people.com.cn/rmrb/html/2024-07/29/nw.D110000renmrb_20240729_2-15.htm
- JAANUS, *sengō sansui* / qianjiang (light red colouring, red ochre, from the Southern Song): https://projects.mcah.columbia.edu/jaanus/record/sengosansui
- *Poetic Dance: The Journey of a Legendary Landscape Painting* (2021 premiere, 2022 Gala), Shanghai government, 3 Jun 2025: https://english.shanghai.gov.cn/en-CulturalPerformances/20250603/106dbbef4ea94f1cb5b46f444e55b444.html ; DAO Insights: https://daoinsights.com/news/poetic-dance-taps-into-chinese-culture-and-wins-wide-appeal/
- LingDong Huang, shan-shui-inf (MIT, © 2018): https://github.com/LingDong-/shan-shui-inf (licence: https://github.com/LingDong-/shan-shui-inf/blob/master/LICENSE); live: http://shan-shui-inf.lingdong.works/ ; CMU exhibition: https://art.cmu.edu/event/lingdong-huang-shan-shui/
- Codrops, "Still: From Akira to Ink Wash, Building a Generative Garden in WebGPU" (9 Sep 2026): https://tympanus.net/codrops/2026/09/09/still-from-akira-to-ink-wash-building-a-generative-garden-in-webgpu/
- Generative AI shanshui animation (Perlin + Stable Diffusion + ControlNet + AnimateDiff), Discover Artificial Intelligence: https://link.springer.com/10.1007/s44163-025-00797-6
- Palace Museum animated and 4D Qingming: https://scmp.com/culture/arts-entertainment/article/2154396/classic-chinese-painting-brought-life-4d-interactive ; Xiamen 2023 (128 m restoration): https://fujian.chinadaily.com.cn/2023-07/12/c_902315.htm
- Shan Shui in the World (Weili Shi, GLSL, 2016): https://mfadt.parsons.edu/2016/blog/2016/04/29/shan-shui-in-the-world/
- Engine read: `design-demo/assets/js/landscape/compose.js`, `shaders.js`, `index.js` (internal scale 0.75 × DPR, capped at 1920 px), `canvas2d.js`; README scene table.
