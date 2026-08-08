---
kind: story
size: 3
status: open
blockedBy: ["2908"]
dateOpened: "2026-08-08"
tags: []
---

# Converge loop: gate the editor on humanRequired and give an editor-enabled band a 2-round minimum

Implements the #2908 ruling. Today the editor runs wherever the round budget allows (elevated and high) and is unreachable at low, because the loop forces escalate at roundCap before the editor step (we:scripts/workflows/review-parked-prs.mjs:997-1003, editor at :1050). Replace that accidental gating with an explicit one: skip the editor iff the diff is humanRequired (isStatutePath or isDeclarativeLeashPath), and give any editor-enabled band a 2-round minimum on a DEDICATED editor knob — never by raising panelRigorForCareLevel, which /jury and /review also read.
