"use client";

import React, { useRef, RefObject } from "react";
import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/Hero";
import styles from "@/styles/pages/home.module.css";
import { homeContent } from "@/content/pages/home";

// Lazy load the About section as it's below the fold
const AboutSection = dynamic(() => import("@/components/sections/About"), {
  loading: () => <div className="min-h-[400px]" />,
});

// Method for smooth scrolling to a reference
const scrollToRef = (ref: RefObject<HTMLElement | null>) => {
  if (ref.current) {
    window.scrollTo({
      top: ref.current.offsetTop,
      behavior: "smooth",
    });
  }
};

export default function HomePage() {
  // Reference for scrolling
  const aboutRef = useRef(null);

  return (
    <div className={styles.pageContainer}>
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
  );
}
