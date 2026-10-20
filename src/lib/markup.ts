import { fillTokens } from './typography';

/**
 * The inline markup allowed in content strings (CONTENT.md), as data (inline.tsx renders it):
 *   **bold**            a figure inside a sentence (bold at text size, never enlarged)
 *   [text](href)        a link; on-site hrefs ("/work/") navigate inside the painting, others leave the site
 *   {kept together}     words that never break across a line (a nowrap span)
 *   {{years}}           the career length in words ("five"); {{years+}} as a figure ("5+")
 * Nothing else is interpreted: no HTML, so a content string can never inject markup.
 */
export const INLINE_TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|\{([^{}]+)\}/g;

/** The same string as plain text (meta descriptions, JSON-LD, resume.json, llms.txt). */
export function plain(text: string): string {
  return fillTokens(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1')
    .replace(/\{([^{}]+)\}/g, '$1');
}
