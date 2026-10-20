# Information architecture and content (round 4)

Researcher: IA and content · 9 Oct 2026. I audited the demo at http://localhost:4173/ at 1440×900 and 390×844 (DPR 3) with `cdp.py`, and measured 17 reference sites the same way. Research screenshots are in `scratchpad/shots/ia/`.

## TL;DR

- **The gap is content, not art. Every page tries to do every job.**
  - The six project figures appear on **four pages each** (Home, About, Work, Résumé).
  - About and Résumé repeat the same timeline, skills and credentials.
  - Personal life gets **one sentence on the whole site**.
  - So the personal pages read like a CV, and the CV page reads like a poster.
- **Fix: one job per page, and one home per fact.**
  - **Home:** the 60-second "who is this".
  - **About:** the 5-minute story, plus a kit for organisers.
  - **Work:** the evidence.
  - **Résumé:** the facts.
  - **Writing:** how he thinks.
  - **Contact:** who should write.
  - Other pages carry a one-line teaser and a link.
- **Pages:**
  - Keep Home, Work, About, Résumé, Contact and Writing (Writing joins the nav at three pieces).
  - **Now:** a dated block on Home, not its own page.
  - **Talks:** a section on About from the first real talk.
  - **Open source and side projects:** sections of Work.
  - **Uses, Services:** no.
- **Home link:** put the words "Qijin Xu" next to the 徐 seal, as one visible link. 10 of the 13 reference sites with a header link home from the name or site title.
- **Naming:** the h1 says "Qijin Xu". The first sentence says "Most people call me Jack." About opens with "Hi, I'm Jack." The more personal the page, the more "Jack". "Qijin (Jack) Xu" stays in titles, meta and JSON-LD.
- **Photo:** in colour, directly under the home hero, next to a short hello. Today it sits **5.6 phone screens down** (y = 4,768 px). Karpathy's is at 20 px, Chip Huyen's at 117 px and Raschka's at 946 px.
- **Subpage heroes:** no. Each subpage gets a compact page head: a normal-size h1, one sentence, and real content in the first screen. The painted scene gives each page its identity.
- **Only Jack can supply:**
  - a dated Now
  - the About story in his own voice
  - the game/computer-vision side project
  - "the hard part" of the two flagship cases
  - colour photos
  - who Contact is for
  - any real testimonials

  Section 7 has prompts he can answer in about an hour. I wrote nothing in his voice.

---

## 1. Diagnosis

| Demo, round 3 | Home | About | Work | Résumé | Writing | Contact |
|---|---|---|---|---|---|---|
| Words in `<main>` | 597 | 966 | 1,336 | 694 | 170 | 160 |
| Screens at 1440×900 | 7.0 | 7.2 | 10.3 | 5.5 | 1.3 | 1.5 |
| Screens at 390×844 | 7.8 | 8.8 | **14.3** | – | – | – |
| h1 size, desktop | 294 px | 140 px | 140 px | **200 px** | 140 px | 22 px |
| Words in the first desktop screen | **33** | 85 | 79 | – | – | – |

How many times each fact appears on each page:

| Fact | Home | About | Work | Résumé |
|---|---|---|---|---|
| ~90 % resolution | 1 | 2 | 4 | 3 |
| 321 % fraud lift | 1 | 1 | 3 | 2 |
| CGI Impact Award | 1 | 2 | 1 | 3 |
| Timeline, skills, GPA, certifications | – | all | – | all |
| Games or other personal life | 0 | 1 sentence | 0 | 0 |

Three conclusions:

1. **The pages blur into each other.** "Too much on the about page" covers two pages:
   - Home carries all six projects and a diagram, which is Work's job.
   - About carries the timeline, skills and credentials, which is Résumé's job.
2. **The pages feel sparse because of scale, not word count.** Home has 597 words over 7 screens. Brittany Chiang's landing page has 652 words in 4.3 screens, with **271 words in its first screen**; ours has 33.
3. **Nothing makes it feel lived-in.** There's no "now", no dates except job dates, and a grey photo five screens down. Each site in Section 8 has at least one of these: a dated update list, a personal paragraph, captioned photos or side projects.

## 2. Who visits, and what each must find

