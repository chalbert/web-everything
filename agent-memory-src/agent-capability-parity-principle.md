---
name: agent-capability-parity-principle
description: Standing principle — default toward equal tool/capability parity across agent types (Claude, Codex, Antigravity, future providers) rather than leaving asymmetric constraints unexamined.
metadata:
  type: feedback
---

The operator wants agent types (Claude, Codex, Antigravity, and future providers like
Grok/Cursor/open-weight) to have as close capability parity as possible — default to giving
each agent type equivalent tools/access for equivalent roles, rather than leaving an
asymmetric constraint in place just because it was the original default.

**Why:** Surfaced on 2026-09-14 during epic #3383's multi-model dispatch work. A real
investigation found Codex's advisory-review seat is architecturally read-only
(`-s read-only`) while Claude's equivalent correctness juror has write tools and routinely
does mutation verification (write a scratch repro, break something, confirm a test reddens —
described as "the repo's own highest-yield verification technique"). This tooling asymmetry
plausibly explained more of an apparent "Codex misses bugs" pattern than any real
model-capability or judgment difference — in every head-to-head case where both models
graded the same bug, they agreed. The operator's response: close asymmetries like this by
default, don't just accept them as given.

**How to apply:**
- When evaluating a new provider/agent type, or auditing an existing one, check whether it
  has less capability than a comparable-role agent for reasons that were never actually
  validated (a leftover cautious default, not a proven-necessary constraint).
- Before concluding an agent type has a real capability/judgment gap, rule out tooling
  asymmetry as the cause first — same discipline as ruling out lens-scoping or rubric
  differences.
- When closing a gap, prefer scoped/contained parity over blanket write access — e.g.
  read-only to scoped write inside a throwaway/contained scratch space, not unrestricted
  write access. Real containment work already validated this session (a real Apple container
  fully contains a provider's writes, tested live, no escape found even via engineered
  git-hook tricks) — lean on that pattern rather than granting raw host access.
- This doesn't override genuine, validated safety constraints (e.g. a provider whose sandbox
  doesn't actually confine its own tools stays read-only/advisory-only until that's fixed or
  contained) — parity is the default to reach for, not a mandate to ignore real risk.
