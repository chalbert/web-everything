# Report — #3056 prep: closing the judge-spawn argv guard's one-token denylist (2026-08-16)

Run in preparation of [#3056](/backlog/3056-the-judge-spawn-argv-guard-is-a-one-token-denylist-a-flag-sh/)
(`assertNoForbiddenArgv` in `we:scripts/lib/judge-spawn.mjs` refuses only `--bare`; a flag-shaped `model`/
`mandate` value reaches argv unchallenged). No design survey applies here — this is an internal robustness /
security-boundary decision over an already-shipped helper module (`we:scripts/lib/`), not a greenfield web
standard, so this report grounds the fork's default against the repo's own statute layer and a recurring
CLI-hygiene pattern instead of a `/research/` prior-art topic.

## 1. Grounding read

Read in full, at the head of the lane (`origin/main` `2f388e5d`): `we:scripts/lib/judge-spawn.mjs` (the whole
module, incl. `buildJudgeArgv`'s existing per-field validation for `effort`/`budget`/`sessionId`/`shape`/
`allowedTools`) and `we:scripts/lib/__tests__/judge-spawn.test.mjs` (the existing pure-seam test style the
eventual build item's tests must match). Confirmed the item's own probe table (which flags pass `model`/
`mandate` today) against the source rather than trusting it — `buildJudgeArgv` at `we:scripts/lib/judge-spawn.mjs:
358-369` validates `model`/`mandate` only as `typeof === 'string'` and non-blank, matching the card's claim
exactly.

## 2. Statute-overlap check (#1886)

Grepped `we:docs/agent/platform-decisions.md` for anchors on deny-lists, allow-lists, argv, and spawn
permissions before drafting the fork. Two candidates surfaced:

- **`#guard-unresolvable-reexecution-denies`** (`we:docs/agent/platform-decisions.md:91-129`) — ratified
  2026-08-08, rules that at the primary checkout a bounded scanner must **deny** shell re-execution text it
  cannot fully resolve, because "an enumeration cannot be completed from inside the thing being enumerated: a
  deny-list over shell is unbounded, so the unknown case must fall closed." Structurally the closest anchor:
  same general shape (a deny-list defending a spawn boundary). **Citation-scope checked (#1932) before using
  it**: its own authoring scope is nested-shell-re-execution *text*, which is genuinely unbounded (unlimited
  nesting depth); #3056's denylist is over CLI *flag names*, a large but finite, documented set (`claude
  --help`). So the anchor does not settle "allowlist is infeasible here" the way it does for shell text — cited
  in the item as *supporting precedent* for the general lesson (enumerate-and-extend is the wrong shape for a
  security boundary), not as binding authority over which of (a)/(c) wins.
- **`#agent-runner-cli-backend`** (`we:docs/agent/platform-decisions.md:2914-2947`, Fork 2) — a sibling spawn
  decision in the same subsystem family (headless `claude` agent spawning), ruling the permission model is a
  static `--allowedTools` baseline **plus** the constellation's write-time deny hooks composing together.
  Read closely and judged **not overlapping**: that anchor governs *which tools a spawned agent may use once
  running* (a capability-grant question), not *whether a caller-supplied flag VALUE can smuggle a flag into the
  spawn's own argv* (a value-parsing-boundary question). Different subject, no collision — noted in case a
  future reader wonders why it isn't cited as authority.

## 3. Known-occurrences check (CLI-hygiene pattern, not a mint)

The recommended default (reject any `model`/`mandate` value starting with `-`) is not a novel invention —
recorded plainly rather than left to assertion:

- Python's `argparse` documents the "ambiguous option string" case a leading-dash positional/value creates, and
  the standard escape is a bare `--` end-of-options marker.
- GNU `getopt`'s own convention reserves `--` for the same reason: everything after it is positional, never
  re-parsed as an option.
- OWASP's argv-based (non-shell) command-execution guidance lists refusing a caller-controlled value that begins
  with `-` as a standard mitigation once shell metacharacters are already excluded by an argv-array spawn (which
  `judgeSpawn` already is — no `shell: true`, per the item's Mitigation 1).

## 4. Skeptic + two-confusion screen

Run per the `prepare-decision-item` skill passes 4–5, against the fork as drafted in the item. Verdicts pasted
into the item under Fork 1 as `Skeptic:` / `Screen:` lines; see the item body for the recorded outcome — not
duplicated here to avoid a second copy drifting out of sync with the ratified text.

## Appendix — files read

- `we:scripts/lib/judge-spawn.mjs` (whole file)
- `we:scripts/lib/__tests__/judge-spawn.test.mjs` (whole file)
- `we:docs/agent/platform-decisions.md` (grepped for `denylist|allowlist|allow-list|deny-list|argv|spawn|validate.*input|sanitiz`, then read `:85-129` and `:2908-2947` in full)
- `we:docs/agent/backlog-workflow.md` (the *Fork-readiness pass*, *Red-team the default*, *Per-fork classification pass*, *The prepared-fork shape* sections, `:306-433`)
- `we:backlog/3028-*.md`, `we:backlog/3050-*.md` (neighbour items, read for the propagation/independence claims #3056 cites)
