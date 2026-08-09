---
bornAs: xpfousp
kind: epic
status: open
blockedBy: []
scope:
  - we:scripts/review-runner.mjs
  - we:scripts/lib/review-runner-core.mjs
  - we:scripts/lib/gate-config.mjs
  - we:scripts/converge-daemon-pass.mjs
  - we:scripts/converge-daemon-install.mjs
  - we:scripts/__tests__/converge-daemon.test.mjs
  - we:scripts/__tests__/review-runner.test.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
  - we:package.json
scopeRationale: >-
  Narrowed 2026-08-04 when part 2 was struck. The routing files
  (we:scripts/lib/review-escalation.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/pr-land.mjs
  and the land seams) were scoped for the demotion this epic no longer does; leaving them
  here let an unblocked parent license the work its own body says not to do. What remains is
  the scheduling substrate plus the "shadow runner" → converge daemon rename, which touches
  the two runner files, the gate-config trust-chain registration that names them, and their
  tests. Widened 2026-08-08 by ruling R7 for the substrate's own two files (the pass + the
  launchd installer), their test, and the two npm aliases — the ruling says the daemon is
  scheduled locally from a dedicated clone, and nothing in the pre-existing scope could hold
  a plist renderer. Still deliberately excludes every routing file.
dateOpened: "2026-07-19"
dateStarted: "2026-08-04"
costTokens: "in:230 cw:232386 cr:12732292 out:83017"
costUsd: 10.77
costSessions: 2
tags: []
---

# Wire the scheduled converge-and-label runner (the converge daemon)

