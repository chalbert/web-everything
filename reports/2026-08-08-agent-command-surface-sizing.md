# What agents actually run — sizing the operation catalog

**Date:** 2026-08-08
**Corpus:** 4,485 local session transcripts (1.8 GB), 64,752 `Bash` tool invocations
**Published sketch:** https://claude.ai/code/artifact/85a9edf8-1b8b-48d5-9e24-146c3668c8be

## Why this was measured

The end-state direction is a web UI that mechanically drives the work, with Claude launched to *operate*. That
raises a design question the guard work keeps circling: should an agent session write shell commands at all, or
should it call **named operations** from an allow-list that the mechanical layer executes?

Six review rounds on the command guard (PR #1092) tried to enumerate every way a command hands a hidden script
back to the shell, and each round found more. The sixth reviewer found the structural reason: the fuzz
generator's wrapper list *was* the list of classes the previous fix had implemented, so three million generated
pairs could only re-prove what was already handled. **An enumeration cannot be completed from inside the thing
being enumerated.**

A deny-list over shell is unbounded. An allow-list over operations is finite by construction. The open question
was never which is safer in principle — it was whether the finite list is small enough to be worth building.
This report measures that, from real usage rather than from imagination.

## Method

Every `tool_use` block naming the `Bash` tool was extracted from the local transcripts under
`~/.claude/projects/**/*.jsonl`. Each command string was split into its constituent commands with a
**quote-aware** splitter (separators inside `'...'` / `"..."` are literal text), heredoc bodies were treated as
**data rather than shell**, and each resulting segment was classified by verb plus subcommand.

**Known imprecision — this sizes a catalog, it does not enforce anything.** The splitter does not handle nested
quoting subtleties or process substitution properly. Its errors run toward **over**-counting mutations
(redirect-writes of throwaway temp files count as mutations; a few read-only `git` plumbing verbs may too), so
the real catalog is likely *smaller* than the figures below, not larger. Which checkout each command targeted
was **not** measured — the read/mutate split is corpus-wide, not per-lane.

## What agents actually do

295,923 classified command segments:

| Class | Segments | Share |
| --- | ---: | ---: |
| Reads (`grep`, `ls`, `git log`, tests) | 213,705 | 72.2% |
| Navigation (`cd` — changes nothing) | 38,044 | 12.9% |
| **Mutations** | **19,845** | **6.7%** |
| Shell control keywords (`if`, `done`) | 19,161 | 6.5% |
| Inline scripts (`node -e`, heredocs) | 5,094 | 1.7% |
| **Shell re-entry** (`bash -c`, `eval`, …) | **74** | **0.03%** |

Two findings dominate:

1. **Only 6.7% of what an agent runs mutates anything.** A catalog only has to cover mutations; reads can stay
   free and sandboxed, which is where an operation list would otherwise chafe worst.
2. **Shell re-entry — the entire subject of six review rounds — is 74 segments in 295,923.** Counting
   generously from raw text instead of the segmenter, every re-entry-ish spelling together (`bash -c`, `eval`,
   pipe-into-shell, `xargs`, process substitution, `find -exec`, `nohup`/`exec`, `trap`) reaches **1.7% of
   calls**, and the genuinely unparseable forms are about **120 calls in 64,752** — under 0.2%.

## The catalog is small because the tail is thin

232 distinct mutating operations exist across the whole corpus, but the curve is steep:

| Operations | Coverage of all mutations |
| ---: | --- |
| 6 | 50% |
| 25 | 90% |
| 34 | 95% |
| 53 | 99% |
| 232 | 100% (the full tail) |

The last 179 operations buy the final 1%. That tail is what a capability-gap note is for — it is not built up
front, it is allowed to ask.

## Shape of the catalog

Grouped by what the agent is trying to accomplish rather than by which binary it reached for. Counts are
observed mutation segments.

| Family | Operations | Absorbs | Count |
| --- | --- | --- | ---: |
| Lane lifecycle | `lane.create` `lane.refresh` `lane.discard` | `git clone/init/worktree/fetch/reset/clean/checkout` | 4,095 |
| Committing | `lane.stage` `lane.commit` `lane.amend` | `git add` `git commit` | 3,736 |
| Publishing | `lane.push` `lane.rebase` `lane.apply_patch` | `git push/rebase/merge/pull/stash/apply/update-ref` | 1,587 |
| Pull requests | `pr.open` `pr.label` `pr.comment` `pr.merge` `pr.close` | `gh pr …` | 1,236 |
| Files | `file.write` `file.delete` `file.copy` `file.move` `dir.create` `file.link` | redirects, `tee`, `rm`, `cp`, `mv`, `mkdir`, `ln`, `sed -i` | 6,278 |
| Build & verify | `build.typecheck` `build.run` `deps.install` `gate.check_standards` `gate.verify_lane` | `npx tsc` `npm run` `npm ci` | 574 |
| Outside world | `net.fetch` `proc.signal` `backlog.mutate` | `curl` `kill` `pkill`, the backlog scripts | 724 |

28 operations across seven families, covering **95.3%** of observed mutation volume.

**Roughly 83 of these already exist in some form** — 18 slash commands plus 65 `we:scripts/*.mjs`, including
[`we:scripts/pr-land.mjs`](scripts/pr-land.mjs), [`we:scripts/lane-drain.mjs`](scripts/lane-drain.mjs),
[`we:scripts/verify-lane.mjs`](scripts/verify-lane.mjs) and
[`we:scripts/check-standards.mjs`](scripts/check-standards.mjs). This is less "build a catalog" than "finish and
close the one that grew by accident."

## The rule that makes it safe

An operation like `run(script, args)` that passes strings through to a shell re-imports the entire enumeration
problem behind a friendlier name. `pr.merge(number: int)` does not. **Typed parameters are the whole
difference between an allow-list and a rename.**

## Sandboxing is not a substitute

A sandbox bounds *damage*; an allow-list bounds *authority*. A sandbox does not stop a force-push to `main` or
a `gh pr merge` — those are legal actions performed with real credentials, and they are the ones that hurt
here. The two solve different problems and both are wanted.

## Observed live during this analysis

Three false denies fired from [`we:scripts/guard-bash.mjs`](scripts/guard-bash.mjs) while running read-only
commands for this report, all in the tree-write arm:

- `we:scripts/lane-pool.mjs status --json` piped with `2>&1` — a file-descriptor dup that writes nothing.
- `node -e "…d => s += d…"` — a JavaScript **arrow function** inside a quoted argument, read as a redirect.
  Quote-blindness.
- `sed -n '30,90p'` over a `backlog/*.md` file — `sed -n` prints; only `sed -i` edits.

These are the same class PR #1092 is fixing and are recorded here as additional corpus for its false-deny
sweep.

## Bearing on the open guard decision

The measured cost of *"refuse what the guard cannot resolve"* is very small: the affected forms are under 0.2%
of calls, so the false-deny sweep that sizes it is cheap. A further round of enumeration, by contrast, would be
investment in an asset this direction demolishes — and the next round's evidence would again be generated from
the next round's own list.
