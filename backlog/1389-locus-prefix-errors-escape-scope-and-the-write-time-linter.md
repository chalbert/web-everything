---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:scripts/lint-locus-prefix.mjs"
tags: []
---

# Locus-prefix errors escape --scope and the write-time linter

Two gaps let batch-introduced bare code-path refs (#883) reach close-out red in batch-2026-06-20-1372-1369: (1) we:scripts/check-standards.mjs reports the locus-prefix violation as ONE aggregate, non-file-keyed finding, so check:standards --scope=<session> (file-keyed demotion, #952) shows 0 errors while the whole-repo gate shows the error in the session's OWN files — masking own-changeset breakage. (2) the PostToolUse linter we:scripts/lint-locus-prefix.mjs no-ops on a relative path (its regex requires a leading-slash /backlog|reports/) AND only runs on Edit/Write, so 'cat >>' / heredoc body-appends bypass it entirely. Fix: emit the locus-prefix finding per-file so --scope attributes it; relax the linter path match + add a pre-commit sweep.

## Progress (2026-06-21, batch-2026-06-21-1385-1392)

**Gap (1) — gate per-file emit.** `we:scripts/check-standards.mjs` §6f now emits ONE finding **per file**
(`descriptor.file = <that file>`) instead of one aggregate carrying a corpus-wide `files: [...]` list. The
aggregate was un-attributable by `--scope`: `classifyFinding` is all-or-nothing on a finding's file set, so
a bundle spanning many sessions either blocked everyone (one mine → false red) or — when the session had
already committed its file (so it's no longer dirty-attributable) — demoted the session's OWN breakage to a
note (false green, the #1389 masking that bit #1382 this batch). Verified: two bad files now yield two
separate per-file error lines; a clean tree gates green under `--scope`.

**Gap (2) — linter relative paths + pre-commit sweep.** `we:scripts/lint-locus-prefix.mjs`:
- Path match relaxed to `(?:^|\/)(?:backlog|reports)\/[^/]+\.md$` — accepts both absolute (the hook) and
  relative (manual / staged) paths; the old `/(backlog|reports)/` silently no-op'd on a relative
  `we:backlog/x.md`.
- Added two **sweep** modes: `--staged` (lint every git-staged backlog/reports md — the pre-commit sweep
  that catches `cat >>` / heredoc appends bypassing the per-edit PostToolUse hook) and `--all` (whole
  corpus, CI/audit). Each emits one per-file line, exit 2 on any finding. Wired as `npm run lint:locus`
  (= `--staged`). Single-file hook path unchanged.
- Verified all three modes: relative single-file → exit 2; `--all` and `--staged` find a staged bad ref;
  clean file → exit 0.

Run `npm run lint:locus` before a commit to sweep staged docs (the heredoc-bypass backstop); the per-edit
hook still covers Edit/Write in real time.
