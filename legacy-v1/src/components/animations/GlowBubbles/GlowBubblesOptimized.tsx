"use client";

import React, { useEffect, useRef } from "react";
import styles from "./GlowBubbles.module.css";

const GlowBubblesOptimized: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect reduced motion preference by skipping pointer-based parallax
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    if (prefersReducedMotion?.matches) return;

    // Skip parallax on coarse pointers (mobile) where it feels noisy
    const coarsePointer = window.matchMedia?.("(pointer: coarse)");
    if (coarsePointer?.matches) return;

    const handlePointerMove = (event: PointerEvent) => {
      const xNorm = event.clientX / window.innerWidth - 0.5;
      const yNorm = event.clientY / window.innerHeight - 0.5;
      const maxOffset = 24;
      const offsetX = -xNorm * maxOffset;
      const offsetY = -yNorm * maxOffset;
      container.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div ref={containerRef} className={styles.container} aria-hidden>
      <div className={styles.starfield} />
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />
      <div className={`${styles.blob} ${styles.blob4}`} />
    </div>
  );
};

export default GlowBubblesOptimized;
