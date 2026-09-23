---
bornAs: x9avg7g
kind: story
size: 3
status: active
scaffoldedBy: "prepare-3690"
dateScaffolded: "2026-09-20"
scope: ["we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs"]
dateOpened: "2026-09-20"
dateStarted: "2026-09-22"
tags: []
---

# codex-direct-task's scratch clone points origin at the real remote, so the draft-only constraint is prompt text over a push-capable checkout

Found while preparing #3690 (Fork 1). we:scripts/codex-direct-task.mjs's setupScratchClone deliberately rewrites the scratch clone's origin from the local repoRoot path to the REAL remote (lines 558-563), commented 'so a human who likes the diff can push straight from the scratch clone if they choose to'. Codex runs in that clone with -s workspace-write and a real shell, and the ENTIRE draft-only constraint is one English sentence in buildCodexPrompt (lines 292-301: 'do not run git commit, do not run git push'). captureDiff detects an unbidden commit and reports it; nothing prevents one, and nothing prevents a push. --dir additionally lets a caller point a run at any existing checkout. The same shape should be checked on we:scripts/gemini-direct-task.mjs, whose own header already states no real write/read confinement exists. NOT verified: whether ambient git credentials would let such a push actually authenticate -- that probe is part of this item. Why it matters: #3690 Fork 1 rules that authority over what a delegated agent may DO is owned by the typed-operation catalog per the #agent-mutations-through-typed-operations anchor in we:docs/agent/platform-decisions.md, never by a transport -- precisely because this transport does not hold it. Options to weigh here (not pre-ruled): leave origin at the local repoRoot path and print the real remote for a human to add by hand; keep the rewrite behind an explicit opt-in flag; or strip push credentials from the clone's environment. The convenience the comment names is real, so this is not an automatic removal.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/codex-direct-task.test.mjs we:scripts/__tests__/gemini-direct-task.test.mjs` passes, including the new `#3782` cases asserting `setupScratchClone` leaves a fresh scratch clone's `origin` at the local `repoRoot` path by default (not push-capable) and only rewires it to the real remote when the caller explicitly passes `wireOriginToRemote`/`--wire-origin-to-remote`.

## Resolution (2026-09-22)

**Credential-auth probe (done first, per the item's own brief):** `origin` on this checkout is an SSH remote (`git@github.com:chalbert/web-everything.git`), not HTTPS, so the configured `credential.helper` (`gh auth git-credential`, HTTPS-only) is irrelevant to a push through it. `ssh-add -l` showed a live loaded key, and `ssh -T git@github.com` returned `Hi chalbert! You've successfully authenticated...`. So on this operator's own machine, ambient SSH-agent credentials WOULD authenticate a push through the scratch clone's rewritten origin — the gap was real, not theoretical, which is the strongest argument for the least-privilege default below.

**Option chosen: leave `origin` at the local `repoRoot` path by default; print the real remote for a human to wire up by hand (opt-in via `wireOriginToRemote`/`--wire-origin-to-remote` restores the old behavior).** The other two named options were considered and set aside: an opt-in *flag* is effectively what was built (not rejected — just resolved as "off by default, on by explicit choice" rather than "on by default, flag to turn it off"); stripping push credentials from the clone's environment was rejected because SSH auth here comes from the ambient agent socket, not an env var this process could strip without breaking other legitimate git operations the clone needs (fetch, etc.), and doing so would give a false sense of security once `wireOriginToRemote`/a manual `remote set-url` is available anyway. Matches `#3690` Fork 1: authority over what a delegated agent (or a human acting on its output) can do should not default to "on."

Applied the identical fix to `we:scripts/gemini-direct-task.mjs`'s own `setupScratchClone` (verbatim-duplicated code, verbatim-duplicated comment) — its header is honest about lacking *sandbox* confinement, but that is a different axis from the *push-capable origin* gap fixed here, which applies identically on this machine's ambient SSH credentials.
