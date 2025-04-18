import { aboutContent } from '@/content/pages/about';
import styles from '@/styles/pages/about.module.css';
import React from 'react';

// Add priority loading metadata for the page
export const metadata = {
  priority: true
};

export default function AboutPage() {
  const renderSkillsList = (items: string[]) => {
    const maxItemsPerColumn = 5;
    const columns = Math.ceil(items.length / maxItemsPerColumn);
    
    return (
      <div className={styles.skillColumns}>
        {Array.from({ length: columns }).map((_, columnIndex) => (
          <ul key={columnIndex} className={styles.skillList}>
            {items
              .slice(columnIndex * maxItemsPerColumn, (columnIndex + 1) * maxItemsPerColumn)
              .map((skill, skillIndex) => (
                <li key={skillIndex} className={styles.skillItem}>
                  {skill}
                </li>
              ))}
          </ul>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <section className={styles.headerSection}>
        <h1 className={styles.headerTitle}>{aboutContent.header.title}</h1>
        <h2 className={styles.headerSubtitle}>{aboutContent.header.subtitle}</h2>
        <p className={styles.headerDescription}>{aboutContent.header.description}</p>
      </section>

      {/* Bio Section */}
      <section className={styles.section} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 200px' }}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.bio.title}</h2>
        <div className={styles.bioContent}>
          {aboutContent.sections.bio.content.map((item, index) => (
            <div key={index} className={styles.bioSection}>
              <h3 className={styles.bioHeading}>{item.heading}</h3>
              <p className={styles.bioParagraph}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Skills Section */}
      <section className={styles.section} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.skills.title}</h2>
        <div className={styles.skillsGrid}>
          {aboutContent.sections.skills.categories.map((category, index) => (
            <div key={index} className={styles.skillCategory}>
              <h3 className={styles.skillCategoryTitle}>{category.title}</h3>
              <div className={styles.skillColumns + (category.items.length > 5 ? ` ${styles.hasTwoColumns}` : '')}>
                <div className={styles.skillList}>
                  {category.items.slice(0, 5).map((skill, index) => (
                    <div key={index} className={styles.skillItem}>
                      {skill}
                    </div>
                  ))}
                </div>
                {category.items.length > 5 && (
                  <div className={styles.skillList}>
                    {category.items.slice(5).map((skill, index) => (
                      <div key={index} className={styles.skillItem}>
                        {skill}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Experience Section */}
      <section className={styles.section} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' }}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.experience.title}</h2>
        <div className={styles.experienceList}>
          {aboutContent.sections.experience.items.map((item, index) => (
            <div key={index} className={styles.experienceItem}>
              <div className={styles.experienceHeader}>
                <h3 className={styles.experienceCompany}>{item.company}</h3>
              </div>
              <div className={styles.rolesList}>
                {item.roles.map((role, roleIndex) => (
                  <div key={roleIndex} className={styles.roleItem}>
                    <div className={styles.roleHeader}>
                      <div>
                        <h4 className={styles.roleTitle}>{role.title}</h4>
                        <div className={styles.roleKeywords}>
                          {role.keywords.map((keyword, keywordIndex) => (
                            <span key={keywordIndex} className={styles.keyword}>
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={styles.rolePeriod}>
                        <span className={styles.roleDate}>{role.startDate}</span>
                        <span className={styles.roleDateSeparator}>—</span>
                        <span className={styles.roleDate}>{role.isCurrent ? "Present" : role.endDate}</span>
                      </div>
                    </div>
                    <ul className={styles.experienceDescription}>
                      {role.description.map((point, pointIndex) => {
                        // Apply highlight patterns
                        let processedText = point;
                        role.highlightPatterns.forEach(({ pattern }) => {
                          const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
                          processedText = processedText.replace(regex, (match) => {
                            return `<span class="primary">${match}</span>`;
                          });
                        });
                        
                        return (
                          <li 
                            key={pointIndex} 
                            dangerouslySetInnerHTML={{ __html: processedText }}
                            className={styles.descriptionItem}
                          />
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Education Section */}
      <section className={styles.section} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 300px' }}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.education.title}</h2>
        <div className={styles.educationList}>
          {aboutContent.sections.education.items.map((item, index) => (
            <div key={index} className={styles.educationItem}>
              <div className={styles.educationHeader}>
                <div>
                  <h3 className={styles.educationDegree}>{item.degree}</h3>
                  <p className={styles.educationInstitution}>{item.institution}</p>
                </div>
                <div className={styles.rolePeriod}>
                  <span className={styles.roleDate}>{item.startDate}</span>
                  <span className={styles.roleDateSeparator}>—</span>
                  <span className={styles.roleDate}>{item.endDate}</span>
                </div>
              </div>
              <ul className={styles.educationDescription}>
                {item.description.map((point, pointIndex) => (
                  <li key={pointIndex}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Certificates Section */}
      <section className={styles.section} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 250px' }}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.certificates.title}</h2>
        <div className={styles.certificatesList}>
          {aboutContent.sections.certificates.items.map((cert, index) => (
            <div key={index} className={styles.certificateItem}>
              <h3 className={styles.certificateName}>{cert.name}</h3>
              <p className={styles.certificateIssuer}>{cert.issuer}</p>
              <p className={styles.certificateDate}>Issued: {cert.date}</p>
              {cert.credentialId && (
                <p className={styles.certificateId}>ID: {cert.credentialId}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
} 