"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import styles from "@/styles/components/table-of-contents.module.css";

interface Heading {
  level: number;
  text: string;
  slug: string;
}

interface TableOfContentsProps {
  headings: Heading[];
}

// Shared scroll function
const scrollToSection = (
  e: React.MouseEvent,
  id: string,
  onScroll?: () => void,
) => {
  e.preventDefault();
  const element = document.getElementById(id);
  if (element) {
    const offsetTop =
      element.getBoundingClientRect().top + window.pageYOffset - 100; // 100px offset
    window.scrollTo({
      top: offsetTop,
      behavior: "smooth",
    });
    if (onScroll) onScroll();
  }
};

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (headings.length === 0) return null;

  const handleMobileClick = (e: React.MouseEvent, id: string) => {
    scrollToSection(e, id, () => setIsMobileOpen(false));
  };

  const handleDesktopClick = (e: React.MouseEvent, id: string) => {
    scrollToSection(e, id);
  };

  return (
    <>
      {/* Mobile version - visible only on small screens */}
      <div className={`${styles.mobileTocContainer} md:hidden`}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className={styles.mobileTocButton}
        >
          <List className="w-4 h-4 mr-2" />
          Table of Contents
        </Button>

        {isMobileOpen && (
          <div className={styles.mobileTocContent}>
            <ul className={styles.tocList}>
              {headings.map((heading, index) => (
                <li
                  key={index}
                  className={styles.tocItem}
                  style={{ marginLeft: `${(heading.level - 1) * 16}px` }}
                >
                  <a
                    href={`#${heading.slug}`}
                    onClick={(e) => handleMobileClick(e, heading.slug)}
                    className={styles.tocLink}
                  >
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Desktop version - visible only on medium screens and up */}
      <div className={`${styles.tocContainer} hidden md:block`}>
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
                onClick={(e) => handleDesktopClick(e, heading.slug)}
                className={styles.tocLink}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
