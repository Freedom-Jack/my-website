# Shared Styles Usage Guide

This guide explains how to effectively use the shared styles system in your components and pages.

## Available Shared Style Modules

| Module | Purpose | Key Classes |
|--------|---------|-------------|
| `typography.module.css` | Text styles | `.heading`, `.paragraph`, `.link` |
| `layout.module.css` | Layout utilities | `.container`, `.grid`, `.flex` |
| `cards.module.css` | Card components | `.cardBase`, `.cardTitle`, `.cardDescription` |
| `sections.module.css` | Section layouts | `.section`, `.sectionTitle`, `.pageContainer` |
| `animations.module.css` | Animations | `.gradientText`, `.gradientBorder`, `@keyframes` |
| `tags.module.css` | UI elements | `.tagPrimary`, `.tagSecondary`, `.tagList` |

## How to Import

You can import shared styles in two ways:

### Method 1: Import from index (recommended)

```jsx
import { cardStyles, sectionStyles } from '@/styles/shared';
```

### Method 2: Import individual modules

```jsx
import cardStyles from '@/styles/shared/cards.module.css';
```

## CSS Composition

You can use CSS composition to extend shared styles:

```css
/* In your component-specific .module.css file */
.myCustomCard {
  composes: cardBase from '../shared/cards.module.css';
  /* Add additional styles specific to your component */
  padding: 2rem;
  margin-bottom: 2rem;
}
```

## Example: Building a Component with Shared Styles

```jsx
import { cardStyles, tagStyles, animationStyles } from '@/styles/shared';

function FeatureCard({ title, description, tags }) {
  return (
    <div className={cardStyles.cardBase}>
      <h3 className={cardStyles.cardTitle}>{title}</h3>
      <p className={cardStyles.cardDescription}>{description}</p>
      
      <div className={tagStyles.tagList}>
        {tags.map(tag => (
          <span key={tag} className={tagStyles.tagPrimary}>{tag}</span>
        ))}
      </div>
    </div>
  );
}
```

## Nesting Components with Shared Styles

```jsx
import { sectionStyles, cardStyles } from '@/styles/shared';

function FeatureSection() {
  return (
    <section className={sectionStyles.section}>
      <h2 className={sectionStyles.sectionTitle}>Our Features</h2>
      <div className={sectionStyles.grid3Cols}>
        <FeatureCard title="Feature 1" description="..." tags={['New']} />
        <FeatureCard title="Feature 2" description="..." tags={['Popular']} />
        <FeatureCard title="Feature 3" description="..." tags={['Coming Soon']} />
      </div>
    </section>
  );
}
```

## When to Create New Styles

1. **Shared Styles**: If you find yourself duplicating styles across multiple components
2. **Component Styles**: If styles are specific to a single component
3. **Page Styles**: Only for truly page-specific layouts

## Best Practices

- Use `composes` to extend shared styles
- Keep component-specific styles minimal
- Don't duplicate shared styles in component files
- Use descriptive class names
- Group related styles into logical modules 