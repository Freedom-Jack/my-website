import { hood } from '@content/craft/hood';
import { buildCraft, craftResponse } from '@/features/craft/build';

/** /craft/eval.json: the DRAFT eval set's results for the lexical search (features/craft/build.ts). */
export const dynamic = 'force-static';

export function GET() {
  const c = buildCraft();
  return craftResponse({ meta: c.meta, ...c.eval, words: hood.eval });
}
