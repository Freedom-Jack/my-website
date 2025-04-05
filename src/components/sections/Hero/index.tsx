"use client"

import React, { RefObject } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import styles from '@/styles/pages/home.module.css'
import { HomePageContent } from '@/content/pages/home'

interface HeroProps {
  content: HomePageContent['hero']
  onSecondaryClick: () => void
}

export function Hero({ content, onSecondaryClick }: HeroProps) {
  return (
    <section className={styles.heroSection}>
      <div className="space-y-4">
        <h1 className={styles.heroTitle}>
          {content.title}
        </h1>
        <p className={styles.heroDescription}>
          {content.description}
        </p>
      </div>
      <div className={styles.buttonGroup}>
        <Button size="lg" asChild>
          <Link href="/projects">{content.cta.primary}</Link>
        </Button>
        <Button variant="outline" size="lg" onClick={onSecondaryClick}>
          {content.cta.secondary}
        </Button>
      </div>
    </section>
  )
} 