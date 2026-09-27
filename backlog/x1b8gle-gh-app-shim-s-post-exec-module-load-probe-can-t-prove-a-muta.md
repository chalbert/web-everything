---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/gh-app-shim.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# gh-app-shim's post-exec module-load probe can't prove a mutating gh call never ran, risking replay

Still-open Codex advisory finding from chalbert/web-everything#2772's FINAL review round (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — still applies as a residual gap; two earlier rounds of this same PR already fixed the original bug.

FINDING: in we:scripts/lib/gh-app-shim.mjs, runThrottled's throttleCliMissing now re-checks whether GH_THROTTLE_CLI's own module graph fails to load (throttleCliFailsToLoad) before treating a "Cannot find module" stderr as proof the throttle never ran — this closes the original bug (a genuine gh failure that happens to print that text). But the re-check itself is not proof either: it is a SEPARATE, LATER process spawn, so in the rare case where gh performed a real mutation, then failed with "Cannot find module" because a throttle dependency vanished transiently (a checkout mid-reset), and that dependency is STILL missing (or missing again) when throttleCliFailsToLoad's own probe runs moments later, the probe reports true, warnFallback fires, and runDirect replays the SAME gh command a second time — duplicating a non-idempotent mutating call. The probe can only ever prove "the module graph fails to load right now", never "gh itself never reached the network/write".

EVIDENCE: read we:scripts/lib/gh-app-shim.mjs directly off origin/main — throttleCliMissing still calls throttleCliFailsToLoad(env), a fresh spawnSync probe, with no signal from the ORIGINAL gh invocation about whether it reached its own mutation before failing; the function's own comment (\"PR #2772 review: the stderr text ALONE is never proof ... the fallback fires only when THAT fails to load too\") documents the intentional narrowing but not a closure of this residual race.

PREVENTION (from the reviewer, still owed): add a regression test that removes an imported throttle dependency AFTER the first (real) gh invocation succeeds, confirms the module-load probe then fails too, and asserts runDirect is never called a second time for that same command — i.e. gate replay on evidence from the ORIGINAL execution that gh was never reached, not solely on the later probe's own result.

Priority: not HIGH (a rare double-execution of one gh call on an already-narrow failure path, not a close/resolve of the wrong PR, not bulk data loss, not indefinite healing suppression).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
