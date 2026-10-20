// disclosure.js — details that fold to their summary so a long page stays short (SPEC-R4A §9.9).
//
//   import { initDisclosure } from '/assets/js/disclosure.js';
//   const destroy = initDisclosure(main);
//
//   <details class="case case--compact" id="fraud-model" data-collapse="always" open>
//     <summary class="case__summary">…</summary> …
//   </details>
//
// data-collapse = "always": folded at every width (Work's "More work": the four compact cases open on tap
//                           everywhere, so the page is not "huge"; fixer, 10 Oct)
//                 "phone":  folded below 40rem only (open from 40rem)
// In the HTML every such <details> is open, so the page is complete with JS off. This module closes them at boot
// (where their rule applies), except the one that is (or contains) the URL's hash target (an arrival from another
// page, e.g. /work/#fraud-model, lands on an open case). It opens the target on hashchange; reopens a "phone" one
// it closed when the viewport grows past 40rem (and closes it again below it, unless the reader has toggled one:
// then that one is the reader's); opens every one on beforeprint and puts them back after.
// The summary's "Show details" / "Hide details" affordance is CSS only (components.css).
// Idempotent; destroy() reopens everything it closed.

const PHONE = '(max-width: 39.99rem)';
const bound = new WeakSet();

const targetOf = () => {
  if (!location.hash) return null;
  try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return null; }
};
const holds = (d, el) => !!el && (el === d || d.contains(el));

export function initDisclosure(root = document) {
  const all = [...root.querySelectorAll('details[data-collapse="phone"], details[data-collapse="always"]')].filter((d) => !bound.has(d));
  if (!all.length) return () => {};
  all.forEach((d) => bound.add(d));
  const mq = matchMedia(PHONE);
  const managed = new Set(all);     // the ones this module opens and closes (until the reader toggles one)
  let busy = false;                 // our own changes (their toggle events are not the reader's)

  const set = (d, open) => {
    if (d.open === open) return;
    busy = true;
    d.open = open;
    // 'toggle' fires asynchronously: mark this change as ours until it has been delivered
    d.dataset.disclosureOwn = '1';
    queueMicrotask(() => { busy = false; });
  };
  const apply = () => {
    const target = targetOf();
    for (const d of managed) set(d, (d.dataset.collapse === 'phone' && !mq.matches) || holds(d, target));
  };
  const onToggle = (e) => {
    const d = e.currentTarget;
    if (d.dataset.disclosureOwn) { delete d.dataset.disclosureOwn; return; }
    if (!busy) managed.delete(d);   // the reader's choice from now on
  };
  const onHash = () => {
    const target = targetOf();
    for (const d of all) if (holds(d, target)) set(d, true);
  };
  let printed = [];
  const beforePrint = () => { printed = all.filter((d) => !d.open); printed.forEach((d) => set(d, true)); };
  const afterPrint = () => { printed.splice(0).forEach((d) => set(d, false)); };

  all.forEach((d) => d.addEventListener('toggle', onToggle));
  mq.addEventListener('change', apply);
  addEventListener('hashchange', onHash);
  addEventListener('beforeprint', beforePrint);
  addEventListener('afterprint', afterPrint);
  apply();

  return () => {
    all.forEach((d) => { d.removeEventListener('toggle', onToggle); bound.delete(d); delete d.dataset.disclosureOwn; });
    mq.removeEventListener('change', apply);
    removeEventListener('hashchange', onHash);
    removeEventListener('beforeprint', beforePrint);
    removeEventListener('afterprint', afterPrint);
    for (const d of all) if (!d.open) d.open = true;
  };
}
