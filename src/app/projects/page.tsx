"use client"

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { projectsContent } from '@/content/pages/projects'
import type { GitHubRepo, GitHubUser } from '@/lib/github'
import styles from '@/styles/pages/projects.module.css'
import aboutStyles from '@/styles/pages/about.module.css'
import PageHeader from '@/components/page-header'

interface GitHubData {
  user: GitHubUser;
  repos: GitHubRepo[];
  stats: {
    totalRepos: number;
    totalStars: number;
    languages: string[];
  };
}

export default function ProjectsPage() {
  const [data, setData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGitHubData() {
      try {
        // Create a promise that resolves after 1 second
        const minimumLoadingTime = new Promise(resolve => setTimeout(resolve, 1000));
        
        // Fetch data and wait for both the fetch and minimum time
        const [response] = await Promise.all([
          fetch('/api/github', {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }),
          minimumLoadingTime
        ]);

        if (!response.ok) throw new Error('Failed to fetch GitHub data');
        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchGitHubData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-destructive">Error</h2>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">No Data Available</h2>
          <p className="mt-2 text-muted-foreground">Unable to load GitHub data</p>
        </div>
      </div>
    );
  }

  return (
    <div className={aboutStyles.pageContainer}>
      <PageHeader 
        title={projectsContent.header.title} 
        subtitle="Code, Contributions, and Collaborations"
        description={projectsContent.header.description}
      />

      {/* GitHub Stats Section */}
      <section className={aboutStyles.section}>
        <h2 className={aboutStyles.sectionTitle}>{projectsContent.stats.title}</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Total Repositories</h3>
            <p className={styles.statDescription}>Public repositories on GitHub</p>
            <p className={styles.statNumber}>{data.stats.totalRepos}</p>
          </div>
          
          <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Total Stars</h3>
            <p className={styles.statDescription}>Stars received across all repositories</p>
            <p className={styles.statNumber}>{data.stats.totalStars}</p>
          </div>
          
          <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Languages</h3>
            <p className={styles.statDescription}>Programming languages used</p>
            <div className={styles.languageTags}>
              {data.stats.languages.map((lang) => (
                <span key={lang} className={styles.languageTag}>
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className={aboutStyles.section}>
        <h2 className={aboutStyles.sectionTitle}>{projectsContent.projects.title}</h2>
        <div className={styles.sectionHeader}>
          <div></div>
          <Button asChild>
            <a href={`https://github.com/${data.user.login}`} target="_blank" rel="noopener noreferrer">
              {projectsContent.projects.viewAll}
            </a>
          </Button>
        </div>
        <div className={styles.projectsGrid}>
          {data.repos.slice(0, 6).map((repo) => (
            <div key={repo.name} className={styles.projectCard}>
              <div>
                <h3 className={styles.projectTitle}>{repo.name}</h3>
                <p className={styles.projectDescription}>
                  {repo.description || 'No description available'}
                </p>
              </div>
              <div className={styles.cardContent}>
                <div>
                  <div className={styles.projectTopics}>
                    {repo.topics.slice(0, 3).map((topic) => (
                      <span key={topic} className={styles.projectTopic}>
                        {topic}
                      </span>
                    ))}
                  </div>
                  <div className={styles.projectMeta}>
                    {repo.language && <span className={styles.projectLanguage}>{repo.language}</span>}
                    <span className={styles.projectStars}>⭐ {repo.stargazers_count}</span>
                    {repo.updated_at && (
                      <span className={styles.projectUpdated}>
                        Updated: {new Date(repo.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Button asChild className={styles.projectButton}>
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                    View Repository
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
} 