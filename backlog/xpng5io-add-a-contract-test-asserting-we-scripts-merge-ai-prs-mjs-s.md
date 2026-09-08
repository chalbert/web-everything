---
kind: task
status: open
scaffoldedBy: "conveyor-2502c"
dateScaffolded: "2026-09-08"
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-ai-detection-and-drain-ordering.test.mjs", "plateau:tools/drain-daemon/lib.mjs", "plateau:tools/drain-daemon/lib.test.mjs"]
dateOpened: "2026-09-08"
tags: []
---

# Add a contract test asserting we:scripts/merge-ai-prs.mjs's headSha field shape against plateau-app's consumption

#2502 threads we:scripts/merge-ai-prs.mjs's emitted per-PR headSha field into plateau-app's drain-daemon journal (headShaByPr, in plateau:tools/drain-daemon/lib.mjs) and its head-SHA-churn detector, but the two sides' own test suites only synthesize the headSha field independently — neither exercises the real we:scripts/merge-ai-prs.mjs --dry-run --json output shape against plateau-app's consumption of it. Add a cross-repo contract test (a shared fixture, or a plateau:tools/drain-daemon test that runs we:scripts/merge-ai-prs.mjs --dry-run --json against a small fixture repo and asserts every considered-PR entry that carries commits also carries a non-empty string headSha) so a future rename or shape change on either side fails a test instead of silently making headShaByPr permanently empty and the churn incident/anomaly quietly dead. Edge cases the test must cover: a PR whose commits read degraded (no headSha expected, must NOT be treated as a contract violation), a PR with zero commits, and a PR whose tip commit carries no oid (malformed gh output). It must also assert the `commits` array's ORDERING contract (oldest-first, so the tip is the LAST entry) against real `gh` output — `we:scripts/merge-ai-prs.mjs`'s `v.headSha = p.commits.at(-1)?.oid` currently trusts this ordering on the strength of `gh`'s documented behavior alone, with no test pinning it against the real CLI. Integration-shaped by construction — it must exercise the real we:scripts/merge-ai-prs.mjs CLI output, not a hand-typed fixture object, or it re-creates the exact gap it exists to close.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
