/**
 * The portable cross-field pivot — a CEL ([Common Expression Language](https://cel.dev)) subset, parsed
 * once into a neutral AST and transpiled to each target idiom at emit time (#504, ratified end-state of
 * #465). CEL is the single canonical representation a WE-compliant component carries; boundary formats
 * stay open (ingest/forward adapters normalize in/out of CEL).
 *
 * **Subset, by design.** This zero-dependency parser covers the cross-field grammar that actually
 * occurs — comparisons, boolean logic, the conditional/implication shape ("require X when Y=z"),
 * arithmetic, member access, and literals. A full CEL runtime (e.g. `@marcbachmann/cel-js`) is a
 * representation-neutral swap behind this same AST — an implementation detail per the #465 ruling, not a
 * contract clause. Anything outside the subset (function/macro calls, list/map literals) raises a
 * {@link CelParseError}, so a forward adapter reports the rule as unsupported (flag-lossy) rather than
 * mis-transpiling it.
 */

// ---- AST -------------------------------------------------------------------
export type CelNode =
  | { readonly type: 'lit'; readonly value: string | number | boolean | null }
  | { readonly type: 'id'; readonly path: readonly string[] }
  | { readonly type: 'unary'; readonly op: '!' | '-'; readonly expr: CelNode }
  | { readonly type: 'binary'; readonly op: string; readonly left: CelNode; readonly right: CelNode }
  | { readonly type: 'ternary'; readonly cond: CelNode; readonly then: CelNode; readonly otherwise: CelNode };

export class CelParseError extends Error {
  constructor(reason: string) {
    super(`CEL parse error — ${reason}`);
    this.name = 'CelParseError';
  }
}

// ---- lexer -----------------------------------------------------------------
type Tok = { readonly kind: string; readonly value: string };

const PUNCT = ['<=', '>=', '==', '!=', '&&', '||', '<', '>', '!', '?', ':', '(', ')', '.', '+', '-', '*', '/', '%'];

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
  const isId = (c: string) => /[A-Za-z0-9_]/.test(c);
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let str = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) { str += src[j + 1]; j += 2; continue; }
        str += src[j++];
      }
      if (j >= src.length) throw new CelParseError('unterminated string literal');
      toks.push({ kind: 'str', value: str });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ kind: 'num', value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (isIdStart(c)) {
      let j = i;
      while (j < src.length && isId(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'true' || word === 'false' || word === 'null') toks.push({ kind: 'kw', value: word });
      else toks.push({ kind: 'id', value: word });
      i = j;
      continue;
    }
    const punct = PUNCT.find((p) => src.startsWith(p, i));
    if (!punct) throw new CelParseError(`unexpected character "${c}"`);
    toks.push({ kind: punct, value: punct });
    i += punct.length;
  }
  return toks;
}

// ---- parser (recursive descent, precedence-climbing) -----------------------
class Parser {
  #toks: Tok[];
  #pos = 0;
  constructor(toks: Tok[]) { this.#toks = toks; }

  #peek(): Tok | undefined { return this.#toks[this.#pos]; }
  #next(): Tok { const t = this.#toks[this.#pos++]; if (!t) throw new CelParseError('unexpected end of expression'); return t; }
  #eat(kind: string): Tok { const t = this.#next(); if (t.kind !== kind) throw new CelParseError(`expected "${kind}", got "${t.value}"`); return t; }

  parse(): CelNode {
    const node = this.#ternary();
    if (this.#pos !== this.#toks.length) throw new CelParseError(`trailing tokens after expression ("${this.#peek()?.value}")`);
    return node;
  }

  #ternary(): CelNode {
    const cond = this.#binary(0);
    if (this.#peek()?.kind === '?') {
      this.#next();
      const then = this.#ternary();
      this.#eat(':');
      const otherwise = this.#ternary();
      return { type: 'ternary', cond, then, otherwise };
    }
    return cond;
  }

  // Binary operators by precedence (low → high).
  static readonly #LEVELS: readonly (readonly string[])[] = [
    ['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%'],
  ];

