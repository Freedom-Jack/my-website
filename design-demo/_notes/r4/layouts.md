# Reference layouts: how good personal websites are actually built

*Round 4 research, 9 October 2026. Layout only, not art. 31 live sites measured in real Chrome at 1440×900 (desktop) and 390×844 at 3× pixel density (phone). Raw data: `r4/layouts-data/*.json`. Screenshots (research only, never to be published): `shots/layouts/`.*

## TL;DR

- **Your instinct is right, and a "traditional webpage" is not old thinking.** 26 of the 31 sites are calm, readable, normal-scale pages. None of them has a full-screen "slide" on a subpage. The other 5 are award-style showpieces, and they are a different genre: they are made for design juries and agencies, not for people hiring an AI architect.
- **The demo's paragraph text is already fine** (19–20 px in a 630 px column, about 56 characters per line). It looks like PowerPoint because of the **display type and the pacing**:
  - Your name is **294 px** on desktop. Across the references, the biggest text on a home page is a median of **31 px** (range 13–96).
  - Subpage titles are **140 px**. The reference median is **34 px** (range 13–56).
  - Figures are 84 px, and the Contact email is 156 px.
  - The first screen shows **39 words**. The reference median is **179** (131 on phones).
- **What the best sites have in common:** a visible name link at the top left, a single reading column about 600–720 px wide, 16–18 px text, a compact page title, and lists or rows rather than set pieces. Personality comes from **one signature detail**, such as Lee Robinson's painted panel, Anthony Fu's generative canvas, Josh Comeau's illustrated band or Lynn Fisher's book-like paper.
- **Subpages don't get heroes.** Page titles sit about 135 px from the top, and the first paragraph starts by about 320 px (both medians). The only "hero-like" thing is a short **art band** of 200–360 px: Hohpe uses a 213 px photo banner, Comeau a 357 px illustrated band. That band is where each of your pages can show *its own scene*.
- **Your photo:** the 7 references that put a portrait on the home page all show it **in the first screen, in colour, 157–262 px**. In the demo it is greyscale and sits about 4,600 px down, on the 5th screen.
- **Recommended direction:** combine archetypes 1 and 4 below: **a calm editorial column on paper, with the painting in the margins and one short scene band per page**. Use 18 px text, a 680 px column, 40 px page titles and a 56 px name, and aim for at least 150 words in the first screen.

---

## 1. Headline numbers: references vs the demo

Medians are over the 26 readable references, leaving out the 5 immersive or award-style sites.

| Measure | Reference median (range) | Demo, round 3 | Gap |
|---|---|---|---|
| Body text, desktop | **16 px** (13–22), line-height ≈1.58 | 19–20 px, 1.6 | fine (slightly large, which is OK) |
| Body text, phone | 16 px; 22 of 26 sites keep the desktop size | 17–18 px | fine |
| Reading column width | **657 px** (436–960) | 630 px | fine |
| Characters per line, desktop / phone | 74 / 40 | 56 / 34 | fine |
| Biggest text on home, desktop / phone | **31 / 28 px** (13–96) | **294 / 195 px** | ×9 / ×7 |
| Subpage title (h1) | **34 px** (13–56) | **140 px** (About, Work), 88 px (Note) | ×4 |
| Section heading (h2) | 24 px (14–44) | 89 px (statement), 65 px (Work projects) | ×3 |
| Words in the first screen, desktop / phone | **179 / 131** | **39 / 39** | ÷4.5 |
| Words per screen on home, desktop / phone | 155 / 109 | 96 / 86 | ÷1.6 |
| Home page length (desktop screens) | 1–5 (blog streams excluded) | 7.0 (Work: 10.3 desktop, 14.3 phone) | long |
| Visible way home in the header | a text name link on 17 of the 21 multi-page sites | **徐 seal icon only** | Jack's complaint confirmed |
| Space above a section heading | 24–142 px, clustering at 48–56 | 68 px | fine |

