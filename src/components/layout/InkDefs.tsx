/**
 * The shared ink filters, referenced from effects.css and the seals: the capillary edge of an ink bloom, the
 * wet front of a button's bloom, the name's ink settle (relaxed from 8 to 0 by the arrival effect) and the
 * carved stone of the seal. Decorative.
 */
export function InkDefs() {
  return (
    <svg className="ink-defs" aria-hidden="true" focusable="false">
      <filter id="ink-feather" x="-12%" y="-40%" width="124%" height="180%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.045 0.07" numOctaves={4} seed={11} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={16} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feGaussianBlur in="d" stdDeviation=".6" result="b" />
        <feComponentTransfer in="b">
          <feFuncA type="table" tableValues="0 .05 .7 1 1" />
        </feComponentTransfer>
      </filter>
      <filter id="ink-bloom" x="-20%" y="-70%" width="140%" height="240%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.026 0.075" numOctaves={4} seed={4} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={30} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feGaussianBlur in="d" stdDeviation=".7" result="b" />
        <feComponentTransfer in="b">
          <feFuncA type="table" tableValues="0 .08 .75 1 1" />
        </feComponentTransfer>
      </filter>
      <filter id="ink-arrive" x="-3%" y="-15%" width="106%" height="130%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.042" numOctaves={3} seed={7} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={8} xChannelSelector="R" yChannelSelector="G" />
      </filter>
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
