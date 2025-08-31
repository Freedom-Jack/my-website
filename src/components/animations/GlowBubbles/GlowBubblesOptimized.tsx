"use client";

import React from "react";
import styles from "./GlowBubbles.module.css";

const GlowBubblesOptimized: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={`${styles.bubble} ${styles.bubble1}`} />
      <div className={`${styles.bubble} ${styles.bubble2}`} />
      <div className={`${styles.bubble} ${styles.bubble3}`} />
      <div className={`${styles.bubble} ${styles.bubble4}`} />
      <div className={`${styles.bubble} ${styles.bubble5}`} />
      <div className={`${styles.bubble} ${styles.bubble6}`} />
    </div>
  );
};

export default GlowBubblesOptimized;
