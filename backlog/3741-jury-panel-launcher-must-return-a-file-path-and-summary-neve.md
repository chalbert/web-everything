---
bornAs: x1n25yr
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

RECURRENCE (2026-09-20, same day, second run). The same relay failure hit round 2 of run wf_de7a8ca4-29f (the design review of backlog 3739). Confirmed from that run's journal: round 1 relayed fine (a 62 KB panel result, ok, $0.48), but the round-2 panel record has no result and the round-2 reduce returned needs-human with all seven lenses unknown, exactly as in wf_85a66389-bd2. The panels DID run: the two round-2 panel results survive in two tool-result relay files of 60 KB and 64 KB, costing $0.58 and $0.61 (round-2 relay files; the $0.41 to $0.48 figures quoted in the hand-off are the first run and round 1). The zero spend reading is from the operator's report and was not visible in the journal. Size alone does not explain it: round 1 relayed a 62 KB payload fine while round 2 failed at 60 to 64 KB, so the trigger may be content (the first run drew an API refusal with the classifier label reasoning_extraction on the findings text) as much as length; the cause of the round-2 failure was not read from a transcript here, so a fix must not assume a size threshold. The verdict the harness reads must come from the panel record on disk, never from the launcher's relay, or a needs-human with all lenses unknown will again hide a completed review (the 3739 review was recovered by hand from the relay files).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
