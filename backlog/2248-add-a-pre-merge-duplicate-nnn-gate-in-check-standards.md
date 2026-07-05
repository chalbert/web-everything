---
kind: story
size: 3
relatedTo: ["2213", "2071"]
status: open
dateOpened: "2026-07-04"
tags: [backlog, gate, merge-queue, git]
---

# Add a pre-merge duplicate-NNN gate in `check:standards`

> **Reframed under epic #2289 (2026-07-05).** Under #2291 this becomes a **tripwire**, not a heal-triggering gate: once numbers are assigned just-in-time (#2288) a duplicate NNN is unrepresentable, so this assertion should never fire — if it does, it signals a JIT allocation bug and should alert rather than silently trigger a heal.

`check:standards` has **no** rule that errors when two `we:backlog/NNN-*.md` files share an NNN — the loader's
`byNum` (`we:src/_data/backlog.js`) is a last-wins `Map`, so a collision **silently drops one item** rather
than failing the gate. NNN collisions are handled only by the **post-merge renumber *heal*** (#2071,
`we:scripts/backlog-renumber-collisions.mjs`) — a fix-after-the-fact, not a pre-merge *gate*. Observed
repeatedly 2026-07-03/04: concurrent sessions racing new items produced a stream of same-NNN collisions that
each needed a heal, and the loader silently favoured whichever landed last.

**Fix:** add a deterministic `check:standards` check that scans `we:backlog/` for two files sharing an NNN
prefix and **errors** (naming both paths), so a collision is caught **before** merge on the PR's required
`test` check — strictly better than healing after. It runs on the merged tree (mirrors the existing
`[gate-on-merged-tree]` keyed-JSON dup-key gate at `we:scripts/check-standards-rules.mjs`), so two lanes each
adding the SAME NNN fail the second PR's CI instead of silently colliding on `main`. Keep the #2071 heal as the
recovery path for a collision that still slips through (e.g. a `--no-verify` push). Complements #2213 (which
fixes the heal's *direction*) — this adds the missing *gate*. Unit-test the pure detector (two files → error;
distinct NNNs → clean).
