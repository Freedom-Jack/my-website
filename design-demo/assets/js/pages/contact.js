// pages/contact.js — "Copy email": copies the address, then stamps the confirmation in ink (SPEC-R4A §10.4).
// A page module: no side effects at import; main.js calls init() on load and after a route swap, and
// destroy() before the next swap.
//
//   <button class="ink-btn" type="button" data-copy="qxjack@gmail.com">…Copy email…</button>
//   <span class="contact__stamp" role="status" data-copied="Copied"></span>
//
// The stamp is also the live region: it is empty at rest, and the word is written into it on every
// copy, so screen readers hear "Copied" each time. It lands (CSS: contact-stamp), rests ~2.4 s, then
// lifts back into the mist and empties. If the clipboard is unavailable, the address is selected
// instead so it can be copied by hand (and nothing claims it was copied).
// Without JS the button is hidden (pages/contact.css); the address stays a mailto link.

const REST_MS = 2400;
const LIFT_MS = 640;

async function writeClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  const before = document.activeElement;
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  } finally {
    // selecting the helper moved focus: give it back (a keyboard user stays on "Copy email")
    if (before instanceof HTMLElement && before.isConnected && document.activeElement !== before) before.focus({ preventScroll: true });
  }
}

let teardown = null;

export default {
  init({ main, signal }) {
    if (teardown) return;
    const button = main.querySelector('[data-copy]');
    const stamp = main.querySelector('.contact__stamp');
    const address = main.querySelector('.contact__email a');
    if (!button || !stamp) return;

    const word = stamp.dataset.copied || 'Copied';
    let rest = 0;
    let lift = 0;
    let raf = 0;
    let dead = false;

    const clear = () => {
      stamp.classList.remove('is-stamped', 'is-lifting');
      stamp.textContent = '';
    };
    const stampIt = () => {
      clearTimeout(rest);
      clearTimeout(lift);
      cancelAnimationFrame(raf);
      clear();
      // next frame: a fresh text node (announced again) and a fresh animation (stamped again)
      raf = requestAnimationFrame(() => {
        stamp.textContent = word;
        stamp.classList.add('is-stamped');
        rest = setTimeout(() => {
          stamp.classList.replace('is-stamped', 'is-lifting');
          lift = setTimeout(clear, LIFT_MS);
        }, REST_MS);
      });
    };

    const onClick = async () => {
      const ok = await writeClipboard(button.dataset.copy);
      if (dead) return;                                          // the page left while the clipboard answered
      if (ok) { stampIt(); return; }
      if (address) getSelection()?.selectAllChildren(address);   // let the reader copy it by hand
    };
    button.addEventListener('click', onClick, { signal });

    teardown = () => {
      dead = true;
      button.removeEventListener('click', onClick);
      clearTimeout(rest);
      clearTimeout(lift);
      cancelAnimationFrame(raf);
      clear();
    };
  },
  destroy() {
    teardown?.();
    teardown = null;
  },
};
