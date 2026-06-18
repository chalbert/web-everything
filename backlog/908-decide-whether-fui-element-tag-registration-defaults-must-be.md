---
type: decision
workItem: story
size: 3
status: resolved
codifiedIn: docs/agent/platform-decisions.md#tagname-naming
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-17-custom-element-tag-naming-convention.md
crossRef: { url: /backlog/844-fui-conformance-gate-extend-783-check-2-so-every-fui-define-/, label: "Blocked gate (#844)" }
tags: [frontierui, cem, conformance, registration, tagname]
---

# Decide whether FUI element-tag registration DEFAULTS must be the we- spec tagName (pretty names → overrides) — the #844 gate premise vs #843 overrides ruling

**Prepared 2026-06-18 — ready to ratify.** This decision ratifies (or reverses) shipped/ratified ground, so
it links the prior `custom-element-tag-naming-convention` research topic via `relatedReport` rather than
opening a new survey — no greenfield design here. The one new platform fact (a custom-element constructor
can't be registered under two tag names) is grounded against the spec below; everything else is a
concrete-refs check over the real FUI/WE trees.

## What is already ratified / shipped (read this first)

This is **not** a cold call — three upstream rulings have already settled most of it:

- **#822** — the custom-element surface is a **WE-owned contract; FUI conforms** (impl-is-not-a-standard +
  the #463 polyglot vision). The portability guarantee: a static-HTML doc using `<we-pagination>` must work
  across any conforming impl.
- **#841** ratified the value: WE's tag = derivable `<prefix>-<id>`, prefix `we-`, and a
  **parameterized-registration invariant**: *"the impl registers `registerX(tag = <contract-default>)`; the
  gate (#844) validates the **default arg equals the spec** and that no element hard-codes a literal; a
  consumer override is allowed."* Fork 2A's text: **FUI's 7 names migrate to conform.** That invariant **is
  Option A below** — so the recommended path re-affirms #841 rather than breaking new ground.
- **#843** (resolved) shipped the WE spec values: `we:custom-elements.json` now declares `we-autocomplete`,
  `we-background-task-surface`, `we-data-table`, `we-pagination`, `we-route-view`, `we-route-outlet`,
  `we-transient-component` ([we:src/_data/blocks/autocomplete.json:49](src/_data/blocks/autocomplete.json#L49)
  `"element": true`; [we:src/_data/blocks/router.json:119-122](src/_data/blocks/router.json#L119-L122) the
  N-tag list; [we:scripts/gen-cem.mjs:161](scripts/gen-cem.mjs#L161) `TAG_PREFIX = 'we-'`). Its closing note:
  *"pretty legacy names (`page-nav`, `auto-heading`) are consumer overrides, not WE-contract values."*

So the **WE-contract value side is closed** (`we-*`). What #908 decides is purely the **FUI registration
posture** that the new #844 cross-binding will enforce — i.e. whether #841's "default arg == spec" stands
FUI-side, or is reversed to preserve FUI's ergonomic names.

## Axis-framing — what the real tree forces

FUI today registers its **pretty** names as defaults, none of which equal the `we-*` spec:

- **2 already parameterized** (the #841 target shape):
  `registerPagination(tag = 'page-nav')` ([fui:blocks/renderers/pagination/PaginationBehavior.ts:174](../../frontierui/blocks/renderers/pagination/PaginationBehavior.ts#L174)),
  `registerDataTable(tag = 'data-table')` ([fui:blocks/renderers/data-table/DataTableBehavior.ts:102](../../frontierui/blocks/renderers/data-table/DataTableBehavior.ts#L102)).
- **5 hard-coded literals** (#841 flags these as drift): `customElements.define('auto-complete', …)`
  ([fui:blocks/droplist/AutoComplete.ts:444](../../frontierui/blocks/droplist/AutoComplete.ts#L444)),
  `'route-view'` + `'route-outlet'`
  ([fui:blocks/router/registerRouter.ts:33-36](../../frontierui/blocks/router/registerRouter.ts#L33-L36)),
  `'auto-heading'` ([fui:blocks/transient/registerTransient.ts:23](../../frontierui/blocks/transient/registerTransient.ts#L23)),
  `'background-tasks'` ([fui:blocks/background-task-surface/registerBackgroundTasks.ts:23](../../frontierui/blocks/background-task-surface/registerBackgroundTasks.ts#L23)).
  Their doc-comments already document an *intended* custom-tag hatch (`app-view`, `app-tasks`) that was never
  wired ([we:registerRouter.ts:27](../../frontierui/blocks/router/registerRouter.ts#L27),
  [fui:registerBackgroundTasks.ts:18](../../frontierui/blocks/background-task-surface/registerBackgroundTasks.ts#L18)).

**The gate this extends is FUI-internal, not yet WE-bound.** #783 Check-2
([fui:scripts/check-standards.mjs:149-184](../../frontierui/scripts/check-standards.mjs#L149-L184)) validates
every on-disk `define()` name against FUI's **own** `fui:blocks.json registeredNames` (`route-view`,
`auto-complete`, … are all declared there — [fui:src/_data/blocks.json:42-134](../../frontierui/src/_data/blocks.json#L42-L134)).
Its own comment: *"checks its own tree, not the portable WE standard."* So #844 introduces a **brand-new
cross-binding** — FUI register-default ⇒ WE-spec `tagName` — that does not exist today. #908 decides the shape
of that new binding.

**Why C (no binding) is rejected, not a branch.** "Drop the default==spec check; gate only that no element is
unregistered" guts the #822 ratified ruling (WE owns the tag; FUI conforms) and the portability guarantee
(`<we-pagination>` would not resolve out-of-box on FUI). It contradicts a stable upstream ruling, so it is
the **named-broken** floor in the fork below, not a coherent option.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — FUI registration posture | **A — FUI default arg migrates to `we-*`** (re-affirms #841); pretty names live on as consumer overrides (incl. FUI's own demos); hard-coded literals → parameterized `register*(tag = 'we-…')` | B — keep pretty as canonical default, gate only requires `we-*` be co-registered as an **alias** (a partial reversal of #841) | ~80% |

## Fork 1 — FUI registration posture: migrate the default to `we-*` (A) vs keep pretty + we- alias (B)

*Fork-existence (case b, genuine either/or):* the #844 gate has exactly **one** rule for what FUI's
registration must satisfy — it either asserts *the register default arg equals the WE spec* (A, so the shipped
default is `we-pagination` and `page-nav` is something a consumer passes) **or** asserts *the we- tag is merely
present alongside FUI's own default* (B, so `page-nav` stays the shipped default and `we-pagination` is a
co-registered alias). Both yield a system where `<we-pagination>` resolves; they cannot both be the gate's
assertion. (The third listed option C — no spec binding — is **broken**: see axis-framing; it voids #822.)

- **A — FUI default arg migrates to `we-*` (recommended).** The 5 hard-coded literals become
  `register*(tag = 'we-…')` and the 2 parameterized defaults flip (`'page-nav'` → `'we-pagination'`,
  `'data-table'` → `'we-data-table'`). The gate asserts **default arg == WE-spec `tagName`** and flags any
  hard-coded literal. FUI's nice names are **not lost** — they survive exactly as #843 framed them: a
  *consumer override* passed at the use-site, and FUI's own demos may call `registerPagination('page-nav')`
  if they prefer it. This is a literal restatement of #841's parameterized-registration invariant.
  *Pro:* single source of truth, derivable (a .NET/Java forward-adapter regenerates the tag — #463/#505/#507),
  out-of-box portability of `<we-*>` across impls, no reversal. *Con:* FUI's shipped default reads less pretty
  (`we-autocomplete` vs `auto-complete`); a real (small) migration — 5 literals → parameterized, plus
  demo/test updates.
- **B — keep pretty as default, we- as co-registered alias.** FUI keeps `registerPagination(tag = 'page-nav')`
  as its shipped default; the gate is re-scoped to only require that `we-pagination` is **also** registered.
  *Pro:* preserves FUI's ergonomic out-of-box names; no default churn. *Con:* (1) it **reverses** #841's
  ratified "default arg == spec" invariant for marginal gain; (2) it is the *more* costly option at runtime —
  a custom-element **constructor cannot be registered under two tag names** (the spec's `define()` throws
  `NotSupportedError` if the registry already holds an entry for that constructor; MDN confirms), so a
  same-element alias requires a throwaway subclass per element (`class WePagination extends PaginationElement
  {}`) plus a second `define()` — 7 subclasses + double the live element definitions, vs A's one-string-change
  per site; (3) two live tags for one component is a confusing public surface.

**Recommended default: A (FUI default migrates to `we-*`; pretty names demote to consumer overrides).**
Confidence **~80%**. This re-affirms #841 rather than reversing it; per *ratified-decisions-are-reversible*,
B is on the table as a genuine reversal candidate but the case for it does not hold — it costs **more**
(subclass-alias tax) for a benefit (pretty out-of-box names) that A already preserves via the override hatch.
Residual: the FUI migration churn (5 literals → parameterized + demo/test updates) and whether FUI's
demos/site want pretty names so universally that a `we-*` default reads as friction — a DX preference, not a
contract flaw, and addressable by FUI overriding in its own demos.

**Red-team note for the deciding agent.** B's advocate argues: `we-autocomplete`/`we-background-task-surface`
are genuinely worse names than FUI's hand-picked `auto-complete`/`background-tasks`, and forcing them as the
shipped default just to satisfy a gate is the tail wagging the dog — let the gate check an alias and keep the
nice default. The default holds because (a) A doesn't delete the nice names, it relocates them to the
override layer #843 already defined; (b) B is strictly more code/runtime weight (the constructor-aliasing
constraint), not less; (c) B reverses a stable ruling (#841) — the higher reversal bar for standards isn't
cleared by a naming-aesthetics argument. If the decider still prefers B, record it as **"supersedes #841's
parameterized-registration invariant because …"** with explicit lineage, and re-scope #844 to the alias check.

## Supported by default (not decisions)

- **Pretty names persist as the consumer-override layer (ratified by #843, not re-litigated here).** Under A,
  `page-nav`/`auto-heading`/`route-view`/etc. remain valid tags any use-site (JSX/scoped-registry, MaaS
  per-tenant, project config, *and FUI's own demos*) can pass at registration — `registerPagination('page-nav')`.
  The gate allows a consumer-supplied override and never flags it (#841 invariant, #844's "override is not a
  failure" clause).
- **The migration is FUI-side and already scoped by #844.** #844 already specifies the mechanical work
  (5 literals → `register*(tag = 'we-…')`; default arg == spec; attributes out of scope). #908 only ratifies
  the *posture*; the build is #844 (locus: frontierui).
- **Prefix configurability is untouched (#841 Config-Extends-Platform-Default).** A design-system project may
  still override the `we-` prefix to `acme-`; that's the #841 platform-config dimension, orthogonal to this
  posture call.

---

## Context

- **Home for the ruling:** restate the posture in the #844 gate spec (FUI-side) and cross-link from
  [we:docs/agent/conventions.md](docs/agent/conventions.md) where #841's tag-naming clause lives. No new WE
  artifact — #908 ratifies the FUI conformance posture, not a new standard.
- **Direct downstream (unblocked by this call):**
  [#844](/backlog/844-fui-conformance-gate-extend-783-check-2-so-every-fui-define-/)
  (`blockedBy: [908]`) — under A, build it as written (default arg == spec, flag literals); under B, re-scope
  it to the alias check before building.
- **Lineage:** A **re-affirms** #841's parameterized-registration invariant and #843's "pretty names are
  overrides" framing. B would be a **reversal** of #841 — record with lineage if chosen.
- **Conformance direction:** the gate is *FUI conforms to WE* (#463 standard→impl), extending #783 Check-2;
  not WE mirroring FUI.

## Resolution — ratified 2026-06-18 (Fork 1 → A)

FUI's register default arg migrates to the `we-*` spec `tagName`; pretty names (`page-nav`, `auto-heading`)
live on as consumer overrides; the 5 hard-coded literals become parameterized `register*(tag = 'we-…')`.
**This is a confirmation, not a new call:** A is a verbatim re-affirmation of the already-ratified #841
parameterized-registration invariant and #843's "pretty names are overrides" framing, and it is exactly what
the codified [`we:#tagname-naming`](../docs/agent/platform-decisions.md#tagname-naming) rule states; the only
coherent alternative (B) is a partial reversal of #841, and C is spec-broken (a custom-element constructor
can't register under two tag names without throwaway subclasses). Ratified under the standing authorization to
resolve non-critical, movable, rule-confirmed calls (posture is 0.0.0-unpublished — cheap to move). Unblocks
the #844 gate (build it as written: default arg == spec, flag literals). The FUI-side migration is downstream
build work, not a residual of this decision.
