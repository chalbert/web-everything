---
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# closing-session step 3e's ahead-check snippet has no error handling and can crash lane reporting

PR #1720 review finding: `we:skills-src/closing-session/SKILL.md` step 3e's status/ahead snippet computes
`ahead` via a raw `execFileSync` git call (`git rev-list --count origin/<branch>..HEAD`) with no
try/catch, unlike the fail-safe `tryGit` wrapper `we:scripts/lane-pool.mjs`'s own `laneDirtyOrAhead` uses
for the identical computation internally. If any one of the session's held lanes lacks a local
`origin/<branch>` remote-tracking ref, the git call throws inside the snippet's `.map()` callback and kills
the whole `node -e` process — the agent gets a stack trace and zero rows for every held lane, not just the
one missing the ref.

## Done when

1. **Executable** — the step-3e snippet (or its replacement) wraps the ahead computation in try/catch,
   falling back to a null/`'?'` ahead value on failure (matching `tryGit`'s fail-open posture) instead of
   throwing. A lane with a missing local `origin/<branch>` ref no longer prevents reporting on the
   session's other held lanes.
