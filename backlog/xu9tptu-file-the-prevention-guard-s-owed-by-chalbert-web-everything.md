---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/daemon-edge.mjs", "we:scripts/daemon-overlay.mjs", "we:scripts/lib/__tests__/daemon-edge.test.mjs", "we:scripts/__tests__/daemon-overlay.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2809's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2809's review (reviewed head `a795217b7f66e10ec356c80ce2bd9fecb1f9ecb6`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/lib/daemon-edge.mjs:320` — Extract we:daemon-overlays.mjs's withListLock into a shared helper and require any module doing read-modify-write on a JSON state file under ~/.claude/... to go through it; short of a lint gate, a concurrency test (N parallel registerPr calls against one ledger, assert all N survive) in we:scripts/lib/__tests__/daemon-edge.test.mjs would catch it deterministically.
2. `we:scripts/lib/daemon-edge.mjs:348` — Make the init idempotent (tolerate EEXIST-class failures from `git init --bare` on a directory that another process is concurrently initializing, or wrap the whole ensureEdgeWorkRepo body in the same lock proposed for the ledger) and add a test that spawns N parallel first-time register/tick calls against a fresh WE_DAEMON_EDGE_DIR.
3. `we:scripts/daemon-overlay.mjs:128` — Wrap the edge-registration block in we:scripts/daemon-overlay.mjs's add handler in a local try/catch that records a soft failure onto output.edge instead of throwing, so a best-effort auxiliary side-effect can never mask a successful primary mutation; a review checklist item for 'flag-gated auxiliary call layered onto an existing stable CLI' would generalize this.
4. `we:scripts/lib/daemon-edge.mjs` — Add deterministic integration tests for closure after both an integrated head update and an unintegrated head update, asserting all PR contributions disappear while unrelated changes remain.
5. `we:scripts/lib/daemon-edge.mjs` — Serialize ledger transactions across registration and ticks, and gate this with a deterministic interleaving test that pauses a tick after its ledger read and registers another PR.
6. `we:scripts/lib/daemon-edge.mjs` — Preserve prior debt until success or explicit mootness is established, with injected-runner tests covering merge-tree errors and commit-tree failures for existing debts.
7. `we:scripts/lib/daemon-edge.mjs` — Track and explicitly reverse the prior removal when reactivating a PR, guarded by an integration test covering merge, close, revert, reopen, and re-registration of the unchanged head.
8. `we:scripts/lib/__tests__/daemon-edge.test.mjs` — Add the named deterministic regression tests to the required test gate and verify each by mutating its corresponding guard.
9. `we:scripts/lib/daemon-edge.mjs:236` — A lint rule prohibiting `await` in loops over unbounded collections without early-out filtering or concurrency limits.
10. `we:scripts/lib/__tests__/daemon-edge.test.mjs:181` — A strict test-coverage rule or mutation testing gate enforcing that every state transition mentioned in the design (e.g., revert conflicts) has a corresponding test fixture.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
