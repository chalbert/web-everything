---
bornAs: xtk1m66
kind: story
size: 5
parent: "3581"
status: open
scope: ["we:scripts/lib/isolation-provider.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/lane-pool.mjs"]
dateOpened: "2026-09-10"
tags: []
---

# Wire the IsolationProvider macOS-deletion backend into a real tool-bearing Codex dispatch path

we:backlog/3371-probe-one-alternate-provider-against-the-judge-contract.md Probe 9 found that `codex exec -C <dir>` always auto-loads we:AGENTS.md, with no override flag, blocking Codex CLI from ever taking a tool-bearing role in this repo's dispatch pipeline (a lane clone always carries we:AGENTS.md). A dispatched real investigation+build task, run via we:scripts/codex-direct-task.mjs (PR #2116, its first dogfood use) against Codex CLI's agentic mode, found and built a fix, authored in PR #2118 (open, unmerged as of this writing — see correction below): we:scripts/lib/isolation-provider.mjs, an `IsolationProvider` port mirroring the `JudgeProvider` port shape in we:scripts/operations/cli-adapter.mjs, plus `createMacosDeletionIsolationProvider` — the first real backend, proven live (Probe 11, appended to #3371) by deleting we:AGENTS.md from a scratch clone before invoking `codex exec -C <dir>`: a real before/after test confirmed this fully keeps the doctrine text out of the child session's context while real tool-bearing work (file create, shell exec, git status) kept working normally. Codex's own nested self-test (Probe 10) was inconclusive for an unrelated environment reason (an already-Seatbelt-sandboxed process cannot re-apply a sandbox to a child on macOS), documented in we:docs/agent/testing.md's new "Nested CLI isolation probes" section.

**Correction (#3371 Probe 12, 2026-09-11):** Probe 9's "no override flag exists" conclusion above was
wrong — `-c project_doc_max_bytes=0` live-verified in both `-s read-only` and `-s workspace-write`
(tool-bearing) modes. `we:scripts/lib/isolation-provider.mjs` now ships a SECOND backend,
`createConfigOverrideIsolationProvider`, added alongside `createMacosDeletionIsolationProvider` (not
replacing it — the two hold different guarantees; see the module header and #3371 Probe 12 for why).
Whoever wires a call site per this item now has two options, not one, and must pick per the guarantee
that call site actually needs: the config-override backend is cheap (no clone, works directly on the
lane cwd) but only suppresses the CLI's *automatic* doctrine injection — a tool-bearing agent that reads
we:AGENTS.md itself still recovers it in full (live-proved in Probe 12). The deletion backend costs a
full clone but the file is actually absent, so a deliberate read gets ENOENT. Point 4 below is updated
accordingly.

This item exists because #2118 (plus the correction above) ships the port + two backends + unit tests
only — neither is wired into any real dispatch call site, and this is deliberately deferred rather than
assumed. Concretely open:

1. Pick the first real call site. The natural candidate per #3581's ratified sequencing is wherever a tool-bearing Codex session would first run in this repo's dispatch pipeline (review/fix-dispatch is ratified as the pilot surface for Codex generally; whether a tool-bearing juror/fixer role is even scoped yet is a separate, still-open question this item does not answer).
2. Decide how `IsolationProviderOutcome.cwd` (an owned scratch clone, for the deletion backend — or the lane cwd itself, unchanged, for the config-override backend) composes with we:scripts/lane-pool.mjs's existing lease/reap/scope machinery — the port's own header notes "the returned cwd is not a pooled lane; existing judge lane validation is not bypassed," which means whoever wires it in must resolve that gap explicitly, not assume it away. This resolution differs by backend: the config-override backend never leaves the pooled lane cwd at all, so this gap may not even apply to it the same way it applies to the deletion backend's disposable clone.
3. A real live proof that a WIRED (not just standalone-tested) tool-bearing Codex session, dispatched through the actual call site, cannot recover we:AGENTS.md **automatically** — mirroring #3371's own "run it, don't read about it" evidentiary bar. Whichever backend is chosen, also state plainly whether a deliberate in-session read is expected to succeed (config-override) or fail (deletion) — Probe 12 already has both live-verified command sequences to reuse rather than re-derive.
4. State plainly, wherever this lands, the honest limit for whichever backend is wired: the deletion backend is deletion-before-launch, not read-denial — we:AGENTS.md is still recoverable via `git show HEAD:<path>` (e.g. we:AGENTS.md) or `git checkout` inside the scoped clone by an agent that deliberately looks; the config-override backend never removes the file at all, so ANY deliberate read (not just Git-mediated recovery) succeeds — the weaker and cheaper of the two guarantees. Neither is a defense against an adversarial agent, and neither is a resource-cap or lane-container mechanism (that remains #3621's separate, larger, still-open decision).

Not urgent — #3581's own ratified pacing already holds full delivery-agent-shaped Codex work behind the review/fix-dispatch pilot landing and proving out first, and this item's own call-site question (1, above) depends on that pilot's own progress to even be answerable concretely.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
