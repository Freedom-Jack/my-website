'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { List } from 'lucide-react';
import styles from '@/styles/components/table-of-contents.module.css';

interface Heading {
  level: number;
  text: string;
  slug: string;
}

interface MobileTableOfContentsProps {
  headings: Heading[];
}

export default function MobileTableOfContents({ headings }: MobileTableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  
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
      setIsOpen(false);
    }
  };
  
  return (
    <div className={`md:hidden ${styles.mobileContainer}`}>
      <Button 
        variant="outline" 
        size="sm" 
        className={styles.mobileToggle}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Table of Contents</span>
        <List className="h-4 w-4" />
      </Button>
      
      {isOpen && (
        <div className={styles.tocContainer}>
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
      )}
    </div>
  );
} 