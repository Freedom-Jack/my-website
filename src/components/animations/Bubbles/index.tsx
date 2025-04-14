"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import "./styles.css"

interface BubbleProps {
  index: number
}

// This component will only render on the client side
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  if (!isMounted) {
    return null // Return nothing on the server side
  }
  
  return <>{children}</>
}

// Deterministic random function based on seed
function generateRandom(index: number) {
  // Use a fixed seed based on index
  const seed = index + 1;
  
  // Generate consistent values
  const scale = 0.25 + (Math.sin(seed * 123.45) * 0.5 + 0.5) * 0.75;
  const duration = 20 + (Math.sin(seed * 567.89) * 0.5 + 0.5) * 10;
  const delay = (Math.sin(seed * 912.34) * 0.5 + 0.5) * 2;
  const startX = (Math.sin(seed * 345.67) * 0.5 + 0.5) * 100;
  const startY = (Math.sin(seed * 789.01) * 0.5 + 0.5) * 100;
  
  // Generate animation points
  const x1 = startX + (Math.sin(seed * 111.22) * 0.5 + 0.5) * 40 - 20;
  const x2 = startX - (Math.sin(seed * 333.44) * 0.5 + 0.5) * 40 + 20;
  const x3 = startX + (Math.sin(seed * 555.66) * 0.5 + 0.5) * 30 - 15;
  
  const y1 = startY + (Math.sin(seed * 777.88) * 0.5 + 0.5) * 40 - 20;
  const y2 = startY - (Math.sin(seed * 999.00) * 0.5 + 0.5) * 40 + 20;
  const y3 = startY + (Math.sin(seed * 111.00) * 0.5 + 0.5) * 30 - 15;
  
  return {
    scale,
    duration,
    delay,
    startX,
    startY,
    xPositions: [
      `${startX}vw`,
      `${x1}vw`,
      `${x2}vw`,
      `${x3}vw`,
      `${startX}vw`,
    ],
    yPositions: [
      `${startY}vh`,
      `${y1}vh`,
      `${y2}vh`,
      `${y3}vh`,
      `${startY}vh`,
    ],
    scaleValues: [scale, scale * 1.1, scale * 0.9, scale * 1.05, scale]
  };
}

const Bubble = ({ index }: BubbleProps) => {
  // Generate all values based on index - these are now deterministic and stable
  const {
    scale,
    duration,
    delay,
    xPositions,
    yPositions,
    scaleValues
  } = generateRandom(index);
  
  return (
    <motion.div
      className={`bubble bubble-${index}`}
      initial={{ 
        x: xPositions[0], 
        y: yPositions[0],
        scale: scaleValues[0]
      }}
      animate={{ 
        x: xPositions,
        y: yPositions,
        scale: scaleValues
      }}
      transition={{
        duration: duration,
        delay: delay,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut"
      }}
    />
  )
}

export function Bubbles() {
  // Use a wrapper div with suppressHydrationWarning
  return (
    <div 
      className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none"
      suppressHydrationWarning
    >
      <ClientOnly>
        {/* Reduced number of bubbles from 50 to 25 */}
        {Array.from({ length: 25 }).map((_, index) => (
          <Bubble key={`bubble-${index}`} index={index % 22} />
        ))}
      </ClientOnly>
    </div>
  )
} 