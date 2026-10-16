/**
 * The closing scene: the page's own place once more (DESIGN §11.B), an EMPTY box the painting fills. No
 * "Next: …" link (DESIGN §11.E answer 8): the footer's story map, which links every place, is the way on.
 */
export function Closing() {
  return (
    <div className="closing">
      <div className="closing__art bleed" data-landscape="closing" data-wake="" aria-hidden="true" />
    </div>
  );
}
