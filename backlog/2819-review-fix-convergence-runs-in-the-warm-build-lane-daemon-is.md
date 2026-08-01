---
bornAs: xmhvbvx
kind: story
size: 8
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [plateau-loop, conveyor, review, convergence, daemon, quality, slice-uifg-adjacent]
---

# Review-fix convergence runs in the warm build lane; daemon is the independent backstop

Move the review→fix convergence into the **still-active build lane** (pre-PR, warm context) and shrink the
daemon to the one job only it can do — the independent clear + centralized land. A `/slice` candidate.

## Diagnosis (why this is needed)
The UI-Fidelity foundation PRs ([#2805]/[#2802], PRs #951/#952) both came back **ACCEPT-WITH-NITS**. Tracing
every nit gave **two root causes**, neither of which is sloppy building:
1. **Under-specified build brief.** The build agents built faithfully to spec. Where the brief said "reject
   fixture routes," the agent wrote a reasonable-but-narrow regex (so `__fixtures` slips); where it said
   "unit-test both ways," the agent tested the function but not the gate wiring; and "closes the data-layer
   dodge" was the *slice title*, which the agent echoed as an overclaim. The nits are the brief's gaps,
   reproduced.
2. **No adversarial review before PR-open.** Each agent self-reviewed (its own tests pass) but never ran an
   adversarial pass on its own diff, so nits were caught **post-hoc** (by the independent review) instead of
   **pre-PR**.

## The design
**Split the review by role, and put the fix loop where the context is warm.**

- **Build lane (conveyor) — the QUALITY / fix review, pre-PR, lane STILL ACTIVE.** After building, the lane
  runs an adversarial self-review on its own diff and **converges fixes in place** (build → self-review → fix →
  re-review), releasing the lane **only when the PR is clean**. This is efficient precisely because the lane is
  warm: the full build context is loaded, so fixing a nit is cheap. It is **non-clearing** — an agent may not
  clear its own diff ([#2439]), so this pass fixes, it does not accept.
- **Daemon — the INDEPENDENCE / clear + land backstop.** The daemon keeps the job the build lane *cannot* do:
  the independent clearance (a distinct actor from the builder) and the centralized merge-lease + land. It gets
  **lighter** — most nits are already fixed upstream — not removed.

Keeping the lane active through convergence is the enabler. Tearing the lane down at PR-open (today's behavior)
is what forces the cold path: the daemon reviews after the lane is gone and can only bounce `review:changes`
back to a **fresh author lane** that must re-clone and re-understand everything. Relocating the fix loop into
the warm lane removes that re-spawn — and **fixes [#2563]**: the convergence loop belongs in the lane, not in
the daemon (which by design cannot spawn the agents to run it).

## Build-brief discipline (closes root cause 1)
Every delegated build brief must: name the **edge-cases** to handle/reject, require **integration/wiring
tests** (not only unit), and **forbid overclaiming** scope language (no "closes X" unless the slice closes X
end-to-end).

## Open sub-point (recommend a default, ratify later)
Is the build-lane self-review **always-on** or **care-level-scaled**? Recommended default: a **light always-on**
pass (cheap), with **depth scaled by care-level** ([#2567]) — heavier convergence on blast-radius/size items,
minimal on leaf edits. Mirrors the escalation rubric so effort tracks risk.

## Relation
Fixes [#2563] (advisory care-level / convergence). Reuses the convergence loop [#2437], the independence rule
[#2439], and build-time self-review [#2672]. Complements the per-step transparency item (surfacing the
convergence rounds this loop produces).

## Acceptance
A delegated build converges its own review fixes in the warm lane before the PR opens (lane released only when
clean); the daemon performs only the independent clear + land; and a build brief that omits edge-cases,
integration tests, or that overclaims scope is caught. `plateau-app` `npm test` + `we:` `check:standards` pass.
