---
bornAs: xq20zni
kind: story
size: 3
parent: "3321"
status: open
dateOpened: "2026-08-27"
tags: []
---

# Stacked warn-and-continue points on the land path compound into silent strands

Tracing the exact log from PR #1664's land (2026-08-27, captured in this session's saved task
output — see `#3379` for the sibling numbering-push fix), the numbering push did not fail in
isolation. The line immediately before it, same run: *"local main NOT fast-forwarded (diverged, or
a reapplied local edit conflicts) — reconcile by hand"* — `we:scripts/merge-ai-prs.mjs:4220`, a
DIFFERENT, earlier best-effort step. `we:scripts/merge-ai-prs.mjs:4223-4240`
(`resyncDetachedCwdForLand`, filed for this exact class of problem per `#2347`/`#2348`/`#2419`) ran
next specifically to repair that, but its own doc says the resync itself has skip conditions
(`exec-failed`, `dirty`, `unpublished-commits`) that leave the tree "stale" and only warn. The
numbering step downstream then inherited whatever state the tree was actually in and its OWN push
failed too — a second warn-and-continue, immediately after a first one, with no connection drawn
between them anywhere in the code or the log. Each point is individually reasonable (a hard failure
mid-land would be worse — the couples already landed) but nothing today asks "did an EARLIER
best-effort step in this same pass already report degraded state?" before a LATER one silently
degrades too. Two soft failures in a row read, to anyone watching, as one loud one — except nothing
is loud.

## Done when

1. **Executable** — a test drives a fixture through `runCli`'s land path (or the smallest slice that
   exercises it) with `resyncDetachedCwdForLand` forced into a skip state, and asserts the resulting
   JSON `result` surfaces BOTH degradations together (not just the numbering one, not just the
   resync one) — e.g. a single `landDegraded: string[]` field collecting every warn-and-continue
   reason from one pass, so a caller can see the compounding shape instead of reconstructing it from
   two independent, unlinked fields.
2. The stderr narration for a pass with ≥2 such warnings is visibly different from a pass with one
   (e.g. a summary line count), so a human watching the terminal — not just a `--json` consumer —
   also sees the compounding.
