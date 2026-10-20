// Ported unchanged from design-demo/tools/qa/measure.js (demo 4b's layout probe), so the build is measured exactly as
// the approved demo was. Evaluated in the page by tests/e2e/budgets.spec.ts. (Not reformatted: .prettierignore.)
// measure.js: the layout probe for the demo-4b QA tools (budget.py, gaps.py, contrast.py). Evaluated in the page
// as one expression:  (<this file>)({taps: true})  ->  a Promise of a plain JSON object.
// It rebuilds the lost round-4 audit probe (definitions: _notes/r4/audit.md; schema of its output:
// _notes/r4/prototypes/proposal-check/data/*.json) plus the 4a budget probes (DESIGN section 6, SPEC-R4A 15.2).
//
// Definitions (all CSS px; the page is measured at its current state, after boot and settle):
// - Text lines = the client rects of every text node in <main> (one rect per line fragment), skipping hidden,
//   visually-hidden and SVG text (diagram labels and the seal are graphics). CSS-generated text with letters
//   (e.g. the folded cases' "Show details" ::after) is added as an approximate line ("pseudo").
// - Chrome (header, footer, compare panel) is outside <main> and never counted. The demo-only "Draft art" note
//   (.strip__note) is counted for sizes (it is SPEC 15.4's accepted fifth size) but its words are reported apart.
// - Screen i = the slice [y_i, y_i + vh) of the document, y_i = min(i * vh, docH - vh), i < ceil(docH / vh).
// - words = visible tokens with a letter or digit whose first rect intersects the slice (dashes and dots do not
//   count; the Draft-art note is counted apart). words4a = the 4a audit's looser rule (every token, symbols,
//   visually-hidden text and the note included): the budget rows were calibrated with it, so budget.py judges
//   with words4a and prints both.
// - read / display = summed line-rect area with font size <= 24 / > 24 px, clipped to the slice, over its area.
// - sizes = distinct rounded font sizes of the lines on that screen.
// - graphics = main img and top-level svg boxes larger than 24 x 24 (not the fixed canvas).
// - taps (opts.taps): every visible a[href], button, summary, [role=button], input, select, textarea on the page,
//   chrome included; the hit box is probed with elementFromPoint along the two axes through the target's centre
//   (pseudo-element hit areas count). "inline" = an inline link whose block also holds running words outside any
//   link (WCAG 2.5.8's inline exception: in a sentence or a byline); only standalone targets must reach 44 x 44.
// - overflow: documentElement.scrollWidth > innerWidth, plus elements whose box leaves [0, vw] and is not clipped
//   by its own clip-path or an ancestor's overflow / clip-path (side: right = sideways scroll, left = cut off),
//   plus inner sideways scrollers.
// - sections (for gaps.py): main's children, a wrapper of 2+ <section>s expanded into its children (the Resume).
async (opts = {}) => {
  const vw = innerWidth, vh = innerHeight;
  const de = document.documentElement;
  const startY = scrollY;
  const main = document.querySelector('main');
  const R = (v, d = 0) => { const k = 10 ** d; return Math.round(v * k) / k; };
  const out = { url: location.pathname + location.search, vw, vh, dpr: devicePixelRatio, docH: de.scrollHeight };
  out.screens = R(out.docH / vh, 2);
  if (!main) return { ...out, error: 'no <main>' };

  const csCache = new Map();
  const cs = (el) => { let s = csCache.get(el); if (!s) { s = getComputedStyle(el); csCache.set(el, s); } return s; };
  const isVisible = (el) => (el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : !!el.getClientRects().length);
  const srOnly = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.classList && (e.classList.contains('visually-hidden') || e.classList.contains('sr-only'))) return true;
      const r = e.getBoundingClientRect();
      if (r.width <= 1.5 && r.height <= 1.5 && cs(e).overflow !== 'visible') return true;
    }
    return false;
  };
  const label = (el) => {
    if (!el) return null;
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cl = [...el.classList].slice(0, 2);
    if (cl.length) s += '.' + cl.join('.');
    return s;
  };
  const blockOf = (el) => {
    for (let e = el; e && e !== main.parentElement; e = e.parentElement) {
      const d = cs(e).display;
      if (!d.startsWith('inline') && d !== 'contents') return e;
    }
    return el;
  };
  // Section-level blocks: main's children, except that a wrapper holding two or more <section>s (the Resume's
  // article.cv) is replaced by its own children. A <header> or .strip block is the page head, a .closing the end.
  const blocks = [];
  for (const c of main.children) {
    if (/^(ARTICLE|DIV)$/.test(c.tagName) && [...c.children].filter((k) => k.tagName === 'SECTION').length >= 2) blocks.push(...c.children);
    else blocks.push(c);
  }
  const sectionOf = (el) => blocks.find((b) => b.contains(el)) || null;
  const LETTER = /[\p{L}\p{N}]/u;

  // ---------------------------------------------------------------- text lines in main
  const lines = [];   // {x, y, w, h, fs, fw, color, el, sec, kind, words, text}
  const wordList = []; // {y (doc top of first rect), fs, note, sec}
  const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  let node;
  const sy = scrollY, sx = scrollX;
  while ((node = tw.nextNode())) {
    const txt = node.nodeValue;
    if (!txt || !/\S/.test(txt)) continue;
    const el = node.parentElement;
    if (!el || el.closest('script,style,noscript,template')) continue;
    if (el instanceof SVGElement) continue;            // diagram labels, the seal: graphics
    if (!isVisible(el) || srOnly(el)) continue;
    const s = cs(el);
    const fs = parseFloat(s.fontSize);
    const note = !!el.closest('.strip__note');
    const sec = sectionOf(el);
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width < 0.5 || r.height < 0.5) continue;
      lines.push({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height, fs, fw: s.fontWeight, color: s.color,
        el, sec, kind: note ? 'note' : 'text', text: '' });
    }
    // words, one range per token (its first rect decides the screen)
    const re = /\S+/g; let m;
    while ((m = re.exec(txt))) {
      if (!LETTER.test(m[0])) continue;
      range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length);
      const b = range.getClientRects()[0];
      if (!b || b.width < 0.5) continue;
      wordList.push({ y: b.top + sy, b: b.bottom + sy, fs, note, sec });
    }
  }
  // CSS-generated text with letters (approximate line: the pseudo's line box at the element's start or end)
  for (const el of main.querySelectorAll('*')) {
    if (el instanceof SVGElement || !isVisible(el)) continue;
    for (const which of ['::before', '::after']) {
      const ps = getComputedStyle(el, which);
      const c = ps.content;
      if (!c || c === 'none' || c === 'normal' || !/^["']/.test(c) || !LETTER.test(c.split('/')[0])) continue;
      if (ps.display === 'none') continue;
      const b = el.getBoundingClientRect();
      const fs = parseFloat(ps.fontSize);
      const lh = ps.lineHeight === 'normal' ? fs * 1.25 : parseFloat(ps.lineHeight);
      const pad = cs(el);
      let top;
      if (which === '::before') top = b.top + parseFloat(pad.paddingTop) + parseFloat(pad.borderTopWidth);
      else {
        let last = b.top + parseFloat(pad.paddingTop);
        for (const k of el.children) { const kb = k.getBoundingClientRect(); if (kb.height) last = Math.max(last, kb.bottom); }
        top = last + (parseFloat(ps.marginTop) || 0);
      }
      const textW = Math.min(b.width, fs * 0.55 * c.replace(/\/.*$/, '').replace(/["']/g, '').trim().length + 16);
      lines.push({ x: b.left + sx, y: top + sy, w: textW, h: lh, fs, fw: ps.fontWeight, color: ps.color, el,
        sec: sectionOf(el), kind: 'pseudo', text: c.replace(/\/.*$/, '').replace(/["']/g, '').trim() });
    }
  }
  for (const l of lines) if (!l.text) l.text = '';
  // the 4a audit's word rule, kept for continuity with the 4a numbers: every whitespace-separated token of every
  // text node in main (symbols such as an en dash, visually-hidden text, SVG labels and the Draft-art note included)
  const word4a = [];
  {
    const tw4 = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const rg = document.createRange();
    let n4;
    while ((n4 = tw4.nextNode())) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n4.nodeValue))) {
        rg.setStart(n4, m.index); rg.setEnd(n4, m.index + m[0].length);
        const b = rg.getClientRects()[0];
        if (!b || b.width < 1) continue;
        word4a.push({ y: b.top + sy, b: b.bottom + sy });
      }
    }
  }

  // ---------------------------------------------------------------- per screen
  const n = Math.max(1, Math.ceil(out.docH / vh - 0.01));
  const graphics = [];
  for (const g of main.querySelectorAll('img, svg')) {
    if (g.tagName.toLowerCase() === 'svg' && g.parentElement.closest('svg')) continue;
    if (!isVisible(g)) continue;
    const r = g.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) continue;
    graphics.push({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height, tag: g.tagName.toLowerCase(), cls: label(g) });
  }
  const clipArea = (b, y0, y1) => Math.max(0, Math.min(b.y + b.h, y1) - Math.max(b.y, y0)) * Math.max(0, Math.min(b.x + b.w, vw) - Math.max(b.x, 0));
  const per = [];
  for (let i = 0; i < n; i++) {
    const y0 = Math.max(0, Math.min(i * vh, out.docH - vh)), y1 = y0 + vh;
    let read = 0, disp = 0, graph = 0, words = 0, noteWords = 0, bigWords = 0;
    const sizes = new Set(), sizesNoNote = new Set(), tags = new Set();
    for (const l of lines) {
      const a = clipArea(l, y0, y1);
      if (a <= 0) continue;
      if (l.fs > 24) disp += a; else read += a;
      sizes.add(R(l.fs));
      if (l.kind !== 'note') sizesNoNote.add(R(l.fs));
      tags.add(blockOf(l.el).tagName.toLowerCase());
    }
    for (const w of wordList) {
      if (w.b <= y0 || w.y >= y1) continue;
      if (w.note) noteWords++; else { words++; if (w.fs > 24) bigWords++; }
    }
    let words4a = 0;
    for (const w of word4a) if (w.b > y0 && w.y < y1) words4a++;
    for (const g of graphics) graph += clipArea(g, y0, y1);
    const A = vw * vh;
    per.push({ i, y: R(y0), words4a, words, noteWords, bigWords, readPct: R(100 * read / A, 2), displayPct: R(100 * disp / A, 2),
      graphicPct: R(100 * graph / A, 2), emptyPct: R(100 * Math.max(0, 1 - (read + disp + graph) / A), 1),
      ratio: read ? R(disp / read, 3) : null, sizes: [...sizes].sort((a, b) => a - b),
      sizesNoNote: [...sizesNoNote].sort((a, b) => a - b), tags: [...tags] });
  }
  out.perScreen = per;
  let tRead = 0, tDisp = 0;
  for (const l of lines) { const a = l.w * l.h; if (l.fs > 24) tDisp += a; else tRead += a; }
  out.pageRatio = tRead ? R(tDisp / tRead, 3) : null;
  out.s0 = { words4a: per[0].words4a, words: per[0].words, noteWords: per[0].noteWords, ratio: per[0].ratio, sizes: per[0].sizes, sizesNoNote: per[0].sizesNoNote };
  out.maxSizesPerScreen = Math.max(...per.map((p) => p.sizes.length));
  out.maxSizesPerScreenNoNote = Math.max(...per.map((p) => p.sizesNoNote.length));
  out.words = wordList.filter((w) => !w.note).length;

  // ---------------------------------------------------------------- largest text, name, title
  const fsOf = (sel) => { const e = document.querySelector(sel); return e ? R(parseFloat(cs(e).fontSize), 1) : null; };
  out.largest = lines.length ? R(Math.max(...lines.map((l) => l.fs)), 1) : null;
  out.largestEl = lines.length ? label(lines.reduce((a, b) => (b.fs > a.fs ? b : a)).el) : null;
  out.nameFs = fsOf('main .name');
  out.h1Fs = fsOf('main h1');
  const h1 = main.querySelector('h1');
  out.h1 = h1 ? { text: h1.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), top: R(h1.getBoundingClientRect().top + sy) } : null;

  // ---------------------------------------------------------------- short page: does all of main's text (not the closing) fit screen one?
  const body = lines.filter((l) => !(l.el.closest('.closing')));
  out.contentBottom = body.length ? R(Math.max(...body.map((l) => l.y + l.h))) : 0;
  out.fitsFirstScreen = out.contentBottom <= vh;

  // ---------------------------------------------------------------- photo, reveal/arrive, strip/closing boxes
  const img = main.querySelector('img');
  if (img) {
    const r = img.getBoundingClientRect();
    out.photo = { top: R(r.top + sy), w: R(r.width), h: R(r.height), onFirstScreen: r.top + sy < vh, src: img.getAttribute('src') };
  } else out.photo = null;
  out.reveal = document.querySelectorAll('[data-reveal]').length;
  out.arrive = [...document.querySelectorAll('[data-arrive]')].map((e) => ({ el: label(e), isName: e.matches('.name') }));
  out.arriveOk = out.arrive.every((a) => a.isName);
  const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { top: R(r.top + sy), h: R(r.height), x: R(r.left), w: R(r.width) }; };
  out.strip = box('main [data-landscape="strip"]');
  out.closing = box('main [data-landscape="closing"]');

  // ---------------------------------------------------------------- sections (for gaps.py)
  out.sections = blocks.map((sec) => {
    const r = sec.getBoundingClientRect();
    const ls = lines.filter((l) => l.sec === sec);
    let first = null, last = null;
    for (const l of ls) {
      if (!first || l.y < first.y) first = l;
      if (!last || l.y + l.h > last.y + last.h) last = l;
    }
    return {
      el: label(sec), kind: sec.matches('.strip, header, .read-progress') ? 'strip' : sec.matches('.closing') ? 'closing' : 'section',
      top: R(r.top + sy), bottom: R(r.bottom + sy),
      firstText: first ? R(first.y, 1) : null, firstEl: first ? label(first.el) : null,
      lastText: last ? R(last.y + last.h, 1) : null, lastEl: last ? label(last.el) + (last.kind === 'pseudo' ? '::' + last.text : '') : null,
      lines: ls.length,
    };
  });
  // graphics bottoms per section (a section that ends on a picture)
  for (const s of out.sections) s.graphicBottom = null;
  blocks.forEach((sec, k) => {
    for (const g of main.querySelectorAll('img, svg')) {
      if (!sec.contains(g) || (g.tagName.toLowerCase() === 'svg' && g.parentElement.closest('svg')) || !isVisible(g)) continue;
      const r = g.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) continue;
      const b = R(r.bottom + sy, 1), t = R(r.top + sy, 1);
      const s = out.sections[k];
      s.graphicBottom = Math.max(s.graphicBottom ?? -1e9, b);
      s.graphicTop = Math.min(s.graphicTop ?? 1e9, t);
    }
  });

  // ---------------------------------------------------------------- header rows (one row at 360, wraps below 340)
  const header = document.querySelector('.site-header');
  if (header) {
    const tops = [...header.querySelectorAll('a')].filter(isVisible).map((a) => a.getBoundingClientRect().top + sy).sort((a, b) => a - b);
    let rows = 0, prev = -1e9;
    for (const t of tops) { if (t - prev > 8) rows++; prev = t; }
    out.header = { h: R(header.getBoundingClientRect().height), rows };
  }

  // ---------------------------------------------------------------- sideways overflow
  const offenders = [];
  const clipped = (el) => {
    if (cs(el).clipPath !== 'none') return true;
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const c = cs(e);
      if (c.overflowX !== 'visible' || c.clipPath !== 'none') return true;
    }
    return false;
  };
  const scrollers = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.matches('canvas.landscape, .skip-link, script, style') || !isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = cs(el);
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1) scrollers.push({ el: label(el), sw: el.scrollWidth, cw: el.clientWidth });
    if (s.position === 'fixed') continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      if (clipped(el) || srOnly(el)) continue;
      offenders.push({ el: label(el), left: R(r.left, 1), right: R(r.right, 1), side: r.right > vw + 0.5 ? 'right' : 'left' });
    }
  }
  // right = it makes (or would make) the page scroll sideways; left = cut off at the left edge (unreachable)
  out.overflow = { scrollWidth: de.scrollWidth, sideways: de.scrollWidth > vw, offenders: offenders.slice(0, 8), offenderCount: offenders.length,
    rightCount: offenders.filter((o) => o.side === 'right').length, leftCount: offenders.filter((o) => o.side === 'left').length, scrollers: scrollers.slice(0, 8) };

  // ---------------------------------------------------------------- tap targets
  if (opts.taps) {
    const sel = 'a[href], button, summary, [role="button"], input:not([type="hidden"]), select, textarea';
    const targets = [...document.querySelectorAll(sel)].filter((e) => isVisible(e) && !e.matches('.skip-link') && !srOnly(e))
      .map((e) => ({ e, y: e.getBoundingClientRect().top + sy })).sort((a, b) => a.y - b.y);
    const inlineIn = (e) => {
      if (!cs(e).display.startsWith('inline')) return false;   // inline, inline-block, inline-flex: judged by the words around it
      const blk = blockOf(e.parentElement || e);
      if (!blk || blk === e) return false;
      // the block's words outside any link or button
      const clone = blk.cloneNode(true);
      clone.querySelectorAll('a, button, .visually-hidden, [aria-hidden="true"]').forEach((x) => x.remove());
      const rest = (clone.textContent || '').split(/\s+/).filter((t) => LETTER.test(t));
      return rest.length >= 2;
    };
    const res = [];
    const header = document.querySelector('.site-header');
    for (const { e } of targets) {
      const rects = [...e.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (!rects.length) continue;
      // bring it into view: header links at the top; the rest at the middle (scrolling down only keeps the
      // returning header hidden)
      const inHeader = header && header.contains(e);
      const r0 = rects[0];
      const docTop = r0.top + scrollY;
      const want = inHeader ? 0 : Math.max(0, docTop - vh / 2);
      if (Math.abs(scrollY - want) > 1) { scrollTo({ top: want, behavior: 'instant' }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
      const rr = [...e.getClientRects()].filter((r) => r.width > 0 && r.height > 0)[0];
      const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2;
      const hit = (x, y) => { if (x < 0 || y < 0 || x >= vw || y >= vh) return false; const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
      let wL = 0, wR = 0, hU = 0, hD = 0;
      const centreHit = hit(cx, cy);
      if (centreHit) {
        while (wL < 60 && hit(cx - wL - 1, cy)) wL++;
        while (wR < 60 && hit(cx + wR + 1, cy)) wR++;
        while (hU < 60 && hit(cx, cy - hU - 1)) hU++;
        while (hD < 60 && hit(cx, cy + hD + 1)) hD++;
      }
      const hitW = centreHit ? wL + wR + 1 : 0, hitH = centreHit ? hU + hD + 1 : 0;
      const inline = inlineIn(e);
      const name = (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      res.push({ el: label(e), name, w: R(rr.width), h: R(rr.height), hitW, hitH, inline, covered: !centreHit,
        where: inHeader ? 'header' : e.closest('footer') ? 'footer' : e.closest('main') ? 'main' : 'other',
        small: !inline && centreHit && (hitW < 44 || hitH < 44) });
    }
    scrollTo({ top: startY, behavior: 'instant' });
    out.taps = { count: res.length, standalone: res.filter((t) => !t.inline).length, inline: res.filter((t) => t.inline).length,
      small: res.filter((t) => t.small), covered: res.filter((t) => t.covered && !t.inline).map((t) => t.el + ' ' + t.name), all: opts.allTaps ? res : undefined };
  }

  // the raw lines (for contrast.py / gaps.py when asked)
  if (opts.lines) {
    out.lines = lines.map((l) => ({ x: R(l.x, 1), y: R(l.y, 1), w: R(l.w, 1), h: R(l.h, 1), fs: R(l.fs, 1), kind: l.kind, el: label(l.el) }));
  }
  return out;
}
