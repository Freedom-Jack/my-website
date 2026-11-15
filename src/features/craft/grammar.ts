/**
 * The site's own case record compiled to a byte-level automaton, and a token mask over any vocabulary: a token is legal
 * in a state when every one of its bytes keeps the automaton alive. This is the mechanism grammar-constrained decoding
 * uses (a state, a mask, a chosen token); nothing here is a model. Pure: it runs at build (the opening step, the unit
 * test) and in the browser (the mask fold).
 *
 * The grammar branches (the attack's A6): the role is one of the roles the cases name, the years a pattern
 * (`\d{4} – (\d{4}|present)`), the status one of three words, and the figure an optional field. It is compiled to a
 * Thompson NFA over bytes; a state is the set of live nodes.
 */

export const MAX_STR = 48;
export const STATUSES = ['shipped', 'in progress', 'projected'] as const;

type Expr =
  | { k: 'lit'; b: number[] }
  | { k: 'cls'; test: 'digit' | 'string' }
  | { k: 'seq'; xs: Expr[] }
  | { k: 'alt'; xs: Expr[] }
  | { k: 'opt'; x: Expr }
  | { k: 'str' };

const enc = new TextEncoder();
const lit = (s: string): Expr => ({ k: 'lit', b: [...enc.encode(s)] });
const seq = (...xs: Expr[]): Expr => ({ k: 'seq', xs });
const alt = (...xs: Expr[]): Expr => ({ k: 'alt', xs });
const digit: Expr = { k: 'cls', test: 'digit' };
const str: Expr = { k: 'str' };

/** The record, as an expression over the roles the cases name. */
export function recordExpr(roles: readonly string[]): Expr {
  const year = seq(digit, digit, digit, digit);
  return seq(
    lit('{"title": "'),
    str,
    lit('", "years": "'),
    year,
    lit(' – '),
    alt(year, lit('present')),
    lit('", "role": "'),
    alt(...roles.map(lit)),
    lit('", "status": "'),
    alt(...STATUSES.map(lit)),
    lit('"'),
    { k: 'opt', x: seq(lit(', "figure": "'), str, lit('"')) },
    lit('}'),
  );
}

