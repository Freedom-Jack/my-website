import { hood } from '@content/craft/hood';
import { buildCraft, craftResponse } from '@/features/craft/build';

/** /craft/mask.json: the grammar's roles, the vocabulary, the scores and the opening step (features/craft/build.ts). */
export const dynamic = 'force-static';

export function GET() {
  const c = buildCraft();
  return craftResponse(c.mask ? { meta: c.meta, ...c.mask, words: hood.mask } : { meta: c.meta, cut: true });
}
