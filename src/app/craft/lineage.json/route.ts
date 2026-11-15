import { hood } from '@content/craft/hood';
import { buildCraft, craftResponse } from '@/features/craft/build';

/** /craft/lineage.json: where the craft's words came from (features/craft/build.ts). */
export const dynamic = 'force-static';

export function GET() {
  const c = buildCraft();
  return craftResponse({ meta: c.meta, ...c.lineage, words: hood.lineage });
}
