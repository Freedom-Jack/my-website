"use client";

import { useEffect } from "react";
import {
  initWebVitals,
  getDeviceCapabilities,
  requestIdleCallback,
} from "@/lib/performance";

export default function LayoutClient() {
  useEffect(() => {
    // Initialize Web Vitals monitoring
    initWebVitals();

    // Get device capabilities
    const capabilities = getDeviceCapabilities();

    // Apply performance optimizations for low-end devices
    if (capabilities.isLowEndDevice) {
      document.documentElement.classList.add("low-end-device");
      console.log("Low-end device detected: Optimizing performance");
    }

    // Apply motion preferences
    if (capabilities.shouldReduceMotion) {
      document.documentElement.classList.add("reduce-animations");
    }

    // Defer non-critical initialization
    requestIdleCallback(() => {
      // Preload fonts or other resources
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = "/fonts/inter-var.woff2";
      document.head.appendChild(link);
    });
  }, []);

  return null;
}
