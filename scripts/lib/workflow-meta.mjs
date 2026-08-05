/**
 * @file scripts/lib/workflow-meta.mjs — the I/O-free core deciding whether a Workflow harness script is
 * LAUNCHABLE. Consumed by `scripts/check-standards.mjs` (so the health gate and the write-time hook can refuse
 * an unlaunchable harness at author time) and exercised from `scripts/__tests__/workflow-meta-launchable.test.mjs`.
 *
 * WHY THIS EXISTS. The Workflow runtime requires `export const meta` to be a PURE LITERAL and rejects the script
 * at validation time, before a single agent spawns. `scripts/workflows/review-parked-prs.mjs` — the
 * editor↔reviewer convergence loop (#2639) — built its `meta.description` by concatenating string fragments, so
 * it was UNLAUNCHABLE from the day it was written. Nothing surfaced it, because the failure is silent in the one
 * way that matters: it never ran, so it never produced a wrong answer. It produced nothing. Three layers
 * inherited that silence — the jury ledger had no entries, the scheduled runner read an empty ledger and
 * fail-closed every parked PR to a human, and reviews were hand-queued for weeks on the belief that the
 * automation was unbuilt. The same class had already recurred once (`backlog/2664`, resolved with no gate).
 *
 * ⚠️ `PURE_KINDS` IS A MODEL OF AN EXTERNAL VALIDATOR, NOT A CHECKED CONTRACT.
 *
 * The real validator lives in the Claude Code Workflow runtime. It is NOT importable from this repo (grepped:
 * nothing here implements it), so nothing in this repo can prove the set below matches it. This is our BELIEF
 * about a boundary — the same shape as a fake returning what its author assumed the dependency does, which is
 * exactly how the `rev-parse --end-of-options` defect shipped green in this suite (PR #1031 r3).
 *
 * GROUNDED — two observed rejections from the live runtime, both `BinaryExpression`: `backlog/2664` recorded
 * `meta must be a pure literal: BinaryExpression` from a real failed launch, and `review-parked-prs.mjs` hit the
 * same. Everything else is INFERENCE from the error's wording ("pure literal", "non-literal node type").
 *
 * The error directions are NOT symmetric, and only one is dangerous:
 *   • too STRICT (we reject what the runtime accepts) → a loud false alarm, fixed in minutes;
 *   • too LOOSE (we accept what the runtime rejects) → the check passes and the harness STILL cannot start —
 *     the exact silent failure this module exists to end.
 * So when in doubt, leave a kind OUT. Adding one is a claim about the runtime that nothing here can verify.
 * The only real integration proof is a LAUNCH (the runtime validates `meta` before spawning any agent), which
 * cannot run in CI — it belongs in a PR's verification notes.
 */
import ts from 'typescript';

/** Node kinds a pure literal may be built from. See the file header before adding one. */
export const PURE_KINDS = new Set([
  ts.SyntaxKind.ObjectLiteralExpression,
  ts.SyntaxKind.ArrayLiteralExpression,
  ts.SyntaxKind.PropertyAssignment,
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NumericLiteral,
  ts.SyntaxKind.TrueKeyword,
  ts.SyntaxKind.FalseKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.ParenthesizedExpression, // `({ … })` is the same literal with parens — launchable
  ts.SyntaxKind.PrefixUnaryExpression,   // `-1` / `+1`; the operand is checked, so only numeric survives
]);
// Identifier is deliberately ABSENT. The walk never descends into a property NAME by accident — names are
// checked explicitly by `pureKeyKind` — so an Identifier is only ever reached in a VALUE position
// (`description: SUFFIX`), which is exactly the impurity being caught.

/** A property NAME that is inert. A COMPUTED key (`[KEY]:`) is a name syntactically and an arbitrary expression
 * semantically — the runtime walks it like any other node — so it must NOT be exempt. */
function pureKeyKind(name) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name);
}

