---
kind: story
size: 5
parent: "xnu179a"
status: open
dateOpened: "2026-08-01"
blockedBy: ["x8fptpl", "xvbh2rb"]
tags: [plateau-loop, conveyor, ui-fidelity, we, slice-uifg]
---

# WE floor: record consumption + warn-to-error

A pure check-ui-fidelity core folded into the WE standards gate for a UI item at/entering resolved: verify the signed record is present, fresh, green, bound to the current commit/route/baseline, the registry token is valid, and baselines exist — missing/stale/boot-fail = ERROR. Re-grades the comparator baseline-missing warn to error at this one caller.
