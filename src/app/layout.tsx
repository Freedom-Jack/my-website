import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { ThemeProvider } from '@/components/theme-provider'
import { Bubbles } from '@/components/animations/Bubbles'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'Qijin Xu - Software Development Engineer',
  description: 'Software Development Engineer specializing in machine learning, data analysis, and AI applications.',
  keywords: ['software development engineer', 'machine learning', 'data engineering', 'AI', 'python', 'ML algorithms', 'LLM'],
  authors: [{ name: 'Qijin Xu' }],
  creator: 'Qijin Xu',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Qijin Xu - Software Development Engineer',
    description: 'Software Development Engineer specializing in machine learning, data analysis, and AI applications.',
    siteName: 'Qijin Xu my-website',
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Bubbles />
          <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 bg-background/80 backdrop-blur-sm">
              {children}
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
} 