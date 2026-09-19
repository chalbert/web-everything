---
kind: task
status: open
dateOpened: "2026-09-19"
tags: []
crossRef: { url: "#2309", label: "PR #2309 — the reviewed PR that returned REJECT with bad findings" }
---

# we:review-pr.mjs returns REJECT with fabricated findings — review-gate reliability gap

On 2026-09-19, `we:review-pr` returned REJECT on PR #2309 with 4 findings from only 4 tool calls. Re-verification found 3 findings were fabricated: non-existent PR #2308 (exists/merged), claiming `investigation` as valid kind (not in live schema), and applying stricter evidence bar than 7 comparable items. Only 1 of 4 findings held up. This session depends on review verdicts as the gate for landing work; a process returning high-confidence wrong verdicts with thin evidence is a real reliability gap.

## Investigation angle

Should `we:review-pr.mjs` require a **minimum evidence threshold before it can REJECT** (not for ACCEPT) a PR — minimum tool-calls, code coverage, or confidence floor — similar to how `backlog/3690` requires an "informative trial" so reviews cannot confidently reject on fabricated/thin grounds?

## Context

Evidence: review sessions showing REJECT verdict and re-verification showing findings 1–3 were wrong. Pattern: second occasion tonight where review returned high-confidence wrong verdicts.

## Done when

1. **Audited** — `we:review-pr.mjs`'s per-finding evidence gathering examined; thin-call rejection circumstances catalogued.
2. **Proposed** — threshold mechanism sketched: minimum calls per REJECT, code-coverage ratio, or confidence floor blocking thin rejections.
3. **Gated** — mechanism prototyped and tested against real REJECT scenarios, blocking worst thin-call cases without false-positiving on legitimate sparse rejections.
