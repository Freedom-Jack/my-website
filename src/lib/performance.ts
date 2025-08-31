/**
 * Performance utilities for optimized React components
 */

import { useEffect, useState, useCallback, useRef } from "react";

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

// Custom hook for media queries with performance optimization
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    mediaQueryRef.current = window.matchMedia(query);
    setMatches(mediaQueryRef.current.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    if (mediaQueryRef.current.addEventListener) {
      mediaQueryRef.current.addEventListener("change", handler);
    } else {
      // Fallback for older browsers
      mediaQueryRef.current.addListener(handler);
    }

    return () => {
      if (mediaQueryRef.current) {
        if (mediaQueryRef.current.removeEventListener) {
          mediaQueryRef.current.removeEventListener("change", handler);
        } else {
          mediaQueryRef.current.removeListener(handler);
        }
      }
    };
  }, [query]);

  return matches;
};

// Custom hook for optimized scroll detection with immediate response
export const useScrollPosition = (threshold: number = 10) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Immediate response for critical UI changes
    const handleScrollImmediate = () => {
      const isScrolled = window.scrollY > threshold;
      setScrolled(isScrolled);
    };

    // Check initial position
    handleScrollImmediate();

    // Use requestAnimationFrame for smooth but responsive updates
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScrollImmediate();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: false,
    });

    return () => window.removeEventListener("scroll", handleScroll);
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

// Performance-aware animation hook
export const useOptimizedMotion = () => {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const prefersReducedData = useMediaQuery("(prefers-reduced-data: reduce)");
  const isLowPowerMode = useMediaQuery("(prefers-reduced-power: reduce)");

  const shouldAnimate =
    !prefersReducedMotion && !prefersReducedData && !isLowPowerMode;
  const shouldUseSimpleAnimations = prefersReducedMotion || isLowPowerMode;

  return {
    shouldAnimate,
    shouldUseSimpleAnimations,
    prefersReducedMotion,
    prefersReducedData,
    isLowPowerMode,
  };
};

// Request animation frame hook
export const useAnimationFrame = (
  callback: () => void,
  dependencies: any[] = [],
) => {
  const requestRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const animate = () => {
      callbackRef.current();
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, dependencies);
};

// Device capabilities detection
export const getDeviceCapabilities = () => {
  if (typeof window === "undefined") {
    return {
      isLowEndDevice: false,
      supportsCSSFilters: false,
      supportsWebGL: false,
      supportsIntersectionObserver: false,
    };
  }

  const canvas = document.createElement("canvas");
  const webgl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

  return {
    isLowEndDevice: navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency <= 2
      : false,
    supportsCSSFilters: CSS.supports("filter", "blur(1px)"),
    supportsWebGL: !!webgl,
    supportsIntersectionObserver: "IntersectionObserver" in window,
    deviceMemory: (navigator as any).deviceMemory || 4, // GB, default to 4 if not available
    connectionType: (navigator as any).connection?.effectiveType || "4g",
  };
};
