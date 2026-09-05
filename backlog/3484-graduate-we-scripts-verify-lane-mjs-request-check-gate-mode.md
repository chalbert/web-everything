---
bornAs: xkvfq4a
kind: story
size: 3
parent: "3443"
status: active
scope: ["we:scripts/verify-lane.mjs", "we:scripts/conveyor/verify-dispatch.mjs", "we:scripts/guard-bash.mjs", "we:skills-src/conveyor/delivery-agent-brief.md"]
dateOpened: "2026-09-04"
dateStarted: "2026-09-04"
tags: []
---

# Graduate we:scripts/verify-lane.mjs request/check gate mode + we:scripts/conveyor/verify-dispatch.mjs from lane/mechanical-dispatcher to main

The gate-outruns-the-foreground-window footgun (#3105) already picked the "wait primitive" fork on origin/lane/mechanical-dispatcher: we:scripts/verify-lane.mjs gains request/check/reset CLI modes so a dispatched agent hands the long-running gate to the mechanical runner instead of blocking on it, a new mechanical pass we:scripts/conveyor/verify-dispatch.mjs picks up the request and runs the gate as the runners own long-lived process, we:scripts/guard-bash.mjs denies a dispatched agent from running the verification set directly (gated on a new WE_DISPATCH_KIND env var), and we:skills-src/conveyor/delivery-agent-brief.md is updated to the request-then-poll pattern. Self-contained feature, one commit on the branch, with its own tests (we:scripts/__tests__/verify-lane.test.mjs, we:scripts/conveyor/__tests__/verify-dispatch.test.mjs, we:scripts/__tests__/guard-bash.test.mjs). Landing this does not itself rule #3105s open fork -- it only builds the mechanism one fork branch needs; the follow-up refactor to fold request/check into the declared we:scripts/operations/verify.mjs operation is filed separately as its own child (see the sibling card already drafted on the branch as backlog/xab3jh7-*). No dependency on the held-back reconcile-pass runner wiring.

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/verify-lane.mjs we:scripts/conveyor/verify-dispatch.mjs we:scripts/guard-bash.mjs we:skills-src/conveyor/delivery-agent-brief.md` reports no diff, and the new/updated tests (`we:scripts/__tests__/verify-lane.test.mjs`, `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`, `we:scripts/__tests__/guard-bash.test.mjs`) exist on `main` and pass.
2. Landed as its own small PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push.
