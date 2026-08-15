---
kind: story
size: 5
parent: "142"
status: open
locus: plateau-app
humanGate: { kind: review, short: "Interactively verify the role/permission preview + contract-diff in the running dev-browser app.", what: "Acceptance is 'preview the LIVE app as any declared role/permission set and diff the rendered surface against the contract' — a live dev-browser surface whose verification is hands-on interaction in the running app (select a role → observe the re-rendered app → confirm the contract diff), not a headless unit check a serial batch can perform. The data blocker is clear: webidentity exists (#1060/#1061) and the webpermissions contract #1699 is now RESOLVED (the body's 'blocked by #1699' note is stale), so the declared roles/scopes are available — the residual is the interactive build-and-verify in a dev-browser session. Needs a focused session driving the running app." }
dateOpened: "2026-06-23"
tags: [dev-browser, permissions, identity, prepared]
scope:
  - plateau-app:packages/dev-browser/src/permission-simulator/types.ts
  - plateau-app:packages/dev-browser/src/permission-simulator/dom.ts
  - plateau-app:packages/dev-browser/src/permission-simulator/diff.ts
  - plateau-app:packages/dev-browser/src/permission-simulator/panel.ts
  - plateau-app:packages/dev-browser/src/permission-simulator/index.ts
  - plateau-app:packages/dev-browser/src/permission-simulator/permission-simulator.test.ts
  - plateau-app:packages/dev-browser/src/feature-lighting/types.ts
  - plateau-app:packages/dev-browser/src/feature-lighting/light.ts
  - plateau-app:packages/dev-browser/src/feature-lighting/feature-lighting.test.ts
  - plateau-app:packages/dev-browser/src/index.ts
  - plateau-app:tsconfig.json
  - plateau-app:tests/e2e/permission-simulator-diff.spec.ts
---

# Permission and identity simulator (dev browser)

