---
kind: task
status: open
blockedBy: ["1933"]
dateOpened: "2026-06-28"
tags: []
---

# Lane scoped fast-fail gate (#1159 --local --files) in the batch orchestrator

Per #1937 (Fork C), wire the lane step of #1933's parallel-batch orchestrator to run check:standards --local --files=<lane's edited files> (the #1159 partition) before pushing lane/*, as a BEST-EFFORT pre-push fast-fail — catches the author's own file-local errors before a wasted push+merge round-trip. NOT the authority (the central full no-flag gate after merge is), NOT a prerequisite for central-gate delivery: skipping it costs only a round-trip. Deliberately omits global-consistency rules (#1159 demotes descriptor.global under --local) so it cannot false-red the #1153 4-of-7 way.
