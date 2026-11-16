import { workCraft } from '@content/pages/work-craft';
import styles from './craft.module.css';

/**
 * "Search these pages" as the server renders it: the label, the box and the status line that says how much data
 * the index is, still (no script). components/ui/LazyIsland puts the live search (client/Search.tsx) in its place
 * once the reader is near it (what is typed meanwhile is handed on); without JavaScript the search is not shown at all
 * (craft.module.css: html:not(.js)).
 */
export function SearchShell({ size }: { size: number }) {
  const t = workCraft.search;
  return (
    <form className={styles.search} role="search" aria-labelledby="search-shell-label">
      <label className={styles.label} id="search-shell-label" htmlFor="search-shell-q">
        {t.label}
      </label>
      <div className={styles.field}>
        <input
          id="search-shell-q"
          className={styles.input}
          type="search"
          name="q"
          autoComplete="off"
          placeholder={t.placeholder}
        />
        <button type="button" className={`action action--button ${styles.submit}`}>
          {t.submit}
        </button>
      </div>
      <p className={styles.status}>{t.idle.replace('{kb}', String(Math.max(1, Math.round(size / 1024))))}</p>
    </form>
  );
}
