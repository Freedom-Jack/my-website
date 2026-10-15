# Round 4 proposal: a calm page inside a living painting

*Design director, 9 October 2026, for Jack. Revised after a completeness review. This draws on five research reports (31 personal sites measured live today, an audit of round 3, and two art sketches). I also rebuilt my test wireframes to match this spec and measured them at eight screen sizes. Nothing in the repo or `design-demo/` was changed. The main part is about a 15-minute read (much of it tables to skim); the appendices are reference.*

## The short version

1. **You were right about almost everything:** the site is huge, slide-like and CV-like, the home link is hidden, the photo looks lifeless, and the backgrounds look alike. Two causes are different from what you guessed: the body text was always fine, and blank space in itself isn't the problem.
2. **Layout:** a normal, readable personal website. Text is 18 px, page titles 40 px, and your name 72 px (not 294). **Every page opens with a short painted strip of its own scene,** with real content on the first screen.
3. **Pages:** one job per page. Projects live on Work; timeline, skills and credentials on Résumé. **Home becomes your "about me" page:** a greeting, your colour photo, and "About me" in your words.
4. **Painting:** one story-scroll, as you meant it. Your mountain, the river market, the terraced fields and the ferry, in misted blue-green with light colour on the town. Today's mountains stay.
5. **Name:** "Qijin Xu" is the name. The very next words are **"Most people call me Jack."**

## Your points, answered

| You said | My answer | See |
|---|---|---|
| 1. Each page should have a matching background; "work will look like a Chinese market" | Yes. One narrative handscroll: each page is a place that pictures what the page is for, and together they tell one journey. | §6 |
| 2. "Very PowerPoint… huge… hard to read"; is a traditional webpage old thinking? | Huge and slide-like: yes. Traditional: not old, it's what the best sites do. Display type shrinks 3–6×; Home's first screen holds 2–4× more words. | §1–3 |
| 3. About page "only clickable on the icon" | "Qijin Xu" as visible text beside the seal, both linking home. Home gets an "About me" section under the hero. | §3, §5 |
| 3. Too much on the about page; looks like a résumé; "Jack in the middle" | Projects go to Work, CV facts to Résumé. The hero becomes your name plus one sentence in your voice. No brackets, and no title-and-company stack. | §4, §5, §7 |
| 3.1 Photo below the hero, in colour; painting can be colourful | Yes to both. | §5, §6 |
| 3.2 A really good mobile site | Designed for the phone first, tested from 360 px wide to sideways phones, with a real-phone check. | §8 |
| 4. Too sparse; hero looks the same; heroes on subpages? | Much more per screen. **Subpages get a short painted strip, not a full-screen title slide.** | §2, §3 |
| What pages, and what goes on each | A sitemap, verdicts on common pages, and an outline for each page. | §4 |

## 1. Diagnosis

Round 3 is a good painting wrapped around a poster.
- **Display type is set for a stage.** Your name is 294 px; the largest text on 26 good personal home pages has a median of 31 px. Subpage titles are 140 px (median 34). On Home, giant letters cover more of the screen than all the readable text (a ratio of 1.09; the references score 0.00–0.07).
- **The pacing is a slide deck.** The first screen holds 35–39 words (the references hold about 180–220), and 11 headings and figures fade in one at a time as you scroll.
- **Every page repeats the CV.** Home lists all six projects. "90%" appears 9 times. About had more CV items than the Résumé (29 against 26), and your life outside work gets one sentence.
- **Your face arrives last and grey,** 4,768 px down on a phone, and **the only way home is a 38 px seal.**
- **The backgrounds look alike because they are.** With text hidden, every page is grey (no coloured pixels, dark ink on 2% of the screen or less) and reads as "pale mountain on the right":

*(Screenshot removed before commit, per the rule that research screenshots stay out of the repo: Round 3 backgrounds with the text hidden. Recreate it from `prototypes/` if needed.)*

**Where the cause was different:** the body text and line length were already textbook (19 px, 54–64 characters a line). Lots of blank paper is normal; good minimal sites are 59–85% blank too. On phones, the subpage heads were not the main problem; the home hero and the page length were.

## 2. Your questions

**"You sure this is a good personal website?"** Not yet. The information is good and honest, but it is set at poster scale and in the wrong places. A good personal site tells a stranger who you are in 10 seconds, and lets them judge your work in 2 minutes. Worth keeping: the body text, Work's summary table, the honest evidence lines, the diagrams with "Read as steps", and the painting.

**"Is a traditional webpage old thinking?"** No. The most admired sites are *more* traditional. Lee Robinson's home page is two paragraphs and two lists. Simon Willison's site is one text column, and Lilian Weng's is a list of post summaries. What looks old is dated *details*: tiny text, layouts that don't adapt to phones, carousels and stock templates. Modern means a traditional structure, phone-first and fast, with **one signature**. Yours is the painting; the brush underline, the ink button and the seal are quiet craft serving it.

**"Should subpages have a hero?"** **Yes, a short painted strip; no full-screen title slide.** None of the 25 subpages we measured has a full-screen hero. The two with art use a short band (Comeau 357 px, Hohpe 213 px).

**"Hero looks the same."** Unchanged since round 2 (we froze it), and every page opening the same way: both true, both fixed. Home gets a new greeting-led hero and is the only page with a person on it. Every page gets its own scene *and* opens on different content: Work on its table, Résumé on a document header, Contact on your email.

