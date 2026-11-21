/**
 * The speed check, measured on the QA build, on this machine's real GPU, with the machine quiet. Not run in CI.
 *
 * It knows the bar from the guides. THE BAR is AGENTS.md's performance section; a miss fails the run (exit 1):
 *   on a phone (390 px, CPU 4× slower, slow 4G): LCP at most 2.5 s, CLS at most 0.05, no task over 100 ms, INP at
 *   most 200 ms, under 2 % of scroll frames over 20 ms; Lighthouse mobile at least 95, desktop at least 99; nothing
 *   runs when nothing moves; on the laptop no scroll lag and never a frozen tab.
 * Everything else it measures is A GUIDE: reported, marked as a guide, never failing the run (byte sizes, request
 * and font counts, Lighthouse's own simulated LCP, CLS, FCP, Speed Index and TBT, the heap, the still's time, the
 * frames of a page change, the laptop's load).
 *
 * What it measures, on every kind of page (ROUTES):
 *   1. the HTML as served (gzip bytes): a guide;
 *   2. Lighthouse, mobile and desktop presets, five runs per route and preset after a warm-up, the median per metric:
 *      the score is the bar; what the score is made of (its simulated LCP, CLS, FCP, Speed Index, TBT) and the
 *      first load's bytes and requests are guides;
 *   3. the phone profile (Playwright and CDP: 390 × 844 at DPR 2, CPU 4× slower, slow 4G; the still is the painting
 *      and no engine byte is fetched), one visit per route: the load and six seconds after it (LCP, CLS, every long
 *      task), a scripted scroll from top to bottom in four seconds (the gaps between frames), then two real
 *      interactions with their INP: the Ask sheet opened from its door, and a tap on a nav word, which is also the
 *      travel to another place (its frames and long tasks until the new page has settled), then a second, longer
 *      travel with the strip already fetched (the flight);
 *   4. the laptop profile (1440 × 900 at DPR 2, nothing throttled, the page's own probe deciding: the live painting):
 *      the same visit: the load and eight seconds after it, the scroll with the live painting, the door, and the two
 *      travels, which are the engine's pans;
 *   5. the idle page, phone and laptop: every route opened and left alone; from IDLE_AFTER seconds after its load
 *      (the plates' small life sleeps a minute after the last input), ten seconds in which it must ask for no frame
 *      (requestAnimationFrame calls are counted), run no long task and have no time-driven animation running.
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && npm start -- -p 3100    the QA build
 *   npm run check:budgets                                         everything (about 25 minutes)
 *   npm run check:budgets -- --routes /,/work/ --runs 1           some routes, one Lighthouse run each
 *   npm run check:budgets -- --only phone,laptop                  some parts: html, lighthouse, phone, laptop, idle
 *   npm run check:budgets -- --forms mobile                       one Lighthouse preset
 *   npm run check:budgets -- --idle-after 70                      seconds an idle page is left before it is counted
 *   npm run check:budgets -- --base <url>                         another server (default http://127.0.0.1:3100)
 *   npm run check:budgets -- --out <dir>                          the report's folder (default budgets-report/)
 *   npm run check:budgets -- --write                              when the whole check ran, the bar holds and
 *                                                                 Home's Lighthouse mobile LCP is within 2.5 s,
 *                                                                 write Home's numbers into content/measured.json
 *                                                                 (the tail's build stamp prints them)
 *
 * How to read it. The scripted scroll and the travel record the gaps between requestAnimationFrame callbacks: the
 * main thread's cadence, not the compositor's. A Lighthouse run whose TBT is over 1 s is re-run once and reported as
 * an outlier. Lighthouse runs first: the profile runs can disturb a run that follows them. The warm-up (one request
 * per route, then two seconds) keeps a cold route's first render out of the runs. Every Lighthouse trace is kept for
 * a route and preset that misses, and for every outlier. An interaction that does not happen (the door does not
 * open, the page does not change) is a miss, never a silent pass.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { flag, opt } from './lib.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const ROOT = process.cwd();
const BASE = opt('--base', 'http://127.0.0.1:3100').replace(/\/$/, '');
const RUNS = Number(opt('--runs', '5'));
const OUT = path.resolve(ROOT, opt('--out', 'budgets-report'));
/** Every kind of page: Home, Work, a case (one with a live piece), Writing, the note, the Résumé, Contact, the 404. */
const ALL_ROUTES =
  '/,/about/,/work/,/work/rag-assistant/,/writing/,/writing/what-is-an-ai-agent/,/resume/,/contact/,/no-such-page/';
const ROUTES = opt('--routes', ALL_ROUTES).split(',');
const PARTS = ['html', 'lighthouse', 'phone', 'laptop', 'idle'] as const;
type Part = (typeof PARTS)[number];
const ONLY = opt('--only', PARTS.join(','))
  .split(',')
  .filter((p): p is Part => (PARTS as readonly string[]).includes(p));
const runs = (p: Part) => ONLY.includes(p);
const FORMS = opt('--forms', 'mobile,desktop')
  .split(',')
  .filter((f): f is 'mobile' | 'desktop' => f === 'mobile' || f === 'desktop');
const IDLE_AFTER = Number(opt('--idle-after', '70')) * 1000;
const IDLE_WINDOW = 10_000;
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GPU_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [];
const OUTLIER_TBT = 1000;
const KB = 1024;

// ------------------------------------------------------------------------------------------------ the bar, the guides
/** THE BAR (AGENTS.md, "Performance"): a miss fails the run. */
const BAR = {
  /** on a phone: the phone profile, and Lighthouse's mobile preset where it measures the same thing */
  lcp: 2500,
  cls: 0.05,
  longTask: 100,
  inp: 200,
  scrollOver20: 0.02,
  lighthouseMobile: 95,
  lighthouseDesktop: 99,
  /** nothing runs when nothing moves: frames asked for, long tasks and time-driven animations in the idle window */
  idle: 0,
} as const;
/** GUIDES: reported against these marks, never failing the run. */
const GUIDE = {
  html: 30_000, // served gzip, every route
  mobile: { fcp: 1800, si: 3000, tbt: 150 },
  desktop: { lcp: 1200, cls: 0.05 },
  css: 35 * KB,
  js: 160 * KB,
  fontsBeforeLcp: { files: 2, bytes: 45 * KB },
  fonts: { files: 4, bytes: 90 * KB },
  firstLoad: 250 * KB,
  requests: 15,
  heapMB: 20,
  stillMs: 1500,
  /** a page change: no number in AGENTS.md; the frame watch's own allowance in motion is 33 ms (probe.ts) */
  travelOver33: 0.02,
  laptopLcp: 1200,
} as const;

