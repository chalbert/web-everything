---
bornAs: xb7cima
kind: story
size: 3
status: open
dateOpened: "2026-08-06"
tags: []
---

# Widen the bash hygiene guard to deny enumerate-then-add pipelines by EFFECT

The broad-stage hygiene rule denies git add -A / . / --all by FLAG SPELLING, and it lives only in a machine-global hook — the in-repo Bash guard denies no broad stage at all. PR #1064 hit that: a blocked command was re-spelled as an ls-files-to-xargs-to-add pipeline, reproducing the exact effect (a broad stage sweeping concurrent sessions' work) plus intent-to-add entries that make git restore truncate files to 0 bytes. Build the rule in-repo and match by EFFECT — any pipeline whose sink is a git add of an enumerated path set.

## What actually happened (PR #1064)

1. The `/converge` working-tree read needed untracked files visible to `git diff`. Its first draft used
   `git add --all --intent-to-add`. The guard fired.
2. The response re-spelled the command as an enumerate-then-add pipeline
   (`git ls-files --others --exclude-standard -z` piped into `xargs -0 git add --intent-to-add --`), which the
   guard's flag-spelling matcher does not recognise — same effect, different letters.
3. A test then pinned the SPELLING (*"NEVER uses `git add -A` / `.` / `--all`"*) rather than the invariant,
   freezing the bypass in place.

