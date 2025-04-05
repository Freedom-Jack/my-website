"use client"

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { projectsContent } from '@/content/pages/projects'
import type { GitHubRepo, GitHubUser } from '@/lib/github'
import styles from '@/styles/pages/projects.module.css'

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
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <section className={styles.headerSection}>
        <h1 className={styles.headerTitle}>{projectsContent.header.title}</h1>
        <p className={styles.headerDescription}>{projectsContent.header.description}</p>
      </section>

      {/* GitHub Stats Section */}
      <section className={styles.statsSection}>
        <h2 className={styles.sectionTitle}>{projectsContent.stats.title}</h2>
        <p className={styles.sectionDescription}>{projectsContent.stats.description}</p>
        <div className={styles.statsGrid}>
          <Card>
            <CardHeader>
              <CardTitle>Total Repositories</CardTitle>
              <CardDescription>Public repositories on GitHub</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={styles.statNumber}>{data.stats.totalRepos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Stars</CardTitle>
              <CardDescription>Stars received across all repositories</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={styles.statNumber}>{data.stats.totalStars}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Languages</CardTitle>
              <CardDescription>Programming languages used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={styles.languageTags}>
                {data.stats.languages.map((lang) => (
                  <span key={lang} className={styles.languageTag}>
                    {lang}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Projects Section */}
      <section className={styles.projectsSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>{projectsContent.projects.title}</h2>
          </div>
          <Button asChild>
            <a href={`https://github.com/${data.user.login}`} target="_blank" rel="noopener noreferrer">
              {projectsContent.projects.viewAll}
            </a>
          </Button>
        </div>
        <div className={styles.projectsGrid}>
          {data.repos.slice(0, 6).map((repo) => (
            <Card key={repo.name} className={styles.projectCard}>
              <CardHeader>
                <CardTitle className={styles.projectTitle}>{repo.name}</CardTitle>
                <CardDescription className={styles.projectDescription}>
                  {repo.description || 'No description available'}
                </CardDescription>
              </CardHeader>
              <CardContent className={styles.cardContent}>
                <div className={styles.projectMeta}>
                  <span className={styles.projectLanguage}>{repo.language}</span>
                  <span className={styles.projectStars}>⭐ {repo.stargazers_count}</span>
                  {repo.updated_at && (
                    <span className={styles.projectUpdated}>
                      Updated: {new Date(repo.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className={styles.projectTopics}>
                  {repo.topics.slice(0, 3).map((topic) => (
                    <span key={topic} className={styles.projectTopic}>
                      {topic}
                    </span>
                  ))}
                </div>
                <Button asChild className={styles.projectButton}>
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                    View Repository
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
} 