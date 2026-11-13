import { bootElements } from '@/features/landscape/elements';

/**
 * The ink boot: runs in <head>, before first paint. It reads no styles. Keep it tiny.
 *   html.js            JS is on (CSS shows the JS-only controls and folds what JS will fold)
 *   html.is-still      "Still the landscape" is on (remembered across visits: localStorage 'ink:still')
 *   html.el-<name>     an element of features/landscape/elements.ts that is switched on
 * A strip's still that fails to load is hidden (a capturing error listener: error events do not bubble), so Chrome's
 * broken-image box never shows over the inline seed (the lead's ruling R12).
 * It also drops the demo's and the earlier rounds' retired session keys once (the seal's stamp and the name's swash
 * went with the vanguard round: the first screen is finished at first paint).
 */
const BOOT = `(function(d,w){var h=d.documentElement,s=null,l=null;h.classList.add('js');
d.addEventListener('error',function(e){var t=e.target;if(t&&t.closest&&t.closest('.strip__still--sharp'))t.style.visibility='hidden'},true);
try{s=w.sessionStorage}catch(e){}try{l=w.localStorage}catch(e){}
try{if(l&&l.getItem('ink:still')==='1')h.classList.add('is-still')}catch(e){}
try{if(s){['ink:still','ink:transition','ink:compare','ink:palette','ink:name','ink:router','ink:slow','ink:sealed','ink:swash','ink:been'].forEach(function(k){s.removeItem(k)})}}catch(e){}
${bootElements()}})(document,window);`;

export function BootScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