/**
 * The initializer of the EXPORTED `meta`, or null. Handles both `export const meta = {…}` and
 * `const meta = {…}; export { meta };`. Deliberately NOT "the first declaration named `meta`" — a local
 * `const meta` in some helper shadowed it, so an unlaunchable file read as pure.
 * @returns {import('typescript').Expression|null}
 */
export function findExportedMeta(src, fileName = 'meta.mjs') {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declared = new Map();
  let exportedByName = false;
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== 'meta' || !d.initializer) continue;
        declared.set(exported ? 'exported' : 'local', d.initializer);
      }
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      // `export { meta }` / `export { x as meta }` — the LOCAL binding is what gets exported.
      if (stmt.exportClause.elements.some((e) => e.name.text === 'meta')) exportedByName = true;
    }
  }
  return declared.get('exported') || (exportedByName ? declared.get('local') || null : null);
}

/**
 * Impure nodes inside the exported `meta`, reported by KIND rather than by spelling.
 *
 * NOT regexes. An earlier draft asserted four spellings and passed on `'a ' + SUFFIX`, `buildPhases()` and
 * mixed-quote concatenation — all unlaunchable — while false-flagging a prose ellipsis. A guard that reasons
 * about characters instead of syntax is always one spelling behind the next author.
 *
 * @returns {{found: boolean, impure: string[]}} `found:false` when the file exports no `meta`
 */
export function metaPurity(src, fileName = 'meta.mjs') {
  const init = findExportedMeta(src, fileName);
  if (!init) return { found: false, impure: [] };
  const impure = [];
  const note = (node, text) => impure.push(`${ts.SyntaxKind[node.kind]} — ${String(text).slice(0, 60).replace(/\s+/g, ' ')}`);
  const walk = (node) => {
    if (!PURE_KINDS.has(node.kind)) { note(node, node.getText()); return; }
    if (ts.isPropertyAssignment(node)) {
      if (!pureKeyKind(node.name)) { note(node.name, node.name.getText()); return; }
      walk(node.initializer); // the NAME is inert; judge the VALUE
      return;
    }
    // `-x` is launchable only when x is a numeric literal; `-SOME_CONST` is not.
    if (ts.isPrefixUnaryExpression(node) && !ts.isNumericLiteral(node.operand)) { note(node.operand, node.getText()); return; }
    ts.forEachChild(node, walk);
  };
  walk(init);
  return { found: true, impure };
}

/** The property names declared on the exported `meta` literal. `[]` when there is none. Reads KEYS off the AST
 * rather than regexing the file: the regex form required single quotes (so a launchable double-quoted meta
 * failed) and matched an unrelated `name:` anywhere in the file (so a meta missing the key passed). */
export function metaKeys(src, fileName = 'meta.mjs') {
  let obj = findExportedMeta(src, fileName);
  if (!obj) return [];
  while (ts.isParenthesizedExpression(obj)) obj = obj.expression;
  if (!ts.isObjectLiteralExpression(obj)) return [];
  return obj.properties
    .filter((p) => ts.isPropertyAssignment(p) && pureKeyKind(p.name))
    .map((p) => p.name.text);
}

/** Where harness scripts live. Single-sourced so the health gate's fs walk and the test sweep cannot drift —
 * widening this in one place only is how a new root gets silently unscanned while every test stays green. */
export const WORKFLOW_HARNESS_ROOTS = ['scripts/workflows', 'skills-src'];

/** Required `meta` fields — the runtime needs both to name and describe the workflow. */
export const REQUIRED_META_KEYS = ['name', 'description'];

/**
 * The whole verdict for one harness source: launchable, and declaring what it must.
 * @returns {{found:boolean, impure:string[], missingKeys:string[], ok:boolean}}
 */
export function checkWorkflowMeta(src, fileName = 'meta.mjs') {
  const { found, impure } = metaPurity(src, fileName);
  const keys = metaKeys(src, fileName);
  const missingKeys = found ? REQUIRED_META_KEYS.filter((k) => !keys.includes(k)) : [];
  return { found, impure, missingKeys, ok: found && impure.length === 0 && missingKeys.length === 0 };
}
