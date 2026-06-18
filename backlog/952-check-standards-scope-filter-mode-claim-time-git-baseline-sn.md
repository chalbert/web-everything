---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
tags: []
---

# check:standards --scope filter mode + claim-time git baseline snapshot (gate violation attribution)

Build the #949-ratified gate attribution: (1) claim records git status --porcelain baseline + owning session/ids into per-session state alongside the #083 reservation registry; (2) check:standards gains a --scope/--mine flag that partitions findings by files-dirty-now-minus-baseline and exits 1 only on a my-scope error, external findings printed as non-failing notes; default no-flag run stays whole-repo-strict (CI/close-out unchanged). check:health reuses the same scope mode keyed on claimed item-id (findings already carry id). Build check:standards scoping first (where cross-session reds land).
