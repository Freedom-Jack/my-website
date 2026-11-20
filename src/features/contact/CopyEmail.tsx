'use client';

import { useEffect, useRef, useState } from 'react';
import { Seal } from '@/components/ui/Seal';
import styles from './contact.module.css';

/**
 * "Copy email": a real button that reads as underlined text. It copies the address; its words become "Copied" and
 * the seal is pressed beside it (a seal says the thing is done); both rest a moment, then the seal lifts and the
 * words return. A polite live region says "Copied" on every copy. If the clipboard is unavailable the address is
 * selected instead, so it can be copied by hand (and nothing claims it was copied). Hidden without JavaScript
 * (contact.module.css): the address is a mailto link either way.
 */
const REST_MS = 2600;

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
  // `n`: how many times it has been copied (a new press is a new seal, so its press plays again);
  // `on`: the seal is resting on the paper
  const [{ n, on }, setPress] = useState({ n: 0, on: false });
  const [said, setSaid] = useState('');
  const timer = useRef(0);
  const frame = useRef(0);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onClick = async () => {
    const ok = await writeClipboard(email);
    if (!ok) {
      const a = document.querySelector(`a[href="mailto:${email}"]`);
      if (a) getSelection()?.selectAllChildren(a);
      return;
    }
    clearTimeout(timer.current);
    cancelAnimationFrame(frame.current);
    setPress((p) => ({ n: p.n + 1, on: true }));
    setSaid('');
    // (the next frame: a fresh text node, so it is announced on every copy)
    frame.current = requestAnimationFrame(() => setSaid(done));
    timer.current = window.setTimeout(() => {
      setPress((p) => ({ n: p.n, on: false }));
      setSaid('');
    }, REST_MS);
  };

  return (
    <p className={styles.copy}>
      <button className={styles.copyButton} type="button" onClick={onClick}>
        {on ? done : label}
      </button>
      <span className={styles.copySeal} data-pressed={on ? '' : undefined} key={n}>
        <Seal id="seal-carve-copy" />
      </span>
      <span className="visually-hidden" role="status">
        {said}
      </span>
    </p>
  );
}
