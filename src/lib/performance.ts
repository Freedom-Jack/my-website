/**
 * Consolidated performance utilities for the website
 */

import { useEffect, useState, useRef } from "react";
import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from "web-vitals";

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime),
      );
    }
  };
};

// Debounce function for resize events
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Custom hook for media queries
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
};

// Custom hook for optimized scroll detection
export const useScrollPosition = (threshold: number = 10) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const isScrolled = window.scrollY > threshold;
      setScrolled(isScrolled);
    };

    handleScroll();

    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => window.removeEventListener("scroll", throttledScroll);
  }, [threshold]);

  return scrolled;
};

// Custom hook for intersection observer
export const useIntersectionObserver = (
  options?: IntersectionObserverInit,
): [React.RefObject<HTMLElement | null>, boolean] => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
};

// Device capabilities detection
export const getDeviceCapabilities = () => {
  if (typeof window === "undefined") {
    return {
      isLowEndDevice: false,
      deviceType: "desktop" as const,
      shouldReduceMotion: false,
    };
  }

  const width = window.innerWidth;
  const hasTouchScreen =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  // Determine device type
  let deviceType: "mobile" | "tablet" | "desktop";
  if (width <= 480 && hasTouchScreen) {
    deviceType = "mobile";
  } else if (width <= 768 && hasTouchScreen) {
    deviceType = "tablet";
  } else {
    deviceType = "desktop";
  }

  // Check if low-end device
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as any).deviceMemory || 4;
  const connection = (navigator as any).connection?.effectiveType || "4g";

  const isLowEndDevice =
    hardwareConcurrency <= 2 ||
    deviceMemory <= 2 ||
    ["slow-2g", "2g", "3g"].includes(connection);

  const shouldReduceMotion =
    isLowEndDevice ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    isLowEndDevice,
    deviceType,
    shouldReduceMotion,
    hardwareConcurrency,
    deviceMemory,
    connectionType: connection,
  };
};

// Performance-aware animation hook
export const useOptimizedMotion = () => {
  const capabilities = getDeviceCapabilities();

  return {
    shouldAnimate: !capabilities.shouldReduceMotion,
    isLowEndDevice: capabilities.isLowEndDevice,
    deviceType: capabilities.deviceType,
  };
};

// Web Vitals monitoring
export type WebVitalsMetric = Metric & {
  id: string;
  name: "CLS" | "INP" | "LCP" | "FCP" | "TTFB";
};

const THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  INP: { good: 200, needsImprovement: 500 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
};

function getRating(
  metric: WebVitalsMetric,
): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[metric.name];
  if (!threshold) return "good";

  if (metric.value <= threshold.good) return "good";
  if (metric.value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

export function reportWebVitals(metric: WebVitalsMetric) {
  const rating = getRating(metric);

  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    const emoji =
      rating === "good" ? "🟢" : rating === "needs-improvement" ? "🟡" : "🔴";
    console.log(
      `${emoji} ${metric.name}: ${metric.value.toFixed(2)}ms (${rating})`,
    );
  }
}

export function initWebVitals() {
  if (typeof window === "undefined") return;

  try {
    onCLS(reportWebVitals);
    onINP(reportWebVitals);
    onLCP(reportWebVitals);
    onFCP(reportWebVitals);
    onTTFB(reportWebVitals);
  } catch (err) {
    console.error("Failed to initialize Web Vitals:", err);
  }
}

// Defer non-critical work to idle time
export function requestIdleCallback(callback: () => void, timeout = 2000) {
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 0);
  }
}
