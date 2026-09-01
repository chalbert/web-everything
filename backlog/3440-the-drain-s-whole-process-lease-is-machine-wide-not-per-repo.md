---
bornAs: x7zvj0x
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
scope:
  - we:scripts/readiness/
  - we:scripts/lane-drain.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/drain-push-at-close.mjs
  - we:scripts/__tests__/
---

# The drain's whole-process lease is machine-wide, not per-repo -- one project's daemon can silently starve another's

Found live 2026-09-01, closing out this same session. `we:scripts/merge-ai-prs.mjs --this-repo` refused to run:
"another drain already holds the whole-process lease (Mac:1756:drain-daemon) — no-op; its next pass covers
this work (#2449/#2391)." That PID turned out to be `plateau:tools/drain-daemon/daemon.mjs` — a DIFFERENT
project's resident drain, running since Monday, holding a lease keyed only by hostname+pid, not by repo. It
will never sweep `web-everything`'s own PRs (it doesn't operate on this repo at all), yet it correctly-per-its-
own-contract refuses any OTHER drain invocation on the same machine, including one scoped to a different repo
via `--this-repo`. Concretely: a stranded backlog item (`backlog/xb2rz0g-*.md`, now `#3439`) sat unnumbered on
`main` for the rest of this session because nothing was actually watching `web-everything` for it — the
resident lease made it LOOK like a drain was covering the repo when it structurally could not.

## Done when

1. **Executable** — the whole-process lease key includes the repo (or repo root path), not just
   hostname+pid, so a resident drain for one project never blocks (or falsely appears to cover) another's
   drain invocation — with a real test proving two different repos' drain runs can hold their own leases
   concurrently on the same machine.
2. Until fixed: anyone running a solo/manual drain sweep on `web-everything` (or any repo sharing this
   machine with `plateau-app`'s resident daemon) should check `ps aux | grep drain-daemon` first and not
   assume a held lease means their own repo is covered.
