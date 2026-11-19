/** What the sweep finds: elements that leave the page's sides, and standalone tap targets under 44 × 44. */
export interface TapsAndOverflow {
  /** Elements whose box leaves [0, innerWidth] unclipped (right: the page scrolls sideways; left: cut off). */
  offenders: Array<{ el: string; left: number; right: number; side: 'right' | 'left' }>;
  /** Standalone targets whose hit area (probed with elementFromPoint) is under 44 × 44. */
  small: Array<{ el: string; name: string; hitW: number; hitH: number }>;
}

/**
 * Run in the page (page.evaluate). First the sideways overflow at the current scroll position, then the tap targets:
 * every visible a[href], button, summary, [role=button], input, select and textarea on the page (the header and the
 * footer included), each brought into view and its hit box probed with elementFromPoint along the two axes through
 * its centre (a pseudo-element's hit area counts). An inline link in a block that also holds running words (a
 * sentence, a byline) is WCAG 2.5.8's inline exception; every other target must reach 44 × 44. The page is scrolled
 * back where it was.
 */
export async function tapsAndOverflow(): Promise<TapsAndOverflow> {
  const vw = innerWidth;
  const vh = innerHeight;
  const startY = scrollY;
  const main = document.querySelector('main');
  if (!main) throw new Error('no <main>');
  const R = (v: number, d = 0) => {
    const k = 10 ** d;
    return Math.round(v * k) / k;
  };
  const styles = new Map<Element, CSSStyleDeclaration>();
  const cs = (el: Element) => {
    let s = styles.get(el);
    if (!s) {
      s = getComputedStyle(el);
      styles.set(el, s);
    }
    return s;
  };
  const isVisible = (el: Element) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  /** Visually hidden: in a .visually-hidden, or inside a clipped box of at most 1.5 × 1.5 px. */
  const srOnly = (el: Element) => {
    for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
      if (e.classList.contains('visually-hidden')) return true;
      const r = e.getBoundingClientRect();
      if (r.width <= 1.5 && r.height <= 1.5 && cs(e).overflow !== 'visible') return true;
    }
    return false;
  };
  const label = (el: Element) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cl = [...el.classList].slice(0, 2);
    if (cl.length) s += '.' + cl.join('.');
    return s;
  };
  /** The nearest block box (not inline, not display: contents) at or above `el`, within <main>'s parent. */
  const blockOf = (el: Element) => {
    for (let e: Element | null = el; e && e !== main.parentElement; e = e.parentElement) {
      const d = cs(e).display;
      if (!d.startsWith('inline') && d !== 'contents') return e;
    }
    return el;
  };
  const LETTER = /[\p{L}\p{N}]/u;

  // ---------------------------------------------------------------- sideways overflow
  const offenders: TapsAndOverflow['offenders'] = [];
  const clipped = (el: Element) => {
    if (cs(el).clipPath !== 'none') return true;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const c = cs(e);
      if (c.overflowX !== 'visible' || c.clipPath !== 'none') return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (el.matches('canvas.landscape, .skip-link, script, style') || !isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (cs(el).position === 'fixed') continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      if (clipped(el) || srOnly(el)) continue;
      offenders.push({
        el: label(el),
        left: R(r.left, 1),
        right: R(r.right, 1),
        side: r.right > vw + 0.5 ? 'right' : 'left',
      });
    }
  }

  // ---------------------------------------------------------------- tap targets
  const sel = 'a[href], button, summary, [role="button"], input:not([type="hidden"]), select, textarea';
  const targets = [...document.querySelectorAll<HTMLElement>(sel)]
    .filter((e) => isVisible(e) && !e.matches('.skip-link') && !srOnly(e))
    .map((e) => ({ e, y: e.getBoundingClientRect().top + startY }))
    .sort((a, b) => a.y - b.y);
  /** An inline target in a block whose words outside any link or button are two or more: judged by the words. */
  const inlineIn = (e: Element) => {
    if (!cs(e).display.startsWith('inline')) return false; // inline, inline-block, inline-flex
    const blk = blockOf(e.parentElement || e);
    if (!blk || blk === e) return false;
    const clone = blk.cloneNode(true) as Element;
    clone.querySelectorAll('a, button, .visually-hidden, [aria-hidden="true"]').forEach((x) => x.remove());
    const rest = (clone.textContent || '').split(/\s+/).filter((t) => LETTER.test(t));
    return rest.length >= 2;
  };
  const small: TapsAndOverflow['small'] = [];
  const header = document.querySelector('.site-header');
  for (const { e } of targets) {
    const rects = [...e.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    // bring it into view: header links at the top; the rest at the middle (scrolling down only keeps the returning
    // header hidden)
    const inHeader = !!header && header.contains(e);
    const want = inHeader ? 0 : Math.max(0, rects[0]!.top + scrollY - vh / 2);
    if (Math.abs(scrollY - want) > 1) {
      scrollTo({ top: want, behavior: 'instant' });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const rr = [...e.getClientRects()].filter((r) => r.width > 0 && r.height > 0)[0]!;
    const cx = rr.left + rr.width / 2;
    const cy = rr.top + rr.height / 2;
    const hit = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
      const h = document.elementFromPoint(x, y);
      return !!h && (h === e || e.contains(h));
    };
    if (!hit(cx, cy)) continue; // (covered: not this sweep's to judge)
    let wL = 0;
    let wR = 0;
    let hU = 0;
    let hD = 0;
    while (wL < 60 && hit(cx - wL - 1, cy)) wL++;
    while (wR < 60 && hit(cx + wR + 1, cy)) wR++;
    while (hU < 60 && hit(cx, cy - hU - 1)) hU++;
    while (hD < 60 && hit(cx, cy + hD + 1)) hD++;
    const hitW = wL + wR + 1;
    const hitH = hU + hD + 1;
    if ((hitW < 44 || hitH < 44) && !inlineIn(e)) {
      const name = (e.getAttribute('aria-label') || e.textContent || (e as HTMLInputElement).value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      small.push({ el: label(e), name, hitW, hitH });
    }
  }
  scrollTo({ top: startY, behavior: 'instant' });
  return { offenders, small };
}
