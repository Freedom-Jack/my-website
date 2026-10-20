import { bootElements } from '@/features/landscape/elements';

/**
 * The ink boot: runs in <head>, before first paint. It reads no styles. Keep it tiny.
 *   html.js            JS is on (CSS shows the JS-only controls and folds what JS will fold)
 *   html.is-sealed     this session has already seen the seal stamped
 *   html.is-still      "Still the landscape" is on (remembered across visits: localStorage 'ink:still')
 *   html.is-arrived    the name's ink settle is done (the arrival effect; also forced after 3 s, whatever happens)
 *   html.el-<name>     an element of features/landscape/elements.ts that is switched on
 *   html.swash-play    this full load of Home lays the name's swash (once per session: sessionStorage 'ink:swash')
 * It also drops the demo's retired session keys once.
 */
const BOOT = `(function(d,w){var h=d.documentElement,s=null,l=null;h.classList.add('js');
try{s=w.sessionStorage}catch(e){}try{l=w.localStorage}catch(e){}
try{if(s&&s.getItem('ink:sealed'))h.classList.add('is-sealed')}catch(e){}
try{if(l&&l.getItem('ink:still')==='1')h.classList.add('is-still')}catch(e){}
try{if(s){['ink:still','ink:transition','ink:compare','ink:palette','ink:name','ink:router','ink:slow'].forEach(function(k){s.removeItem(k)})}}catch(e){}
${bootElements()}
try{if(h.classList.contains('el-swash')&&w.location.pathname==='/'&&!(s&&s.getItem('ink:swash'))&&!h.classList.contains('is-still')){h.classList.add('swash-play');if(s)s.setItem('ink:swash','1')}}catch(e){}
w.setTimeout(function(){h.classList.add('is-arrived')},3000)})(document,window);`;

export function BootScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
