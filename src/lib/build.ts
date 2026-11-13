import 'server-only';
import { execSync } from 'node:child_process';
import measured from '@content/measured.json' with { type: 'json' };

/**
 * The build stamp the tail prints (components/layout/Tail): the short commit the pages were built from and the day
 * they were built, read once at build time (the pages are static, so a visitor sees the build's own values); and the
 * measured numbers check:budgets wrote into content/measured.json from a passing run (Home's Lighthouse mobile LCP and
 * first-load transfer), if any, with their profile named. Nothing here is typed by hand.
 */
function shortSha(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

export interface BuildStamp {
  /** the short commit ("c974780"), or "local" where no repository answers */
  sha: string;
  /** the build day, ISO ("2026-11-12") */
  date: string;
  /** the measured LCP in ms and the profile it was measured under; null until CI writes it */
  lcpMs: number | null;
  profile: string;
  measuredOn: string | null;
  /** Home's first-load transfer in KB from the same run; null until CI writes it */
  transferKB: number | null;
}

export const build: BuildStamp = {
  sha: shortSha(),
  date: new Date().toISOString().slice(0, 10),
  lcpMs: typeof measured.lcpMs === 'number' ? measured.lcpMs : null,
  profile: measured.profile,
  measuredOn: typeof measured.measuredOn === 'string' ? measured.measuredOn : null,
  transferKB:
    'transferKB' in measured && typeof (measured as { transferKB?: unknown }).transferKB === 'number'
      ? (measured as { transferKB: number }).transferKB
      : null,
};
