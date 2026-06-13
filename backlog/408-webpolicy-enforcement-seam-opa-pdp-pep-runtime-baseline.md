---
type: issue
workItem: story
size: 5
parent: "093"
status: resolved
blockedBy: ["407"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: webpolicy/enforcement.ts
tags: []
---

# webpolicy enforcement seam — OPA PDP/PEP, runtime baseline

Fork 3 of the #093 ruling: the enforcement seam via the OPA PDP/PEP pattern. A decision point evaluates the rule against webcontexts data; enforcement points attach to actions/components and enforce the verdict; the interaction logs at a webtraces span (the proof point feeding Fork 2). Runtime is the baseline proof-emitting venue (only venue that proves a rule ran for a given user/action); build-time and gate venues are additionally supported. Adopts the PDP/PEP PATTERN — policy language (OPA/Rego vs Cedar) is a build choice. Blocked on #407 (enforcement emits the proof records the proof-format defines).
