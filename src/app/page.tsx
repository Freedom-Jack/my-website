"use client"

import React, { useRef, RefObject } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Hero } from '@/components/sections/Hero'
import { Button } from '@/components/ui/button'
import { Bubbles } from '@/components/animations/Bubbles'
import styles from '@/styles/pages/home.module.css'
import { homeContent } from '@/content/pages/home'

// Method for smooth scrolling to a reference
const scrollToRef = (ref: RefObject<HTMLElement | null>) => {
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
      <Hero 
        content={homeContent.hero} 
        onSecondaryClick={() => scrollToRef(aboutRef)} 
      />

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
          <div className={`${styles.profileCard}`}>
            <div className={styles.profileCardInner}>
              <div className={styles.profileGradient} />
              <div className={styles.profileContent}>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-44 h-44 rounded-full overflow-hidden border-2 border-primary/10 shadow-md">
                    <Image
                      src="/images/selfie.jpg"
                      alt={homeContent.about.profile.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold">{homeContent.about.profile.name}</h3>
                    <p className="text-muted-foreground">{homeContent.about.profile.role}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
} 