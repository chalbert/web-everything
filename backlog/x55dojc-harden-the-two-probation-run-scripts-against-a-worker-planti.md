---
kind: task
status: resolved
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs"]
dateOpened: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "93ccc0db51367ee26f2c92ebb85a9a093f1eb401"
tags: []
---

# Harden the two probation run scripts against a worker planting a git hook or gitignored config

we:scripts/operations/probation-heal-run.mjs and we:scripts/operations/probation-build-run.mjs both run an untrusted model (Codex/Antigravity) with filesystem write access inside a real git lane, then run git commit and verify-lane in that same lane. Neither inspects gitignored files or .git/hooks/, so a hostile or mistaken spec could plant a pre-commit hook or a config file the gate loads, which then executes with the launcher's own credentials at commit/gate time. Sandbox both run scripts against this (e.g. a pre-worker snapshot + post-worker scan of .git/hooks and known gate-loaded config paths, refusing the launch if any changed) or scope down what the worker's own launcher script grants. Flagged repeatedly by the converge panel on #4291's plan review (security lens, present since round 4).

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/lib/__tests__/git-hook-surface.test.mjs we:scripts/operations/__tests__/probation-heal-run.test.mjs we:scripts/operations/__tests__/probation-build-run.test.mjs` fails before this item lands (a real planted `.git/hooks/pre-commit` executes on a plain `git commit`, and both run scripts' fake-io arc tests reach `opened-pr`/`healed` even when the lane's git-hook surface cannot be cleaned or was tampered with mid-run) and passes after (the planted hook is inert once the process env is `withHooksDisabled`, and both arcs refuse — discard, never commit/push/open a PR — on an unclean baseline or a detected tamper). `npm run check:standards` stays green.

## Follow-ups filed rather than folded in here

- `we:backlog/xnygz00-cover-git-config-controlled-execution-paths-beyond-core-hook.md` — this fix is scoped to
  the traditional hooks mechanism (`.git/hooks/<name>`, `core.hooksPath`) only; a 2026-09-28 Codex plan review
  flagged `core.fsmonitor`, `clean`/`smudge`/`textconv` filters, and the newer `hook.<name>.command`/`.event`
  config-hooks as separate, broader config-controlled execution paths worth a dedicated pass.
- `we:backlog/x3j03qu-we-scripts-operations-probation-heal-run-mjs-s-arc-has-no-to.md` — found incidentally:
  unlike `we:scripts/operations/probation-build-run.mjs`, `we:scripts/operations/probation-heal-run.mjs`'s arc
  has no top-level try/catch, so an unexpected thrown error (e.g. from a lane a worker corrupted) propagates
  uncaught instead of escalating cleanly.
