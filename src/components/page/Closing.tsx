import { ELEMENTS } from '@/features/landscape/elements';

/**
 * The closing scene: the page's own place once more, an empty box the painting fills, after the page's ending
 * (NextPlace, where it has one) and above the tail's scroll map (components/layout/ScrollMap).
 * `end` (elements.ts glimpses; Writing and Contact, the short pages): below 1200 px its box is a little taller
 * and the windows into the painting end there: the place settled, near and large, above the scroll map.
 */
export function Closing({ end = false }: { end?: boolean }) {
  return (
    <div className="closing">
      <div
        className="closing__art bleed"
        data-landscape="closing"
        data-wake=""
        data-glimpse={end && ELEMENTS.glimpses ? 'end' : undefined}
        aria-hidden="true"
      />
    </div>
  );
}
