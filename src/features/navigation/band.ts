import { quiet } from '@/features/chrome/still';

/**
 * The header's paper and a page change. While a page is read the header takes its paper as the first sheet reaches
 * it (styles/shell.css, on the page's scroll timeline). A page change starts wherever the old page was read to and
 * lands at the new page's top, where the header stands on the open sky: so for the length of the change the paper is
 * taken off the scroll's clock and eased away, held so, and handed back once the new page is in at its top (where the
 * scroll's clock says the same). One opacity on its own layer. The painting itself needs no such care: it is fixed
 * behind the page and only its travel follows the scroll (the engine's pan and the flight take that over).
 */
export function liftBand(ms = 380): { release(): void; cancel(): void } {
  const none = { release() {}, cancel() {} };
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header || quiet() || typeof header.animate !== 'function') return none;
  let a: Animation;
  try {
    const paper = Number(getComputedStyle(header, '::before').opacity);
    if (!(paper > 0.01)) return none;
    a = header.animate([{ opacity: paper }, { opacity: 0 }], {
      id: 'band-lift',
      duration: ms,
      easing: 'cubic-bezier(.3, .6, .2, 1)',
      fill: 'forwards',
      pseudoElement: '::before',
    });
  } catch {
    return none;
  }
  // it holds until the new page is in (release) and it has got there (finished), whichever comes last
  let released = false;
  let finished = false;
  const drop = () => {
    if (released && finished) a.cancel();
  };
  void a.finished.then(
    () => {
      finished = true;
      drop();
    },
    () => {},
  );
  return {
    release() {
      released = true;
      drop();
    },
    cancel() {
      a.cancel();
    },
  };
}
