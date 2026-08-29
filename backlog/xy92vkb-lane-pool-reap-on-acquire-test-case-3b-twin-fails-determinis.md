---
kind: task
status: open
dateOpened: "2026-08-29"
scope: ["we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs"]
tags: [lane-pool, reap, testing, flake]
---

# lane-pool-reap-on-acquire test case 3b (twin) fails deterministically in isolation on some runs

`we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` case "3b (twin) — a TTL-STALE lease whose item PR is MERGED still IS reaped" was reported failing deterministically when run alone (`expected true to be false`, ~64s run), reproduced independent of any other change in flight. Re-run in this lane against current `main` (`fca3e3df`) all 10 cases passed, including 3b, in 176s — nearly 3x the reported run duration. `we:scripts/lane-pool.mjs` has not changed since the #3283 fix (`0709df10`, 2026-08-26) that last touched this test file, so there is no code delta between the passing and failing runs to bisect against: same source, different outcome. The most likely explanation is that the case is sensitive to real wall-clock timing (TTL-staleness windows measured against actual git-operation duration) rather than being unconditionally broken — investigate whether the test races a real TTL boundary before assuming a logic regression.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/lane-pool-reap-on-acquire.test.mjs` (case "3b (twin)") passes reliably across repeated standalone runs (e.g. 10/10 back to back), not just once. Root cause (real TTL race vs. a genuine logic regression) is identified and stated in this card before landing a fix.

## No parent epic found

Searched `we:backlog/*.md` for an open epic covering lane-pool reap/reliability specifically — none exists. The closest candidates (`#2606` delivery throughput/latency program, `#3029` operation engine) are about pipeline latency and dispatch operations respectively, not reap-logic correctness, so this card is filed unparented rather than mis-homed. `#3283` (the prior story that last touched this same test file) was filed unparented too.
