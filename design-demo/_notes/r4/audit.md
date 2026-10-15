# Audit of demo round 3: why it reads as "huge, PowerPoint, sparse, a résumé"

Measured on 9 October 2026, on http://localhost:4173 with the router off. I covered 7 pages at 4 screen sizes: 1440×900 (desktop), 1280×720 (a common laptop), 390×844 and 360×780 (phones, at true 3× pixel density, with real scrolling).
For comparison I ran the same script on 10 pages from 9 well-regarded personal sites, captured the same day (list and URLs at the end).
This audit only measures and judges. No repo or demo file was changed.

## TL;DR

- **The body text is fine. The display text is what makes it feel huge.** Body text is 19 px on desktop and 17 px on phones, with 54–64 characters per line, which is textbook. But the name is set at **294 px**, page titles at **140 px**, the email at **156 px**, statements at **89 px** and figures at **84 px**. On the reference sites, the largest text on the page has a median of **31 px**. On the home page, giant words cover **more of the screen than all the readable text combined** (display-to-reading area ratio **1.09**; reference pages **0.00–0.07**, except Maggie Appleton's single big statement at 0.40).
- **"PowerPoint" has a measurable cause: one idea per screen, plus slide builds.** The home page's first screen holds **35 words**; the references' median is **217**. Desktop pages average **85–129 words per screen**; the references' median is **206**. Each screen uses **4–5 type sizes**, where references use about **3**. **11 headings and figures fade in one by one** as you scroll the home page, which is exactly how slide builds work.
- **The page heads are one template, and the painting doesn't tell the pages apart.** Work, About and Writing open with one word at 140 px in the same position, a 27 px line under it, and a grey mountain on the right. The page head takes **56–68%** of the first screen on desktop and **66–83% on a 1280×720 laptop**. Pixel analysis of the backgrounds alone (text hidden) shows any two pages differ by only **0.4–2.4%** in brightness, no more than the top and middle of the *same* page (**0.4–2.1%**). Colour saturation is **≈0.01** (pure grey), and dark ink covers **≤2%** of the screen.
- **The home page and About page are a CV in disguise.** Home lists **all 6** of Work's projects, each with organisation, years and role. Every headline number appears on **4 pages**, and "90%" appears **9 times** across the site. About has the résumé's three main sections (career, skills, education and certificates), with **more list items than the résumé itself (29 vs 26)**, more words (846 vs 568), and five 84-px years.
- **Jack is right about the home link.** In the header, the **only** link home is the 徐 seal: 50×50 px on desktop, 38×38 px on phones, with no visible text. The visible "About" link works at every width, so what he means by his "about page" is the personal home page. The Nielsen Norman Group advises offering both a clickable logo and a visible Home link, because not everyone knows the logo convention. 8 of the 9 reference sites show the person's name as text at the top of the page; only one relies on a logo glyph alone.
- **The photo arrives last and looks lifeless.** It is filtered to `grayscale(1)` and multiplied onto the paper, and it sits on **screen 6 of 7** (desktop) or **screen 7 of 8** (laptop and phone). 4 of the 10 reference pages show a photo of the person in the first screen.
- **The pages are long because nothing is summarised.** Work is **10.3 screens on desktop and 14.3–15.7 on phones**, and two pages carry a **590 px wordless gap** (405 px on phones).
- **Keep:** the body type and line length, the text nav, Work's summary table (the most informative element on the site), the Note page's structure, the honest evidence lines, "Read as steps", and the painting's quality.

---

## 1. Whole-site numbers

"Words per screen" counts the words of main content (header and footer excluded) inside each viewport-height slice of the page. "Sizes per screen" counts the distinct font sizes visible on a screen. "Empty bands" is the share of the page's content height taken up by vertical blank strips of 24 px or more.

**Desktop, 1440×900**

| Page | Screens | Words / screen | Words on screen 1 | Largest type | Sizes / screen | Blank gaps ≥100 px | Empty bands |
|---|---|---|---|---|---|---|---|
| Home | 7.0 | 85 | **35** | **294 px** | 4.6 | 6 | 31% |
| Work | 10.3 | 129 | 123 | 140 px | 4.7 | 8 (one is 589 px) | 32% |
| About | 7.2 | 117 | 107 | 140 px | 4.0 | 5 (one is 591 px) | 28% |
| Writing | 1.3 | 34 | 43 | 140 px | 5.0 | 1 | 28% |
| Note | 3.2 | 123 | 121 | 88 px | 4.7 | 1 | 38% |
| Résumé | 5.5 | 102 | 110 | 200 px | 4.8 | 7 | 30% |
| Contact | 1.5 | 26 | 38 | 156 px | 5.0 | 1 | 43% |
| **References (median)** | — | **206** | **217** | **31 px** | **3.0** | **1** | **18%** |

**Laptop, 1280×720 (the worst case).** The home page's first screen still has 35 words, and the subpages' first screens have only **32–84**. **12 of 42 screens** are "thin", meaning they have fewer than 50 readable words. At 1440 it is 7 of 34. On the reference sites it is 0–1 per site.

**Phone, 390×844.** Away from the hero, the phone is closer to normal. It shows 75–95 words per screen, against a reference median of 124, with 17 px body text and 37–41 characters per line. The problems on phones are the hero (195 px name, 35 words on the first screen; the reference median is 127) and the length: Work is 14.3 screens.

Two things I measured that **do not** explain the complaint, stated for honesty:
- The share of blank paper per screen is 71–88% on the demo and 59–85% on the references. Good minimal sites are mostly blank too.
- The demo shows 3–6 element types per screen; the references show 3–5.

What differs is **what the non-blank part is made of**:

| Area covered by display type (>24 px) ÷ area covered by readable text | Value |
|---|---|
| Demo: Home / Work / Résumé / Note / About | **1.09** / 0.34 / 0.29 / 0.22 / 0.18 |
| References: 8 of 9 pages | **0.00–0.07** |
| References: Maggie Appleton (big serif statement, used once) | 0.40 |

On the home page, giant letters take up more ink than everything you can actually read. That one ratio is the "PowerPoint" feeling.

---

## 2. Why it reads as huge and slide-like: six causes

1. **Display type is 4–9 times the norm.**

   | Element | 1440 | 1280 | 390 | 360 |
   |---|---|---|---|---|
   | Name | 294 | 279 | 195 | 192 |
   | Subpage titles | 140 | 128 | 61 | 59 |
   | Résumé name | 200 | | 86 | |
   | Email on Contact | 156 | | 51 | |
   | Statements | 89 | | | |
   | Figures | 84 | | | |
   | Case titles | 65 | | | |

   On desktop, 12–14 text elements per page are 44 px or larger on Home and Work, and 6–7 on About and Résumé. The references have none, except Maggie's one statement.
2. **Too many sizes on one screen.** Home's first screen mixes 294, 59, 24, 22, 19 and 16 px. Screens average 4–5 sizes, against about 3 on the references. That is poster hierarchy, not page hierarchy.
3. **One idea per screen.**
   - Screen 2 of the home page is one sentence at 89 px plus 22 words, with **78%** of the screen left blank (shot: `shots/audit/home-1280-s01.png`).
   - Contact's first screen is essentially one email address.
   - Writing is one 140 px word and one link.
4. **Air between blocks is set for a stage, not a page.**
   - Every section is separated by **140–145 px** of blank space on desktop (101–103 px on phones).
   - Hero to statement is **271 px**.
   - The wordless vista on Work and About is **589–591 px**, or **405 px** on phones.
   - "In brief" sits **238 px** below the diagram.
   - Blank bands ≥24 px add up to **28–43%** of each page's content height, against a reference median of **18%**.
5. **Slide builds.** Scroll-triggered fade-ins (`data-reveal`) number:
   - **11** on Home, **10** on Résumé, **8** on Work and **5** on About.
   - Plus brush strokes that draw in on About's timeline and on the diagrams.

   Headings and figures arrive one at a time as you advance, which is the PowerPoint mechanic exactly. The Writing, Contact and Note pages have none, and they are the pages that feel most like web pages.
6. **The page is long because nothing is summarised.**
   - Work shows a full case study for every project inline: 10.3 screens on desktop, 14.3 at 390 px and 15.7 at 360 px.
   - About is 7.2 desktop screens and 8.8 on a phone.
   - The references' home and about pages run 1.1–4.6 screens. The exceptions are a timeline page (Karpathy, 8.1) and a blog front page (Willison, 19).

**Not a cause:** line length and body size. Running paragraphs are 54–64 characters per line (median) and at most 72, inside Baymard's 50–75. Body text is 19 px on desktop and 17 px on phones, inside Butterick's 15–25 px. Three small-print exceptions run long: the diagram caption reaches 94 characters per line and the "Early work" table cells 80–87. 68–96% of reading words sit in one ~600 px column, which is how a good blog reads. The trouble is that the titles and figures above that column stretch across 1,285 px of width, so the frame looks like a slide while the text inside it is a blog.

---

## 3. First screen of each page: "the hero looks the same"

| Page | Title size (1440 / 1280 / 390) | Share of screen 1 taken by the page head (1440 / 1280 / 390) | Words on screen 1 (1440 / 1280 / 390) |
|---|---|---|---|
| Work | 140 / 128 / 61 | 57% / 68% / 51% | 123 / 84 / 80 |
| About | 140 / 128 / 61 | 56% / 66% / 54% | 107 / 65 / 91 |
| Writing | 140 / 128 / 61 | 56% / 66% / 54% | 43 / 43 / 43 |
| Résumé | 200 / 200 / 86 | 69% / 83% / 72% | 110 / 60 / 71 |
| Note | 88 / 81 / 42 | 41% / 48% / 32% | 121 / 75 / 110 |

- **One template everywhere.** Work, About and Writing put a 140 px word at x = 78 px, y ≈ 200 px, then a 27 px lede, then a ~140 px gap. The only difference between them is the word.
- **Content arrives late on a laptop.** At 1280×720, About's first real paragraph starts at y ≈ 555 of 720, and Work's table header at y ≈ 560. On a phone, About's title starts **237 px** down at 390 px (168 px of empty paper under the header) and 210 px down at 360 px (141 px empty).
- **The home hero is literally unchanged.** It was frozen "pixel-identical" from round 2 by the round-3 spec. Jack's "hero looks the same" is true in both senses.
- **The backgrounds don't separate the pages.** The landscape was screenshotted alone, with the text hidden (`shots/audit/sheet-bg-1440.png`):
  - Any two pages differ by 0.4–2.4% in mean brightness. That is no more than one page differs from itself between top and middle (0.4–2.1%).
  - Saturation is ≈0.01 (grey), with 0% coloured pixels.
  - Pixels darker than 75% luminance cover 0–1.9% of the screen.
  - Below the head, every page becomes the same faint horizon strip.

  The scenes are different in code (peak, river, path, lake, shore, crossing), but on screen they are all "pale grey mountain, right side". This confirms Jack's point 1: he likes the look, but it does not tell him which page he is on.

**Should subpages have a hero?** My view: **no full hero.** Give each subpage a compact page header instead:
- A title of 32–44 px on desktop and 28–34 px on phones.
- One or two sentences of introduction.
- Content starting within about 300–350 px of the top. On a 1280×720 laptop, the first screen should hold at least ~120 words of real content.

The page's own painting scene can sit as a band behind or above that header, about 160–260 px tall on desktop and 120–160 px on phones. That band, not the title size, is what tells you which page you're on. Only the home page gets a hero, and even that should end with the intro and photo visible on a laptop.

---

## 4. Where Home and About drift into CV territory

- **The home hero is laid out like a résumé header.** It reads name / job title / organisation · city / one-line summary / buttons. The Résumé page opens with the **same giant name lockup** (200 px) and the same title, so the two first screens look alike.
- **Home repeats Work.** "Selected work" lists **6 of 6** projects, each with figure, organisation, years, role and source: the Work index, copied.
- **The same numbers appear everywhere.** Occurrences in the main text:

  | Number | Times | Pages |
  |---|---|---|
  | "90%" | 9 | Home, Work, About, Résumé |
  | "321%" | 7 | Home, Work, About, Résumé |
  | "99.9%" | 7 | Home, Work, About, Résumé |
  | "50%" | 7 | Home, Work, About, Résumé |
  | "mAP ≥ 70%" | 6 | Home, Work, About, Résumé |
  | "CGI Impact Award" | 7 | Home, Work, About, Résumé |

  When every page repeats the same handful of numbers, every page feels like a CV.
- **About is the résumé in a different order.**

  | About section | Résumé section |
  |---|---|
  | The path so far | Experience |
  | What I work with | Skills |
  | Education and credentials | Education, and Certifications and awards |

  | Measure | About | Résumé |
  |---|---|---|
  | List items | **29** | 26 |
  | Job-title mentions | 14 | 17 |
  | Year mentions | 19 | 19 |
  | Words | **846** | 568 |
  | Big years (84 px) | 5 | — |

  The wording differs (only 17% of About's five-word phrases also appear on the Résumé), but the **structure** is a CV.
- **"In brief" on Home is also chronological.** It runs lab → joined CGI in 2021 as a data engineer → today Lead AI/ML Architect. That is the summary paragraph of a résumé.
- **What a personal page has that a CV doesn't.** The demo has almost none of these, and most need Jack's own words (the rule is never to invent them):
  - a face near the top;
  - why he does this work and how he thinks about it;
  - what he's interested in or working on now;
  - a little life outside work (there is one line about games);
  - writing or talks;
  - a friendly way to say hello.

---

## 5. The name: "(Jack)" in the middle

- **In the hero, "(Jack)" breaks the name in two.** It is set at 59 px, in a different typeface and a lighter grey, between a 294 px "Qijin" and "Xu". On phones it wraps to "Qijin / (Jack) Xu", which reads as "(Jack) Xu".
- **"Qijin (Jack) Xu" is visible in many places:**
  - the hero heading;
  - the photo caption;
  - the Résumé heading;
  - the Note's byline and author box;
  - the LinkedIn label on Contact;
  - the footer copyright on **all 7 pages**.
- **Fix: show "Qijin Xu" everywhere, and introduce Jack once, in a sentence.** About's lede already does this well: "I'm Qijin Xu, and most people call me Jack." Move that line onto Home. Keep "Qijin (Jack) Xu" only where search engines read it (`<title>`, meta description, `og:` tags, and JSON-LD `name`/`alternateName`), so search for "Jack Xu" still works.

## 6. Navigation and the home link

| Width | Seal size | Text links |
|---|---|---|
| 1440 | 50×50 | Work, About, Résumé, Contact (16 px) |
| 390 | 38×38 | Same four links (14 px, 44 px tall touch targets) |

- **"Home" as a word appears only in the footer strip,** at the very end of each page.
- **The seal is a weak home link.** It is a character most visitors can't read, so it doesn't read as "this person's name". The Nielsen Norman Group says to "offer both clickable logos and actual Home links", and to show Home links on interior pages only.
- **Fix:** put the text "Qijin Xu" beside the seal, with both linking home. Optionally add "Home" to the nav on interior pages. This also gives the name a calm, normal-size appearance on every page, so the hero no longer has to carry it at 294 px.

## 7. Photo

- **Treatment:** CSS `grayscale(1) contrast(1.04)` with `mix-blend-mode: multiply`.
- **Size:** 216×288 px on desktop, 152×203 px on phones.
- **Position:** about 4,600 px down the page.
- **Effect:** combined with a frontal, unsmiling crop, it reads as an ID or memorial photo (`shots/audit/home-1440-photo.png`).
- **Fix:** show it in colour, directly under the intro, so it is in or just below the first screen on a laptop, at about 280–360 px wide on desktop and wide enough on phones to be a real presence. The planned reshoot (natural light, a slight smile, a real setting) matters as much as the CSS.

## 8. Mobile (390 and 360 px)

**Keep:** 17 px body text at 37–41 characters per line; the nav fits at 360 px with no hamburger menu; the returning header; the résumé reads well as a phone CV.

**Fix:** the 195 px name takes **307 of 844 px** (35 words on screen 1); the tall home diagram fills a whole screen (84% graphic, 3 words); Work runs **14.3–15.7 screens**; the vista leaves **405 px** blank on Work and About; About's title starts 210–237 px down; section gaps of ~102 px could be 40–56 px.

---

## 9. What is already good, and should stay

1. **Body typography:** Commissioner at 17–20 px, comfortable line length, resting link underlines, small print that meets contrast.
2. **A plain text nav** with the current page marked, and the header returning on scroll up.
3. **Work's opening table** ("Six projects, newest first"): 123 words in the first desktop screen. It is the most informative element on the site and the model for the rest.
4. **The Note page's shape:** 0 thin screens and 121 words on the first desktop screen. Its title (88 px) should still come down to about 40 px.
5. **Honesty details:** "Client work, no public page", evidence notes, and dated items.
6. **Diagrams with "Read as steps"** (smaller, and never a full phone screen).
7. **The painting itself:** its quality and restraint. Jack likes it. The fix is to give each page a *distinct, more present* scene in its header band, not to replace the painting.

## 10. Target numbers for round 4 (a checkable budget)

| Metric (desktop 1440 / laptop 1280 / phone 390) | Now | Target |
|---|---|---|
| Largest type on a subpage | 140 / 128 / 61 px | 36–44 / 36–40 / 28–34 px |
| Home name | 294 / 279 / 195 px | 48–72 / 48–64 / 36–44 px |
| Body text | 19 / 19 / 17 px | 17–18 / 17–18 / 16–17 px |
| Reading column | ~600 px | 640–720 px (tables and grids up to ~1,040 px) |
| Words on screen 1 (subpages) | 38–123 / 32–84 / 38–110 | ≥150 / ≥120 / ≥90 |
| Words on screen 1 (home) | 35 / 35 / 35 | ≥120 / ≥100 / ≥70, intro and photo in view |
| Type sizes per screen | 4–5 | ≤3 |
| Display ÷ reading area | 0.18–1.09 | ≤0.10 (home ≤0.25) |
| Gap between sections | 140 / 140 / 102 px | 56–80 / 56–72 / 40–56 px |
| Wordless vistas inside reading flow | 590 / 405 px | none (scene bands live in the page header) |
| Work page length | 10.3 / 12.9 / 14.3 screens | ≤5 / ≤6 / ≤8 (case studies on their own pages) |
| Text that animates on scroll | 5–11 elements per page | 0 (motion belongs to the painting) |
| Home link | 徐 seal only | "Qijin Xu" wordmark + seal |
| Photo | grey, screen 6–7 | colour, screen 1–2 |
| Background difference between pages | 0.4–2.4%, grey | clearly different scene and palette per page |

---

## Evidence files

- **Measurement script and data:**
  - `r4/audit/measure.js` and `run.py` (the demo); `ref.py` (the reference sites).
  - `r4/audit/data/*.json` (demo: per page and viewport; also `bgcmp.json` and `text-*.json`).
  - `r4/audit/ref/*.json` (reference sites).
- **Screens:**
  - `shots/audit/<page>-<viewport>-sNN.png`: every screen at 1440 and 390, and the first two screens at 1280 and 360.
  - Contact sheets: `shots/audit/sheet-<page>-1440.png` and `sheet-<page>-390.png`.
  - References: `shots/audit/ref/` and `sheet-ref-1440.png` / `sheet-ref-390.png`.
  - Backgrounds alone: `shots/audit/bg-*.png` and `sheet-bg-1440.png`.
- **One caveat:** leerob.com's computed font size reads as 42 px, but it renders at about 15 px. It is excluded from the type-size comparisons.

## Sources

Reference personal sites, measured 9 October 2026 at 1440×900 and 390×844 (layout only):
- Eugene Yan, home and about: https://eugeneyan.com/ and https://eugeneyan.com/about/
- Chip Huyen: https://huyenchip.com/
- Simon Willison: https://simonwillison.net/
- Lee Robinson: https://leerob.com/
- Brittany Chiang: https://brittanychiang.com/
- Andrej Karpathy: https://karpathy.ai/
- Hamel Husain: https://hamel.dev/
- Josh W. Comeau: https://www.joshwcomeau.com/
- Maggie Appleton: https://maggieappleton.com/

Guidance:
- Nielsen Norman Group, "Scrolling and Attention" (15 April 2018). 57% of page-viewing time is spent above the fold, and 74% in the first two screenfuls. https://www.nngroup.com/articles/scrolling-and-attention/
- Nielsen Norman Group, "Homepage Links" (2017; last reviewed 25 October 2024). Offer both a clickable logo and a Home link. https://www.nngroup.com/articles/homepage-links/
- Nielsen Norman Group, "F-Shaped Pattern of Reading on the Web" (2017; last reviewed 19 August 2026). Users scan, so front-load key points and use informative headings. https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
- Baymard Institute, "Readability: the Optimal Line Length" (10 May 2022). 50–75 characters per line. https://baymard.com/blog/line-length-readability
- Matthew Butterick, *Practical Typography*, "Point size". 15–25 px body text for websites. https://practicaltypography.com/point-size.html
