import { contact } from '@content/pages/contact';
import { resumePage } from '@content/pages/resume';
import { work } from '@content/pages/work';
import { writing } from '@content/pages/writing';
import { site } from '@content/site';
import { NEXT_PLACE, type PageId } from '@/features/landscape/places';
import { Inline, InlineLink } from '@/lib/inline';

/**
 * The ending: every page but Contact and the 404 ends on the next place downstream (the chain Home → Work → Writing
 * → Résumé → Contact has no dead end; a case and a note point past their own place). The place's name
 * stands large at the right, over the painting. Where the page's travel has brought that place into view by the
 * page's end (places.ts NEXT_PLACE `inked`), the name is inked into the painting (body.css .inked: between the
 * painting's two leaves), so its roofs or peaks stand in front of the letters; where the page's own place holds
 * beside the words, the name stands in front of it. The label (content/site.ts `ending`) and the next page's own
 * sentence lie in a breath of mist at the left. A real anchor: the page change is the painting's own pan
 * (features/navigation).
 */
const LINES: Partial<Record<PageId, string>> = {
  work: work.intro,
  writing: writing.intro,
  resume: resumePage.line,
  contact: contact.intro,
};

export function NextPlace({ page }: { page: PageId }) {
  const next = NEXT_PLACE[page];
  if (!next) return null;
  const line = LINES[next.page];
  return (
    <aside className="next spread" aria-label={`${site.ending.label}: ${next.label}`}>
      <div className="next__text" data-veil="">
        <p className="tag">{site.ending.label}</p>
        {line ? (
          <p className="next__line">
            <Inline text={line} />
          </p>
        ) : null}
      </div>
      <p className={next.inked ? 'next__name inked' : 'next__name'}>
        <InlineLink href={next.href} className="next__link">
          {next.label}
          <span className="action__arrow" aria-hidden="true" />
        </InlineLink>
      </p>
      {/* below 1200 px no stage stands behind the page: the next place's own first frame (the hero still build:heroes
          cuts) lies under its name instead, the screen's width. Its source comes as the ending nears
          (features/landscape/glimpse-stills: never in the page's first load), and never on wide screens, where it is
          not laid out. Art only. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a static WebP the heroes tool cut */}
      <img
        className="next__still"
        data-near=""
        data-src={`/scenes/hero/${next.page}-phone@2x.webp`}
        data-src-wide={`/scenes/hero/${next.page}-tablet@1x.webp`}
        alt=""
        width={430}
        height={169}
        decoding="async"
      />
    </aside>
  );
}
