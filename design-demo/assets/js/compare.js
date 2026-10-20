// compare.js — DEMO ONLY: the compare panel for Jack's review (SPEC-R4A §9.10). Never ported.
//
//   import { initCompare } from '/assets/js/compare.js';
//   const compare = initCompare({ getLandscape: () => handle });   // { destroy() }
//
// Enabled with ?compare=1 (sessionStorage 'ink:compare' = '1', so it survives navigation); ?compare=0 or
// the panel's "Hide" turns it off. The inline boot script sets, before first paint:
//   html.is-compare                 the panel is on
//   html[data-palette]              'ink' | 'misted' | 'rich' (sessionStorage 'ink:palette'; default misted)
//   html[data-name-size]            '56' | '72' | '96'       (sessionStorage 'ink:name'; default 72)
// (?palette= and ?name= also work without the panel, for QA.) This module injects the panel only under
// html.is-compare; it is not in the HTML.
//   Colour → html[data-palette], sessionStorage, landscape.setPalette(p) (when the engine has it) and the
//            'ink:palette' event on document ({ detail: { palette } }).
//   Name   → html[data-name-size] (tokens.css resizes --fs-name), sessionStorage and the 'ink:name' event
//            ({ detail: { size } }). Its row shows only on a page with an h1.name (re-checked on route:swap).
// The panel sits bottom RIGHT, over the empty paper beside the reading column (bottom left it covered Home's
// photo and the résumé's timeline). Its "Compare" button folds it to that one button and back
// (aria-expanded; sessionStorage 'ink:compare-open'): open by default from 40rem, folded on phones, where any
// panel covers the text.
// Words from COPY §0 "Demo switches".

const PALETTES = [['ink', 'Ink'], ['misted', 'Misted'], ['rich', 'Rich']];
const SIZES = ['56', '72', '96'];
const OPEN_KEY = 'ink:compare-open';

let live = null;

const store = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* not remembered */ } };
const recall = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };

export function initCompare({ getLandscape = () => null } = {}) {
  const html = document.documentElement;
  if (live) return live;
  if (!html.classList.contains('is-compare')) return { destroy() {} };

  const panel = document.createElement('aside');
  panel.className = 'compare';
  panel.setAttribute('aria-label', 'Demo switches');
  const button = (attrs, text) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'brush';
    for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
    b.textContent = text;
    return b;
  };
  const row = (id, label, buttons, only) => {
    const p = document.createElement('p');
    p.className = 'compare__row';
    if (only) p.dataset.only = only;
    const l = document.createElement('span');
    l.className = 'compare__label';
    l.id = id;
    l.textContent = label;
    const g = document.createElement('span');
    g.className = 'compare__group';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-labelledby', id);
    g.append(...buttons);
    p.append(l, g);
    return p;
  };
  const colour = PALETTES.map(([v, t]) => button({ 'data-palette': v, 'aria-pressed': 'false' }, t));
  const sizes = SIZES.map((v) => button({ 'data-name': v, 'aria-pressed': 'false' }, v));
  const rows = document.createElement('div');
  rows.className = 'compare__rows';
  rows.id = 'cmp-rows';
  const nameRow = row('cmp-name', 'Name', sizes, 'name');
  rows.append(row('cmp-colour', 'Colour', colour), nameRow);
  const hide = button({ class: 'compare__hide brush' }, 'Hide');
  const fold = button({ class: 'compare__fold brush', 'aria-controls': 'cmp-rows' }, 'Compare');
  const tools = document.createElement('div');
  tools.className = 'compare__tools';
  tools.append(hide);
  panel.append(fold, rows, tools);

  const remembered = recall(OPEN_KEY);
  let open = remembered === null ? !matchMedia('(max-width: 39.99rem)').matches : remembered === '1';
  const setOpen = (o, remember) => {
    open = o;
    fold.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-folded', !open);
    rows.hidden = !open;
    tools.hidden = !open;
    if (remember) store(OPEN_KEY, open ? '1' : '0');
  };
  setOpen(open, false);

  const render = () => {
    const p = html.dataset.palette || 'misted';
    const n = html.dataset.nameSize || '72';
    colour.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.palette === p)));
    sizes.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.name === n)));
    nameRow.hidden = !document.querySelector('h1.name');
  };

  const setPalette = (p) => {
    html.dataset.palette = p;
    store('ink:palette', p);
    try { getLandscape()?.setPalette?.(p); } catch (err) { console.warn('compare: setPalette failed', err); }
    document.dispatchEvent(new CustomEvent('ink:palette', { detail: { palette: p } }));
    render();
  };
  const setName = (n) => {
    html.dataset.nameSize = n;
    store('ink:name', n);
    document.dispatchEvent(new CustomEvent('ink:name', { detail: { size: Number(n) } }));
    render();
  };

  const onClick = (e) => {
    const b = e.target instanceof Element ? e.target.closest('button') : null;
    if (!b || !panel.contains(b)) return;
    if (b.dataset.palette) setPalette(b.dataset.palette);
    else if (b.dataset.name) setName(b.dataset.name);
    else if (b === fold) setOpen(!open, true);
    else if (b === hide) {
      store('ink:compare', null);
      html.classList.remove('is-compare');
      live?.destroy();
    }
  };
  const onSwap = () => render();

  panel.addEventListener('click', onClick);
  document.addEventListener('route:swap', onSwap);
  render();
  document.body.append(panel);

  live = {
    destroy() {
      panel.removeEventListener('click', onClick);
      document.removeEventListener('route:swap', onSwap);
      panel.remove();
      live = null;
    },
  };
  return live;
}
