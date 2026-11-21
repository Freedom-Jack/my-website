import { Landscape } from '@/features/landscape/Landscape';
import { BandStill } from './BandStill';

/**
 * THE BAND (styles/band.css, features/landscape/band.ts): the painting, the page's background, fixed behind every
 * page. It holds the page's still (every device, from the first paint), and over it the live stage where the engine
 * runs (1200 px and up). Persistent across pages; decorative.
 */
export function Band() {
  return (
    <div className="band" aria-hidden="true">
      <div className="band__clip">
        <BandStill />
        <Landscape />
      </div>
      <div className="band__mist" />
    </div>
  );
}
