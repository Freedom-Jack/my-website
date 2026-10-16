'use client';

import { type ReactNode, useState } from 'react';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * A glossary note beside the text it explains (SPEC-R4A §9.8): a definition of a public tool, never a claim about
 * Jack. It comes right after the paragraph it annotates (in MDX: <Note term="vLLM">An open-source engine …</Note>).
 *   ≥ 75rem  in the margin rail of its .has-rail block, beside its paragraph, simply shown
 *   < 75rem  a "Note: {term}" toggle opens it inline (components.css; without JS it shows inline, always open)
 * Two or more in a row share one rail cell (div.margin-notes, made by the MDX transform).
 */
export function MarginNote({ term, children }: { term: string; children: ReactNode }) {
  const id = `note-${slug(term)}`;
  const [open, setOpen] = useState(false);
  return (
    <aside className="margin-note small" id={id} aria-label={`Note: ${term}`}>
      <button
        type="button"
        className="margin-note__toggle"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
      >
        Note: {term}
      </button>
      <div className="margin-note__body" id={`${id}-body`}>
        <p>
          <b className="margin-note__term">{term}:</b> {children}
        </p>
      </div>
    </aside>
  );
}
