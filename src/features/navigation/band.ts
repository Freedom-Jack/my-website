import { quiet } from '@/features/chrome/still';

/**
 * The band and a page change. While a page is read the band's size follows the page's scroll (styles/band.css: it
 * settles as the page leaves its top). A page change starts wherever the old page was read to and lands at the new
 * page's top, where the band stands at full size: so for the length of the change the band is taken off the scroll's
 * clock and eased from where it stands to full size, held there, and handed back once the new page is in at its top
 * (where the scroll's clock says full size too). One transform on one layer: the compositor's.
 */
export function liftBand(ms = 380): { release(): void; cancel(): void } {
  const none = { release() {}, cancel() {} };
  const band = document.querySelector<HTMLElement>('.band');
  if (!band || quiet() || typeof band.animate !== 'function') return none;
  let z = 1;
  try {
    z = new DOMMatrixReadOnly(getComputedStyle(band).transform).a || 1;
  } catch {
    return none;
  }
  if (Math.abs(z - 1) < 0.004) return none;
  const a = band.animate([{ transform: `scale(${z})` }, { transform: 'scale(1)' }], {
    id: 'band-lift',
    duration: ms,
    easing: 'cubic-bezier(.3, .6, .2, 1)',
    fill: 'forwards',
  });
  // it holds full size until the new page is in (release) and it has got there (finished), whichever comes last
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
