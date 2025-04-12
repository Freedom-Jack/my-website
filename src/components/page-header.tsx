import React from 'react';
import styles from '@/styles/pages/about.module.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
}

export default function PageHeader({ title, subtitle, description }: PageHeaderProps) {
  return (
    <section className={styles.headerSection}>
      <h1 className={styles.headerTitle}>{title}</h1>
      {subtitle && <h2 className={styles.headerSubtitle}>{subtitle}</h2>}
      {description && <p className={styles.headerDescription}>{description}</p>}
    </section>
  );
} 