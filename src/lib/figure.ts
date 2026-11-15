/**
 * A figure as a poster numeral (the vanguard round): the number alone in the name face, any words before it
 * ("About", "Projected", "mAP ≥") as its small lead. "Projected 50%" -> { lead: "Projected", value: "50%" }.
 * The words never change: a case's `figure` (content/work/*.mdx) is shown whole, lead first.
 */
export function splitFigure(f: { lead?: string | undefined; value: string }): { lead: string; value: string } {
  const words = f.value.trim().split(/\s+/);
  const value = words.pop() ?? f.value;
  const lead = [f.lead, ...words].filter(Boolean).join(' ');
  return { lead, value };
}
