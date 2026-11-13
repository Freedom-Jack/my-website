'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './contact.module.css';

/**
 * "Copy email": copies the address and says "Copied" beside the button, plainly, in mono (no stamp). The word is also
 * the live region: empty at rest, written on every copy, so screen readers hear it each time; it rests 2.4 s and
 * empties. If the clipboard is unavailable the address is selected instead, so it can be copied by hand (and nothing
 * claims it was copied). Hidden without JS (contact.module.css): the address stays a mailto link.
 */
const REST_MS = 2400;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
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
    if (before instanceof HTMLElement && before.isConnected && document.activeElement !== before)
      before.focus({ preventScroll: true });
  }
}

export function CopyEmail({ email, label, done }: { email: string; label: string; done: string }) {
  const [word, setWord] = useState('');
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await writeClipboard(email);
    if (!ok) {
      const a = document.querySelector(`a[href="mailto:${email}"]`);
      if (a) getSelection()?.selectAllChildren(a);
      return;
    }
    clearTimeout(timer.current);
    setWord('');
    // next frame: a fresh text node, so it is announced again
    requestAnimationFrame(() => {
      setWord(done);
      timer.current = window.setTimeout(() => setWord(''), REST_MS);
    });
  };

  return (
    <p className={styles.contact__copy}>
      <button className="action action--button" type="button" onClick={onClick}>
        {label}
      </button>
      <span className={`mono ${styles.contact__done}`} role="status">
        {word}
      </span>
    </p>
  );
}
