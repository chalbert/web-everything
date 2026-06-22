---
kind: decision
size: 3
status: open
preparedDate: "2026-06-22"
dateOpened: "2026-06-18"
locus: webeverything
relatedProject: webdocs
relatedItem: "934"
tags: [intents, conformance, traits]
---

# What does navigation-intent reconciliation mean without a runtime conformance gate

Carved out of #934 (could-not-split slice g): what would it mean to "reconcile the navigation intent
meaningfully" at runtime, given WE has no runtime conformance gate?

## Grounding digest

- WE's intent→conformance is **build-time only** — [`we:webtraits/intentProfileResolver.ts`](../webtraits/intentProfileResolver.ts)
  resolves an `IntentProfile` at build time and is pure/side-effect-free; there is **no runtime
  conformance gate** anywhere.
- So a literal "reconcile at runtime" would either (i) **fake a tie/agreement** — forbidden (WE never
  fakes conformance) — or (ii) silently expand into **building a whole runtime intent-conformance gate**
  (a separate epic).
- **#934 is now resolved** ([#934](/backlog/934-we-docs-chrome-composes-real-we-traits-instead-of-hand-rolle/)) —
  its done-when was met *without* navigation-intent reconciliation, which empirically confirms the
  descope: the chrome composed real traits and shipped, and reconcile was never needed.
- No new `/research/` topic — this rules a scope/semantic call against the real resolver + #934's
  outcome, prior-art-settled.

## Axis framing — three meanings of "reconcile," only one is in dispute

"Reconcile the navigation intent" silently bundles three different things, and the fork only excludes one:
(1) **intent→conformance reconciliation** — check the declared intent against a runtime conformance
result; impossible without a gate, forbidden to fake — *this* is what gets descoped; (2) **conflicting
nav-intent reconciliation** — coordinate two sources both asserting a nav role at runtime (host + embedded
chrome), which is *not* conformance-checking and is a legitimate coordinator concern; (3) **read-only
profile surfacing** — expose the build-time `IntentProfile` at runtime as inert diagnostics, a weak-but-
honest meaning with near-zero cost. The default descopes (1) from #934; the skeptic's amendment forces (2)
and (3) to be explicitly dispositioned rather than silently swept away with (1).

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| **Fork 1** — meaning of runtime nav-intent reconcile in #934 | **(a) rule intent→conformance reconcile OUT of #934's scope** (faking a tie is forbidden; #934 resolved without it), + disposition the two siblings it does *not* cover | (b) build a runtime intent-conformance gate now — excluded: a separate epic #934's done-when never required | **high** — #934 already resolved without it |

## Fork 1 — what runtime nav-intent reconciliation means here

**Fork-existence justification:** forced invariant — branch (b) "build a runtime conformance gate to give
reconcile a meaning" is the *excluded* branch: it is a separate epic, #934's done-when does not require it
(and #934 has now resolved without it), so smuggling it into #934 is silent scope-expansion. The only
honest runtime alternative — faking a tie — is forbidden. So this is a **ratify descope**, with the
substantive prep being the disposition of the two adjacent meanings the descope must not also kill.

**Crux:** "reconcile" has no honest *conformance* meaning without a runtime gate, and faking one is
forbidden — but two *non-conformance* meanings (conflict-coordination, read-only surfacing) do exist and
must be routed, not buried.

**Options:**

- **(a) Rule intent→conformance reconcile out of #934's scope** *(recommended default)* — "reconcile" as
  *conformance* has no honest meaning without a runtime gate, faking one is forbidden, and #934's done-when
  never required it (confirmed: #934 resolved without it). Descope it; if a runtime gate is ever wanted,
  file it as **its own future epic**, don't expand #934. **Amendment (skeptic) — disposition the two
  siblings:** (2) runtime reconciliation of *conflicting* nav-intent sources → confirm it is absorbed by
  the resolved horizontal-menu **coordinator** trait ([#943](/backlog/943-build-the-horizontal-menu-coordinator-trait/)) or file a card; (3) read-only runtime
  surfacing of the build-time profile as inert diagnostics → file a cheap card. **Foreclosure-guard:**
  name the future runtime-gate epic # in #934's done-when note so descope reads as *deferred*, not *denied*.
- **(b) Build the runtime intent-conformance gate now** — *Rejected (out of scope).* A separate epic;
  valuable, but #934 neither requires nor waits on it. Pursue as its own item if appetite arises, never as
  hidden #934 scope.

**Recommended default: (a) descope, with the sibling-disposition + foreclosure-guard amendment.**

**Skeptic:** SURVIVES-WITH-AMENDMENT → the descope is right but **over-claimed**: "reconcile" was treated
as ≡ "conformance gate," which silently kills two legitimate non-conformance meanings. **Amendment folded
in:** (a) is scoped to intent→*conformance* reconcile only; (2) conflicting-source reconciliation is
dispositioned to [#943](/backlog/943-build-the-horizontal-menu-coordinator-trait/)'s coordinator (confirm-absorbed or file), and (3) read-only profile surfacing is filed
as a cheap diagnostics card; plus a foreclosure-guard naming the future runtime-gate epic so the descope is
*deferred*, not *denied*. The "faking a tie is forbidden" premise survives — it only forecloses meaning (1),
which is exactly what's descoped.
