import { describe, expect, it } from 'vitest';
import { RUNNER_MOBILE_LCP_MS } from '../../tools/lcp-gate.ts';

/**
 * CI's mobile LCP gate (tools/lcp-gate.ts) against the runs it was set from: Lighthouse mobile, five runs a route, ms.
 * On GitHub's runner a page whose LCP is an image falls in either of Lantern's two modes from run to run, so the gate
 * must clear the slow mode; on this Mac the slow mode takes every run and stays under the budget's 2.5 s.
 */
const BUDGET = 2500;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const CI_RUNS = {
  // 309af1f (runner benchmark index 2584)
  home309: [1956, 1967, 1960, 1961, 2605],
  note309: [2036, 2041, 1963, 2036, 2602],
  resume309: [1964, 1962, 2611, 1959, 1961],
  writing309: [1890, 2530, 1890, 2537, 1812],
  contact309: [2524, 1892, 2549, 1815, 1811],
  // 672c44d (runner benchmark index 3834)
  home672: [2572, 1960, 2567, 1960, 2570],
  case672: [1967, 2568, 1960, 2576, 1965],
  note672: [2583, 2037, 1961, 2570, 2108],
  resume672: [1959, 1960, 2571, 2565, 1965],
  writing672: [2503, 1959, 2499, 2492, 2491],
  contact672: [1885, 2496, 2503, 2513, 2511],
  work672: [1062, 1062, 1058, 1057, 1059],
};
const MAC_RUNS = { home: [2456, 2455, 2453, 2454, 2455], resume: [2452, 2455, 2456, 2453, 2452] };

describe('CI’s mobile LCP gate (tools/lcp-gate.ts)', () => {
  it('the budget’s 2.5 s on the median flips with the coin on the runner: Home and Contact failed at 672c44d', () => {
    expect(median(CI_RUNS.home309)).toBeLessThanOrEqual(BUDGET);
    expect(median(CI_RUNS.home672)).toBeGreaterThan(BUDGET);
    expect(median(CI_RUNS.contact672)).toBeGreaterThan(BUDGET);
  });
  it('the runner’s gate clears every run CI has measured, either mode, not just the medians', () => {
    for (const [route, runs] of Object.entries(CI_RUNS))
      expect(Math.max(...runs), route).toBeLessThanOrEqual(RUNNER_MOBILE_LCP_MS);
  });
  it('and keeps a margin over the slowest of them (a slower runner, a little more script)', () => {
    const slowest = Math.max(...Object.values(CI_RUNS).flat());
    expect(RUNNER_MOBILE_LCP_MS - slowest).toBeGreaterThanOrEqual(75);
  });
  it('on the Mac the slow mode takes every run and stays under the budget: the release step keeps 2.5 s', () => {
    for (const runs of Object.values(MAC_RUNS)) {
      expect(Math.min(...runs)).toBeGreaterThan(2400); // (no fast-mode run: gating the fastest would not help)
      expect(median(runs)).toBeLessThanOrEqual(BUDGET);
    }
  });
  it('a page slow in both modes still fails it (Work’s late sharp still at 309af1f)', () => {
    expect(median([2900, 2897, 2900, 2908, 2901])).toBeGreaterThan(RUNNER_MOBILE_LCP_MS);
  });
});
