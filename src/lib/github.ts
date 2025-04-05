import { Octokit } from '@octokit/rest';

// Initialize Octokit with your GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  updated_at: string | null;
  homepage: string | null;
  fork: boolean;
  size: number;
  visibility: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  name: string | null;
  company: string | null;
  location: string | null;
}

export async function getGitHubUser(username: string): Promise<GitHubUser> {
  const { data } = await octokit.users.getByUsername({ username });
  return data;
}

export async function getGitHubRepos(username: string): Promise<GitHubRepo[]> {
  const { data } = await octokit.repos.listForUser({
    username,
    sort: 'updated',
    per_page: 100,
  });
  
  return data.map(repo => ({
    name: repo.name,
    description: repo.description,
    html_url: repo.html_url,
    stargazers_count: repo.stargazers_count || 0,
    language: repo.language || null,
    topics: repo.topics || [],
    updated_at: repo.updated_at || null,
    homepage: repo.homepage || null,
    fork: repo.fork,
    size: repo.size || 0,
    visibility: repo.visibility || 'public'
  }));
}

export async function getGitHubStats(username: string) {
  const [user, repos] = await Promise.all([
    getGitHubUser(username),
    getGitHubRepos(username),
  ]);

  // Filter out forked repositories and sort by attractiveness
  const originalRepos = repos
    .filter(repo => !repo.fork)
    .sort((a, b) => {
      // First, sort by stars
      const starDiff = b.stargazers_count - a.stargazers_count;
      if (starDiff !== 0) return starDiff;

      // If stars are equal, sort by most recently updated
      if (a.updated_at && b.updated_at) {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
      return 0;
    });

  return {
    user,
    repos: originalRepos,
    stats: {
      totalRepos: originalRepos.length,
      totalStars: originalRepos.reduce((acc, repo) => acc + repo.stargazers_count, 0),
      languages: Array.from(new Set(originalRepos.map(repo => repo.language).filter(Boolean))),
      totalSize: originalRepos.reduce((acc, repo) => acc + repo.size, 0),
    },
  };
} 