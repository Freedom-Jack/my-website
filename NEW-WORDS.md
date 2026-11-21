# New words waiting for your approval

Everything in sections 1 to 8 is on the site now, written for you, in your voice. Each line is yours to keep, change
or delete. Say which, and the line in its file changes; nothing else does.

**new** marks words written or changed in the redesign. Lines without it were on this list before and still wait.
In the files, the words are marked `NEW WORDS (for Jack)` or `DRAFT`.

## 1. Every page: Ask the painting (`content/pages/ask-door.ts`, `content/pages/ask.ts`)

It is no longer a section on Home. It is a door in the header ("Ask") and a line in the tail, and it opens a sheet
under the painting. It answers in three steps and says which one answered: a filed question gets your line at once,
with no model; anything else is searched by word and shown as places, not as your answer; a model reads the
question only when the visitor asks for that. An answer is never written by me or by a model: it is a line of your
own words.

The door and the tail:

- `label` (`ask-door.ts`): Ask the painting
- **new** `door` (`ask-door.ts`): Ask
- **new** `invite`: Ask the painting about my work, for example:
- `tailTry` (the tail's example, one of the three below): What are you working on right now?

The sheet:

- `placeholder`: What did you build for insurers?
- `go`: Ask
- **new** `close`: Close
- **new** `hint`: Ask about my work. An answer is always one of my own lines from these pages, and nothing you type
  is sent anywhere.
- `tryLabel`: Try
- `tries` (the three examples): **new** "Have you built a chatbot?" · "What are you working on right now?" · "Where
  did you study?"

The trace (`trace`), where {braces} are the run's real numbers:

- **new** `title`: How it was found
- **new** `words`: These pages: {n} lines, {kb} KB
- **new** `filed`: A filed question: no model needed
- **new** `lexical`: Searched by word, no model: {n} passages in {ms} ms
- **new** `loading`: Fetching a sentence-embedding model from this site: {got} of {total} MB
- **new** `loaded`: A sentence-embedding model: {total} MB, now in your browser
- `read`: Your words: {n} tokens
- `embed`: Turned into {dim} numbers in {ms} ms
- `guard`: A private matter: nothing searched
- `search`: Measured against {n} lines of this site
- **new** `closest`: The closest scored {score}; the floor is {floor}
- `travel`: The painting travels to {place}

The answers (`result`):

- `answerNote`: My own words, found by the model, not written by it.
- **new** `filedNote`: My own words. This question was filed under them ahead of time.
- `from`: From
- `private`: I keep that off this site. Ask me about the work instead.
- `unknown`: Nothing in my words is close enough ({score}, under {floor}), and I would rather not guess.
- `unknownMore`: The work pages hold the detail; or write to me. _(the words are the same; "The work pages" and
  "write to me" are now links)_
- **new** `nearest`: The nearest places
- **new** `places`: Where your words appear
- **new** `closer`: Read closer
- **new** `closerCost`: These are places, not an answer. For one, a small model reads your question in your own
  browser: about 38 MB from this site, the first time.
- **new** `error`: The model could not run in this browser. The places above need no model.
- **new** `failed`: These pages did not load. Try again.

Moved here from Work's search box, unchanged: `trace.count` "{n} close matches", `trace.one` "1 close match",
`trace.none` "No close match", `result.none` "No close match in these pages."

## 2. Home (`content/pages/home.ts`)

- `first.title` (the line under your name, in the painting): Lead AI/ML Architect, CGI AI Center of Excellence,
  Toronto.

Nothing else on Home is new: its words are the ones on the live site, set in a new layout. The section about your
current role prints the résumé's own lines.

## 3. Work and the project pages (`content/pages/work.ts`, `content/pages/case.ts`)

- **new** `work.ts` `index.more` (the way from each of the two large entries to its page): The case
- **new** `work.ts` `diagram.steps` (the fold under every drawing; the words were in the code before): Read as steps
- `case.ts` `basis.internal`: internal figure
- `case.ts` `nda`: Under NDA: the figures here come from my own record of the work.

## 4. Under the hood (`content/pages/work-craft.ts`, `content/craft/hood.ts`)

The three live pieces now stand on their project pages, not on Work: "Constrain the output" on the agent's, "How
good is the search?" on the insurance assistant's, "Where the words came from" on the data operations'. Writing
lists the three with their first lines.

- `work-craft.ts` `hood.open`: about {kb} KB of data, fetched as you reach it
- `work-craft.ts` `hood.failed`: It did not load. Reload the page to try again.

Where the words came from (`hood.ts` `lineage`):

- `tie`: At CGI I built a lineage tool that documents where data came from; this is that record for the words of
  this site.
- `result`: {files} content files fed {passages} passages; the search, the vocabulary and the eval were all built
  from them at {commit}.
- `listFold`: Read the record as a list

Constrain the output (`hood.ts` `mask`):

- `tie`: The agent for a proprietary language keeps every output inside an EBNF grammar; this is that constraint on
  a case record, one token at a time.
- `result`: At this step the highest-scored token, {top}, is blocked; of {v} tokens {n} are legal, and {a} and {b}
  lead.
- `what`: The vocabulary is real (byte-pair tokens learned from these pages at build); the scores are counts of
  which token follows which in these pages, not a neural model. **new** Left to those counts the record would come
  out valid and untrue, so each step takes this case’s own next token and shows what the grammar would have allowed.
  _(the new sentence ends here)_ The mask is the part that carries over: it lets through only what keeps the record
  valid.
- **new** `strip`: The five highest-scored tokens at this step, the five best legal ones, and the record’s own next
  token _(the last clause is new)_
- **new** `next`: Take the next token _(it was "Take the best legal token")_
- **new** `own`: the record’s next token _(read by screen readers only)_
- `pause`: Pause
- `resume`: Go on

How good is the search? (`hood.ts` `eval`):

- **new** `tie`: The insurance assistant answered from retrieved passages, so retrieval had to be measured; this is
  the same measure for this site’s own search. _(it ended "for the search above")_
- `result`: On {n} questions the search returns the right passage first {at1} and in the top three {at3}.
- `author`: The questions were written by the site’s author, not Jack; Jack’s own held-out set replaces them.
  Nothing in the search was tuned on them: BM25’s defaults, a stop list and a score floor fixed beforehand.
- `every`: Every question and its result
- `running`: Running the {n} questions in your browser…
- `ran`: Run just now, in your browser: {n} questions in {ms} ms.
- `dots`: The questions, one mark each _(read by screen readers only)_
- `first`: right passage first
- `third`: in the top three
- `miss`: missed

The pieces' other small labels in `hood.ts` ("The record so far", "Inside", "legal", "blocked", "Start again", "The
grammar", the table's column names and the like) are the live site's, unchanged, and were never on this list.

## 5. Writing (`content/pages/writing.ts`)

- `read`: Read the note
- `from`: From the note

## 6. Résumé (`content/pages/resume.ts`)

- **new** `title` (the place's name in the painting; the nav's own word): Résumé
- **new** `gpa` (the words were in the code before): GPA {score}

## 7. Contact (`content/pages/contact.ts`)

- **new** `bio.label` (over your portrait and the third-person line): Bio
- `response`: I read everything and answer within a week.

## 8. The tail of every page (`content/site.ts`)

- **new** `tail.colophon`: Words on paper and one painting, drawn by code. No analytics, nothing fetched from a
  third party, and nothing you type is sent anywhere. _(it said "drawn by code in your browser"; on phones and
  tablets the painting is now a picture cut ahead)_

## 9. Not shown to anyone, but written by me and yours to read

`src/features/ask/questions.ts` files each line of the site under the questions it answers: 207 questions over 77
lines, such as "Where did you study?" for the "York University" line. The build adds "Do you know X?" and "Have you
used X?" for each thing your skills and stack lines name. A visitor's question is measured against these, and the
answer shown is always your own line. A question about pay, age, family, faith, politics, health, a phone number or
a home address is not searched at all (the `private` line above). This file did not change in the redesign.

The link-preview cards (what a shared link shows) each carry a sentence for people who cannot see them, put
together in `tools/build-og.ts`: "Work · Qijin Xu: the page's title inscribed in the sky of an ink-wash painting of
a river town at its arched bridge." The five scenes are named: Home "blue peaks above a sea of mist in the morning
light", Work "a river town at its arched bridge", Writing "a still lake with a small pavilion under a pine", Résumé
"terraced fields stepping down to the river", Contact "a ferry at the jetty on open water". A project's card says
"a project by Qijin Xu", a note's "a note by Qijin Xu".

How well the model step answers was measured in the browser on 2026-11-15, on questions I wrote after filing, in
other words, and has not been measured again since: of 39 fair questions 33 were answered with the right line, 1
arguably, 5 were turned away; of 50 it cannot answer, 49 were turned away and 1 ("are you looking for a job") was
shown your contact line.

## 10. Gone, with the things they belonged to

- **The held scroll** is removed, and its seven words with it (`content/site.ts` `scroll`): "Open the scroll",
  "Close", "The scroll", "Hold the painting: drag it, use the arrow keys, or choose a place. Esc closes it.",
  "level", "high", "deep". Nothing prints "DRAFT · " any more.
- **Home's Ask section** is removed. Gone with it: `tag` "A language model, in your browser", `result.back` "Bring
  the painting back", the earlier `hint` (the one that named the 38 MB model), the earlier `trace.title` "What the
  model did", the earlier `trace.loading` and `trace.loaded` ("the model"), and the earlier `result.error`, which
  pointed at the Work page's search.
- **Work's search box** is removed, and its words are deleted from `content/pages/work-craft.ts`: the label "Search
  these pages", the placeholder "lineage, 99.9%, EBNF, hockey", "Search", the status lines about the index, the
  keyboard hint, "show the place", "hide the place", "matched". Four of its lines moved into Ask (section 1).
- **Work's "Under the hood" block** is removed (the pieces are on the project pages). Its link words `hood.caseLink`
  "the case" became Work's `index.more` "The case".
- **The table in "In the open"** is now a plain list. Its labels are deleted (`content/pages/work.ts` `open`):
  "Featured", "Recent", "Early public repositories", "Year", "Repository", "What it is", "Updated".
- **The Résumé's one-sentence summary for the page before it** (`line`: "Five roles since 2019, two CGI Impact
  Awards and two cloud certifications: on one page, as a PDF and as JSON.") is deleted; nothing printed it.
- **Home's first-screen action** "See the work" is no longer shown: the way on is the next place's name, inscribed
  in the painting. The words are gone from `content/pages/home.ts`.

Retired on 2026-11-20 (Home is now only who you are and Now; these were yours and approved, and are kept here in
case you want them back):

- the first screen's counted proof: "About 90% of questions resolved without a person, for **50,000+** users of an
  insurance support assistant." with "2023 to 2024 · the case"
- "What I work on": Assistants that answer from your own knowledge · Agents for code nobody documented ("An agent
  that documents legacy code in a proprietary language and pulls out its business rules, projected to cut manual work
  by **50%**.") · Data platforms AI can stand on ("**99.9%** uptime on Canada’s largest auto-insurance policy-history
  database, 2 TB on SQL Server.") · "All six projects →"
- "Say hello": "For collaborations on production AI, or an invitation to speak or write about agents and retrieval,
  email me at qxjack@gmail.com. I’m also on LinkedIn and GitHub."
- every way on at a page's end: "Downstream", "All six projects →" on a case, "More about Qijin" on a note; the
  footer's "Ask the painting about my work, for example:" and its map's "All pages"

## 11. Still yours to supply

- The 20 evaluation questions behind "How good is the search?" (`content/craft/eval.ts`; the piece is on the
  insurance assistant's page) were written by the site's author, not by you. Your own held-out set replaces them.
  Today the search finds the right passage first on half of them and in the top three on 85 %: the page says so,
  and runs the 20 again in the reader's browser.

## 12. Facts and decisions that need your word

- Home's new section about your current role prints the résumé's lines, so "TD Bank’s compliance SBU" is now on
  Home as well as on the Résumé and in `/llms.txt`. RBC is named on the Résumé, on the data-operations project page
  and in `/llms.txt`, as before.
- Contact now shows the third-person line about you (`content/site.ts` `bio`) under "Bio". No page printed it
  before; the search and Ask read it.
- "Constrain the output", on the agent's project page, used to pick its own tokens, and stepped to the end it wrote
  `"status": "shipped"` and a nonsense figure on a project that is in progress. It now writes that project's own
  record (`"status": "in progress"`, "Projected 50%") and shows what the grammar would have allowed at each step.
  The words that say so are in section 4.
- Two first lines were written for the project page and are now also read on Writing: the mask's "on a case record"
  and the eval's "this site’s own search".
- "Where the words came from" names the search's node "Ask the painting" (it was "Search these pages").
- In Ask, once the 38 MB model is in the browser, a typed question is read by it straight away, without "Read
  closer" being pressed again.
- The painting: the terraces (Résumé) carry two trees in pink blossom, and the ferry scene (Contact) has two far
  birds. Both are on your list of dislikes.
- The painting: the framing willow boughs over Work and Writing are switched off (`boughs` in
  `src/features/landscape/elements.ts`), because a bough that framed one first screen would hang in the middle of
  the band's sky.

## 13. Second round (2026-11-20): the inscriptions, About, and what moved

**The painting's inscription** (`content/inscriptions.ts`; the calligraphy is drawn as artwork in
`public/inscriptions/home.svg`, never typed as text). One line, on Home only: the opening of Su Shi's "Ding Feng Bo"
(Calming the Waves), 1082, your choice. The English beside it is my own translation and waits for your yes.

- read aloud (pinyin): mò tīng chuān lín dǎ yè shēng, hé fáng yín xiào qiě xú xíng
- **new** English on the page: Never mind the rain beating through the leaves. Why not sing out, and walk on slowly?
- **new** the credit under it: Su Shi, 1082
- **new** the artwork's text alternative: Chinese calligraphy, with a red seal (followed by the pinyin)

**About** (`content/pages/about.ts`; your own paragraphs are still `home.ts` `about`, unchanged):

- **new** the nav's word: About
- **new** search title: Qijin (Jack) Xu · About
- **new** search description: About Qijin (Jack) Xu, Lead AI/ML Architect at CGI in Toronto: what he builds, why he is
  optimistic about AI, and what he does away from the keyboard.
- **new** the facts' heading and labels: In brief · Goes by · Based in · Studied · Awards · Certified
- Preview only, never on the site: "Waiting for your words" and its three lines, where your own facts will stand.

**Home** now shows only: your name, the title line, "I design and ship production AI…", and Now (its lead is your sentence "Right now I’m leading an agent…"; then Building, Exploring and Off-hours, the line
that was held back before). Nothing new was written.

**No longer shown anywhere**: see section 10, "Retired on 2026-11-20".

**Still yours to supply**: the 5 to 10 things about yourself you are happy to publish (places you have been,
interests, a line or two). They go on About and can replace or join Home's "Now".
