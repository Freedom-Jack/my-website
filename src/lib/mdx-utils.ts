import React from "react";

/**
 * Creates a heading component with automatic ID generation for table of contents
 */
export function createHeadingComponent(
  level: 1 | 2 | 3 | 4 | 5 | 6
): React.FC<{ children: React.ReactNode }> {
  const HeadingComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const text = children?.toString() || "";
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "-");

    const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
    
    return React.createElement(Tag, { id: slug }, children);
  };

  HeadingComponent.displayName = `Heading${level}`;
  return HeadingComponent;
}

/**
 * Pre-built heading components for MDX
 */
export const mdxHeadings = {
  h1: createHeadingComponent(1),
  h2: createHeadingComponent(2),
  h3: createHeadingComponent(3),
  h4: createHeadingComponent(4),
  h5: createHeadingComponent(5),
  h6: createHeadingComponent(6),
};

/**
 * Extract headings from markdown content for table of contents
 */
export function extractHeadings(content: string) {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Array<{ level: number; text: string; slug: string }> = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();

    // Skip h1 headings (title) for the table of contents
    if (level === 1) continue;

    const slug = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "-");

    headings.push({
      level,
      text,
      slug,
    });
  }

  return headings;
}