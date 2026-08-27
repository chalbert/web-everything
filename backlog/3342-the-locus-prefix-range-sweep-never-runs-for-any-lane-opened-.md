---
bornAs: xuz681l
kind: task
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-27"
scope:
  - we:scripts/lint-locus-prefix.mjs
  - we:scripts/pr-land.mjs
tags: []
---

# The locus-prefix range sweep never runs for any lane-opened PR

The sweep runs in whichever clone the linter script itself lives in — the primary checkout, which does not have the lane's commit — so the range names a nonexistent revision and every lane-opened PR skips the check with a non-fatal warning.

## The failure

Every PR opened through `we:scripts/pr-land.mjs` from a lane clone prints:

```
locus-prefix range sweep could not run (Command failed: node …/lint-locus-prefix.mjs
  --range=origin/main..<sha>) — CI still backstops it
fatal: Invalid revision range origin/main..<sha>
```

`rangeCorpusFiles` in `we:scripts/lint-locus-prefix.mjs:72` shells out to git to enumerate the range. The
commit being landed lives in the **lane clone**; the sweep runs in the **primary checkout**, which has never
fetched it. So the range names a revision that does not exist there, git exits 128, and the sweep is skipped.

**Where the clone is chosen** — this is the part that decides where the fix goes.
`we:scripts/lint-locus-prefix.mjs:34` sets

```js
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
```

and `rangeCorpusFiles` passes `cwd: ROOT` to git, while `readDoc` reads `join(ROOT, file)`. So the sweep runs
in **the clone the script itself lives in**, whatever the caller's working directory is. `pr-land` resolves
`LOCUS_LINT` off its own `import.meta.url` too (`we:scripts/pr-land.mjs:729`), so an invocation of the primary
checkout's `pr-land` against `--repo=<lane path>` sweeps the primary checkout — even though it already passes
`cwd: REPO` on the very next line (`we:scripts/pr-land.mjs:730`).

Because every AI edit routes through a lane (#2123/#104), and every lane PR is opened by this path, **the
sweep is skipped on essentially every PR it was written to cover.** It is not intermittent.

## Why it is worth a card rather than a shrug

The warning says *"CI still backstops it"*, and that is true — the check does run in CI. So the consequence is
not unchecked prose landing; it is that the **fast local signal is dead** and the failure surfaces a CI round
later, on a PR already opened and labelled.

The more durable problem is the shape: a check that fails **open** with a reassuring message, on every
invocation, is indistinguishable from a check that is working. It was found twice today — independently, by two
agents, each treating it as noise from their own change before realising it fires for everyone. That is the same
signature as [#3327](/backlog/3327/): a failure belonging to no one gets read as background.

## Likely fix

**Retracted from the first version of this card:** *"Run the sweep in the lane… `pr-land` already knows the
lane path"*, filed under a `scope:` of `we:scripts/pr-land.mjs` alone. That reads as "pass the lane path as the
working directory", and a builder who tries it will find `cwd: REPO` **already there** at
`we:scripts/pr-land.mjs:730` and conclude the diagnosis is wrong. It is inert: `ROOT` is derived from the
script's own location, not from `cwd`, so no caller-side working directory can move the sweep.

The lever is in `we:scripts/lint-locus-prefix.mjs`. Three shapes, cheapest first:

1. Give the range mode an explicit repo root (a `--root=` flag, or honour `cwd` instead of `ROOT` when one is
   passed) and have `pr-land` hand it the lane path it already holds.
2. Invoke the **lane's own copy** of `we:scripts/lint-locus-prefix.mjs` rather than the copy sitting next to
   whichever `pr-land` is running.
3. Fetch the ref into the primary checkout before sweeping — most work, and it leaves the surprising
   script-location coupling in place for the next caller.

Worth checking whether anything else `pr-land` runs reaches for a commit the script's own clone has never seen;
the sweep may not be the only step with this coupling.

## Done when

1. **Executable** — opening a PR from a lane clone runs the locus-prefix sweep to completion, and a deliberate
   bare code-path reference in the lane's commit is **caught locally** rather than only in CI. Assert both: the
   sweep runs, and it still passes on a clean range.
2. `npm run check:standards` — 0 errors.
