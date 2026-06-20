/**
 * Conformance-vector suite (#1312, under #1245) — `text-nodes` (the interpolation text-node family of the
 * Web Expressions binding layer). This is the **pilot** that establishes the block-unit-test → conformance
 * -vector conversion pattern the rest of #1245's per-family deletes reuse (there was no precedent for a
 * *block-family* suite; `validator-resolution` was the original exemplar for the schema itself).
 *
 * Lowered from `we:blocks/__tests__/unit/text-nodes/InterpolationTextNode.test.ts`. Each vector judges only
 * the **observable** outcome — the text rendered into the DOM (`renderedText`) — given an expression source
 * and the contexts/parsers resolvable through the injector chain. It never asserts impl internals (the
 * idempotency guard's call-count, the `instanceof` chain, the parse-result cache): a component is conformant
 * if `{{expr}}` resolves to these strings, however it is built (#506/#899 golden-vectors model). The text
 * -nodes runtime itself is NOT deleted by this slice (it stays bootstrap-gated) — this only adds the vectors.
 *
 * Driver verbs (text-node family): `provideExpressionParsers` declares the parsers resolvable as
 * `customExpressionParsers`; `clearExpressionParsers` models no resolvable registry; `provideContext`
 * sets a `customContexts:<name>` scope; `provideFilter` registers a named transform in the `filters`
 * context; `setExpression` sets the node's expression source (its `{{ }}` children); `connect` /
 * `disconnect` drive the upgrade lifecycle. The outcome is read via `renderedText` (the node's textContent).
 */
import type { ConformanceVectorSuite } from './schema.js';

const CONTRACT = '@webeverything/webexpressions';

export const textNodeSuite: ConformanceVectorSuite = {
  standard: 'text-nodes',
  contract: CONTRACT,
  vectors: [
    {
      id: 'text-nodes/interpolation/simple-state-reference',
      contract: CONTRACT,
      description: 'A bare state reference resolves to its value from the state context.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'state', value: { name: 'World' } },
        { do: 'setExpression', source: 'name' },
        { do: 'connect' },
      ],
      expect: { renderedText: 'World' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/nested-state-path',
      contract: CONTRACT,
      description: 'A dotted path resolves through nested objects in the state context.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'state', value: { user: { profile: { name: 'Jane' } } } },
        { do: 'setExpression', source: 'user.profile.name' },
        { do: 'connect' },
      ],
      expect: { renderedText: 'Jane' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/named-context-reference',
      contract: CONTRACT,
      description: 'An @-prefixed reference resolves against the matching named context, not state.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'theme', value: { primary: '#6366f1' } },
        { do: 'setExpression', source: '@theme.primary' },
        { do: 'connect' },
      ],
      expect: { renderedText: '#6366f1' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/pipe-expression',
      contract: CONTRACT,
      description: 'A piped expression applies the named filter to the resolved value.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'state', value: { name: 'world' } },
        { do: 'provideFilter', name: 'uppercase', transform: 'toUpperCase' },
        { do: 'setExpression', source: 'name | uppercase' },
        { do: 'connect' },
      ],
      expect: { renderedText: 'WORLD' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/empty-expression',
      contract: CONTRACT,
      description: 'An empty expression renders the empty string.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'setExpression', source: '' },
        { do: 'connect' },
      ],
      expect: { renderedText: '' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/no-parser-registry',
      contract: CONTRACT,
      description: 'With no resolvable expression-parser registry, the node renders the empty string (it degrades, it does not leak the source).',
      steps: [
        { do: 'clearExpressionParsers' },
        { do: 'provideContext', name: 'state', value: { name: 'World' } },
        { do: 'setExpression', source: 'name' },
        { do: 'connect' },
      ],
      expect: { renderedText: '' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/unparseable-expression',
      contract: CONTRACT,
      description: 'An expression no parser can handle renders the empty string rather than its source text.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'setExpression', source: '!@#$%' },
        { do: 'connect' },
      ],
      expect: { renderedText: '' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/literal-value',
      contract: CONTRACT,
      description: 'A numeric literal renders as its string form with no context lookup.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'setExpression', source: '42' },
        { do: 'connect' },
      ],
      expect: { renderedText: '42' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/null-value-renders-empty',
      contract: CONTRACT,
      description: 'A reference resolving to null renders the empty string, not the text "null".',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'state', value: { name: null } },
        { do: 'setExpression', source: 'name' },
        { do: 'connect' },
      ],
      expect: { renderedText: '' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/idempotent-connect',
      contract: CONTRACT,
      description: 'Connecting twice produces the same single rendered value (no re-evaluation artifact).',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'state', value: { name: 'World' } },
        { do: 'setExpression', source: 'name' },
        { do: 'connect' },
        { do: 'connect' },
      ],
      expect: { renderedText: 'World' },
      observeVia: ['renderedText'],
    },
    {
      id: 'text-nodes/interpolation/reconnect-after-disconnect',
      contract: CONTRACT,
      description: 'After a disconnect the node re-evaluates on reconnect, restoring the rendered value.',
      steps: [
        { do: 'provideExpressionParsers', parsers: ['value', 'pipe'] },
        { do: 'provideContext', name: 'state', value: { name: 'World' } },
        { do: 'setExpression', source: 'name' },
        { do: 'connect' },
        { do: 'disconnect' },
        { do: 'connect' },
      ],
      expect: { renderedText: 'World' },
      observeVia: ['renderedText'],
    },
  ],
};
