---
kind: story
size: 2
status: open
scope: ["we:.claude/settings.json", "we:scripts/__tests__/guard-stop-completion-record.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Register the completion-record Stop guard in project settings

Follow-up required by #4416 and chalbert/web-everything#2897: we:scripts/guard-stop-completion-record.mjs is registered only in DELIVERY_HOOKS_SETTINGS in we:scripts/operations/deliver-item-wrapper.mjs. Add its command to the actual Stop event in we:.claude/settings.json, preserving the delivery registration. Extend we:scripts/__tests__/guard-stop-completion-record.test.mjs to verify the real project Stop registration and prove removing that command fails the regression. Verify an actual Stop payload blocks a started completion record and allows a terminal record; do not infer all-provider coverage from registration presence.

## Done when

1. **Executable** — run Vitest on we:scripts/__tests__/guard-stop-completion-record.test.mjs. A new assertion against the actual project Stop event fails before registration and passes afterward; deleting that command in memory fails the assertion.
2. The delivery Stop registration remains intact. Real Stop protocol probes cover both a started and a terminal completion record.
