---
name: feedback_migration_carve_recoverable_vs_lossy
description: "migrating to a component that can't yet represent X — carve recoverable (additive capability + hard blockedBy child) vs lossy flatten;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ebcc2e0b-2733-4d42-b34e-8543a4b524f2
---

When migrating a hand-rolled control to a target component that can't yet represent
its richer state, the carve-now-finish-later split has two structurally different
shapes — distinguish them before accepting any loss:

- **Recoverable (sequencing-only):** the missing piece is an *additive* capability of
  the target (a slot, a structured-count API, a colour variant — not a fundamental
  limit of the model). Ship the faithful part now; carve the rest to a follow-up that
  is **filed as a concrete child with a hard `blockedBy` edge on the capability card**.
  Once the capability lands, the carved part converts with zero fidelity loss. This is
  fine — it's resequencing, not omission.
- **Permanent loss (flatten):** convert now by discarding the richer state (collapse
  sub-counts to a scalar, drop the colour). There's nothing left to restore. Reject
  this unless the discarded signal is genuinely cosmetic.

**Why:** "scope it later" reads identically to both at decision time, but only the
recoverable shape preserves the end-state. The discriminator is the **recoverability
test** — is the gap an additive capability or a fundamental limit? — plus whether the
follow-up is a *tracked hard-linked child* (vs a silent scope-out that decays into
permanent omission by neglect).

**How to apply:** on a "migrate to component that can't do X" fork, run the
recoverability test first. If additive: ratify the clean-swap scope + file (a) the
capability card and (b) the carved-conversion card `blockedBy` it, both under the
owning epic, before the parent migration closes. If fundamental-or-cosmetic-loss:
that's a real either/or, not a free carve.

Related: [[feedback_separate_canonicity_from_content_freeze]] (ratify structure now,
hold content), [[feedback_collect_decision_residual_as_card]],
[[feedback_decouple_build_from_release_timing]].
