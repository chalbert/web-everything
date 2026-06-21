---
kind: decision
size: 2
status: open
dateOpened: "2026-06-21"
relatedReport: reports/2026-06-21-bounded-scalar-readout-meter.md
tags: [decision, progress, apg, gap]
---

# progress indicator (role=progressbar) — first-class intent or covered by loader?

Sibling placement decision filed by #1410 (Fork 2a). WE owns determinate/indeterminate task progress today only as a dimension of `loader` (`loader.progress`) plus step-position in `flow-progress`. `<progress>`/`role=progressbar` is a distinct ARIA role from meter (may be indeterminate, drops `aria-valuenow`). Decide whether a determinate progress readout NOT tied to a pending/blocking lifecycle warrants its own thin intent/block, or whether `loader.progress` is the canonical home. Default lean: covered by loader (~60%). Boundary codified by [readout-placement-by-value-type](../docs/agent/platform-decisions.md#readout-placement-by-value-type).
