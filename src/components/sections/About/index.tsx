"use client"

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import styles from './styles.module.css'

interface AboutSectionProps {
  content: {
    tag: string;
    title: string;
    description: string;
    cta: string;
    profile: {
      name: string;
      role: string;
    };
  };
}

export default function AboutSection({ content }: AboutSectionProps) {
  return (
    <section className={styles.aboutSection}>
      <div className={styles.textContainer}>
        <div className={styles.aboutTag}>
          {content.tag}
        </div>
        <h2 className={styles.aboutTitle}>
          {content.title}
        </h2>
        <p className={styles.aboutDescription}>
          {content.description}
        </p>
        <div className={styles.buttonContainer}>
          <Button asChild className={styles.ctaButton}>
            <Link href="/about" className="flex items-center gap-1">
              {content.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      
      <div className={styles.profileContainer}>
        <div className={styles.profileCard}>
          <div className={styles.decorativeCircle1}></div>
          <div className={styles.decorativeCircle2}></div>
          
          <div className={styles.profileCardInner}>
            <div className={styles.profileGradient} />
            <Image
              src="/images/selfie.jpg"
              alt={content.profile.name}
              fill
              className={styles.profileImage}
              priority
            />
          </div>
          
          <div className={styles.profileInfo}>
            <h3 className={styles.profileName}>{content.profile.name}</h3>
            <p className={styles.profileRole}>{content.profile.role}</p>
          </div>
        </div>
      </div>
    </section>
  )
} 