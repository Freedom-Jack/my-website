/** What every page's words carry: its <title> and meta description. */
export interface PageMeta {
  /** "Qijin (Jack) Xu · Page": the exact search phrase first. */
  title: string;
  /** ≤ 160 characters; third person. */
  description: string;
  /** the last change to the page's words (ISO date), where its structured data says so */
  modified?: string;
}

export interface PageWords {
  meta: PageMeta;
}