**"Very hard to read."** The body text is fine: 16:1 contrast, and the grey small print is 5.9:1. The problem was scale: you can't take in a 294 px word or an 89 px sentence at a glance. Two more fixes:
- **No text ever sits on colour.** Grey print would drop to about 3:1 on the green.
- **Section headings switch to the body font in bold.** The heavy condensed font stays for your name and page titles only.

## 3. The layout

**The archetype:** a calm reading column on cool paper, with **a painted strip at the top of every page**. A handscroll *is* a horizontal strip, so the site shows one place of it at a time. The strip has no frame and fades into the paper.
- **Wide screens (1200 px and up):** the title and intro sit in the strip's mist on the left, as in round 3's hero, and the scene's figures stay to their right.
- **Narrower screens:** the strip runs across the top, and the title sits on paper below it.

| | Wide (1200+) | Tablet (640–1199) | Phone (under 640) |
|---|---|---|---|
| Body / lead sentence / small print | 18 / 20 / 14 px | 18 / 20 / 14 | 17 / 18 / 14 |
| Item / section heading (body font, bold) | 20 / 26 px | 20 / 26 | 18 / 22 |
| Page title | **40 px** (was 140) | 40 | **32** |
| Your name on Home | **72 px** (was 294) | 55–62 | **44–45** (was 195) |
| Figures | bold at text size in sentences; ≤ 28 px in a case summary | | ≤ 22 |
| Column / wide blocks | 680 / 960 px in a 1200 px frame | 680 | full width, 20 px margins |
| Space between sections | about 72 px (was 140) | about 64 | about 52 (was 102) |
| Painted strip, Home / subpages | 440–540 / 300–360 px | 220 / 220 | 96–120 / 110–170 |
| Type sizes per screen; text animating on scroll | at most 4 (round 3: 4–5; references: about 3); none (round 3: 11 on Home) | | |

**Why 72 px for your name:** the one signature moment, well above the 40 px titles. Name-led sites use 34–48 px, the most art-led 82–96, and the audit's range was 48–72. At 72, Home's display-to-reading ratio is 0.09 (budget 0.25). The demo compares 56, 72 and 96.

**Header (64 px; 56 on phones):** the seal plus the words **Qijin Xu**, as one link home, top left. Work · Résumé · Contact on the right, with the current page brush-marked. The links fit in one row at 360 px (measured), with no menu button. The header hides as you scroll down and returns, solid, as you scroll up.

**Footer (about 150 px, was 366):** a thin "story map" of the whole scroll, one mark per scene, each linking to its page. Then © 2026 Qijin Xu · Toronto · Email · LinkedIn · GitHub · Writing · View résumé (PDF), and "Updated October 2026 · Still the landscape".

**Tested** in wireframes built to this spec, with the real fonts and the scenes researcher's draft art at real strip sizes, measured with the audit's own script. At 1440 px, Work shows all six projects on the first screen. One flaw: at 1280 px the bridge comes too close to the intro, so each width needs its own framing (work for 4b).

*(Screenshot removed before commit, per the rule that research screenshots stay out of the repo: Work, first screen at 1440 × 900 in the wireframe. Recreate it from `prototypes/` if needed.)*

**Proven, and a bet.** The strip's *shape* is proven: Comeau and Hohpe use one. A *live painted scene* inside it is something nobody we measured does. It is our hypothesis, and demo 4b tests it.

**Five sites to open, to feel the layout** (checked 9 Oct 2026):
1. **joshwcomeau.com** (any article): an illustrated band above a modest title, the closest thing to our strip.
2. **architectelevator.com/about** (an enterprise architect): a title over a 213 px photo banner.
3. **sarasoueidan.com:** "Hi, I'm Sara.", two paragraphs and a large colour headshot beside them: a greeting, not a CV.
4. **eugeneyan.com** and **/about/:** an ML practitioner's density.
5. **leerob.com:** a home page of two paragraphs and two lists (density only; not his framed art card).

## 4. Pages: what to have, and what goes on each

```
qijinxu.com
├─ /          Home: who I am (your "about me")      [the seal + "Qijin Xu", top left]
├─ /work/     Work: what I built, how, how well     [nav]
├─ /resume/   Résumé: the facts (+ PDF, + JSON)     [nav]
├─ /contact/  Contact: who should write, about what [nav]
├─ /writing/  Writing: notes and essays             [nav from three pieces; until then Home + footer]
└─ /404       (/about/ redirects to / : decision 1)
```

| Candidate page | Verdict |
|---|---|
| About | Merged into Home for now. It returns when you write a longer story (300+ words) or start giving talks |
| Now | A dated block on Home, shown only once you write it. Not a page: four lines make a thin page |
| Talks | Not yet: a section from your first real talk, a page at about three |
| Open source; side projects (your game tools) | Sections of Work: "In the open" exists, and side projects come once you share them |
| Uses, Services | No. Uses only serves peers, and Services doesn't fit a CGI employee |

**Why Home absorbs About, and the cost.** You call Home your "about page", and a visitor's first question *is* "who is this?" Brittany Chiang, Karpathy and Chip Huyen work this way. **The cost:** your story fits in Home's "About me" (about 120–200 words), and the organiser bios move to Contact. If you'll write a longer story, we keep an About page for it instead.