Conclusion: the column, the measure and the spacing are already in a normal range. The fix is to turn the display layer down and fill each screen with content, **not** to rebuild the grid.

## 2. The measured sites

Archetype numbers refer to section 4. "Biggest" is the largest text in the first screen. "Words" counts the words visible in the first screen of the home page. Sizes are CSS pixels.

| # | Site | Group · archetype | Body d/m | Column (chars/line d/m) | Biggest on home d/m | Subpage title | Way home · phone nav | Photo on home | Words d/m |
|---|---|---|---|---|---|---|---|---|---|
| 0 | **Jack demo r3** | — | 19/17 | 630 (56/34) | **294/195** | **140** (Note 88) | seal icon · inline | 216×288 grey, 5th screen | **39/39** |
| 1 | Chip Huyen | AI · 1 | 16/16 | 785 (87/44) | 26/26 | 42 | name · hamburger | 259 round, right of bio | 273/191 |
| 2 | Eugene Yan | AI · 1+4 | 16/16 | 720 (90/46) | 32/32 | 32 | name · inline | About page only | 217/132 |
| 3 | Lilian Weng | AI · 3 | 16/16 | 720 (80/42) | 34/34 | 36 | site name · inline | — | 379/360 |
| 4 | Andrej Karpathy | AI · 1 (one page) | 16/16 | 960 (114/38) | 34/34 | — | none | 240 round, top centre | 286/82 |
| 5 | Simon Willison | AI · 3 | 16/16 | 560 (62/41) | 32/24 | 22 | site name · inline | — | 356/179 |
| 6 | Hamel Husain | AI · 5 | 17/17 | 799 (88/39) | 31/26 | 34 | logo + "Blog" · inline | 157 round, beside intro | 186/146 |
| 7 | Sebastian Raschka | AI · 4 | 16/16 | 725 (89/40) | 29/29 | 40 | name · hamburger | 200 round, right | 117/98 |
| 8 | Jay Alammar | AI · 3 | 18/18 | 940 (95/40) | 30/30 | 30 | name · inline | 70 avatar | 89/89 |
| 9 | Jason Liu | AI · 5 | 16/16 | 688 (77/45) | 32/32 | 32 | name · hamburger | — | 174/141 |
| 10 | Vicki Boykis | AI · 3 | 16/16 | 720 (75/38) | 24/24 | 32 | name · inline | About page only | 250/146 |
| 11 | Shreya Shankar | AI · 2 | 16/15 | 720 (85/37) | 24/24 | 36 | name · hamburger | 220, left column | 422/290 |
| 12 | Martin Fowler | Architect · 4 | 16/19 | 650 (71/36) | 29/23 | 32 | wordmark · hamburger | 200, right of intro | 434/142 |
| 13 | Gregor Hohpe | Architect · 2 | 22/16 | 676 (48/39) | 34/25 | 54 on a 213 px banner | site name + "Home" · hamburger | 200×262, left column | 193/148 |
| 14 | Will Larson | Engineer · 3 | 16/16 | 629 (74/43) | 24/24 | 48 | site name · inline | — | 167/124 |
| 15 | Julia Evans | Engineer · 3 | 16/16 | 570 (61/40) | 64/48 | 27 | name banner · inline | — | 260/177 |
| 16 | Dan Abramov | Engineer · 3 | 16/16 | 632 (80/40) | 28/28 | 40 | site name only | 32 avatar | 65/56 |
| 17 | Mitchell Hashimoto | Engineer · 1 | 16/18 | 618 (72/39) | 17/19 | 17 | logo + "About" · inline | — | 157/148 |
| 18 | Patrick Collison | Engineer · link index | 13/13 (not responsive) | 460 (67/67) | 13/13 | 13 | none | About page only | 18/18 |
| 19 | Brittany Chiang | Design-dev · 2 | 16/16 | 607 (53/37) | 48/36 | 48 | sticky left column · none on phone | — | 239/140 |
| 20 | Lee Robinson | Design-dev · 2 (art panel) | 17/17 | 600 (64/40) | 42/35 | 30 | none on home | painted panel 467×800, sticky; dropped on phone | 133/106 |
| 21 | Paco Coursey | Design-dev · 1 | 16/16 | 640 (87/43) | 17/17 | 16 | none | — | 111/91 |
| 22 | Emil Kowalski | Design-dev · 1 | 16/16 | 644 (71/41) | 16/16 | 16 | name only | — | 68/63 |
| 23 | Anthony Fu | Design-dev · 1 | 16/16 | 656 (73/39) | 36/36 | 36 | logo · inline | fixed art canvas behind the column | 177/129 |
| 24 | Josh W. Comeau | Design-dev · 4 | 18/18 | 686 (68/39) | 32/32 | 36 under a 357 px art band | name · hamburger | illustrated avatar in band | 180/101 |
| 25 | Maggie Appleton | Design-dev · 4 | 22/20 | 792 (67/34) | 82/48 | 56 | logo · hamburger | — | 67/37 |
| 26 | Lynn Fisher | Art-forward · 1 (book) | 19/19 | 436 (32/29) | 96/86 | 48 | home *is* the contents page | About page, 129 | 15/15 |
| 27 | Rauno Freiberg | Design-dev · 6 | — | — | 75 statement | — | none | — | 52/52 |
| 28 | Bruno Simon | Award · 6 | — | — | 3D world | — | none | — | 0/0 |
| 29 | Robin Noguier | Award · 6 | 20/16 | 580 | 135/59 | — | "About" only | — | 24/23 |
| 30 | Dennis Snellenberg | Award · 6 | 17/16 | 352 (34/48) | 216/144 | 88 | text menu · "Menu" | full-bleed photo | 32/26 |
| 31 | Jesse Zhou | canvas · 6 | — | — | "START" gate | — | none | — | 1/1 |

