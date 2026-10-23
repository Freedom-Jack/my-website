'use client';

import { useEffect } from 'react';

/**
 * The colophon's seal is stamped once as it comes into view (its top past 90% of the viewport). Already on screen
 * at load, under "Still the landscape", or without IntersectionObserver: it simply sits there. Nothing here hides
 * text. The classes come from colophon.module.css through Colophon, so the two can never disagree.
 */
export function ColophonEffects({
  sealClass,
  pending,
  stamping,
}: {
  sealClass: string;
  pending: string;
  stamping: string;
}) {
  useEffect(() => {
    const seal = document.querySelector<SVGElement>(`.${sealClass}`);
    const still = document.documentElement.classList.contains('is-still');
    if (!seal || still || !('IntersectionObserver' in window) || seal.getBoundingClientRect().top < innerHeight * 0.9)
      return;
    const ctrl = new AbortController();
    seal.classList.add(pending);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.disconnect();
          seal.classList.remove(pending);
          seal.classList.add(stamping);
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
        seal.classList.remove(pending);
      },
      { signal: ctrl.signal },
    );
    return () => {
      ctrl.abort();
      io.disconnect();
      seal.classList.remove(pending, stamping);
    };
  }, [sealClass, pending, stamping]);
  return null;
}