| Visitor | Their question | Time | Page that answers |
|---|---|---|---|
| Recruiter (incl. big tech) | Title, seniority, employer, place, keywords; a résumé to forward | ~10 s, then ≤ 2 min (72 % of 753 recruiters spend ≤ 2 min on a résumé) | Home hero → Résumé PDF |
| Engineering hiring manager | *How* does he build: trade-offs, evaluation, guardrails? | 5–10 min on 1–2 cases (blog surveys; weak evidence) | Work, flagship cases |
| Client stakeholder (a CGI client vetting "their" architect) | Has he shipped this in my industry? Is there evidence? | 2–5 min | Work: outcomes and evidence links |
| Conference organiser | Bios in two lengths, a colour headshot, topics, past talks | Copy and paste | About → For organisers |
| Peer | Something to read or reuse; what he's into now | Varies | Writing, In the open, Now |
| Search engines and AI agents | One consistent set of facts; who wrote what | – | Person JSON-LD, ProfilePage on About, bylines linking to About (Google's "Who, How, Why", updated 2026-10-05) |

**Two cautions:**
- **His current employer can read the site.** Signal openness quietly ("happy to talk about…"), never "looking for work".
- **Client work stays generic.**

The data on personal sites is thin and dated:
- Hover (121 people who hire): 86 % visit portfolio sites.
- Profy (2021): 93 % of hiring managers would look, but 51 % say a missing site doesn't hurt.

**A site helps when it can be skimmed in two minutes, and hurts when it slows people down.**

## 3. Proposed sitemap

```
qijinxu.com
├─ /            Home: who I am, the 60-second version        [header: 徐 + "Qijin Xu"]
├─ /work/       Work: what I built, how, and how well        [nav 1]
│   ├─ #how-i-build · six case anchors · #open · #side-projects
│   └─ /work/<case>/   LATER: a flagship gets its own URL past ~800 words (easier to share and rank)
├─ /about/      About: the story + the organiser kit          [nav 2]
├─ /writing/    Writing: notes and essays                     [nav from 3 pieces; until then Home + footer]
├─ /resume/     Résumé: the facts (+ /resume.pdf, /resume.json) [nav 3]
├─ /contact/    Contact: who should write, about what          [nav 4]
└─ /404 · /llms.txt · /sitemap.xml · /robots.txt
```

| Candidate | Verdict | Why |
|---|---|---|
| **Now** | A dated block on Home | A known convention (Derek Sivers, 21 Oct 2015: what you're focused on, and what you're not). A page with four lines would be thin, and an undated one looks abandoned. |
| **Talks** | Not yet | No talks on record. Add a Speaking section on About at the first real talk; give it a page at about three. Chip Huyen and Raschka have talk pages because they have talks. |
| **Open source / Lab** | A section of Work | 8 public repos, mostly 2019–20 coursework. |
| **Side projects** (computer-vision tools for games) | A section of Work, linked from About | The strongest personal touch available, but it needs Jack's material. |
| **Uses / Services** | No | Uses serves only peers. Services doesn't fit a CGI employee. |
| **Contact page** | Keep, if it has a job | Most reference sites use the footer. Jack's Contact also hosts a painted scene, so it must say who should write and why (Q5). |

**Nav:** `[徐 Qijin Xu]  Work · About · Résumé · Contact`, with Writing between About and Résumé from three pieces.
- The seal and the name form one link, with the accessible name "Qijin Xu, home".
- Of the 13 reference sites with a header, 10 link home from the name or site title (Chiang, Huyen, Liu, Raschka, Schmid, Boykis, Shankar, swyx, Comeau, Hohpe). Five also add a "Home" item.

**Fallback:** if Jack can't supply about 300 words of story and a second photo, **merge About into Home** and drop it from the nav. That's the Chiang, Karpathy and Huyen model. One strong page beats a thin About that repeats Home.

## 4. Page by page: what goes where, in what order, and why

### Home: "Who is this, and should I keep reading?"
Budget: 300–450 words, ≤ 3.5 screens on desktop, ≤ 5 on a phone.

1. **Header:** 徐 + "Qijin Xu", then the nav.
2. **Hero, at normal web scale:**
   - h1 **Qijin Xu**
   - Role line: Lead AI/ML Architect · AI Center of Excellence, CGI · Toronto
   - Lede (draft, from existing copy): *"Most people call me Jack. I design and ship production AI: LLM agents, retrieval systems, and the data platforms underneath them."*
   - Two actions: See the work · Résumé.
3. **Hello, with the photo, directly below:**
   - A colour photo beside a 60–90-word first-person intro (the "In brief" bio, rewritten by Jack).
   - A true, personal caption (e.g. "Toronto, 2026").
   - Link: More about me →.
   - On a phone, the photo should arrive within about 1.3 screens.
4. **"What I work on": three problems, each with proof.** Each item has a problem line, one figure, one sentence and a link. Drafted only from existing facts, for Jack to approve:
   - *Assistants that answer from your own knowledge* · ~90 % resolved without a person → RAG assistant
   - *Agents for code nobody documented* · 50 % projected → proprietary-language agent
   - *Data platforms AI can stand on* · 99.9 % uptime, 2 TB → policy-history platform

   Then "All six projects →". Framing skills as problems he solves reads like a person, not a CV.
5. **Now · October 2026** (Jack's words, 3–5 lines, dated, refreshed each quarter).
   - Optionally, a **Recently** list of 3 dated facts: Note, Apr 2025; new role, Jan 2025; Impact Award, 2024.
   - The model is Shreya Shankar's dated "Recent news".
6. **Latest writing:** 1–3 entries, plus the newest public repo once one is featured.
7. **Closing:** one sentence on who should write (Q5), and the email.

**Moves out of Home:**
- The six-row ledger → Work (Home keeps three).
- "How I build" diagram and statement → Work.
- At most one vista (the art lead decides).

### About: "What is he like, and how did he get here?"
Budget: 500–800 words, bios included.

1. **Compact head:**
   - h1 **"Hi, I'm Jack."**
   - Small line: "Qijin Xu · Lead AI/ML Architect at CGI · Toronto"
   - A candid colour photo, if one exists.
2. **The story:** 3–5 short chapters with sub-heads, first person, in Jack's voice.
   - The arc: the York vision lab (hockey) → the data years → when LLMs arrived → what he cares about now.
   - Numbers appear only inside sentences ("nine in ten questions"), never as lists.
3. **Outside work:** games, and the computer-vision tools he builds for them, with a screenshot or GIF.
   - Brittany Chiang's last About paragraph (climbing, cats, video games) and Karpathy's pet projects are what make those pages feel human.
4. *Optional:* **How I like to work**, 3–4 principles in his words.
5. *Only if real:* **Kind words**, 1–3 attributed quotes used with permission (e.g. from LinkedIn recommendations).
   - Eugene Yan does this. Never turn paraphrase into a quote.
6. **For organisers and press:**
   - A short bio (~50 words) and a long one (~120), third person, each with a Copy button.
   - Colour headshot downloads.
   - Speaker guides ask for 50/100/250-word bios and 2–3 photos. Eugene Yan and Gregor Hohpe both offer this.
   - Build it only if Jack wants invitations.
7. **Next steps:** Projects → Work · Full timeline → Résumé · Write to me.

**Moves out of About:** the timeline, the skills and "Education and credentials". All three already exist in full on Résumé.

### Work: "What has he built, and how well did it work?"
This is the long page, so it gets an index.

1. **Compact head:** h1, one sentence, then the **At a glance** table, visible in the first screen. The table is the index.
2. **How I build:** the statement line and the generic diagram, moved from Home. It frames every case.
3. **Two flagship cases**, each in this order:
   - **TL;DR** first (problem → what I did → result) with its figure, following NN/g's inverted pyramid.
   - Context · What I did.
   - **The hard part** (Jack's words: one decision or trade-off, and how he checked it). This is what hiring managers read for, and the least CV-like paragraph on the site.
   - Outcome · Evidence · Stack · diagram.
4. **More work:** four compact cases. On phones, show the title, figure and one line, with `<details>` for the rest. That takes Work from 14.3 screens to about 9–10.
5. **In the open:** unchanged.
6. **Side projects:** the game tools, once supplied.
7. **End:** Résumé · Contact.

### Résumé: "Give me the facts"
A document, two printed pages.

- **Compact head:** name at normal heading size (not 200 px), title, contact line, then View résumé (PDF) and JSON. All of it fits in the first screen.
- **Body:** Summary · Experience (dated) · Skills · Education · Certifications and awards (with verification links once supplied).
- **No hero, no vista.** This page is the **only** home of the timeline, the skills and the credentials.

### Writing: "How does he think?"
Unchanged: it joins the nav at three pieces. Each entry shows its date, kind, title and one line. Bylines link to About.

Topic seeds for Jack to write (prompts only):
- EBNF-constrained output on an unfamiliar language
- what makes a RAG assistant resolve questions on its own
- LLM root-cause hints on top of OpenLineage
- from data engineer to AI architect
- computer-vision tools for games

### Contact: "Should I write, and how?"
Budget: 80–150 words.

- h1, then **one sentence on who should write** (Q5).
- The email, large, with Copy.
- LinkedIn and GitHub.
- Time zone.
- 2–3 "good reasons to write", in Jack's words.
- The PDF.

**Footer, every page:** name and role · email · GitHub · LinkedIn · PDF · all pages · "Updated <month year>".

## 5. Should subpages have a hero?

**No. Give them a compact page head.**

| | Demo today | References (desktop) | Proposal |
|---|---|---|---|
| h1 size | 140–200 px, often one word ("About", "Work") | 24–82 px (Yan 24, Raschka 29, Hohpe 34, Chiang 48, Comeau 64, Appleton 82) | About 40–56 px desktop, 32–40 px phone |
| Page head height | 506–617 px of 900 (56–69 %); phone 431–611 of 844 (51–72 %) | First paragraph of real content at 95–444 px | Real content starts by about 35 % of the first screen |

**Why:**
- NN/g (Apr 2018) found 57 % of viewing time above the fold, and 74 % in the first two screens. It advises keeping the top for high-priority content.
- A subpage visitor has already chosen the page, so give them its content.
- Home is the one true hero, because it carries the identity test.

**How each page still feels distinct:**
- Jack's narrative scenes (a market on Work, and so on) can sit as a painted band behind or above the compact head. The art does the hero's emotional job without pushing content down.
- The heads should differ in content, not just in title:
  - Work opens on its index table.
  - About opens on a greeting and a photo.
  - Résumé opens on a document header.
  - Contact opens on the email.

That answers "hero looks the same".

## 6. Informational, not CV-like

1. **One job per page, one home per fact.** Elsewhere, a teaser and a link. This also stops facts drifting apart (the graduation date already has).
2. **Lead with the point.** Every block opens with its takeaway.
3. **Match the form to the content:**
   - prose for the story
   - tables for facts
   - one figure per outcome
   - dated lists for things that change
4. **Specific beats impressive:** tools, places, dates and numbers, not adjectives.
5. **Vary the object on every screen:** photo, figure, diagram, list, quote. Rhythm comes from changing the type of content, not its size.
6. **Date things:** Now, Recently, Writing, "Updated". The site feels lived-in, and search engines and AI agents can see the freshness.
7. **Small doses of the person:** a photo caption, the Now, the games, the side project.
8. **End every page with the next step.**

## 7. Content inventory

| Item | Status | Goes to | Who |
|---|---|---|---|
| Name, title, CGI unit, Toronto, email, GitHub | ✅ | Header, footer, JSON-LD | – |
| LinkedIn URL | ⚠️ two candidates | Footer, Contact, Résumé | Jack confirms |
| 6 projects with figures, context, stack and evidence; 2 public sources | ✅ | Work (full), Home (3), Résumé (bullets) | – |
| 3 diagrams | ✅ | Work | – |
| Experience, skills, education, certifications, award | ✅ (graduation pending) | **Résumé only** | Jack: graduation date and honour |
| Résumé PDF and JSON; 4 early repos | ✅ | Résumé; Work | – |
| One Note (~400 words) | ✅ (typos pending) | Writing | Jack: title and typos |
| Home bio (56 words), positioning line, statement line | ⚠️ **AI-drafted** | Home, Work | Jack rewrites or approves |
| About story (~200 words) | ⚠️ **AI-drafted**; e.g. "data, latency, labelling and patience" is our voice, not his | About | **Jack writes** |
| 3 problem framings; third-person bios | 🆕 can be drafted from facts only | Home; About | Jack approves |
| **Now** (3–5 dated lines) | ❌ | Home | **Jack** |
| **Games and computer-vision game tools** | ❌ one line; the old site said "avid gamer" and "assistant tools" mixing computer vision, ML and gameplay analytics | About + Work | **Jack: what they are, which games, a screenshot, a repo?** |
| **"The hard part"** of the 2 flagships | ❌ | Work | **Jack**, within confidentiality |
| Colour photos (headshot + 1–2 candid) | ⚠️ one low-light selfie; reshoot planned | Home, About, organiser kit | Jack |
| Who the site is for (Q5) | ❌ | Home closing, Contact, About | **Jack decides** |
| Testimonials, talks | ❌ none known | About | Only real ones; otherwise omit |
| Credential verification links | ❌ | Résumé, JSON-LD | Jack |
| 2 more writing pieces | ❌ | Writing (nav at 3) | Jack |

**Prompts for Jack.** Plain sentences are fine; we edit lightly and show him the result.

- **Now:**
  - What are you building at work (one public-safe line)?
  - What are you learning?
  - What are you playing?
  - What are you open to?
- **About:**
  - How did you get into computer science?
  - One moment from the hockey lab.
  - What did data engineering teach you that LLM builders miss?
  - What do you care about most in AI now?
  - What do you do outside work?
  - What surprises people about you?
- **Each flagship case:**
  - The hardest decision, and what you chose.
  - Something that didn't work.
  - How you measured success.
  - Your role and the team's size.
  - What you'd do differently.

## 8. Eight sites to borrow from (layout and IA only, not the art)

| Site | Borrow this |
|---|---|
| [Brittany Chiang](https://brittanychiang.com/) | The engineer's landing page. Name, title, one line and nav stay put. About is three paragraphs; the last is personal and mentions video games. Then dated experience, projects, writing and "View full résumé". 652 words in 4.3 screens; 16 px body text. |
| [Andrej Karpathy](https://karpathy.ai/) | Photo at the very top and a one-line tagline. Then a short bio, timeline, talks, teaching, pet projects and a misc list. The oddities make it human. |
| [Eugene Yan](https://eugeneyan.com/about/) | Home: a one-paragraph hello, then dated lists. About: photo, first-person intro, timeline, **real attributed testimonials**, and a **third-person bio with photo downloads**. That's the organiser kit. |
| [Sebastian Raschka](https://sebastianraschka.com/) | "Hello, I'm…", then a modest 200 px photo just under it, the intro and recent articles. Talks get their own page because he has them. |
| [Shreya Shankar](https://www.sh-reya.com/) | Photo, bio, and a dated **"Recent news"** list. The model for Home's Now and Recently. |
| [Gregor Hohpe, Architect Elevator](https://architectelevator.com/) | An enterprise architect's framing: a photo beside what he connects, then Blog, Books, Talks and Contact. About has a short bio and three photos (speaking, headshot, active). |
| [Josh W. Comeau, About](https://www.joshwcomeau.com/about-josh/) | About as a **story**, with captioned candid photos and personal trivia. The career is told as prose, not a list. |
| [Chip Huyen](https://huyenchip.com/) | A home page under two phone screens: photo, bio, nav. Events exists only because there are events. Short is fine when the depth lives elsewhere. |

## 9. Open questions for Jack

1. **Who should write to you:** hiring, speaking, mentoring, collaboration or consulting? This decides the Home closing, Contact and the organiser kit.
2. **Will you write the About story and the Now** from the prompts? If not, should we merge About into Home?
3. **The game computer-vision tools:** can you show them (screenshot, GIF or repo)? Which games?
4. **Testimonials:** do you have LinkedIn recommendations you'd quote, with permission?
5. **Talks:** have you given any internal CGI talks, meetups or guest lectures?
6. **Flagships:** may you describe "the hard part" at a generic level?
7. **Photos:** after the reshoot, can you add one or two candid colour shots?
8. Still pending: graduation date and honour, the LinkedIn URL, credential verification links, and the Note's title and typos.

---

## Sources

Fetched 9 Oct 2026 unless dated.

- NN/g, Scrolling and Attention (T. Fessenden, 15 Apr 2018): https://www.nngroup.com/articles/scrolling-and-attention/
- NN/g, Inverted Pyramid (11 Feb 2018): https://www.nngroup.com/articles/inverted-pyramid/
- Google, Creating helpful, reliable, people-first content ("Who, How, and Why"; updated 2026-10-05): https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google, ProfilePage structured data (updated 2026-09-08): https://developers.google.com/search/docs/appearance/structured-data/profile-page
- Derek Sivers, The /now page movement (21 Oct 2015): https://sive.rs/nowff · https://nownownow.com/about
- Zety recruiter survey (753 recruiters), via https://recruitingheadlines.com/72-of-recruiters-spend-2-minutes-or-less-on-resumes/
- Hover portfolio study (121 respondents, undated): https://hover.blog/online-portfolio-site-importance/
- Profy.dev hiring-manager survey (6 Aug 2021): https://profy.dev/article/portfolio-websites-survey
- Speaker bios and headshots: https://speakerflow.com/the-ultimate-speaker-profile-template-with-examples/ · https://www.ttisi.com/blog/how-to-write-a-speaker-bio/
- Reference sites measured with cdp.py:
  - https://brittanychiang.com/
  - https://karpathy.ai/
  - https://eugeneyan.com/ · /about/ · /speaking/
  - https://sebastianraschka.com/
  - https://www.sh-reya.com/
  - https://architectelevator.com/ · /about/
  - https://www.joshwcomeau.com/about-josh/
  - https://huyenchip.com/ · /events/
  - https://maggieappleton.com/about
  - https://martinfowler.com/aboutMe.html
  - https://hamel.dev/
  - https://jxnl.co/
  - https://leerob.com/
  - https://www.philschmid.de/
  - https://vickiboykis.com/
  - https://www.swyx.io/
  - https://simonwillison.net/about/
- Internal: `design-demo/COPY.md` (draft 2, 8 Oct 2026); `src/content/pages/about.ts` (old site, "Beyond Code"); `scratchpad/analysis/purpose.md`.
