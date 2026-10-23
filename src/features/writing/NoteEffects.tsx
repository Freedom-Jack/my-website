'use client';

import { useEffect } from 'react';
import styles from './article.module.css';

/**
 * A note's reading progress (SPEC-R4A §10.6): only where CSS scroll-driven animations are missing, sets --read on
 * the stroke from the note's position (the CSS draws it; the same range as the CSS: cover 0% → contain 100%).
 * The seal at the end is the colophon's (components/page/Colophon). Nothing here hides text.
 */
export function NoteEffects() {
  useEffect(() => {
    const ctrl = new AbortController();
    const { signal } = ctrl;
    const offs: Array<() => void> = [];
    const prose = document.querySelector<HTMLElement>(`.${styles.prose}`);
    const bar = document.querySelector<HTMLElement>(`.${styles['read-progress']}`);
    const native = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');
    if (!native && bar && prose) {
      let raf = 0;
      const progress = () => {
        raf = 0;
        const r = prose.getBoundingClientRect();
        // (0 at scroll 0, 1 when the prose's end reaches the bottom of the screen: the CSS timeline's own range)
        const p = Math.min(1, Math.max(0, scrollY / Math.max(1, r.bottom + scrollY - innerHeight)));
        bar.style.setProperty('--read', `${(p * 100).toFixed(2)}%`);
      };
      const update = () => {
        if (!raf) raf = requestAnimationFrame(progress);
      };
      addEventListener('scroll', update, { passive: true, signal });
      addEventListener('resize', update, { passive: true, signal });
      progress();
      offs.push(() => {
        cancelAnimationFrame(raf);
        bar.style.removeProperty('--read');
      });
    }
    return () => {
      ctrl.abort();
      offs.forEach((off) => off());
    };
  }, []);
  return null;
}
