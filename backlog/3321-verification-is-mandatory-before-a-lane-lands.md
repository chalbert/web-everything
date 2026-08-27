---
bornAs: xq0034b
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/lane-verify.mjs
  - we:scripts/__tests__/lane-verify.test.mjs
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/lane-drain.test.mjs
  - we:scripts/pr-land.mjs
  - we:skills-src/batch-backlog-items/parallel-execute.workflow.js
  - we:skills-src/batch-backlog-items/SKILL.md
  - we:docs/agent/backlog-workflow.md
  - we:agent-memory-src/single-session-should-use-a-lane.md
  - we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md
  - we:backlog/2833-subagent-stall-reaping-detect-a-subagent-blocked-on-a-backgr.md
tags: []
---

# Verification is mandatory before a lane lands

requireVerified defaults false, so a lane can land without its own suite having run — 18 of 39 confirmed review findings had their input available at COMMIT time, where a suite could have caught them. lane-verify already runs test:unit plus check:standards, sha-keyed, with running-detection for the stall case; this flips the default and handles the break-glass path. Cheapest change in the programme, and it would have caught a red test sitting in the authoring lane.

Do not read this against the parent card's 21 of 39: that is WRITE time — input present the moment the bytes were authored — a different and larger measurement.

## What the flip actually is

`resolveVerifyOptions` in `we:scripts/lib/lane-verify.mjs` resolved `requireVerified` as
`!!flags['require-verified'] || env.WE_REQUIRE_VERIFIED === '1'` — **absent meant "don't bother"**. And
`verifyGateDecision`'s own parameter defaulted `requireVerified = false`, so a caller that simply forgot to pass
the resolved option got the permissive gate. Both now default to required, and there are two documented escapes at
deliberately different strengths:

