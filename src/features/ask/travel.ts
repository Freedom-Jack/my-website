import { quiet } from '@/features/chrome/still';
import { landscape } from '@/features/landscape/store';
import { currentMain, placeOf } from '@/features/landscape/targets';

/**
 * The painting travels to the place that holds an answer (or a chosen passage) and back to the page's own place:
 * only where the live engine is on (1200 px and wider, after its probe) and motion is allowed. Elsewhere nothing
 * moves, and the caller is told so (the trace then claims nothing).
 * While the painting is away, what the page has inscribed in its sky (its title, the next place's name) is let
 * fade: those words belong to the page's own place, not to the one the painting is showing.
 */
interface Target {
  stretch: number;
  u: number | null;
}

/** Closer than this to the page's own view (stretches) is no journey: the place is already in the band. */
const NEAR = 0.12;

let away = false;

const live = () =>
  !!landscape.get() && document.documentElement.getAttribute('data-live') === 'on' && !quiet() && innerWidth >= 1200;

function inscribed(on: boolean, at = 260) {
  for (const el of document.querySelectorAll<HTMLElement>('.inscription')) {
    el.style.transition = at ? `opacity ${at}ms` : '';
    el.style.opacity = on ? '' : '0';
  }
}

/** Resolves true when the painting has set out for the place. */
export async function travelTo(t: Target): Promise<boolean> {
  const h = landscape.get();
  const main = currentMain();
  if (!h || !main || !live()) return false;
  let to = t.stretch;
  if (t.u !== null) {
    const { cameraFor } = await import('@/features/landscape/engine');
    if (landscape.get() !== h || currentMain() !== main) return false;
    to = cameraFor(t.stretch, t.u, 'wide');
  }
  if (Math.abs(to - placeOf(main).stretch) < NEAR) {
    comeHome(); // (the page's own view: the painting is, or comes, home)
    return false;
  }
  away = true;
  inscribed(false);
  go(to);
  return true;
}

/** One pan, the whole way however far (no splice, no mist bank), a little longer for each stretch beyond the first. */
function go(to: number) {
  const h = landscape.get();
  if (!h) return;
  let far = 0;
  try {
    far = Math.max(0, Math.abs(to - (Number(h.stats().stretch) || 0)) - 1);
  } catch {
    far = 0;
  }
  void h.panTo(to, { duration: 700 + 180 * far, ease: 'cubic-out', cloud: false });
}

/** The painting returns to the page's own place (when it had left it). */
export function comeHome() {
  if (!away) return;
  away = false;
  inscribed(true);
  const h = landscape.get();
  const main = currentMain();
  if (h && main) go(placeOf(main).stretch);
}

/** A page change is taking the painting on from where it stands (features/navigation): nothing to bring back. */
export function forget() {
  if (away) inscribed(true, 0);
  away = false;
}
