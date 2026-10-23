// rehype-site.mjs: the site's own MDX transforms (next.config.ts loads it by path; plain JS, run by the MDX
// loader at build time). Content files stay plain Markdown; the markup the design system expects is added here.
//
// 1. Typography in every text node (as lib/typography.ts does for content strings): a number keeps its unit on
//    its line ("200 ms", "2 TB"), "≥" keeps its number, and a short hyphenated compound ("top-five", "T-SQL",
//    "CNN-LSTM") never breaks at its hyphen (a nowrap span).
// 2. A GFM table becomes the shared scannable table (components.css .table): wrapped in div.table-wrap, explicit
//    ARIA roles (they keep the table's semantics when the narrow layout restacks it), the first cell of each body
//    row a row header, every other cell labelled with its column (data-label, shown when a row restacks on
//    phones), its contents in one span, and the table labelled by the heading just above it.
// 3. A paragraph that is only a bold label and a colon ("**Core components**:") introduces the list below it:
//    .note__list-title, so the list follows it closely.
// 4. A Work case (content/work/*.mdx): its "## Label" sections become the case's labelled body (div.case__body >
//    section.case__part > h2.case__label + content: Context · What I did · Outcome · Evidence · Stack); Evidence and
//    Stack are small print, the Evidence list
//    plain lines; two or more <Note>s in a row share one cell of the margin rail (div.margin-notes).
import { toString } from 'hast-util-to-string';
import { visit, SKIP } from 'unist-util-visit';

const el = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const NBSP = '\u00A0';
const UNITS = ['ms', 'TB', 'GB', 'FPS', 'fps', 'months', 'days', 'minutes', 'hours', 'years'];
const UNIT_RE = new RegExp(`(\\d)\\s(${UNITS.join('|')})\\b`, 'g');
const COMPOUND = /(?<![\w-])([A-Za-z0-9]{1,8}-[A-Za-z0-9]{1,8})(?![\w-])/g;

const typeset = (s) => s.replace(UNIT_RE, `$1${NBSP}$2`).replace(/([≥≤~])\s(?=\d)/g, `$1${NBSP}`);

function textRuns(value) {
  const s = typeset(value);
  const out = [];
  let last = 0;
  for (const m of s.matchAll(COMPOUND)) {
    if (m.index > last) out.push({ type: 'text', value: s.slice(last, m.index) });
    out.push(el('span', { className: ['nowrap'] }, [{ type: 'text', value: m[0] }]));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: 'text', value: s.slice(last) });
  return out;
}

function typography(tree) {
  visit(tree, (node, index, parent) => {
    if (node.type === 'element' && ['code', 'pre', 'svg', 'script', 'style'].includes(node.tagName)) return SKIP;
    if (node.type !== 'text' || !parent || index === undefined) return undefined;
    if (parent.type === 'element' && parent.properties?.className?.includes?.('nowrap')) return undefined;
    const runs = textRuns(node.value);
    if (runs.length === 1 && runs[0].type === 'text') {
      node.value = runs[0].value;
      return undefined;
    }
    parent.children.splice(index, 1, ...runs);
    return index + runs.length;
  });
}

function headingBefore(parent, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const n = parent.children[i];
    if (n.type === 'element' && /^h[1-6]$/.test(n.tagName)) return n.properties?.id ? String(n.properties.id) : null;
  }
  return null;
}

function table(node, index, parent) {
  const rows = (tag) =>
    (node.children.find((c) => c.tagName === tag)?.children ?? []).filter((r) => r.tagName === 'tr');
  const heads =
    rows('thead')[0]
      ?.children.filter((c) => c.tagName === 'th')
      .map((th) => toString(th).trim()) ?? [];
  for (const group of node.children) {
    if (group.type !== 'element') continue;
    group.properties = { ...group.properties, role: 'rowgroup' };
  }
  for (const tr of rows('thead')) {
    tr.properties = { ...tr.properties, role: 'row' };
    for (const th of tr.children)
      if (th.tagName === 'th') th.properties = { ...th.properties, scope: 'col', role: 'columnheader' };
  }
  for (const tr of rows('tbody')) {
    tr.properties = { ...tr.properties, role: 'row' };
    let col = 0;
    for (const cell of tr.children) {
      if (cell.type !== 'element') continue;
      if (col === 0) {
        cell.tagName = 'th';
        cell.properties = { ...cell.properties, scope: 'row', role: 'rowheader' };
      } else {
        cell.properties = { ...cell.properties, role: 'cell', dataLabel: heads[col] ?? '' };
        cell.children = [el('span', {}, cell.children)];
      }
      col += 1;
    }
  }
  const label = headingBefore(parent, index);
  node.properties = {
    ...node.properties,
    className: ['table'],
    role: 'table',
    ...(label ? { ariaLabelledBy: label } : {}),
  };
  parent.children[index] = el('div', { className: ['table-wrap'] }, [node]);
}

const isNote = (n) => n?.type === 'mdxJsxFlowElement' && n.name === 'Note';
const blank = (n) => n.type === 'text' && !n.value.trim();
const SMALL = new Set(['evidence', 'stack']);
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** content/work/*.mdx: "## Label" + content → div.case__body > section.case__part > h2.case__label + the part's content
 *  (the demo's flagship case body; a heading per part, so the Outcome is one keystroke away for a screen reader). */
function caseBody(tree) {
  const kids = tree.children.filter((n) => !blank(n));
  const first = kids.findIndex((n) => n.type === 'element' && n.tagName === 'h2');
  if (first < 0) return;
  const before = kids.slice(0, first);
  const dl = el('div', { className: ['case__body'] }, []);
  let dd = null;
  let part = '';
  for (const n of kids.slice(first)) {
    if (n.type === 'element' && n.tagName === 'h2') {
      const label = toString(n).trim();
      part = slug(label);
      dd = el('section', { className: ['case__part'], dataPart: part }, [
        el('h2', { className: ['case__label'], id: n.properties?.id }, n.children),
      ]);
      dl.children.push(dd);
      continue;
    }
    if (SMALL.has(part) && n.type === 'element') {
      if (n.tagName === 'ul') n.properties = { ...n.properties, className: ['case__evidence', 'small'], role: 'list' };
      else n.properties = { ...n.properties, className: [...(n.properties?.className ?? []), 'small'] };
    }
    dd.children.push(n);
  }
  // two or more notes in a row share one rail cell
  for (const d of dl.children) {
    if (d.tagName !== 'section') continue;
    const out = [];
    for (let i = 0; i < d.children.length; i += 1) {
      if (isNote(d.children[i]) && isNote(d.children[i + 1])) {
        const run = [];
        while (isNote(d.children[i])) run.push(d.children[i++]);
        i -= 1;
        out.push(el('div', { className: ['margin-notes'] }, run));
      } else out.push(d.children[i]);
    }
    d.children = out;
  }
  tree.children = [...before, dl];
}

export default function rehypeSite() {
  return (tree, file) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index === undefined) return undefined;
      if (node.tagName === 'table') {
        table(node, index, parent);
        return SKIP;
      }
      if (node.tagName === 'p') {
        const kids = node.children.filter((c) => !blank(c));
        if (
          kids.length === 2 &&
          kids[0].tagName === 'strong' &&
          kids[1].type === 'text' &&
          kids[1].value.trim() === ':'
        ) {
          node.properties = { ...node.properties, className: ['note__list-title'] };
        }
      }
      return undefined;
    });
    typography(tree);
    const path = String(file?.path ?? file?.history?.[0] ?? '');
    if (/[\\/]content[\\/]work[\\/][^\\/]+\.mdx$/.test(path)) caseBody(tree);
  };
}
