---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-06"
graduatedTo: demo:jsx-adapter-demo
tags: [jsx, adapters, testing, demos]
relatedReport: reports/2026-06-06-jsx-adapter-demo-testing-plan.md
crossRef: { url: /demos/jsx-adapter-demo/, label: JSX Adapter Playground }
---

Kept as the `relatedReport` pointer so the testing-plan report stays reachable (three-homes rule);
the work itself graduated into the `jsx-adapter-demo` playground plus the test suites + the
`check:standards` shadowing guard:

- `blocks/__tests__/unit/renderers/mapping-conformance.test.tsx`
- `blocks/__tests__/unit/renderers/directiveSugar.test.tsx`
- `blocks/renderers/jsx/__fixtures__/mapping-cases.tsx`
- `plugs/__tests__/e2e/playgrounds.spec.ts`
- `blocks/__tests__/e2e/source-toggle.spec.ts`
- `scripts/check-standards.mjs` (§8 shadowing guard)

## Resolution

The report's "all green" claim was false — the `.tsx` conformance suites were silently red. Root
cause: ~280 stale compiled `.js`/`.d.ts` artifacts (stray per-file `tsc`) sat next to the `.ts`/`.tsx`
sources; Vite/vitest resolve `.js` before `.tsx`, so fixtures loaded the compiled `.js` (which has
`jsx.createElement` calls but no `import jsx` — tsc ignores `jsxInject`) → every `render:` case threw
`jsx is not defined`; the directive-sugar suite lost its exports the same way.

Fixed by deleting the shadowing artifacts (sources are the only truth) and adding a `check:standards`
guard (§8) that errors on any `.js`/`.d.ts` shadowing a `.ts`/`.tsx`, so the silent-breakage can't
recur. Verified: `vitest run` = 1386 passed / 7 skipped (83 files); `build:check` (eleventy) clean.