*Cassie Evans (cassie.codes) was dropped: the site now shows only a retirement note.*

## 3. What the good sites do, part by part

**Home page, in order.** Almost every readable site follows the same sequence: **name, then 1–3 sentences on who I am and what I do now, then (optionally) a photo, then 2–4 short sections that are mostly lists with "see all →" links, then a one-line footer.**
- Chip Huyen's home is just a bio with inline links and a round photo: 1.1 screens.
- Eugene Yan stacks Intro → Latest → Trending → Talks → Prototypes as dated one-line lists.
- Lee Robinson: a two-paragraph bio, then Notes (a two-column link list), then Blogs (title-and-date rows).
- Paco and Emil: Today → Projects → Writing, each as a name plus one line, at 16 px.
- Typical home length is 1.4–4.6 screens. The demo's home is 7.

**Header and navigation.** On 17 of the 21 multi-page sites with a header, the **person's or site's name is a visible text link at the top left**. That is how visitors find "home" without thinking. The four that use a logo mostly add a text link as well (Mitchell Hashimoto's "About" and Hamel's "Blog"). Desktop headers carry 3–7 text links in a bar 40–100 px tall, mostly not sticky (only 6 stick).

On phones the split is:
- 10 sites keep inline text links (wrapping to a second row where needed: Lethain, Julia Evans, Lilian Weng).
- 8 use a hamburger menu.
- 8 have no menu, because they are one page or minimal.

With only 4–5 destinations, inline links are the better choice: they are visible and need no tap to discover.

**Subpages: a hero or a compact title?** Use a compact title. Across 25 subpages:
- The title is 13–56 px (median 34) and sits about 135 px from the top.
- The first paragraph starts about 320 px from the top (median).
- **None** has a full-screen hero.

Two have a short visual band:
- **Hohpe**'s About page puts its title over a 213 px photo banner (174 px on phones).
- **Comeau** puts a 357 px illustrated band behind every article title.