Schedule the **converge daemon** — a separate agent-runner that runs the convergence workflow (review-parked-prs, #2437/#2410) over care-annotated PRs, dials panel rigor by care level (#2567), then applies review:accepted / ready-to-merge only: converge+label, never land. Nothing schedules it today, so it is hand-run and writes nothing. The card's original part 2 — demoting scored `review:pending` to advisory `care:*` routing — was **struck on 2026-08-04** after its red-team (below): the whole delta is 8 of 400 PRs and they are the ≥400-line ones. Also carries the rename off "shadow runner". Edits the review trust chain → review:human.

The drain daemon can't spawn agents (#2391 lease), which is why the converge daemon is a separate process; the
resident drain daemon stays the sole `main`-writer.

## Ruling — part 2 DISSOLVES; no routing change ships (operator, 2026-08-04)

**The call.** Part 2 is struck. `producerReviewLabel` / `decideReviewGate` keep routing exactly as they do
today; no `care:*` label class is built; no band unparks. What part 2 was reaching for —
"a scored signal must not strand a PR on a human" — is already delivered by the converge daemon clearing
`review:pending` **mechanically**, which
[#enforce-flip-triple-gated](../docs/agent/platform-decisions.md#enforce-flip-triple-gated) (#2838) ratified.
The remaining work under this epic is part 1: schedule the daemon, and the rename below.

**This reverses a same-day ruling.** A care-band routing table (`none`/`low` stop parking, `elevated`/`high`
keep a machine-clearable `review:pending`) was ruled at 2026-08-04 and then struck by its own red-team, below.
Recorded rather than quietly rewritten, because the reasons it failed are the reasons to not re-propose it.

### Why the band table failed — the red-team, 2026-08-04

**1. The delta is 2% of PRs, and it is the wrong 2%.** Scoring the last 400 first-parent merges on `main`
through the real `scoreEscalation` + `deriveCareLevel`: `none` 273 (68%), **`low` 8 (2%)**, `elevated` 46,
`high` 73. `none` PRs *already* do not park — `producerReviewLabel`
([`we:scripts/lib/review-escalation.mjs:307-311`](scripts/lib/review-escalation.mjs)) returns `null` when
nothing escalates — so "`none` stops parking" is a no-op and the entire behavioural delta is `low`.

With `CARE_WEIGHTS` 3/2/3/2/2 and `CARE_BANDS` 1/3/5 (`:180-190`) no subset sums to 1, so the only sums in
`[1,3)` are **2 = `size` alone or `crossRepo` alone**. With `diffLines: 400`
([`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json)), `size`-alone means
*a ≥400-line PR touching no machinery*. The 8 observed run 428–863 lines and include
`we:skills-src/jury/subject-jury.workflow.js` (+570 — the jury that reviews everything else) and
`we:skills-src/conveyor/runner.mjs` (+301). #2563 point 3 is specifically about this class ("humans review
large changes worse … so high-blast auto-lands run a diverse panel"); the band table's answer for an 863-line
PR was no panel and no human.

**2. `size`-alone is the backstop covering a blast-radius blind spot, not a leaf signal.** `BLAST_RADIUS`
(`:78-85`) lists `.claude/skills/` but **not `we:skills-src/`**, the source those skills are built from — so
editing a skill's *source* misses blast radius while editing its *build output* scores `high`. Today `size`
alone is what catches the source edits. Unparking `low` deletes that cover. Filed separately.

**3. The #2563 reconciliation was lawyering.** The band table leaned on "`gate` means route-to-a-human, never
hard-block-with-no-reviewer" — but that is the tail of #2563 point 1's *config-tightening escape hatch*,
defining "gate" for that opt-in. The rule is the sentence before it: scored signals "do **not** block the land
on a review verdict." A `review:pending` park does exactly that, machine-cleared or not. The table also
promoted a clause #2563 offers as a *repo config* into a hardcoded platform default.

**4. The file already forbids it, in writing.** `deriveCareLevel`'s own contract (`:161-167`, `:198-199`):
care-level "dials panel rigor … **never the *route***" and "**never decides route or land**." The band table
made care decide both, in that file, without amending it. And
[#build-lane-self-review-non-zero-floor](../docs/agent/platform-decisions.md#build-lane-self-review-non-zero-floor)
was cited for authority it does not give — it says care scales *depth*, "never gates its *existence*."

**5. #2851 was read off the wrong axis.**
[#human-required-is-judgment-only](../docs/agent/platform-decisions.md#human-required-is-judgment-only) governs
*who clears*, not *whether a park exists*; #2563 owns the park axis. Worse, the band table's own interim
("`elevated`/`high` … a human until then") installs a standing human step on mechanically-convergent review
across 119 of 400 PRs — the exact "smart glue" #2851 exists to eliminate.

**What survived the attack:** the ordering correction below. The skeptic tried to break it and conceded.

### The residual tension this ruling does NOT paper over

Dissolving still leaves scored PRs waiting on a verdict, which contradicts #2563 point 1's letter just as the
band table did. That is not fixable by wording, and this card does not try. #2563's design assumes the panel
runs **inline in the land path** ("high-blast auto-lands run a diverse panel"). The #2391 lease means the drain
daemon cannot spawn agents — which is the whole reason the converge daemon is a separate ticked process — so an
inline panel is structurally unavailable and a park is the only remaining spelling of "wait for the panel."

#2563 therefore needs an **amendment** stating that, not a reinterpretation pretending it already allows it.
Filed separately as a statute-layer edit; it rides its own human-cleared PR, never this one.

## Ordering correction — "MUST ship together" was wrong, and survived the red-team

The card said its two parts must ship together because demoting the park without a wired runner lets the drain
auto-land scored PRs with zero review. The hazard is real; the remedy was wrong — and with part 2 struck, the
correction now reads as *why nothing routing-shaped may ride part 1*, rather than as a sequencing note.

Per [#enforce-flip-triple-gated](../docs/agent/platform-decisions.md#enforce-flip-triple-gated) (#2838) the runner
**must start in shadow** — default-closed, and the flip's readiness predicate needs a clean shadow track record it
can only earn by running for a while. "Part 1 shipped" therefore means "a runner that writes nothing"
(`--enforce` exits 2, [`we:scripts/review-runner.mjs:197-200`](scripts/review-runner.mjs); `mutations: 0` at
`:257`). Any unpark shipped alongside it produces exactly the zero-review window the coupling was meant to
prevent. This is the one claim the 2026-08-04 skeptic attacked and conceded.

Real order: **schedule the runner → soak in shadow → #2864 + #2893 land → flip to `enforce`.** The scheduling
substrate is the only thing under this epic that is buildable now.

## Ruling R7 — the substrate is a launchd job from a dedicated clone (operator, 2026-08-08)

**The call.** The converge daemon is scheduled as a **launchd job on the operator's Mac**, sibling to the resident
drain daemon (`com.plateau.drain-daemon`), running from its **own dedicated single-lane clone** — the #2501
Fork A(a) pattern applied to this daemon. Shipped here as `we:scripts/converge-daemon-pass.mjs` (one pass) plus
`we:scripts/converge-daemon-install.mjs` (the schedule), both registered `engine` tier in the trust chain.

**Why local, and what the reason is NOT.** The binding constraint is **auth**, not the ledger: the enforce-era pass
spawns the `claude` CLI on the operator's *subscription*, and #2444
([#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)) settled that
SDK-on-subscription is broken rather than merely worse — so the daemon runs where that credential lives. A Claude
cloud routine also fails *today* on the ledger (below), but that failure is contingent and fixable; the auth one is
not. The conveyor-tick option was closed on a different ground: `we:skills-src/conveyor/runner.mjs` is deliberately
no-LLM and *surfaces* decisions for a judgment layer that is a live main session, so scheduling there would tie an
unattended daemon to the operator having a session open — the exact dependency the daemon exists to remove.

**Explicitly an interim, and priced as one.** This is a single-node pet deployment: `RunAtLoad` + `StartInterval` is
a systemd unit on one box, and pull-on-the-server (`fetch` + `reset --hard`) is the deploy method web practice left
behind for immutable artifacts. Accepted knowingly — the substrate is two small files so that replacing it later is
cheap, not so that it is permanent. Accepted cost: **it only runs while the Mac is awake**, and the daemon's clone
can sit at a different commit than what was tested until its next refresh.

**A periodic one-shot, NOT a resident daemon.** The shadow pass is a CLI that exits and already holds a TTL
singleton lease, so overlapping fires no-op and `StartInterval` (900 s) *is* the whole daemon. The drain daemon's
resident `KeepAlive` shape (#2501 Fork B) only earns its keep at the **enforce** flip, when a pass spawns a panel
and an editor subagent and needs to survive across them. Building it now would be paying for a phase we have not
reached.

**The ledger is the one non-obvious wire, and it is the migration seam.** `runShadowPass` folds the durable jury log,
which lives in a **working tree** at `<root>/.conveyor/jury/` and is gitignored ([`we:.gitignore`](../.gitignore)) —
so the daemon's dedicated clone has its own **empty** one, every PR folds fail-closed to keep-parked, and a soak
would record a wall of "keep parked" that looks healthy and means nothing. The pass therefore sets
`CONVEYOR_JURY_DIR` ([`we:scripts/lib/jury-ledger.mjs:70`](../scripts/lib/jury-ledger.mjs)) to the **primary**
checkout's ledger and reads it read-only. That env var is the whole reason the daemon is host-bound on the state
axis, so **promoting the ledger to a shared store is the one change that would let any host run the shadow half** —
including a scheduled CI job, since shadow spends no model context at all. **Filed as #3038**; not done here.

**Safety rails that ride the ruling.** A pass refreshes its clone with `reset --hard`, so both the pass and the
installer **refuse to run against the operator's primary checkout** (the forced invariant that closed #2501 Fork
A(b)); the wrapper never constructs `--enforce` (the runner's refusal is the backstop, this is defence in depth);
the shadow log lives at `$HOME/.converge-daemon/shadow.jsonl`, **outside** the clone, so `git clean -fdq` cannot eat
the soak record; and a pass that could not run (lease held, `gh` down) is *recorded* rather than dropped, because a
gap the enforce-flip readiness predicate cannot see is a gap it cannot account for.

**Not done under this ruling:** installing the job (an operator step — `npm run converge:daemon install`, after
`node we:scripts/lane-pool.mjs provision --repo=<WE checkout> --name=we-converge-daemon --count=1`), and the
"shadow runner" → converge
daemon **rename**, which is the epic's remaining piece.

## The enforce flip is BLOCKED by #2864 — now in the DAG, not just in prose

**#2864 said "it **must** land before the enforce flip (#2572 part 2)" in its body, while this card carried
`blockedBy: []`.** Nothing machine-readable stopped the flip from being picked up first, and on 2026-08-03 it was
nearly recommended as ready on exactly that basis — `status: open`, `size: 8`, no blockers.

The prerequisite is real and only bites in enforce mode: the jury ledger carries **no commit SHA**, so a verdict
written at head A folds to *clear* at head B. Enforced, that auto-clears a PR for a diff no juror saw, and the
`reviewed-sha` marker cannot catch it — it is stamped at WRITE time, so it certifies the unreviewed tree. Shadow
mode is safe from this only because its "no ledger → keep parked" path fails closed.

This is the class #2874 exists for, arriving from the other direction: an outward prerequisite stated in the
blocked item's prose, never lifted into the blocker's edges. Fixed here by writing the edge.

**Amended 2026-08-04 — the edge is gone from this epic because the work it gated is gone.** #2864 gates the
*enforce flip*, and with part 2 struck this epic no longer contains anything behind the flip: what remains is the
scheduling substrate plus the rename, both buildable today. Keeping `blockedBy: ["2864"]` here would falsely
block ready work. #2864 keeps its own `parent: 2572` edge and stays a real prerequisite of the flip, so the edge
was **moved onto #2893** — the flip's impl follow-on — in the same pass. It belonged there anyway: `enforceFlipReady`
tests the #2820 conformance run, the #2823 conformance run, and the shadow agreement metric, but **not** ledger
freshness, so without the edge the predicate could arm `enforce` with the stale-verdict hole #2864 exists to close.
The `scope` was narrowed in the same pass so the epic cannot license the routing files it no longer touches.

## Also corrected here

- **`kind: story` → `kind: epic`.** This card has a child (#2864), and a *sized* story with children
  double-counts in the burndown — `we:scripts/backlog-guard.mjs` blocks any edit until it is resolved.
- **`size: 8` dropped.** An epic is sized only while unsliced; this one has a slice.

## Naming decision — the "converge daemon" (operator, 2026-08-03)

Rename `we:scripts/review-runner.mjs` / `we:scripts/lib/review-runner-core.mjs` and every "shadow runner"
reference to the **converge daemon**, riding THIS story rather than a separate cycle.

"Shadow" names its *mode*, not its job — the observe-only phase this story ends, so the name is wrong the day it
lands. "Review daemon" was rejected as the obvious pair for the drain daemon because it hides the part that
matters: this process REVIEWS via a fresh multi-lens panel, then an editor subagent FIXES each finding and
**pushes the revision to the PR branch**, and only then DECIDES the label. Nobody expects a "review daemon" to
rewrite their branch. `converge` is already this codebase's word for that loop.

The pair then reads by what each one writes:
- **drain daemon** — writes to `main`; lands what is cleared.
- **converge daemon** — writes to PR branches; reviews, fixes, decides. Never touches `main`.

It rides this story because both files are POLICY tier of the trust chain
([`we:scripts/lib/gate-config.mjs`](scripts/lib/gate-config.mjs)) — a rename needs a human clear, and this story
already requires exactly one.
