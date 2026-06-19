---
type: decision
workItem: task
parent: "1095"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webbehaviors: canonical host-element property name — ownerElement vs target

Open fork carved from #1095 (could-not-split). Spec names the host property ownerElement (matching native Attr.ownerElement the class chains to, we:plugs/webbehaviors/CustomAttribute.ts:200) but the impl exposes target (we:plugs/webbehaviors/CustomAttribute.ts:131,206,366). Forks: (A) rename target to ownerElement everywhere (spec+native align, bigger blast radius — default); (B) add ownerElement alias getter, keep target; (C) amend the spec to target (loses native alignment — likely wrong). Once ratified the rename is a small task.
