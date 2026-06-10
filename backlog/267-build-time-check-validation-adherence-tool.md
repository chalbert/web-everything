---
type: idea
workItem: story
size: 2
parent: "005"
status: open
blockedBy: ["266"]
dateOpened: "2026-06-10"
tags: []
---

# Build-time check:validation-adherence tool

A build-time check:validation-adherence command that reads each validation implementation's capability manifest (#266) and flags out-of-capability usage — a feature used that the impl doesn't declare support for — rather than letting it silently no-op. Consumes the manifest schema; independent of the runtime guard and report-format slices.
