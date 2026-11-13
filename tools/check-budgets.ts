/**
 * The budgets' gate (vanguard 01-budgets.md as amended, and the lead's rulings R5, R7, R9 and R10): Lighthouse
 * (mobile and desktop presets) on every route of the QA build, five runs each, then the phone profile (Playwright and
 * CDP: 390 × 844 at DPR 2, CPU 4× slower, slow 4G) on every route; exit 1 when any gate fails.
 *
 *   NEXT_PUBLIC_INK_QA=1 npm run build && next start -p 3100       the QA build (CI's build; R10: the gate sees it)
 *   npm run check:budgets                                         every route, both presets, 5 runs, the phone run
 *   npm run check:budgets -- --routes /,/work/ --runs 5           some routes
 *   npm run check:budgets -- --no-phone | --no-lighthouse         one half (CI: --no-phone; the phone run needs a
 *                                                                 GPU and is the local release step)
 *   npm run check:budgets -- --forms mobile                       one Lighthouse preset
 *   npm run check:budgets -- --out <dir>                          the report's folder (default budgets-report/)
 *   npm run check:budgets -- --write                              on a pass, write Home's numbers into
 *                                                                 content/measured.json (the tail's build stamp)
 *
 * R7: run it with the machine quiet (Lighthouse first, the phone run after it: P1's one outlier came right after a
 * phone run). R12: the server is warmed first (one request per route, then two seconds: a cold route's first
 * Lighthouse run fell in the slow one of Lantern's two LCP modes, ~0.5 s apart), then FIVE runs per route and preset.
 * The gate is the MEDIAN of the runs, per metric; the min and max (both modes, when there are two) and the worst run
 * are recorded beside it. A run whose TBT is
 * over 1 s is re-run once and reported as an outlier (the re-run takes its place). Every run's trace is kept for a
 * route and preset that fails, and for every outlier.
 * R9 and R10: every route's HTML is measured as served, gzip, and gated at 30,000 B (Work sits near it).
 * Locally Google Chrome runs on the GPU (Metal); in CI Playwright's Chromium runs on a software rasteriser, where the
 * probe keeps the painting still, so CI's numbers are the paper's, the phone run's included.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, d: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : d;
};
const BASE = opt('--base', 'http://127.0.0.1:3100').replace(/\/$/, '');
const RUNS = Number(opt('--runs', '5'));
const OUT = path.resolve(ROOT, opt('--out', 'budgets-report'));
const ROUTES = opt(
  '--routes',
  '/,/work/,/work/rag-assistant/,/writing/,/writing/what-is-an-ai-agent/,/resume/,/contact/,/no-such-page/',
).split(',');
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CI = !!process.env.CI;
const GPU_ARGS = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [];
const LINUX_ARGS = process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
const FORMS = opt('--forms', 'mobile,desktop')
  .split(',')
  .filter((f): f is 'mobile' | 'desktop' => f === 'mobile' || f === 'desktop');
const OUTLIER_TBT = 1000;
const KB = 1024;

/** The gates (01-budgets.md "The gates" and "Weight", hard gates, as amended 2026-11-05 and 2026-11-12). */
const GATES = {
  // (the longest task during load is gated on the phone run, the table's "phone profile unless said": Lighthouse's
  // simulated long tasks are the observed ones times its 4× CPU multiplier, recorded beside it ungated)
  mobile: { score: 95, lcp: 2500, fcp: 1800, si: 3000, tbt: 150, cls: 0.05 },
  desktop: { score: 99, lcp: 1200, cls: 0.05 },
  weight: {
    html: 30_000, // served gzip, every route (R10's measurement: the QA build)
    css: 35 * KB,
    js: 160 * KB,
    fontsBeforeLcp: { files: 2, bytes: 45 * KB },
    fonts: { files: 4, bytes: 90 * KB },
    totalBeforePainting: 250 * KB,
    requests: 15,
  },
  phone: { lcp: 2500, cls: 0.05, longTask: 100, scrollOver20: 0.02, inp: 200, heapMB: 20, stillMs: 1500 },
} as const;

