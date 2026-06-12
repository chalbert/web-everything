# validation-normalize — adapter-as-normalization-hub (`see` leg)

The differentiated, **zero-lock-in** answer for the lint/format/boundary overlap zone: not a new
config format, but a devtool that **adapts to the validation tools you already use**. Run it once and
stop — the project keeps no reference to it; it only ever reads the incumbents' own config files.

This directory implements the **`see`** leg of backlog
[#236](../../backlog/236-validation-normalization-shopping-devtool.md): load existing configs →
one unified comparative list of every concern your tools cover. The `re-export` and `shop` legs are
deferred to follow-up items.

## The pivot model

The hub's *private memory* is a tool-agnostic model that projects never author in:

- **Concern** — a statement of "what could go wrong" (`unused-variables`, `import-boundaries`, …),
  independent of any tool. Defined in [`knowledge.mjs`](./knowledge.mjs).
- **Mapping** — how one tool expresses one concern, graded by **confidence**: `exact` (1:1 swap),
  `partial` (subset / diverges), `approx` (adjacent). A concern with **no mapping** for a tool is the
  implicit `none` grade — *no equivalent*. Those gaps are the most valuable cells for shopping.
- **Comparative model** — the join of each tool's ingested config against the mappings, one cell per
  (concern, tool), produced by [`normalize.mjs`](./normalize.mjs). A cell carries `covered`,
  `confidence`, and — when the loaded project enables the rule — `active` + `severity`.

The lossiness is the product: cross-tool semantics are not 1:1, so the model reframes the differences
as a comparative view rather than pretending they round-trip.

## Adding a tool adapter

An adapter is one file under [`adapters/`](./adapters) exporting:

```js
export const tool = 'mytool';
export function ingest(config) {
  // → [{ rule: string, severity: 'error'|'warn'|'off', enabled: boolean }]
}
```

Then:

1. Register it in [`index.mjs`](./index.mjs) (`adapters` map) and in `tools` in `knowledge.mjs`.
2. Add `mappings` rows for the concerns it covers — and **leave gaps** where it has no equivalent.
3. Add a fixture under [`fixtures/`](./fixtures) and assertions in
   [`__tests__/normalize.test.mjs`](./__tests__/normalize.test.mjs).

The catalog page picks the new tool up automatically (it iterates `validationRules.tools`).

## Live-config CLI (`see` over a project's own configs)

The catalog page renders the `see` flow over the *fixtures*; [`live-config.mjs`](./live-config.mjs)
(#284) is the same flow over a project's **real** configs. It discovers and reads a project's own
ESLint config (flat-config `eslint.config.{js,mjs,cjs}`, legacy `.eslintrc.*`, or
`package.json#eslintConfig`) and Oxlint config (`.oxlintrc.json`), in the platform's resolution
precedence, and runs them through the same `see()`. Read-only — it touches only the incumbents' files
and leaves no project-facing artifact (the hub's zero-lock-in promise).

```sh
npm run validation:see -- [projectDir] [--json]   # default dir = cwd; --json emits the full model
```

A missing/unreadable config is reported (a `note`), never fatal; one unreadable tool config doesn't
sink the run. Discovery is exported (`discoverConfigs`, `seeLiveConfigs`) for programmatic use.

## Where it surfaces

- Engine + adapters: this directory (plain Node ESM, no build step).
- Eleventy data file: [`src/_data/validationRules.js`](../../src/_data/validationRules.js) runs the
  `see` flow over the fixtures at build time.
- Catalog page: [`src/validation-rules.njk`](../../src/validation-rules.njk) → `/validation-rules/`.
- Live CLI: `npm run validation:see` → [`live-config.mjs`](./live-config.mjs) (real-config discovery).
- Tests: `npm test -- scripts/validation-normalize` (vitest picks up `__tests__/*.test.mjs`).

## Deferred legs (follow-up items)

- **Re-export** — emit the equivalent config for a *different* tool, with honest, best-effort
  round-trip-loss reporting (never promise lossless).
- **Shop** — browse which tools cover which concerns and pick by the validation you want. Gated on the
  Technical Configurator maturing past its current POC (#236 → #150 Q6).
