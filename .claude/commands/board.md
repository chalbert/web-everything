---
description: Refresh and re-publish the operator's progress board — the fixed-path Artifact page showing the plan and its progress (routes to the progress-board skill)
---

Invoke the `progress-board` skill.

Run it on a **state change**, never on a timer: an item started/finished/blocked/unblocked, a PR landed, a
review verdict came back, a decision was taken.

`$ARGUMENTS` may carry a verb to pass straight through, e.g. `--start=<id>`, `--done=<id>`,
`--block=<id> --why="…"`, `--decide=<id>`, `--add="<title>" --phase=<n>`. With no arguments, just re-render
(pull-request state is derived live) and re-publish.

**Two calls, that is the budget:** one `node scripts/progress-board.mjs …` and one `Artifact`. Never read or
edit `we:reports/progress-board.html`, and never hand-edit `we:reports/progress-board.json` — every field
has a verb.

**Publishing from any session that did not itself publish this board MUST pass the stored `artifactUrl` (the
CLI prints it) as the Artifact `url` parameter** — otherwise a new URL is minted and the operator's bookmark
dies.
