'use client';

import { useEffect } from 'react';
import styles from './article.module.css';

/**
 * A note's two reading aids (SPEC-R4A §10.6):
 * 1. Reading progress: only where CSS scroll-driven animations are missing, sets --read on the stroke from the
 *    note's position (the CSS draws it; the same range as the CSS: cover 0% → contain 100%).
 * 2. The author's seal at the end is stamped once as it comes into view (its top past 90% of the viewport).
 *    Already on screen at load, under "Still the landscape", or without IntersectionObserver: it simply sits there.
 * Nothing here hides text.
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
        const p = Math.min(1, Math.max(0, (innerHeight - r.top) / Math.max(1, r.height)));
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
    const seal = document.querySelector<SVGElement>(`.${styles.colophon__seal}`);
    const still = document.documentElement.classList.contains('is-still');
    if (seal && !still && 'IntersectionObserver' in window && seal.getBoundingClientRect().top >= innerHeight * 0.9) {
      seal.classList.add(styles.isPending!);
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.disconnect();
            seal.classList.remove(styles.isPending!);
            seal.classList.add(styles.isStamping!);
          }
        },
        { rootMargin: '0px 0px -10% 0px' },
      );
      io.observe(seal);
      document.addEventListener(
        'ink:still',
        (e) => {
          if (!(e as CustomEvent<{ on: boolean }>).detail?.on) return;
          io.disconnect();
          seal.classList.remove(styles.isPending!);
        },
        { signal },
      );
      offs.push(() => {
        io.disconnect();
        seal.classList.remove(styles.isPending!, styles.isStamping!);
      });
    }
    return () => {
      ctrl.abort();
      offs.forEach((off) => off());
    };
  }, []);
  return null;
}