**What moves:**
- Six projects → **Work.** Home keeps three one-line teasers: the one deliberate repeat.
- "How I build" and its diagram → **Work.**
- Timeline, skills and credentials → **Résumé** only.
- Your story → Home's **About me.**
- The "Qijin (Jack) Xu · Toronto" caption → dropped.

**Work: "What has he built, and how well did it work?"** About 5 desktop screens (now 10.3) and 8 on phones (now 14.3).
1. The market strip, "Work", and its one-line intro.
2. **"Six projects, newest first":** the existing table, as the index, on the first screen.
3. **How I build:** the statement, the diagram (never taller than a phone screen) and "Read as steps".
4. **Two flagship cases:** a one-line summary with the figure, then Context · What I did · **The hard part** (your words) · Outcome · Evidence · Stack.
5. **More work:** four short cases; on phones they open on tap.
6. **In the open,** then **Side projects**, then the closing scene and "Next: Résumé →".

```
WORK, 1440 × 900 (measured: all six rows in view, first row at y 519, 166 words)
+------------------------------------------------------------------------------------------+
| [seal] Qijin Xu                                             _Work_   Résumé    Contact   |
|~ ~ ~ ~ ~ ~ ~ ~ ~ ~ WORK STRIP, 360 px, full width, no frame ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| Work                     (40 px)      mist   ^^ blue-green hills ^^ roofs, stalls, crowd |
| Most of what I build runs inside      mist      ___ the rainbow bridge ___   boat        |
| client systems, so the code is ... (20 px)  /                         \   willows        |
|~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ the strip fades into the paper ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| Six projects, newest first                                                               |
| Years        Project                      Outcome                           Evidence     |
| 2025 – now   Agent for a proprietary ...  Projected 50% less manual work    Client work  |
| ... five more rows, all in view (15 px) ...                                              |
+------------------------------------------------------------------------------------------+

WORK, phone 390 × 844 (measured: title at y 249, first row at y 469, 103 words)
+--------------------------------------+
| [seal] Qijin Xu  _Work_ Résumé Contact|  56 px, one row
|░ STRIP 169 px: the bridge, its crowd,░|
|░ the boat lowering its mast          ░|
| Work                         (32 px) |
| Most of what I build runs inside ... |
| Six projects, newest first           |
| 2025 – present                       |
| Agent for a proprietary programming  |
| language · Projected 50% less ...    |
+--------------------------------------+
```

