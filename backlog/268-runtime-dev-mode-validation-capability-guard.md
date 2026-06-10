---
type: idea
workItem: task
parent: "005"
status: open
blockedBy: ["266"]
dateOpened: "2026-06-10"
tags: []
---

# Runtime dev-mode validation-capability guard

A dev-mode runtime guard that warns when validation usage exceeds the active implementation's declared capabilities (the manifest from #266), the runtime sibling of the build-time check. Dev-only, stripped in prod. Independent of the build-time tool and report slices.
