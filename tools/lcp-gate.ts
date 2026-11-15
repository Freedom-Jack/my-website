/**
 * The mobile LCP gate on GitHub's runner (tools/check-budgets.ts --lcp-both-modes, passed by CI), and why it is not
 * the budget's 2.5 s there.
 *
 * Lighthouse's simulated LCP (Lantern) is bimodal on a page whose LCP element is an image: the inline sharp seed
 * painted in the first frame (Home, a case, a note, the Résumé) or the fetched phone still painted with it or just
 * after it (Writing, Contact). For an image LCP Lantern counts as render-blocking every script that finished loading and
 * began to run before the observed paint. App Router's chunks are async and never block that paint, but in Lighthouse's
 * unthrottled recording React's chunk starts to run within a millisecond or two of the first frame's presentation:
 * before it in some runs, after it in others. A text LCP painted in the first frame is spared, since Lantern takes the
 * FCP estimate for it (Work: 1.06 s in every run).
 *
 * What the two modes measured, Lighthouse mobile, the same pages and bytes:
 *   - CI (2026-11-14, two runners, PR #29, traces kept): the fast mode 1.81 to 1.97 s on every route; the slow mode
 *     2.57 to 2.61 s on the image routes and 2.49 to 2.55 s on Writing and Contact; which mode a run falls in is a coin
 *     toss, so three slow runs of five put a median over 2.5 s (Home 2.57 s, Contact 2.50 s on 672c44d);
 *   - this Mac (the release step): the slow mode is 2.45 s and took all five runs on Home and the Résumé, so the fast
 *     mode cannot be relied on to show up at all (gating the fastest run would fail a fast runner just the same).
 *
 * So CI's gate sits above the slow mode, on the median: 2.7 s, which no coin toss flips at today's size and which still
 * fails a page that adds about 0.1 s to the slow mode (some 20 KB more script before the paint) or slows its first
 * frame. The release step on this Mac keeps the budget's 2.5 s; both modes stay in the report (min–max beside the
 * median).
 */
export const RUNNER_MOBILE_LCP_MS = 2700;
