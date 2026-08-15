---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
relatedTo: ["1632", "1700", "1667", "1636", "1696"]
scope:
  - plateau-app:packages/dev-browser/src/contract-inspector/types.ts
  - plateau-app:packages/dev-browser/src/contract-inspector/validate.ts
  - plateau-app:packages/dev-browser/src/contract-inspector/contract-inspector.test.ts
  - plateau-app:packages/dev-browser/src/contract-inspector/panel.ts
  - plateau-app:packages/dev-browser/src/contract-inspector/index.ts
  - plateau-app:tests/e2e/contract-inspector-drift.spec.ts
  - plateau-app:tsconfig.json
humanGate:
  kind: review
  what: >-
    Acceptance is hands-on interaction in the running dev-browser session: mount the panel, observe at least
    one seam's declared contract beside its live value, mutate the live value to violate the declared shape,
    and confirm the panel flags the correct offending path — not a headless unit check a serial batch can
    perform. Same bucket as siblings #1695/#1696.

    Preparation (2026-08-15) closed out the two residuals this gate used to carry, and corrected one of them
    that was a wrong premise: (1) the "#1636 lens primitive" reference was stale — #1636 (role-scoped lenses)
    resolved `graduatedTo: none` (a concept ruling, never built), so the panel needs **no** lens registration;
    it ships as a standalone dev-browser submodule, exactly like every already-resolved sibling inspector
    (intent-inspector, page-hierarchy-inspector, declared-rules). (2) "wire #1700 into plateau's SeamContract"
    named the wrong target — plateau-app:src/platform-manager/types.ts's `SeamContract` is the UNRELATED
    cross-repo/cross-team capability-tier model (#401/#442, a build-time aggregation over seeded repo graphs);
    wiring a per-app runtime value-contract into it would be a category error. Confirmed plateau-app has zero
    references to webcontexts/CustomContext/frontierui anywhere in its own source — the real wiring is the
    same type-only cross-repo alias pattern already used for `@webeverything/contracts/webpolicy` etc. See
    *Decided design* below. Needs a focused session driving the running app only for the final interactive
    check.
dateOpened: "2026-06-23"
tags: [dev-browser, inspector, seams, contract-validation]
---

# Live contract and data inspector at provider/context seams (dev browser)

> **Pre-flight (batch-2026-06-26-1793-1697) — `humanGate: review` added.** A live dev-browser inspector whose acceptance is hands-on verification in the running app (not headless), exactly like #1695/#1696. Pre-flight also found two stale-foundation residuals (folded into the gate's `what`): #1636's "lens primitive" graduatedTo:none (never built), and #1700's value-contract (in `we:webcontexts/contract.ts`) is not yet wired into plateau's `SeamContract` (`plateau-app:src/platform-manager/types.ts`). A focused dev-browser session owns this.

Build story for the live contract/data inspector (#1632, ratified go — cluster's cleanest delta). At each provider/context seam show the declared contract beside the live value and validate continuously, flagging the offending path on drift. Seam topology is introspectable (#400 resolved); the over-time/snapshot half is blocked by #1667 (trace/replay), and the point-in-time half is blocked by the declared per-seam value-contract [#1700](/backlog/1700-webcontexts-contract-declared-per-seam-value-contract-for-li/) (webcontexts ships the runtime but declares no per-seam value shape yet). Registers against the #1636 lens primitive. Home plateau:dev-browser.

**Both of the body's cited blockers are now resolved and stale.** #1667 (trace/replay capture) resolved 2026-06-23 → we:backlog/1667 graduated to plateau-app:packages/dev-browser/src/capture/; #1700 (webcontexts value-contract) resolved 2026-06-23 → we:webcontexts/contract.ts. Neither blocks this build — see *Decided design*. The "over-time/snapshot half" (a drift-history timeline) is explicitly **out of scope** for this story; see the scope note below.

## Verified against live code (2026-08-15)

- **we:webcontexts/contract.ts** (shipped, #1700) declares exactly the "declared contract" half: `ValueShape` (primitive/object/array/union/any, each `optional`), `SeamValueContract { seam, value, description? }`, `ContextValueContracts = readonly SeamValueContract[]`, `SeamValueDrift { seam, path, kind: missing|extra|type-mismatch, expected, actual }`, `SeamValidationResult { seam, ok, drifts }`. It is explicitly **type-only** — its own header says "the inspector owns the validation runtime that walks `ValueShape` against an actual value." That runtime does not exist anywhere yet (`grep -rn "ValueShape" .` over plateau-app — zero hits). Published at we:contracts/webcontexts.ts:6 (`export type * from '../webcontexts/contract'`) with a `./webcontexts` entry already in we:contracts/package.json:53.
- **plateau-app:packages/dev-browser/src/capture/types.ts:21** (shipped, #1667) already declares the "live value" half: `DeclaredState = Readonly<Record<string, Readonly<Record<string, unknown>>>>` — literally "`scopeId` (a provider/context seam) → its declared key/values" per its own doc comment. `:69` `IntrospectionSource.snapshotDeclaredState(): DeclaredState` is the live read. No app implements it yet (a repo grep for `IntrospectionSource` shows only the capture module + its test + the scenario-loader's narrower reuse, next point) — same as the declared-contract half, this is a **generic seam with no concrete adapter**, which is the established, accepted shape for this whole dev-browser cluster (#1667's own resolution note: "No app declares an `IntrospectionSource` yet — the substrate ships the generic seam; adapters land with their consumers").
- **The precedent for reusing `DeclaredState` narrowly, not the whole `IntrospectionSource`, is already in the repo.** plateau-app:packages/dev-browser/src/scenario-loader/types.ts:14-17 re-exports just `DeclaredState` from capture and defines its OWN purpose-scoped interface (`RestorableStateModel`) rather than depending on `IntrospectionSource.subscribe` (which emits `intent`/`transition` semantic **action** events, not "a seam value changed" — using it as a "revalidate now" trigger would be an indirect, leaky coupling). This story follows the same precedent: define a read-only, purpose-scoped `SeamValueSource`.
- **plateau-app:src/platform-manager/types.ts:32-39's `SeamContract`** (`{ protocol, providerTier?, consumerRequires? }`) is a different concept at a different layer, confirmed by reading its file header (plateau-app:src/platform-manager/types.ts:1-16): it is the **licensed aggregation layer over the cross-repo `webregistries` provider-consumer-graph protocol (#401)** — project/provider/protocol nodes, `consumerRequires ⊆ providerTier-supplies` compatibility, built from `seedRepoGraphs`/`seedTierCapabilities` (plateau-app:src/platform-manager/seed.ts) and rendered by plateau-app:src/platform-manager/contract-drift.ts at the `/contract-drift` route. That is cross-**team**/cross-**repo** governance, not a single running app's DOM-level provider/context seams. Wiring #1700's per-app `ValueShape` into it would conflate two unrelated "contract" vocabularies that happen to share a word.
- **plateau-app has zero live webcontexts/CustomContext seams of its own to inspect.** A repo grep for `CustomContext`/`webcontexts` across plateau-app's `.ts`/`.tsx` (excluding `dist/`) returns nothing, and plateau-app:package.json + its installed `@plateau/*` packages show no dependency on `frontierui` at all. This matches how every other resolved dev-browser inspector already works (`intent-inspector`, `element-resolver`) — they are generic tools that read a **declared model** any WE-conformant app under inspection exposes; they are not built against plateau-app's own internals. #1690's resolution note states the repo-wide rule explicitly: dev-browser tools are "stack-agnostic via the declared model, not a framework fiber tree." No real running app anywhere in this workspace currently implements the seam this story needs (same as #1667's own residual) — the build ships the generic engine + panel + a proven stub-app e2e round-trip, exactly the shape #1696 shipped for the scenario loader (plateau-app:tests/e2e/scenario-loader-roundtrip.spec.ts).
- **plateau-app:tsconfig.json:107-108** already carries a wildcard alias `"@plateau/dev-browser/*": ["./packages/dev-browser/src/*"]`, so a brand-new submodule needs no new alias of its own. There is **no** `@webeverything/contracts/webcontexts` entry yet (checked plateau-app:tsconfig.json:44-79) — every sibling entry there for a type-only contract (webpolicy at plateau-app:tsconfig.json:61, webcompliance at plateau-app:tsconfig.json:62, webdocs at plateau-app:tsconfig.json:74, backlog at plateau-app:tsconfig.json:58) explicitly notes "no vite alias needed" because `import type` is erased by esbuild without runtime resolution; the same applies here.

## Decided design

Ship a new, self-contained submodule plateau-app:packages/dev-browser/src/contract-inspector/, following the exact shape of every already-resolved sibling in this cluster (`intent-inspector/`, `page-hierarchy-inspector/`, `scenario-loader/`): a types module + a pure validation engine + a DOM panel + an index barrel + a vitest suite, consumed via the existing `@plateau/dev-browser/contract-inspector` wildcard alias. No lens/persona registration (#1636 was never built — see gate). No changes to `web-everything` — #1700 already shipped everything WE owns; this build only needs one new type-only import alias on the plateau-app side.

**Data flow:** an app under inspection supplies (a) its `ContextValueContracts` (declared, from `@webeverything/contracts/webcontexts`) and (b) a `SeamValueSource` (live, this story's own narrow interface, read-only). The panel snapshots the live state, runs the pure `validateSeams` engine against the declared contracts, renders each seam's declared shape beside its live value with an ok/drift verdict, and re-snapshots + re-validates on a short poll interval so the read stays live ("continuous" = re-checks the CURRENT state on a timer, not a historical trend/log).

**Explicitly out of scope: an over-time/drift-history view.** The card's body frames "over-time/snapshot" as a separate half, previously gated on #1667 (now resolved and available — `CaptureSession`/`CaptureTrace` — should a future story want a drift timeline). "Validate continuously" here means live-reactive to the present state; a history/trend view is a distinct, unscoped feature and not part of this Done-when.

**#1642's "coordinate panel model" note does not apply here.** #1642 (the sibling intent/a11y conformance inspector) resolved by folding into the **explorer's headless oracle pipeline** (plateau-app:tools/explorer/oracles/intentConformance.ts, graduated via #1698) rather than a dev-browser panel, because its humanGate turned out to be fully automatable. #1697's humanGate explicitly requires hands-on interactive verification (mutate a live value, confirm the flagged path), so the two features no longer share a delivery shape — no shared-component action is needed.

## Interfaces

**1. Reused, unchanged — we:webcontexts/contract.ts** (via `@webeverything/contracts/webcontexts`, type-only): `ValueShape`, `SeamValueContract`, `ContextValueContracts`, `SeamValueDrift`, `SeamValidationResult`. **New tsconfig entry**, plateau-app:tsconfig.json, alongside the webpolicy/webcompliance entries at lines 61-62:

```json
"@webeverything/contracts/webcontexts": ["../webeverything/webcontexts/contract.ts"],
```

Type-only — no vite.config.mts alias needed (matches the webpolicy/webcompliance/webdocs/backlog precedent in the same file).

**2. Reused, unchanged — plateau-app:packages/dev-browser/src/capture/types.ts:21**: `DeclaredState`, re-exported via `@plateau/dev-browser/capture` (already public, plateau-app:packages/dev-browser/src/capture/index.ts:10).

**3. New — plateau-app:packages/dev-browser/src/contract-inspector/types.ts:**

```ts
import type { DeclaredState } from '../capture';
export type { DeclaredState };
export type {
  ValueShape, PrimitiveShape, ObjectShape, ArrayShape, UnionShape, AnyShape,
  SeamValueContract, ContextValueContracts, SeamValueDrift, SeamValueDriftKind, SeamValidationResult,
} from '@webeverything/contracts/webcontexts';

/**
 * The read-only half of an app's self-describing model this inspector needs — reuses the SAME `DeclaredState`
 * seam the capture substrate (#1667) and scenario loader (#1696) already ride, narrowed to just the read (this
 * inspector never restores state, unlike the loader's `RestorableStateModel`). A test/headless run supplies a
 * stub; a real app adapts its existing introspection.
 */
export interface SeamValueSource {
  snapshotDeclaredState(): DeclaredState;
}
```

**4. New — plateau-app:packages/dev-browser/src/contract-inspector/validate.ts** (pure, deterministic):

```ts
import type { SeamValidationResult, SeamValueContract, SeamValueDrift, ValueShape } from './types';

/** Walk `shape` against `value` at `path` (dot/bracket, per SeamValueDrift's doc: '' at the seam root). */
export function validateValue(shape: ValueShape, value: unknown, path = ''): SeamValueDrift[] {
  if (value === undefined) {
    if (shape.optional) return [];
    return [{ seam: '', path, kind: 'missing', expected: describeShape(shape), actual: 'undefined' }];
    // (seam is filled in by validateSeam — see below)
  }
  switch (shape.kind) {
    case 'any':
      return [];
    case 'primitive': {
      const ok = shape.type === 'null' ? value === null : typeof value === shape.type;
      return ok ? [] : [{ seam: '', path, kind: 'type-mismatch', expected: shape.type, actual: describeActual(value) }];
    }
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return [{ seam: '', path, kind: 'type-mismatch', expected: 'object', actual: describeActual(value) }];
      }
      const rec = value as Record<string, unknown>;
      const drifts: SeamValueDrift[] = [];
      for (const [key, fieldShape] of Object.entries(shape.fields)) {
        drifts.push(...validateValue(fieldShape, rec[key], path ? `${path}.${key}` : key));
      }
      if (shape.exact) {
        for (const key of Object.keys(rec)) {
          if (!(key in shape.fields)) {
            drifts.push({ seam: '', path: path ? `${path}.${key}` : key, kind: 'extra', expected: '(no extra keys)', actual: describeActual(rec[key]) });
          }
        }
      }
      return drifts;
    }
    case 'array': {
      if (!Array.isArray(value)) return [{ seam: '', path, kind: 'type-mismatch', expected: 'array', actual: describeActual(value) }];
      return value.flatMap((item, i) => validateValue(shape.items, item, `${path}[${i}]`));
    }
    case 'union': {
      const matches = shape.anyOf.some((branch) => validateValue(branch, value, path).length === 0);
      // Deliberately no partial credit / no "closest branch" heuristic — deterministic go/no-go only.
      return matches ? [] : [{ seam: '', path, kind: 'type-mismatch', expected: describeShape(shape), actual: describeActual(value) }];
    }
  }
}

/** One seam's verdict: the declared contract vs. the actual value at that seam (absent = a synthetic drift). */
export function validateSeam(contract: SeamValueContract, actual: unknown): SeamValidationResult {
  const drifts = (actual === undefined
    ? [{ seam: contract.seam, path: '', kind: 'missing' as const, expected: describeShape(contract.value), actual: 'undefined (seam not present)' }]
    : validateValue(contract.value, actual).map((d) => ({ ...d, seam: contract.seam }))
  );
  return { seam: contract.seam, ok: drifts.length === 0, drifts };
}

/** Every declared seam checked against the live snapshot (keyed by seam id, per `DeclaredState`). */
export function validateSeams(
  contracts: ContextValueContracts,
  state: Readonly<Record<string, unknown>>,
): SeamValidationResult[] {
  return contracts.map((c) => validateSeam(c, state[c.seam]));
}

function describeShape(shape: ValueShape): string { /* e.g. 'string', 'object{name,tier}', 'one of: string | number' */ }
function describeActual(value: unknown): string { /* e.g. 'number', 'null', 'undefined' */ }
```

(`describeShape`/`describeActual` are free-form human-readable summaries for the `expected`/`actual` display fields — no fixed format is prescribed, just human-legible.)

**5. New — plateau-app:packages/dev-browser/src/contract-inspector/panel.ts:**

```ts
export interface ContractInspectorOptions {
  readonly title?: string;
  /** Re-snapshot + re-validate interval, ms. Default 500. 0 disables polling (host calls `refresh()` itself). */
  readonly pollMs?: number;
}

/** Mount the panel into `root`. Renders every contract's declared shape beside the live value, ok/drift per
 * seam, drift rows showing `path`/`kind`/`expected`/`actual` — mirrors the `scenario-loader/panel.ts` DOM
 * pattern (plain injected `<style>`, `data-test` hooks) and the `platform-manager/contract-drift.ts` row
 * layout for the drift list. */
export function mountContractInspector(
  root: HTMLElement,
  contracts: ContextValueContracts,
  source: SeamValueSource,
  options?: ContractInspectorOptions,
): { refresh: () => void; dispose: () => void };
```

`data-test` hooks needed by the e2e spec: `contract-inspector` (root), `seam-row` (one per seam, `data-seam="<id>"`), `seam-verdict` (ok/drift), `seam-drift` (one per drift row, with `data-path`).

**Migration:** none — purely additive; no existing shape/data changes.

## Tasks

1. Add the `@webeverything/contracts/webcontexts` alias to plateau-app:tsconfig.json (Interfaces §1).
2. plateau-app:packages/dev-browser/src/contract-inspector/types.ts — the re-exports + `SeamValueSource` (Interfaces §3).
3. plateau-app:packages/dev-browser/src/contract-inspector/validate.ts — `validateValue`/`validateSeam`/`validateSeams` + the two describe helpers (Interfaces §4).
4. plateau-app:packages/dev-browser/src/contract-inspector/contract-inspector.test.ts — vitest coverage: each `ValueShape` kind (primitive match + mismatch + `null`, object missing field, object extra field under `exact`, array item mismatch, union match + union no-match, `any` always-ok, `optional` skips a missing field), the seam-absent synthetic drift, and `validateSeams` over ≥2 contracts.
5. plateau-app:packages/dev-browser/src/contract-inspector/panel.ts — `mountContractInspector` (Interfaces §5): initial render, poll-driven re-render, `refresh()`/`dispose()`.
6. plateau-app:packages/dev-browser/src/contract-inspector/index.ts — barrel re-exporting types + validate + panel, matching every sibling module's own barrel.
7. plateau-app:tests/e2e/contract-inspector-drift.spec.ts — mount a tiny app-under-test (an object whose live state is read via a stub `SeamValueSource`) + one `SeamValueContract`; assert the panel renders `ok` with no drift rows; mutate the live value out-of-band to violate the declared shape; assert the panel (after its poll tick, via an auto-retrying Playwright assertion — no manual sleep) re-renders `drift` and shows the exact offending `path`/`kind`. Follow the `PLATEAU_PREBUILT_APP` skip precedent (plateau-app:tests/e2e/scenario-loader-roundtrip.spec.ts:20-23) since this also imports dev-only source via the Vite dev server.
8. `npm test` (vitest) and `tsc --noEmit` clean in plateau-app; then the focused session runs `npm start` (:4000) and performs the humanGate's interactive check (mount, observe, trigger drift, confirm the flagged path) before resolving.

## Done when

- [ ] `validateValue`/`validateSeam`/`validateSeams` vitest suite green — all 5 `ValueShape` kinds, `optional`, the `exact`-object extra-key case, and the seam-absent synthetic drift are covered (task 4).
- [ ] `tsc --noEmit` clean in plateau-app, including the new `@webeverything/contracts/webcontexts` alias resolving.
- [ ] plateau-app:tests/e2e/contract-inspector-drift.spec.ts passes locally against `npm start` (:4000): a conformant seam renders with zero drift rows; a live-mutated seam renders exactly one drift row with the correct `path`/`kind`.
- [ ] Human spot-check (this item's `humanGate`): in the running dev-browser session, the mounted panel shows a declared contract beside a live value at ≥1 seam, the display updates on its own within one poll interval after the live value changes, and the flagged path matches the actual offending field when a drift is triggered by hand.

## Delivery shape

**One PR, additive, plateau-app-only.** No `web-everything` changes required — #1700 already ships everything WE owns for this. Every new file is a brand-new submodule (no existing consumer to update) plus one tsconfig `paths` line; nothing behind a flag, matches how every other item in this cluster (#1696, #1667, #1690) landed as a single incremental PR.
