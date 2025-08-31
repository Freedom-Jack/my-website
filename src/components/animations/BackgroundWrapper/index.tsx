"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";

// Use the glowing bubble background
const GlowBubbles = dynamic(
  () => import("@/components/animations/GlowBubbles"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-muted/10" />
    ),
  },
);

const BackgroundWrapper: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-background via-background to-muted/10" />
      }
    >
      <GlowBubbles />
    </Suspense>
  );
};

export default BackgroundWrapper;
