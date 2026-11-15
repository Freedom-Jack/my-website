import { buildCraft, craftResponse, publicChunk } from '@/features/craft/build';

/** /craft/corpus.json: the search's passages, built from content/ at build (features/craft/build.ts). */
export const dynamic = 'force-static';

export function GET() {
  const c = buildCraft();
  return craftResponse({ meta: c.meta, chunks: c.corpus.chunks.map(publicChunk) });
}
