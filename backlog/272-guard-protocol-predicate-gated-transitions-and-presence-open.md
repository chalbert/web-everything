---
type: decision
workItem: story
size: 8
status: resolved
codifiedIn: docs/agent/platform-decisions.md#guard-gate
dateOpened: "2026-06-10"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: []
---

# Guard protocol — predicate-gated transitions and presence (open member family)

An open protocol for guarding a region's lifecycle against a predicate, resolved through a pluggable policy provider. Three tiers: the Guard protocol (region + transition/presence + predicate + provider seam + deny-outcome, surface-agnostic), a shared guard provider (default platform provider, project-overridable, custom-pluggable; enforcement is server-/platform-side, never in the intent), and members grouped by interaction surface — routing entry/exit guards, a rendering access gate (render-or-hide), open for future kinds (action-confirm, edit/read-only, concurrency-lock). Generalises the exit case (#129) and the access-control case (#178); the only lock is the provider contract.

Settled in the #129 discussion (2026-06-10). #129 started as a "navigation guard" intent; talking it through showed the real abstraction is broader than navigation, and that the access-control item #178 is its mirror — so both collapse onto one open protocol rather than each redefining the same machinery.

## The three tiers

1. **Guard protocol** (the only lock — surface-agnostic). A guard = *a predicate attached to a region, evaluated at a lifecycle event of that region, whose deny-branch resolves to a member-specific outcome.* The region is scale-invariant: the document is the outermost region; a route, a modal, a panel, an element are inner regions. The protocol fixes the contract (region + event + predicate + provider seam + deny-outcome) and nothing about the mechanism.
2. **Guard provider** (the shared implementation seam). The predicate/policy is resolved by a **provider**, never baked into the member: a **default platform provider** ships (native-first), the **project selects/overrides** it (config-extends-platform-default), and **custom providers are pluggable**. Swap one policy engine for another (e.g. an authz engine like CASL/OpenFGA, or a dirty-state tracker) and the member is untouched — the provider contract is the single invariant. **Enforcement is elsewhere**: server-side authorization for access, and the cancelable browser primitives (`beforeunload`, Navigation API `intercept`, `dialog` `cancel`) for teardown — all behind the provider, never in the member intent (intents are UX-only; technical → configurator/provider).
3. **Members, grouped by interaction surface** (each with apt, surface-specific vocabulary — prior art splits these terms deliberately):
   - **Routing** → **Guards** (gate a *transition*; Angular `CanActivate`/`CanDeactivate`, Vue enter/leave, NestJS):
     - **Entry guard** — *may I activate/enter this region?* Predicate = authorization/precondition. Deny-outcome enum: `hide | redirect | forbid (403) | cloak (404)` (the 403-vs-404 choice is a security call — whether to reveal the resource exists). This is the routing face of **#178**.
     - **Exit guard** — *may I tear this region down?* Predicate = loss-of-state. Deny-outcome = user-mediated **confirm** (stay/discard). This is **#129 → #273**.
   - **Rendering** → a **Gate** (gate *presence*; React `SignInGate`, Laravel Gates): an **access gate** that renders-or-hides an element on the same predicate. The CASL `<Can>` element-level case. Shares the access provider with the entry guard, so #178 spans both an entry guard (routing) and an access gate (rendering) off one authz provider.
   - **Future kinds** (the protocol stays open — do not fix the member list): action-confirm guard (destructive actions), edit/read-only guard, concurrency-lock guard, step/transition guard, validity guard.

## Key design points carried from the discussion

- **The guard hooks the cancelable *trigger*, not the removal.** Raw DOM removal / `disconnectedCallback` isn't cancelable; the guard must intercept the *intentful dismissal action* (close button, route change, `beforeunload`). Anything that imperatively rips content out without a guardable trigger can't be caught — state this boundary in the contract.
- **Deny-outcome families diverge per member** (confirm-dialog vs hide/redirect/forbid/cloak), which is exactly why these are *sibling members over one protocol*, not one merged intent.
- **#178 already converged independently** on this shape — "authorities" + denial strategies (ignore/block/redirect/error/retry) + an explicit trust boundary (back-end authoritative; front-end is a UX mirror). The protocol generalises #178's strategy enum and trust boundary as the provider seam + deny-outcome.

## Scope to design (via [we:design-first.md](../docs/agent/design-first.md) / [new-standard](../.claude/skills/new-standard/SKILL.md))

- **Is the umbrella a `protocol`** (likely — "the only lock is the protocol/provider contract" fits Protocol-is-first-class), and are members **intents** that reference it? Define the provider interface (the seam) term-first before any JSON.
- Confirm the rendering member's name lands on **Gate** vs **Guard** (prior art: Guard = transition, Gate = presence). Lock the entry-deny enum (`hide | redirect | forbid | cloak`) and flag the 404-cloak existence-hiding case.
- How does a member declare its provider choice (default → project override → custom), reusing the project-config / flavor mechanism? Cross-check the provider pattern against anchor-positioning-strategy-provider (#149).
- Browser-standard grounding: Navigation API `navigate`/`intercept`, `beforeunload`, `History`/`popstate`, `dialog` `cancel`; for access there is no native authz primitive, so the provider contract carries it.

## Decision (2026-06-11)

**Ruling: protocolize only the provider+predicate seam; do *not* unify deny-outcomes.** The
load-bearing, reusable contract is *"a predicate/policy, attached to a region, resolved by a
swappable provider (default platform → project override → custom plug), evaluated at a region
lifecycle event."* That is the single lock and the only thing the Protocol fixes. The
deny-outcome half does **not** generalise — exit-guard's user-mediated `confirm` and access's
`hide | redirect | forbid | cloak` sit side by side, they don't merge — so **each member owns its
own deny-outcome family**. This is a deliberately weaker claim than this item's original body
("one open protocol over region+event+predicate+provider+deny-outcome"): the unification is real at
the provider seam and coincidental at the deny branch.

Three sub-questions are therefore **left open for the authoring task** (not pre-settled here),
because the ruling reframes them:

1. **Does the rendering "Gate" exist as a distinct member, or dissolve into conditional rendering
   bound to the authz provider?** An access gate that renders-or-hides on a predicate may just be
   "any visibility-bearing construct reads the same provider" — not a separate intent. Decide during
   authoring.
2. **The `forbid`(403)/`cloak`(404) deny enum likely belongs *behind the provider*, not in the
   member intent** — it's a server/security decision and intents are UX-only
  . Resolve where the enum lives when defining the
   provider contract.
3. **#149's provider shape under-specs the authz case.** Anchor-positioning is pure client-side
   strategy; an authz provider crosses a trust boundary (async, server round-trip, revocable,
   cacheable). Same pattern *name*, materially different *contract* — the authz provider needs its
   own treatment, not a verbatim reuse.

Graduates to a follow-up authoring task (the protocol itself is not yet authored). #273 (exit guard)
and #178 (access) become member intents against the provider+predicate protocol once it's authored.

## Members & consumers (DAG)

- **#273** exit guard intent (routing leave) — blocked by this.
- **#178** access control — the entry guard (routing) + access gate (rendering) member; references this protocol.
- Consumers: Background Task `navigationGuard` dimension (#113), Form block (#177), and any region with unsaved/in-flight state or authorization.
