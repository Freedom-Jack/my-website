import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "../styles/performance.css";
import "../styles/mobile-optimizations.css";

import { ThemeProvider } from "@/components/theme-provider";
import BackgroundWrapper from "@/components/animations/BackgroundWrapper";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import LayoutClient from "./layout-client";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Qijin Xu - Software Development Engineer",
  description:
    "Software Development Engineer specializing in machine learning, data analysis, and AI applications.",
  keywords: [
    "software development engineer",
    "machine learning",
    "data engineering",
    "AI",
    "python",
    "ML algorithms",
    "LLM",
  ],
  authors: [{ name: "Qijin Xu" }],
  creator: "Qijin Xu",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Qijin Xu - Software Development Engineer",
    description:
      "Software Development Engineer specializing in machine learning, data analysis, and AI applications.",
    siteName: "Qijin Xu my-website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} overflow-x-hidden`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Performance monitoring client component */}
          <LayoutClient />

          {/* Optimized background with performance monitoring */}
          <BackgroundWrapper />

          <div className="relative flex min-h-screen flex-col">
            <ErrorBoundary>
              <Header />
            </ErrorBoundary>
            <ErrorBoundary>
              <main
                className="flex-1 relative"
                style={{
                  contain: "layout style paint",
                  contentVisibility: "auto",
                }}
              >
                {children}
              </main>
            </ErrorBoundary>
            <ErrorBoundary>
              <Footer />
            </ErrorBoundary>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
