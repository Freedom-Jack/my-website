/**
 * The runner's gates (tools/check-budgets.ts --runner, passed by CI): the three Lighthouse mobile gates that move with
 * the machine's CPU, set for GitHub's shared runner. Everything else CI gates at the budget itself.
 *
 * Lighthouse simulates a mid-tier phone from the machine it runs on: it records the page unthrottled, then multiplies
 * the CPU time it saw by four. GitHub's runners differ by almost 2× from one job to the next (benchmark index 2077 to
 * 3835 over PR #29's first three budget runs, 2026-11-14), and the same page moved with them:
 *   - TBT is React's chunk (its evaluation and hydration, 40 to 55 ms of real CPU there, the same on every route) times
 *     four, less 50 ms, counted once or twice by Lantern's windows: Work 109, 139 and 171 ms on the three runners for one
 *     page (Work loads no image to delay the chunk in the simulation, so both windows count it; the other routes 55 to
 *     110 ms);
 *   - LCP, where the LCP element is an image, falls in one of Lantern's two modes from run to run on a millisecond's race
 *     (Lantern counts every script that began to run before the observed paint as blocking an image LCP, and React's
 *     async chunk starts within a millisecond or two of the first frame's presentation): the fast mode 1.81 to 1.97 s on
 *     every route, the slow mode 2.57 to 2.66 s on the image routes, rising as the runner slows; a text LCP painted in
 *     the first frame is spared (Lantern takes the FCP estimate for it: Work, 1.06 s in every run);
 *   - the score follows them: 96 at worst.
 * The gates that do not move with the CPU never came near their budget there: desktop score 100, desktop LCP at most
 * 0.64 s, mobile FCP and Speed Index at most 1.06 s, CLS 0, and the weights are the bytes themselves.
 *
 * So on the runner the three gates take the slowest of those three runs with a margin, enough for a runner about a third
 * slower than the slowest seen (by the trend over the three: TBT about 35 + 280,000 / index ms, the slow mode about
 * 2.48 + 339 / index s), short of the index of 1,000 below which Lighthouse itself warns that the host is too slow:
 *   score 90 (Lighthouse's own green), LCP 2.8 s, TBT 250 ms.
 * The release step on this Mac (benchmark index about 4,600) keeps the budget's own 95, 2.5 s and 150 ms; there the slow
 * mode is 2.45 s and took every run on Home and the Résumé, so gating the fastest run instead would not hold either.
 */
export const RUNNER_MOBILE_GATES = { score: 90, lcp: 2800, tbt: 250 } as const;
