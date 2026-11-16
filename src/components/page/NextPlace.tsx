import { contact } from '@content/pages/contact';
import { resumePage } from '@content/pages/resume';
import { work } from '@content/pages/work';
import { writing } from '@content/pages/writing';
import { site } from '@content/site';
import { NEXT_PLACE, type PageId } from '@/features/landscape/places';
import { Inline, InlineLink } from '@/lib/inline';

/**
 * The ending: every page but Contact and the 404 ends on the next place downstream (the chain Home → Work → Writing
 * → Résumé → Contact has no dead end; a case and a note point past their own place). Round 7: the place's name is
 * inked INTO the painting (body.css .inked: between the painting's two leaves), at the right, where that place has
 * come into view by the page's end (the travel stops 60 % of the way to it), so its roofs or peaks stand in front of
 * the letters; the label (content/site.ts `ending`) and the next page's own sentence lie in a cloud at the left. A
 * real anchor: the page change is the painting's own pan (features/navigation).
 */
/** A 1 × 1 transparent GIF: the still's source on wide screens (no request there: the painting itself is the picture). */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

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
      <p className="next__name inked">
        <InlineLink href={next.href} className="next__link">
          {next.label}
          <span className="action__arrow" aria-hidden="true" />
        </InlineLink>
      </p>
      {/* below 1200 px no stage stands behind the page: the next place's own first frame (the hero still build:heroes
          cuts) lies under its name instead, the screen's width; fetched only as the ending nears. Art only. */}
      <picture className="next__still">
        <source media="(min-width: 75rem)" srcSet={BLANK} />
        <source
          media="(min-width: 40rem)"
          srcSet={`/scenes/hero/${next.page}-tablet@1x.webp`}
          width={1000}
          height={220}
        />
        <img
          src={`/scenes/hero/${next.page}-phone@2x.webp`}
          alt=""
          width={430}
          height={169}
          loading="lazy"
          decoding="async"
        />
      </picture>
    </aside>
  );
}
