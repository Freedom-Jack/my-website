import { workCraft } from '@content/pages/work-craft';
import type { Craft } from './build';
import { FoldBody, type FoldKind } from './client/FoldBody';
import { fill } from './client/fill';
import styles from './craft.module.css';

/**
 * "Under the hood" on Work: three folds, each a server-rendered <details> whose <summary> holds only its title and the
 * size of its data (measured at build, said before the click). Everything else (the fold's module, its JSON with its
 * tie to a production claim, its case and its long words) loads when it first opens (A8 and ruling R10: Work's HTML
 * stays small). The replay fold and the dense gate are cut this round; the mask fold is cut by the build when no
 * opening step exists (build.ts findOpening).
 */
export function Hood({ craft }: { craft: Pick<Craft, 'sizes' | 'mask'> }) {
  const h = workCraft.hood;
  const folds: FoldKind[] = craft.mask ? ['lineage', 'mask', 'eval'] : ['lineage', 'eval'];
  return (
    <section className="sec" id="hood" aria-labelledby="hood-title" data-veil="0.92">
      <h2 className="sec__title" id="hood-title">
        {h.title}
      </h2>
      {folds.map((k) => (
        <details className={styles.fold} key={k} id={`hood-${k}`}>
          <summary className={styles.summary}>
            <span className={styles.foldTitle}>{h[k].title}</span>
            <span className={styles.size}>{fill(h.open, { kb: Math.max(1, Math.round(craft.sizes[k] / 1024)) })}</span>
          </summary>
          <FoldBody kind={k} />
        </details>
      ))}
    </section>
  );
}
