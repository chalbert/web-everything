---
type: decision
workItem: story
size: 5
status: open
blockedBy: ["141"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-deployed-live-patch-safety.md
crossRef: { url: /backlog/141-dev-browser-vision/, label: "Dev-browser vision (#141, Fork 2)" }
tags: [dev-browser, fix-loop, live-patch, safety, deployed-app, autonomy, conformance]
---

# Dev-browser deployed-app live-patch — gated capability & safety design

## Digest

The dev-browser fix-loop ([#141](141-dev-browser-vision.md)) ships v1 as report → propose →
**local-session** live-verify → open-PR, and **carved out** live-patching a _deployed_ app — the single
riskiest capability — for its own safety design. **No design existed yet**; this prep surveyed the
established practice and published the [`deployed-live-patch-safety`](/research/deployed-live-patch-safety/)
research topic. **4 forks**, one per safety concern #141 named (isolation · authorization · revertibility ·
audit), each with a **bold** default. The survey **reframes** the capability (see Fork 1), dissolving most
of the risk. Ratification, not research.

## Axis-framing

#141 named the four concerns this item must answer and spun it out
([#141 Fork 2 resolution](141-dev-browser-vision.md)). The machinery this builds on already exists in the
tree: the conformance-autofix engine ([scripts/conformance-autofix.mjs:3](../scripts/conformance-autofix.mjs#L3))
with its **verify gate** — apply → re-run → keep only if the failure cleared with no new error, else revert
([scripts/autofix/engine.mjs:15](../scripts/autofix/engine.mjs#L15)) — bounded
([engine.mjs:242](../scripts/autofix/engine.mjs#L242)) and with a human-review `decide` hook that reverts a
gate-passing patch before it lands ([engine.mjs:247](../scripts/autofix/engine.mjs#L247)); and the
introspectable [capability matrix](../src/_data/capabilityMatrix.json#L1) the audit record can ride. v1
already settled the local-session loop; **this item is _only_ the deployed-app delta** along four
orthogonal axes:

1. **Isolation** — does a "deployed live-patch" mutate the deployed artifact at all, or patch only the
   live _view_ in the authorized session?
2. **Authorization** — who may invoke it, and how is elevated, time-boxed consent captured?
3. **Lifetime / revertibility** — how does a patch end (the item's stated "session-only revertibility")?
4. **Audit** — what is recorded, where, reusing which substrate?

The crux is that "live-patch a deployed app" has a catastrophic reading (mutate the running fleet) and a
nearly-free one (a client-side session overlay) — and the dev browser, which already controls the
rendering surface via CDP, is uniquely able to choose the safe one.

## Architectural classification (per-fork pass)

| Question | Answer |
|---|---|
| Which layer? | **Product capability** of the dev browser (constellation product layer, #141 Fork 4) — _not_ a standard intent/block/plug/adapter |
| New protocol / intent? | **No** — uses CDP/Local-Overrides browser mechanism; reuses the app's trace self-description as the only standard surface (audit sink) |
| Expose the whole axis? | **Yes** — authorization rigor + patch lifetime are **per-app policy dials**, not hardcoded |
| Fixed mechanic or dimension? | Isolation **default fixed** to overlay; authorization/lifetime are policy **dimensions**; server-side mutation is a **deferred** end-state, kept separate |
| Most-permissive default? | **Inverted** — this is a safety guardrail, so default = **most-restrictive-safe**; more capability is the explicit opt-in |
| Bias toward separation? | **Honoured** — client-side overlay (this item) vs server-side mutation (deferred) stay separate capabilities |
| The one real seam | **local-session patch** (v1, #141) → **deployed-view overlay** (this item) → **deployed-state mutation** (future, gated) |

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Isolation model | **Client-side session overlay (Local-Overrides model) — deployed artifact never mutated** | Server-side canary/shadow | High |
| 2 · Authorization | **Break-glass JIT elevation, per-app-policy-capped, per-patch, expiring** | Two-party approval (as a policy dial) | Med-high |
| 3 · Lifetime / revertibility | **Session-scoped, persists across reloads, hard TTL + kill switch** | Sticky until PR resolves | High |
| 4 · Audit trail | **Emit to the app's trace substrate (+ attach to PR)** | Standalone dev-browser log | High |

---

## Fork 1 — Isolation model (the central fork)

**Crux.** Does "live-patch a deployed app" mutate the deployed artifact at all? The dev browser already
controls the rendering surface via CDP, and the web platform has an exact precedent for a session-scoped,
server-untouched patch: **Chrome DevTools "Local Overrides"** serve a locally-modified copy of a site's
files _only within the viewer's own session_, server unchanged, active only while the session runs.

- **(A — recommended) Client-side session overlay.** The patch applies only in the authorized viewer's
  browser session against the rendered deployed app (Local-Overrides / CDP runtime override). The deployed
  artifact and server are **never mutated**; blast radius = one session; revert = end the session. Delivers
  the demo value #141 wants ("the user sees the fix working before anyone commits") with almost none of the
  deployed-mutation risk — the PR stays the only path to a real change.
- **(B) Server-side canary / shadow.** Patch an isolated canary instance or shadow traffic, never the live
  fleet. Real server mutation but contained — needs deploy infra the dev browser doesn't own. The main
  alternative _if_ a use-case genuinely requires server-side state; defer as a later capability.
- **(C) Live-fleet hot-patch.** Mutate the running deployed process (kpatch/Ksplice/Erlang-style). Maximum
  capability, maximum risk — and **kpatch can't even revert without a reboot**. _Rejected_ (catastrophic
  blast radius, reversibility not guaranteed).

**Default: A (client-side session overlay).** It reframes the capability from "mutate the deployed app" to
"patch the live _view_ of the deployed app, locally and ephemerally," designing most of the risk out rather
than guarding it. _Rejected: C._ _Deferred: B_ (a separate, further-gated capability — bias toward
separation).

## Fork 2 — Authorization & elevation

**Crux.** Invoking a patch against a _deployed_ app is a strictly higher privilege than the v1 local-session
patch — who may, and how is consent captured? Prior art is the **break-glass + just-in-time** pattern: an
emergency path that alerts + requires lead authorization + post-review, recording who/why/expiry (standing
access is itself an audit finding), with two-party approval for high-risk.

- **(A — recommended) Break-glass JIT elevation, policy-capped, per-patch, expiring.** A deployed
  live-patch requires an explicit, time-boxed elevation: the **app policy declares who may authorize**, each
  invocation is **per-patch confirmed**, the grant **expires** (no standing access), and it raises an alert.
  Mirrors #141 Fork 2's sub-decision ("per-app policy can cap the level a user/profile may select").
- **(B) Any authenticated developer.** Too permissive — standing access is a finding; removes the gate the
  moat depends on. _Rejected._
- **(C) Mandatory two-party approval.** A second authorizer approves before apply. Right for higher-risk
  orgs — **exposed as a policy dial** on top of A, not a fixed universal mechanic (most-flexible).

**Default: A, with C available as a policy dial.** The authorization bar **scales with Fork 1**: an overlay
is a lighter elevation than server-side mutation. _Rejected: B._
_Sub-decision:_ does the policy live per-app, per-user-profile, or per-org? Default: **per-app policy caps**
what a profile may request.

## Fork 3 — Lifetime & revertibility

**Crux.** How does a patch end? The item's own framing is "session-only revertibility." Local Overrides is
the model: persists across reloads _within_ the live session, evaporates when it closes.

- **(A — recommended) Session-scoped, persists across reloads, hard TTL + kill switch.** The patch survives
  reloads within the authorized session (so the fix stays provable while navigating), auto-reverts on
  session end, carries a **hard TTL** so a forgotten session can't keep it live, and a **feature-flag-style
  kill switch** for instant in-session revert.
- **(B) Ephemeral per-action.** Gone on every reload; must be re-applied. Safest but breaks the
  "navigate and watch the fix hold" demo. Over-restrictive.
- **(C) Sticky until the PR merges/dismisses.** A patch that outlives the session is **indistinguishable
  from a deploy** — which is exactly what the PR is for. _Rejected._

**Default: A.** Matches Local Overrides' real behaviour plus a TTL and kill switch. _Rejected: C_; _B_ too
strict.

## Fork 4 — Audit trail

**Crux.** What is recorded, where, and reusing which substrate? SOC2 requires at minimum **user · action ·
timestamp · affected resource** + justification; break-glass needs detailed logs + retroactive
approval/justification.

- **(A — recommended) Emit to the app's introspectable trace substrate, and attach to the PR.** The
  deployed live-patch writes an audit record into the **same self-description/trace machinery the dev
  browser already reads** (native-first — the app is introspectable by premise): who · action · timestamp ·
  affected resource · justification · the patch diff · before/after evidence (trace/test) · revert. When a
  PR is opened, the same record rides along (the evidence loop #141 already describes).
- **(B) Standalone local audit log in the dev browser.** Simpler but **siloed** — invisible to the app's
  own observability, not portable to the team. _Fallback only_ when no substrate hook exists.
- **(C) Audit rides the PR only.** Misses patches applied-and-reverted that never become a PR. _Rejected_
  as the sole record.

**Default: A (+ PR attachment).** Reuses existing machinery, no new sink, no new lock-in. _Rejected: C
alone; B alone._

---

## Build follow-through (once ratified)

Sequenced after the v1 fix-loop and dev browser exist (the `blockedBy: 141` chain): (1) generalize the
autofix verify-gate engine to apply via a **CDP/Local-Overrides session overlay** rather than the
filesystem; (2) add the **break-glass elevation gate** reading a per-app policy; (3) wire **TTL + kill
switch + session-end auto-revert**; (4) emit the audit record to the app's trace substrate and onto the
PR. Server-side mutation (Fork 1-B) is **not** in scope — it earns its way in later as its own gated
capability.
