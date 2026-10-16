import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fillTokens, typeset } from '@/lib/typography';

/**
 * A brush diagram (SPEC-R4A §9.7): two drawings of the same nodes from content/work/diagrams/<name>.wide.svg
 * (left to right, from a 60rem container) and <name>.tall.svg (stacked, never taller than a phone screen; only
 * one is rendered, so only one is in the accessibility tree), a caption, and its text equivalent, "Read as
 * steps". Each drawing carries its own <title> and <desc>; its edges draw in once (features/effects/diagram).
 * `fold`: on phones the drawing folds behind its own "Read as steps" (the flagship cases).
 * The drawings are content (their labels are words), inlined at build time; nothing here runs in the browser.
 */
const DIR = path.join(process.cwd(), 'content', 'work', 'diagrams');

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function drawing(name: string, kind: 'wide' | 'tall'): string {
  const svg = readFileSync(path.join(DIR, `${name}.${kind}.svg`), 'utf8');
  // inline: the file's own namespace declaration is implied by HTML
  return svg.replace(' xmlns="http://www.w3.org/2000/svg"', '').trim();
}

export function Diagram({
  name,
  caption,
  steps,
  fold = false,
}: {
  name: string;
  caption: string;
  steps: readonly string[];
  fold?: boolean;
}) {
  const text = (s: string) => escape(typeset(fillTokens(s)));
  const html = [
    drawing(name, 'wide'),
    drawing(name, 'tall'),
    `<figcaption class="diagram__caption small">${text(caption)}</figcaption>`,
    '<details class="diagram__steps"><summary>Read as steps</summary><ol>',
    ...steps.map((s) => `<li>${text(s)}</li>`),
    '</ol></details>',
  ].join('');
  return (
    <figure
      className="diagram wide"
      data-diagram={name}
      data-fold={fold ? 'phone' : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
