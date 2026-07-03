---
kind: story
size: 2
status: open
dateOpened: "2026-07-02"
tags: []
---

# pr-land: bodyless `gh pr create` fails headless (title-only PR drops into an interactive prompt)

`we:scripts/pr-land.mjs` derives a PR title from the commit subject but, when no `--body`/`--body-file` is supplied, `buildCreateArgs` emits `gh pr create --title … --head lane/<ref>` with neither `--body` nor `--fill`. Run headless, `gh` then opens an interactive body prompt and errors ("Command failed"), so a bodyless land fails at PR creation. The `--fill` fallback is unusable for a remote-only `lane/*` head (gh diffs the head locally). Observed 2026-07-02 landing an ad-hoc change — it worked only once `--body-file` was passed. The `/workflow` integrator never hits this because the #2170 lane-review always composes a `--body-file`, so an ad-hoc / solo `/pr` is the exposed path.

## Fix

When a title is present but no body is given, pass a non-interactive body so create never prompts — e.g. `--body ""`, or derive a one-line body from the commit subject. Add a headless regression to `we:scripts/__tests__/pr-land.test.mjs`: `buildCreateArgs({ title, body: null })` must always include a body (or `--fill`), never a title-only argv.

## Second failure mode — `gh pr create` GraphQL 401 (2026-07-02, landing #2181)

A distinct `gh pr create` failure with the same blast radius: it intermittently returns `HTTP 401 Requires
authentication` on the GraphQL mutation **while the same keyring token succeeds at everything else** —
`gh api user` (REST), `gh api graphql {viewer}` (GraphQL read), and `gh pr merge` (GraphQL mutation). Not an
env-token override; scope is `repo` + `push:true`. It blocked landing #2181 until the PR was created out-of-band
via REST (`gh api -X POST repos/<o>/<r>/pulls -f title=… -f head=lane/<slug> -f base=main -f body=…`), after
which re-running pr-land found the open PR and merged normally. pr-land has no REST-create fallback today (only
`--fallback-git`, which bypasses the CI gate entirely — the wrong tool when only *create* is failing).

**Broader fix (covers both modes):** give pr-land a **REST create path** — try `gh pr create`, and on any
create failure fall back to `POST /repos/{o}/{r}/pulls` (which needs neither `--fill` nor a body prompt and
doesn't hit the GraphQL 401), then continue to wait→merge→heal. This subsumes the bodyless-headless fix above
(REST create always supplies a body) and makes an ad-hoc/solo `/pr` land robust to `gh`'s create flakiness.

Relates to the #2153 PR transport (#2138 Fork 5); surfaced while authoring the `/pr` skill.
