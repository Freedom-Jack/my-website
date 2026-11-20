'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import type { SheetHandle, SheetProps } from './Sheet';

/**
 * "Ask the painting": the door's script, mounted once in the root layout. All a page pays for before the door is
 * used: one listener for a press on anything marked `data-ask` (the door in the header; the tail's example, whose
 * `data-ask` is its question) and one for "/" outside a field. The sheet's code (Sheet.tsx and everything under it)
 * comes with the first opening and stays for the session, so does what it has fetched by then (mind.ts).
 */
interface Opening {
  q: string;
  from: HTMLElement | null;
  n: number;
}

export function AskHost() {
  const [Sheet, setSheet] = useState<ComponentType<SheetProps> | null>(null);
  const [opening, setOpening] = useState<Opening | null>(null);
  const sheet = useRef<SheetHandle | null>(null);
  const onHandle = useCallback((h: SheetHandle | null) => {
    sheet.current = h;
  }, []);
  // (a sheet that has finished leaving: unless another has been opened meanwhile)
  const onClosed = useCallback((n: number) => setOpening((o) => (o && o.n === n ? null : o)), []);

  useEffect(() => {
    let n = 0;
    const open = (q: string, from: HTMLElement | null) => {
      // (the door answers the press at once: its stroke is drawn while the sheet's code comes)
      document.querySelector('.ask-door')?.setAttribute('aria-expanded', 'true');
      setOpening({ q, from, n: ++n });
      void import('./Sheet').then((m) => setSheet(() => m.Sheet));
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-ask]') : null;
      if (!el) return;
      // (the door again, while the sheet is open, closes it)
      if (sheet.current) sheet.current.close();
      else open(el.dataset.ask ?? '', el);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      if (sheet.current) sheet.current.focus();
      else open('', null);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return Sheet && opening ? (
    <Sheet
      key={opening.n}
      ask={opening.q}
      from={opening.from}
      onHandle={onHandle}
      onClosed={() => onClosed(opening.n)}
    />
  ) : null;
}
