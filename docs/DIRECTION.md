# Design direction: what Jack has decided

Taste and decisions so far, so a new session (any tool) does not ask again or repeat a rejected idea. Hard rules and
performance live in [AGENTS.md](../AGENTS.md). Only the painting and the hard rules are fixed; this file records what
he has said so far and is open to change when he says otherwise. Update it when he decides something new.

## Fixed

- One giant Chinese ink handscroll is the theme of the whole site; moving between pages travels along it.
- It is real ink painting: never recoloured or themed.

## Decided (2026-11)

- **Type.** Pages are set in the "Ink" pairing: Shippori Mincho B1 500 (`--font-ink`) with Hanken Grotesk
  (`--font-text`). Reading text and painting lettering are two separate jobs for him; the earlier Newsreader, Geist
  and Geist Mono were rejected.
- **Nothing large on the painting.** No big lettering, not his name, no photograph. What belongs in the sky is what a
  real ink painting carries: a small calligraphic inscription with a seal, on Home only (running script, the opening
  of Su Shi's "Ding Feng Bo"). Other pages' skies are bare.
- **A page stands alone.** No "next page" or "more about" links in a page body or the band; the header is the only
  navigation. The footer is a closing line and must not repeat the header or the painting.
- **Ask the painting** lives in the header bar, like a Mac search field (Cmd/Ctrl-K or "/"), as a floating panel.
- **Home** is short and about him, at most two strong components. **About** (`/about/`) holds everything personal and
  shares Home's place on the scroll. The site is not all about work.
- **The body** needs a shared design language (leaves, covers, figures: `src/styles/leaves.css`) with a visual logic
  that guides the reader. Plain paper with hairlines read as empty and dated to him; the art cannot live only in
  the band.
- **The band** must not crowd the words: when reading, it rolls up to a ribbon under a header that takes its paper.
- Writing's design and the Résumé versus Work distinction are still open; Jack directs each page himself, one at a
  time.

## How he works

- Judge beauty yourself; he speaks in feelings, not specs. Treat his whole reaction to the site, not a list of fixes.
- Do not carry old-round principles forward as rules; earlier runs failed by anchoring on stale rules.
- Show a running preview before anything ships; commit only on his yes; never push to `master`.
- Wants runs to go on without pausing at each step, with content from him supplied after the build.
- Spend limit: keep multi-agent fan-outs small; ask before large ones.
