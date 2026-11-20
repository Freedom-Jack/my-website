import type { ReactNode } from 'react';
import styles from './MarginNote.module.css';

/**
 * A glossary note beside the text it explains: a definition of a public tool, never a claim about Jack. In MDX it
 * comes right after the paragraph it annotates (<Note term="vLLM">An open-source engine …</Note>); two or more in a
 * row share one cell (div.margin-notes, made by the MDX transform). Always shown, small and quiet: the term in the
 * record's voice, its meaning in the text's. The page places it ([data-margin-note]): in the margin beside its
 * paragraph on wide screens, under it on narrow ones. Plain markup, no script.
 */
export function MarginNote({ term, children }: { term: string; children: ReactNode }) {
  return (
    <aside className={styles.note} data-margin-note="">
      <p>
        <dfn className={styles.term}>{term}</dfn> {children}
      </p>
    </aside>
  );
}
