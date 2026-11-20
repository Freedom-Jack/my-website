import { ask } from '@content/pages/ask';
import { Arrow } from '@/components/ui/Arrow';
import styles from './door.module.css';

/**
 * The tail's one line, over the scroll in miniature: an invitation, and one of the examples as a button that opens
 * the sheet with that question asked (`data-ask` holds it: AskHost hears the press). Server-rendered words.
 */
export function AskInvite() {
  return (
    <div className={`row ${styles.invite}`}>
      <p className={styles.line}>
        <span className={styles.lead}>{ask.invite}</span>
        <button type="button" className={`go ${styles.ask}`} data-ask={ask.tailTry}>
          <span className="go__words">{ask.tailTry}</span>
          <Arrow />
        </button>
      </p>
    </div>
  );
}
