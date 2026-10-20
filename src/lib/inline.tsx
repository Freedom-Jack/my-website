import Link from 'next/link';
import type { ReactNode } from 'react';
import { INLINE_TOKEN } from './markup';
import { COMPOUND, fillTokens, typeset } from './typography';

/** Renders the inline markup of content strings (lib/markup.ts, CONTENT.md). */

export function isInternal(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

/** One link, as every link on the site is drawn: a resting dry-brush mark that draws on hover. */
export function InlineLink({
  href,
  children,
  className = 'brush brush--rest',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  if (isInternal(href) && !/\.[a-z0-9]+$/i.test(href.split(/[?#]/)[0] ?? '')) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

/** Plain text, with its short hyphenated compounds kept whole (lib/typography.ts COMPOUND). */
function words(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(COMPOUND)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <span key={`${key}.w${i++}`} className="nowrap">
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function parse(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE_TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(...words(text.slice(last, at), `${key}.t${i}`));
    const k = `${key}.${i++}`;
    if (m[1] !== undefined) out.push(<b key={k}>{parse(m[1], k)}</b>);
    else if (m[2] !== undefined && m[3] !== undefined) {
      out.push(
        <InlineLink key={k} href={m[3]}>
          {parse(m[2], k)}
        </InlineLink>,
      );
    } else if (m[4] !== undefined) {
      out.push(
        <span key={k} className="nowrap">
          {m[4]}
        </span>,
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(...words(text.slice(last), `${key}.t${i}`));
  return out;
}

/** Render a content string's inline markup. */
export function Inline({ text }: { text: string }) {
  return <>{parse(typeset(fillTokens(text)), 'i')}</>;
}
