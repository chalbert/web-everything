---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-05"
dateResolved: "2026-07-05"
tags: []
---

# NNN collision self-heal gap on the serial-land route — rebase-drop must renumber-heal, plus document the standard

The 'newer yields' NNN-collision standard is real and mostly built — yield (local pre-commit), we:scripts/backlog-renumber-collisions.mjs (#2071 auto-heal: refile the later-lander + rewrite every inbound ref), we:scripts/pr-land.mjs post-land heal, guard-bash's renumber block, and the we:scripts/check-standards.mjs 'ids must be unique' gate. But there is a CONFIRMED deadlock on the SERIAL drain/pr-land route under branch protection: the self-heal runs only AFTER a clean merge, while check:standards runs inside the required 'test' job (we:.github/workflows/ci.yml). So a PR whose NEW item collides with an already-landed NNN fails the required check pre-merge, the merge is blocked, and the post-merge heal never runs. The drain rebase-drop (#2198, we:scripts/lib/rebase-drop-manifest.mjs) rebuilds behind PRs but only drops the shared lane-manifest file, not the id collision, so the rebuilt tip still carries the dup and stays red. The parallel /workflow integrator avoids this by healing the merged tree in one op; the serial route has no equivalent, so manual yield is the only escape (hit live: a resolveFile-fix item collided with a concurrently-landed item on the same number). FIX: (1) gate/automate — extend the rebase-drop rebuild to ALSO run the new-item id renumber-heal against main in the same rebuilt tip (a collision-with-a-landed-NNN implies the PR is behind, so the rebuild already runs), so it passes check:standards and merges; optionally a producer-side pre-push collision check as an early catch. (2) document — add an 'NNN collision, the standard resolution' subsection to we:docs/agent/backlog-workflow.md naming the whole pipeline and where it does and does not auto-fire.
