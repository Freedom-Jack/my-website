import { ask as words } from '@content/pages/ask';
import styles from './ask.module.css';

/**
 * "Ask the painting" as the server renders it: the section's title, its line and its examples, still (no script).
 * components/ui/LazyIsland puts the live piece (Ask.tsx) in its place once the reader is near it; its markup is
 * Ask's own before anything is asked, so nothing moves when the two change places; what is typed meanwhile is handed on.
 */
export function AskShell() {
  return (
    <section className={`part spread ${styles.ask}`} aria-labelledby="ask-title">
      <div className={styles.main} data-veil="">
        <p className="tag">{words.tag}</p>
        <h2 className="h-ink" id="ask-title">
          {words.label}
        </h2>
        <form className={styles.form}>
          <div className={styles.line}>
            <input
              id="ask-line"
              className={styles.input}
              type="text"
              placeholder={words.placeholder}
              maxLength={160}
              autoComplete="off"
              aria-labelledby="ask-title"
              aria-describedby="ask-hint"
            />
            <button className={`action action--button ${styles.go}`} type="button">
              {words.go}
              <span className="action__arrow" aria-hidden="true" />
            </button>
          </div>
          <p className={styles.tries}>
            <span>{words.tryLabel}</span>
            {words.tries.map((t) => (
              <button type="button" key={t}>
                {t}
              </button>
            ))}
          </p>
          <p className={styles.hint} id="ask-hint">
            {words.hint}
          </p>
        </form>
      </div>
    </section>
  );
}
