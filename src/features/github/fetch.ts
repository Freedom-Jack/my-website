import 'server-only';
import overridesRaw from '@content/github/overrides.json';
import snapshot from '@content/github/snapshot.json';
import { choose, group, type Groups, parseOverrides, repoSchema, USER } from './rules';

/**
 * Jack's public repositories, read on the server only: at build time, then again at most once a day (the Work
 * page revalidates every 24 h). The visitor's browser never calls GitHub (Jack: "don't slow down the website just
 * for live updating repos"). GITHUB_TOKEN (optional, server-side) raises the API's rate limit. If GitHub cannot be
 * reached, the committed snapshot (content/github/snapshot.json) stands in, so the page always builds.
 */
const API = `https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`;
export const REVALIDATE = 86400;

export async function openSource(): Promise<Groups & { source: 'github' | 'snapshot'; fetched: string }> {
  const overrides = parseOverrides(overridesRaw);
  try {
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch(API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'qijinxu-site-build',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const repos = repoSchema.array().parse(await res.json());
    const fetched = new Date().toISOString();
    return { ...group(choose(repos, overrides, fetched)), source: 'github', fetched };
  } catch (err) {
    console.warn(`In the open: GitHub unavailable (${String(err)}); using the snapshot of ${snapshot.fetched}`);
    const repos = repoSchema.array().parse(snapshot.repos);
    return { ...group(choose(repos, overrides, snapshot.fetched)), source: 'snapshot', fetched: snapshot.fetched };
  }
}
