import { bootElements } from '@/features/landscape/elements';

/**
 * The ink boot: runs in <head>, before first paint. It reads no styles. Keep it tiny.
 *   html.js            JS is on (CSS shows the JS-only controls and folds what JS will fold)
 *   html.is-still      "Still the landscape" is on (remembered across visits: localStorage 'ink:still')
 *   html.el-<name>     an element of features/landscape/elements.ts that is switched on
 * A strip's sharp still that fails to load is hidden (a capturing error listener: error events do not bubble), so
 * Chrome's broken-image box never shows over the inline seed.
 */
const BOOT = `(function(d,w){var h=d.documentElement,l=null;h.classList.add('js');
d.addEventListener('error',function(e){var t=e.target;if(t&&t.closest&&t.closest('.strip__still--sharp'))t.style.visibility='hidden'},true);
try{l=w.localStorage}catch(e){}
try{if(l&&l.getItem('ink:still')==='1')h.classList.add('is-still')}catch(e){}
${bootElements()}})(document,window);`;

export function BootScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
