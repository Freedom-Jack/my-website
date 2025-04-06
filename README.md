# Qijin Xu - Personal Portfolio

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-black.svg)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)

A modern, responsive portfolio website showcasing my work as a Software Development Engineer specializing in machine learning and AI. Built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🎨 Modern, responsive design with dark/light mode support
- 🚀 Optimized performance with Next.js 14 and server components
- 📊 Interactive GitHub statistics and project showcase
- 🌍 Global experience visualization with interactive map
- 🎭 Smooth animations and transitions
- 📱 Mobile-first, responsive layout
- 🔍 SEO optimized with metadata and semantic HTML

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + Custom Components
- **Animation**: Framer Motion
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js >= 18.17.0
- npm >= 9.0.0

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Freedom-Jack/my-website.git
cd my-website
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file and add your GitHub token:
```env
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_github_username
```

4. Start the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   ├── layout/          # Layout components
│   ├── sections/        # Page sections
│   └── animations/      # Animation components
├── content/             # Content and configuration
├── lib/                 # Utility functions
├── styles/              # Global styles
└── types/               # TypeScript type definitions
```

## Features in Detail

### Performance Optimizations
- Server-side rendering with Next.js
- Image optimization with next/image
- Font optimization with next/font
- Code splitting and lazy loading
- Minimal client-side JavaScript

### Interactive Elements
- Animated background with floating bubbles
- Interactive world map showing global experience
- Live GitHub statistics and project showcase
- Smooth page transitions and hover effects

### Development Features
- TypeScript for type safety
- ESLint and Prettier for code quality
- Component-based architecture
- Responsive design system
- Dark/light mode support

## License

MIT License
