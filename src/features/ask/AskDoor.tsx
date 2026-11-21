import { askDoor } from '@content/pages/ask-door';
import styles from './door.module.css';

/**
 * The door to "Ask the painting": a search field in the header's bar on every page, as a Mac keeps its search. It
 * looks like a field and is a plain button with no handler of its own: AskHost (the root layout) hears every
 * `[data-ask]` press, "/" and Cmd/Ctrl-K, and brings the panel under the bar, so the header carries a few words and
 * no script for it. On a phone it is the magnifier alone. `.ask-door` is the name base.css's print rule and the
 * panel know it by.
 */
export function AskDoor() {
  return (
    <button
      type="button"
      className={`ask-door ${styles.door}`}
      data-ask=""
      aria-haspopup="dialog"
      aria-expanded="false"
      aria-keyshortcuts="/ Meta+K Control+K"
    >
      <svg className={styles.glass} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <circle cx="8.6" cy="8.6" r="5.6" />
        <path d="m12.9 12.9 4.3 4.3" />
      </svg>
      {/* (its name is "Ask the painting": the word it shows, and the rest for a screen reader) */}
      <span className={styles.word}>
        {askDoor.door}
        <span className="visually-hidden">{askDoor.label.slice(askDoor.door.length)}</span>
      </span>
      <span className={styles.ghost} aria-hidden="true">
        {askDoor.placeholder}
      </span>
      <kbd className={styles.key} aria-hidden="true">
        /
      </kbd>
    </button>
  );
}
