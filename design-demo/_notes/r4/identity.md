# Identity, photo, hero, navigation and mobile (round 4 research)

Covers Jack's points 3, 3.1, 3.2 and 4. Research only: nothing in the repo or `design-demo/` was changed.
Measured 9 Oct 2026 with `cdp.py` at a true 390 px phone (DPR 3) and at 1440 px desktop. Screenshots: `shots/identity/`. Throwaway sketch: `r4/sketch-identity.html` (`?view=photo`, `?view=mobile`, `?view=sub`).

## TL;DR

1. **Name.** The h1 becomes **Qijin Xu**. "Jack" moves out of the name and into the voice of the site: the first words under the photo are the line already in COPY.md, *"I'm Qijin Xu, and most people call me Jack."* (drafted from his résumé; Jack hasn't approved the bio yet) The rule is **Qijin for the name, Jack for the voice**. Search still finds "Qijin (Jack) Xu": it stays in `<title>`, the meta description and the JSON-LD `alternateName`, but never in visible text (one exception, the résumé, is a question for Jack).
2. **"About page only clickable on the icon".** He's right. The seal is the only link home, and it is 38×38 px, below the 44 px touch guideline. **Put a visible "Qijin Xu" wordmark next to the seal, as one link.** Keep the four links visible on phones too (no hamburger menu). It fits in one row down to 360 px wide (measured).
3. **Home hero: keep it, but make it smaller and shorter.** Today the name is **195 px tall on a phone and 294 px on desktop**. The personal sites I measured use 24–48 px, and the most art-led ones (Lynn Fisher, Maggie Appleton) use 82–96 px. Without "(Jack)", the name fits on one line. **Proposal: about 86 px on phones and 164 px on desktop.** The hero drops from a full screen to about **85% of one**, so the top of the photo shows on the first screen.
4. **Photo: directly below the hero, in colour, as a 4:5 rectangle.** Today it sits **4,768 px down on a phone** (5.6 screens), small and grey, with a "Name · City" caption. That is literally the layout of an obituary photo. Fix: full colour with only a light grade, a crisp edge with a hairline, no caption, no vignette, no mist. With the current selfie, keep it modest (about 250 px wide on a phone, 300 px on desktop), and go bigger after the reshoot. A reshoot brief is in §4.
5. **Subpages: no hero.** Use a **compact page head**: a short band of that page's own painting with no words on it, then a normal-size title (36–40 px on phones, 56–72 px on desktop) and one sentence. None of the 8 inner pages I measured (7 sites) opens with a full-screen title hero. The band gives each page a visibly different scene, which answers "every background looks the same" without adding size.
6. **Mobile.** There is a one-page spec in §7. In short: 17 px body text, 44 px touch targets, a 56 px header that comes back when you scroll up (with a solid background), `svh` units, the photo loaded immediately rather than lazily, and a speed budget. The demo's first paint is already slow: 2.4 s, unthrottled, on localhost. Jack has parked speed work for later, so that is a flag only.

---

## 1. What is actually wrong today (measured)

| | Demo now (390 px phone) | Demo now (1440 desktop) |
|---|---|---|
| Hero name | "Qijin (Jack) Xu", **195 px** type, 2 lines, **307 px tall** (36% of the screen) | **294 px** type |
| Subpage title | 61 px, head block 362–388 px tall | **140 px**, head 422 px, lead paragraph 27 px |
| Way home | 徐 seal only, **38×38 px**, label "Qijin (Jack) Xu, home" | same |
| Photo | **grey + multiply**, 152×203 px, at **4,768 px** (5.6 screens down), lazy-loaded, captioned "Qijin (Jack) Xu · Toronto, Canada" | 216×288 px at 4,596 px |
| "(Jack)" in visible text | hero, photo caption and alt text, footer on all 8 pages, Note byline, Note author line, résumé h1, Contact LinkedIn label | |
| Returning header | its computed background is **transparent**, so when it comes back it would sit on top of body text. In my headless capture it didn't paint at all, although it responded to clicks. Worth a QA check. | |

To be fair to the demo: on a phone the subpage heads are not the main problem, because the first Work project already shows within the first screen. The "huge, PowerPoint" feeling comes from three things: the home name, the desktop display sizes (140–294 px), and every page opening the same way (giant title over the same mountains).

## 2. The name: "Qijin Xu", with Jack in the voice

### Why "(Jack)" in the middle felt wrong
A nickname in brackets between the given and family names reads like a form or an ID card, and it splits his real name. The same pattern repeats in the photo caption and the footer, so the site reads as a record about him rather than his own voice.

### How people with two names handle it (real sites, checked 9 Oct 2026)

| Pattern | Real example | Fit for Jack |
|---|---|---|
| **The intro sentence** | Steph Ango, stephango.com/about: "I'm Steph. You may also know me as kepano." Patrick McKenzie, kalzumeus.com/about: "My name is Patrick McKenzie (better known as patio11…)". swyx.io/about, from someone with English and Chinese names: "'swyx' is the initials of my English and Chinese names. You can call me Shawn, too." | **Best.** COPY.md already has the line "I'm Qijin Xu, and most people call me Jack." (pending Jack's OK on the bio). |
| **A say-it line under the greeting** | swyx.io/about, under "Hey, I'm swyx.": "Pronounced 'swicks'. Shawn works too." (small italic) | Good add-on. Many English readers will say "Q" as in "queen". A small pronunciation line, plus "Jack" as the easy option, is both kind and useful. The wording must be Jack's (see questions). |
| **A signature** | Painting convention: the artist's inscription plus the seal sign the work. Jack's site already has the seal. | Tasteful *only* in Jack's real handwriting: a scanned "Jack" closing the intro or the Contact page. Never a script font pretending to be handwriting. |
| **Title-only brackets (for search)** | dhh.dk: `<title>` is "David Heinemeier Hansson (DHH)", while the page shows the full name in big type. | **Yes, for search:** keep "Qijin (Jack) Xu — …" in `<title>`, the description and `og:title`. |
| Nickname in the middle | swyx.io home h1: "Shawn @swyx Wang". Wikipedia style: Jen-Hsun "Jensen" Huang. | **No.** It works for a brand handle, not a nickname. It is exactly what Jack rejected. |

### Recommendation: two registers
- **Name register (formal), "Qijin Xu":** the h1, the header wordmark, the footer ("© 2026 Qijin Xu"), the Note byline and author line, and the photo alt text ("Qijin Xu in a red sweater"). The photo caption goes entirely.
- **Voice register (personal), "Jack":** the first sentence under the photo, the "More about Jack →" button that already exists, the Contact page's tone, and his handles (qxjack, Freedom-Jack), which already say Jack. This is what makes Jack *coherent*: Qijin is who he is, Jack is what you call him.
- **SEO:** Google's ProfilePage documentation (updated 2026-09-08) says `name` is for the real name and `alternateName` is for other identifiers. Change `Person.name` from "Qijin (Jack) Xu" to **"Qijin Xu"**, with `alternateName: ["Jack Xu", "Qijin (Jack) Xu"]` and the same `givenName` and `familyName`. swyx does the same: `name` "Shawn Wang", `alternateName` "swyx". Give `Person.image` the colour photo, ideally in 1:1, 4:3 and 16:9 crops, as Google recommends.
- **Seal link:** the seal and the wordmark become one link, named "Qijin Xu, home". The seal is marked decorative (`aria-hidden`).

## 3. Home hero: keep the look, shrink the scale

Jack likes the hero: keep its composition, landscape, ink arrival and buttons. Change two numbers.

**1. Name size.** "Qijin Xu" is 2.36× as wide as its type size (measured in Sofia Sans Extra Condensed 900). At 195 px it would still need two lines. Proposed token: `--step-name: clamp(5.25rem, 3.6rem + 7.4vw, 11rem)`, which gives **≈ 86 px at 390** (one line, about 205 px wide) and **≈ 164 px at 1440**. That is still twice the next-largest type on the site, so it stays the signature moment. Even art-led sites stay well under it: Lynn Fisher's display name is 96 px and Maggie Appleton's statement 82 px. Name-led personal sites use 34–48 px (Karpathy 34, swyx 38, Sara Soueidan 36, Brittany Chiang 48). A calmer option if Jack wants it: 72 px on phones and 120 px on desktop.

**2. Hero height: 100svh down to about 85svh**, with the top 40–60 px of the photo overlapping the foot of the landscape. Nielsen Norman Group lists full-screen heroes as a main cause of the "false floor", where the first screen looks like the whole page. They advise letting the next content show above the fold. Their eye-tracking found 57% of viewing time above the fold and 74% in the first two screens (2018). A real face above the fold is the strongest possible "there's more, and it's a person" cue.

In the phone sketch (`shots/identity/sketch-mobile-0.png`), the name, role, sentence and buttons fill the top 330 px, the landscape takes the band below, and the photo starts at about 725 px. Safari's browser bars hide part of the 844 px, so size the hero in `svh` and let the photo overlap it.

Home then stops "looking the same": it becomes the only page with a person in it.

## 4. The photo: just below the hero, alive

### Why it read as a memorial photo
Five cues stacked up. (1) It was grey. (2) The multiply blend made it look like a faded print. (3) It was a small, straight-edged, ID-sized rectangle. (4) It had a "Name · Place" caption underneath, which is the obituary format. (5) The selfie itself is frontal and unsmiling, with flat light and a white wall, which reads as an ID photo. Colour fixes 1 and 2, placement and size fix 3, dropping the caption fixes 4, and the reshoot fixes 5.

### Placement, size and shape (evidence)
- **Right after the intro is a proven pattern.** On sarasoueidan.com the "Hi, I'm Sara." intro is followed by a full-colour **351×527 px** rectangle on phones; on desktop it sits beside the intro at 414×622. Josh Comeau (About page) and Sara (About page) both lead with a large colour photo. NN/g's eye-tracking found that portraits of real people hold attention: on one team page, a test user spent 10% more time on the photos than on bios that took 316% more space. Decorative or stock images get ignored.
- **Rectangle, not circle.** Circles read as a social-media avatar (Karpathy 240 px, Chip Huyen 124 px, Eugene Yan, Lea Verou). On Jack's selfie a circle also cuts off the red sweater, which is the photo's best colour (sketch panel 4). A **4:5 rectangle with a 2–3 px corner** reads as a portrait print and sits well with the painting.
- **Layout.**
  - Desktop: the photo on the left axis (A), about 300 px wide now and 360 px after the reshoot. The greeting and two or three plain sentences go on the wider B axis, then "More about me →". This is asymmetric, so no 50/50 split.
  - Phone: the photo is about 72% of the column (≈ 252×315) now, and the full column (≈ 350×438) after the reshoot. The greeting goes below it.
  - Don't enlarge the current selfie beyond this: large sizes magnify its weaknesses.

### Treatment
- **Full colour.** Apply a light grade to the file itself rather than with CSS: saturation −8 to −12%, contrast −4%, the wall lifted toward the paper colour (#EFF1EE), skin kept warm.
- **A crisp edge:** a 1 px inside hairline at about 10% ink. The pale wall is almost the paper colour, so without an edge the photo dissolves and turns into the "floating head" that round 3 banned.
- **No vignette.** I did not render one, so this is judgement rather than a test: a darkened or faded edge reads as vintage or memorial, which is the very thing Jack disliked. Also no blur, no mist, no multiply, no caption.
- **The red sweater is now an asset.** It echoes the cinnabar seal. If the palette opens up to colour (Jack's point 3.1), this photo becomes the first warm colour under the hero.
- I tried **the seal pressed onto the photo's corner** (sketch panel 5). It reads as a stamp or a passport. Skip it.
- **Technical:** once the photo is on the first screen, switch it from `loading="lazy"` to eager loading (web.dev advises against lazy-loading anything in the first view). Keep the `width` and `height` attributes, and serve AVIF/WebP at 1×, 2× and 3× (about 40–80 KB).

### Best crop of the current selfie (`public/images/selfie.jpg`, 2320×3088)
Use a 4:5 crop of **x 240–2140, y 250–2625** (1900×2375). It trims the ceiling corner at top right, keeps a little headroom above the hair and the sweater's neckline, and puts the eyes about 46% down. Its limits are fixed in the file: a low arm's-length angle, flat window-less light, a white wall and a neutral mouth. That is why it should stay modest in size.

### Reshoot brief (one page for whoever takes it)
- **Someone else takes it**, not a selfie. Camera at eye level or slightly above, from 1.5–2 m, using the phone's 2× or portrait lens (about 50–85 mm equivalent).
- **Soft daylight** from the side (a window at 45°, or open shade outdoors). No flash, no overhead light. Tilt the head slightly to avoid reflections in the glasses.
- **A real smile**, mid-conversation, eyes to camera. Take a few frames looking slightly off-camera for the About page.
- **Background a few metres behind**, mid-toned and uncluttered: stone, greenery, water, or a bookshelf out of focus. Its colours should echo the site (ink grey, blue-green, ochre). Not a white wall.
- **Solid clothes, no logos.** Bring the red top (it ties to the seal) and one neutral (indigo, charcoal).
- **Shoot vertical and horizontal**, head-and-shoulders and waist-up, with room for 4:5, 1:1 and 16:9 crops.
- Deliver a 2400 px long edge in sRGB. The swap is still one file.

## 5. Subpages: a compact page head, not a hero

**Answer to "should subpages have a hero?": no.** The only big head I found, Josh Comeau's About page, is a photo of the person, which is content rather than decoration. Measured subpage heads:

| Site · page | Title (phone / desktop) | Where the first paragraph starts on desktop |
|---|---|---|
| maggieappleton.com/about | 48 / 82 px | 444 px |
| sarasoueidan.com/about | 48 / 48 px | 475 px (photo first) |
| joshwcomeau.com/about-josh | 64 / 64 px | 402 px |
| lynnandtonic.com/about | 48 / 48 px | 256 px |
| swyx.io/about | 33 / 36 px | 266 px |
| **Demo, Work** | **61 / 140 px** | lead paragraph at 27 px |

**Proposed page head** (the same structure on every subpage, but a different scene on each):
1. **A scene band** of that page's own painting, with no words on it: about 18–24svh on phones (≈ 130–170 px) and 28–34vh on desktop. In the one-canvas architecture this is just layout: the head leaves the top part free of text and veil, so the panned landscape shows through. The art researcher decides what each band shows (the market for Work, and so on). This is where "each page has its own background" becomes visible at a glance.
2. **Title:** 36–40 px on phones and 56–72 px on desktop, in the condensed face.
3. **One sentence** saying what the page is (Work already has one), at 17–20 px and at most 60 characters a line.
4. **Content begins on the first screen:** the first item by about 400 px on phones and about 520 px on desktop.

Lynn Fisher's About page is the model for "art-directed but compact". It has a chapter numeral, a 48 px title and a small portrait, and the prose starts at 256 px. The sketch `shots/identity/sketch-sub-0.png` shows the head at 390 px with two Work projects on the first screen.

## 6. Navigation

- **The identity link:** the seal plus "Qijin Xu" (Commissioner 700, 16 px), top left, as one link, ≥ 44 px tall and about 96 px wide. The visible name makes the home link obvious, and it pairs with the seal the way a painter's signature does.
- **Links stay visible on phones.** NN/g's test of hidden versus visible navigation found that hiding the nav cut discoverability by more than 20%, and on mobile made tasks 15% slower than a partly visible layout (2016). With four links (Work · About · Résumé · Contact, plus Writing when it returns), they advise showing them.
  - Measured in the sketch: wordmark plus four links at 15 px with 14 px gaps fit in one row at **390 px with 21 px to spare**.
  - At **360 px** they fit with no slack, so below 375 px use 14 px links, 10 px gaps and a 24 px seal.
  - Below 340 px, wrap into two rows.
- **No hamburger and no bottom tab bar.** Four words don't need hiding (and the menu buttons on Josh Comeau's and Maggie Appleton's sites are only 32×32 px). A bottom bar is an app pattern: on iOS it stacks on Safari's bottom toolbar and the home indicator, adding a second strip of chrome over a reading site.
- **Returning header:** keep the round-3 behaviour (hides on scroll down, returns on scroll up). This is the "partially persistent" header NN/g recommends (2021): a small upward scroll triggers it, it slides in over 300–400 ms, and it is **opaque**. So give it a paper background and a hairline when it is pinned, and make it **56 px** tall on phones (69 now). With reduced motion, it appears without the slide.
- **Current page and footer:** keep the brush mark under the current link. The footer repeats the name, every link, the email and "View résumé (PDF)" in 44 px rows.
- **If the content research merges About into Home** (Jack thinks of home as his "about me" page), the identity link *is* the "About" link, and that makes the visible wordmark even more necessary.

## 7. Mobile-first spec (phone first, then scale up)

**What the best mobile personal sites share** (measured at 390, DPR 3): body 16–18 px at 1.5–1.75 line height (leerob 17/27, Brittany Chiang 16/26, Eugene Yan 16/27); 16–28 px gutters; one column; the name within the top 300 px; content and often a photo on the first screen (Sara, Karpathy, Chip Huyen). Weak spots worth not copying: 32 px menu buttons (Comeau, Maggie) and 19 px-tall text links (Simon Willison).

| Area | Spec |
|---|---|
| Test sizes | 360×780, 375×667, **390×844**, 430×932, 768×1024, and phone landscape 844×390; no horizontal scroll at 320 |
| Gutters | 20 px (16 px at ≤ 360); `env(safe-area-inset-*)` in landscape |
| Type | Body 17 px / 1.6. Small print ≥ 14 px. Lead 19–20 px. h2 24–28 px. Page title 36–40 px. Home name ≈ 86 px. Figures capped at 44 px on phones (now up to 84) |
| Touch targets | 44×44 px for the nav, buttons and identity link (Apple's 44 pt; WCAG 2.5.5 AAA). Nothing under 24×24 px (WCAG 2.5.8 AA). Links inside sentences are exempt |
| Header | One row, 56 px, opaque when it returns, hides on scroll down |
| Hero | One-line name, ≈ 85svh (never `100vh`: on iOS it overflows behind the toolbars), 48 px-tall buttons, photo peeking |
| Layout changes | All axes collapse to one column (already done). Tables become stacked label rows (Work does this well already). Margin notes go inline after their paragraph. Diagrams fit within one screen, with "Read as steps" directly under them (fixes the parked "very tall diagrams" item) |
| Photo | 4:5, eager loading, `srcset` 1×–3× AVIF/WebP, ≤ 80 KB at 3× |
| Painting on phones | Cap the canvas pixel ratio at 1.5–2, pause it when off-screen or in a hidden tab, and respect reduced motion and Save-Data. Text never waits for the painting |
| Speed budget | Google's "good" Core Web Vitals at the 75th percentile on mobile: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 |

**A speed flag (parked by Jack's rule, so not to start now).** These were single unthrottled runs: the demo on localhost, the others over the live internet.

| Site | Largest paint (LCP) |
|---|---|
| Demo | **3.5 s** with reduced motion (the seal glyph); **5.1 s** with motion (the name's ink arrival). First paint 2.4 s. |
| Sara Soueidan | 1.4 s |
| leerob | 1.6 s |
| Josh Comeau | 1.6 s |
| Maggie Appleton | 2.2 s |
| Karpathy | 2.6 s (3.9 MB of images) |

The likely causes are the seal font loaded with `display=block` and the arrival animation holding back the biggest text. Worth putting on the performance backlog.

## 8. What I would not do
- Put "Jack" anywhere inside the name, in brackets, quotes or a smaller weight.
- Use "Jack Xu" as the h1. His real name is Qijin, and he said so.
- Make the photo a circle avatar, add a vignette, dissolve it into mist, or caption it with name and city.
- Give subpages a full-screen hero or a 140 px title.
- Use a hamburger menu or a bottom tab bar for four links.

---

## Sources
Measured by me with `cdp.py` on 9 Oct 2026 at 390×844 DPR 3 and 1440×900 (one run each; numbers can drift as sites change): leerob.com · brittanychiang.com · joshwcomeau.com (+ /about-josh/) · maggieappleton.com (+ /about, /garden) · karpathy.ai · simonwillison.net · swyx.io (+ /about) · huyenchip.com · paco.me · rauno.me · eugeneyan.com (+ /about/) · sarasoueidan.com (+ /about/) · antfu.me · lynnandtonic.com (+ /about/) · emilkowal.ski · lea.verou.me · craigmod.com (+ /about/) · frankchimero.com · robinsloan.com. Name examples quoted from stephango.com/about, kalzumeus.com/about, swyx.io/about (and its JSON-LD), and dhh.dk (`<title>`), all fetched 9 Oct 2026.

- NN/g, *Hamburger Menus and Hidden Navigation Hurt UX Metrics* (Jun 2016): https://www.nngroup.com/articles/hamburger-menus/
- NN/g, *Sticky Headers: 5 Ways to Make Them Better* (Apr 2021): https://www.nngroup.com/articles/sticky-headers/
- NN/g, *The Illusion of Completeness* (Jan 2016): https://www.nngroup.com/articles/illusion-of-completeness/
- NN/g, *Scrolling and Attention* (2018 data): https://www.nngroup.com/articles/scrolling-and-attention/
- NN/g, *Photos as Web Content* (2010, reviewed Aug 2026): https://www.nngroup.com/articles/photos-as-web-content/
- Google Search Central, *ProfilePage structured data* (updated 2026-09-08): https://developers.google.com/search/docs/appearance/structured-data/profile-page
- W3C, *Understanding SC 2.5.8 Target Size (Minimum)*: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html, and *2.5.5 Target Size (Enhanced)*: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Apple HIG (44×44 pt minimum hit target): https://developer.apple.com/design/human-interface-guidelines/accessibility. Confirmed through secondary sources, e.g. https://dequeuniversity.com/rules/attest-ios/1.0/touch-target-size
- web.dev, *Web Vitals* (updated Oct 2024): https://web.dev/articles/vitals
- web.dev, *The large, small, and dynamic viewport units* (updated Nov 2022): https://web.dev/blog/viewport-units
- web.dev, *Browser-level image lazy loading* (updated Aug 2024): https://web.dev/articles/browser-level-image-lazy-loading
- UConn Center for Career Readiness, *Navigating Preferred Versus Legal Name* (Dec 2023; a résumé is not a legal document, so a preferred name is fine): https://career.uconn.edu/blog/2023/12/04/navigating-preferred-versus-legal-name-in-the-workplace/
