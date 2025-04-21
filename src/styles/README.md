# Styles Organization

This directory contains all the styles for the website organized in a modular, maintainable way.

## Directory Structure

- `/components`: Component-specific styles
- `/pages`: Page-specific styles
- `/shared`: Shared styles used across multiple components/pages

## Shared Styles

The shared styles are organized into the following categories:

- `typography.module.css`: Text styles, headings, paragraphs
- `layout.module.css`: Layout utilities, containers, grids
- `cards.module.css`: Card components and variations
- `sections.module.css`: Section layouts and headers
- `animations.module.css`: Animations and transitions
- `tags.module.css`: Tags, badges, and small UI elements

## Usage

### Importing Shared Styles

```jsx
// Option 1: Import specific shared styles
import { cardStyles, sectionStyles } from '@/styles/shared';

// Option 2: Import individual style modules
import cardStyles from '@/styles/shared/cards.module.css';
```

### Example Usage

```jsx
import { cardStyles, sectionStyles } from '@/styles/shared';

function ProjectCard() {
  return (
    <div className={cardStyles.cardBase}>
      <h3 className={cardStyles.cardTitle}>Project Title</h3>
      <p className={cardStyles.cardDescription}>Project description...</p>
    </div>
  )
}
```

## Adding New Styles

When adding new styles, consider:

1. Is this style specific to one component/page? → Add to component/page-specific file
2. Will this style be reused across multiple components/pages? → Add to appropriate shared file
3. Does this style represent a new category not covered by existing shared files? → Create a new shared file

## Guidelines

- Use Tailwind's `@apply` directive for common utility combinations
- Use CSS modules to avoid style conflicts
- Keep files organized and focused on a specific purpose
- Use composition with `composes:` when extending existing styles
- Document complex styles with comments 