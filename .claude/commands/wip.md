---
description: Print the operator's work-in-progress report (script-generated, work-item centred, attention first).
---

Run this as ONE normal FOREGROUND Bash call (about 15-20 s; never `run_in_background`, never Monitor, never a subagent), then print its output VERBATIM and nothing else. Do not add, drop, reword, reorder or summarise anything, and do not add a preamble or a closing line:

export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf GIT_CONFIG_VALUE_0=git@github.com:; cd ~/workspace/wev-wip-run && git fetch -q origin lane/mechanical-dispatcher && git checkout -q -B lane/mechanical-dispatcher origin/lane/mechanical-dispatcher && node scripts/operations/wip-report-cli.mjs --stamp

<!-- Interim: wev-wip-run is a dedicated read-only clone no worker uses, so the reset above is safe. The hard-coded personal-clone path stays only until the report CLI graduates to main (#3443); then run it from the current checkout and drop the clone. -->

If the command fails, print its error and say the report is unavailable; do not compose one by hand.

`Done since` is scoped by the persisted last-`/wip` stamp, not by this conversation. For the raw process view (every session, liveness, supervisor and executor), run the same command with `--sessions` instead of `--stamp`.
