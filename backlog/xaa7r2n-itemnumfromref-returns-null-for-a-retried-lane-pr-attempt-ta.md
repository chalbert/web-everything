---
kind: story
size: 3
parent: "3383"
status: active
dateOpened: "2026-09-02"
dateStarted: "2026-09-02"
tags: []
scope:
  - we:scripts/readiness/
---

# itemNumFromRef returns null for a retried lane PR (attempt-tag letter, e.g. lane/3441b-...), making the PR invisible to fix-spawn planning

**Reproduced live tonight (2026-09-02), not hypothetical.** `we:scripts/readiness/conveyor-state.mjs`'s
`itemNumFromRef(ref)` extracts a backlog item id from a PR's `headRefName`. A normal lane ref
(`lane/2611-conveyor-state`) matches its primary pattern, `/lane\/(\d+)(?:-|$)/i` — digits immediately
followed by a hyphen or end-of-string. A RETRIED dispatch's branch name glues an attempt-tag letter
directly onto the number instead (`lane/3441b-resolve-on-land-extractor`, a "b" retry of item #3441) — after
`\d+` matches `3441`, the next character is `b`, not `-` or end-of-string, so the primary pattern fails. The
JIT-slug fallback (`x[a-z0-9]{5,7}`) also fails (no `x` prefix), and the last fallback (`/-(\d+)$/`, trailing
digits at the very end) fails too, since the ref ends in a word. `itemNumFromRef` returns `null`.

Confirmed directly against the real repo tonight: `gh pr view 1851 --json headRefName` →
`"lane/3441b-resolve-on-land-extractor"`. Running `we:scripts/readiness/conveyor-state.mjs --json` and
finding that PR's own entry in `prs[]` shows `"num":null,"prNumber":1851,...,"labels":["review:changes",...]`.
A live, unrelated `review:changes` bounce sits on this PR (a real fix is owed), but tick-core's
`planFixSpawns` (`we:scripts/conveyor/tick-core.mjs`) filters on `launched.has(normNum(p.num))` — with
`p.num` null, the PR can never be matched to a launched item, so no fix is ever planned for it. The same
`num: null` shape also drops the PR entirely from `we:scripts/readiness/conveyor-instrument.mjs`'s
`gatherRecords` (`if (num == null) continue; // a non-lane PR (not a conveyor item) — skip`), and would
equally starve `planCiHealSpawns`, which filters the same way. **One correction to the initial diagnosis,
checked rather than assumed:** the brief that raised this suspected the SAME class of failure also broke
`we:scripts/conveyor/review-status-tag.mjs --pr=1847`. That is not so — checked directly: PR #1847's own
`headRefName` is `lane/3421-auto-file-fix-blocking-hiccup` (no attempt-tag; `itemNumFromRef` parses it fine,
`num:"3421"`), and `we:scripts/conveyor/review-status-tag.mjs` doesn't call `itemNumFromRef` at all — it
matches live agents by session NAME only (`review-<pr>`/`fix-<pr>`). Running it with `--pr=1847` (rather than
the script's actual CLI shape, a bare positional pr **and** a required `--repo=<owner/name>`) just prints its
own usage line and exits — an invocation mistake, unrelated to this bug. Only PR #1851 is confirmed to hit
this regex gap tonight.

**Blast radius (grepped `itemNumFromRef` across `we:scripts/`):** two call sites, both in
`we:scripts/readiness/`:
- `we:scripts/readiness/conveyor-state.mjs:206` — `shapePrs()`, which stamps `num` onto every PR row in
  conveyor state (`state.prs[]`). This is the root: every other symptom flows from this one shape.
- `we:scripts/readiness/conveyor-instrument.mjs:501` — `gatherRecords()`, which silently skips any PR whose
  `itemNumFromRef` comes back null, so a retried PR's lane-board timing/instrumentation record never exists.

Neither `we:scripts/conveyor/tick-core.mjs` (`planFixSpawns`/`planCiHealSpawns`) nor
`we:scripts/conveyor/pr-watch.mjs` call `itemNumFromRef` directly — they consume `state.prs[].num` as
already-shaped data from `we:scripts/readiness/conveyor-state.mjs`, so fixing `itemNumFromRef` itself fixes
their behavior too, with no separate change needed at those call sites.

**The fix should mirror an ALREADY-CORRECT precedent already living in this repo, not invent a new
grammar.** `we:scripts/conveyor/lease-reaper.mjs` solves the identical parsing job twice, correctly, and its
own docblocks explain why: `itemNumFromSession` matches session names against
`/^(?:conveyor|fix|prepare-decision|prepare)-(\d+)[a-z]?$/i` (the dispatcher's own retry-naming convention —
`conveyor-2500b` "collapses to the base number so a live retry and its base share one key"), and
`laneRefItemNum` matches head refs against `/^lane\/(x[a-z0-9]{5,7}|\d+)[a-z]?-/i` — the exact ref shape this
bug is about, already handling the attempt-tag letter for both the numeric and JIT-slug forms. The two
functions exist specifically so "the lease reaper and the dispatch observer... can never disagree about
which ref belongs to which item" (`laneRefItemNum`'s own docblock) — `itemNumFromRef` is a THIRD,
independent re-implementation of this same grammar that had drifted out of sync with the other two. The fix:
add the same optional `[a-z]?` attempt-tag allowance to `itemNumFromRef`'s primary and JIT-slug branches,
placed BEFORE the `(?:-|$)` delimiter (not after — `itemNumFromRef`, unlike `laneRefItemNum`, must also
accept a bare `lane/2611` with no trailing slug or hyphen at all, which `laneRefItemNum`'s anchored
`...[a-z]?-` does not need to support). Concretely:
`/lane\/(\d+)[a-z]?(?:-|$)/i` and `/lane\/(x[a-z0-9]{5,7})[a-z]?(?:-|$)/i`.

**Why this doesn't collide with a real numeric suffix that happens to end in a letter — the numeric branch is
clean; the JIT-slug branch has a real, but currently unreachable, ambiguity, checked by hand rather than
assumed away.** The numeric branch is unambiguous: `\d+` is pure digits, so any trailing letter it meets is
by construction the attempt-tag, never part of the id itself (confirmed by `we:scripts/backlog.mjs`'s
JIT-numbering scheme — an item is minted `x<hash>` or a plain `NNN`, no third "digits+letter" id shape ever
exists). The JIT-slug branch is different: `[a-z0-9]{5,7}` is *itself* variable-length (5 to 7 base36 chars),
so a base slug shorter than the 7-char cap plus a 1-letter retry tag can total a length that is ALSO a valid
bare-slug length — e.g. a real 6-char slug `e2fmix` retried once (`e2fmixb`, 7 chars) is indistinguishable
from a genuine 7-char slug `e2fmixb` with no retry at all; the greedy `{5,7}` swallows the whole 7 chars as
one slug and the trailing `[a-z]?` never gets a turn. Verified by hand (see Done-when #3): ONLY a base slug
already at the 7-char cap disambiguates correctly (an 8th trailing letter cannot be absorbed into `{5,7}`, so
it is forced into the separate `[a-z]?` group). **This ambiguity is accepted, not a blocker, for two
grounded reasons:** (1) it is EXACTLY the same shape `we:scripts/conveyor/lease-reaper.mjs`'s own
`laneRefItemNum` — the precedent this fix mirrors — already carries, unaddressed, so this fix introduces no
new risk beyond what the repo already ships and trusts; (2) it is currently unreachable in practice —
`itemNumFromSession`'s own grammar (`/^(?:conveyor|fix|prepare-decision|prepare)-(\d+)[a-z]?$/i`) only ever
retries a DIGIT-identified session, never an `x`-hash one, so no JIT-slug item is ever actually retried
today. If that ever changes, this ambiguity becomes live and should be revisited then — noted explicitly so
it isn't silently rediscovered.

## Done when

1. **Executable — the core regression.** `we:scripts/readiness/__tests__/conveyor-state.test.mjs` gets a new
   case: `expect(itemNumFromRef('lane/3441b-resolve-on-land-extractor')).toBe('3441')` (not `null`). Fails
   before this item's fix lands, passes after.
2. **Executable — no regression on the existing matrix.** Every existing `itemNumFromRef` test in the same
   file still passes unchanged: the plain numeric ref (`lane/2611-conveyor-state` → `'2611'`), the
   no-slug numeric ref (`lane/2611` → `'2611'`), the JIT-slug ref (`lane/xe2fmix-slug` → `'xe2fmix'`), the
   word-first fallback (`lane/hotfix-2611` → `'2611'`, NOT `'hotfix'`), and the null-returning cases
   (`lane/hotfix`, `lane/conveyor-work`, `main`, `null` — all → `null`).
3. **Executable — a JIT-slug retry case**, even though no live example was observed tonight (JIT-slug items
   don't currently get attempt-tag retries per `itemNumFromSession`'s own digit-only grammar — see the
   root-cause narrative above): `expect(itemNumFromRef('lane/xe2fmixyb-slug')).toBe('xe2fmixy')` — a
   MAX-LENGTH (7-char) base slug plus a retry letter, the one case that disambiguates correctly. (A
   shorter-than-max base slug plus a retry letter is genuinely ambiguous with a longer valid slug of the same
   total length — see the root-cause narrative's own paragraph on this; accepted as a known, currently
   unreachable limitation mirroring existing `laneRefItemNum` precedent, not something this item's fix needs
   to solve.)
4. **Blast-radius call site #1 (`shapePrs`) re-verified with an executable test, not just the unit fixed in
   isolation.** `shapePrs()` (`we:scripts/readiness/conveyor-state.mjs`) produces `{num:'3441', ...}` for a PR
   row whose `headRefName` is `lane/3441b-...` (not `num:null`) — covered directly in
   `we:scripts/readiness/__tests__/conveyor-state.test.mjs`'s own `describe('shapePrs...')` block.
   Blast-radius call site #2 (`gatherRecords` in `we:scripts/readiness/conveyor-instrument.mjs`) is NOT
   independently unit-testable — it is an un-exported IO function that shells `gh` directly via its own
   internal `gh()` helper with no injectable seam (checked directly, not assumed) — so its correctness rides
   entirely on `itemNumFromRef`'s own fix; no separate test is owed here, but a builder touching this item
   should note the seam gap rather than silently skip it.
5. Live sanity check (manual, not a Done-when gate that blocks merge, but worth re-running once the fix
   lands): `node we:scripts/readiness/conveyor-state.mjs --json` against PR #1851 shows `"num":"3441"`
   instead of `"num":null` for that PR's entry in `prs[]`.
