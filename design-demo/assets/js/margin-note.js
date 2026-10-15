// margin-note.js — glossary notes beside the text they explain (SPEC-R4A §9.8).
//
//   import { initMarginNotes } from '/assets/js/margin-note.js';
//   const destroy = initMarginNotes(main);
//
//   <p>… vLLM-served models …</p>
//   <aside class="margin-note small" id="note-vllm" aria-label="Note: vLLM">
//     <p><b class="margin-note__term">vLLM:</b> An open-source engine for serving large language models.</p>
//   </aside>
//
// The aside comes right after the paragraph it annotates (source order = reading order).
//   >= 75rem  it sits in the right rail of its .has-rail block, beside its paragraph (layout.css,
//             components.css); the note is simply shown.
//   <  75rem  a toggle, "Note: {term}" (the term from .margin-note__term, without its colon), opens it inline
//             right after its paragraph: <button class="margin-note__toggle" aria-expanded aria-controls>
//             and <div class="margin-note__body" id="{id}-body" hidden>. It re-lays across 75rem on resize,
//             keeping each note's open/closed state.
// Two or more notes in a row (after one paragraph) are grouped in one <div class="margin-notes">, so they share
// that paragraph's grid row instead of pushing the next paragraph down.
// No hover behaviour anywhere. Without JS the aside shows inline after its paragraph, always open.
// Idempotent; destroy() puts the markup back exactly as it was.

const WIDE = '(min-width: 75rem)';   // the rail exists from here (SPEC-R4A §9.8; round 3: 64rem)
const bound = new WeakSet();
let seq = 0;

function build(aside) {
  bound.add(aside);
  if (!aside.id) aside.id = `margin-note-${++seq}`;
  const term = (aside.querySelector('.margin-note__term')?.textContent || '').replace(/:\s*$/, '').trim();

  const body = document.createElement('div');
  body.className = 'margin-note__body';
  body.id = `${aside.id}-body`;
  body.append(...aside.childNodes);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'margin-note__toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', body.id);
  btn.textContent = term ? `Note: ${term}` : 'Note';

  const onClick = () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
  };
  btn.addEventListener('click', onClick);
  aside.append(btn, body);
  return { aside, btn, body, onClick };
}

function layout(note, wide) {
  note.btn.hidden = wide;
  note.body.hidden = !wide && note.btn.getAttribute('aria-expanded') !== 'true';
}

function unbuild({ aside, btn, body, onClick }) {
  btn.removeEventListener('click', onClick);
  aside.append(...body.childNodes);
  btn.remove();
  body.remove();
  bound.delete(aside);
}

/** Wrap runs of adjacent notes in one .margin-notes cell; returns the undo. */
function group(asides) {
  const groups = [];
  const seen = new Set();
  for (const a of asides) {
    if (seen.has(a)) continue;
    const run = [a];
    let next = a.nextElementSibling;
    while (next && next.matches('aside.margin-note') && asides.includes(next)) { run.push(next); next = next.nextElementSibling; }
    run.forEach((n) => seen.add(n));
    if (run.length < 2 || a.parentElement?.classList.contains('margin-notes')) continue;
    const box = document.createElement('div');
    box.className = 'margin-notes';
    a.before(box);
    box.append(...run);
    groups.push(box);
  }
  return () => { for (const box of groups) { box.replaceWith(...box.children); } };
}

export function initMarginNotes(root = document) {
  const asides = [...root.querySelectorAll('aside.margin-note')].filter((a) => !bound.has(a));
  if (!asides.length) return () => {};
  const mq = matchMedia(WIDE);
  const ungroup = group(asides);
  const notes = asides.map(build);
  const apply = () => { for (const n of notes) layout(n, mq.matches); };
  apply();
  mq.addEventListener('change', apply);
  return () => {
    mq.removeEventListener('change', apply);
    notes.forEach(unbuild);
    ungroup();
  };
}