  #binary(level: number): CelNode {
    if (level >= Parser.#LEVELS.length) return this.#unary();
    let left = this.#binary(level + 1);
    while (this.#peek() && Parser.#LEVELS[level].includes(this.#peek()!.kind)) {
      const op = this.#next().kind;
      const right = this.#binary(level + 1);
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  #unary(): CelNode {
    const t = this.#peek();
    if (t && (t.kind === '!' || t.kind === '-')) {
      this.#next();
      return { type: 'unary', op: t.kind as '!' | '-', expr: this.#unary() };
    }
    return this.#primary();
  }

  #primary(): CelNode {
    const t = this.#next();
    if (t.kind === '(') {
      const inner = this.#ternary();
      this.#eat(')');
      return inner;
    }
    if (t.kind === 'num') return { type: 'lit', value: Number(t.value) };
    if (t.kind === 'str') return { type: 'lit', value: t.value };
    if (t.kind === 'kw') return { type: 'lit', value: t.value === 'null' ? null : t.value === 'true' };
    if (t.kind === 'id') {
      const path = [t.value];
      while (this.#peek()?.kind === '.') {
        this.#next();
        path.push(this.#eat('id').value);
      }
      // A call (`foo(`) is outside the subset — report rather than mis-handle.
      if (this.#peek()?.kind === '(') throw new CelParseError(`function/macro calls are outside the CEL subset ("${path.join('.')}(")`);
      return { type: 'id', path };
    }
    throw new CelParseError(`unexpected token "${t.value}"`);
  }
}

/** Parse a CEL expression into the neutral AST. Throws {@link CelParseError} for anything outside the subset. */
export function parseCel(src: string): CelNode {
  if (typeof src !== 'string' || !src.trim()) throw new CelParseError('empty expression');
  return new Parser(lex(src)).parse();
}

/** The distinct field paths a rule references (dotted paths joined), for adapters that need the dependency set. */
export function referencedFields(node: CelNode, out = new Set<string>()): Set<string> {
  switch (node.type) {
    case 'id': out.add(node.path.join('.')); break;
    case 'unary': referencedFields(node.expr, out); break;
    case 'binary': referencedFields(node.left, out); referencedFields(node.right, out); break;
    case 'ternary': referencedFields(node.cond, out); referencedFields(node.then, out); referencedFields(node.otherwise, out); break;
  }
  return out;
}

// ---- code generation -------------------------------------------------------
/** A target dialect: how to render an identifier accessor, each operator, a literal, and a conditional. */
export interface CelDialect {
  readonly ref: (path: readonly string[]) => string;
  readonly op: Readonly<Record<string, string>>;
  readonly not: string;
  readonly lit: (value: string | number | boolean | null) => string;
  readonly ternary: (cond: string, then: string, otherwise: string) => string;
}

function gen(node: CelNode, d: CelDialect): string {
  switch (node.type) {
    case 'lit': return d.lit(node.value);
    case 'id': return d.ref(node.path);
    case 'unary': return node.op === '!' ? `${d.not}${gen(node.expr, d)}` : `-${gen(node.expr, d)}`;
    case 'binary': return `(${gen(node.left, d)} ${d.op[node.op] ?? node.op} ${gen(node.right, d)})`;
    case 'ternary': return d.ternary(gen(node.cond, d), gen(node.then, d), gen(node.otherwise, d));
  }
}

/** Transpile a CEL rule to a target dialect's source expression. */
export function transpile(rule: string, dialect: CelDialect): string {
  return gen(parseCel(rule), dialect);
}

// JavaScript dialect — identifiers resolve against a `data` object (used by Zod's `.refine` + inline JS).
export const JS_DIALECT: CelDialect = {
  ref: (path) => `data.${path.join('.')}`,
  op: { '==': '===', '!=': '!==' },
  not: '!',
  lit: (v) => (v === null ? 'null' : typeof v === 'string' ? JSON.stringify(v) : String(v)),
  ternary: (c, t, e) => `(${c} ? ${t} : ${e})`,
};

// Python dialect — identifiers resolve against `self` (used by Pydantic's `model_validator`).
export const PY_DIALECT: CelDialect = {
  ref: (path) => `self.${path.join('.')}`,
  op: { '==': '==', '!=': '!=', '&&': 'and', '||': 'or' },
  not: 'not ',
  lit: (v) => (v === null ? 'None' : typeof v === 'boolean' ? (v ? 'True' : 'False') : typeof v === 'string' ? JSON.stringify(v) : String(v)),
  ternary: (c, t, e) => `(${t} if ${c} else ${e})`,
};

export const toJs = (rule: string): string => transpile(rule, JS_DIALECT);
export const toPython = (rule: string): string => transpile(rule, PY_DIALECT);

/**
 * Transpile a batch of cross-field rules to a dialect, partitioning the ones inside the CEL subset from
 * the ones a forward adapter cannot emit. The `unsupported` rules are reported (flag-lossy), never
 * mis-transpiled — they degrade to the Mode-2 service.
 */
export function transpileRules(
  rules: readonly { readonly rule: string; readonly message?: string }[],
  dialect: CelDialect,
): { readonly transpiled: readonly { rule: string; message?: string; code: string }[]; readonly unsupported: readonly string[] } {
  const transpiled: { rule: string; message?: string; code: string }[] = [];
  const unsupported: string[] = [];
  for (const r of rules) {
    try {
      transpiled.push({ rule: r.rule, message: r.message, code: transpile(r.rule, dialect) });
    } catch (e) {
      if (e instanceof CelParseError) unsupported.push(r.rule);
      else throw e;
    }
  }
  return { transpiled, unsupported };
}
