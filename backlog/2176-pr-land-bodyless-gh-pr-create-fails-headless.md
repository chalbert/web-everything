---
kind: story
size: 2
status: active
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
tags: []
---

# pr-land: bodyless `gh pr create` fails headless (title-only PR drops into an interactive prompt)

`we:scripts/pr-land.mjs` derives a PR title from the commit subject but, when no `--body`/`--body-file` is supplied, `buildCreateArgs` emits `gh pr create --title … --head lane/<ref>` with neither `--body` nor `--fill`. Run headless, `gh` then opens an interactive body prompt and errors ("Command failed"), so a bodyless land fails at PR creation. The `--fill` fallback is unusable for a remote-only `lane/*` head (gh diffs the head locally). Observed 2026-07-02 landing an ad-hoc change — it worked only once `--body-file` was passed. The `/workflow` integrator never hits this because the #2170 lane-review always composes a `--body-file`, so an ad-hoc / solo `/pr` is the exposed path.

## Fix

When a title is present but no body is given, pass a non-interactive body so create never prompts — e.g. `--body ""`, or derive a one-line body from the commit subject. Add a headless regression to `we:scripts/__tests__/pr-land.test.mjs`: `buildCreateArgs({ title, body: null })` must always include a body (or `--fill`), never a title-only argv.

Relates to the #2153 PR transport (#2138 Fork 5); surfaced while authoring the `/pr` skill.