/** The grammar as the page prints it. */
export function grammarText(roles: readonly string[]): string {
  return [
    'record  = "{" title ", " years ", " role ", " status [", " figure] "}"',
    'title   = "\\"title\\": " string',
    'years   = "\\"years\\": \\"" digit{4} " – " (digit{4} | "present") "\\""',
    `role    = "\\"role\\": " (${roles.map((r) => JSON.stringify(r)).join(' | ')})`,
    `status  = "\\"status\\": " (${STATUSES.map((s) => JSON.stringify(s)).join(' | ')})`,
    'figure  = "\\"figure\\": " string',
    `string  = "\\"" (any byte but " and \\){1,${MAX_STR}} "\\""`,
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------- the NFA
interface Node {
  /** a byte edge: the test and the node it leads to */
  test?: (b: number) => boolean;
  to?: number;
  eps: number[];
  /** the field this node is inside, for the page's "state" line */
  field?: string;
}

const isDigit = (b: number) => b >= 0x30 && b <= 0x39;
const isStrByte = (b: number) => b !== 0x22 && b !== 0x5c && ((b >= 0x20 && b <= 0x7e) || b >= 0x80);

export interface Grammar {
  nodes: Node[];
  start: number[];
  accept: number;
  roles: readonly string[];
}

export function compile(roles: readonly string[]): Grammar {
  const nodes: Node[] = [];
  const node = (field?: string) => nodes.push({ eps: [], ...(field ? { field } : {}) }) - 1;
  const FIELDS = ['title', 'years', 'role', 'status', 'figure'];
  let field = 'the record';
  // builds `x` between a fresh entry and exit; returns [entry, exit]
  const build = (x: Expr): [number, number] => {
    switch (x.k) {
      case 'lit': {
        const s = node(field);
        let cur = s;
        for (const b of x.b) {
          const n = node(field);
          nodes[cur]!.test = (v) => v === b;
          nodes[cur]!.to = n;
          cur = n;
        }
        // a literal naming a field: what follows is inside it
        const name = new TextDecoder().decode(new Uint8Array(x.b)).match(/"(\w+)": /)?.[1];
        if (name && FIELDS.includes(name)) field = name;
        return [s, cur];
      }
      case 'cls': {
        const s = node(field);
        const e = node(field);
        nodes[s]!.test = x.test === 'digit' ? isDigit : isStrByte;
        nodes[s]!.to = e;
        return [s, e];
      }
      case 'str': {
        // one to MAX_STR string bytes, then the closing quote is the next literal's
        const s = node(field);
        const e = node(field);
        let cur = s;
        for (let i = 0; i < MAX_STR; i += 1) {
          const n = node(field);
          nodes[cur]!.test = isStrByte;
          nodes[cur]!.to = n;
          nodes[n]!.eps.push(e);
          cur = n;
        }
        return [s, e];
      }
      case 'seq': {
        const parts = x.xs.map(build);
        for (let i = 0; i + 1 < parts.length; i += 1) nodes[parts[i]![1]]!.eps.push(parts[i + 1]![0]);
        return [parts[0]![0], parts[parts.length - 1]![1]];
      }
      case 'alt': {
        const s = node(field);
        const e = node(field);
        for (const p of x.xs.map(build)) {
          nodes[s]!.eps.push(p[0]);
          nodes[p[1]]!.eps.push(e);
        }
        return [s, e];
      }
      case 'opt': {
        const s = node(field);
        const e = node(field);
        const [a, b] = build(x.x);
        nodes[s]!.eps.push(a, e);
        nodes[b]!.eps.push(e);
        return [s, e];
      }
    }
  };
  const [s, e] = build(recordExpr(roles));
  return { nodes, start: closure({ nodes, start: [], accept: e, roles }, [s]), accept: e, roles };
}

/** A state: the sorted live nodes after their empty edges. */
export type State = number[];

function closure(g: Grammar, set: number[]): State {
  const seen = new Set<number>(set);
  const stack = [...set];
  while (stack.length) {
    const n = stack.pop()!;
    for (const m of g.nodes[n]!.eps)
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
  }
  return [...seen].sort((a, b) => a - b);
}

/** One byte: the next state, or null when the grammar forbids it. */
export function step(g: Grammar, s: State, b: number): State | null {
  const next: number[] = [];
  for (const n of s) {
    const nd = g.nodes[n]!;
    if (nd.test && nd.to !== undefined && nd.test(b)) next.push(nd.to);
  }
  return next.length ? closure(g, next) : null;
}

/** A whole token (its bytes): the state after it, or null. */
export function stepToken(g: Grammar, s: State, bytes: number[]): State | null {
  let cur: State | null = s;
  for (const b of bytes) {
    cur = step(g, cur, b);
    if (!cur) return null;
  }
  return cur;
}

/** The mask: 1 where the token is legal in the state. */
export function mask(g: Grammar, s: State, vocab: number[][]): Uint8Array {
  const m = new Uint8Array(vocab.length);
  for (let t = 0; t < vocab.length; t += 1) if (stepToken(g, s, vocab[t]!) !== null) m[t] = 1;
  return m;
}

export const isDone = (g: Grammar, s: State) => s.includes(g.accept);

/** The field the state is inside ("role", "status", …), for the page's state line. */
export function fieldOf(g: Grammar, s: State): string {
  for (const n of s) {
    const nd = g.nodes[n]!;
    if (nd.test && nd.field) return nd.field;
  }
  return isDone(g, s) ? 'done' : 'the record';
}

/** Does a byte string satisfy the whole grammar? */
export function accepts(g: Grammar, bytes: number[]): boolean {
  const s = stepToken(g, g.start, bytes);
  return !!s && isDone(g, s);
}

/** A case's record, as the build writes it from its front matter (the status read from its outcome line). */
export function record(c: { title: string; years: string; role: string; outcome: string; figure?: string }): string {
  const status = /in progress/i.test(c.outcome)
    ? 'in progress'
    : /projected/i.test(c.outcome)
      ? 'projected'
      : 'shipped';
  const o: Record<string, string> = { title: c.title, years: c.years, role: c.role, status };
  if (c.figure) o.figure = c.figure;
  return JSON.stringify(o).replace(/","/g, '", "').replace(/":"/g, '": "');
}
