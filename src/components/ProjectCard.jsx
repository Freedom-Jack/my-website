import React from 'react';
import Link from 'next/link';

// Import shared styles
import { cardStyles, tagStyles, animationStyles } from '@/styles/shared';

const ProjectCard = ({ project }) => {
  const { title, description, languages, topics, stars, updated_at, html_url } = project;
  
  return (
    <div className={cardStyles.cardBase}>
      <h3 className={cardStyles.cardTitle}>{title}</h3>
      <p className={cardStyles.cardDescription}>{description}</p>
      
      <div className={tagStyles.tagList}>
        {languages?.map((lang) => (
          <span key={lang} className={tagStyles.tagPrimary}>
            {lang}
          </span>
        ))}
        
        {stars && (
          <span className={tagStyles.tagAmber}>
            ★ {stars}
          </span>
        )}
        
        {updated_at && (
          <span className={tagStyles.tagMuted}>
            Updated: {new Date(updated_at).toLocaleDateString()}
          </span>
        )}
      </div>
      
      {topics?.length > 0 && (
        <div className={tagStyles.tagList}>
          {topics.map((topic) => (
            <span key={topic} className={tagStyles.tagSecondary}>
              {topic}
            </span>
          ))}
        </div>
      )}
      
      <div className="mt-auto pt-4">
        <Link 
          href={html_url} 
          target="_blank" 
          className={`inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 ${animationStyles.gradientBorder}`}
        >
          View Project
        </Link>
      </div>
    </div>
  );
};

export default ProjectCard; 