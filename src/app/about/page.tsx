import { aboutContent } from '@/content/pages/about';
import styles from '@/styles/pages/about.module.css';

export default function AboutPage() {
  return (
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <section className={styles.headerSection}>
        <h1 className={styles.headerTitle}>{aboutContent.header.title}</h1>
        <h2 className={styles.headerSubtitle}>{aboutContent.header.subtitle}</h2>
        <p className={styles.headerDescription}>{aboutContent.header.description}</p>
      </section>

      {/* Bio Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.bio.title}</h2>
        <div className={styles.bioContent}>
          {aboutContent.sections.bio.content.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </section>

      {/* Skills Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.skills.title}</h2>
        <div className={styles.skillsGrid}>
          {aboutContent.sections.skills.categories.map((category, index) => (
            <div key={index} className={styles.skillCategory}>
              <h3 className={styles.skillCategoryTitle}>{category.title}</h3>
              <ul className={styles.skillList}>
                {category.items.map((skill, skillIndex) => (
                  <li key={skillIndex} className={styles.skillItem}>
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Experience Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.experience.title}</h2>
        <div className={styles.experienceList}>
          {aboutContent.sections.experience.items.map((item, index) => (
            <div key={index} className={styles.experienceItem}>
              <div className={styles.experienceHeader}>
                <div>
                  <h3 className={styles.experienceRole}>{item.role}</h3>
                  <p className={styles.experienceCompany}>{item.company}</p>
                </div>
                <p className={styles.experiencePeriod}>{item.period}</p>
              </div>
              <ul className={styles.experienceDescription}>
                {item.description.map((point, pointIndex) => (
                  <li key={pointIndex}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Education Section */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{aboutContent.sections.education.title}</h2>
        <div className={styles.educationList}>
          {aboutContent.sections.education.items.map((item, index) => (
            <div key={index} className={styles.educationItem}>
              <div className={styles.educationHeader}>
                <div>
                  <h3 className={styles.educationDegree}>{item.degree}</h3>
                  <p className={styles.educationInstitution}>{item.institution}</p>
                </div>
                <p className={styles.educationPeriod}>{item.period}</p>
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
    </div>
  );
} 