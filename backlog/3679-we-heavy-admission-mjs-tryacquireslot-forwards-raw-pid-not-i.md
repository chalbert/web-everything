---
bornAs: xrrx1gi
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# we:heavy-admission.mjs: tryAcquireSlot forwards raw pid, not its own computed selfPid, into reserve()'s process-identity check (PR #2223 review)

Independent jury review of PR #2223 (heavy-admission: key slot reentrancy by real process identity, not owner string, epic #3383; still OPEN as of filing, verdict: prevention outstanding — file the guard before accept) found a real latent contract violation in that PR's own new code, mandatory correctness lens, [CONFIRMED] by mutation, impact if unfixed: broken. we:scripts/readiness/heavy-admission.mjs's tryAcquireSlot (~line 182 on the PR branch) computes its own selfPid (Number.isInteger(pid) ? pid : process.pid) but then forwards the ORIGINAL, possibly-null pid parameter — not selfPid — into reserve()'s new requireOwnProcess pid slot. reserve() hardcodes requireOwnProcess true, so any direct caller that omits pid gets requesterPid: null, differentRealProcess always false, and zero real-process-identity protection — silently contradicting the module's own doc comment claiming 'SLOT REENTRANCY IS KEYED BY REAL PROCESS IDENTITY (pid), NOT BY THE OWNER STRING ALONE' unconditionally. Reproduced by the reviewer via mutation: two tryAcquireSlot calls sharing one owner, neither passing an explicit pid (the exact shape several of the file's own pre-existing tests already use), and the second silently reuses the first's slot (heldCount stays 1) instead of taking a second slot or blocking — the same live-incident bug PR #2223 itself exists to fix, reintroduced through this one unguarded parameter path. Harmless TODAY: both wired production callers (acquireSlotBlocking, acquireGhSlotSync) default pid = process.pid and always forward a real pid, so neither production path is affected — this is a real but currently-dormant contract gap for any future direct caller that omits pid. Independently confirmed by a second lens (codex-correctness/coverage, [CONFIRMED], impact if unfixed: degraded) at the same call site. Fix (both lenses agree, OWED — file it, neither applied in the PR): forward selfPid (not pid) into the reserve() call; add a regression test to we:scripts/readiness/__tests__/heavy-admission.test.mjs's '#3383 live incident' describe block that calls tryAcquireSlot twice with the SAME owner and NO explicit pid, asserting the second call is blocked or wins a distinct slot rather than silently sharing the first — mirroring the file's existing pid:process.pid / pid:process.ppid distinct-process test cases but exercising the omitted-argument branch specifically. Parented under #3383 (the epic this live-incident work sits under) since PR #2223 itself has no more specific numbered backlog item of its own (an ad hoc live-incident fix, like we:backlog/3656's dispatchFix lane-leak finding) and no existing item tracks this file's pid-identity work — checked we:backlog/ for 'tryAcquireSlot', 'selfPid', 'reclaimDecision', 'requireOwnProcess', 'pid-identity', 'reentrancy', 'owner string', 'real process identity' before filing: no hits, so this is fresh, not a duplicate. Line numbers are from the PR #2223 branch (not yet on main); verify against we:scripts/readiness/heavy-admission.mjs on main once #2223 lands, they may shift.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
