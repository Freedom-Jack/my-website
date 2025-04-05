import { NextResponse } from 'next/server';
import { getGitHubStats } from '@/lib/github';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const username = process.env.GITHUB_USERNAME;
    if (!username) {
      return NextResponse.json(
        { error: 'GitHub username not configured' },
        { status: 500 }
      );
    }

    const data = await getGitHubStats(username);
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Pragma': 'no-cache'
      }
    });
  } catch (error) {
    console.error('GitHub API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GitHub data' },
      { status: 500 }
    );
  }
} 