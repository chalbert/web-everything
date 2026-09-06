# `ops/pr-views` — the PR-view transport (#xaoja7a)

A reviewing host is not always a reading host. A cloud VM can run the whole `review-pr` operation but cannot
read the PR it is reviewing: `gh api` answers `403 GitHub access is not enabled`.

So the session pushes a **request** — `{repo, pr}` under `requests/` — and
[`we:.github/workflows/stage-pr-view.yml`](../../.github/workflows/stage-pr-view.yml), which holds a token,
runs `gh pr view --json` and commits the answer under `views/`. The session reads it with
`git show origin/ops/pr-views:<path>` and **never authors the material**.

That last clause is the whole point. Before this transport the session supplied the body, comments and file
list itself and nothing verified the transcription — on PR #1542 a staged view carried a paraphrase of the
body in the session's own voice plus a comment the session had written, stamped `authorAssociation: OWNER`,
that is not on the PR at all. A juror weights an owner's word above a drive-by by design, so a synthesized
one inverts the signal.

With this branch present, `stage-pr-view --from=<path>` is **refused** on this repo: the unverified route
closes the moment the verified one exists.

## Layout

| path | written by | read by |
| --- | --- | --- |
| `requests/<name>.json` | the reviewing session (`stage-pr-view --fromTransport`) | the workflow |
| `views/<name>.json` | the workflow, from `gh pr view --json` | the reviewing session |

Scripts come from `main`, never from this branch — a pushed request must not be able to ship the code that
processes it. See the workflow header for the full trust boundary.
