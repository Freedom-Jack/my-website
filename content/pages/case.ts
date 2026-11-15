/**
 * A Work case's own page (/work/<slug>/): the few words every case shares, around the case's own (content/work/*.mdx).
 * Kept apart from content/pages/work.ts so nothing here reaches the Work index's HTML (R10). Every word new in the
 * vanguard round is marked DRAFT for Jack.
 */
export const casePage = {
  /**
   * The words beside a figure's measure that say where the figure comes from (A1: the case's `figure.basis`). A
   * `public-source` figure needs none (its measure may link to the page that prints it); a `projected` one is never
   * shown as a figure (it stays in prose, with the word "projected").
   */
  basis: { internal: 'DRAFT · internal figure' },
  /**
   * DRAFT (for Jack): the line on a case with no public evidence (its `evidence` is empty). It adds only what the
   * case's own Evidence line ("Client work, no public page.", the MDX body) does not say, and must be true on every
   * case that shows it: two of them print their figure above it and one names the client.
   */
  nda: 'DRAFT · Under NDA: the figures here come from my own record of the work.',
} as const;
