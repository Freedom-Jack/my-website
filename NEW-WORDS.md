# New words waiting for your approval

Everything below is on the pages now, **without** a "DRAFT" label. Each line was written for you, in your voice, and
is yours to keep, change or delete. Say which, and the line in its file changes; nothing else does.

## 1. New in round 7 (the body of every page)

### Ask the painting, re-cut (`content/pages/ask.ts`)

It moved from Home's first screen into the body and lost its other half (a scene that repainted the painting by hour
and weather), so its words changed. The answers themselves are never written by me or by the model: an answer is a
line of your own approved words.

- `label`: Ask the painting
- `tag`: A language model, in your browser
- `placeholder`: What did you build for insurers?
- `go`: Ask
- `hint`: Ask about my work. A small language model runs in your own browser: about 38 MB from this site, the first time. It answers only with my own lines, and nothing you type is sent anywhere.
- `tryLabel`: Try
- `tries` (the three examples): "What did you build for insurers?" · "What are you working on right now?" · "Where did you study?"
- `trace.title`: What the model did
- `trace.loading`: Fetching the model from this site: {got} of {total} MB
- `trace.loaded`: The model: {total} MB, now in your browser
- `trace.read`: Your words: {n} tokens
- `trace.embed`: Turned into {dim} numbers in {ms} ms
- `trace.guard`: A private matter: nothing searched
- `trace.search`: Measured against {n} lines of this site
- `trace.travel`: The painting travels to {place}
- `result.answerNote`: My own words, found by the model, not written by it.
- `result.from`: From
- `result.back`: Bring the painting back
- `result.private`: I keep that off this site. Ask me about the work instead.
- `result.unknown`: Nothing in my words is close enough ({score}, under {floor}), and I would rather not guess.
- `result.unknownMore`: The work pages hold the detail; or write to me.
- `result.error`: The model could not run in this browser. The search on the Work page needs no model.

Gone with the scene half: the placeholder "snow at dusk, the lanterns lit", the two scene examples, "Read as a scene",
"Read as a question", "In it:", "Nothing in it that I can paint yet", "Repainted:", "Back to your own hour" and the
line about what it can paint.

### Work's live pieces (`content/pages/work-craft.ts`, `content/craft/hood.ts`)

"Under the hood" is no longer three folds: its four pieces lie open on Work, and three of them also stand on the
project page they belong to. That needed a few small words.

- `hood.open`: about {kb} KB of data, fetched as you reach it _(was: "…, loaded when opened")_
- `hood.failed`: It did not load. Reload the page to try again. _(was: "Close and open it again.")_
- `lineage.listFold`: Read the record as a list
- `mask.pause`: Pause
- `mask.resume`: Go on
- `eval.every`: Every question and its result
- `eval.running`: Running the {n} questions in your browser…
- `eval.ran`: Run just now, in your browser: {n} questions in {ms} ms.
- `eval.dots`: The questions, one mark each _(read by screen readers only)_
- `eval.first`: right passage first
- `eval.third`: in the top three
- `eval.miss`: missed

### Writing (`content/pages/writing.ts`)

- `read`: Read the note
- `from`: From the note

### Put back, not new

- Home's About me has its second paragraph again ("I’m optimistic about AI because it isn’t floating on hype…"). You
  approved it on 2026-10-16; an earlier round had held it off the page for a 400-word budget that no longer exists.

### Not shown to anyone, but written by me and yours to read

`src/features/ask/questions.ts` files each line of the site under the questions it answers (about 300 questions over
80 lines, such as "Where did you study?" for the "York University" line; and "Do you know X?" for each thing your
skills lines name). A visitor's question is measured against these, and the answer shown is always your own line. A
question about pay, age, family, faith, politics, health, a phone number or a home address is not searched at all
(the `private` line above). This round added the questions for the paragraph put back ("Are you optimistic about
AI?", "Is AI overhyped?" and three more).

How well it answers (measured in the browser on 2026-11-15, on questions I wrote after filing, in other words): of 39
fair questions 33 were answered with the right line, 1 arguably, 5 were turned away; of 50 it cannot answer, 49 were
turned away and 1 ("are you looking for a job") was shown your contact line. Those 89 questions were mine. A list of
the questions you would expect visitors to ask replaces them.

## 2. Lines the live site printed with "DRAFT" (the label is off; the words are unchanged)

- `content/site.ts`: Words on paper and one painting, drawn by code in your browser. No analytics, nothing fetched from a third party, and nothing you type is sent anywhere.
- `content/craft/hood.ts`: At CGI I built a lineage tool that documents where data came from; this is that record for the words of this site.
- `content/craft/hood.ts`: {files} content files fed {passages} passages; the search, the vocabulary and the eval were all built from them at {commit}.
- `content/craft/hood.ts`: The agent for a proprietary language keeps every output inside an EBNF grammar; this is that constraint on a case record, one token at a time.
- `content/craft/hood.ts`: At this step the highest-scored token, {top}, is blocked; of {v} tokens {n} are legal, and {a} and {b} lead.
- `content/craft/hood.ts`: The vocabulary is real (byte-pair tokens learned from these pages at build); the scores are counts of which token follows which in these pages, not a neural model. The mask is the part that carries over: it lets through only what keeps the record valid.
- `content/craft/hood.ts`: The insurance assistant answered from retrieved passages, so retrieval had to be measured; this is the same measure for the search above.
- `content/craft/hood.ts`: On {n} questions the search returns the right passage first {at1} and in the top three {at3}.
- `content/craft/hood.ts`: The questions were written by the site’s author, not Jack; Jack’s own held-out set replaces them. Nothing in the search was tuned on them: BM25’s defaults, a stop list and a score floor fixed beforehand.
- `content/pages/contact.ts`: I read everything and answer within a week.
- `content/pages/case.ts`: internal figure
- `content/pages/case.ts`: Under NDA: the figures here come from my own record of the work.
- `content/pages/home.ts`: Lead AI/ML Architect, CGI AI Center of Excellence, Toronto.
- `content/pages/resume.ts`: Five roles since 2019, two CGI Impact Awards and two cloud certifications: on one page, as a PDF and as JSON.

## 3. Still yours to supply (unchanged from the Vanguard record, DESIGN §12)

- The 20 evaluation questions behind "How good is the search?" on Work (`content/craft/eval.ts`) were written by the
  site's author, not by you. Your own held-out set replaces them. Today the search finds the right passage first on
  half of them and in the top three on 85 %: the page says so, and runs the 20 again in the reader's browser.
