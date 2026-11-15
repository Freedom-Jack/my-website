/**
 * The shared ink filters, referenced from the seal (components/ui/Seal, the tail's): the carved stone's chipped edge
 * and the sparse specks where the ink did not take. Decorative.
 */
export function InkDefs() {
  return (
    <svg className="ink-defs" aria-hidden="true" focusable="false">
      <filter id="seal-stone" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves={3} seed={11} result="n" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n"
          scale={2.4}
          xChannelSelector="R"
          yChannelSelector="G"
          result="d"
        />
        <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves={2} seed={3} result="g" />
        <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -11 7.7" result="speck" />
        <feComposite in="d" in2="speck" operator="in" />
      </filter>
    </svg>
  );
}
