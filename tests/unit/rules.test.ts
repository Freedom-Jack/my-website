import { describe, expect, it } from 'vitest';
import overrides from '@content/github/overrides.json';
import snapshot from '@content/github/snapshot.json';
import { choose, denied, group, lineErrors, parseOverrides, repoSchema, type Repo } from '@/features/github/rules';
import { CJK, findBreaches, PHONE } from '@/lib/compliance';
import { redirects } from '@/lib/redirects';
import { normPath, PLACES, placeForPath } from '@/features/landscape/places';
import { careerYears, fillTokens, typeset } from '@/lib/typography';
import { plain } from '@/lib/markup';
import { longDate, monthYear, shortMonthYear } from '@/lib/dates';

const repo = (o: Partial<Repo>): Repo => ({
  name: 'x',
  description: 'A thing.',
  size: 100,
  pushed_at: '2026-01-01T00:00:00Z',
  created_at: '2019-01-01T00:00:00Z',
  ...o,
});

describe('In the open (features/github/rules)', () => {
  it('never lists job-application or this site, whatever the API returns', () => {
    const out = choose(
      [repo({ name: 'job-application' }), repo({ name: 'my-website' }), repo({ name: 'ok' })],
      new Map(),
      '2026-10-16',
    );
    expect(out.map((e) => e.name)).toEqual(['ok']);
    expect(denied('Job-Application')).toBe(true);
  });
  it('skips forks, archived, empty and placeholder repos', () => {
    const out = choose(
      [
        repo({ name: 'fork', fork: true }),
        repo({ name: 'arch', archived: true }),
        repo({ name: 'empty', size: 0 }),
        repo({ name: 'tiny', size: 7 }),
        repo({ name: 'tba', description: 'To be anounced' }),
        repo({ name: 'real' }),
      ],
      new Map(),
      '2026-10-16',
    );
    expect(out.map((e) => e.name)).toEqual(['real']);
  });
  it('groups recent (24 months) apart from early work', () => {
    const g = group(
      choose(
        [
          repo({ name: 'new', pushed_at: '2026-05-01T00:00:00Z' }),
          repo({ name: 'old', pushed_at: '2019-12-01T00:00:00Z' }),
        ],
        new Map(),
        '2026-10-16',
      ),
    );
    expect(g.recent.map((e) => e.name)).toEqual(['new']);
    expect(g.early.map((e) => e.name)).toEqual(['old']);
  });
  it('refuses a description with a phone number or CJK (unless an override line replaces it)', () => {
    expect(lineErrors('Call 416 555 0100.')).not.toEqual([]);
    expect(choose([repo({ name: 'p', description: 'Call 416 555 0100' })], new Map(), '2026-10-16')).toEqual([]);
  });
  it('the committed overrides and snapshot are valid, and render the four early repositories', () => {
    const o = parseOverrides(overrides);
    const g = group(choose(repoSchema.array().parse(snapshot.repos), o, snapshot.fetched));
    expect(g.early.map((e) => e.name)).toEqual(['world_qlearning', 'aStar-pathFinding', 'cryptology', 'reddit-tfidf']);
    expect(g.earlyRange).toEqual({ first: 2019, last: 2020 });
  });
});

describe('compliance patterns (lib/compliance)', () => {
  it('finds phone numbers in their common forms', () => {
    for (const p of [
      '(416) 555-0100',
      '416-555-0100',
      '416.555.0100',
      '+1 416 555 0100',
      '4165550100',
      'tel:+14165550100',
    ])
      expect(PHONE.test(p), p).toBe(true);
  });
  it('leaves years, ranges and figures alone', () => {
    for (const t of [
      '2017 – 2021',
      '50,000+ users',
      '99.9% uptime',
      '525% ROI',
      '2 TB',
      'mAP ≥ 70%',
      '18 hours',
      'Aug 2023 – Dec 2024',
    ])
      expect(findBreaches(t), t).toEqual([]);
  });
  it('finds CJK, PMP and the old PDF', () => {
    expect(CJK.test(String.fromCodePoint(0x5f90))).toBe(true);
    expect(findBreaches('PMP certified').map((f) => f.rule)).toContain('pmp');
    expect(findBreaches('/documents/QijinXu_Resume.pdf').map((f) => f.rule)).toContain('old-pdf');
  });
});

describe('redirects (DESIGN §5)', () => {
  it('sends the old résumé PDF to the résumé page, never to the new PDF', () => {
    const r = redirects.find((x) => /QijinXu_Resume\.pdf/.test(x.from));
    expect(r?.to).toBe('/resume/');
  });
  it('covers every old address', () => {
    const from = redirects.map((r) => r.from);
    for (const p of [
      '/about',
      '/projects',
      '/blog',
      '/blog/Building-Autonomous-AI-Agents',
      '/writing/building-modular-ai-agents',
      '/blog/welcome-to-my-first-blog',
      '/blog/welcome-to-my-second-blog',
    ])
      expect(from).toContain(p);
  });
});

describe('places (features/landscape/places)', () => {
  it('puts each page at its place on the one painting', () => {
    expect(placeForPath('/').stretch).toBe(0);
    expect(placeForPath('/work/').stretch).toBe(1);
    expect(placeForPath('/work/rag-assistant/').page).toBe('case');
    expect(placeForPath('/writing/what-is-an-ai-agent').page).toBe('article');
    expect(placeForPath('/resume/').stretch).toBe(4);
    expect(placeForPath('/contact/').stretch).toBe(5);
    expect(placeForPath('/nowhere/').stretch).toBe(6);
  });
  it('lives on Home and Work only; every page on the road ends on its closing scene (round 5)', () => {
    expect(
      Object.values(PLACES)
        .filter((p) => p.ground === 'living')
        .map((p) => p.page),
    ).toEqual(['home', 'work']);
    expect(
      Object.values(PLACES)
        .filter((p) => !p.closing)
        .map((p) => p.page),
    ).toEqual(['not-found']);
    // one hero system: Home's tall hero, the same sub hero everywhere else
    expect(
      Object.values(PLACES)
        .filter((p) => p.strip !== 'sub')
        .map((p) => p.page),
    ).toEqual(['home']);
  });
  it('normalises paths like the site writes them', () => {
    expect(normPath('/work')).toBe('/work/');
    expect(normPath('/resume.pdf')).toBe('/resume.pdf');
    expect(normPath('/work/?x=1#y')).toBe('/work/');
  });
});

describe('typography and markup', () => {
  it('keeps units with their numbers', () => {
    expect(typeset('under 200 ms')).toBe('under 200 ms');
    expect(typeset('mAP ≥ 70%')).toBe('mAP ≥ 70%');
  });
  it('counts whole years of full-time work since Aug 2021', () => {
    expect(careerYears(new Date('2026-10-16T00:00:00Z'))).toBe(5);
    expect(careerYears(new Date('2026-07-31T00:00:00Z'))).toBe(4);
    expect(fillTokens('the last {{years}} years, {{years+}}', new Date('2026-10-16T00:00:00Z'))).toBe(
      'the last five years, 5+',
    );
  });
  it('strips markup to plain text', () => {
    expect(plain('About **90%**, [a link](/work/) and {kept together}')).toBe('About 90%, a link and kept together');
  });
  it('writes dates as the site does', () => {
    expect(monthYear('2026-10')).toBe('October 2026');
    expect(shortMonthYear('2023-08')).toBe('Aug 2023');
    expect(longDate('2025-04-20')).toBe('April 20, 2025');
  });
});
