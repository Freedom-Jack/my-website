import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ROUTES, settle, VIEWPORTS } from './support/pages';

/**
 * The DESIGN §6 budgets (SPEC-R4A §15.2), per page at 1440 / 1280 / 390, measured by the demo's own probe
 * (support/measure.js) and judged as design-demo/tools/qa/budget.py judged demo 4b, with its accepted exceptions:
 *   - 5 type sizes on the Résumé, Contact and Writing (SPEC §15.4);
 *   - short pages (Contact, Writing, the Note, the 404, a case) over .10 display ÷ readable on wide screens;
 *   - a page whose whole content fits screen one reports a low word count;
 *   - the Résumé and the Note up to 5 words short at 1440 / 1280 (SPEC §15.4.2);
 *   - Home at 390 up to 2 words short: demo 4b's 56 counted its "Draft art" label (2 words), which the build drops;
 *   - the 404 at 390 over .10 (.69: one short line under its title; the demo's known miss, RECORD §7.4).
 * OPEN (a question for Jack, reported but not failed): a case page at 390 is over .10 (.28), because the case's long
 * title is the page's h1 at title size (32 px, two or three lines). Options: accept, or set case titles at the
 * section-heading size on phones.
 * Work is now a concise index (DESIGN §11.E answer 2): its length budget (≤ 5 / 6 / 8 screens) must hold.
 */
const MEASURE = readFileSync(path.join(import.meta.dirname, 'support/measure.js'), 'utf8');
const WORDS = { home: { '1440': 120, '1280': 100, '390': 55 }, sub: { '1440': 150, '1280': 120, '390': 90 } } as const;
const NAME = { '1440': 72, '1280': 68, '390': 45 } as const;
const TITLE = { '1440': 40, '1280': 40, '390': 32 } as const;
const WORK_LEN = { '1440': 5, '1280': 6, '390': 8 } as const;
const FIVE_OK = new Set(['resume', 'contact', 'writing']);
const SHORT = new Set(['contact', 'writing', 'note', '404', 'case']);

type M = Record<string, any>;

for (const [vp, v] of Object.entries(VIEWPORTS) as Array<
  [keyof typeof VIEWPORTS, (typeof VIEWPORTS)[keyof typeof VIEWPORTS]]
>) {
  test.describe(`budgets at ${v.width} × ${v.height}`, () => {
    test.use({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: v.dpr,
      isMobile: v.mobile,
      hasTouch: v.mobile,
    });
    for (const r of ROUTES) {
      test(r.id, async ({ page }) => {
        await page.goto(r.path);
        await settle(page);
        const m = (await page.evaluate(`(${MEASURE})({ taps: true })`)) as M;
        const wide = v.width >= 1200;
        const fail: string[] = [];
        // words on the first screen
        const tgt = WORDS[r.id === 'home' ? 'home' : 'sub'][vp];
        const w4 = m.s0.words4a as number;
        const homeLabel = r.id === 'home' && vp === '390' && tgt - w4 <= 2;
        if (
          w4 < tgt &&
          !m.fitsFirstScreen &&
          !homeLabel &&
          !((r.id === 'resume' || r.id === 'note') && wide && tgt - w4 <= 5) &&
          !SHORT.has(r.id)
        ) {
          fail.push(`first-screen words ${w4} < ${tgt}`);
        }
        // display ÷ readable
        const lim = r.id === 'home' ? 0.25 : 0.1;
        const worst = Math.round(Math.max(m.s0.ratio || 0, m.pageRatio || 0) * 100) / 100;
        if (worst > lim && !(SHORT.has(r.id) && wide) && !(r.id === '404' && vp === '390')) {
          if (r.id === 'case' && vp === '390')
            test.info().annotations.push({
              type: 'open',
              description: `case at 390: display/read ${worst} > ${lim} (a question for Jack)`,
            });
          else fail.push(`display/read ${worst} > ${lim}`);
        }
        // type sizes per screen
        if (m.maxSizesPerScreen > 4 && !(m.maxSizesPerScreen === 5 && FIVE_OK.has(r.id)))
          fail.push(`${m.maxSizesPerScreen} type sizes on one screen`);
        // the largest text
        if (r.id === 'home') {
          if (Math.abs(m.nameFs - NAME[vp]) > 2) fail.push(`name ${m.nameFs}px, target ~${NAME[vp]}`);
          if (!m.photo?.onFirstScreen) fail.push(`the photo does not start on the first screen (top ${m.photo?.top})`);
        } else if (m.h1Fs > TITLE[vp] + 0.5) fail.push(`title ${m.h1Fs}px > ${TITLE[vp]}`);
        // no text animating on scroll
        if (m.reveal !== 0 || !m.arriveOk) fail.push(`data-reveal ${m.reveal}, data-arrive ${m.arrive}`);
        // nothing scrolls sideways; standalone tap targets ≥ 44 × 44
        if (m.overflow.sideways || m.overflow.offenderCount)
          fail.push(`sideways: ${JSON.stringify(m.overflow.offenders?.slice(0, 3))}`);
        const small = m.taps?.small ?? [];
        if (small.length)
          fail.push(
            `tap targets < 44: ${small
              .slice(0, 4)
              .map((t: M) => `${t.el} '${t.name}' ${t.hitW}×${t.hitH}`)
              .join('; ')}`,
          );
        // the header in one row from 360
        if (v.width >= 360 && (m.header?.rows ?? 1) > 1) fail.push(`header wraps into ${m.header.rows} rows`);
        // Work, a concise index
        if (r.id === 'work' && m.screens > WORK_LEN[vp]) fail.push(`Work is ${m.screens} screens > ${WORK_LEN[vp]}`);
        expect(fail, `${r.id} at ${vp}`).toEqual([]);
      });
    }
  });
}