const slug = (r: string) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '-'));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const s2 = (v: number) => `${(v / 1000).toFixed(2)} s`;
const kb = (v: number) => `${Math.round(v / KB)} KB`;
const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Check {
  kind: 'bar' | 'guide';
  /** what is measured, the same words for every route (the summary groups by it) */
  id: string;
  where: string;
  /** the value as a number (for the worst of a group) and as it is printed */
  value: number;
  shown: string;
  limit: string;
  ok: boolean;
  /** true: more is better (a score) */
  up?: boolean;
}
const checks: Check[] = [];
/** Every Lighthouse run's benchmark index (its measure of the machine's CPU): the report names their median. */
const benchmarks: number[] = [];
const check = (c: Check) => {
  checks.push(c);
  return c.ok;
};
const atMost = (
  kind: Check['kind'],
  id: string,
  where: string,
  value: number,
  limit: number,
  fmt: (v: number) => string,
) => check({ kind, id, where, value, shown: fmt(value), limit: `at most ${fmt(limit)}`, ok: value <= limit });
const atLeast = (kind: Check['kind'], id: string, where: string, value: number, limit: number) =>
  check({ kind, id, where, value, shown: String(value), limit: `at least ${limit}`, ok: value >= limit, up: true });
/** Something that had to happen for a measurement to mean anything (an interaction, a page change): a bar miss. */
const must = (id: string, where: string, ok: boolean, what: string) =>
  check({ kind: 'bar', id, where, value: ok ? 0 : 1, shown: ok ? 'yes' : what, limit: 'it happens', ok });
const ms = (v: number) => `${Math.round(v)} ms`;
const n0 = (v: number) => String(Math.round(v));

// ------------------------------------------------------------------------------------------------ the HTML, served
function served(url: string): Promise<{ bytes: number; encoding: string; status: number }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers: { 'accept-encoding': 'gzip' } }, (res) => {
        let bytes = 0;
        res.on('data', (c: Buffer) => (bytes += c.length));
        res.on('end', () =>
          resolve({
            bytes,
            encoding: String(res.headers['content-encoding'] ?? 'identity'),
            status: res.statusCode ?? 0,
          }),
        );
      })
      .on('error', reject);
  });
}

// ------------------------------------------------------------------------------------------------ Lighthouse
interface LhRun {
  score: number;
  fcp: number;
  lcp: number;
  si: number;
  tbt: number;
  cls: number;
  maxTask: number;
  total: number;
  html: number;
  css: number;
  js: number;
  fonts: number;
  fontFiles: number;
  fontsBeforeLcp: number;
  fontFilesBeforeLcp: number;
  requests: number;
  lcpEl: string;
}
function metricsOf(lhr: Json): LhRun {
  const a = lhr.audits as Json;
  const num = (id: string) => Number(a[id]?.numericValue ?? NaN);
  const obs = (a.metrics?.details?.items?.[0] ?? {}) as Json;
  const load = Number(obs.observedLoad ?? Infinity);
  const lcpAt = Number(obs.observedLargestContentfulPaint ?? Infinity);
  const reqs = ((a['network-requests']?.details?.items ?? []) as Json[]).filter(
    (r) => !String(r.url).startsWith('data:'),
  );
  // the first load: every request started before the load event (the engine is asked for after it, at idle)
  const first = reqs.filter((r) => Number(r.networkRequestTime ?? r.startTime ?? 0) <= load);
  const sum = (rs: Json[]) => rs.reduce((n, r) => n + Number(r.transferSize ?? 0), 0);
  const of = (rs: Json[], type: string) => rs.filter((r) => r.resourceType === type);
  const fontsFirst = of(first, 'Font');
  const fontsBefore = fontsFirst.filter((r) => Number(r.networkEndTime ?? Infinity) <= lcpAt);
  const longTasks = (a['long-tasks']?.details?.items ?? []) as Json[];
  // (the LCP element's node, wherever this Lighthouse puts it: the old audit or the LCP insights)
  const findNode = (x: unknown): string => {
    if (!x || typeof x !== 'object') return '';
    const o = x as Json;
    if (o.type === 'node' && typeof o.snippet === 'string') return o.snippet as string;
    for (const v of Object.values(o)) {
      const f = findNode(v);
      if (f) return f;
    }
    return '';
  };
  const lcpEl =
    findNode(a['largest-contentful-paint-element']?.details) ||
    findNode(a['lcp-breakdown-insight']?.details) ||
    findNode(a['lcp-discovery-insight']?.details);
  return {
    score: Math.round(Number(lhr.categories?.performance?.score ?? 0) * 100),
    fcp: num('first-contentful-paint'),
    lcp: num('largest-contentful-paint'),
    si: num('speed-index'),
    tbt: num('total-blocking-time'),
    cls: num('cumulative-layout-shift'),
    maxTask: longTasks.reduce((m, t) => Math.max(m, Number(t.duration ?? 0)), 0),
    total: sum(first),
    html: sum(of(first, 'Document')),
    css: sum(of(first, 'Stylesheet')),
    js: sum(of(first, 'Script')),
    fonts: sum(fontsFirst),
    fontFiles: fontsFirst.length,
    fontsBeforeLcp: sum(fontsBefore),
    fontFilesBeforeLcp: fontsBefore.length,
    requests: first.length,
    lcpEl: String(lcpEl).replace(/\s+/g, ' ').slice(0, 140),
  };
}
const NUMERIC: Array<Exclude<keyof LhRun, 'lcpEl'>> = [
  'score',
  'fcp',
  'lcp',
  'si',
  'tbt',
  'cls',
  'maxTask',
  'total',
  'html',
  'css',
  'js',
  'fonts',
  'fontFiles',
  'fontsBeforeLcp',
  'fontFilesBeforeLcp',
  'requests',
];
/** Worse is higher, except the score. */
const worstOf = (all: LhRun[], k: Exclude<keyof LhRun, 'lcpEl'>) =>
  k === 'score' ? Math.min(...all.map((r) => r[k])) : Math.max(...all.map((r) => r[k]));

