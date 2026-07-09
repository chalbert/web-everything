---
kind: story
size: 5
parent: "2268"
status: resolved
dateOpened: "2026-07-04"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "we:scripts/mine-golden-corpus.mjs"
tags: []
---

# Harvest a golden corpus of skill/memory fixtures from git history

An idempotent miner that turns project history into replayable fixtures: each historical backlog create/resolve/settle, each memory add/change, and each hook-triggering commit (locus prefix, guard-bash, guard-lane) becomes an input+expected-output case. v1 mines a curated high-signal seed set; full-history sweep is a follow-on. The corpus is the shared fuel for both harness tiers.

## Progress (2026-07-09) — BUILT

Built `we:scripts/mine-golden-corpus.mjs` (+ its pure helpers in `we:scripts/golden-corpus-lib.mjs`,
unit-tested in `we:scripts/__tests__/golden-corpus-lib.test.mjs`) and ran it, committing the resulting
corpus at `we:scripts/golden-corpus/`. `npm run mine:corpus` reruns it.

- **backlog-claim / -resolve / -release (12 each)** — mined from real `backlog/*.md` commit history,
  SELF-VALIDATED at mine time: only kept if replaying the real `applyTransition` (`we:scripts/backlog/frontmatter.mjs`)
  against the mined `before` reproduces the historical `after` byte-for-byte.
- **backlog-settle (0)** — genuinely empty: git history has no commit where a born-active
  (`scaffoldedBy`-stamped) item's `scaffoldedBy` stamp is later stripped by a real `settle` (every
  historical `scaffoldedBy` item was either created already-resolved or never settled). Not a miner bug —
  confirmed by hand against the 8 commits that ever touched a `scaffoldedBy:` line.
- **backlog-created (12)** — a backlog item's first-appearance revision, for scaffold-shape regressions.
- **memory (12)** — `agent-memory-src/*.md` (+ the pre-#2266 legacy `.claude/agent-memory/*.md` home)
  index/per-entry add-or-change commits.
- **hook-locus-prefix (12)** — git-mined fix commits (before: `scanRepoLocusPrefixes` flags it; after:
  clean), found via this repo's own "fix locus-prefix" commit-message convention + a blind recency scan.
- **hook-guard-bash (16)** — spec-derived: guard-bash denies BEFORE a commit exists, so no historical
  "denied" commit is mineable. Each case is grounded in an incident documented in we:guard-bash.mjs's own
  header comment, run through the real exported `decide()` at mine time (a true snapshot of current
  behavior).
- **hook-guard-lane (4)** — spec-derived + TEMPLATED: guard-lane's input is a filesystem path classified
  against the real `~/workspace` layout, not portable as a literal path a corpus fixture could hardcode.
  Fixtures carry `{{PRIMARY_ROOT}}`/`{{LANE_ROOT}}`/`{{SCRATCHPAD_ROOT}}` placeholders for a future
  replaying harness to substitute.

Idempotency verified: rerunning the miner against the same repo state reproduces byte-identical fixture
files (no wall-clock/random input; the "corpus as-of" marker in `we:scripts/golden-corpus/index.json` is
the newest mined commit's date, not `now`). Full provenance/scope notes live in that same manifest's
`categories` map. `--limit`, `--locus-scan`, `--backlog-scan`, `--out` are the miner's re-run knobs.