> **Prepared (this pass).** Two premises in the body below are corrected here, not silently: (1) the
> `blocked by #1699` note is stale — [#1699](/backlog/1699-webpermissions-contract-declared-role-permission-scope-model/)
> resolved (`we:permissions/contract.ts`, type-only), so the declared roles/scopes exist and nothing blocks
> the build (the `humanGate.what` already caught this). (2) **"the identity axis is ready via webidentity
> (#1060/#1061)" overstates what that contract is.** Read in full (`we:identity/contract.ts`), webidentity is
> **credential-acquisition** (the `navigator.credentials` login dispatcher: passkey/federated/digital/password
> ceremonies) — it has no user-attribute/claims shape at all, so there is no "custom claim set" to enumerate
> from it. **Design decision:** the v1 identity axis is the binary already implicit in an authorization model —
> an assumed **role** (from the webpermissions `PermissionModel`) or **`null`** (anonymous / no role, the
> safe-deny case `PermissionQuery`/`PermissionDecision` already models,
> [we:permissions/contract.ts:83](../permissions/contract.ts#L83)) — not a richer identity/claims picker. If a
> richer claims axis is wanted later it needs its own contract (none exists in the constellation yet); that is
> new scope, not this card's.

Build story for the permission/identity simulator (#1645, ratified go). Preview the live app as any declared
role/permission set, enumerated from the webpermissions declared contract, and diff the rendered surface
against the contract. Home plateau:dev-browser.

## Grounding — what's actually on disk

- **The contract exists, type-only, unconsumed.** `we:permissions/contract.ts` (published as
  `@webeverything/contracts/permissions`, [we:contracts/package.json:52](../contracts/package.json#L52))
  declares `Role`, `PermissionScopeKind` (`field`/`action`/`state`/`ownership`), `Affordance` (a gated target,
  `{kind, id}`), `PermissionScope` (`{id, kind, gates: Affordance[]}`), `RoleGrant` (`{role, scopes: string[]}`),
  `PermissionModel` (`{roles, scopes, grants}`), and `PermissionQuery`/`PermissionDecision`
  (`'allow'|'deny'`, deny-default). **No app anywhere in the constellation instantiates a `PermissionModel`
  yet** — grepped `plateau-app` and `frontierui` for `PermissionModel`/`permissions/contract`/`webpermissions`:
  zero hits. The FUI auto-insurance demo's `ACTOR = { role: 'agent' }` / `UW = { role: 'underwriter' }`
  constants ([fui:demos/auto-insurance/app.ts:58](../../frontierui/demos/auto-insurance/app.ts#L58)) are
  hand-set actors for the **weblifecycle** guard's `available()` transition set — a different mechanism, not
  a `PermissionModel` instance. **This is the same shape #1691 (variant simulator) shipped in** — a generic,
  app-agnostic engine with zero real app wiring, accepted and resolved on that basis. Not a blocker here
  either; note it so the builder doesn't go hunting for app data that doesn't exist.
- **The closest sibling is `#1691` (variant simulator, resolved), not a template to reuse directly.**
  [plateau:packages/dev-browser/src/variant-simulator/](../../plateau-app/packages/dev-browser/src/variant-simulator/)
  already has a generic `role` axis
  (`VariantAxisId` includes `'role'`, [plateau:packages/dev-browser/src/variant-simulator/types.ts:12](../../plateau-app/packages/dev-browser/src/variant-simulator/types.ts#L12)) —
  but it is untyped (`values: readonly string[]`, no link to `PermissionModel`) and it only **drives**
  variants; it never **diffs** the rendered result against a declared "should be visible" set. That diff is
  the genuinely new piece this card adds (see Design). Do not duplicate the role axis inside
  variant-simulator — this module owns the permission-specific diff; #1643's card already flagged the two as
  siblings to "coordinate so the role axis is implemented once", but variant-simulator's role axis stays a
  bare string (any app-defined role name); this module is the one that actually reads the `PermissionModel`.
- **The exact humanGate shape has a resolved precedent to mirror: `#1696`** (named seed/scenario loader,
  resolved 2026-07-26). Its `humanGate.what` states the same pattern this card needs: *"the round-trip IS
  automatable as a Playwright conformance test, and should be built that way as the durable regression guard
  ... the gate shrinks to a spot-check on top of a green automated test."* #1696 shipped exactly that:
  [plateau:packages/dev-browser/src/scenario-loader/scenario-loader.test.ts](../../plateau-app/packages/dev-browser/src/scenario-loader/scenario-loader.test.ts)
  (the REQUIRED vitest gate, happy-dom) plus
  [plateau:tests/e2e/scenario-loader-roundtrip.spec.ts](../../plateau-app/tests/e2e/scenario-loader-roundtrip.spec.ts)
  (a real-Chromium Playwright spec against `npm start`, `test.skip`'d under `PLATEAU_PREBUILT_APP` since the
  required check never depends on it). This card's design and tasks below are the same two-layer shape,
  module-adapted.

## Decided design

**A new dev-browser module, `permission-simulator`, generic over two app seams — mirrors the
`VariantApplier`/`RestorableStateModel` seam-injection pattern already used by `variant-simulator` and
`scenario-loader`:**

1. **Write seam — `RoleApplier`** (app-supplied): `assumeRole(role: string | null): void | Promise<void>` +
   optional `reset(): void | Promise<void>`. The app knows how to re-render itself under an assumed role;
   `null` is the anonymous/no-role case.
2. **Read seam — DOM attribute read, not an injected probe.** Rather than a second app-supplied function,
   this module reads which affordances are **actually rendered** the same way
   [plateau:packages/dev-browser/src/intent-inspector/inspect.ts](../../plateau-app/packages/dev-browser/src/intent-inspector/inspect.ts)
   reads `data-intent-*` — near-zero cost, inert, stamps nothing. New attribute pair, minted here (like
   `data-we-owner`/`data-we-owner-kind` were minted by #1690 with no WE-side change —
   [plateau:packages/dev-browser/src/element-resolver/owner.ts:13](../../plateau-app/packages/dev-browser/src/element-resolver/owner.ts#L13),
   a plateau-app-owned dev-browser vocabulary, not a WE standard): `data-we-affordance-kind` (the
   `PermissionScopeKind`) + `data-we-affordance-id` (the `Affordance.id`) on any element an app wants the
   simulator to account for. **Why attribute-read over an injected probe:** it is the established,
   lower-coupling precedent in this exact package (intent-inspector, element-resolver both read declared
   DOM attributes rather than taking an app-supplied query function); "what's actually in the DOM" is also
   strictly the right signal for "is this really rendered" regardless of whether the app hides vs. removes
   the node.
3. **The diff.** For a selected role, compute `expected` = the affordances the role's grants declare
   (`PermissionModel.grants.find(role) → scope ids → PermissionModel.scopes[id].gates`, `[]` for `role: null`
   or an unknown role — safe-deny, matching `PermissionDecision`'s default) and `rendered` = what
   `inspectRenderedAffordances(root)` reads off the live DOM after the applier ran. Bucket into
   `matched` / `missing` (declared but not rendered — under-provisioned) / `extra` (rendered but not declared
   for this role — **the authorization gap #1645's decision names as the whole point**: "a control visible
   to a role that shouldn't have it").
4. **A mountable UI panel** (not a headless-only engine like variant-simulator) — the humanGate's acceptance
   is "select a role → observe the re-rendered app → confirm the contract diff", which needs something to
   click. Mirrors
   [plateau:packages/dev-browser/src/scenario-loader/panel.ts](../../plateau-app/packages/dev-browser/src/scenario-loader/panel.ts)'s
   shape: plain DOM, one injected `<style>`, every interactive node carries a `data-test` hook.

**Interface seam addition needed for the type import.**
[plateau:tsconfig.json](../../plateau-app/tsconfig.json)'s `paths` has no entry for
`@webeverything/contracts/permissions` yet (checked: absent). Add it exactly like the existing type-only
entries (`@webeverything/contracts/webpolicy`, `@webeverything/contracts/repro-bundle`,
[plateau:tsconfig.json:51](../../plateau-app/tsconfig.json#L51)):
```json
"@webeverything/contracts/permissions": ["../webeverything/permissions/contract.ts"],
```
Consumed via `import type` only (the contract is compile-erased) — **no `plateau:vitest.config.ts` alias needed**,
matching the documented precedent at the same tsconfig entries ("erased at runtime — no vite/vitest alias
needed"). The unit test file must NOT import the WE alias directly — inline a structurally-equivalent local
`PermissionModel` shape instead, mirroring
[plateau:packages/dev-browser/src/feature-lighting/feature-lighting.test.ts](../../plateau-app/packages/dev-browser/src/feature-lighting/feature-lighting.test.ts)'s
explicit reasoning (comment at the top of that file): the WE-sibling alias resolves in the normal workspace
but is **absent in an isolated single-repo lane clone**, so a test that imports it directly breaks there.
(Note: `plateau:packages/dev-browser/src/element-resolver/element-resolver.test.ts` does import a WE alias directly and is the looser, not-yet-bitten
precedent — follow feature-lighting's stricter, already-burned lesson instead.)

## Interfaces (signatures)

```ts
// packages/dev-browser/src/permission-simulator/types.ts
import type { PermissionModel, Role, PermissionScope, PermissionScopeKind, Affordance, RoleGrant }
  from '@webeverything/contracts/permissions';
export type { PermissionModel, Role, PermissionScope, PermissionScopeKind, Affordance, RoleGrant };

export interface RoleApplier {
  assumeRole(role: string | null): void | Promise<void>;
  reset?(): void | Promise<void>;
}

export interface RenderedAffordance {
  readonly kind: PermissionScopeKind;
  readonly id: string;
  readonly locator: string; // tag + nth-of-type, mirrors intent-inspector's locatorFor — never an identity key
}

export interface PermissionDiff {
  readonly role: string | null;
  readonly missing: readonly Affordance[];      // declared for the role, not found rendered
  readonly extra: readonly RenderedAffordance[]; // rendered, not declared for the role — the authz gap
  readonly matched: readonly Affordance[];
}
```

```ts
// packages/dev-browser/src/permission-simulator/dom.ts (mirrors intent-inspector/inspect.ts)
export const AFFORDANCE_KIND_ATTR = 'data-we-affordance-kind';
export const AFFORDANCE_ID_ATTR = 'data-we-affordance-id';
export function inspectRenderedAffordances(root: Element): RenderedAffordance[];
```

```ts
// packages/dev-browser/src/permission-simulator/diff.ts
export function expectedAffordances(model: PermissionModel, role: string | null): Affordance[];
export function diffPermissions(
  model: PermissionModel, role: string | null, rendered: readonly RenderedAffordance[],
): PermissionDiff;
export async function simulateRole(
  applier: RoleApplier, probeRoot: Element, model: PermissionModel, role: string | null,
): Promise<PermissionDiff>; // reset?() → assumeRole(role) → inspectRenderedAffordances → diffPermissions
```

```ts
// packages/dev-browser/src/permission-simulator/panel.ts (mirrors scenario-loader/panel.ts)
export function mountPermissionSimulator(
  root: HTMLElement,
  opts: { model: PermissionModel; applier: RoleApplier; probeRoot: Element },
): { refresh: () => Promise<void> };
// Renders: a role <select data-test="role-select"> (options = "anonymous" + each model.roles), a
// data-test="preview-btn", and three data-test="diff-matched"/"diff-missing"/"diff-extra" lists, each item
// data-affordance="<kind>:<id>".
```

**Errors:** `simulateRole` never throws — an `assumeRole` rejection is caught and surfaces as an empty
`rendered` set plus a status message in the panel (mirrors `simulateVariant`'s `ok:false` capture and
`plateau:scenario-loader/panel.ts`'s `setStatus(message, true)` pattern), never an unhandled rejection.

**Feature-lighting registration** (the real, mechanical consumer beyond the module's own directory):
```ts
// feature-lighting/types.ts — DevBrowserModuleId (append-only union)
  | 'permission-simulator'
// feature-lighting/light.ts — MODULE_REQUIREMENTS
'permission-simulator': { minConformanceLevel: 'L0', requiredFeatures: [] },
// — an L0-accessible declared-model reader, same bucket as variant-simulator/intent-inspector: it reads an
// app-injected RoleApplier + the DOM, no interaction-surface features required.
```
`plateau:feature-lighting.test.ts`'s `L0_MODULES` array must gain `'permission-simulator'` (its `L2_ALL`/sorted-output
assertions derive from `Object.keys(MODULE_REQUIREMENTS)`, so no other test edit is needed there).

## Tasks (ordered)

1. [plateau:tsconfig.json](../../plateau-app/tsconfig.json) — add the `@webeverything/contracts/permissions`
   path entry (type-only, commented like its siblings).
2. `plateau:packages/dev-browser/src/permission-simulator/types.ts` — seams + diff shapes (above).
3. `plateau:packages/dev-browser/src/permission-simulator/dom.ts` — attribute constants + `inspectRenderedAffordances`.
4. `plateau:packages/dev-browser/src/permission-simulator/diff.ts` — `expectedAffordances`, `diffPermissions`,
   `simulateRole`.
5. `plateau:packages/dev-browser/src/permission-simulator/panel.ts` — `mountPermissionSimulator`.
6. `plateau:packages/dev-browser/src/permission-simulator/index.ts` — public barrel (mirrors `plateau:scenario-loader/index.ts`).
7. `plateau:packages/dev-browser/src/permission-simulator/permission-simulator.test.ts` (happy-dom, vitest,
   REQUIRED gate) — inline local `PermissionModel` fixture (no WE alias import, see Design); cover:
   `expectedAffordances` per-role + `null`-role + unknown-role (all `[]` or grant-derived);
   `diffPermissions` matched/missing/extra bucketing from constructed rendered-vs-declared fixtures;
   `mountPermissionSimulator` end-to-end in happy-dom (select role → click preview → assert the three
   `data-test` lists); the async-`assumeRole`-rejection → status-message path.
8. `plateau:packages/dev-browser/src/feature-lighting/types.ts` + `plateau:light.ts` + `plateau:feature-lighting.test.ts` — register
   the module (above).
9. `plateau:packages/dev-browser/src/index.ts` — add `permission-simulator` to the module-list header comment.
10. `plateau:tests/e2e/permission-simulator-diff.spec.ts` (Playwright, real Chromium, the humanGate's automated
    round-trip proof — mirrors
    [plateau:tests/e2e/scenario-loader-roundtrip.spec.ts](../../plateau-app/tests/e2e/scenario-loader-roundtrip.spec.ts)
    exactly, including its `test.skip(!!process.env.PLATEAU_PREBUILT_APP, …)` guard and
    source-import-from-dev-server comment): mount a tiny app-under-test with two roles (e.g. `viewer` /
    `admin`) and one deliberately **over-provisioned** affordance (rendered for `viewer` though the fixture
    `PermissionModel` doesn't grant it), plus one correctly-gated one. Drive: pick `viewer` → preview →
    assert the over-provisioned affordance appears in `diff-extra`; pick `admin` → preview → assert it's in
    `diff-matched`. This is the concrete "authorization gap surfaces in-app" acceptance from #1645's
    decision, proven end-to-end in a real browser.

## Delivery shape

Lands as **one incremental PR**, behind `main` — a new, self-contained dev-only module with no runtime
coupling to any shipped app surface (same shape #1691/#1696 landed in). No flag needed: it's an opt-in
dev-browser tool a host app must explicitly mount, not user-facing.

## Done when

- `npm run check:standards` (plateau-app) is green — typecheck picks up the new tsconfig path with no error.
- `plateau:permission-simulator.test.ts` passes: per-role/`null`-role/unknown-role `expectedAffordances`;
  matched/missing/extra `diffPermissions` bucketing; the mounted-panel role-select → preview → diff-list
  interaction; the rejected-`assumeRole` → status-message path.
- `plateau:feature-lighting.test.ts` passes with `permission-simulator` included in the L0-unlocked set (empty L0
  manifest) and in the full L2 unlock set.
- `plateau:tests/e2e/permission-simulator-diff.spec.ts` passes locally against `npm start` (:4000): selecting
  `viewer` flags the over-provisioned affordance as `extra`; selecting `admin` shows it as `matched`.
- Human spot-check (existing `humanGate`) confirms the live preview + diff behaves sensibly in a running
  dev-browser session — narrowed to that spot-check because the round-trip itself is proven by the
  automated Playwright spec, the same shape #1696 resolved under.

## Not yet done (flagged, not silently skipped)

Per the story-preparation checklist item 9, this pass covers items 1–8 (scope+consumers, size basis, testable
acceptance, decided design, interfaces, tasks, delivery shape, de-risked via the grounding above). It has
**not** had the independent build-readiness review item 9 calls for — that confidence-level + risk-list pass
must come from a session other than this one before a builder starts.
