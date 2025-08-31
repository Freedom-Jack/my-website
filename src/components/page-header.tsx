import React from "react";
import { sectionStyles } from "@/styles/shared";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
}

export default function PageHeader({
  title,
  subtitle,
  description,
}: PageHeaderProps) {
  return (
    <section className="text-center space-y-4 max-w-3xl mx-auto">
      <h1 className={sectionStyles.headerTitle}>{title}</h1>
      {subtitle && <h2 className={sectionStyles.headerSubtitle}>{subtitle}</h2>}
      {description && (
        <p className="text-base text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </section>
  );
}
