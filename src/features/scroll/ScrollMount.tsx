import { elementOn } from '@/features/landscape/elements';
import { scrollIndex } from './index';
import { ScrollSheet } from './ScrollSheet';

/**
 * The scroll, held, mounted once in the root layout (a body-level sibling of <main>, so the sheet survives a route
 * exit making <main> inert): the index of what each place holds is built on the server from the content, the sheet
 * itself is a client component that renders nothing until opened. With the element off, nothing is rendered at all.
 */
export async function ScrollMount() {
  if (!elementOn('scroll')) return null;
  return <ScrollSheet stops={await scrollIndex()} />;
}
