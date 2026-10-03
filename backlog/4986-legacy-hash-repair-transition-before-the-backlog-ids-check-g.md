---
bornAs: x4qfbpf
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/backlog.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# Legacy hash repair transition before the backlog-ids check goes live

From #3732: hashes already on main are repaired by number-stranded. The repair PR cannot pass today's gates, since the stranded-hash rule sees the originals and the hand-numbered rule rejects the new NNNs. The build validates the resulting tree and the exact hash-to-NNN mapping, never an unrelated-addition exemption. Blocks activating the backlog-ids required check.

## Done when

1. **Executable** — a test seeds a main with stranded hash cards, runs the repair, and asserts the resulting tree matches the exact hash-to-NNN mapping with every reference rewritten. No unrelated-addition exemption is used.
2. **Executable** — the repair PR passes the stranded-hash and hand-numbered gates through the validated mapping, not a blanket exemption. Fails before this lands.
3. This card blocks activating the `backlog-ids` required check.
