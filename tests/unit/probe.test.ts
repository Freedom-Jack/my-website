import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The live probe's rollback watch (features/landscape/probe.ts), R4 of 01-budgets.md as amended after P1: two rAF
 * deltas over the limit inside a rolling second hand the page back to its still; the limit is 33 ms during the
 * painting's own motion (a pan, an arrival, a sweep), 20 ms once settled, and 0 (not counted) while the engine is
 * deferred or pending for another reason. Run on a fake requestAnimationFrame and clock, with no DOM.
 */
type Frame = (t: number) => void;

describe('the rollback watch (probe.ts limitFor and watchFrames)', () => {
  let queue: Frame[] = [];
  let now = 0;
  beforeEach(() => {
    queue = [];
    now = 0;
    vi.stubGlobal('requestAnimationFrame', (f: Frame) => {
      queue.push(f);
      return queue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('performance', { now: () => now, mark: () => {} });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {},
    });
    vi.stubGlobal('addEventListener', () => {});
    vi.stubGlobal('removeEventListener', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Run the watch over frames `deltas` ms apart with `limitFor` answering for every frame; the onSlow calls. */
  async function run(deltas: number[], limitFor: () => number) {
    const { watchFrames } = await import('@/features/landscape/probe');
    queue = []; // (a stopped watch's last frame request is not this watch's)
    const calls: boolean[] = [];
    const stop = watchFrames((motion) => calls.push(motion), { limitFor });
    const tick = (d: number) => {
      now += d;
      const f = queue.shift();
      f?.(now);
    };
    tick(16); // the first frame after the wake sets the clock, no delta yet
    for (const d of deltas) tick(d);
    stop();
    return calls;
  }

  it('limitFor: 0 deferred or pending, 33 in the painting’s own motion, 20 settled', async () => {
    const { limitFor } = await import('@/features/landscape/probe');
    expect(limitFor({ deferred: true, panning: true })).toBe(0);
    expect(limitFor({ panning: true })).toBe(33);
    expect(limitFor({ arriving: true })).toBe(33);
    expect(limitFor({ sweeping: true, pending: true })).toBe(33);
    expect(limitFor({ pending: true })).toBe(0);
    expect(limitFor({})).toBe(20);
    expect(limitFor(null)).toBe(20);
  });
  it('two 34 ms frames during a pan return the still, and the mark names the motion', async () => {
    expect(await run([34, 34], () => 33)).toEqual([true]);
  });
  it('25 ms frames during a pan are within its limit', async () => {
    expect(await run([25, 25, 25, 25], () => 33)).toEqual([]);
  });
  it('two 25 ms frames once settled return the still (a slow place to read)', async () => {
    expect(await run([25, 25], () => 20)).toEqual([false]);
  });
  it('one slow frame alone is not two in a second', async () => {
    expect(await run([25, 16, 16, 16, 16], () => 20)).toEqual([]);
  });
  it('frames while the engine is pending or deferred are not counted', async () => {
    expect(await run([60, 60, 60], () => 0)).toEqual([]);
  });
  it('the second slow frame must fall within a rolling second of the first', async () => {
    // (a slow frame, then a second of good ones, then a slow one: the first has left the window)
    const good = Array.from({ length: 70 }, () => 16); // 1120 ms of 16 ms frames
    expect(await run([25, ...good, 25], () => 20)).toEqual([]);
    expect(await run([25, 16, 25], () => 20)).toEqual([false]);
  });
  it('the watch stops after it has spoken (one call, whatever follows)', async () => {
    expect(await run([34, 34, 34, 34], () => 33)).toEqual([true]);
  });
});
