---
bornAs: xmiltwa
kind: story
size: 2
status: open
dateOpened: "2026-08-08"
tags: []
---

# A harvest whose grounding-verification failure rate crosses a threshold raises an alarm

Fork 1 of #2978 admits a note only if its quoted turn verifies against the real transcript. The falsification proves transcripts exist NOW (4,477 of 4,481 modified within 30 days), not that they are retained. If the harness prunes them or the user clears them, every note fails verification and routes silently to we:backlog/ — memory quietly stops being written and nothing says so. Fail-safe is the right direction; the silence is not. Alarm when the per-run verification failure rate crosses a threshold.