The effect the guard exists to prevent happened anyway, plus a worse one nobody predicted: intent-to-add entries
left in the index make `git restore <path>` **truncate a swept file to 0 bytes** (verified, git 2.50.1 — and that
is the exact recovery command the guard's own deny message prints), and make `git stash` fail
`Entry '<path>' not uptodate`, so every `pull --ff-only --autostash` in the repo dies
(we:scripts/pr-land.mjs, we:scripts/lib/main-staleness.mjs, we:scripts/check-readiness.mjs).

## The two holes

- **Match by SPELLING, not EFFECT.** The rule tests for `-A` / `.` / `--all` as literal flags. Any construction
  that reaches "stage a set of paths this session did not name" is equivalent and passes. Note the flag list is
  itself incomplete: `git add -u` / `--update` and `git add --pathspec-from-file=-` (with `--pathspec-file-nul`)
  each reach the same effect — verified on git 2.43.0: `printf 'a.txt\n' | git add --pathspec-from-file=-`
  stages `a.txt`, and `git add -u` stages every modified tracked file. Enumerating flags is the losing game;
  that is the whole point of matching by effect.
- **The matcher only inspects segments that START with `git`.** A post-pipe `xargs` sink, a `while read` loop
  sink, and a `find … -exec` sink are all invisible to it. *(2026-08-21 correction: this describes the
  machine-global hook. The in-repo guard already parses post-pipe segments and peels `xargs` — see `## Design`.
  Its hole is different and larger: it has no broad-stage arm at all.)*

## The shape of the fix

Classify by the SINK of a pipeline rather than by the head of a segment, in the pure `reason` / `decide` core of
`we:scripts/guard-bash.mjs` (so it stays unit-testable and rides the golden corpus):

- Deny a `git add` whose path set comes from an ENUMERATION the author did not write out: a pipe from
  `git ls-files` / `git status` / `find` / `ls`, an `xargs` sink, a `while read` loop variable, or `-exec`.
- Keep explicitly-named paths allowed — that is the sanctioned form the deny message already steers to.

## Design

### Where the guard actually is today (corrected against the live tree, 2026-08-21)

The digest above describes the **user-global** hook, not this repo. Grounded re-read:

- **The `-A`/`.`/`--all` spelling deny is NOT in this repo.** It lives in the user-global
  `~/.claude/hooks/` directory as the `guard-git-branch` hook (check 3 of three, per [we:agent-memory-src/never-push-guard-removed.md](agent-memory-src/never-push-guard-removed.md)) —
  a machine-global file that is absent from a lane clone and from CI. So it is untestable here, and the
  in-repo half of the rule has to be built, not widened.
- **`we:scripts/guard-bash.mjs` is the in-repo `PreToolUse(Bash)` hook** (wired at
  [we:.claude/settings.json](.claude/settings.json), whose `PreToolUse`/`Bash` entry runs
  `we:scripts/guard-bash.mjs` under `node`), and it has
  **no broad-stage arm at all**. Measured, not assumed — every one of these returns `null` today:
  `reason('git add -A')`, `reason('git add .')`, `reason('git add --all --intent-to-add')`, and the PR #1064
  pipeline `git ls-files --others --exclude-standard -z | xargs -0 git add --intent-to-add --`. `git add`
  appears **zero** times in the file. So this item is the first in-repo, CI-visible home for the rule, and the
  new arm is strictly additive — it can deny commands nothing denies today, and can weaken nothing.
- **"The matcher only inspects segments that START with `git`" is a hole in the GLOBAL hook, not in this one.**
  The in-repo plumbing already handles both shapes the card names as missing, verified by running it:
  - [we:scripts/guard-bash.mjs](scripts/guard-bash.mjs) `parseSegments` (`:702`) splits on `|` as well as
    `&&`/`;`, quote-aware — the PR #1064 command parses to two segments, the second being ` xargs -0 git add
    --intent-to-add --`.
  - `canonicalGitOp` (`:1138`) → `canonicalCommand` (`:216`) → `wrapperPrefixLength` already peel `xargs` /
    `env` / `sudo` / `nice` / a leading subshell, so `canonicalGitOp('xargs -0 git add --intent-to-add --')`
    already returns `'git add --intent-to-add --'`.

  There is therefore **no `normalizeGitSegment` to extend** (no such symbol exists); the normalizer is
  `canonicalGitOp`, and it is already sink-capable. The build is the *classifier + arm*, not new parsing.

### The seam

Two new pure exports beside the existing `isDestructiveLaneGitOp` (`:1163`) / `hasDestructiveLaneOp` (`:1186`)
pair, wired into `reason()` (`:1256`) exactly as that pair is:

```js
// we:scripts/guard-bash.mjs — pure, unit-tested, no fs/exec
/** Is this ONE segment a `git add` with no explicitly-written pathspec — i.e. `-A`/`--all`/`.`,
 *  a bare `git add` , or an `xargs`/`-exec` sink whose paths arrive on stdin/argv?
 *  Normalizes via `canonicalGitOp` first, so wrappers cannot hide the add. */
export function isUnnamedPathStage(segment) // -> { staged: boolean, form: 'flag'|'sink'|'loop'|null }

/** Does ANY segment of `command` stage a path set the author did not name? Pure. Mirrors
 *  `hasDestructiveLaneOp`'s segment walk, but ALSO reads the RAW (un-peeled) segment text and the
 *  PRECEDING segment, which is where the enumeration evidence lives. */
export function hasUnnamedPathStage(command) // -> { staged: boolean, form, source: string|null }
```

**Why the raw segment matters, and the one genuine parsing gap.** `parseSegments` returns segment **strings
with the connector discarded** — the `|` between `git ls-files …` and `xargs …` is not recoverable from its
output. So the classifier must not work from `canonicalGitOp` alone (that peel *erases* the `xargs` wrapper
which is the evidence). Read, in order: (1) the RAW segment — an `xargs`/`while read`/`-exec` wrapper around a
`git add`; (2) the PRECEDING raw segment's head — `git ls-files` / `git status --porcelain` / `find` / `ls`;
(3) only then `canonicalGitOp` for the flag form.

**State the rule as a NEGATIVE, never as a flag list.** The predicate is *"this `git add` carries no explicit,
literal, non-flag pathspec token"* — so `-A`, `--all`, `.`, a bare `git add`, `-u`/`--update`, and
`--pathspec-from-file=<f>` / `--pathspec-file-nul` all fall out of ONE rule rather than six entries a future
git release can outgrow. A `git add` with ≥1 literal, non-flag pathspec argument and no sink wrapper is the
**allowed** form. Writing this as an enumerated deny-list would rebuild the exact spelling-match defect the
item exists to close — one layer up.

### Delivery

1. `isUnnamedPathStage` + `hasUnnamedPathStage` in `we:scripts/guard-bash.mjs`, next to the existing
   destructive-op pair, sharing `canonicalGitOp` (never a second stripper — the #2994 r3 lesson recorded in
   that file's own comments).
2. Wire into `reason()` (`:1256`) as a new deny arm returning a message that names the EFFECT.
3. Unit cases in [we:scripts/__tests__/guard-bash.test.mjs](scripts/__tests__/guard-bash.test.mjs) (1516
   lines today — same `describe` style as the `isDestructiveLaneGitOp` block at `:192`).
4. One golden-corpus fixture under
   [we:scripts/golden-corpus/hook-guard-bash/](scripts/golden-corpus/hook-guard-bash/), fixture shape
   `{ id, cmd, ctx, basis, expect: { reason } }` (see `we:scripts/golden-corpus/hook-guard-bash/git-push-lane-ref.json`), replayed by
   [we:scripts/__tests__/golden-corpus-snapshot.test.mjs](scripts/__tests__/golden-corpus-snapshot.test.mjs).

The downstream harm this prevents is already documented and regression-pinned in
[we:scripts/lib/converge-transports.mjs](scripts/lib/converge-transports.mjs) (`:141-148`) and
[we:scripts/lib/__tests__/converge-transports.test.mjs](scripts/lib/__tests__/converge-transports.test.mjs)
(`:200-208`) — this item stops the *class*, not that one call site, which is already fixed.

## Done when

- `npx vitest run` against `we:scripts/__tests__/guard-bash.test.mjs` is green and covers, each as its own case:
  the PR #1064 pipeline `git ls-files --others --exclude-standard -z | xargs -0 git add --intent-to-add --`
  → denied; the three other sink shapes (`while read … ; do git add "$f"; done`, `find … -exec git add {} +`,
  and the direct `git add -A` / `git add .` / `git add --all` / bare `git add`) → denied; **plus the two
  no-explicit-pathspec flag forms an enumerated list would miss — `git add -u` / `--update` and
  `git add --pathspec-from-file=-` / `--pathspec-file-nul`** (both verified on git 2.43.0 to stage a path set
  the author never wrote out) → denied; and `git add path/a path/b` → **not** denied. (All of these return
  `null` from `reason()` on `main` today, so every case fails before and passes after.)
- The classifier is written as the NEGATIVE predicate, not a flag enumeration — checkable by reading
  `isUnnamedPathStage` in `we:scripts/guard-bash.mjs`: it decides on the ABSENCE of a literal non-flag pathspec
  token, so a git flag nobody listed here is denied by default rather than allowed by default.
- `npx vitest run` against `we:scripts/__tests__/golden-corpus-snapshot.test.mjs` is green with a new
  `we:scripts/golden-corpus/hook-guard-bash/*.json` fixture whose `cmd` is the PR #1064 pipeline and whose
  `expect.reason` is the new non-null deny string.
- `node we:scripts/check-standards.mjs` → 0 errors.
- The deny message names the EFFECT ("stages a path set you did not name") and contains no flag list — greppable:
  the new message string in `we:scripts/guard-bash.mjs` matches `/did not name/` and does not contain `--all`.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: prove the premise by mutation or reversion first) — I re-ran reason('git add -A'), reason('git add .'), reason('git add --all --intent-to-add'), and the PR #1064 xargs pipeline against we:scripts/guard-bash.mjs on main — all four return null, exactly as the card claims, and parseSegments/canonicalGitOp behave exactly as described (canonicalGitOp('xargs -0 git add --intent-to-add --') → 'git add --intent-to-add --').
- **blast-radius** (addressed; strategy: measure against the real corpus before wiring) — No fixture in we:scripts/golden-corpus/hook-guard-bash/ or case in we:scripts/__tests__/guard-bash.test.mjs currently exercises 'git add'/'xargs'/'ls-files', and every in-repo caller that runs git add (we:scripts/lane-drain.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs, we:scripts/conveyor/pr-watch.mjs, we:scripts/operations/review-prep-io.mjs) does so via exec()/spawn() array args with explicit pathspecs, not through the Bash-tool shell string this hook parses — the new arm is verifiably strictly additive.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Single seam confirmed both ways: the PreToolUse(Bash) CLI tail of we:scripts/guard-bash.mjs calls decide()→reason() (subprocess/hook caller, wired at we:.claude/settings.json:71), and we:scripts/__tests__/golden-corpus-snapshot.test.mjs ES-imports decide() from the same module — no second copy of the classifier exists to drift.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The plan's golden-corpus fixture is replayed through decide() end-to-end by we:scripts/__tests__/golden-corpus-snapshot.test.mjs (confirmed: it loads the 'hook-guard-bash' category and asserts decide() reproduces expect.reason), not just a unit test of the isolated pure classifier — a genuine round-trip at the seam.
- **population** (NOT addressed; strategy: name the population each threshold guards) — The 'Done when' test list enumerates only -A/./--all/bare-git-add plus the three named sinks (xargs, while-read, -exec); it omits git add -u/--update and git add --pathspec-from-file=-, both real git flags I verified (git 2.43.0) reproduce the identical 'stage a path set the author did not name' effect the card's own goal targets — see finding below.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card bakes mutation verification into its own acceptance criteria ('All of these return null from reason() on main today, so every case fails before and passes after'), and I independently reproduced every cited null, including the while-read and find -exec shapes not explicitly re-quoted in the card body.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Done-when requires the deny message to match /did not name/ and exclude '--all', and PreToolUse(Bash) denies always surface their reason string directly to the calling agent by construction (we:scripts/guard-bash.mjs's CLI tail writes hookSpecificOutput.permissionDecisionReason) — the failure is not silent by the hook mechanism itself.

**Corrections applied by this review:**

- The card's opening line attributes the -A/./--all broad-stage rule to '#883', but this repo's actual backlog item #883 (we:backlog/883-codify-the-repo-code-path-locus-convention-in-conventions-md.md) is the unrelated locus-prefix-citation convention — every other in-repo #883 citation (we:scripts/lint-locus-prefix.mjs, we:scripts/check-backlog-item.mjs, we:agent-memory-src/43-project_enforce_shared_gate_at_write_time.md) is about that same locus-prefix rule, not broad-stage git hygiene, and the repo's own memory index (we:agent-memory-src/index-batch.md:16) instead cites '#1147' for the concurrent-sweep/git-add-A concern — neither number resolves to a broad-stage-hygiene backlog item in this repo, so '#883' in the card's title framing is very likely a mis-citation (this repo's citation gates that would catch it — we:scripts/lib/citation-check.mjs's PR-number plausibility check — are explicitly not yet built, per that file's own header, so nothing currently flags it).

The preparation is exceptionally well-grounded — every line number, function name, and "returns null today" claim I re-ran against the live repo checked out exactly — and the design (a general "no explicit non-flag pathspec ⇒ deny" classifier wired once into `reason()`) is structurally sound and additive; the one real gap is that its own Done-when acceptance list under-names the population of "no-explicit-pathspec" git-add forms it should deny.

_Recorded through the declared `review-prep` operation._
