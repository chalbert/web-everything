---
kind: task
parent: "2289"
status: resolved
blockedBy: ["2288"]
dateOpened: "2026-07-07"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# Hash-tolerance sweep: widen remaining NNN filename parsers + skill docs for JIT ids

Follow-up to #2288 (JIT numbering). The core birth/loader/validator/drain path now accepts the xNNNNNN hash form, but ~15 secondary filename parsers still hardcode the numeric-only leading-token regex (we:scripts/gen-inventory.mjs, we:scripts/program-review-rank.mjs, we:scripts/memory-reflect.mjs, we:scripts/route-reference-remediation.mjs, we:scripts/audit-backlog-health.mjs, we:scripts/check-app-conformance.mjs, we:scripts/backlog-guard.mjs) and the batch/drain/close skill docs still speak only NNN. These run on main (all-numeric) so they are safe TODAY, but a hashed in-flight item they encounter (a lane-gate render, a guard in a lane) would be mis-parsed. Sweep them to the shared we:scripts/backlog/id.mjs ID_TOKEN_RE and note the two-form id in the drain/batch skill docs. Pure cleanup, no behaviour change on landed items.

Also in scope: wire JIT numbering (`numberPendingHashes`) into the rare `we:scripts/pr-land.mjs --fallback-git` local-merge land route, the one sole-writer path #2288 left un-numbered (gh-unavailable degrade). The two primary routes (we:scripts/lane-drain.mjs `finalizeLand`, we:scripts/merge-ai-prs.mjs sweep) already number; this closes the last one so no land path can strand a hash on main.

Deferred non-blocking notes from the PR #194 review (accepted-as-is at land, fold in here): (a) `ID_TOKEN_RE` caps the numeric id at `\d{1,4}` (9999 items) — bump to `\d{1,5}` for headroom before it bites (~2300 now); (b) extract the duplicated `ID_TOKEN_RE`/slug pattern in `we:src/_data/backlog.js` into a shared string constant (the CJS/ESM split forces a hand-kept copy — a footgun); (c) optionally seed `nextHash`'s taken-set from a shared source so a ~1/2.2e9 cross-lane birth collision (currently a silent corrupting mode) is at least detected.
