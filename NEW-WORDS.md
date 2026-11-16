# New words waiting for your approval

Everything below is on the pages now, **without** a "DRAFT" label. Each line was written for you, in your voice, and
is yours to keep, change or delete. Say which, and the line in its file changes; nothing else does.

## 1. Ask the painting (new this round; `content/pages/ask.ts`)

The line on Home, its hint, its examples, and every sentence its trace and its answers can show. The answers
themselves are never written by me or by the model: an answer is a line of your own approved words.

- `label`: Ask the painting
- `placeholder`: snow at dusk, the lanterns lit
- `go`: Ask
- `hint`: Describe a scene, or ask about my work. A small language model runs in your own browser: about 38 MB from this site, the first time. Nothing you type is sent anywhere.
- `tryLabel`: Try
- `loading`: Fetching the model from this site: {got} of {total} MB
- `loaded`: The model: {total} MB, now in your browser
- `read`: Your words: {n} tokens
- `embed`: Turned into {dim} numbers in {ms} ms
- `routeScene`: Read as a scene ({scene} to {question})
- `routeQuestion`: Read as a question ({question} to {scene})
- `scene`: In it: {found}
- `sceneNone`: Nothing in it that I can paint yet
- `guard`: A private matter: nothing searched
- `search`: Closest of {n} lines of this site: {score}
- `travel`: The painting travels to {place}
- `scene`: Repainted: {labels}.
- `sceneBack`: Back to your own hour
- `sceneUnknown`: I can paint the hour, the weather and the lamps. Try “snow at dusk”, or “a moonlit night”.
- `answerNote`: My own words, found by the model, not written by it.
- `from`: From
- `back`: Bring the painting back
- `private`: I keep that off this site. Ask me about the work instead.
- `unknown`: Nothing in my words is close enough ({score}, under {floor}), and I would rather not guess.
- `unknownMore`: The work pages hold the detail; or write to me.
- `error`: The model could not run in this browser. The search on the Work page needs no model.
- `tries` (the three examples): "snow at dusk, the lanterns lit" · "What did you build for insurers?" · "a moonlit night"

Not shown to anyone, but written by me and yours to read: `src/features/ask/questions.ts` files each line of the
site under the questions it answers (about 200 questions over 75 lines, such as "Where did you study?" for the
"York University" line; and "Do you know X?" for each thing your skills lines name). A visitor's question is
measured against these, and the answer shown is always your own line. A question about pay, age, family, faith,
politics, health, a phone number or a home address is not searched at all (the `private` line above).

How well it answers (measured in the browser, 2026-11-15, on questions I wrote after filing, in other words): of 39
fair questions 33 were answered with the right line, 1 arguably, 5 were turned away; of 50 it cannot answer, 49
were turned away and 1 ("are you looking for a job") was shown your contact line. Those 89 questions were mine. A
list of the questions you would expect visitors to ask replaces them.

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
  site's author, not by you. Your own held-out set replaces them.
