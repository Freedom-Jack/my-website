import { readFileSync } from 'node:fs';
import path from 'node:path';
import { work } from '@content/pages/work';
import { fillTokens, typeset } from '@/lib/typography';
import styles from './Diagram.module.css';

/**
 * A brush diagram: a drawing in ink on the page's paper. Two drawings of the same nodes come from
 * content/work/diagrams/<name>.wide.svg (left to right, from a 52rem container) and <name>.tall.svg (stacked: phones
 * and narrow columns; only one is rendered, so only one is in the accessibility tree), then its caption and its
 * text equivalent, "Read as steps" (under the drawing; beside the tall one on a tablet). Each drawing carries its
 * own <title> and <desc>.
 *
 * The files hold the geometry and the words; the ink is laid here, at build time:
 *   a node    its wash (a pale pool of thinned ink, a little off its outline, as a wash sits) and its outline brushed
 *             round in one stroke that does not quite close, heavier where the brush came down;
 *   an edge   one stroke from thick to thin with round ends (three passes of the same line, each shorter and
 *             heavier), then its head, two flicks. The edges draw in once, in the order the data flows
 *             (data-order), as the drawing enters view: CSS alone (Diagram.module.css), drawn at rest under reduced
 *             motion, Still, print, and where the browser has no view timelines;
 *   a group   a broad pale wash behind its nodes, its name in the record's voice.
 * Nothing here runs in the browser.
 */
const DIR = path.join(process.cwd(), 'content', 'work', 'diagrams');

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Where a node's outline opens (a share of its length): each node's brush lifts at a different place. */
const lift = (i: number) => (0.14 + ((i * 0.37) % 0.5)).toFixed(2);

function drawing(name: string, kind: 'wide' | 'tall'): string {
  const svg = readFileSync(path.join(DIR, `${name}.${kind}.svg`), 'utf8');
  let node = 0;
  return (
    svg
      // inline: the file's own namespace declaration is implied by HTML
      .replace(' xmlns="http://www.w3.org/2000/svg"', '')
      .replace(/<path class="diagram__node" d="([^"]+)"\/>/g, (_m, d: string) => {
        const a = lift(node++);
        return (
          `<path class="diagram__wash" d="${d}"/>` +
          `<path class="diagram__node" pathLength="1" style="--a:${a}" d="${d}"/>` +
          `<path class="diagram__node diagram__node--press" pathLength="1" style="--a:${a}" d="${d}"/>`
        );
      })
      .replace(
        /<path class="diagram__edge" pathLength="1" data-order="(\d+)" d="([^"]+)"\/>/g,
        (_m, order: string, d: string) => {
          // the line is the first subpath; the rest is its head
          const at = d.indexOf('M', 1);
          const line = at < 0 ? d : d.slice(0, at);
          const head = at < 0 ? '' : d.slice(at);
          return (
            `<g class="diagram__flow" style="--o:${Number(order) - 1}">` +
            [1, 2, 3]
              .map((n) => `<path class="diagram__edge diagram__edge--${n}" pathLength="1" d="${line}"/>`)
              .join('') +
            (head ? `<path class="diagram__head" d="${head}"/>` : '') +
            '</g>'
          );
        },
      )
      .trim()
  );
}

export function Diagram({
  name,
  caption,
  steps,
  className,
}: {
  name: string;
  caption: string;
  steps: readonly string[];
  className?: string;
}) {
  const text = (s: string) => escape(typeset(fillTokens(s)));
  const html = [
    drawing(name, 'wide'),
    drawing(name, 'tall'),
    `<figcaption class="diagram__caption">${text(caption)}</figcaption>`,
    `<details class="diagram__steps"><summary><span>${text(work.diagram.steps)}</span></summary><ol>`,
    ...steps.map((s) => `<li>${text(s)}</li>`),
    '</ol></details>',
  ].join('');
  // (the outer box is the size container, so the figure's own columns can follow its width)
  return (
    <div className={className ? `${styles.diagram} ${className}` : styles.diagram}>
      <figure className={styles.figure} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
