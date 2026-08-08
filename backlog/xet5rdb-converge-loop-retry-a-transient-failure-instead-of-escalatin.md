---
kind: story
size: 3
status: open
blockedBy: ["2908"]
dateOpened: "2026-08-08"
tags: []
---

# Converge loop: retry a transient failure instead of escalating it to the operator

Under #2908 the loop reaches the operator on breakage — the editor could not push, a mandatory lens did not run, or the diff could not be fetched. Today a network blip, a clone timeout and a genuinely conflicted branch all escalate identically, spending operator attention on hiccups. Classify transient vs real and retry the transient class once before escalating. No fork here: nobody argues a flaked gh call deserves a human, so this is a build, not a decision.
