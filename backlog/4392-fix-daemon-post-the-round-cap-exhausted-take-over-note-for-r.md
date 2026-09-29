---
bornAs: xsaj6u9
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/"]
dateOpened: "2026-09-29"
tags: []
---

# Fix daemon: post the round-cap-exhausted take-over note for real, and surface it as a health finding

Live 2026-09-29 ~12:25 AM ET: PR #2867's advisory-fix loop hit its 3/3 round cap and stopped, but the fix-dispatch daemon's take-over note only ran in DRY-RUN ('note-comment round-cap-exhausted … DRY-RUN, would post') so nothing was posted; the PR sat idle for over an hour until the orchestrator's stuck-PR watch found it. MVP: post the note for real (keyed, once per head) from the reconcile-fix-dispatch note path, and have the health daemon open a finding for round-cap-exhausted PRs. Must: test that the note posts once per head; live proof: the next exhausted PR gets the note and a health finding.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
