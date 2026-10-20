// demo.js — DEMO ONLY. Screenshot helpers for the static demo. Production never imports this file:
// main.js loads it dynamically, and only when one of these query parameters is present.
//
//   ?y=1200        scroll to 1200 px before effects initialise (so on-screen content is not hidden)
//   ?y=#statement  scroll that element to the top instead
//   ?t=400         freeze the first-screen arrival at 400 ms (and switch off the 2.5 s safety net)

export function scrollFromParams(params) {
  const y = params.get('y');
  if (!y) return;
  history.scrollRestoration = 'manual';
  const el = y.startsWith('#') ? document.querySelector(y) : null;
  const top = el ? el.getBoundingClientRect().top + scrollY : Number(y) || 0;
  document.documentElement.style.scrollBehavior = 'auto';
  scrollTo(0, top);
  document.documentElement.style.scrollBehavior = '';
}

export function frozenAt(params) {
  const t = params.get('t');
  return t === null ? null : Math.max(0, Number(t) || 0);
}

export function freeze(params, entrance) {
  const t = frozenAt(params);
  if (t === null) return;
  window.__inkFrozen = true;            // tells the inline boot script's 3 s safety net to stand down
  entrance.seek(t);
  requestAnimationFrame(() => entrance.seek(t));
}
