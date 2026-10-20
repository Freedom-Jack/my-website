import { ELEMENTS } from '@/features/landscape/elements';

/**
 * The closing scene: the page's own place once more (DESIGN §11.B), an EMPTY box the painting fills. No
 * "Next: …" link (DESIGN §11.E answer 8): the footer's story map, which links every place, is the way on.
 * `end` (step 3b, elements.ts glimpses; Writing and Contact, the short pages): below 1200 px its box is a little taller
 * and the windows into the painting end there: the place settled, near and large, above the story map.
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
