---
name: feedback-composability-probe-strip-effort-loop
description: "dissolving an effort-fork — the composability probe (\"prove cannot-coexist by failing to compose, never assert\"), nature-test downsides, disprove \"no consumer\", and the strip-effort loop"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4f230718-1586-416b-a41d-ac8b0d1b0285
---

The codified fork-existence (#088) + not-a-prioritization (#465) rules can *still* pass an effort tradeoff
dressed as a merit fork (the #1457 prep did). Apply these screens hard, in prep AND at the call:

1. **Composability probe (before accepting "branches cannot coexist").** Try to build one branch as a
   *facade over a shared kernel* the other also exposes (#756 factory). If both can be facades over one
   kernel — e.g. a behavior kernel surfaced as *both* an attribute spelling AND a persistent `we-`/CEM
   element — they coexist ⇒ **support-both, not a fork**. "Cannot coexist" is proven by *failing to
   compose*, never asserted.
2. **Nature-test every downside, not keywords.** Re-express each per-branch con as a named **merit** axis
   (correctness/a11y/UX/lock-in/composability) OR a **cost** (maintenance/drift/sequencing/"keep in sync").
   Cost ⇒ strip it. Catches effort that dodges the tell-list: *"reintroduces a drift surface the other
   avoids"*, *"avoids the maintenance of B"* are cost wearing merit's clothes — "avoids the cost of the
   alternative" is a prioritization argument.
3. **Disprove "no consumer", never assert it.** Search the platform's *ratified goals* for the consumer
   first (#1457: a no-element block has no CEM ⇒ the polyglot framework-flavor generator #463/#855 *was*
   the consumer, in plain sight).
4. **Strip-effort loop, run until clear.** Imagine both branches free to build & instantly maintained —
   does a *merit* difference remain? None ⇒ dissolve to support-both + a separately-prioritized build.
   Repeat until what's left is {forced invariant · genuine merit either/or · support-both}.

**Why:** lets a fork ratify on merit (correct end-state), keeping effort as pure prioritization. **How to
apply:** codified in `docs/agent/backlog-workflow.md` fork-existence test (L350) + not-a-prioritization
(L352) + at-prep justification (L365); `check:health` G4 tells broadened (no-consumer-need / avoids-cost /
keep-in-sync). Surfaced on #1457 (stepper/deck/tabs packaging) — user drove the dissolution. Relates to
[[feedback_fork_not_a_prioritization_tool]], [[feedback_support_all_coherent_fork_existence_test]],
[[feedback_never_take_unprepared_decision]], [[feedback_bias_separation_decoupling]].
