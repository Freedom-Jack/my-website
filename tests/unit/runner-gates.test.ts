import { describe, expect, it } from 'vitest';
import { RUNNER_MOBILE_GATES as G } from '../../tools/runner-gates.ts';

/**
 * The runner's gates (tools/runner-gates.ts) against every Lighthouse mobile run CI measured on PR #29's first three
 * budget runs (2026-11-14, five runs a route; score, LCP ms, TBT ms; the runner's benchmark index beside each), copied
 * from their budgets-report artifacts. The same pages moved with the runner's CPU; the gates must clear every run, and a
 * page that really is slow must still fail them.
 */
type Runs = { score: number[]; lcp: number[]; tbt: number[] };
const CI: Record<string, { bi: number; routes: Record<string, Runs> }> = {
  '309af1f': {
    bi: 2584,
    routes: {
      '/': { score: [99, 99, 99, 99, 96], lcp: [1956, 1967, 1960, 1961, 2605], tbt: [71, 67, 67, 68, 72] },
      '/work/': { score: [94, 94, 94, 94, 94], lcp: [2900, 2897, 2900, 2908, 2901], tbt: [139, 134, 138, 146, 140] },
      '/work/rag-assistant/': {
        score: [99, 99, 99, 99, 97],
        lcp: [1963, 1961, 1963, 1966, 2415],
        tbt: [71, 73, 71, 75, 71],
      },
      '/writing/': { score: [99, 97, 99, 97, 99], lcp: [1890, 2530, 1890, 2537, 1812], tbt: [71, 71, 69, 74, 75] },
      '/writing/what-is-an-ai-agent/': {
        score: [99, 99, 99, 99, 96],
        lcp: [2036, 2041, 1963, 2036, 2602],
        tbt: [73, 69, 73, 69, 71],
      },
      '/resume/': { score: [99, 99, 96, 99, 99], lcp: [1964, 1962, 2611, 1959, 1961], tbt: [71, 69, 76, 73, 69] },
      '/contact/': { score: [97, 99, 97, 99, 99], lcp: [2524, 1892, 2549, 1815, 1811], tbt: [69, 73, 81, 72, 71] },
    },
  },
  '672c44d': {
    bi: 3835,
    routes: {
      '/': { score: [97, 99, 97, 99, 97], lcp: [2572, 1960, 2567, 1960, 2570], tbt: [57, 54, 54, 56, 55] },
      '/work/': { score: [99, 99, 99, 99, 99], lcp: [1062, 1062, 1058, 1057, 1059], tbt: [117, 108, 111, 109, 109] },
      '/work/rag-assistant/': {
        score: [99, 97, 99, 97, 99],
        lcp: [1967, 2568, 1960, 2576, 1965],
        tbt: [56, 53, 56, 58, 56],
      },
      '/writing/': { score: [97, 99, 98, 98, 98], lcp: [2503, 1959, 2499, 2492, 2491], tbt: [59, 54, 56, 54, 53] },
      '/writing/what-is-an-ai-agent/': {
        score: [97, 97, 99, 97, 99],
        lcp: [2583, 2037, 1961, 2570, 2108],
        tbt: [60, 152, 55, 56, 55],
      },
      '/resume/': { score: [99, 99, 97, 97, 99], lcp: [1959, 1960, 2571, 2565, 1965], tbt: [52, 55, 55, 53, 55] },
      '/contact/': { score: [100, 98, 97, 97, 97], lcp: [1885, 2496, 2503, 2513, 2511], tbt: [54, 56, 60, 63, 61] },
    },
  },
  '795e552': {
    bi: 2077,
    routes: {
      '/': { score: [96, 99, 96, 96, 99], lcp: [2644, 1962, 2648, 2634, 1960], tbt: [89, 87, 92, 86, 86] },
      '/work/': { score: [98, 99, 98, 98, 98], lcp: [1060, 1059, 1060, 1060, 1059], tbt: [172, 101, 171, 176, 177] },
      '/work/rag-assistant/': {
        score: [98, 99, 97, 99, 98],
        lcp: [1966, 1965, 1965, 1970, 1970],
        tbt: [110, 101, 174, 99, 142],
      },
      '/writing/': { score: [96, 99, 96, 96, 99], lcp: [2568, 1890, 2565, 2569, 1895], tbt: [107, 97, 102, 100, 100] },
      '/writing/what-is-an-ai-agent/': {
        score: [96, 96, 99, 99, 99],
        lcp: [2646, 2662, 2039, 1962, 2041],
        tbt: [107, 120, 105, 99, 100],
      },
      '/resume/': { score: [99, 96, 99, 96, 96], lcp: [1962, 2642, 1964, 2642, 2647], tbt: [99, 104, 99, 104, 109] },
      '/contact/': { score: [96, 96, 97, 96, 96], lcp: [2564, 2567, 2491, 2569, 2565], tbt: [98, 103, 102, 106, 99] },
    },
  },
};
const BUDGET = { score: 95, lcp: 2500, tbt: 150 };
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
/** 309af1f's Work: the late sharp still (fixed at 672c44d), a page slow in every run. */
const isLateStill = (sha: string, route: string) => sha === '309af1f' && route === '/work/';
const every = () =>
  Object.entries(CI).flatMap(([sha, { routes }]) =>
    Object.entries(routes)
      .filter(([route]) => !isLateStill(sha, route))
      .map(([route, runs]) => ({ where: `${sha} ${route}`, ...runs })),
  );

