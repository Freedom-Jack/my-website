"use client";

import React, { useEffect, useRef, useState } from "react";
import { useOptimizedMotion } from "@/lib/performance";

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  pulse: number;
  pulseSpeed: number;
}

const GlowBubbles: React.FC = () => {
  const { prefersReducedMotion } = useOptimizedMotion();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const animationRef = useRef<number | undefined>(undefined);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    // Only 8 bubbles for optimal performance
    const createBubbles = () => {
      
      const newBubbles: Bubble[] = [];
      for (let i = 0; i < 8; i++) {
        // Distribute bubbles evenly across screen in a grid-like pattern
        const cols = 4;
        const rows = 2;
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        // Base position with some randomness for natural look
        const baseX = (window.innerWidth / cols) * col + (window.innerWidth / cols) * 0.2;
        const baseY = (window.innerHeight / rows) * row + (window.innerHeight / rows) * 0.3;
        
        newBubbles.push({
          id: i,
          x: baseX + (Math.random() - 0.5) * (window.innerWidth / cols) * 0.6,
          y: baseY + (Math.random() - 0.5) * (window.innerHeight / rows) * 0.4,
          size: Math.random() * 30 + 15, // 15-45px
          speed: Math.random() * 0.4 + 0.1, // Slow movement
          pulse: Math.random() * Math.PI * 2, // Random start phase
          pulseSpeed: Math.random() * 0.02 + 0.01, // Slow pulse
        });
      }
      setBubbles(newBubbles);
    };

    createBubbles();

    const animate = () => {
      timeRef.current += 16; // ~60fps
      
      setBubbles(prevBubbles =>
        prevBubbles.map(bubble => {
          const newY = bubble.y - bubble.speed;
          const newPulse = bubble.pulse + bubble.pulseSpeed;
          
          // When bubble resets, maintain even distribution
          if (newY < -bubble.size) {
            const cols = 4;
            const col = bubble.id % cols;
            const baseX = (window.innerWidth / cols) * col + (window.innerWidth / cols) * 0.2;
            return {
              ...bubble,
              y: window.innerHeight + bubble.size,
              x: baseX + (Math.random() - 0.5) * (window.innerWidth / cols) * 0.6,
              pulse: newPulse,
            };
          }
          
          return {
            ...bubble,
            y: newY,
            x: bubble.x + Math.sin(newY * 0.005) * 0.2, // Gentle drift
            pulse: newPulse,
          };
        })
      );
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Static glowing bubbles for reduced motion
  if (prefersReducedMotion) {
    return (
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 left-20 w-12 h-12 rounded-full bg-primary/40 shadow-xl shadow-primary/60" />
        <div className="absolute top-20 right-20 w-16 h-16 rounded-full bg-primary/35 shadow-xl shadow-primary/50" />
        <div className="absolute top-1/2 left-1/4 w-14 h-14 rounded-full bg-primary/45 shadow-xl shadow-primary/65" />
        <div className="absolute top-1/2 right-1/4 w-10 h-10 rounded-full bg-primary/40 shadow-xl shadow-primary/60" />
        <div className="absolute bottom-20 left-20 w-18 h-18 rounded-full bg-primary/35 shadow-xl shadow-primary/55" />
        <div className="absolute bottom-20 right-20 w-12 h-12 rounded-full bg-primary/40 shadow-xl shadow-primary/60" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      {bubbles.map((bubble) => {
        const glowIntensity = Math.sin(bubble.pulse) * 0.5 + 0.8; // 0.3 to 1.3
        const baseOpacity = Math.sin(bubble.pulse) * 0.3 + 0.4; // 0.1 to 0.7
        
        return (
          <div
            key={bubble.id}
            className="absolute rounded-full bg-primary/50 shadow-2xl"
            style={{
              left: `${bubble.x}px`,
              top: `${bubble.y}px`,
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              opacity: baseOpacity,
              boxShadow: `0 0 ${bubble.size * glowIntensity}px hsl(var(--primary) / ${glowIntensity * 0.8}), 0 0 ${bubble.size * 0.5}px hsl(var(--primary) / 0.6)`,
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          />
        );
      })}
    </div>
  );
};

export default GlowBubbles;