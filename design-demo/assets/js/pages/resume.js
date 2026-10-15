// pages/resume.js — the résumé's one behaviour (a page module, SPEC-R4A §10.3): settle before print.
//
// The PDF is printed from this page (tools/build-pdf.py; also any ⌘P), so just before printing:
//   - anything still animating inside the page (a route change's enter, an ink bloom) is finished, so nothing
//     prints half-faded (pages/resume.css also turns animation off in @media print);
//   - a link marked data-print-href (the site's own address in the letterhead) points at that public address
//     while printing, so the PDF never carries the demo server's address; it is restored after printing.
// Headless Chrome's --print-to-pdf fires beforeprint too (checked 10 Oct 2026). "View résumé (PDF)" is a plain
// link and needs no script.
//
// No side effects at import. main.js calls init() on load and after a route swap, destroy() before the next
// swap; the listeners are registered with the swap's signal and also removed by destroy().

let off = null;

export default {
  init({ main, signal }) {
    if (off) return;
    const swapped = [];
    const before = () => {
      for (const a of main.getAnimations({ subtree: true })) {
        try { a.finish(); } catch { /* an infinite or idle animation: leave it */ }
      }
      for (const link of main.querySelectorAll('a[data-print-href]')) {
        if (link.dataset.screenHref !== undefined) continue;
        link.dataset.screenHref = link.getAttribute('href');
        link.setAttribute('href', link.dataset.printHref);
        swapped.push(link);
      }
    };
    const after = () => {
      for (const link of swapped.splice(0)) {
        link.setAttribute('href', link.dataset.screenHref);
        delete link.dataset.screenHref;
      }
    };
    addEventListener('beforeprint', before, { signal });
    addEventListener('afterprint', after, { signal });
    off = () => {
      removeEventListener('beforeprint', before);
      removeEventListener('afterprint', after);
      after();
    };
  },
  destroy() {
    off?.();
    off = null;
  },
};
