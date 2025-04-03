"use client"

import React from "react"
import { motion } from "framer-motion"
import "./styles.css"

interface BubbleProps {
  index: number
}

const Bubble = ({ index }: BubbleProps) => {
  // Generate random values for each bubble
  const scale = 0.25 + Math.random() * 0.75
  const duration = 100 + Math.random() * 10
  const delay = Math.random() * 2
  
  // Generate random starting positions across the screen
  const startX = Math.random() * 100
  const startY = Math.random() * 100
  
  return (
    <motion.div
      className={`bubble bubble-${index}`}
      initial={{ 
        x: `${startX}vw`, 
        y: `${startY}vh`,
        scale 
      }}
      animate={{ 
        x: [
          `${startX}vw`,
          `${startX + (Math.random() * 40 - 20)}vw`,
          `${startX - (Math.random() * 40 - 20)}vw`,
          `${startX + (Math.random() * 30 - 15)}vw`,
          `${startX}vw`,
        ],
        y: [
          `${startY}vh`,
          `${startY + (Math.random() * 40 - 20)}vh`,
          `${startY - (Math.random() * 40 - 20)}vh`,
          `${startY + (Math.random() * 30 - 15)}vh`,
          `${startY}vh`,
        ],
        scale: [scale, scale * 1.1, scale * 0.9, scale * 1.05, scale]
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
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      {/* Reduced number of bubbles from 50 to 25 */}
      {Array.from({ length: 25 }).map((_, index) => (
        <Bubble key={index} index={index % 22} />
      ))}
    </div>
  )
} 