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

**Second correction (#3371 Probe 14, 2026-09-11):** we:scripts/lib/isolation-provider.mjs now ships a
THIRD backend, `createNativeDenyWithHistoryStripIsolationProvider` — real git-history surgery (the file
is amended out of the clone's own history, not just deleted from the working tree) plus the argv fragment
for Codex's undocumented native filesystem-deny permission. It closes the deletion backend's git-history
gap (Probe 14a found a real tool-bearing Codex session recovers a deleted-only file via `git show
HEAD:<path>` (e.g. we:AGENTS.md), unprompted, because `git status`'s ` D` line signposts what to look
for) and denies direct reads of the live path on the whole host, not just inside one clone. Whoever wires
a call site now has THREE options; point 4 below is updated again accordingly. Also: `excludePaths` is
now a request field on all three backends, defaulting to a one-item list holding just we:AGENTS.md, so a
caller is not locked to that one filename.

This item exists because #2118 (plus both corrections above) ships the port + three backends + unit tests
only — none is wired into any real dispatch call site, and this is deliberately deferred rather than
assumed. Concretely open:

1. Pick the first real call site. The natural candidate per #3581's ratified sequencing is wherever a tool-bearing Codex session would first run in this repo's dispatch pipeline (review/fix-dispatch is ratified as the pilot surface for Codex generally; whether a tool-bearing juror/fixer role is even scoped yet is a separate, still-open question this item does not answer).
2. Decide how `IsolationProviderOutcome.cwd` (an owned scratch clone, for the deletion and native-deny backends — or the lane cwd itself, unchanged, for the config-override backend) composes with we:scripts/lane-pool.mjs's existing lease/reap/scope machinery — the port's own header notes "the returned cwd is not a pooled lane; existing judge lane validation is not bypassed," which means whoever wires it in must resolve that gap explicitly, not assume it away. This resolution differs by backend: the config-override backend never leaves the pooled lane cwd at all, so this gap may not even apply to it the same way it applies to the two cloning backends' disposable clones.
3. A real live proof that a WIRED (not just standalone-tested) tool-bearing Codex session, dispatched through the actual call site, cannot recover we:AGENTS.md **automatically** — mirroring #3371's own "run it, don't read about it" evidentiary bar. Whichever backend is chosen, also state plainly whether a deliberate in-session read is expected to succeed (config-override), fail with ENOENT (deletion), or fail with a permission denial that a cooperative agent self-reports without even attempting the read (native-deny) — Probes 12 and 14 already have live-verified command sequences to reuse rather than re-derive.
4. State plainly, wherever this lands, the honest limit for whichever backend is wired: the deletion backend is deletion-before-launch, not read-denial — we:AGENTS.md is still recoverable via `git show HEAD:<path>` (e.g. we:AGENTS.md) or `git checkout` inside the scoped clone by an agent that deliberately looks; the config-override backend never removes the file at all, so ANY deliberate read (not just Git-mediated recovery) succeeds — the weakest and cheapest of the three guarantees; the native-deny+history-strip backend closes both the direct-read and git-history routes for THIS repo/clone, but any OTHER readable git repo on disk (e.g. this repo's own lane clones) still leaks the same way — that residual needs a read-allowlist, #3621's territory. None of the three is a defense against an adversarial agent, and none is a resource-cap or lane-container mechanism (that remains #3621's separate, larger, still-open decision).

Not urgent — #3581's own ratified pacing already holds full delivery-agent-shaped Codex work behind the review/fix-dispatch pilot landing and proving out first, and this item's own call-site question (1, above) depends on that pilot's own progress to even be answerable concretely.

## Finding (2026-09-21) — three of four points are done on the prototype branch only; this card stays open

Verified against `origin/main` (`e71426493`) and `origin/lane/mechanical-dispatcher` (`5ab89f87b`). PR #2118 (the port and its backends) merged on 2026-09-11, so the "open, unmerged" wording above is stale. PR #2169 (the first `--provider=codex` delivery run) merged on 2026-09-13.

**On main: no call site.** `we:scripts/lib/isolation-provider.mjs` is imported only by its own test (`we:scripts/lib/__tests__/isolation-provider.test.mjs`, 78 tests, passing on main) and named in a comment of `we:scripts/lib/__tests__/container-exec.test.mjs` and in docs (`we:docs/agent/testing.md`, `we:docs/agent/platform-decisions.md`). Nothing else under `we:scripts/` imports it. The Codex delivery provider, its test, `we:scripts/lib/codex-model-routing.mjs`, `we:scripts/lib/usage-report-secret-paths.mjs`, `we:scripts/lib/spawn-to-completion.mjs`, `we:scripts/operations/minimal-context-provider.mjs` and `we:scripts/operations/telemetry-store.mjs` do not exist on main, and main's `we:scripts/operations/deliver-item-wrapper.mjs` still carries only the throwing `CODEX_PROVIDER` seam.

**On the prototype branch: the call site exists, but it does not use a port backend.** The write-capable Codex path is `we:scripts/operations/codex-delivery-provider.mjs`. It imports one helper, `buildNativeDenyCodexArgs` (`:132`), and splices it into the argv at `:364` inside `buildCodexDeliveryArgv` (`:342`). No factory (`createMacosDeletionIsolationProvider`, `createConfigOverrideIsolationProvider`, `createNativeDenyWithHistoryStripIsolationProvider`) has a call site on main or on the branch. The helper is reached through `CODEX_PROVIDER` (`we:scripts/operations/deliver-item-wrapper.mjs:830`, selected with `--provider=codex`), `FIX_CODEX_PROVIDER` (`we:scripts/operations/fix-dispatch-wrapper.mjs:392`, argv at `:432`) and `CI_HEAL_CODEX_PROVIDER` (`we:scripts/operations/ci-heal-dispatch-wrapper.mjs:443`, argv at `:477`). `we:scripts/operations/__tests__/codex-delivery-provider.test.mjs` (41 tests), `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` (146) and the isolation suite (78) pass on the branch: 265 tests.

| Point | State | Evidence |
| --- | --- | --- |
| 1. Pick the first real call site | done on the branch only, with a different backend than the title names | the paths above; the deletion backend, the one in the title, is not used |
| 2. How the returned cwd composes with lane-pool lease, reap and scope | resolved on the branch by not creating a scratch clone | the agent runs with `-C <lane>` in the pooled lane clone itself (`we:scripts/operations/codex-delivery-provider.mjs:376`); the wrapper acquires and releases that lane (`we:scripts/operations/deliver-item-wrapper.mjs:309`, `releaseClaimAndLane`); `assertDenyPathsUsable` (`:216`) refuses a deny entry that covers the agent's own lane |
| 3. Live proof, through the wired call site, that `we:AGENTS.md` is not recovered automatically, and what a deliberate read does | **not shown** | the provider header (`:100-107`) records a live check of the flags (codex-cli 0.153.4, 2026-09-12: a real write-mode run was asked whether any instructions file had been auto-loaded and said none had) and a raw `codex sandbox -P locked` run for write and network confinement (`:58-77`); PR #2169 shows the wired path delivering. No record found of the auto-load check run through the wired provider, nor a statement of what a deliberate in-session read does under the native deny |
| 4. State the honest limit for the backend wired | done on the branch | the header residual notes (`:84-98`): reads outside the lane stay open, sibling-lane reads stay open, and the deny is model-cooperation inside `codex exec`; the port header on main (`we:scripts/lib/isolation-provider.mjs:1-50`) states the three backends' limits |

**Files that graduate (owned by #3443, under #3580).** In dependency order, each as its own slice from a lane cut from `origin/main`, with the per-file freshness rule of decision #3804 (port a diff, never copy a file main has moved):

1. `we:scripts/lib/codex-model-routing.mjs` with `we:scripts/lib/__tests__/codex-model-routing.test.mjs`
2. `we:scripts/lib/usage-report-secret-paths.mjs` and `we:scripts/lib/spawn-to-completion.mjs`
3. `we:scripts/operations/minimal-context-provider.mjs` and `we:scripts/operations/telemetry-store.mjs`
4. `we:scripts/operations/codex-delivery-provider.mjs` with `we:scripts/operations/__tests__/codex-delivery-provider.test.mjs`
5. the `CODEX_PROVIDER` block of `we:scripts/operations/deliver-item-wrapper.mjs` (the file exists on main, so this is a diff), then `we:scripts/operations/deliver-item-run.mjs` (the `--provider` flag)
6. `we:scripts/operations/fix-dispatch-wrapper.mjs`, `we:scripts/operations/fix-run.mjs`, `we:scripts/operations/ci-heal-dispatch-wrapper.mjs` and `we:scripts/operations/ci-heal-run.mjs`, if the fix and ci-heal kinds graduate with it

Whether a file in that list already has a graduation slice was not checked here.

**Not resolved, and why.** Point 3 has no evidence, and points 1, 2 and 4 are not on main. What is owed here once the code is on main: run the auto-load check and a deliberate read of `we:AGENTS.md` through the wired provider, and record both outcomes on this card. The title names the deletion backend; the wired path uses the native-deny argv instead, so the title no longer describes the work.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