const slug = (r: string) => (r === '/' ? 'home' : r.replace(/^\/|\/$/g, '').replace(/\//g, '-'));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};
const s2 = (v: number) => `${(v / 1000).toFixed(2)} s`;
const kb = (v: number) => `${Math.round(v / KB)} KB`;
const fails: string[] = [];
const gate = (ok: boolean, what: string) => {
  if (!ok) fails.push(what);
};

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
const worstOf = (runs: LhRun[], k: Exclude<keyof LhRun, 'lcpEl'>) =>
  k === 'score' ? Math.min(...runs.map((r) => r[k])) : Math.max(...runs.map((r) => r[k]));

interface LhRow {
  form: 'mobile' | 'desktop';
  route: string;
  median: LhRun;
  worst: Partial<LhRun>;
  /** LCP's spread over the runs (R12: both of Lantern's modes visible beside the median). */
  lcpMin: number;
  lcpMax: number;
  runs: Array<Pick<LhRun, 'score' | 'lcp' | 'tbt'>>;
  outliers: Array<Pick<LhRun, 'score' | 'lcp' | 'tbt'>>;
}

async function lighthouseAll(routes: string[]): Promise<LhRow[]> {
  const chromePath = process.env.CHROME_PATH || (existsSync(MAC_CHROME) ? MAC_CHROME : chromium.executablePath());
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-first-run', ...GPU_ARGS, ...LINUX_ARGS],
  });
  const rows: LhRow[] = [];
  try {
    for (const form of FORMS)
      for (const route of routes) {
        const runs: LhRun[] = [];
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
          reports.set(m, typeof res.report === 'string' ? res.report : JSON.stringify(res.lhr));
          return m;
        };
        for (let i = 0; i < RUNS; i++) {
          let m = await once(i, '');
          if (m.tbt > OUTLIER_TBT) {
            outliers.push(m);
            m = await once(i, '-rerun');
          }
          runs.push(m);
          console.log(
            `${form} ${route} run ${i + 1}: score ${m.score} · LCP ${s2(m.lcp)} · TBT ${Math.round(m.tbt)} ms`,
          );
        }
        const med = Object.fromEntries(NUMERIC.map((k) => [k, median(runs.map((r) => r[k]))])) as unknown as LhRun;
        const medRun = runs.find((r) => r.lcp === med.lcp) ?? runs[0]!;
        med.lcpEl = medRun.lcpEl;
        // the run whose LCP is the median, its whole Lighthouse report (lighthouse-<preset>-<route>.json)
        writeFileSync(path.join(OUT, `lighthouse-${form}-${slug(route)}.json`), reports.get(medRun) ?? '{}');
        const worst = Object.fromEntries(NUMERIC.map((k) => [k, worstOf(runs, k)])) as Partial<LhRun>;
        const before = fails.length;
        const where = `Lighthouse ${form} ${route} (median of ${runs.length})`;
        if (form === 'mobile') {
          const g = GATES.mobile;
          gate(med.score >= g.score, `${where}: score ${med.score} < ${g.score}`);
          gate(med.lcp <= g.lcp, `${where}: LCP ${s2(med.lcp)} > ${s2(g.lcp)}`);
          gate(med.fcp <= g.fcp, `${where}: FCP ${s2(med.fcp)} > ${s2(g.fcp)}`);
          gate(med.si <= g.si, `${where}: Speed Index ${s2(med.si)} > ${s2(g.si)}`);
          gate(med.tbt <= g.tbt, `${where}: TBT ${Math.round(med.tbt)} ms > ${g.tbt} ms`);
          gate(med.cls <= g.cls, `${where}: CLS ${med.cls.toFixed(3)} > ${g.cls}`);
          const w = GATES.weight;
          gate(med.css <= w.css, `${where}: CSS ${kb(med.css)} > ${kb(w.css)}`);
          gate(med.js <= w.js, `${where}: first-load JS ${kb(med.js)} > ${kb(w.js)}`);
          gate(
            med.fontFilesBeforeLcp <= w.fontsBeforeLcp.files && med.fontsBeforeLcp <= w.fontsBeforeLcp.bytes,
            `${where}: fonts before LCP ${med.fontFilesBeforeLcp} files, ${kb(med.fontsBeforeLcp)}`,
          );
          gate(
            med.fontFiles <= w.fonts.files && med.fonts <= w.fonts.bytes,
            `${where}: fonts ${med.fontFiles} files, ${kb(med.fonts)}`,
          );
          gate(
            med.total <= w.totalBeforePainting,
            `${where}: first load ${kb(med.total)} > ${kb(w.totalBeforePainting)}`,
          );
          gate(med.requests <= w.requests, `${where}: ${med.requests} first-load requests > ${w.requests}`);
        } else {
          const g = GATES.desktop;
          gate(med.score >= g.score, `${where}: score ${med.score} < ${g.score}`);
          gate(med.lcp <= g.lcp, `${where}: LCP ${s2(med.lcp)} > ${s2(g.lcp)}`);
          gate(med.cls <= g.cls, `${where}: CLS ${med.cls.toFixed(3)} > ${g.cls}`);
        }
        // the traces: every run's for a failing route and preset, the outliers' always
        const keep =
          fails.length > before
            ? traces
            : traces.filter(([n], i) => n.endsWith('-rerun') || traces[i + 1]?.[0].endsWith('-rerun'));
        if (keep.length) mkdirSync(path.join(OUT, 'traces'), { recursive: true });
        for (const [n, t] of keep) if (t) writeFileSync(path.join(OUT, 'traces', `${n}.trace.json`), JSON.stringify(t));
        const brief = (r: LhRun) => ({ score: r.score, lcp: Math.round(r.lcp), tbt: Math.round(r.tbt) });
        const lcps = runs.map((r) => r.lcp);
        rows.push({
          form,
          route,
          median: med,
          worst,
          lcpMin: Math.min(...lcps),
          lcpMax: Math.max(...lcps),
          runs: runs.map(brief),
          outliers: outliers.map(brief),
        });
      }
  } finally {
    await chrome.kill();
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ the phone profile
const OBSERVE = `(() => {
  const R = (window.__perf = { lcp: 0, lcpEl: '', long: [], cls: 0, paints: {}, inp: [] });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) { R.lcp = e.startTime; R.lcpEl = (e.element && (e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ')[0] : ''))) || e.url || ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) R.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) R.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) R.paints[e.name] = e.startTime; }).observe({ type: 'paint', buffered: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) R.inp.push({ name: e.name, d: Math.round(e.duration) }); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch {}
})()`;
interface PhoneRow {
  route: string;
  fcp: number;
  lcp: number;
  lcpEl: string;
  cls: number;
  longMax: number;
  long: Array<{ t: number; d: number }>;
  heapMB: number | null;
  stillMs: number | null;
  live: string | null;
  transfer: number;
  scroll: { frames: number; p95: number; over20: number };
  inp: number | null;
}
async function phoneAll(): Promise<PhoneRow[]> {
  const browser = await chromium.launch({
    ...(existsSync(MAC_CHROME) && !CI ? { channel: 'chrome' } : {}),
    args: [...GPU_ARGS, '--hide-scrollbars', '--enable-precise-memory-info'],
  });
  const rows: PhoneRow[] = [];
  try {
    for (const route of ROUTES) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      let transfer = 0;
      cdp.on('Network.loadingFinished', (e: { encodedDataLength?: number }) => (transfer += e.encodedDataLength ?? 0));
      await page.addInitScript(OBSERVE);
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 120_000 });
      await page.waitForTimeout(6000); // the probe, the engine's boot and its first scene, where it runs
      const nav = (await page.evaluate(`(() => {
        const R = window.__perf;
        const still = performance.getEntriesByType('resource').filter((e) => /\\/scenes\\/hero\\/[a-z]+-phone@/.test(e.name));
        return {
          fcp: Math.round(R.paints['first-contentful-paint'] || 0),
          lcp: Math.round(R.lcp || 0),
          lcpEl: R.lcpEl,
          cls: +R.cls.toFixed(4),
          long: R.long.slice(0, 16),
          longMax: R.long.reduce((m, e) => Math.max(m, e.d), 0),
          heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null,
          stillMs: still.length ? Math.round(Math.max(...still.map((e) => e.responseEnd))) : null,
          live: document.documentElement.getAttribute('data-live'),
        };
      })()`)) as Omit<PhoneRow, 'route' | 'transfer' | 'scroll' | 'inp'>;
      const scroll = (await page.evaluate(`new Promise((resolve) => {
        const deltas = []; let last = performance.now(); const start = last;
        const total = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        const step = (t) => { deltas.push(t - last); last = t; const k = Math.min(1, (t - start) / 4000); scrollTo(0, total * k);
          if (k < 1) requestAnimationFrame(step);
          else { const d = deltas.slice(2).sort((a, b) => a - b); resolve({ frames: d.length, p95: +d[Math.floor(d.length * 0.95)].toFixed(1), over20: d.filter((x) => x > 20).length }); } };
        requestAnimationFrame(step);
      })`)) as PhoneRow['scroll'];
      let inp: number | null = null;
      await page.evaluate('scrollTo(0, 0)');
      await page.waitForTimeout(400);
      const link = page.locator('main a[href^="/"]').first();
      if (await link.count()) {
        await link.tap({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        inp = (await page
          .evaluate(
            `(() => { const e = (window.__perf?.inp || []).filter((x) => /pointer|click|touch/.test(x.name)); return e.length ? Math.max(...e.map((x) => x.d)) : null; })()`,
          )
          .catch(() => null)) as number | null;
      }
      const row: PhoneRow = { route, ...nav, transfer, scroll, inp };
      rows.push(row);
      console.log(
        `phone ${route}: LCP ${s2(row.lcp)} · still ${row.stillMs ?? '–'} ms · longest task ${row.longMax} ms · live ${row.live}`,
      );
      const where = `phone profile ${route}`;
      const g = GATES.phone;
      gate(row.lcp <= g.lcp, `${where}: LCP ${s2(row.lcp)} > ${s2(g.lcp)}`);
      gate(row.cls <= g.cls, `${where}: CLS ${row.cls} > ${g.cls}`);
      gate(row.longMax <= g.longTask, `${where}: a ${row.longMax} ms task (gate ${g.longTask} ms at 4×)`);
      gate(
        row.scroll.frames === 0 || row.scroll.over20 / row.scroll.frames <= g.scrollOver20,
        `${where}: ${row.scroll.over20} of ${row.scroll.frames} scroll frames over 20 ms`,
      );
      gate(row.inp === null || row.inp <= g.inp, `${where}: tap INP ${row.inp} ms > ${g.inp} ms`);
      gate(row.heapMB === null || row.heapMB <= g.heapMB, `${where}: JS heap ${row.heapMB} MB > ${g.heapMB} MB`);
      gate(
        row.stillMs === null || row.stillMs <= g.stillMs,
        `${where}: the sharp still at ${row.stillMs} ms > ${g.stillMs}`,
      );
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ the report
function shortSha() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
  }
}

/** R12: one request per route, then two seconds, so no measured run is a cold route's first render. */
async function warm(routes: string[]) {
  for (const route of routes) await served(BASE + route).catch(() => null);
  await new Promise((r) => setTimeout(r, 2000));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  await warm(ROUTES);
  const html: Array<{ route: string; bytes: number; encoding: string; status: number }> = [];
  for (const route of ROUTES) {
    const h = await served(BASE + route);
    html.push({ route, ...h });
    gate(h.encoding === 'gzip', `HTML ${route}: served ${h.encoding}, not gzip`);
    gate(h.bytes <= GATES.weight.html, `HTML ${route}: ${h.bytes} B gzip > ${GATES.weight.html} B`);
  }
  // (Lighthouse audits only a page served 200: the 404 is gated on its HTML and the phone run)
  const lhRoutes = ROUTES.filter((r) => html.find((h) => h.route === r)?.status === 200);
  const lh = flag('--no-lighthouse') ? [] : await lighthouseAll(lhRoutes);
  const phone = flag('--no-phone') ? [] : await phoneAll();

  const date = new Date().toISOString();
  const L = [
    `# Budgets · ${date.slice(0, 16).replace('T', ' ')} UTC · ${BASE} · commit ${shortSha()} · ${process.platform}${CI ? ' (CI)' : ''}`,
    '',
    `Verdict: ${fails.length ? `FAIL (${fails.length})` : 'pass'} · Lighthouse: median of ${RUNS} per metric after a warm-up (LCP's min–max and the worst beside it) · ${Math.round((Date.now() - t0) / 1000)} s`,
    '',
    '## HTML as served (gzip; gate 30,000 B)',
    '',
    '| Route | Bytes | Encoding | Status |',
    '| --- | --- | --- | --- |',
    ...html.map((h) => `| ${h.route} | ${h.bytes} | ${h.encoding} | ${h.status} |`),
  ];
  if (lh.length) {
    L.push(
      '',
      '## Lighthouse (median · worst; LCP: median · min–max)',
      '',
      `Routes not served 200 are not audited by Lighthouse: ${ROUTES.filter((r) => !lhRoutes.includes(r)).join(', ') || 'none'}.`,
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
  if (phone.length) {
    L.push(
      '',
      '## Phone profile (390 × 844 @2, CPU 4×, slow 4G; one run per route)',
      '',
      '| Route | FCP | LCP | LCP element | Sharp still | Longest task | CLS | Transfer | Heap | Scroll p95 / >20 ms | Tap INP | Painting |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...phone.map(
        (r) =>
          `| ${r.route} | ${r.fcp} ms | ${r.lcp} ms | ${r.lcpEl} | ${r.stillMs ?? '–'} ms | ${r.longMax} ms | ${r.cls} | ${kb(r.transfer)} | ${r.heapMB ?? '–'} MB | ${r.scroll.p95} ms / ${r.scroll.over20} of ${r.scroll.frames} | ${r.inp ?? '–'} ms | ${r.live} |`,
      ),
      '',
      'Long tasks (ms from navigation start + duration):',
      '',
      ...phone.map((r) => `- ${r.route}: ${r.long.map((e) => `${e.t}+${e.d}`).join(', ') || 'none'}`),
    );
  }
  L.push('', '## Gates failed', '', ...(fails.length ? fails.map((f) => `- ${f}`) : ['- none']));
  writeFileSync(path.join(OUT, 'summary.md'), L.join('\n') + '\n');
  writeFileSync(
    path.join(OUT, 'summary.json'),
    JSON.stringify({ date, base: BASE, html, lighthouse: lh, phone, fails }, null, 1),
  );
  console.log(L.join('\n'));

  // the tail's build stamp: Home's mobile median, written only from a passing run
  const home = lh.find((r) => r.form === 'mobile' && r.route === '/');
  if (flag('--write') && home && !fails.length) {
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
  return fails.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`check-budgets: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  },
);
