import { site } from '@content/site';
import { SEAL_GLYPH, SEAL_STONE } from '@/components/ui/Seal';
import { Inline } from '@/lib/inline';
import { ColophonEffects } from './ColophonEffects';
import styles from './colophon.module.css';

/**
 * The author's colophon at the end of a note and of a case: the seal, stamped once as it comes into view
 * (ColophonEffects), beside the author line (content/site.ts `bio`, whose name links home). A page reached from a
 * search result or a shared link then says whose work it is and where to read more. One per page: the seal's mask
 * id is fixed. The stone's filter (#seal-stone) is in the root layout's InkDefs.
 */
export function Colophon() {
  return (
    <div className={styles.colophon}>
      <svg className={styles.colophon__seal} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
          <mask id="colophon-carve" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
            <rect width="64" height="64" fill="#fff" />
            <path className="seal__glyph" d={SEAL_GLYPH} />
          </mask>
        </defs>
        <g filter="url(#seal-stone)">
          <path className="seal__stone" mask="url(#colophon-carve)" d={SEAL_STONE} />
        </g>
      </svg>
      <p className={styles.colophon__line}>
        <Inline text={site.bio} />
      </p>
      <ColophonEffects sealClass={styles.colophon__seal!} pending={styles.isPending!} stamping={styles.isStamping!} />
    </div>
  );
}
