---
kind: story
size: 3
status: open
dateOpened: "2026-06-21"
tags: []
---

# Locus-prefix errors escape --scope and the write-time linter

Two gaps let batch-introduced bare code-path refs (#883) reach close-out red in batch-2026-06-20-1372-1369: (1) we:scripts/check-standards.mjs reports the locus-prefix violation as ONE aggregate, non-file-keyed finding, so check:standards --scope=<session> (file-keyed demotion, #952) shows 0 errors while the whole-repo gate shows the error in the session's OWN files — masking own-changeset breakage. (2) the PostToolUse linter we:scripts/lint-locus-prefix.mjs no-ops on a relative path (its regex requires a leading-slash /backlog|reports/) AND only runs on Edit/Write, so 'cat >>' / heredoc body-appends bypass it entirely. Fix: emit the locus-prefix finding per-file so --scope attributes it; relax the linter path match + add a pre-commit sweep.