**Projects, experience and writing.**
- **Writing** is nearly always **date + title rows** with a hairline (Lethain, Lee Robinson, Eugene Yan, Boykis, Abramov, Fu). Only Appleton (illustrated squares) and Lilian Weng (summary cards) use tiles.
- **Projects** are a **name + one-line description** (Paco, Emil, Hamel's OSS page, Julia Evans' Projects page, Fu's grouped list). Thumbnails, where they exist, are small: Chiang's are 140×79 left of the text, Raschka's 120×80.
- **Experience** is either a **year-range column on the left with the role and one paragraph on the right** (Chiang, Karpathy's logo timeline, Eugene Yan's About) or simply a link to a CV/PDF (Shreya Shankar, Jason Liu's /resume).
- Nobody gives a project its own screen, and nobody sets a number at 80 px.

**Photo.**
- 7 of the 26 show a real portrait on the home page, always in the **first screen**, always in **colour**, at 157–262 px, placed beside or just above the bio (round: Huyen, Karpathy, Hamel, Raschka; rectangle: Fowler, Hohpe, Shankar).
- On phones it moves above, beside or just after the first paragraph, at 124–240 px (Hohpe shrinks his to a small thumbnail).
- Everyone else keeps the photo on About. Lynn Fisher's 129 px black-and-white portrait is the only greyscale one, and it is a small inline float on her About page.

**Footer.** Usually one or two lines, 20–150 px tall: ©, three to five links, sometimes a newsletter sign-up. Big site-map footers are rare (Comeau 533 px, Appleton 473 px). The demo's is 366 px.

**Phones.**
- Body size stays the same on 22 of 26 sites.
- Headings shrink only gently (home's biggest text: median 31 → 28 px; Appleton 82 → 48; Chiang 48 → 36).
- Side gutters are 16–28 px (the demo's 20 is good).
- Two-column layouts simply stack: Chiang's sticky identity becomes a normal top section, and Lee Robinson **removes** his art panel on phones. So any side art must have a phone plan (a short band, not a squeeze).
- Words in the first screen drop by about a quarter (179 → 131). They do not drop to the demo's 39.

**Where text meets art.** On every readable site with art, the text never sits *on* busy art. The art lives in one of four places:
- **in the margins** (Anthony Fu: a fixed canvas behind a 656 px paper column, `z-index:-1`, `pointer-events:none`);
- **beside the text** (Lee Robinson: a sticky painted panel);
- **in a band above the title** (Comeau, Hohpe);
- **in the texture of the paper itself** (Lynn Fisher).

All four can work with a fixed full-bleed painting.

## 4. Six layout archetypes, judged for Jack

Jack's readers are hiring managers, clients and collaborators, and peers. They skim first, then read.

**1. Single centred column on paper** (Huyen, Hashimoto, Fu, Paco, Kowalski, Lynn Fisher; Eugene Yan in part).
- *Pros:* the most readable layout. It is already a phone layout, it is fast, and it ages well.
- *Cons:* it can feel plain unless typography or art carries the personality.
- *Painting:* **the best fit.** On a 1440 px screen a 680 px column leaves about 380 px of margin on each side, which is exactly where mountains, river and market can live. Anthony Fu proves the technique.

**2. Two-column sticky identity** (Brittany Chiang; Hohpe's and Shankar's photo sidebar; Lee Robinson's variant with a sticky *art* panel instead).
- *Pros:* the name and navigation are always visible, the layout is dense, and it is quick for recruiters.
- *Cons:* it reads as a one-page CV, which is exactly what Jack said he doesn't want. Chiang's version is very widely copied. It collapses to one column on phones anyway.
- *Painting:* partial. The Lee Robinson variant (text left, painting in a sticky window right) is attractive on desktop, but the painting has to become a band on phones.

**3. Blog-first stream** (Simon Willison, Lilian Weng, Lethain, Abramov, Alammar, Boykis).
- *Pros:* shows activity, and good for search.
- *Cons:* it needs a steady stream of writing. With one note, it would look empty.
- *Painting:* yes (same as 1). **Not for now.**

**4. Editorial, sectioned home** (Appleton, Comeau, Eugene Yan, Raschka, Fowler).
- *Pros:* a confident headline plus short signposted sections, each pointing to a subpage. It can hold art bands, and it suits a person with a few kinds of content.
- *Cons:* each section needs real content behind it. The headline can drift into "huge": Appleton's is 82 px, but it is a full sentence that *says something*.
- *Painting:* **yes, as bands** between or above sections (Comeau).

**5. Docs or knowledge base with sidebars** (Hamel's Quarto, Jason Liu's MkDocs).
- *Pros:* great for hundreds of notes.
- *Cons:* it looks like documentation, and a three-column layout leaves no room for art.
- *Painting:* no.

**6. Immersive or award showpiece** (Bruno Simon: an Awwwards Site of the Day in 2019, with Developer of the Year and the users' Site of the Year at the 2019 Awwwards ceremony; Dennis Snellenberg; Robin Noguier; Rauno; Jesse Zhou's full-screen canvas behind a START gate).
- *Pros:* memorable, and it wins design awards.
- *Cons:* 0–52 words in the first screen, 135–216 px type, gates ("START"), and weak phone reading. These are made to sell design and animation services to other designers.
- *Painting:* the painting **is** the site.
- **The demo's type scale currently sits here.** That is why it reads as PowerPoint.

**Recommendation: 1 + 4.** Use a calm editorial column on paper, keep the painting fixed and full-bleed in the margins, and give each page one short **scene band** (the place where Work's market, About's path and so on become clearly *different* from each other).

On the home page:
- a compact hero: the name, one line on the role, and a 2–3 sentence intro that introduces "Jack" naturally;
- the colour photo right below it, with the bio beside it on desktop and stacked on phones;
- three short list sections (selected work as 3 rows, writing, how to reach me), each with "all →";
- a one-line footer.

On subpages, a compact title over the band, then content. Reading text never sits on unveiled painting.

## 5. Recommended layout system (grounded in the data)

| Token | Desktop | Phone (390) | Why |
|---|---|---|---|
| Body | **18 px / 1.6** (≈29 px line) | **17 px / 1.6** | The median is 16, but design-led sites with texture or art run 17–22 (Robinson, Comeau, Alammar, Fisher, Appleton, Hohpe). 18 is the safe middle. |
| Small print (meta, captions, dates) | 14 px / 1.45 | 14 px | Never below 13. Keep it off bare mountain (contrast). |
| h3 (item titles) | 20 px / 1.3 | 18 px | close to the references' h3 |
| h2 (section) | **26 px** / 1.25 | **22 px** | reference median 24 |
| h1 (page title) | **40 px** / 1.15 | **32 px** | reference median 34, top of range 56 |
| Home name (display) | **56 px** (cap 64) | **40 px** | Chiang 48, Julia Evans 64, Appleton 82. Not 294. |
| Figures (90%, 50%) | inline bold at body size, or ≤ 28 px in a compact stat row | ≤ 22 px | No reference sets a figure as display type |
| Reading column | **680 px** (≈ 66 characters at 18 px) | full width minus gutters (≈ 38–42 characters) | reference median 657 px; the classic 45–75 range |
| Wide column (diagrams, tables, photo plus bio) | **960 px** | full width | Karpathy, Alammar and Hohpe use 940–960 |
| Frame (header and footer alignment) | 1120–1200 px | — | |
| Side gutters | ≥ 24 px | **20 px** | references 16–28 on phones |
| Header | 64 px; name link left, 4 links right | 56 px; name row plus inline link row (no hamburger for 4 items) | 17/21 show the name as a link |
| Spacing unit | 8 px. Paragraphs 1 line apart. 32 px before h3. **64 px before h2** (48 on phones). 32–40 px after the title block. List rows 12–16 px with hairlines. | | reference h2 gaps cluster at 48–56 |
| Subpage title position | title top ≈ 120–140 px; first paragraph by ≈ 300–340 px | similar | medians 135 / 320 |
| Scene band (per page) | 200–300 px tall, under or behind the title | 140–180 px | Hohpe 213/174, Comeau 357 |
| Density targets | ≥ 150 words in the first screen of home; home ≤ 3–4 screens; Work ≤ 6 | ≥ 100 words | medians 179/131 |

## 6. Is "a traditional webpage" old thinking?

**No.** The sites in this sample that designers and engineers admire most are *more* traditional, not less:
- Paco Coursey and Emil Kowalski set even their page titles at 16 px.
- Lee Robinson's home is two paragraphs and two lists.
- Simon Willison's and Lilian Weng's sites, among the best-known AI blogs, are plain text columns.

"Old" is not the structure. It is the **dated details**: tiny 13 px text, layouts that don't adapt to phones (Collison's site renders as a shrunken desktop page on a phone), badge-filled sidebars, carousels and generic templates. "Modern" means a traditional structure with generous type, phone-first behaviour, fast loading and **one signature detail done beautifully**.

Jack's painting is a far stronger signature detail than anything in this sample, apart from the 3D showpieces. It only needs to step back from the text.

## Caveats

- Values are computed CSS pixels from headless Chrome. "Words in the first screen" counts visible text boxes inside the first viewport.
- Smooth-scroll sites (Snellenberg) report a one-screen page height, and the 3D sites have no measurable prose.
- Each site was sampled on one subpage or two, and sites change. All were verified live on 9 October 2026.
- Award claims are only made where Awwwards' own pages confirm them. I found no award record for Robin Noguier's or Jesse Zhou's portfolios, so they are described as award-*style*.

## Sources (all returned HTTP 200 on 9 October 2026)

AI/ML:
- https://huyenchip.com/ · https://huyenchip.com/2025/01/07/agents.html
- https://eugeneyan.com/ · https://eugeneyan.com/about/ · https://eugeneyan.com/writing/working-with-ai/
- https://lilianweng.github.io/ · https://lilianweng.github.io/posts/2023-06-23-agent/
- https://karpathy.ai/
- https://simonwillison.net/ · https://simonwillison.net/about/
- https://hamel.dev/ · https://hamel.dev/blog/posts/evals-faq/ · https://hamel.dev/oss/opensource.html
- https://sebastianraschka.com/ · https://sebastianraschka.com/books · https://sebastianraschka.com/blog/
- https://jalammar.github.io/ · https://jalammar.github.io/illustrated-transformer/
- https://jxnl.co/ · https://jxnl.co/resume/
- https://vickiboykis.com/ · https://vickiboykis.com/about
- https://www.sh-reya.com/ · https://www.sh-reya.com/blog/in-defense-ai-evals/

Engineers and architects:
- https://martinfowler.com/ · https://martinfowler.com/aboutMe.html
- https://architectelevator.com/ · https://architectelevator.com/about
- https://lethain.com/ · https://lethain.com/agents-as-scaffolding/
- https://jvns.ca/ · https://jvns.ca/projects/
- https://overreacted.io/
- https://mitchellh.com/ · https://mitchellh.com/writing/building-large-technical-projects
- https://patrickcollison.com/

Design-minded developers and art-forward:
- https://brittanychiang.com/
- https://leerob.com/
- https://paco.me/
- https://emilkowal.ski/
- https://antfu.me/
- https://www.joshwcomeau.com/ · https://www.joshwcomeau.com/css/subgrid/ · https://www.joshwcomeau.com/about-josh/
- https://maggieappleton.com/ · https://maggieappleton.com/ai-dark-forest
- https://lynnandtonic.com/ · https://lynnandtonic.com/about/
- https://rauno.me/

Award-style:
- https://bruno-simon.com/ (Awwwards record: https://www.awwwards.com/sites/bruno-simon-portfolio; Awwwards Annual Awards 2019: https://awwwards.com/annual-awards-2019)
- https://dennissnellenberg.com/ (Awwwards profile: https://www.awwwards.com/dennissnellenberg/)
- https://robin-noguier.com/
- https://www.jesse-zhou.com/

Retired:
- https://cassie.codes/ (now a farewell note)