**Résumé:** a low terraced-fields strip (about 200 px; it's a document), then your name, title, a contact line (no phone or address) and View résumé (PDF) · JSON. Then Summary · Experience (with the vertical brush timeline you chose) · Skills · Education · Certifications. It still prints to two pages.

**Contact:** the ferry strip, then one sentence on who should write (decision 5). Then the email at 26 px (not 156) with a Copy button, LinkedIn, GitHub, the PDF and your time zone. Add "For organisers" (two bios with Copy buttons) if you want speaking invitations.

**Writing:** the lakeside pavilion strip, then dated rows. The Note's title drops from 88 to 40 px.

## 5. Home

About 3 desktop screens and 4 on phones.

**1. The hero: a greeting, not a résumé header.**
- **"Qijin Xu"** at 72 px.
- **Your voice, at 20 px** (drafted from your existing copy; for your approval): *"Most people call me Jack. I'm a Lead AI/ML Architect at CGI's AI Center of Excellence in Toronto, where I design and ship production AI: LLM agents, retrieval systems, and the data platforms underneath them."* Then: *"Right now I'm leading an agent that reads and documents legacy code written in a proprietary language."*
- **See the work →** · **Résumé**

A recruiter still gets your title, employer and city in ten seconds, as a sentence from a person rather than a stack of labels. The strip (522 px on a 1440 × 900 screen) fits the hero, so your photo shows on the first screen.

**What visibly changes on Home** (your "don't get it wrong"):
- The hero is about 520 px tall instead of a full screen.
- The name is 72 px with no "(Jack)", and your role moves into a sentence.
- The mountain gains misted blue-green, a tiny traveller and a hut.
- On phones the painting becomes a strip above your name, instead of sitting behind the text.

Your mountain's shape and crags, the mist, the paper and the sideways pan stay. This retires round 3's "hero pixel-identical" rule (decision 3).

**2. Your photo, directly below, in colour, beside "About me."**
- **Wide screens:** 280 px wide (340–360 after the reshoot), at the left of the column, with "About me" to its right. Asymmetric, not a 50/50 split.
- **Phones:** 72% of the width (252 × 315), with the text below it.
- **Treatment:** full colour with a light grade baked into the file (slightly less saturated, the wall lifted toward the paper, warm skin). A 3 px corner. No caption, vignette, blur, mist, grey or seal. A 1 px faint hairline only until the reshoot, because the selfie's white wall otherwise melts into the paper.
- **"About me" is your words,** not a chronology: why you do this work, and something from outside it (prompts in §9). This is what stops Home reading like a CV, and only you can write it.

**3. What I work on:** three problems you solve, each with one line of proof and a link, then "All six projects →". These are drafts from existing facts:
- *Assistants that answer from your own knowledge:* about 90% resolved without a person, for 50,000+ users.
- *Agents for code nobody documented:* a projected 50% less manual work.
- *Data platforms AI can stand on:* 99.9% uptime on Canada's largest auto-insurance policy-history database.

**4.** Now · October 2026 (once you write it). **5.** Writing. **6.** Say hello: who should write, and the email. Then the closing scene, where the road runs down from your mountain toward the river town: the doorway to Work.

```
HOME, 1440 × 900 (measured: "Jack" at y 236; photo top at y 618, 282 px of it in view)
+------------------------------------------------------------------------------------------+
| [seal] Qijin Xu                                              Work    Résumé    Contact   |
|~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ HOME STRIP, 522 px, no frame ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| Qijin Xu                       (72 px)                  /\/\   YOUR MOUNTAIN, misted     |
| Most people call me Jack. I'm a Lead AI/ML Architect   /    \  blue-green; a hut         |
| at CGI's AI Center of Excellence in Toronto, where I  / [hut]\                           |
| design and ship production AI ...   (20 px)                                              |
| Right now I'm leading an agent that reads and documents legacy code ...                  |
| [ See the work -> ]   Résumé                             . the traveller on the path     |
|~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ the painting fades into the paper ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ |
| +------------+   About me                       (26 px)                                  |
| |  PHOTO     |   [your words: why this work, and something outside it, 120-200 words]   |
| |  colour    |                                                                           |
+------------------------------------------------------------------------------------------+
  then: What I work on · Now · Writing · Say hello · closing scene (the road down) · footer

HOME, phone 390 × 844 (measured: 59 words; "Jack" at y 259; photo top y 620, 224 px in view)
+--------------------------------------+
| [seal] Qijin Xu   Work Résumé Contact|  56 px
|░ STRIP 118 px: the hut, the traveller░|
| Qijin Xu                     (45 px) |
| Most people call me Jack. I'm a Lead |
| AI/ML Architect at CGI's AI Center   |  (18 px)
| of Excellence in Toronto, where ...  |
| Right now I'm leading an agent ...   |
| [ See the work -> ]   Résumé         |
| +-------------------------+          |
| |  PHOTO, colour, 252 wide|          |
+-+-------------------------+----------+  first screen ends; "About me" follows the photo
```

**A phone trade-off, stated openly.** The audit asked for 70 or more words on the first phone screen. The wireframe shows 59 (round 3: 35), and that screen also holds the scene and the top of your face. Reaching 70 would push your face off the screen, and the face is worth more.

*(Screenshot removed before commit, per the rule that research screenshots stay out of the repo: Home at 1440 × 900 in the wireframe. Recreate it from `prototypes/` if needed.)*
*(Screenshot removed before commit, per the rule that research screenshots stay out of the repo: Home on a 390 px phone in the wireframe. Recreate it from `prototypes/` if needed.)*

*(The grey Latin text marks where your words go. The art is the draft sketch, not the final painting.)*

## 6. The narrative painting

**What you meant, one level deeper.** Two wishes are folded together.
- **Meaning:** the site is one handscroll you travel through, like *Along the River During the Qingming Festival*. Each page is a place that pictures what it's about, so the sideways pan between pages *becomes* the story.
- **Life:** the grey photo looked like "a dead person", painting "can be colourful", and a market is full of people. The site should feel alive and human, not like a museum print. So the plan adds colour, people and small movement, and puts your real face right under the hero.

**The story** (it follows the nav):
- A traveller sets out from his mountain (**Home**) and comes down to the river town where the work gets done (**Work**).
- Past the town, the road climbs through the ordered terraced fields of his record (**Résumé**), and ends at the ferry, waiting to bring you across to meet him (**Contact**).
- Just off the road, by the still lake, is the pavilion where he writes (**Writing**).
- Wander off the road altogether, and the path fades into mist (**404**).

| Page | Scene and its one focus | Colour |
|---|---|---|
| Home | Your mountain as today; a tiny traveller in white on the path; a hut on a ledge | the strongest: azurite peaks, malachite slopes |
| Work | A river market town at a timber rainbow bridge; its crowd; a boat lowering its mast | blue-green hills; the town in light colour over ink |
| Résumé | Terraced fields stepping down to the shore: years of steady work, in rows like a record | pale malachite |
| Contact | The crossing (already built), your mountain on the far shore; a ferry at the jetty, turned toward you | indigo water |
| Writing | The still lake (already built); an open pavilion, one seated figure | ink only |
| 404 | The lone peak; the path running out into mist | ink only |

**How a page uses its scene: arrive, read, leave.**
- **Arrive:** the scene fills the page's strip.
- **Read:** the scene scrolls away *with* the page, like a picture in it. On desktops, today's faint ink horizon stays low on the screen (no colour, no figures, never under text). On phones, you read on plain paper.
- **Leave:** each page ends with a closing scene of about 240 px: the road toward the next place, with "Next: …". This replaces round 3's 590 px mid-page gaps, and on phones each page shows its place twice.
- **Between pages:** the painting pans sideways, as today. The next scene is drawn when you hover over or touch the link, so it's ready before the pan. On a slow phone, the town fades in through the mist within 0.3 s; it never pops in.

**Colour: two registers, as in the paintings themselves.**
- **Mountains** take misted blue-green, the palette of *A Thousand Li of Rivers and Mountains* (1113).
- **The town, boats and people** take light colour over ink, the Qingming scroll's own manner: grey tile roofs, timber brown, pale indigo clothes.
- The paper stays cool. **No yellow, gold, beige or cream anywhere.** I dropped my first draft's tan ochre and Contact's lamp, which read as yellow.
- Colour stays inside the painting, and text never sits on it.
- Because the painting now sits *beside* text, it can be richer than my first draft allowed. Demo 4a lets you compare "ink", "misted" (my default) and "rich".

Hex values are in Appendix B.

*(Screenshot removed before commit, per the rule that research screenshots stay out of the repo: Colour study: A today's ink, B misted blue-green with the traveller (proposed), C full strength, D ochre glaze (rejected). Recreate it from `prototypes/` if needed.)*
*(Screenshot removed before commit, per the rule that research screenshots stay out of the repo: Warm accent: the draft's ochre glaze (left) reads beige; the greyed timber browns do not. Recreate it from `prototypes/` if needed.)*

**Life, without a video-game look:** water shimmers, a boat drifts, smoke rises, willows sway. Crowds (in the market only) stand still. I'll test one figure crossing the bridge very slowly, and keep it only if it looks like the painting breathing. Everything stops for reduced motion, for "Still the landscape" and when idle.

**What the sketches showed:**
- The market reads as "the river town at the bridge", and best of all on a phone, like a hand-held album leaf.
- In my wireframes (a crop of the same painting with extra mist, not a new composition), the mist clears the title at 1440 px, and a bridge-centred crop works at 1024 px and on phones. At 1280 px the bridge sits too close to the text.
- Home's phone strip is the weakest crop: it needs its own framing, with the traveller at least 12 px tall.
- Faults to fix before you judge finished art: vector-looking houses, a thin bridge, beige roofs, weak willows, a floating hut (Appendix B).

**Cost:** about 3–4 weeks of art tuning for the market, traveller and ferry.

**Kitsch guards:** no red lanterns, pagodas, dragons or gold (Song-period forms only); blank shop signs, so the seal stays the only character; no clip-art repetition; nothing figurative within 40 px of text.

**How we'll know it worked:** show the six strips, text hidden, at phone size, to people new to the site. They should sort them as six different places and pick out Work and Contact unaided. We'll run the same test on round 3 as the baseline.

## 7. Name and identity

**Qijin is your name; Jack is your voice.** "Jack" never sits inside your name again.

| Place | Wording |
|---|---|
| Home name, header link, footer, bylines, photo description | **Qijin Xu** |
| The first words after your name | **"Most people call me Jack."** (Or, if you prefer a greeting as the big line: "Hi, I'm Qijin Xu.") |
| Optional | *"Qijin sounds like 'chee-jin'."* Your wording to confirm |
| Résumé and PDF | **Qijin Xu**, with "Goes by Jack" in the contact line (decision 4) |
| Search engines only | page title "Qijin (Jack) Xu · Lead AI/ML Architect"; structured data "Qijin Xu", with "Jack Xu" and "Qijin (Jack) Xu" as alternate names |

Google's guide (updated 8 Sep 2026) wants the real name as the name, and calls an alternate name "an alternate public identifier" (its example is a social handle). schema.org calls it "an alias". A nickname fits, but Google promises nothing about matching "Jack Xu".

Never: brackets or a smaller "Jack" inside the name, "Jack Xu" as the heading, or a fake-handwriting font.

## 8. Mobile

We judge every page on a phone first. **Tested in the wireframes:** 360, 375 (a short 667 px screen) and 390 px wide; tablets at 768 and 1024; and a sideways phone (844 × 390). Nothing scrolls sideways at any of them.

| Area | Spec |
|---|---|
| Text | body 17, lead 18, small print 14 or more, headings 22, page titles 32, name 44–45 px |
| Header | one row, 56 px. Name and three links fit at 360 px, and wrap below 340. Hides on scroll down, returns solid on scroll up |
| Tapping | every link and button at least 44 × 44 px |
| Strip | Home 96–120 px, subpages 110–170 px, framed on the scene's focus. Short or sideways phones (under 500 px tall): an 80 px strip and a 48 px header |
| Home | strip, name, intro with "Jack", buttons, then your photo (measured in §5). On a short 667 px phone, 69 px of the photo still shows |
| Long content | tables become stacked rows; short cases open on tap; diagrams fit one screen, with "Read as steps" |
| Speed | the photo loads at once; the painting's figures are drawn once per page, in the background, never while you scroll; text never waits for the painting |

**Real-phone check (demo 4b),** to close round 3's parked "smoothness on real phones" item:
1. The iOS Simulator on your Mac (Safari's engine): for layout, not speed.
2. **Your own iPhone**, opening the demo from your Mac over home Wi-Fi.
3. An Android phone, if you have one.

**One speed change now:** the demo took 3.5–5.1 s to show the biggest thing on its first screen. Part of that is the name's ink arrival holding it back. **Your name will be readable the moment the page appears;** the ink effect becomes a settle of 0.4 s at most. The rest stays on your speed backlog.

## 9. What only you can give (about an hour)

Plain sentences are fine. We edit lightly and show you first. Nothing is invented in your voice.

1. **About me (120–200 words):** *Why do you do this work? What do you care about in AI right now? What do you do outside work?*
2. **Now (3–5 lines):** *What are you building (one shareable line), learning, playing, open to?*
3. **Your game tools:** *Which games? What do they do? Is there a screenshot or repo?*
4. **"The hard part" of the two flagship cases,** kept generic: *What was the hardest decision? What didn't work? How did you know it worked?*
5. **Who should write to you** (decision 5).
6. **Photos:** the reshoot (side daylight, a real smile, someone else holding the camera, the red top), plus a candid shot if you have one.
7. **Pending facts:** your graduation date and honour, your LinkedIn address, and the Note's title and typos ("ChaGPT").

**Timing:** if items 1–2 arrive before demo 4a, it shows your words. If not, 4a shows drafts built only from your résumé and old site, marked DRAFT, and Home will still read a little like a profile until your words replace them (a text-only swap). **Launch needs** item 1 (or your OK on a draft), item 5 and item 7. Everything else is optional; empty sections simply don't appear.

## 10. The plan

**Demo 4a: the reading fix, with colour and draft scenes (quick: mostly layout and text).**
- The new layout, header, footer and type on every page, with content moved as in §4.
- The greeting hero, your colour photo with "About me", and the name treatment.
- Each page's own colour and crop of today's painting.
- **Fair warning:** apart from the two drafts below, pages will differ in colour and mood but will still be "mountains". The real places arrive in 4b.
- **Work's market and Home's traveller, in place at sketch quality and labelled "draft art",** so you can judge the idea where it will live.
- Switches to compare your name at 56, 72 and 96 px, and colour as ink, misted or rich.

**Round 3's details:** kept: the ink buttons, brush underlines, seal stamp, pan, "Still the landscape", margin notes and the mist around the mouse (sky only). Moved: the timeline to Résumé, the diagrams to Work. Gone: scroll fade-ins, mid-page vistas, the edge transition. Full table: Appendix C.

**4a's budget**, checked on every page. "—" means not measured yet.

| Measure | 1440 × 900 / 1280 × 720 / 390 phone | Round 3 | Wireframe now |
|---|---|---|---|
| Words on Home's first screen | ≥ 120 / ≥ 100 / ≥ 55 (with name, "Jack", role and photo top) | 35 / 35 / 35 | 145 / 113 / 59 (52–84 of the desktop words are your "About me", placeholder for now) |
| Words on a subpage's first screen | ≥ 150 / ≥ 120 / ≥ 90 | Work 123 / 84 / 80 | Work 166 / 146 / 103 |
| Display type ÷ readable text | Home ≤ 0.25, others ≤ 0.10 | Home 1.09, others 0.18–0.34 | Home 0.07–0.13, Work 0.02–0.04 |
| Largest text: name / titles | ≈ 72 / 68 / 45; ≤ 40 / 40 / 32 | 294 / 279 / 195; 140 | 72 / 68 / 45; 40 / 40 / 32 |
| Type sizes per screen | ≤ 4 | 4–5 | Home 4, Work 3–4 |
| Space between sections | 56–80 / 56–72 / 40–56 px | 140 / 140 / 102 | ≈ 74 / 74 / 53 |
| Work's length (screens) | ≤ 5 / ≤ 6 / ≤ 8 | 10.3 / 12.9 / 14.3 | — (needs full content) |
| Colour photo starts on the first screen | yes, at all three | screen 6–7 | 618 / 536 / 620 px |
| Text animating on scroll; sideways scrolling | 0; none from 320 to 1440 px | 5–11 per page; none | 0; none |
| Contrast | body ≥ 7:1, small print ≥ 4.5:1 on its real background | met on paper | met on paper |

**Demo 4b: the scenes at quality (about 3–4 weeks).**
- Work's market, Home's traveller and hut, and Contact's ferry, inside the live painting.
- Arrive, read and leave, the pre-drawn pan, framing for each width, the real-phone check, and the "tell the places apart" test.
- The pavilion, terraces, 404 and small life follow.

**The Next.js build** starts when you approve 4a (decision 6).
- The painting becomes a layer that never delays text, and each scene plugs in as it passes your review.
- The résumé PDF is generated from the web page, and `/about/` redirects to `/`.
- **Launch** waits for your OK on Work's market. qijinxu.com is connected at launch.

## 11. Decisions for you

**Rules this changes**, so nothing softens silently:

| Earlier rule | Now | Decision |
|---|---|---|
| No buildings, boats or people | Allowed **inside the painting only**, never as icons | 2 |
| Ink only; red for the seal only | Blue-green and timber brown inside the painting; red still for the seal only | 3 |
| Home hero frozen pixel-for-pixel | Retired: shorter, a smaller name, colour, greeting-led | 3, 4 |
| No "text left, picture right", framed paintings or bordered frames | Kept in spirit. The painting is an unframed, full-width strip, with the title in its mist as in round 3's hero. One exception: the photo's faint hairline until the reshoot (tell me if it bothers you) | — |
| No yellow, gold, beige or cream; the seal is the only Chinese character | Unchanged | — |

1. **Should Home become your "about me" page,** with /about/ redirecting to it until you write a longer story? *Default: yes, unless you'll write 300+ words of story; then we keep an About page.*
2. **Should the painting tell the traveller's journey,** with small people, buildings and boats inside the painting only, and a tiny traveller standing for you on Home (see the Work image in §3)? *Default: yes.*
3. **Should the colour be misted blue-green on the mountains and light colour on the town, site-wide (Home's mountain included),** with no yellow, gold or beige, the paper cool, and red kept for the seal (see the images in §6)? *Default: yes, at "misted" strength; compare "rich" in 4a.*
4. **Should the hero read "Qijin Xu", then "Most people call me Jack. I'm a Lead AI/ML Architect at…",** with the résumé headed "Qijin Xu" plus "Goes by Jack"? *Default: yes to both, without the pronunciation line unless you want it.*
5. **Who should write to you:** hiring, speaking, collaboration or consulting? *Default: collaboration and speaking, with no "hiring" language, since your employer can read the site.*
6. **Should the Next.js build start once you approve 4a,** with the scenes finished alongside it and launch waiting for your OK on the market? Waiting for 4b would delay the build by about 3–4 weeks. *Default: yes.*

---

### Appendix A: Chinese terms used above (for your reading only)

None of these go on the site. **I propose no new Chinese text:** the seal 徐 stays the only character.

| Term | Pinyin | Meaning |
|---|---|---|
| 清明上河图 | Qīngmíng Shànghé Tú | *Along the River During the Qingming Festival*, the scroll with the market and bridge |
| 虹桥 | Hóngqiáo | the Rainbow Bridge, its timber arch bridge |
| 千里江山图 | Qiānlǐ Jiāngshān Tú | *A Thousand Li of Rivers and Mountains* (1113), the blue-green masterpiece |
| 青绿山水 | qīnglǜ shānshuǐ | "blue-green landscape", proposed for the mountains |
| 淡设色 | dàn shèsè | "light colouring": ink with pale washes of colour, the Qingming scroll's manner, proposed for the town |
| 赭石 | zhěshí | red ochre; ours is toned down with ink into "timber brown" |
| 卧游 | wòyóu | "travelling while lying down": journeying through a painting |

### Appendix B: painting details

| Pigment | Deep | Misted | Used for |
|---|---|---|---|
| Azurite | #2C5C8A | #7F9FB8 | peaks; strongest on Home |
| Malachite | #3A806A | #8DB5A4 | slopes, willows, terraces |
| Timber brown (red ochre toned with ink) | #6B5444 | #8F8078 | bridge, boats, timber, earth paths: small areas |
| Ink grey (existing) | #2A3034 | — | tile roofs, outlines |
| Indigo wash (existing) | #3E5664 | — | far ranges, water, clothes |
| Cinnabar (existing) | #B1362B | — | the seal only |

- **Dropped:** ochre glaze #CDB096 (beige) and the lamp (yellow).
- **Strength per scene ("misted"):** Home 0.55, Work 0.40 (hills), Résumé 0.25, Contact 0.2 (indigo), Writing and 404 0. "Rich" is about 0.75.
- **Technique:** the figures are drawn with brush-like strokes once per page, in a background thread, then blended into the painting with the same mist, grain and ink bleed (never pasted on top). LingDong Huang's *{Shan, Shui}\** (MIT, 2018) is a structural reference, studied rather than copied, because its thin line art doesn't match our wash.
- **Sketch faults to fix** (`shots/scenes/sketch-market-v6-zoom.png`):
  - the houses look like clean vector illustration, with identical rows;
  - the bridge is a thin arc, not the scroll's heavy woven-timber arch;
  - the roofs and bridge render beige (they become ink-grey tile and timber brown);
  - the willows are weak;
  - the hut floats;
  - the path reads as dashes.

  The traveller already works.
- **Kitsch rules:** Song-period forms only (gently lifted eaves, open shopfronts, parasol stalls, mat-roofed boats). Seeded variety, broken dry lines, wash instead of outline at a distance, and mist swallowing half the town.
- **What stays from today's background:** the engine, your mountain and crags, the mist, the cool paper and grain, the pan, the low horizon on desktops, Home's closing descent (now on every page), "Still the landscape", and the reduced-motion and no-3D fallbacks.

### Appendix C: round 3's details, one by one

| Detail | Fate |
|---|---|
| Brush-swatch button with ink bloom; dry-brush link underline; brush mark on the current page; seal stamped once per visit | Kept (the wireframes' flat button is only a grey box) |
| The name's ink arrival | Changed: readable at once, with an ink settle of 0.4 s at most |
| Text and figures fading in on scroll (11 on Home) | Gone |
| Wordless mid-page vista (590 px) | Gone, replaced by the closing scene at each page's end |
| Indigo margin notes | Kept in the right margin on wide screens; inline on phones |
| Mist that parts around the mouse | Kept, in the strip's sky only; off on touch screens and for reduced motion |
| Vertical brush timeline (About) | Moves to Résumé's Experience, drawn still |
| Diagrams with "Read as steps" | Move to Work, never taller than a phone screen |
| Sideways pan with mist sweep; "Still the landscape"; returning header | Kept (the header is now solid) |
| Footer painting strip | Becomes the story map |
| `?transition=edge` | Gone (it had the hard edge line) |

### Appendix D: notes for the build (technical)

- **Breakpoints:** phone < 640 px, tablet 640–1199, wide ≥ 1200. Strip heights use `svh` (never `100vh`); viewports under 500 px tall get an 80 px strip and a 48 px header. Safe-area insets apply. Tokens are in `r4/proposal-check/base-v2.css`.
- **Wide geometry at 1440:** a 1200 px frame (x 120–1320). The title block is ≤ 580 px wide (x 120–700). Mist covers the scene from about x 540–820 (computed from the text's right edge), with figures beyond that. Tables and diagrams (960 px) sit below the strip on paper.
- **Painting:** one fixed WebGL canvas (needed for the pan). While the strip is on screen, a scroll uniform moves the scene up 1:1, then hands over to the horizon state.
  - The figures are drawn with Canvas2D into an `OffscreenCanvas` in a worker (Safari 16.4+, 27 Mar 2023), triggered on hover or `pointerdown`, and composited in the present pass with bleed, grain and a mist mask.
  - On browsers without it, they are drawn on the main thread before the pan.
  - The scenes researcher measured 10–13 ms on desktop for this; allow 3–5× on a mid-range phone.
  - Each scene has a focus and a keep-out zone for each width. Phone DPR is capped at 1.5–2.
- **Name:** `clamp(44px, 35px + 2.6vw, 72px)`, never hidden at first paint. LCP target: ≤ 2.5 s at p75 on mobile (now 3.5–5.1 s on localhost).
- **Headings:**
  - h1 page titles: Sofia Sans Condensed 780.
  - h2 and h3: Commissioner 700.
  - The name: Sofia Sans Extra Condensed 900.
- **Structured data:**
  - `ProfilePage` moves to `/`, with `mainEntity` Person: `name` "Qijin Xu", `alternateName` ["Jack Xu", "Qijin (Jack) Xu"], the colour photo as `image`, `jobTitle`, `worksFor` CGI, and `sameAs` LinkedIn and GitHub.
  - Note bylines point to `/`.
  - `/about/` gets a 301 redirect and leaves the sitemap.
- **Photo:** crop the selfie to x 240–2140, y 250–2625 (4:5). Load it eagerly, with a `srcset` at 1–3× in AVIF or WebP, 80 KB or less.

### Appendix E: evidence files (scratchpad only; research screenshots are never published)

Scratchpad root: `/private/tmp/claude-502/-Users-jackxu-Personal-Projects-my-website/6b2ac6ea-3e07-4500-ace8-b814e8aaaede/scratchpad`

- **Research reports** in `r4/`: `layouts.md`, `ia.md`, `scenes.md`, `identity.md`, `audit.md`.
- **Wireframes v2 (matching this spec)** in `r4/proposal-check/`: `home-v2.html`, `work-v2.html`, `base-v2.css`, `paint-v2.js` and `strip.js` (which reuses `r4/sketch/` code).
  - `run-v2.py` measures them with the audit's `measure.js`; results are in `data/*-summary.json`.
  - The first-draft wireframes (`home.html`, `work.html`) and the first draft of this proposal (`proposal-draft1.md`) are kept for reference.
- **Wireframe screenshots** in `shots/director/`: `r4b-home-<size>.png` and `r4b-work-<size>.png` at 1440, 1280, 1024, 768, 390, 375x667, 360 and 844x390, plus `-s2` second screens and `r4b-swatch.png`.
- **Scene sketches** in `shots/scenes/`: `sketch-market-v6.png`, `-v6-zoom.png`, `sketch-phone-390.png`, `sketch-colour.png`, `sketch-home-traveller-1x.png`, `-zoom.png`.
- **Round 3 backgrounds alone:** `shots/audit/sheet-bg-1440.png`.
- **A correction to the research files:** `audit.md` excluded leerob.com from its type sizes, believing its 42 px heading rendered at about 15 px. `shots/layouts/leerob-d-home.png` shows it at about 42 px, as `layouts.md` reports. The 31 px median is unaffected.

### Appendix F: key sources (checked 9 October 2026 unless dated)

- **Reference sites** (all 31 are listed in `layouts.md`):
  - https://www.joshwcomeau.com/css/subgrid/
  - https://architectelevator.com/about
  - https://www.sarasoueidan.com/ (greeting, bio, then the colour headshot beside it; re-checked today)
  - https://eugeneyan.com/ and https://eugeneyan.com/about/
  - https://leerob.com/
  - https://simonwillison.net/
  - https://lilianweng.github.io/
  - https://karpathy.ai/
  - https://brittanychiang.com/
  - https://huyenchip.com/
- **Nielsen Norman Group:**
  - Scrolling and Attention (15 Apr 2018): https://www.nngroup.com/articles/scrolling-and-attention/
  - Homepage Links (reviewed 25 Oct 2024): https://www.nngroup.com/articles/homepage-links/
  - Hamburger Menus (2016): https://www.nngroup.com/articles/hamburger-menus/
  - Sticky Headers (Apr 2021): https://www.nngroup.com/articles/sticky-headers/
- **Google Search Central,** ProfilePage (updated 8 Sep 2026): https://developers.google.com/search/docs/appearance/structured-data/profile-page
- **schema.org,** alternateName: https://schema.org/alternateName
- **WebKit,** Safari 16.4 features (27 Mar 2023): https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- **Baymard,** line length (10 May 2022): https://baymard.com/blog/line-length-readability
- **WCAG 2.2,** target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- **web.dev:**
  - https://web.dev/blog/viewport-units
  - https://web.dev/articles/vitals
- **The paintings:**
  - https://en.wikipedia.org/wiki/Along_the_River_During_the_Qingming_Festival
  - https://en.wikipedia.org/wiki/Wang_Ximeng
  - People's Daily on the pigments (29 Jul 2024): https://paper.people.com.cn/rmrb/html/2024-07/29/nw.D110000renmrb_20240729_2-15.htm
- **LingDong Huang,** *{Shan, Shui}\** (MIT, 2018): https://github.com/LingDong-/shan-shui-inf
