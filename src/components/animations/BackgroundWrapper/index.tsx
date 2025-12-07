"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";

// Use the optimized CSS-only bubble background for better performance
const GlowBubblesOptimized = dynamic(
  () => import("@/components/animations/GlowBubbles/GlowBubblesOptimized"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-background via-background to-muted/10" />
    ),
  },
);

const BackgroundWrapper: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-0 bg-gradient-to-br from-background via-background to-muted/10" />
      }
    >
      <GlowBubblesOptimized />
    </Suspense>
  );
};

export default BackgroundWrapper;
