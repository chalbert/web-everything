---
bornAs: xp240uk
kind: task
status: open
dateOpened: "2026-08-20"
tags: []
---

# declare a verify operation so the conveyor can gate a lane without a model reading terminal output

The conveyor has declared operations for picking, claiming, dispatching and reviewing, but the step between 'work done' and 'open a PR' is hand-rolled shell every time: run the gate, read the tail, decide. That decision belongs in a declaration. A `verify` operation runs the repo's own checks in a named checkout and reduces them to a structured verdict, so a caller gates on data instead of on a model's reading of a terminal. Its load-bearing distinction is pass vs fail vs COULD-NOT-RUN — a check that never ran must never read as a check that passed.

## Why the third outcome is the whole point

A check that PASSED, a check that FAILED, and a check that COULD NOT RUN are three different facts. Hand-rolled
shell loses the third every time: a missing dependency, a crashed runner, an OOM kill or a renamed summary line
all exit non-zero with nothing parseable, and a grep for errors finds none in any of them.

Demonstrated rather than asserted, on a checkout carrying only a manifest and no toolchain:

- a `grep -c` for the error count over the gate's output → **0 matches**, which reads as green.
- The operation → `ok: false`, `unrun: 1`, blocking `did-not-run: exit 1 and no summary line found`.

So the classification rule is POSITIVE: a check is `pass` or `fail` only when its own summary line was found
and read. Absence of evidence is `unrun`, `unrun` is never folded into `fail`, and it never satisfies a gate.

This is #3203's lesson one layer up. There, a killed juror and a crashed juror arrived identically and taught
the reader to retry rather than look.

## It declares over an existing home — the first cut did not

`we:scripts/verify-lane.mjs` already runs a lane's suites and records the HEAD-keyed marker `pr-land`'s
finish-guard gates on (#2833). The first cut of this operation ran `check:standards` and vitest itself and
parsed their summary lines, which is a second implementation of a step that already had an authority — the
exact defect its own header forbade, committed because nothing looked for the existing home first.

It was not a stylistic slip. A parallel runner that skips the marker can report `ok` on a lane `pr-land` then
REFUSES to land, which is two answers to one question drifting apart silently.

What the declaration adds, given the home exists: the home speaks in exit codes and a marker vocabulary
(`green`, `red`, `running`, `corrupt`, `absent`, TTL-abandoned) and every caller that gates on it learns all of
that separately. This maps it onto the three outcomes a caller acts on, once — and buys its command line and
its HTTP route from the same declaration.

## Shape

Two `compute` steps and NO sink — verifying is a read, so `we:scripts/operations/http-adapter.mjs` derives a
GET-only surface with no run record, the path `suggest-next` and `gate-health` already take. The subprocess
work is injected, so every branch is reachable with no npm, no vitest and no clock.

The io shells the single home and nothing else. A cheaper approximation of the gate would be a second
implementation of it, which is the defect this is forbidden to introduce — and did introduce once.

`--checkout`, not `--cwd`: the adapter refused the first spelling because `--cwd` is its own control flag (the
juror's lane). The refusal was right and the name is better — the tree being verified is a different thing
from the lane a juror runs in.

## Done when

1. **Executable** — a test in `we:scripts/operations/__tests__/verify.test.mjs` asserting that a check whose
   output has no parseable summary is reported `unrun` and that the verdict is NOT `ok`, even with zero
   failures. Folding `unrun` into pass reddens it.
2. `node we:scripts/operations/run.mjs verify --help` prints flags derived from the declaration, with no argv
   parser written for it.
3. The operation reports a green lane as `ok` and a toolchain-less checkout as `unrun` — both verified live,
   not only against fixtures.

## The repo's own guards shaped it, three times

Worth recording, because each refusal was right and none of them was anticipated:

- the CLI adapter refused the input name `cwd` — it is the adapter's own control flag (the juror's lane), so
  the field became `checkout`, which is the better name anyway;
- `we:scripts/operations/__tests__/http-adapter.test.mjs` refused a new operation missing from its module map
  — *"a new one cannot slip past this file"* — and again for the pinned read-only list, which must be a
  deliberate edit;
- `we:scripts/check-backlog-item.mjs` caught two bare code-path refs in THIS card before CI did.

## Wired into the callers

An operation nobody is told to use will not be used, so the three places that state this step now name it:
`we:docs/agent/backlog-workflow.md`'s close-out gate (the rubric every skill points at),
`we:skills-src/conveyor/delivery-agent-brief.md` step 5 (the conveyor's own delivery agent), and
`we:skills-src/next-backlog-item/SKILL.md`'s close-out. Each says to read `verdict.unrun` before believing a
green, because that is the value the raw command cannot produce.

## Verified

Mutation-checked: making `ok` mean "no failures" reddens 2; falling back to the exit code when the summary is
unparseable reddens 2. Live: lane-2 reports `ok` with `0 error(s), 1391 warning(s)`; a checkout with no
toolchain reports `unrun` with the runner's own tail attached.
