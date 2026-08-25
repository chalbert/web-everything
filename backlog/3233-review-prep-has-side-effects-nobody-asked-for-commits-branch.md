---
bornAs: xh9pwf3
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
preparedDate: "2026-08-25"
tags: [operations, epic-3029, review-prep, preparation]
scope:
  - we:scripts/operations/review-prep.mjs
  - we:scripts/operations/review-prep-io.mjs
  - we:scripts/operations/__tests__/review-prep.test.mjs
  - we:scripts/operations/__tests__/review-prep-io.test.mjs
  - we:scripts/operations/run.mjs
---

# review-prep has side effects nobody asked for: commits, branch pushes, pr-land

Reviewing a card should append a note. Observed on 2026-08-21 across two lanes, we:scripts/operations/review-prep.mjs also made unrequested commits on the caller branch (6 on one lane), pushed lane/review-prep-* refs to origin, and ran its pr-land step. 16 such refs are on origin and climbing. Every caller then has to detect and squash commits it did not make. The operation should append and stop; landing is the caller job, and a review that pushes a branch is doing delivery work under a review name.

## Measured on 2026-08-25 — the count is now 21, and the cause is not tidiness

The refs did not merely accumulate; **the verdicts they carry were lost.** Twenty-one
`lane/review-prep-*` refs sit on origin with **no PR of any state** behind them (a `gh pr list --state all`
search on that head prefix returns nine, all MERGED, all from the 2026-08-14 laptop cluster). Their content
is real: diffing `origin/main...origin/lane/review-prep-2456-…` carries finished verdicts for #2456, #2459,
#2852, #2888, #2907 and #561 — "confidence High, corrections recorded" — and **none of that text is on
`main`** (checked: `git show` of the #2456 card at `origin/main` has no review section).

**The provenance names the cause.** Every orphan commit is authored by the generic `Claude` identity at a
UTC timestamp on 2026-08-21; every merged one carries the operator's own git identity at a local offset. The
orphans are **cloud-VM runs**. Per `we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`, a VM's git
transport is credentialed and its GitHub API is not — so `we:scripts/pr-land.mjs` pushed the ref and then
could not open the PR. The bundled `record` effect therefore fails *after* it has already mutated the
caller's branch, and the verdict is stranded on a ref nobody reads.

That is the argument for the split, and it is stronger than "callers must squash commits they did not
make": **an operation that bundles recording with landing cannot record on a host that cannot land.**

## The decided design — round 3 INVERTS rounds 1 and 2: `record` always pushes

Two panels killed two designs on the same test, and the second kill was the useful one.

- **Round 1** — "append and stop, commit nothing." Refuted: an uncommitted working-tree edit dies when a
  cloud VM is reclaimed.
- **Round 2** — "commit locally, push only behind `--land`." Refuted harder, by two independent jurors: an
  **unpushed local commit dies with the box exactly the same way**, so round 2 restated round 1's defect in
  git-object form. The red-team juror added the half that settles it: the `--land: true` path *reproduces
  the original bug verbatim* — on a VM the push succeeds and `gh` fails, producing precisely the orphan ref
  this card exists to stop. **Neither setting of round 2's flag closed the loop.**

Rounds 1 and 2 were the same idea twice ("push less"). Rather than take a third swing at it — the point at
which `we:docs/agent/delivery-loop.md` says to stand down because the model is wrong — the model is what
changes here, and the evidence forces the direction:

> **The 21 orphan refs are not the failure. They are the only reason those 20 verdicts still exist.** Every
> verdict that reached a durable place got there *by being pushed*. Every design that pushes less loses
> them. The push is the durability mechanism, and this card's title is wrong to call it a side effect
> nobody asked for.

**So `record` appends, verifies, commits, and PUSHES — always, on every host.** A push needs only the git
transport, which is credentialed everywhere including a cloud VM
(`we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`). What moves behind `--land` (default OFF)
is only `we:scripts/pr-land.mjs` — the PR-open, which is the GitHub-API half that genuinely cannot work on
a VM and must not be attempted there.

**What was actually broken, then, is the HAND-BACK.** Twenty verdicts sat on origin for four days because
nothing reported that they existed and needed landing. So the operation's contract gains the missing half:
when it pushes without landing, it **returns the ref and the exact follow-up** — the argv a credentialed
host should run — instead of throwing "outcome UNKNOWN" and leaving no trace. That is what turns an orphan
ref into a hand-off.

**The original complaint survives and is answered precisely.** "Six commits on one lane" was real, and its
cause was pushing the caller's whole accumulated stack under one item's ref. `record` now pushes **only its
own commit**, onto a ref named for the item it reviewed. Six reviews produce six one-commit refs, not one
six-commit ref misattributed to whichever item happened to be last.

#2138's single-transport rule is untouched: when `--land` IS passed, landing still goes through
`we:scripts/pr-land.mjs`, so no second route to `main` appears.

### The failure trace, per setting — required because this section answers a `worseThanBase` finding

| host | `--land` off (default) | `--land` on |
| --- | --- | --- |
| laptop | verdict pushed, ref + follow-up argv returned; operator or drain lands it | pushed and PR opened, as the merged nine did |
| cloud VM | verdict pushed and **survives reclaim**; ref + follow-up returned for a credentialed host | refused up front — see below |

On a VM, `--land: true` is **refused before the push**, naming the boundary, rather than attempted and
failed halfway. Detection is the same probe the memory note documents: `gh auth status` resolving to the
`prox…` sentinel rather than a credential. A refusal that happens *before* any mutation is the difference
between a hand-off and today's stranding.

## Interfaces at the seam

`recordPrepVerdict` (`we:scripts/operations/review-prep-io.mjs`) today returns
`{recorded, aborted, path, sha, ref, clean, disposition, actor, land}`.

- **Default (`land: false`)** returns
  `{recorded: true, aborted: false, path, actor, verified: true, sha, ref, pushed: true, landed: false, followUp: string[]}`.
  `followUp` is the argv a credentialed host should run to land the pushed ref — the hand-back that was
  missing. It is a real field, not advice in a log line, so a caller can act on it.
- **With `land: true`** it additionally returns `{clean, disposition, land}` — the remaining keys of today's
  shape, so the merged-nine path is preserved intact, and `followUp` is absent.
- **`verified`** is the #3230 half, checked against the **staged** content. See #3230 for why the ordering
  matters.

**The `--land` flag is a DECLARED INPUT, not just an effect payload key.** Round 2 wrote "CLI: `… [--land]`"
while its task list only threaded `land` into the `record` payload — but per the statute quoted in
`we:scripts/operations/review-prep.mjs`'s own header (*operations declared once, callers generated*), the
CLI adapter derives its flags from the operation's declared `input`. A flag that is not declared cannot
exist. So:

```js
// we:scripts/operations/review-prep.mjs — the op() declaration's `input` object
land: { type: 'boolean', required: false, default: false }
```

and the `reduce` step reads `view.input.land` into the `record` effect's payload. Named because the `fresh`
juror found this seam left for the builder to invent.

**The contract-version stamp — field, home, and shape, all pinned.** Round 2 said "the run record gains a
contract version" and stopped there; a juror correctly refused that as undecided.

- **Field**: `contract` on the run record written by `we:scripts/operations/run-record.mjs`, an integer.
  `review-prep`'s current contract is `1`; this change makes it `2`.
- **Read**: at `--resume`, before any effect advances.
- **Shape**: a **returned refusal**, not a throw — `{resumed: false, reason: 'contract-changed', was: 1, now: 2}`
  plus a message naming `land`. #3230 argues a throw is the wrong shape because the engine reads it as
  UNKNOWN and refuses replay; the same argument applies here, and round 2 contradicted itself by pinning the
  shape in one card and not the other.
- A run record with **no** `contract` key is treated as `1` (every record written before this change).

## The composed step order — one place, because three cards edit one function

#3233, #3230 and #3238 all restructure `recordPrepVerdict` and land in one PR. A juror noted no card states
the merged result, leaving the builder to compose three diffs by hand. It is stated here, and this order
**is** the acceptance target:

1. Pre-write content-hash check (existing; unchanged).
2. Render the section → `{section, bareRefs}`. **If `bareRefs` is non-empty, refuse now** — before any
   mutation (#3238).
3. `writeFileSync` the card.
4. `git add` the card path.
5. **Verify the STAGED content** contains the section. Absent ⇒ return the #3230 third outcome; nothing is
   committed (#3230).
6. `git commit` the card path only.
7. **Push** the single commit to `lane/review-prep-<item>-<sha8>` (#3233).
8. If `land` ⇒ shell `we:scripts/pr-land.mjs`. Else ⇒ return `followUp`.

Step 2 sits before the write deliberately: refusing after writing would leave the card dirty with prose the
operation just rejected.

## Migration — three consumer classes, and only the static one was originally checked

**Static callers: four modules, five files.** `we:scripts/operations/run.mjs` (CLI adapter), the generated
HTTP adapter via `REVIEW_PREP_OP`, its own `-io` module, and its two test files
(`we:scripts/operations/__tests__/review-prep.test.mjs` and
`we:scripts/operations/__tests__/review-prep-io.test.mjs`). Stating the unit because round 1 wrote "exactly
four consumers" while itemising five files — the `premise` juror flagged the ambiguity.

**In-flight suspended runs — the gap round 1 missed entirely.** `record` is declared `idempotent: false`,
and the engine suspends at the `judge` step while the juror spawns. A run started under today's
land-always contract and resumed after this ships would silently default to `land: false` and give its
caller neither a land nor an error. Handled explicitly rather than by hoping: the run record gains a
contract version, and resuming a `review-prep` run recorded under the old one **refuses** with a message
naming the change and telling the caller to re-run. Blast radius is nil today (six `review-prep` run
records exist on this machine, all for #3100, all complete) but the refusal is what makes that a fact
rather than a bet.

**HTTP-adapter network callers: undiscoverable by grep, so DETECTED rather than assumed.** The operation is
exposed over the generated HTTP adapter, whose callers are by nature not in the import graph. Round 2
labelled this a residual risk and stopped, which a juror rightly called "labelling a gap is not closing
one." Closed instead by the cheapest thing that produces evidence: the `record` effect **logs one line
whenever it runs with `land` absent from its input entirely** (as opposed to explicitly `false`), naming
the caller channel. Absent-vs-false distinguishes an old-contract caller from a new one. If that line never
appears, the population is empirically empty; if it does, we learn who they are before anything else
changes. Nothing in this repo starts that adapter as a service and no doc points a client at it, so the
expectation is silence — but that becomes a measurement rather than a hope.

**No skill invokes it** — grepping `we:skills-src/` for the operation name returns nothing, itself a gap
tracked by #3225.

## OPEN — round 3 findings, not yet addressed. This card is NOT build-ready.

Recorded rather than carried in a session, because the backlog is the tracker. Round 3's panel accepted the
inverted model ("well-argued, closes the round-1/round-2 defects") but returned one **blocking** finding and
five narrow seams. A builder must not start until these are answered.

**BLOCKING — the default flip breaks every existing caller, and may GROW the orphan pile.** The red-team
juror: `land` did not exist before, so *every* current caller invokes without it. Post-ship, every laptop
review that used to land itself stops at pushed-not-landed. Since `followUp` has no enforcement, the pile of
pushed-unlanded refs is plausibly **larger** than the 21 that motivated the card. Two ways out, and the card
must pick one rather than assume: (a) default `land` to **true** and let the credential pre-check downgrade
it to push-only where landing cannot work — making the VM the exception rather than everyone; or (b) own the
flip as a breaking change with a task updating every caller. **(a) is the likely answer** — it preserves
today's laptop behaviour exactly and changes only the host that was already failing — but it is a real fork
and is stated here rather than silently taken.

**Seams (all narrow, all additive):**

1. The composed order has **no step for the credential pre-check**, yet Done-when 4 requires it to fire
   before write/stage/commit/push. Read literally, a builder puts it at step 8 and contradicts the test.
2. Step 8 **drops the PR body file** the current code stages (`we:scripts/pr-land.mjs` refuses a bodyless
   PR). No step re-establishes it and no case would catch its loss.
3. The absent-vs-`false` detection (HTTP callers) **cannot work as specified**: the declaration applies
   defaults before a step reads `view.input.*` — visible in the sibling `actor` field in the same file — so
   an absent `land` is already `false` by then. Needs the raw input, or a different signal.
4. The contract check's **call site is unnamed**. "At `--resume`, before any effect advances" is a
   lifecycle point neither file in scope shows; cite it by `file:line` or the builder searches the engine.
5. **No outcome is decided for a `push` that fails** (transient network, laptop). Ironic, since push is now
   the mechanism the whole fix rests on, and committed-but-unpushed is precisely this card's failure mode.

Round 3 also noted `followUp` and the detection log are both **passive**: nothing consumes either. That is a
real residual, and the honest scope answer is that closing it belongs to a reconciliation pass over
pushed-unlanded refs, not to this card — but the card should say so rather than imply the loop is closed.

## Tasks

1. Declare `land` in the operation's `input` (boolean, default false); read it in `reduce` into the `record`
   payload. The CLI flag is generated from the declaration, never hand-added.
2. Restructure `recordPrepVerdict` to the composed order above: refuse-on-bare-refs → write → stage →
   verify-index → commit → push-own-commit → optional land.
3. Return `followUp` (the argv for a credentialed host) whenever the push happens without a land.
4. Refuse `land: true` up front on a host with no GitHub credential, before any mutation.
5. Add the `contract: 2` stamp and the resume refusal; treat a missing key as `1`.
6. Log the absent-vs-false `land` input once per run, for the HTTP-caller detection above.
7. **Rewrite the file-header JSDoc of `we:scripts/operations/review-prep-io.mjs`** — it currently states
   "LANDS OR PARKS (never both)" and describes commit+land as automatic, directly above the code it would
   now contradict.
8. Unit-test every branch.
9. Leave the 21 existing orphan refs alone — recovering them is its own card, not this one.

## Delivery shape

Lands incrementally behind `main` in one PR with #3230 and #3238 — one function, three diffs, composed order
stated above. No branch needed.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep-io.test.mjs` passes a case
   asserting a default `record` (no `land`) **commits once and pushes once**, shells pr-land **zero** times,
   and returns a `followUp` array whose first element names `we:scripts/pr-land.mjs`. Fails today (the
   current code always shells pr-land and returns no `followUp`).
2. **Executable** — the same case asserts the pushed ref contains **exactly one** commit — the review's own —
   by asserting the push refspec names the recorded `sha` rather than a branch tip. This is the "six commits
   under one item's ref" defect; a test asserting only that a push happened would pass on the buggy code.
3. **Executable** — a case with `land: true` asserts `{sha, ref, disposition}` are returned, pr-land was
   shelled exactly once, and `followUp` is **absent**.
4. **Executable** — a case with `land: true` on a stubbed credential-less host asserts the operation refuses
   **before** any write: the write, stage, commit and push spies are each called **zero** times.
5. **Executable** — a case resuming a run record with `contract: 1` asserts a **returned**
   `{resumed: false, reason: 'contract-changed'}` naming `land` — asserting explicitly that it does not
   throw. A second case with no `contract` key at all asserts the same, proving the missing-key default.
6. **Executable** — the file-header JSDoc case asserts the block **describes the new behaviour**: it
   contains both `land` and a statement that landing is opt-in, and does not contain "LANDS OR PARKS". A
   bare string-absence assertion is insufficient — it would pass on a minimal deletion that left the rest of
   the paragraph describing the old automatic path (red-team finding).
7. **Mutation** — deleting the push reddens case 1 by name; deleting the credential pre-check reddens case 4
   by name; deleting the contract check reddens case 5 by name.
8. `npm run check:standards` shows no new warnings against the 0-error / 1435-warning baseline.
