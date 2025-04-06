"use client"

import React, { RefObject } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import styles from '@/styles/pages/home.module.css'
import { HomePageContent } from '@/content/pages/home'

interface HeroProps {
  content: {
    title: string;
    subtitle: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  onSecondaryClick: () => void;
}

export function Hero({ content, onSecondaryClick }: HeroProps) {
  return (
    <section className={styles.heroSection}>
      <div className={styles.backgroundPattern} />
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>
          {content.title}
          <span className={styles.heroSubtitle}>{content.subtitle}</span>
        </h1>
        <p className={styles.heroDescription}>{content.description}</p>
        <div className={styles.buttonGroup}>
          <Button size="lg" asChild>
            <Link href="/projects">{content.primaryCta}</Link>
          </Button>
          <Button variant="outline" size="lg" onClick={onSecondaryClick}>
            {content.secondaryCta}
          </Button>
        </div>
      </div>
    </section>
  )
} 