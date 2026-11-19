import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The live probe's rollback watch (features/landscape/probe.ts), R4 of 01-budgets.md as amended after P1: two rAF
 * deltas over the limit inside a rolling second hand the page back to its still; the limit is 33 ms during the
 * painting's own motion (a pan, an arrival, a sweep), 20 ms once settled, and 0 (not counted) while the engine is
 * pending for another reason. Run on a fake requestAnimationFrame and clock, with no DOM.
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

  it('limitFor: 0 pending, 33 in the painting’s own motion, 20 settled', async () => {
    const { limitFor } = await import('@/features/landscape/probe');
    expect(limitFor({ panning: true })).toBe(33);
    expect(limitFor({ arriving: true })).toBe(33);
    expect(limitFor({ sweeping: true, pending: true })).toBe(33);
    expect(limitFor({ pending: true })).toBe(0);
    expect(limitFor({})).toBe(20);
    expect(limitFor(null)).toBe(20);
  });
  it('two 34 ms frames during a pan return the still, and onSlow says they were motion', async () => {
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
  it('frames while the engine is pending are not counted', async () => {
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

/**
 * The GPU check (probe.ts gpuOK and softwareRenderer): the caveat's null, and a renderer named as software, keep the
 * still. Headless Chrome on a GPU-less machine (CI's runner) hands WebGL a SwiftShader context with no caveat: on
 * 2026-11-14 the probe passed there and the engine booted on it. Run on a fake canvas, with no DOM.
 */
describe('the GPU check (probe.ts gpuOK and softwareRenderer)', () => {
  const RENDERER = 0x1f01;
  const UNMASKED = 0x9246; // WEBGL_debug_renderer_info.UNMASKED_RENDERER_WEBGL
  const SWIFTSHADER =
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)';
  const METAL = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)';
  /** The page's canvas: a WebGL2 context whose RENDERER (and unmasked renderer) answer as given; null = refused. */
  function fakeCanvas(ctx: { renderer: string; unmasked?: string } | null) {
    const lost: string[] = [];
    const asked: unknown[] = [];
    const gl =
      ctx === null
        ? null
        : {
            RENDERER,
            getParameter: (p: number) =>
              p === RENDERER ? ctx.renderer : p === UNMASKED ? (ctx.unmasked ?? null) : null,
            getExtension: (n: string) =>
              n === 'WEBGL_debug_renderer_info' && ctx.unmasked !== undefined
                ? { UNMASKED_RENDERER_WEBGL: UNMASKED }
                : n === 'WEBGL_lose_context'
                  ? { loseContext: () => lost.push('lost') }
                  : null,
          };
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: (type: string, opts: unknown) => {
          asked.push([type, opts]);
          return gl;
        },
      }),
    });
    return { lost, asked };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('softwareRenderer: the software rasterisers by name, and no hardware GPU among them', async () => {
    const { softwareRenderer } = await import('@/features/landscape/probe');
    for (const name of [
      SWIFTSHADER,
      'Google SwiftShader',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'softpipe',
      'Microsoft Basic Render Driver',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Apple Software Renderer',
      'Mesa Offscreen',
      'D3D11 WARP',
    ])
      expect(softwareRenderer(name), name).toBe(true);
    for (const name of [
      METAL,
      'Apple GPU',
      'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Adreno (TM) 740',
      'Mali-G78 MC14',
      'Mesa Intel(R) Xe Graphics (TGL GT2)',
    ])
      expect(softwareRenderer(name), name).toBe(false);
  });
  it('a hardware GPU behind the masked RENDERER passes, and the probe context is lost at once', async () => {
    const { gpuOK } = await import('@/features/landscape/probe');
    const f = fakeCanvas({ renderer: 'WebKit WebGL', unmasked: METAL });
    expect(gpuOK()).toBe(true);
    expect(f.asked).toEqual([['webgl2', { failIfMajorPerformanceCaveat: true, antialias: false, depth: false }]]);
    expect(f.lost).toEqual(['lost']);
  });
  it('the caveat refused: the still', async () => {
    const { gpuOK } = await import('@/features/landscape/probe');
    fakeCanvas(null);
    expect(gpuOK()).toBe(false);
  });
  it('SwiftShader with no caveat (headless Chrome without a GPU): the still, and the context is lost', async () => {
    const { gpuOK } = await import('@/features/landscape/probe');
    const f = fakeCanvas({ renderer: 'WebKit WebGL', unmasked: SWIFTSHADER });
    expect(gpuOK()).toBe(false);
    expect(f.lost).toEqual(['lost']);
  });
  it('a RENDERER that names the GPU (Firefox) is read as it is, without the debug extension', async () => {
    const { gpuOK } = await import('@/features/landscape/probe');
    fakeCanvas({ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' });
    expect(gpuOK()).toBe(false);
    fakeCanvas({ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' });
    expect(gpuOK()).toBe(true);
  });
  it('no name to read (the debug extension withheld): the caveat’s answer stands', async () => {
    const { gpuOK } = await import('@/features/landscape/probe');
    fakeCanvas({ renderer: 'WebKit WebGL' });
    expect(gpuOK()).toBe(true);
  });
});
