# Styling Organization

This directory contains all the CSS modules used throughout the application.

## Directory Structure

- **shared/** - Contains reusable styles shared across multiple components/pages
  - `layout.module.css` - Common layout styles (containers, grids, sections)
  - `typography.module.css` - Typography styles (headings, text, gradient text)
  - `animations.module.css` - Animation styles
  - `forms.module.css` - Form and input styles
  
- **components/** - Component-specific styles
  - `hero.module.css` - Styles specific to the Hero component
  - `profile-card.module.css` - Styles for profile cards
  - etc.

- **pages/** - Page-specific styles (for unique page layouts)
  - Only use these for styles that are truly unique to a specific page

## Usage Guidelines

1. **Use shared styles whenever possible** to maintain consistency and reduce duplication

2. **Import only what you need** in each component:
   ```jsx
   import layoutStyles from '@/styles/shared/layout.module.css'
   import typographyStyles from '@/styles/shared/typography.module.css'
   import heroStyles from '@/styles/components/hero.module.css'
   
   export function Hero() {
     return (
       <section className={layoutStyles.section}>
         <h1 className={`${typographyStyles.heading} ${typographyStyles.gradientHeading}`}>
           Title
         </h1>
         <div className={heroStyles.heroContent}>
           {/* content */}
         </div>
       </section>
     )
   }
   ```

3. **Avoid duplication** - If you find yourself copying styles between files, consider moving them to a shared file

4. **Component-specific styles** should only contain styles that are truly unique to that component

5. **Page-specific styles** should be minimal - aim to build pages from well-styled components 