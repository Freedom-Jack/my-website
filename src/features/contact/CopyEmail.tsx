'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './contact.module.css';

/**
 * "Copy email": copies the address, then stamps the confirmation in ink on the button's dry tail (SPEC-R4A §10.4).
 * The stamp is also the live region: empty at rest, the word written into it on every copy, so screen readers hear
 * it each time. It lands, rests ~2.4 s, then lifts back into the mist and empties. If the clipboard is unavailable
 * the address is selected instead, so it can be copied by hand (and nothing claims it was copied).
 * Hidden without JS (contact.module.css): the address stays a mailto link.
 */
const REST_MS = 2400;
const LIFT_MS = 640;

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
  const [phase, setPhase] = useState<'rest' | 'stamped' | 'lifting'>('rest');
  const [word, setWord] = useState('');
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const onClick = async () => {
    const ok = await writeClipboard(email);
    if (!ok) {
      const a = document.querySelector(`a[href="mailto:${email}"]`);
      if (a) getSelection()?.selectAllChildren(a);
      return;
    }
    clear();
    setPhase('rest');
    setWord('');
    // next frame: a fresh text node (announced again) and a fresh animation (stamped again)
    requestAnimationFrame(() => {
      setWord(done);
      setPhase('stamped');
      timers.current.push(
        window.setTimeout(() => {
          setPhase('lifting');
          timers.current.push(
            window.setTimeout(() => {
              setPhase('rest');
              setWord('');
            }, LIFT_MS),
          );
        }, REST_MS),
      );
    });
  };

  const stampClass = [
    styles.contact__stamp,
    phase === 'stamped' ? styles.isStamped : '',
    phase === 'lifting' ? styles.isLifting : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <p className={styles.contact__copy}>
      <button className="ink-btn" type="button" onClick={onClick}>
        <span className="ink-btn__ink" aria-hidden="true" />
        <span className="ink-btn__label">{label}</span>
      </button>
      <span className={stampClass} role="status">
        {word}
      </span>
    </p>
  );
}
