---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:skills-src/jury/subject-jury.workflow.js", "we:skills-src/jury/panel-fanout.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Jury panel launcher must return a file path and summary, never the whole result

FOUND 2026-09-20. In run wf_85a66389-bd2 the 7-seat panel completed (ok, $0.41, 7 findings lists) but the launcher subagent tried to relay the roughly 55 KB result through its structured output; the JSON failed to parse five times, and each retry drew an API refusal with the classifier label reasoning_extraction. The harness then reported spend 0 and needs-human with every lens unknown, which reads as no review happened when the review had run. The results survived only in the tool-results file. Also the launcher first step writes a scratch file with a heredoc, which the primary-cwd redirect hook blocks, wasting a turn. FIX: the launcher writes the panel result to a scratch file under the temp directory and returns only the path plus a short summary; the harness reads the file; spend is read from the panel record, not from the launcher; a failed relay with an existing panel record is a distinct verdict (relay-failed, results recoverable), never needs-human with zero spend. DESIGN TO SETTLE: file location and cleanup, and whether the harness should read the panel record directly and drop the launcher agent for that step. ACCEPTANCE: a test with a payload over 50 KB returns intact; a simulated launcher failure with a panel record on disk yields relay-failed and the recovered findings; the heredoc path is never used at the primary cwd.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
