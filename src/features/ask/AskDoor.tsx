import { askDoor } from '@content/pages/ask-door';
import styles from './door.module.css';

/**
 * The door to "Ask the painting", at the right end of the header on every page: a word and the small jade mark of
 * what is live. A plain button with no handler of its own: AskHost (the root layout) hears every `[data-ask]` press
 * and brings the sheet, so the header carries two words and no script for it. `.ask-door` is the name base.css's
 * print rule and the sheet know it by.
 */
export function AskDoor() {
  return (
    <button
      type="button"
      className={`ask-door ${styles.door}`}
      data-ask=""
      aria-label={askDoor.label}
      aria-haspopup="dialog"
      aria-expanded="false"
      aria-keyshortcuts="/"
    >
      <span className={styles.word}>{askDoor.door}</span>
    </button>
  );
}