describe('the runner’s gates (tools/runner-gates.ts)', () => {
  it('the budget’s own gates flip with the runner on the same pages: three of them failed at 672c44d and 795e552', () => {
    expect(median(CI['672c44d']!.routes['/']!.lcp)).toBeGreaterThan(BUDGET.lcp);
    expect(median(CI['672c44d']!.routes['/contact/']!.lcp)).toBeGreaterThan(BUDGET.lcp);
    expect(median(CI['795e552']!.routes['/work/']!.tbt)).toBeGreaterThan(BUDGET.tbt);
    // (the same Work page, three runners: TBT rises as the benchmark falls)
    const work = ['672c44d', '309af1f', '795e552'].map((s) => [CI[s]!.bi, median(CI[s]!.routes['/work/']!.tbt)]);
    expect(work.map(([bi]) => bi)).toEqual([...work.map(([bi]) => bi)].sort((a, b) => b! - a!));
    expect(work.map(([, tbt]) => tbt)).toEqual([...work.map(([, tbt]) => tbt)].sort((a, b) => a! - b!));
  });
  it('clear every run CI has measured, not just the medians', () => {
    for (const r of every()) {
      expect(Math.min(...r.score), r.where).toBeGreaterThanOrEqual(G.score);
      expect(Math.max(...r.lcp), r.where).toBeLessThanOrEqual(G.lcp);
      expect(Math.max(...r.tbt), r.where).toBeLessThanOrEqual(G.tbt);
    }
  });
  it('with a margin over the slowest runner seen', () => {
    const all = every();
    expect(G.lcp - Math.max(...all.flatMap((r) => r.lcp))).toBeGreaterThanOrEqual(100);
    expect(G.tbt - Math.max(...all.flatMap((r) => r.tbt))).toBeGreaterThanOrEqual(50);
    expect(Math.min(...all.flatMap((r) => r.score)) - G.score).toBeGreaterThanOrEqual(5);
  });
  it('still fail a page slow in both of Lantern’s modes (Work’s late sharp still at 309af1f)', () => {
    expect(median(CI['309af1f']!.routes['/work/']!.lcp)).toBeGreaterThan(G.lcp);
  });
  it('are looser than the budget only where the CPU moves the number; the release step keeps the budget', () => {
    expect(G.score).toBeLessThan(BUDGET.score);
    expect(G.lcp).toBeGreaterThan(BUDGET.lcp);
    expect(G.tbt).toBeGreaterThan(BUDGET.tbt);
  });
});
