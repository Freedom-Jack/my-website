"use client"

import React, { useRef, RefObject } from 'react'
import Link from 'next/link'
import { WorldMap } from '@/components/sections/WorldMap'
import { Button } from '@/components/ui/button'
import { Bubbles } from '@/components/animations/Bubbles'
import styles from '@/styles/pages/home.module.css'
import { homeContent } from '@/content/pages/home'

// Method for smooth scrolling to a reference
const scrollToRef = (ref: RefObject<HTMLElement>) => {
  if (ref.current) {
    window.scrollTo({
      top: ref.current.offsetTop,
      behavior: "smooth"
    })
  }
}

export default function HomePage() {
  // Reference for scrolling
  const aboutRef = useRef(null)
  
  return (
    <div className={styles.pageContainer}>
      {/* Background Animation */}
      <Bubbles />
      
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className="space-y-4">
          <h1 className={styles.heroTitle}>
            {homeContent.hero.title}
          </h1>
          <p className={styles.heroDescription}>
            {homeContent.hero.description}
          </p>
        </div>
        <div className={styles.buttonGroup}>
          <Button size="lg" asChild>
            <Link href="/projects">{homeContent.hero.cta.primary}</Link>
          </Button>
          <Button variant="outline" size="lg" onClick={() => scrollToRef(aboutRef)}>
            {homeContent.hero.cta.secondary}
          </Button>
        </div>
      </section>

      {/* About Section */}
      <section ref={aboutRef} className={styles.aboutSection}>
        <div className="flex flex-col justify-center space-y-4">
          <div className={styles.aboutTag}>
            {homeContent.about.tag}
          </div>
          <h2 className={styles.aboutTitle}>
            {homeContent.about.title}
          </h2>
          <p className={styles.aboutDescription}>
            {homeContent.about.description}
          </p>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/about">{homeContent.about.cta}</Link>
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className={styles.profileCard}>
            <div className={styles.profileCardInner}>
              <div className={styles.profileGradient} />
              <div className={styles.profileContent}>
                <div className="text-center">
                  <h3 className="text-2xl font-bold">{homeContent.about.profile.name}</h3>
                  <p className="text-muted-foreground">{homeContent.about.profile.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive World Map Section */}
      <section className={styles.mapSection}>
        <div className={styles.mapHeader}>
          <h2 className={styles.mapTitle}>
            {homeContent.map.title}
          </h2>
          <p className={styles.mapDescription}>
            {homeContent.map.description}
          </p>
        </div>
        <WorldMap />
      </section>
    </div>
  )
} 