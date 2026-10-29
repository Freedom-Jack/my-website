/** The scroll, held: what each place on the map holds, in the site's own words (index.ts builds it on the server). */
export interface ScrollLine {
  label: string;
  href: string;
}
export interface ScrollStop {
  /** The place's stretch along the handscroll (places.ts STORY_MAP): Home 0 … Contact 4. */
  stretch: number;
  /** The place's name (the story map's label) and its page. */
  label: string;
  href: string;
  /** What the page there holds, each line an existing string on the site and a real link. */
  lines: ScrollLine[];
}
