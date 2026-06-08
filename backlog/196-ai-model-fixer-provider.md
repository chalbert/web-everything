---
type: idea
workItem: story
size: 5
parent: "097"
status: open
dateOpened: "2026-06-08"
tags: [monetization, conformance, auto-fix, agent, ai-provider, byo-key, content-generation, propose-and-verify, provider-registry, webcases]
relatedProject: webcases
crossRef: { url: /backlog/095-conformance-auto-fix-agent/, label: "Conformance auto-fix agent (#095)" }
---

# AI model-backed fixer provider — the BYO-key fixer for content-generation conformance classes

The conformance auto-fix agent ([#095](/backlog/095-conformance-auto-fix-agent/))
shipped its MVP with one **deterministic reference fixer** (`deprecated-status` —
the contract already encodes the fix, so no model is needed). This item adds the
**model-backed fixer provider** that plugs into the SAME `CustomFixerRegistry` for
the failure classes whose fix is *content generation*, not a mechanical rewrite —
e.g. `missing-description` (a block/plug/research topic in the spec with no
`*-descriptions/*.njk`): the model drafts a spec-conformant description, the
**verify gate re-runs `check:standards` and keeps it only if the failure cleared
and introduced no new error**. This is where the #089 moat actually lives — a
generic model emits plausible prose; only here is it gated by a machine-checkable
conformance target.

## Carried from #095

- **Same registry, different provider.** Mirror the upgrader's `modelComponent`
  analyzer (#188): a thin `ModelClient` seam (Anthropic/OpenAI is config, not
  architecture; BYO key; no model-hosting cost on us). Register ahead of / beside
  the reference fixers in `scripts/autofix/engine.mjs`.
- **The engine is ready.** `autofix()` already loops, applies, re-verifies, and
  reverts non-accepted patches with an explanation — a model fixer is just another
  `{ id, handles, fix }` whose `fix` is async and does a network call.
- **Needs the descriptor feed.** `missing-description` (and friends) must emit a
  machine-readable descriptor first — see [#197](/backlog/197-broaden-conformance-failure-descriptors/).

## Open follow-ons

- Bound model cost/iterations per failure; show the proposed prose diff for human
  review before acceptance (the engine already captures `before`/`after`).
- A dev-surface / playground for the loop (mirrors the upgrader playground) so a
  human can watch propose → verify → accept/revert interactively.
