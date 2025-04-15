"use client"

import React, { useRef, RefObject } from 'react'
import { Hero } from '@/components/sections/Hero'
import { Bubbles } from '@/components/animations/Bubbles'
import AboutSection from '@/components/sections/About'
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
      <div ref={aboutRef}>
        <AboutSection content={homeContent.about} />
      </div>
    </div>
  )
} 