| escape | spelling | relaxes |
| --- | --- | --- |
| **opt-out** | `--no-require-verified`, `--require-verified=0\|false\|no\|off`, `WE_REQUIRE_VERIFIED=0\|false\|no\|off` | only the *we never saw a result* cells: absent/stale marker, and `red`. A fresh `running` marker (the #2833 stall) and a `corrupt` marker **still refuse** — those are evidence of a BROKEN verification, not a missing one. |
| **break-glass** | `WE_LAND_UNVERIFIED=1` | every cell, including stall and corrupt. Reported as a separate `breakGlass` field, so it can never be mistaken for the narrow opt-out. |

Only an **explicit** negative opts out. `WE_REQUIRE_VERIFIED=` (empty) stays required: an env var set to empty is
an accident, and a fail-closed gate must not read an accident as consent. When the inputs **conflict**, the
deliberate one wins and it wins toward verifying: an explicit `--require-verified` beats an ambient
`WE_REQUIRE_VERIFIED=0`, and `--require-verified` beats a simultaneous `--no-require-verified`.

## Flipping the default is only half the item — the call sites have to match

**This section corrects the first cut of this card, which scoped the work to the resolver alone.** It said the
change lands "in the single shared resolver both entry points already call", and listed a scope of exactly
`we:scripts/lib/lane-verify.mjs` + its test. **That was wrong, and shipping it that way would have wedged the
drain.** Inverting a default silently re-points every caller that passes nothing, so the callers are part of the
change, not downstream of it.

`we:scripts/lane-drain.mjs`'s `buildPrLandArgs` built a flag-free `pr-land` argv. Under the new default that
resolves to `requireVerified: true`, and the drain lands WE from the **primary checkout** while the lane it lands
is a **separate clone** — so the lane's `.git/.lane-verify` is not merely missing, it is *structurally
unreachable* from the git dir `pr-land` reads. Every queued couple would have failed the gate with `unverified`
and been reopened. The drain therefore passes `--no-require-verified` explicitly: it is the caller the opt-out was
written for, and #1937 already makes the PR's required GitHub check its landing authority.

The general rule this item is the instance of: **a gate's default is a statement about callers that say nothing,
so flipping it is a change to all of them.** An opt-out with zero callers is not an escape hatch, it is a claim.

**And the first correction applied that rule to one caller.** Review round 2 caught the rest:
`we:skills-src/batch-backlog-items/parallel-execute.workflow.js` — live behind `/workflow` — invokes `pr-land`
**four** times with no verify flag (the WE and impl per-lane PR opens, and the two Finalize label-reconcile calls,
the latter from the primary root against a lane ref: the drain's shape exactly). It never runs
`we:scripts/verify-lane.mjs` at all, so no marker exists for any of them and every `/workflow` lane would have
died at PR-open. Worse than the miss: three sentences across this card and the two scripts asserted the sweep was
*complete* while it was not. A retraction that fixes one of the two callers it names is still a false claim.

All four now pass `--no-require-verified`, and the file records why the opt-out rather than a verify step: its
step-4 gate already runs the same suite pair `verify-lane` runs, but the marker is **sha-keyed** while steps 5–7
(resolve commit, manifest, review amend) move HEAD afterwards — recording a marker there needs a verification step
sequenced after the final amend, which is a workflow change this card does not make (see #3212).

**The caller sweep is no longer a hand sweep.** An earlier revision of this section read:

> **The caller sweep is still a hand sweep, and that is the residual risk.** It has now been wrong twice. The
> durable fix is a source-level guard asserting that every repo-committed `we:scripts/pr-land.mjs` invocation
> either carries a verify flag or is preceded by a `verify-lane` run — the same shape as the existing `lane-drain`
> contract guard. Not built here; owed as a follow-up.

**That residual is closed in this card rather than deferred**, because deferring it leaves the item's own failure
mode live: a hand-maintained caller list in a docblock is a claim, and this one was wrong in round 1 (missed the
drain) and again in round 2 (missed the workflow). Filing a follow-up would have shipped a third revision of the
same claim with nothing enforcing it.

**RETRACTION — the first cut of that guard was the same hand sweep, moved.** This section previously described
what shipped as reading "the committed source of each emitter … A new `pr-land` invocation that says nothing about
verification reddens the suite instead of reaching the gate." **False when written.** The round-3 test iterated two
hard-coded filenames — `for (const file of [WORKFLOW, DRAIN])` — so a flag-free invocation in a *third* file reached
the gate in silence. Review round 3 measured exactly that in a lane clone: baseline `npx vitest run lane-verify` =
**53 passed**; adding a flag-free `pr-land` invocation to `we:scripts/lane-review.mjs` left it **green at 53**, while
adding the identical line to one of the two swept files reddened it. And the completeness claim was false by the
sweep's *own* predicate: run over `git ls-files` it found **three** further emitters shipping a `--ref=` invocation
that said nothing about verification.

**The guard now reads the tracked file set.** `we:scripts/__tests__/lane-verify.test.mjs`, "caller sweep", takes its
candidate files from a literal-substring grep over tracked files — **213 files, measured in this lane**:

```
git grep -lF -- 'pr-land.mjs'
```

— minus exactly one
stated exclusion, `we:scripts/pr-land.mjs`'s own `--help` banner, which is pinned by name **and** by count (14 hits,
every one above the program's first `import`, so a real self-invocation added later moves the count rather than
hiding inside the exclusion). Every invocation it finds must **declare its posture**, which is the contract review
round 2 actually asked for — *"either carries a verify flag or is preceded by a `verify-lane` run"*:

- it carries `--require-verified` / `--no-require-verified`, **or**
- a `we:scripts/verify-lane.mjs` / `we:scripts/operations/run.mjs verify` command sits on the same line or within the 3 lines above it.

Each is then driven through `we:scripts/pr-land.mjs`'s own flag parser, `resolveVerifyOptions` and
`verifyGateDecision` against the marker state that path actually sees.

**RETRACTION — the previous cut of this paragraph said the sweep "harvests every `node we:scripts/pr-land.mjs …`
invocation", and that is the sentence review round 5 disproved.** The round-4 regex matched only the **bare** path
spelling, while this repo's own documentation convention writes the `we:` locus prefix. Measured in this lane rather
than taken from the review: running the sweep's own predicate over the same 213 candidate files, with and without an
optional `we:`/`./` prefix arm, harvests **8** invocations vs **7**, and the whole difference is one line —
`we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md:20`, a `type: feedback` agent memory (a *loaded
instruction*, not prose) carrying the canonical cross-repo delivery arc for Frontier UI and plateau-app, flag-free
and with no adjacent verify. After the flip, an agent following it would have met `pr-land`'s step-1b gate with
exit 3 / `unverified`. The regex now tolerates `we:` and `./`, that arc is fixed below, and two named **mutation
probes** — the plain shape injected into `we:scripts/lane-review.mjs`, the `we:`-prefixed shape injected into
`we:skills-src/pr/SKILL.md` — are tests now, so the prefix cannot go blind again. Mutation-checked here: narrowing
the regex back to the bare spelling gives `2 failed | 58 passed`; reverting only the agent-memory arc gives the
same `2 failed | 58 passed` on two different cases.

**CITATION CORRECTED (round 6) — this paragraph cited that invocation at `:16` for three rounds.** It is at
**`:20`**. `:16` was accurate when written and went stale in-round, because this round's own verify step was
inserted into that same file above the invocation. The claim it supports is unchanged — the invocation never
moved file, and it is still the whole difference between the 7- and 8-invocation harvests. Re-measured in this
lane rather than adjusted by arithmetic: `grep -n pr-land we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md`
puts the harvested argv on line 20.

**STATED LIMITS, so the next round need not discover them.** The sweep is not, and no longer claims to be, a
statement about every `pr-land` mention in the repo:

- It harvests **command strings carrying at least one `--flag`**. A bare flagless invocation in prose (e.g.
  `we:backlog/2219-…` line 222) is not an argv and is **not** harvested.
- It knows **three spellings** of the path: bare, `we:`-prefixed, `./`-prefixed. A fourth would be invisible again;
  the mutation probes, not the regex, are the defence against that. (The `./` arm harvests **0** invocations today —
  measured — and is kept because "the sweep did not know that spelling" is this PR's failure mode of record.)
- Argvs built as **arrays** (`we:scripts/lane-drain.mjs`'s `buildPrLandArgs`) are invisible to any command-string
  scan and are pinned by a separate case.
- **Source adjacency is a checkable proxy** for "the verify precedes the land", not a proof of execution order —
  which is precisely why the doc arcs below were edited to move the verify *after* the item commit rather than left
  relying on a verify hundreds of lines up the file.

## `/batch` and the solo arc — decided, not assumed

The widened sweep found **four** emitters the hand list never saw, all of them **documentation an agent follows**
rather than code that executes: `we:skills-src/batch-backlog-items/SKILL.md` (the serial `/batch` close-out),
`we:docs/agent/backlog-workflow.md` (the canonical per-item arc),
`we:agent-memory-src/single-session-should-use-a-lane.md`, and — found only once the `we:` prefix arm went in, in
round 5 — `we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md`, the cross-repo delivery arc for
Frontier UI and plateau-app. *(An earlier cut of this sentence said **three**; it was written when the sweep could
not see the fourth.)*

**They do not get the opt-out, and must not.** They run `pr-land` from the **lane clone**, where the marker *is*
reachable — so the strict gate is the correct answer there, and it is the only delivery path on which this item's
gate can actually engage. Handing them a blanket `--no-require-verified` would have closed the hole everywhere
except where it matters.

**But they were broken, for a second reason** — three of them because their verification was *stale* by the time
they landed, and `we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md` because it named **no**
verification at all. `we:docs/agent/backlog-workflow.md` routes the resolve-time check
through `we:scripts/operations/run.mjs verify` (which shells `we:scripts/verify-lane.mjs`, the only writer of the marker) — and that runs *before*
`resolve` and *before* the item commit. The marker is **sha-keyed**, so HEAD moves underneath it and the marker is
**stale** by the time `pr-land` reads it. Measured on this branch, that argv (`--ref=lane/<slug>-<NNN> --no-wait`)
parsed with `pr-land`'s own parser:

| marker at land | verdict | ok |
| --- | --- | --- |
| absent | `unverified` | **false** |
| green, keyed to an EARLIER head (stale) | `unverified` | **false** |
| green, keyed to HEAD | `verified` | **true** |

So the stale case is refused exactly as hard as the absent one — the #3212 shape this card already reasons about
for the `/workflow` producer and had never reasoned about for `/batch`, because the sweep never saw it. **Fixed by
moving the verification, not by weakening the gate:** all four arcs now record the verification *after* the item
commit, immediately before `pr-land`.

**RETRACTION — that paragraph used to end: *"That is one suite run per item, relocated — not a second one."*
WRONG.** Counted over each arc's `origin/main` copy with:

```
grep -cE "verify-lane\.mjs|run\.mjs verify" <file>
```

| arc | marker-writing verify on `origin/main` | so the new one is |
| --- | --- | --- |
| `we:docs/agent/backlog-workflow.md` | **1** — the pre-`resolve` check, and it is still instructed | an **additional** gate run |
| `we:skills-src/batch-backlog-items/SKILL.md` | **0** — its gate is the in-locus `check:standards`, which writes no marker | an **additional** gate run |
| `we:agent-memory-src/single-session-should-use-a-lane.md` | **0** | a **first** |
| `we:agent-memory-src/lane-pr-is-universal-delivery-all-repos.md` | **0** | a **first** |

It is a real added cost, and the item pays it deliberately: the marker is what the gate reads, and only a
`we:scripts/verify-lane.mjs` run keyed to the *landing* commit can produce one.

**`/batch` passes the SCOPED gate, and that matters.** The `verify` operation with no `--gate` runs
`we:scripts/verify-lane.mjs`'s default, whose `check:standards` half is **unscoped** — so a *concurrent* session's
whole-repo error would record a RED marker for this item's commit and the strict gate would then refuse to land work
that is fine. The `/batch` instruction therefore forwards
`--gate="npm run test:unit && npm run check:standards -- --scope=<batch-slug>"`, the same #952 demotion the in-locus
gate two lines above it already relies on. (The `verify` operation has carried a `gate` input since #3240; this
uses a flag it already supports.)

## Done when

1. **Executable** —

   ```
   npx vitest run lane-verify -t "#3321" | grep -qE "Tests +[0-9]+ passed"
   ```

   RED on `origin/main` (exit 1), GREEN on this branch (exit 0). Observed:

   | tree | vitest's own summary line | criterion exit |
   | --- | --- | --- |
   | `origin/main` (`bceec028`) | `Tests  32 skipped (32)` | **1** |
   | this branch (`ad906480`) | `Tests  28 passed \| 32 skipped (60)` | **0** |

   *(Re-measured on every round rather than carried over, because both sides move: `origin/main` advances under a
   live drain, and each round adds cases. Earlier cuts of this table read `14 passed` against `1c293a0f`,
   `16 passed` against `379cf93c`, `17 passed \| 32 skipped (49)` earlier in round 3, `21 passed \| 32 skipped
   (53)` against `5634f078` at the end of round 3, `24 passed \| 32 skipped (56)` against `a284ccd3` in round 4,
   and — **RETRACTED, because it was already stale when written** — `28 passed \| 32 skipped (60)` against
   `origin/main` at `32b66578` earlier in round 5. All superseded, not contradicted: round 5 widened the sweep's
   regex and added the four mutation-probe cases, and `origin/main` moved from `32b66578` to `481f6915` under the
   live drain **during** this round, which is exactly why this row is re-run rather than renumbered.
   **RETRACTED AGAIN IN ROUND 6, for the same reason: this table read `481f6915` / `11ae7037`, and BOTH were stale
   by the time they were read.** The branch tip advanced with round 6's commits, and `origin/main` kept moving under
   the live drain **within this single round**: `481f6915` → `f2940278` → `bceec028`. The RED side was re-run at
   each, and every reading was identical, which is the point of re-running rather than renumbering — a stale sha
   here is a stale label on a verdict that has not changed, not a wrong verdict. (`f2940278` was itself written into
   this table earlier in round 6 and was stale within the hour; it is quoted here rather than silently swapped.)
   The RED side is re-run against the tip each time — never assumed from the previous reading. `bceec028` was
   re-measured in this lane by checking `origin/main`'s copies of the two files into the working
   tree, running, reading the exit code, and restoring (`git status --porcelain` empty afterwards);
   `origin/main`'s copy of `we:scripts/__tests__/lane-verify.test.mjs` contains **0**
   occurrences of `#3321`, so the `-t` filter selects nothing there and vitest prints a skipped-only summary line
   the `grep` cannot match. The verdict has been identical at all **eight** tips,
   which is the point: the criterion depends on this branch's tests existing, not on which commit main happens to be
   at. The `ad906480` reading is the last commit before this card revision and the PR body, which are the only
   things the commits after it touch.)*

   **THE `grep` IS THE CRITERION, NOT DECORATION.** `npx vitest run lane-verify -t "#3321"` on its own exits
   **0** on `origin/main` — measured, not assumed: a `-t` filter that matches nothing is a selection of zero, and
   vitest treats an empty selection as success. A criterion written without the pipe is green *before* the work.
   `Tests +[0-9]+ passed` asserts that tests actually RAN, which is the property the criterion means to state.

2. **The gate still lets a verified lane through** — a gate that refuses everything is worse than the hole it
   closes, so the same `-t "#3321"` selection — **28 tests, re-measured this round** (it has read 14, 16, 17, 21 and
   24 at earlier tips; every one of those numbers is superseded, and the round-3 card's "the same 17 tests" was
   already stale when it shipped) — pins the PASS direction, not just the refusal: a `green` marker for THIS head is
   `ok`/`verified` with **no options passed at all**, and stays `ok` long past the TTL (sha-identity is the
   freshness test, not the clock). Confirmed at the CLI too: with a real green marker written by
   `we:scripts/verify-lane.mjs` for the lane's exact HEAD, `verify-lane check` with no flags returns
   `ok:true` / `verified`, exit 0.

   *Not claimed: that this item's own PR proves it. The standard invocation runs `pr-land` from the PRIMARY
   checkout, so the finish-guard that admitted the PR was `origin/main`'s pre-flip copy — it read the lane's
   marker and needed no escape, but it is not evidence about the flipped gate. An earlier cut of this line said
   otherwise.*

3. **The CI-gated callers still land** — the half the first cut missed. `buildPrLandArgs`'s real argv, parsed with
   `pr-land`'s own parser and fed through `resolveVerifyOptions` + `verifyGateDecision`, must let an **absent**
   marker through (`ok`/`untracked`) — that is the marker state the drain actually sees. Pinned in
   `we:scripts/__tests__/lane-drain.test.mjs`, together with the same call *without* the flag asserted as
   `unverified`, so the flag is provably load-bearing rather than decorative. The `/workflow` producer's four
   invocations carry the same flag (`we:skills-src/batch-backlog-items/parallel-execute.workflow.js`).
   An earlier revision of this criterion added of those four: *"those are prompt strings, so they are pinned by
   inspection and by the completeness note above, not by a test."* **No longer true, and it was the weak spot** —
   "pinned by inspection" is the same hand-sweep that had already been wrong twice. They are now pinned by the
   caller sweep in `we:scripts/__tests__/lane-verify.test.mjs`, which harvests them from the file's own source and
   runs each through the real resolver and gate; being prompt strings is no obstacle, since the sweep reads the
   source text rather than executing the workflow. The same test asserts the count is **four**, so an invocation
   added or removed without thought reddens too.

   **And the lane-local callers still land too** — the other half, added in round 4 and completed in round 5. The
   **four** documented arcs (`/batch`'s close-out, the canonical per-item arc, the single-session lane note, and the
   cross-repo delivery arc the `we:` prefix arm surfaced) keep the **strict** gate, and
   the sweep asserts each reaches `ok`/`verified` on a green marker for HEAD *and* `ok:false`/`unverified` on a
   green marker keyed to an earlier head — the stale case that made them fail before the verify was moved after
   the item commit.

4. **The caller sweep's harvest is the tracked file set, not a list of filenames, and it knows the `we:` spelling** —
   the round-3 guard iterated two
   hard-coded paths while its own title, its own case name and three docblocks called it a sweep of every committed
   invocation. The sweep now derives its file set from a literal-substring `git grep -lF` over tracked files (**213
   candidate files**, measured in this lane) with exactly
   one stated, count-pinned exclusion (`we:scripts/pr-land.mjs`'s own `--help` banner), and asserts that set is larger than
   those three files, so a future narrowing reddens.

   **RETRACTION — this criterion previously ended at "so a future narrowing reddens", and cited only the round-3
   probe as evidence.** That left the criterion claiming a completeness the sweep did not have: its command regex
   matched only the bare spelling of the invocation, so one written with this repo's own `we:` locus
   prefix was outside it — and exactly one such invocation was shipping, flag-free, in a loaded agent memory. The
   criterion now requires **both** halves, and both are mutation-checked in this lane:

   | mutation | result |
   | --- | --- |
   | narrow the command regex back to the bare spelling | `2 failed \| 58 passed` |
   | revert the `we:`-prefixed agent-memory arc only | `2 failed \| 58 passed` (two different cases) |
   | neither | `60 passed` |

   Both probes are **tests** now rather than a reviewer's manual step: the plain shape injected into
   `we:scripts/lane-review.mjs` (review round 3's probe) and the `we:`-prefixed shape injected into
   `we:skills-src/pr/SKILL.md` (review round 5's probe), each asserted harvested-and-silent when bare, and
   **not** reported when an adjacent verify or a verify flag is present — so they pin *posture*, not a ban on the
   tool's name appearing.

5. **The escapes are distinguishable** — under the opt-out, a fresh `running` marker still returns
   `verify-unfinished` and a corrupt marker still returns `verify-corrupt`; only `WE_LAND_UNVERIFIED=1` returns
   `break-glass` for those. Collapsing the two would silently promote the narrow opt-out into the full bypass.

6. **The resolver's stated contract is exhaustively pinned** — all 27 combinations of
   `--require-verified` × `--no-require-verified` × `WE_REQUIRE_VERIFIED` (each of absent / affirmative /
   negative) are asserted against the documented rule, including the negated-negative spellings the comments
   claim resolve toward *required*. Documented-and-untested is how a stated contract becomes an accidental one.
