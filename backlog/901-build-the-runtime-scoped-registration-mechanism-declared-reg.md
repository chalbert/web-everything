---
type: issue
workItem: story
size: 8
parent: "076"
status: resolved
blockedBy: ["900"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: plugs/webregistries/declarativeRegistry.ts
tags: []
---

# Build the runtime scoped-registration mechanism (declared-registry Tier-1.5 form + binding behavior + moment-2 scoped define)

Implements the #854 ruling: scoped registration is a RUNTIME declared-registry + binding-behavior model, off `<component>`. Build: (1) the Tier-1.5 no-build declared-registry form (mirrors #278's injector script, within #279's shipped ceiling); (2) a CustomAttribute binding-behavior that resolves the registry ref (local IDREF primary, `{{expr}}` bridge for raw foreign objects) and scoped-defines at MOMENT 2 (dom-less declaration registration), via an explicit scan with lazy-queue pending semantics; (3) the consumption-side `shadowrootcustomelementregistry`/`attachShadow` map-through. Reuses webregistries, the #242 seam, #228. The keyword DSL stays Tier-3 per #279 — not built here.

## Progress — built (2026-06-18)

Built in the `webregistries` plug as the structural twin of the shipped `<script type="injector">` DSL
(#278, `we:plugs/webinjectors/declarativeInjector.ts`), reusing the #228-safe scoped
`we:plugs/webregistries/CustomElementRegistry.ts`. All three #854 pieces:

1. **Tier-1.5 declared-registry form** — `we:plugs/webregistries/declarativeRegistry.ts`:
   `applyDeclarativeRegistries(root, { resolveCtor })` finds every `<script type="registry">`, builds one
   scoped `CustomElementRegistry` per script, composes `extends` by **local IDREF** (against registries
   declared earlier in the scan *and* prior scans), and scoped-defines each `define` entry whose
   constructor reference resolves now — *dom-less registration into the registry object*. `parseRegistryScript`
   validates the `{ extends?: string[], define?: {tag: ctorRef} }` body. The constructor reference resolves
   via a pluggable `CtorResolver` (the `{{ expr }}` webexpressions bridge in production; a map in tests).
2. **Lazy-queue (MOMENT 2)** — a `define` whose reference isn't resolvable yet (not-yet-imported module) is
   pushed to `binding.pending` rather than erroring; `flushPendingDefinitions(result, resolveCtor)` drains
   the queue when the backing module loads. Idempotent re-scan (a `processed` WeakSet) so it's safe to
   re-run after DOM/module mutation.
3. **`registry="<id>"` association (#900) + binding behavior** — `resolveScopedRegistry` resolves the
   consumer's `registry=` as a local DOM IDREF (primary) with a `{{ expr }}` raw-foreign-object bridge
   (#854 E form). `ScopedRegistryAttribute extends CustomAttribute` is the MOMENT-2 behavior: on attach it
   resolves the association against the active scan and maps the registry through to the host via
   `applyScopedRegistryToHost` — the consumption-side `attachShadow({ customElementRegistry })` /
   `shadowrootcustomelementregistry` path (upgrades an existing shadow root, records the registry under
   `SCOPED_REGISTRY_KEY` for a later attachShadow). Tolerates consumer-before-declaration (no bind until a
   declaration is scanned).

The keyword `provide`/`consume` build DSL stays Tier-3 (#279) — not built. Exports wired through
`we:plugs/webregistries/index.ts`. **Tests:** `we:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts`
— 20 passing (parse valid/malformed, scoped-define, lazy-queue flush, IDREF extends composition, association
resolve incl. `{{ expr }}` bridge, shadow map-through, idempotency, and the MOMENT-2 behavior). Typechecks
clean; `check:standards` green (the one residual error is a concurrent session's untracked report).
