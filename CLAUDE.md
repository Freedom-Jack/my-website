# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run Jest tests
- `npm run test:watch` - Run Jest in watch mode
- `npm run analyze` - Analyze bundle size

### Environment Setup

- Requires Node.js >= 18.17.0
- Create `.env.local` with `GITHUB_TOKEN` and `GITHUB_USERNAME` for GitHub API integration
- Uses TypeScript with strict mode enabled

## Architecture Overview

### Framework & Tech Stack

- **Next.js 15.3.0** with App Router (not Pages Router)
- **TypeScript 5.3** with strict mode
- **Tailwind CSS** with custom design system
- **Radix UI** for accessible UI components
- **Framer Motion** for animations
- **MDX** for blog content with gray-matter frontmatter
- **Zustand** for state management
- **React Query** for data fetching

### Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with ThemeProvider
│   ├── page.tsx           # Home page
│   ├── about/page.tsx     # About page
│   ├── blog/              # Blog system
│   │   ├── page.tsx       # Blog listing
│   │   └── [slug]/page.tsx # Individual blog posts
│   ├── contact/page.tsx   # Contact page
│   ├── projects/page.tsx  # Projects page
│   └── api/               # API routes
│       └── github/        # GitHub API integration
├── components/            # React components
│   ├── ui/               # Reusable UI components (Button, Card, etc.)
│   ├── layout/           # Layout components (Header, Footer)
│   ├── sections/         # Page sections (Hero, About, etc.)
│   └── animations/       # Animation components (Bubbles)
├── content/              # Content configuration
│   └── pages/            # Page content definitions
├── lib/                  # Utility functions
│   ├── utils.ts          # General utilities
│   └── github.ts         # GitHub API client
└── styles/               # CSS organization
    ├── shared/           # Shared CSS modules
    ├── components/       # Component-specific styles
    └── pages/            # Page-specific styles
```

### Key Architectural Patterns

#### CSS Organization

- **Modular CSS**: Uses CSS modules for component styling
- **Shared Styles System**: Organized in `src/styles/shared/` with:
  - `typography.module.css` - Text styles
  - `cards.module.css` - Card components
  - `sections.module.css` - Section layouts
  - `animations.module.css` - Animation styles
  - `layout.module.css` - Layout utilities
  - `tags.module.css` - UI elements
- **Import Pattern**: Use `import { cardStyles, sectionStyles } from '@/styles/shared'`
- **Composition**: Use `composes:` to extend shared styles in component files

#### Content Management

- **Structured Content**: Page content defined in TypeScript files in `src/content/pages/`
- **MDX Blog System**: Blog posts stored in `public/blog/[slug]/index.mdx`
- **Frontmatter**: Uses gray-matter for blog post metadata
- **Table of Contents**: Auto-generated from MDX headings with mobile/desktop variants

#### Component Architecture

- **Theme System**: Dark/light mode using `next-themes`
- **UI Components**: Radix UI with custom styling
- **Animations**: Framer Motion for smooth transitions
- **Background**: Animated bubble background component

#### Data Fetching

- **GitHub Integration**: Real-time GitHub stats and repository data
- **API Routes**: Server-side GitHub API calls in `app/api/github/`
- **Environment Variables**: `GITHUB_TOKEN` and `GITHUB_USERNAME` required

### Development Workflow

#### Adding New Pages

1. Create page in `app/[page]/page.tsx`
2. Add content configuration in `src/content/pages/[page].ts`
3. Create page-specific styles in `src/styles/pages/[page].module.css`
4. Update navigation in Header component

#### Blog System

- Blog posts are MDX files in `public/blog/[slug]/index.mdx`
- Each post requires frontmatter with title, date, description, keywords
- Images stored alongside each post
- Auto-generates table of contents and SEO metadata

#### Styling Guidelines

- Use shared styles from `src/styles/shared/` for consistency
- Compose styles using CSS modules `composes:` property
- Follow mobile-first responsive design
- Use Tailwind utilities for spacing and layout
- Custom animations defined in `animations.module.css`

### Performance Optimizations

- Server-side rendering with Next.js App Router
- Image optimization with `next/image`
- Code splitting and lazy loading
- Bundle analysis with `npm run analyze`
- Optimized fonts with `next/font`

### Testing

- Jest testing framework configured
- React Testing Library for component tests
- Use `npm test` for single run, `npm run test:watch` for development