interface LhRow {
  form: 'mobile' | 'desktop';
  route: string;
  median: LhRun;
  worst: Partial<LhRun>;
  /** LCP's spread over the runs: both of Lantern's modes, when there are two, beside the median. */
  lcpMin: number;
  lcpMax: number;
  runs: Array<Pick<LhRun, 'score' | 'lcp' | 'tbt'>>;
  outliers: Array<Pick<LhRun, 'score' | 'lcp' | 'tbt'>>;
}

async function lighthouseAll(routes: string[]): Promise<LhRow[]> {
  const chromePath = process.env.CHROME_PATH || (existsSync(MAC_CHROME) ? MAC_CHROME : chromium.executablePath());
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-first-run', ...GPU_ARGS],
  });
  const rows: LhRow[] = [];
  try {
    for (const form of FORMS)
      for (const route of routes) {
        const all: LhRun[] = [];
        const outliers: LhRun[] = [];
        const traces: Array<[string, unknown]> = [];
        const reports = new Map<LhRun, string>();
        const once = async (i: number, tag: string) => {
          const res = await lighthouse(
            BASE + route,
            { port: chrome.port, output: 'json', onlyCategories: ['performance'], logLevel: 'error' },
            form === 'desktop' ? desktopConfig : undefined,
          );
          if (!res?.lhr?.categories?.performance) throw new Error(`no Lighthouse result: ${form} ${route}`);
          traces.push([`${form}-${slug(route)}-run${i + 1}${tag}`, (res.artifacts as Json | undefined)?.Trace]);
          const m = metricsOf(res.lhr as unknown as Json);
          const bi = Number((res.lhr as unknown as Json).environment?.benchmarkIndex);
          if (Number.isFinite(bi)) benchmarks.push(bi);
          reports.set(m, typeof res.report === 'string' ? res.report : JSON.stringify(res.lhr));
          return m;
        };
        for (let i = 0; i < RUNS; i++) {
          let m = await once(i, '');
          if (m.tbt > OUTLIER_TBT) {
            outliers.push(m);
            m = await once(i, '-rerun');
          }
          all.push(m);
          console.log(
            `${form} ${route} run ${i + 1}: score ${m.score} · LCP ${s2(m.lcp)} · TBT ${Math.round(m.tbt)} ms`,
          );
        }
        const med = Object.fromEntries(NUMERIC.map((k) => [k, median(all.map((r) => r[k]))])) as unknown as LhRun;
        const medRun = all.find((r) => r.lcp === med.lcp) ?? all[0]!;
        med.lcpEl = medRun.lcpEl;
        // the run whose LCP is the median, its whole Lighthouse report (lighthouse-<preset>-<route>.json)
        writeFileSync(path.join(OUT, `lighthouse-${form}-${slug(route)}.json`), reports.get(medRun) ?? '{}');
        const worst = Object.fromEntries(NUMERIC.map((k) => [k, worstOf(all, k)])) as Partial<LhRun>;
        const where = `Lighthouse ${form} ${route} (median of ${all.length})`;
        let barOk = true;
        if (form === 'mobile') {
          barOk = atLeast('bar', 'Lighthouse mobile score', where, med.score, BAR.lighthouseMobile) && barOk;
          // (the bar's LCP and CLS are the phone profile's, measured on the 390 px phone; Lighthouse's own, simulated
          // by Lantern, are what its score is made of, and are reported against the same numbers as guides)
          atMost('guide', 'Lighthouse mobile LCP (simulated)', where, med.lcp, BAR.lcp, s2);
          atMost('guide', 'Lighthouse mobile CLS', where, med.cls, BAR.cls, (v) => v.toFixed(3));
          atMost('guide', 'Lighthouse mobile FCP', where, med.fcp, GUIDE.mobile.fcp, s2);
          atMost('guide', 'Lighthouse mobile Speed Index', where, med.si, GUIDE.mobile.si, s2);
          atMost('guide', 'Lighthouse mobile TBT', where, med.tbt, GUIDE.mobile.tbt, ms);
          atMost('guide', 'CSS, first load', where, med.css, GUIDE.css, kb);
          atMost('guide', 'JS, first load', where, med.js, GUIDE.js, kb);
          atMost('guide', 'font files before LCP', where, med.fontFilesBeforeLcp, GUIDE.fontsBeforeLcp.files, n0);
          atMost('guide', 'font bytes before LCP', where, med.fontsBeforeLcp, GUIDE.fontsBeforeLcp.bytes, kb);
          atMost('guide', 'font files, first load', where, med.fontFiles, GUIDE.fonts.files, n0);
          atMost('guide', 'font bytes, first load', where, med.fonts, GUIDE.fonts.bytes, kb);
          atMost('guide', 'first load, all bytes', where, med.total, GUIDE.firstLoad, kb);
          atMost('guide', 'first-load requests', where, med.requests, GUIDE.requests, n0);
        } else {
          barOk = atLeast('bar', 'Lighthouse desktop score', where, med.score, BAR.lighthouseDesktop) && barOk;
          atMost('guide', 'Lighthouse desktop LCP', where, med.lcp, GUIDE.desktop.lcp, s2);
          atMost('guide', 'Lighthouse desktop CLS', where, med.cls, GUIDE.desktop.cls, (v) => v.toFixed(3));
        }
        // the traces: every run's for a route and preset that misses the bar, the outliers' always
        const keep = !barOk
          ? traces
          : traces.filter(([n], i) => n.endsWith('-rerun') || traces[i + 1]?.[0].endsWith('-rerun'));
        if (keep.length) mkdirSync(path.join(OUT, 'traces'), { recursive: true });
        for (const [n, t] of keep) if (t) writeFileSync(path.join(OUT, 'traces', `${n}.trace.json`), JSON.stringify(t));
        const brief = (r: LhRun) => ({ score: r.score, lcp: Math.round(r.lcp), tbt: Math.round(r.tbt) });
        const lcps = all.map((r) => r.lcp);
        rows.push({
          form,
          route,
          median: med,
          worst,
          lcpMin: Math.min(...lcps),
          lcpMax: Math.max(...lcps),
          runs: all.map(brief),
          outliers: outliers.map(brief),
        });
      }
  } finally {
    await chrome.kill();
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ the two profiles
type Profile = 'phone' | 'laptop';
const PROFILE = {
  phone: {
    title: 'Phone profile (390 × 844 @2, CPU 4×, slow 4G: the still is the painting)',
    context: {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    },
    cpu: 4,
    slow4g: true,
    /** after load: the still's sharp part, the fonts, hydration */
    settle: 6000,
    stagger: 5000,
  },
  laptop: {
    title: 'Laptop profile (1440 × 900 @2, nothing throttled: the live painting, by the page’s own probe)',
    context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    cpu: 1,
    slow4g: false,
    /** after load: the probe, the engine's boot and its first scene */
    settle: 8000,
    stagger: 9000,
  },
} as const;

/** In the page before anything else: what the browser itself reports (LCP, long tasks, shifts, paints, events). */
const OBSERVE = `(() => {
  const R = (window.__perf = { lcp: 0, lcpEl: '', long: [], cls: 0, paints: {}, ev: [] });
  const on = (type, fn, more) => { try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fn(e); }).observe({ type, buffered: true, ...more }); } catch {} };
  on('largest-contentful-paint', (e) => { R.lcp = e.startTime; R.lcpEl = ((e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : '') : '') + (e.url ? ' ' + e.url.split('/').pop() : '')).trim(); });
  on('longtask', (e) => R.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }));
  on('layout-shift', (e) => { if (!e.hadRecentInput) R.cls += e.value; });
  on('paint', (e) => { R.paints[e.name] = e.startTime; });
  on('event', (e) => R.ev.push({ name: e.name, t: e.startTime, d: Math.round(e.duration), id: e.interactionId || 0 }), { durationThreshold: 16 });
  // the gaps between frames while something moves (the main thread's cadence), until stop()
  window.__frames = () => {
    const d = []; let last = performance.now(), going = true; const t0 = last;
    const tick = (t) => { if (!going) return; d.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    return { stop() { going = false; const x = d.slice(1); const s = [...x].sort((a, b) => a - b);
      return { ms: Math.round(performance.now() - t0), frames: x.length, over20: x.filter((v) => v > 20).length, over33: x.filter((v) => v > 33).length,
        p95: x.length ? +s[Math.floor(s.length * 0.95)].toFixed(1) : 0, max: x.length ? Math.round(s[s.length - 1]) : 0 }; } };
  };
  // nothing in the page is moving by the clock: no page change in flight, the engine at rest, no timed animation
  window.__calm = () => {
    if (document.querySelector('.band__transit.is-flying')) return false;
    const i = window.__ink;
    if (i) { try { const s = i.stats(); if (s.panning || s.arriving || s.pending || s.sweeping) return false; } catch {} }
    return !document.getAnimations().some((a) => a.playState === 'running' && !(a.timeline && a.timeline.constructor && /Scroll|View/.test(a.timeline.constructor.name)) && (a.effect && a.effect.getComputedTiming().iterations !== Infinity));
  };
})()`;

interface Frames {
  ms: number;
  frames: number;
  over20: number;
  over33: number;
  p95: number;
  max: number;
}
interface Tap {
  /** the interaction had its effect (the sheet opened, the page changed) */
  done: boolean;
  /** the interaction's duration (Event Timing, to the next paint); 0: under the browser's 16 ms threshold */
  inp: number | null;
  /** the longest task from the press until the page was calm again */
  longMax: number;
}
interface Travel extends Tap {
  from: string;
  to: string;
  /** the painting moved: the flight on the phone, the engine's pan on the laptop */
  moved: boolean;
  frames: Frames | null;
}
interface ProfileRow {
  route: string;
  fcp: number;
  lcp: number;
  lcpEl: string;
  cls: number;
  /** load and the settle after it */
  longMax: number;
  long: Array<{ t: number; d: number }>;
  heapMB: number | null;
  stillMs: number | null;
  live: string | null;
  engine: string;
  transfer: number;
  requests: number;
  scroll: Frames & { longMax: number };
  door: Tap;
  travels: Travel[];
  errors: string[];
}

const longSince = `((t) => (window.__perf ? window.__perf.long.filter((e) => e.t + e.d >= t).reduce((m, e) => Math.max(m, e.d), 0) : -1))`;
/** The interaction since `t`: the longest Event Timing entry that belongs to one (0: none reached 16 ms). */
const inpSince = `((t) => { if (!window.__perf) return null; const e = window.__perf.ev.filter((x) => x.t >= t - 1 && x.id); return e.length ? Math.max(...e.map((x) => x.d)) : 0; })`;
const now = (page: Page) => page.evaluate('performance.now()') as Promise<number>;

/** Until the page is calm (window.__calm) on three polls in a row; false if it never is. Reports what it saw. */
async function calm(page: Page, timeout: number, also = 'true') {
  const until = Date.now() + timeout;
  let quiet = 0;
  let moved = false;
  while (Date.now() < until) {
    const s = (await page
      .evaluate(
        `(() => ({ calm: !!window.__calm && window.__calm() && (${also}), moving: !!document.querySelector('.band__transit.is-flying') || !!(window.__ink && window.__ink.stats().panning) }))()`,
      )
      .catch(() => ({ calm: false, moving: false }))) as { calm: boolean; moving: boolean };
    moved ||= s.moving;
    quiet = s.calm ? quiet + 1 : 0;
    if (quiet >= 3) return { ok: true, moved };
    await page.waitForTimeout(100);
  }
  return { ok: false, moved };
}

async function open(browser: Browser, profile: Profile, init: string) {
  const P = PROFILE[profile];
  const ctx = await browser.newContext(P.context);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (P.slow4g)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  if (P.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  await page.addInitScript(init);
  return { ctx, page, cdp };
}

/** A travel: press the nav word for `to`, record the frames until the new page is in and calm. */
async function travel(page: Page, profile: Profile, to: string): Promise<Travel> {
  const from = new URL(page.url()).pathname;
  const out: Travel = { from, to, done: false, inp: null, longMax: 0, moved: false, frames: null };
  const link = page.locator(`.site-nav a[href="${to}"]`).first();
  if (!(await link.count())) return out;
  await page.evaluate('scrollTo(0, 0)');
  await page.waitForTimeout(500);
  const t = await now(page);
  await page.evaluate('window.__rec = window.__frames()');
  await (profile === 'phone' ? link.tap({ timeout: 5000 }) : link.click({ timeout: 5000 })).catch(() => {});
  const arrived = `location.pathname === ${JSON.stringify(to)} && document.querySelectorAll('main[data-page]').length === 1`;
  const c = await calm(page, 12_000, arrived);
  // (a page change that fell back to a full load has lost the recorder: it did not happen as a travel)
  const frames = (await page.evaluate('window.__rec ? window.__rec.stop() : null').catch(() => null)) as Frames | null;
  out.done = c.ok && !!frames;
  out.moved = c.moved;
  out.frames = frames;
  out.inp = (await page.evaluate(`${inpSince}(${t})`).catch(() => null)) as number | null;
  out.longMax = Math.max(0, (await page.evaluate(`${longSince}(${t})`).catch(() => 0)) as number);
  return out;
}

async function profileAll(profile: Profile): Promise<ProfileRow[]> {
  const P = PROFILE[profile];
  const browser = await chromium.launch({
    ...(existsSync(MAC_CHROME) ? { channel: 'chrome' } : {}),
    args: [...GPU_ARGS, '--hide-scrollbars', '--enable-precise-memory-info'],
  });
  const rows: ProfileRow[] = [];
  try {
    for (const route of ROUTES) {
      const { ctx, page, cdp } = await open(browser, profile, OBSERVE);
      let transfer = 0;
      let requests = 0;
      cdp.on('Network.loadingFinished', (e: { encodedDataLength?: number }) => {
        transfer += e.encodedDataLength ?? 0;
        requests += 1;
      });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
      page.on('console', (m) => {
        // (the 404's own log is the page being a 404)
        if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160));
      });
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 120_000 });
      await page.waitForTimeout(P.settle);
      const loaded = { transfer, requests };
      const nav = (await page.evaluate(`(() => {
        const R = window.__perf;
        const still = performance.getEntriesByType('resource').filter((e) => /\\/scenes\\/band\\/[a-z]+-(phone|wide)-a/.test(e.name));
        const i = window.__ink; let engine = 'none';
        try { if (i) { const s = i.stats(); engine = s.mode + (s.plates && s.plates.on ? ', plates' : '') + (s.software ? ', software' : ''); } } catch {}
        return {
          fcp: Math.round(R.paints['first-contentful-paint'] || 0),
          lcp: Math.round(R.lcp || 0),
          lcpEl: R.lcpEl,
          cls: +R.cls.toFixed(4),
          long: R.long.slice(0, 24),
          longMax: R.long.reduce((m, e) => Math.max(m, e.d), 0),
          heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null,
          stillMs: still.length ? Math.round(Math.max(...still.map((e) => e.responseEnd))) : null,
          live: document.documentElement.getAttribute('data-live'),
          engine,
        };
      })()`)) as Pick<
        ProfileRow,
        'fcp' | 'lcp' | 'lcpEl' | 'cls' | 'long' | 'longMax' | 'heapMB' | 'stillMs' | 'live' | 'engine'
      >;

      // the scroll: top to bottom in four seconds, one step a frame
      const t1 = await now(page);
      const frames = (await page.evaluate(`new Promise((resolve) => {
        const rec = window.__frames(); const start = performance.now();
        const total = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const step = (t) => { const k = Math.min(1, (t - start) / 4000); scrollTo(0, total * k);
          if (k < 1) requestAnimationFrame(step); else resolve(rec.stop()); };
        requestAnimationFrame(step);
      })`)) as Frames;
      const scroll = { ...frames, longMax: (await page.evaluate(`${longSince}(${t1})`)) as number };

      // the door: the Ask sheet opened from the header, then closed
      await page.evaluate('scrollTo(0, 0)');
      await calm(page, 6000);
      await page.waitForTimeout(400);
      const door: Tap = { done: false, inp: null, longMax: 0 };
      const doorEl = page.locator('.site-header .ask-door').first();
      if (await doorEl.count()) {
        const t2 = await now(page);
        await (profile === 'phone' ? doorEl.tap({ timeout: 5000 }) : doorEl.click({ timeout: 5000 })).catch(() => {});
        door.done = await page
          .waitForSelector('[role="dialog"][aria-modal="true"]', { state: 'visible', timeout: 10_000 })
          .then(
            () => true,
            () => false,
          );
        await calm(page, 6000);
        await page.waitForTimeout(300);
        door.inp = (await page.evaluate(`${inpSince}(${t2})`)) as number | null;
        door.longMax = (await page.evaluate(`${longSince}(${t2})`)) as number;
        await page.keyboard.press('Escape');
        await page
          .waitForSelector('[role="dialog"][aria-modal="true"]', { state: 'detached', timeout: 6000 })
          .catch(() => {});
        await calm(page, 6000);
      }

      // two travels by the nav's words: to the next place, then the longest way the nav offers from there (by then
      // the phone has fetched the strip, so the second is the flight)
      const hrefs = (await page.evaluate(
        `[...document.querySelectorAll('.site-nav a[href]')].map((a) => ({ href: a.getAttribute('href'), here: a.hasAttribute('aria-current') }))`,
      )) as Array<{ href: string; here: boolean }>;
      const travels: Travel[] = [];
      if (hrefs.length > 1) {
        const at = hrefs.findIndex((h) => h.here);
        const first = hrefs[(at + 1) % hrefs.length]!.href;
        travels.push(await travel(page, profile, first));
        if (profile === 'phone')
          // (the strip is fetched on the first reach for a link; wait for it as a reader's second tap would find it)
          await page
            .waitForFunction(
              `(() => { const i = document.querySelector('.band__transit img'); return !!i && i.complete && i.naturalWidth > 0; })()`,
              undefined,
              { timeout: 20_000 },
            )
            .catch(() => {});
        await page.waitForTimeout(1200);
        const i1 = hrefs.findIndex((h) => h.href === first);
        const far = hrefs
          .map((h, i) => ({ h, far: Math.abs(i - i1) }))
          .sort((a, b) => b.far - a.far || hrefs.indexOf(b.h) - hrefs.indexOf(a.h))[0]!.h.href;
        travels.push(await travel(page, profile, far));
      }

      const row: ProfileRow = { route, ...nav, ...loaded, scroll, door, travels, errors };
      rows.push(row);
      console.log(
        `${profile} ${route}: LCP ${s2(row.lcp)} · longest task ${row.longMax} ms · scroll ${row.scroll.over20}/${row.scroll.frames} over 20 ms · door INP ${row.door.inp ?? '–'} ms · ` +
          `travel ${row.travels.map((v) => `${v.to} ${v.done ? `${v.frames?.over20}/${v.frames?.frames} over 20 ms, INP ${v.inp}` : 'did not happen'}`).join('; ')} · ${row.live}`,
      );

      const where = `${profile} ${route}`;
      const longAll = Math.max(row.longMax, row.scroll.longMax, row.door.longMax, ...row.travels.map((v) => v.longMax));
      if (profile === 'phone') {
        atMost('bar', 'phone LCP', where, row.lcp, BAR.lcp, s2);
        atMost('bar', 'phone CLS', where, row.cls, BAR.cls, (v) => v.toFixed(3));
        atMost('bar', 'phone longest task (load, scroll, door, travel)', where, longAll, BAR.longTask, ms);
        atMost(
          'bar',
          'phone scroll frames over 20 ms',
          where,
          row.scroll.frames ? row.scroll.over20 / row.scroll.frames : 0,
          BAR.scrollOver20,
          pct,
        );
        must('phone: the Ask sheet opens from its door', where, row.door.done, 'the sheet did not open');
        if (row.door.inp !== null) atMost('bar', 'phone INP, the Ask door', where, row.door.inp, BAR.inp, ms);
        for (const v of row.travels) {
          const hop = `${where} to ${v.to}`;
          must('phone: a tap on a nav word changes the page', hop, v.done, 'the page did not change in place');
          if (v.inp !== null) atMost('bar', 'phone INP, a nav word', hop, v.inp, BAR.inp, ms);
          if (v.frames?.frames)
            atMost(
              'guide',
              'phone travel frames over 33 ms',
              hop,
              v.frames.over33 / v.frames.frames,
              GUIDE.travelOver33,
              pct,
            );
        }
        if (row.heapMB !== null) atMost('guide', 'phone JS heap', where, row.heapMB, GUIDE.heapMB, (v) => `${v} MB`);
        if (row.stillMs !== null) atMost('guide', 'phone: the still’s time', where, row.stillMs, GUIDE.stillMs, ms);
      } else {
        // (the laptop's bar is in words, "no scroll lag, never a frozen tab": read here by the phone's numbers)
        atMost(
          'bar',
          'laptop scroll frames over 20 ms (live painting)',
          where,
          row.scroll.frames ? row.scroll.over20 / row.scroll.frames : 0,
          BAR.scrollOver20,
          pct,
        );
        atMost('bar', 'laptop longest task (load, scroll, door, travel)', where, longAll, BAR.longTask, ms);
        must('laptop: the Ask sheet opens from its door', where, row.door.done, 'the sheet did not open');
        if (row.door.inp !== null) atMost('bar', 'laptop INP, the Ask door', where, row.door.inp, BAR.inp, ms);
        for (const v of row.travels) {
          const hop = `${where} to ${v.to}`;
          must('laptop: a click on a nav word changes the page', hop, v.done, 'the page did not change in place');
          if (v.inp !== null) atMost('bar', 'laptop INP, a nav word', hop, v.inp, BAR.inp, ms);
          if (v.frames?.frames)
            atMost(
              'guide',
              'laptop travel frames over 33 ms',
              hop,
              v.frames.over33 / v.frames.frames,
              GUIDE.travelOver33,
              pct,
            );
        }
        atMost('guide', 'laptop LCP', where, row.lcp, GUIDE.laptopLcp, s2);
        atMost('guide', 'laptop CLS', where, row.cls, BAR.cls, (v) => v.toFixed(3));
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ the idle page
/** Counts what the page asks for: frames (requestAnimationFrame calls) and timers that fire. */
const COUNT = `(() => {
  const C = (window.__idle = { raf: 0, timers: 0, long: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => { C.raf += 1; return raf(f); };
  for (const name of ['setTimeout', 'setInterval']) {
    const o = window[name].bind(window);
    window[name] = (f, ...rest) => o(typeof f === 'function' ? (...a) => { C.timers += 1; return f(...a); } : f, ...rest);
  }
  try { new PerformanceObserver((l) => { C.long += l.getEntries().length; }).observe({ type: 'longtask' }); } catch {}
})()`;
interface IdleRow {
  route: string;
  live: string | null;
  /** in the idle window */
  raf: number;
  long: number;
  timers: number;
  /** time-driven animations running at its end */
  animations: number;
  /** frames asked for from load until the window opened (the painting's small life while a reader might be there) */
  before: number;
}
async function idleAll(profile: Profile): Promise<IdleRow[]> {
  const P = PROFILE[profile];
  const browser = await chromium.launch({
    ...(existsSync(MAC_CHROME) ? { channel: 'chrome' } : {}),
    args: [...GPU_ARGS, '--hide-scrollbars'],
  });
  const rows: IdleRow[] = [];
  try {
    // every route in a window of its own, opened one after another so each boots alone, then left alone
    const pages: Array<{ route: string; page: Page; at: number }> = [];
    for (const route of ROUTES) {
      const { page } = await open(browser, profile, COUNT);
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 120_000 });
      pages.push({ route, page, at: Date.now() });
      await sleep(P.stagger);
    }
    const last = pages[pages.length - 1]!.at;
    await sleep(Math.max(0, last + IDLE_AFTER - Date.now()));
    const before = await Promise.all(
      pages.map(
        ({ page }) =>
          page.evaluate(
            `(() => { const C = window.__idle, n = C.raf; C.raf = 0; C.timers = 0; C.long = 0; return n; })()`,
          ) as Promise<number>,
      ),
    );
    await sleep(IDLE_WINDOW);
    for (const [i, { route, page }] of pages.entries()) {
      const r = (await page.evaluate(`(() => ({
        ...window.__idle,
        live: document.documentElement.getAttribute('data-live'),
        animations: document.getAnimations().filter((a) => a.playState === 'running' && !(a.timeline && a.timeline.constructor && /Scroll|View/.test(a.timeline.constructor.name))).length,
      }))()`)) as Omit<IdleRow, 'route' | 'before'>;
      const row: IdleRow = { route, ...r, before: before[i]! };
      rows.push(row);
      const where = `${profile} ${route}, idle`;
      atMost('bar', `${profile} idle: frames asked for in ${IDLE_WINDOW / 1000} s`, where, row.raf, BAR.idle, n0);
      atMost('bar', `${profile} idle: long tasks`, where, row.long, BAR.idle, n0);
      atMost('bar', `${profile} idle: time-driven animations running`, where, row.animations, BAR.idle, n0);
      console.log(
        `${profile} idle ${route}: ${row.raf} frames asked for, ${row.long} long tasks, ${row.timers} timers, ${row.animations} animations · ${row.live}`,
      );
    }
  } finally {
    await browser.close();
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ the report
/** The commit measured; "+changes" when the working tree differs from it (the build measured is not that commit's). */
function shortSha() {
  const git = (cmd: string) =>
    execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  try {
    return git('rev-parse --short=7 HEAD') + (git('status --porcelain --untracked-files=no') ? '+changes' : '');
  } catch {
    return 'local';
  }
}

/** One request per route, then two seconds, so no measured run is a cold route's first render. */
async function warm(routes: string[]) {
  for (const route of routes) await served(BASE + route).catch(() => null);
  await sleep(2000);
}

/** Per thing measured: the worst value over the routes and where, against its limit. */
function summary(kind: Check['kind']) {
  const groups = new Map<string, Check[]>();
  for (const c of checks) if (c.kind === kind) groups.set(c.id, [...(groups.get(c.id) ?? []), c]);
  return [...groups.entries()].map(([id, cs]) => {
    const worst = cs.reduce((w, c) => ((c.up ? c.value < w.value : c.value > w.value) || (!c.ok && w.ok) ? c : w));
    const missed = cs.filter((c) => !c.ok).length;
    return `| ${id} | ${worst.limit} | ${worst.shown} | ${worst.where} | ${missed ? `${kind === 'bar' ? 'MISS' : 'over'} (${missed} of ${cs.length})` : kind === 'bar' ? 'holds' : 'within'} |`;
  });
}

const tapCell = (t: Tap) => (t.done ? `${t.inp === null ? '–' : t.inp === 0 ? '< 16' : t.inp} ms` : 'did not happen');
const travelCell = (v: Travel) =>
  !v.done || !v.frames
    ? `${v.to}: did not happen`
    : `${v.to}: ${v.frames.ms} ms, ${v.frames.over20} / ${v.frames.over33} of ${v.frames.frames} (max ${v.frames.max} ms), task ${v.longMax} ms, INP ${v.inp === 0 ? '< 16' : v.inp} ms, ${v.moved ? 'moved' : 'no motion seen'}`;

function profileTable(profile: Profile, rows: ProfileRow[]): string[] {
  return [
    '',
    `## ${PROFILE[profile].title}`,
    '',
    'One visit per route. Long tasks: the longest during the load and the settle after it. Scroll: gaps between frames over a scripted four-second scroll from top to bottom. Travel: time until the new page was in and calm, frames over 20 ms / over 33 ms of all frames, the longest gap, the longest task, the tap’s INP, and whether the painting was seen to move.',
    '',
    '| Route | FCP | LCP | LCP element | CLS | Longest task | Scroll > 20 ms (p95, max, task) | Ask door INP (task) | Travel 1 | Travel 2 | Transfer (requests) | Heap | Still | Painting |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.route} | ${r.fcp} ms | ${r.lcp} ms | ${r.lcpEl} | ${r.cls} | ${r.longMax} ms | ${r.scroll.over20} of ${r.scroll.frames} (${r.scroll.p95} ms, ${r.scroll.max} ms, ${r.scroll.longMax} ms) | ${tapCell(r.door)} (${r.door.longMax} ms) | ${r.travels[0] ? travelCell(r.travels[0]) : '–'} | ${r.travels[1] ? travelCell(r.travels[1]) : '–'} | ${kb(r.transfer)} (${r.requests}) | ${r.heapMB ?? '–'} MB | ${r.stillMs ?? '–'} ms | ${r.live ?? '–'}; ${r.engine} |`,
    ),
    '',
    'Long tasks during load and settle (ms from navigation start + duration):',
    '',
    ...rows.map((r) => `- ${r.route}: ${r.long.map((e) => `${e.t}+${e.d}`).join(', ') || 'none'}`),
    ...(rows.some((r) => r.errors.length)
      ? ['', 'Errors the pages logged:', '', ...rows.flatMap((r) => r.errors.map((e) => `- ${r.route}: ${e}`))]
      : []),
  ];
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  await warm(ROUTES);
  const html: Array<{ route: string; bytes: number; encoding: string; status: number }> = [];
  for (const route of ROUTES) {
    const h = await served(BASE + route);
    html.push({ route, ...h });
    if (runs('html')) {
      check({
        kind: 'guide',
        id: 'HTML served gzip',
        where: `HTML ${route}`,
        value: h.encoding === 'gzip' ? 0 : 1,
        shown: h.encoding,
        limit: 'gzip',
        ok: h.encoding === 'gzip',
      });
      atMost('guide', 'HTML bytes (gzip)', `HTML ${route}`, h.bytes, GUIDE.html, (v) => `${v} B`);
    }
  }
  // (Lighthouse audits only a page served 200: the 404 is measured by the profiles)
  const lhRoutes = ROUTES.filter((r) => html.find((h) => h.route === r)?.status === 200);
  const lh = runs('lighthouse') ? await lighthouseAll(lhRoutes) : [];
  const phone = runs('phone') ? await profileAll('phone') : [];
  const laptop = runs('laptop') ? await profileAll('laptop') : [];
  const idle = runs('idle') ? { phone: await idleAll('phone'), laptop: await idleAll('laptop') } : null;

  const misses = checks.filter((c) => c.kind === 'bar' && !c.ok);
  const over = checks.filter((c) => c.kind === 'guide' && !c.ok);
  const whole =
    ONLY.length === PARTS.length && FORMS.length === 2 && opt('--routes', ALL_ROUTES) === ALL_ROUTES && RUNS >= 5;
  const date = new Date().toISOString();
  const L = [
    `# Speed · ${date.slice(0, 16).replace('T', ' ')} UTC · ${BASE} · commit ${shortSha()} · ${process.platform}${benchmarks.length ? ` · benchmark index ${Math.round(median(benchmarks))}` : ''}`,
    '',
    `Verdict: ${misses.length ? `THE BAR IS MISSED (${misses.length})` : 'the bar holds'}${whole ? '' : ` (a partial run: ${ONLY.join(', ')}${RUNS < 5 ? `, ${RUNS} Lighthouse run(s)` : ''})`} · guides over their mark: ${over.length} · ${Math.round((Date.now() - t0) / 1000)} s`,
    '',
    '## The bar (AGENTS.md; a miss fails the run): the worst route for each',
    '',
    '| Measured | Bar | Worst | Where | |',
    '| --- | --- | --- | --- | --- |',
    ...summary('bar'),
    '',
    '### Bar misses',
    '',
    ...(misses.length ? misses.map((c) => `- ${c.where}: ${c.id}: ${c.shown} (${c.limit})`) : ['- none']),
    '',
    '## Guides (reported, never failing the run): the worst route for each',
    '',
    '| Measured | Guide | Worst | Where | |',
    '| --- | --- | --- | --- | --- |',
    ...summary('guide'),
    '',
    '### Guides over their mark',
    '',
    ...(over.length ? over.map((c) => `- ${c.where}: ${c.id}: ${c.shown} (${c.limit})`) : ['- none']),
    '',
    '## HTML as served (gzip; a guide)',
    '',
    '| Route | Bytes | Encoding | Status |',
    '| --- | --- | --- | --- |',
    ...html.map((h) => `| ${h.route} | ${h.bytes} | ${h.encoding} | ${h.status} |`),
  ];
  if (lh.length) {
    L.push(
      '',
      `## Lighthouse (median of ${RUNS} · worst; LCP: median · min–max)`,
      '',
      `The bar: the score (mobile and desktop). The rest are guides, Lighthouse's simulated LCP among them (the bar's LCP is the phone profile's). Routes not served 200 are not audited by Lighthouse: ${ROUTES.filter((r) => !lhRoutes.includes(r)).join(', ') || 'none'}.`,
      '',
      '| Preset | Route | Score | FCP | LCP | SI | TBT | Longest task | CLS | First load | Requests | JS | CSS | Fonts (files) | LCP element | Runs (score/LCP/TBT) | Outliers |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const r of lh) {
      const m = r.median;
      const w = r.worst;
      L.push(
        `| ${r.form} | ${r.route} | ${m.score} · ${w.score} | ${s2(m.fcp)} | ${s2(m.lcp)} · ${s2(r.lcpMin)}–${s2(r.lcpMax)} | ${s2(m.si)} | ${Math.round(m.tbt)} · ${Math.round(w.tbt!)} ms | ${Math.round(m.maxTask)} ms | ${m.cls.toFixed(3)} | ${kb(m.total)} | ${m.requests} | ${kb(m.js)} | ${kb(m.css)} | ${kb(m.fonts)} (${m.fontFiles}) | \`${m.lcpEl.replace(/\|/g, '/').replace(/`/g, "'").slice(0, 70)}\` | ${r.runs.map((x) => `${x.score}/${x.lcp}/${x.tbt}`).join(' ')} | ${r.outliers.map((x) => `${x.score}/${x.lcp}/${x.tbt}`).join(' ') || '–'} |`,
      );
    }
  }
  if (phone.length) L.push(...profileTable('phone', phone));
  if (laptop.length) L.push(...profileTable('laptop', laptop));
  if (idle) {
    L.push(
      '',
      `## The idle page (left alone; counted over ${IDLE_WINDOW / 1000} s from ${IDLE_AFTER / 1000} s after its load)`,
      '',
      'The bar: no frame asked for, no long task, no time-driven animation. Timers that fire are reported (a clock on the page may tick). "Before": frames asked for between the load and the window, while a reader might still be there (on the laptop, the plates’ small life, which sleeps a minute after the last input).',
      '',
      '| Profile | Route | Frames asked for | Long tasks | Animations | Timers fired | Before | Painting |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...(['phone', 'laptop'] as const).flatMap((p) =>
        idle[p].map(
          (r) =>
            `| ${p} | ${r.route} | ${r.raf} | ${r.long} | ${r.animations} | ${r.timers} | ${r.before} | ${r.live ?? '–'} |`,
        ),
      ),
    );
  }
  writeFileSync(path.join(OUT, 'summary.md'), L.join('\n') + '\n');
  writeFileSync(
    path.join(OUT, 'summary.json'),
    JSON.stringify(
      {
        date,
        base: BASE,
        whole,
        benchmarkIndex: benchmarks.length ? Math.round(median(benchmarks)) : null,
        html,
        lighthouse: lh,
        phone,
        laptop,
        idle,
        checks,
        barMisses: misses,
        guidesOver: over,
      },
      null,
      1,
    ),
  );
  console.log(L.join('\n'));

  // the tail's build stamp: Home's mobile median, written only from a whole run in which the bar holds
  if (flag('--write')) {
    const home = lh.find((r) => r.form === 'mobile' && r.route === '/');
    if (!whole) console.log('--write: nothing written: a partial run (the stamp is written from the whole check only)');
    else if (misses.length || !home) console.log('--write: nothing written: the bar is missed');
    else if (home.median.lcp > BAR.lcp)
      // (the tail prints this number on every page: never one over the site's own 2.5 s)
      console.log(
        `--write: nothing written: Home's Lighthouse mobile LCP, the number the tail would print, is ${s2(home.median.lcp)}: over ${s2(BAR.lcp)}`,
      );
    else {
      const file = path.join(ROOT, 'content', 'measured.json');
      const was = JSON.parse(readFileSync(file, 'utf8')) as Json;
      const next = {
        about: was.about,
        profile: 'Lighthouse mobile, simulated',
        lcpMs: Math.round(home.median.lcp),
        transferKB: Math.round(home.median.total / KB),
        measuredOn: date.slice(0, 10),
        sha: shortSha(),
      };
      writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
      console.log(`wrote ${path.relative(ROOT, file)}: LCP ${next.lcpMs} ms, ${next.transferKB} KB (${next.sha})`);
    }
  }
  return misses.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`check-budgets: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  },
);
