/**
 * The ink boot: runs in <head>, before first paint. It reads no styles. Keep it tiny.
 *   html.js            JS is on (CSS shows the JS-only controls and folds what JS will fold)
 *   html.is-sealed     this session has already seen the seal stamped
 *   html.is-still      "Still the landscape" is on (remembered across visits: localStorage 'ink:still')
 *   html.is-arrived    the name's ink settle is done (the arrival effect; also forced after 3 s, whatever happens)
 * It also drops the demo's retired session keys once.
 */
const BOOT = `(function(d,w){var h=d.documentElement,s=null,l=null;h.classList.add('js');
try{s=w.sessionStorage}catch(e){}try{l=w.localStorage}catch(e){}
try{if(s&&s.getItem('ink:sealed'))h.classList.add('is-sealed')}catch(e){}
try{if(l&&l.getItem('ink:still')==='1')h.classList.add('is-still')}catch(e){}
try{if(s){['ink:still','ink:transition','ink:compare','ink:palette','ink:name','ink:router','ink:slow'].forEach(function(k){s.removeItem(k)})}}catch(e){}
w.setTimeout(function(){h.classList.add('is-arrived')},3000)})(document,window);`;

export function BootScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT }} />;
}
