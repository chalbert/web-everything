---
bornAs: x9avg7g
kind: story
size: 3
status: active
scaffoldedBy: "prepare-3690"
dateScaffolded: "2026-09-20"
scope: ["we:scripts/codex-direct-task.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# codex-direct-task's scratch clone points origin at the real remote, so the draft-only constraint is prompt text over a push-capable checkout

Found while preparing #3690 (Fork 1). we:scripts/codex-direct-task.mjs's setupScratchClone deliberately rewrites the scratch clone's origin from the local repoRoot path to the REAL remote (lines 558-563), commented 'so a human who likes the diff can push straight from the scratch clone if they choose to'. Codex runs in that clone with -s workspace-write and a real shell, and the ENTIRE draft-only constraint is one English sentence in buildCodexPrompt (lines 292-301: 'do not run git commit, do not run git push'). captureDiff detects an unbidden commit and reports it; nothing prevents one, and nothing prevents a push. --dir additionally lets a caller point a run at any existing checkout. The same shape should be checked on we:scripts/gemini-direct-task.mjs, whose own header already states no real write/read confinement exists. NOT verified: whether ambient git credentials would let such a push actually authenticate -- that probe is part of this item. Why it matters: #3690 Fork 1 rules that authority over what a delegated agent may DO is owned by the typed-operation catalog per the #agent-mutations-through-typed-operations anchor in we:docs/agent/platform-decisions.md, never by a transport -- precisely because this transport does not hold it. Options to weigh here (not pre-ruled): leave origin at the local repoRoot path and print the real remote for a human to add by hand; keep the rewrite behind an explicit opt-in flag; or strip push credentials from the clone's environment. The convenience the comment names is real, so this is not an automatic removal.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
