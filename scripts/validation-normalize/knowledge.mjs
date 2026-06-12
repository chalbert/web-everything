// The internal normalized pivot model — the adapter-normalization hub's *private memory*.
//
// Projects never author in this model. Each `concern` is a tool-agnostic statement of
// "what could go wrong"; each incumbent tool expresses (some of) those concerns through
// its own rules. The `mappings` table is the lossy comparative map between them: where a
// concern has no row for a tool, that tool has *no equivalent* — and those gaps are the
// most valuable cells for shopping, not the embarrassing ones (#236).
//
// Confidence grades how faithfully a tool's rule expresses the concern:
//   exact   — semantically equivalent; a 1:1 swap.
//   partial — covers a subset, or diverges on options/autofix/edge-cases.
//   approx  — adjacent intent, materially different behaviour.
// (A missing row is the implicit fourth grade: "none".)

export const CONFIDENCE = { EXACT: 'exact', PARTIAL: 'partial', APPROX: 'approx', NONE: 'none' };

export const tools = [
  { id: 'eslint', name: 'ESLint' },
  { id: 'oxlint', name: 'Oxlint' },
];

export const concerns = [
  {
    id: 'unused-variables',
    label: 'Unused variables',
    description: 'Bindings declared but never read — dead code that hides typos and stale logic.',
    catches: "const total = sum(items);  // 'total' is never used",
  },
  {
    id: 'console-statements',
    label: 'Stray console calls',
    description: 'Debug logging left in production code.',
    catches: "console.log('here');  // shipped by accident",
  },
  {
    id: 'strict-equality',
    label: 'Loose equality',
    description: 'Using == / != instead of === / !== invites coercion bugs.',
    catches: "if (id == '0') { … }  // '' == 0, 0 == '0', etc.",
  },
  {
    id: 'debugger-statements',
    label: 'Leftover debugger',
    description: "A `debugger;` statement left in source.",
    catches: 'function pay() { debugger; charge(); }',
  },
  {
    id: 'hook-deps',
    label: 'Hook dependency completeness',
    description: "An effect/callback's dependency array omits a value it reads — stale closures.",
    catches: 'useEffect(() => save(draft), []);  // missing `draft`',
  },
  {
    id: 'import-boundaries',
    label: 'Architectural import boundaries',
    description:
      'Cross-layer imports that violate the intended dependency direction (UI importing from infra, etc.). ' +
      'A first-class boundary/layer model — the kind Sheriff and dependency-cruiser are built around.',
    catches: "import { db } from '../../infra/db';  // from a presentational component",
  },
];

// One row per (concern, tool) the tool *can* express. No row = no equivalent (the shopping cell).
export const mappings = [
  { concernId: 'unused-variables', tool: 'eslint', rule: 'no-unused-vars', confidence: CONFIDENCE.EXACT },
  { concernId: 'unused-variables', tool: 'oxlint', rule: 'no-unused-vars', confidence: CONFIDENCE.EXACT },

  { concernId: 'console-statements', tool: 'eslint', rule: 'no-console', confidence: CONFIDENCE.EXACT },
  { concernId: 'console-statements', tool: 'oxlint', rule: 'no-console', confidence: CONFIDENCE.EXACT },

  { concernId: 'strict-equality', tool: 'eslint', rule: 'eqeqeq', confidence: CONFIDENCE.EXACT },
  { concernId: 'strict-equality', tool: 'oxlint', rule: 'eqeqeq', confidence: CONFIDENCE.EXACT },

  { concernId: 'debugger-statements', tool: 'eslint', rule: 'no-debugger', confidence: CONFIDENCE.EXACT },
  { concernId: 'debugger-statements', tool: 'oxlint', rule: 'no-debugger', confidence: CONFIDENCE.EXACT },

  {
    concernId: 'hook-deps',
    tool: 'eslint',
    rule: 'react-hooks/exhaustive-deps',
    confidence: CONFIDENCE.EXACT,
    note: 'The reference implementation, maintained alongside React.',
  },
  {
    concernId: 'hook-deps',
    tool: 'oxlint',
    rule: 'react/exhaustive-deps',
    confidence: CONFIDENCE.PARTIAL,
    note: 'Oxlint ports a subset; some autofix suggestions and edge cases differ from the React plugin.',
  },

  {
    concernId: 'import-boundaries',
    tool: 'eslint',
    rule: 'import/no-restricted-paths',
    confidence: CONFIDENCE.PARTIAL,
    note:
      'Path-glob based, not a first-class layer model — you encode boundaries as zone patterns. ' +
      'Sheriff / dependency-cruiser express this concern far more directly.',
  },
  // No oxlint row for import-boundaries → the "no equivalent" cell. This is the comparative
  // value: if architectural boundaries matter to you, Oxlint alone can't carry that concern.
];
