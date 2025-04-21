'use client';

import styles from '@/styles/components/table-of-contents.module.css';

interface Heading {
  level: number;
  text: string;
  slug: string;
}

interface TableOfContentsProps {
  headings: Heading[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  if (headings.length === 0) return null;
  
  // Function to scroll to element with offset
  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - 100; // 100px offset
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  };
  
  return (
    <div className={styles.tocContainer}>
      <h2 className={styles.tocTitle}>Table of Contents</h2>
      <ul className={styles.tocList}>
        {headings.map((heading, index) => (
          <li 
            key={index} 
            className={styles.tocItem}
            style={{ marginLeft: `${(heading.level - 1) * 16}px` }}
          >
            <a 
              href={`#${heading.slug}`}
              className={styles.tocLink}
              onClick={(e) => scrollToSection(e, heading.slug)}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
} 