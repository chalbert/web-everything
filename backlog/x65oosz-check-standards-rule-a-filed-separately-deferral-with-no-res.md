---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# check:standards rule — a 'filed separately' deferral with no resolvable item id is an unfiled intention

PR #1031 review finding 2's owed prevention, and the finding is that this exact failure already happened twice in one commit: the fix commit said 'filed separately' for two carve-outs and neither item existed. Verified at the time — no backlog file mentioned either subject, ls backlog/ showed nothing under an unnumbered bornAs hash, and the PR added no backlog file. backlog/2823 is explicit that acceptance is gated on capture: a finding whose agreed prevention is neither built nor filed BLOCKS acceptance. So make the deferral phrase itself checkable: fail when a tracked source file, commit message, or PR body carries 'filed separately' / 'filed as a follow-up' / 'tracked separately' with no adjacent #NNN that resolves in backlog/. The locus-resolution plumbing already exists (#2821 gate 5).
