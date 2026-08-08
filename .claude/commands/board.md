---
description: Refresh and re-publish the operator's progress board — the fixed-path Artifact page showing the plan and its progress (routes to the progress-board skill)
---

Invoke the `progress-board` skill.

Run it on a **state change**, never on a timer: an item started/finished/blocked/unblocked, a PR landed, a
review verdict came back, a decision was taken.

`$ARGUMENTS` may carry a verb to pass straight through, e.g. `--start=<id>`, `--done=<id>`,
`--block=<id> --why="…"`, `--decide=<id>`, `--add="<title>" --phase=<n>`. With no arguments, just re-render
(pull-request state is derived live) and re-publish.

The rest of the stored half has verbs too: `--link=<id> --pr=<n>` / `--unlink=<id>` (the join to the live
half), `--retitle=<id> --to="…"`, `--remove=<id>`, `--phase-title=<n> --to="…"`, `--board-title="…"`,
`--repo=<owner>/<name>`, `--decision-remove=<id>`.

A decision must be **answerable from the page**, and the script enforces it: an `awaiting` decision without a
`question`, two or more options with exactly one recommended, and `ifNothing` makes the run exit 1 naming the
id and the field. Build it with `--decision-add="<title>" --question="…" --if-nothing="…"` (lands as a
draft), then `--decision-option=<id> --label="…" --detail="…" [--recommend]`, `--decision-evidence=<id>
--text="…"`, `--decision-set=<id> --field=<why|detail|…> --value="…"`, and finally
`--decision-set=<id> --field=status --value=awaiting`. A decision the operator has ruled but deferred is
`--field=status --value=queued`, not `--decide`.

The operator answers a decision by its **ruling number** — "R6 — as recommended" is `--decide=R6`. The board
assigns those numbers, never renumbers them and never reuses a retired one.

**Two calls, that is the budget:** one `node scripts/progress-board.mjs …` and one `Artifact`. Never read or
edit `we:reports/progress-board.html`, and never hand-edit `we:reports/progress-board.json` — every field
has a verb.

**NEVER hand-write a page and publish it to the board URL**, however blocked the operator is. The generator
owns the only template; a hand-written page silently drops the required fields and is overwritten by the next
run. `node scripts/progress-board.mjs --verify=<path>` checks a file you did not just generate, but read it
honestly: its **failure** is conclusive, its **pass** is not. The digest is unkeyed and its algorithm is in
the script, so a pass means "not accidentally disturbed", never "the generator wrote this".

**Publishing from any session that did not itself publish this board MUST pass the stored `artifactUrl` (the
CLI prints it) as the Artifact `url` parameter** — otherwise a new URL is minted and the operator's bookmark
dies.
