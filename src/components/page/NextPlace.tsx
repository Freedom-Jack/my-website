import { contact } from '@content/pages/contact';
import { resumePage } from '@content/pages/resume';
import { work } from '@content/pages/work';
import { writing } from '@content/pages/writing';
import { site } from '@content/site';
import { NEXT_PLACE, type PageId } from '@/features/landscape/places';
import { Inline, InlineLink } from '@/lib/inline';

/**
 * The ending (05-synthesis.md): every page but Contact and the 404 ends on one line pointing downstream: the label
 * (content/site.ts `ending`), the next place's name as the link with its drawn arrow ("Downstream · Work →"), and
 * that page's own sentence from content/. The chain Home → Work → Writing → Résumé → Contact has no dead end; a case
 * and a note point past their own place. A real anchor: the page change is the painting's own pan (features/navigation).
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
    <aside className="next" aria-label={`${site.ending.label}: ${next.label}`}>
      <p className="next__head">
        <span className="next__label mono">{site.ending.label}</span>
        <InlineLink href={next.href} className="next__link">
          {next.label}
          <span className="action__arrow" aria-hidden="true" />
        </InlineLink>
      </p>
      {line ? (
        <p className="next__line">
          <Inline text={line} />
        </p>
      ) : null}
    </aside>
  );
}
