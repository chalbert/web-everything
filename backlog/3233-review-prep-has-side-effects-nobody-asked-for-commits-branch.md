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

**21 refs, 20 verdicts — the gap is one ref and it is accounted for.** `origin/lane/review-prep-defects`
matches the prefix but is not an operation-produced verdict ref: its single commit is *"backlog: file 5
defects the overnight prep batch surfaced"*, it carries no verdict, and it does not match the operation's
`lane/review-prep-<item>-<sha8>` naming. The refs also stack cumulatively, so the union of cards gaining an
`## Independent review` section absent from `main` is exactly **20**. Both numbers are right; say 20 for
verdicts and 21 for refs.

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
(`we:agent-memory-src/workflow-cloud-vm-github-api-boundary.md`). The PR-open — `we:scripts/pr-land.mjs` —
is the GitHub-API half that genuinely cannot work on a VM. It stays **on by default** and is **downgraded
to push-only** where the credential is absent, per the ruling above.

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

| host | `land: true` (default) | `land: false` (explicit) |
| --- | --- | --- |
| laptop | pushed and PR opened — **exactly today's behaviour**, as the merged nine did | pushed; ref + `followUp` argv returned |
| cloud VM | credential absent ⇒ **downgraded** to push-only; verdict survives reclaim; `followUp` returned | pushed; `followUp` returned |
| push fails | commit intact, `pushed: false`, `followUp` returned — reported, never silent | same |

The downgrade is detected up front, before any mutation, by the probe the memory note documents: `gh auth
status` resolving to the `prox…` sentinel rather than a credential. Deciding this *first* is what turns
today's fail-halfway into a hand-off — and downgrading rather than refusing is what keeps the VM population
served instead of blocked.

## Interfaces at the seam

`recordPrepVerdict` (`we:scripts/operations/review-prep-io.mjs`) today returns
`{recorded, aborted, path, sha, ref, clean, disposition, actor, land}`.

- **Default (`land: true`), credentialed** returns
  `{recorded: true, aborted: false, path, actor, verified: true, sha, ref, pushed: true, landed: true, clean, disposition, land}`
  — today's shape plus `verified`/`pushed`, so the merged-nine path is preserved intact.
- **Downgraded (no credential) or explicit `land: false`** returns the same minus `{disposition, land}`,
  with `landed: false` and `followUp: string[]` — the argv a credentialed host should run to land the pushed
  ref. It is a real field, not advice in a log line, so a caller can act on it. When the downgrade fired
  rather than the caller asking, `reason: 'no-credential'` says so. **`clean` is retained** on this branch:
  it is computed by `isCleanPrepReview` from the verdict itself, not from what the land did, so dropping it
  would hide the verdict's own shape from exactly the caller who has to act on `followUp`. (Round 4 dropped
  it with no reason given.)
- **Push failed** returns `{recorded: true, verified: true, pushed: false, landed: false, sha, followUp}`.
  The commit stands; the push is owed and reported.
- **`verified`** is the #3230 half, checked against the **staged** content. See #3230 for why the ordering
  matters.

**The `--land` flag is a DECLARED INPUT, not just an effect payload key.** Per the statute quoted in
`we:scripts/operations/review-prep.mjs`'s own header (*operations declared once, callers generated*), the
CLI adapter derives its flags from the operation's declared `input`. A flag that is not declared cannot
exist. So:

```js
// we:scripts/operations/review-prep.mjs — the op() declaration's `input` object
land: { type: 'boolean', required: false, default: true }
```

and the `reduce` step reads `view.input.land` into the `record` effect's payload. Named because a juror
found this seam left for the builder to invent.

**No contract-version stamp, and that is a consequence of the ruling, not an omission.** Rounds 2 and 3
specified one to stop an in-flight suspended run silently acquiring a new default. With the default now
preserving today's behaviour, a resumed run gets what it always would have — so there is nothing to guard,
and adding a version stamp would be machinery defending a difference that no longer exists.

## The composed step order — one place, because three cards edit one function

#3233, #3230 and #3238 all restructure `recordPrepVerdict` and land in one PR. A juror noted no card states
the merged result, leaving the builder to compose three diffs by hand. It is stated here, and this order
**is** the acceptance target:

0. **Resolve the effective `land`**: requested `land` AND a GitHub credential is present. No credential ⇒
   downgrade to `false` with `reason: 'no-credential'`. Decided FIRST, before any mutation (#3233).
1. Pre-write content-hash check (existing; unchanged).
2. Render the section.
3. Write the card via `we:scripts/backlog/guarded-write.mjs#writeBacklogMd`, which throws before writing on
   a violation ⇒ return the `guarded-write` outcome (#3238). It runs **three** gates, in this order:
   `laneGuardDecision` (`we:scripts/backlog/guarded-write.mjs:56`), `scrubPublish` (`:113`), then
   `scanRepoLocusPrefixes` (`:121`). The first is a lane-ownership refusal with no override and a different
   cause from the other two, so the returned `reason` must distinguish it rather than collapse all three.
4. `git add` the card path.
5. **Verify the STAGED content** contains the section. Absent ⇒ return the #3230 third outcome; nothing is
   committed (#3230).
6. `git commit` the card path only.
7. **If NOT landing**, push that single commit to `lane/review-prep-<item>-<sha8>`. Failure ⇒ return
   `pushed: false` with the commit intact and `followUp` owed.
8. **If landing**, stage the PR body file and shell `we:scripts/pr-land.mjs`, which does the push itself
   (`we:scripts/pr-land.mjs:574`) — so the default path pushes exactly once, through the same transport as
   today, and step 7 is the branch that makes a non-landing verdict durable.

Step 0 sits first so the whole run is decided before anything is touched. Steps 7 and 8 are **exclusive**:
round 4 had both firing on the default path, which would have pushed twice and made "pushes once"
untestable. Step 3 carries the content guards because the writer owns them.

## Migration — three consumer classes, and only the static one was originally checked

**Static callers: four modules, five files.** `we:scripts/operations/run.mjs` (CLI adapter), the generated
HTTP adapter via `REVIEW_PREP_OP`, its own `-io` module, and its two test files
(`we:scripts/operations/__tests__/review-prep.test.mjs` and
`we:scripts/operations/__tests__/review-prep-io.test.mjs`). Stating the unit because round 1 wrote "exactly
four consumers" while itemising five files — the `premise` juror flagged the ambiguity.

**In-flight suspended runs — real, and the fix is one operator, not a subsystem.** Verified rather than
argued this time: `validateInput` is called **only** in `startRun` (`we:scripts/operations/engine.mjs:131`),
which stores the defaulted input into the run record; `resolvePending` and the resume path
(`we:scripts/operations/engine.mjs:236`, `:348`) never re-validate, so declaration defaults are **never
re-applied on resume**. A run record written before `land` existed therefore has no `land` key at all, and
`view.input.land` reads `undefined` — not `true`.

Rounds 2 and 3 proposed a contract-version stamp plus a resume refusal for this. Round 4 deleted them on the
reasoning that the ruling made the default harmless; **that reasoning was wrong**, and an independent review
caught it. The stamp is not the right answer either. The read site takes the default explicitly:

```js
const land = view.input.land ?? true;   // absent key (pre-#3233 run record) === today's behaviour
```

An old run resumes into exactly what it would have done before this change. No version field, no refusal, no
new machinery — and unlike the previous two answers, this one is checkable in a test rather than defended in
a paragraph.

**HTTP-adapter network callers.** The operation is exposed over the generated HTTP adapter, whose callers
are not in the import graph, so no grep settles the population. With `land` defaulting to `true` and the
`?? true` read above, an old caller that never passes the field gets today's behaviour — so there is nothing
for such a caller to observe, whoever they are. That is a stronger answer than the instrumentation round 3
proposed, which round 4 specified as an absent-vs-`false` log line that could not have worked anyway: the
defaulted value is stored at `startRun`, so "absent" is not distinguishable downstream.

**No skill invokes it** — grepping `we:skills-src/` for the operation name returns nothing, itself a gap
tracked by #3225.

## The fork is RULED (operator, 2026-08-25): `land` defaults to TRUE

Round 3's panel found one blocking defect in the round-3 design: `land` did not exist before, so **every**
existing caller invokes without it. Defaulting it OFF would have stopped every laptop review that lands
today, and since the hand-back is passive, the pushed-unlanded pile would plausibly have grown **larger**
than the 21 that motivated this card.

**Ruling: option (a).** `land` defaults to **true**, and a credential pre-check **downgrades** it to
push-only on a host that cannot reach the GitHub API. The cloud VM becomes the exception; every laptop
caller keeps exactly today's behaviour. Nobody has to pass a flag to get what they already get.

This also removes round 3's other awkwardness — a `--land: true` that *refused* on a VM. It no longer
refuses; it downgrades, pushes, and hands back. Refusing would have meant the VM population, the one this
card exists for, got nothing.

**Remaining seams from round 3, each now answered:**

1. **The credential pre-check has a step** in the composed order below (step 0), so it cannot be read as
   sitting next to the land.
2. **The PR body file is retained** — step 8 stages it exactly as today, because `we:scripts/pr-land.mjs`
   refuses a bodyless PR. Round 3's order dropped it silently; a case now covers it.
3. **The absent-vs-`false` detection is dropped, not respecified.** It could not work: defaults are applied
   and stored at `startRun`, so "absent" is not observable downstream. With the `?? true` read, an old
   caller gets today's behaviour and has nothing to observe — which removes the need to detect them at all.
4. **The contract check is replaced by a `?? true` read, not deleted on an argument.** Round 4 removed it
   claiming the ruling made it unnecessary; an independent review showed that was false — defaults are
   applied once at `startRun` and never re-applied on resume, so an old run record reads `land` as
   `undefined`. See the Migration section for the verified mechanism and the one-line answer.
5. **A failed `push` is decided**: it returns `{recorded: true, verified: true, pushed: false, followUp}`
   with the local commit intact. Determinate, not a throw — the verdict is committed and recoverable, and
   the caller is told the push is owed. This is the one branch where committed-but-unpushed is acceptable,
   because it is reported rather than silent.

**One residual, stated plainly rather than papered over:** `followUp` is a returned field, and nothing
consumes it yet. A pushed-unlanded ref is therefore still discoverable-but-not-discovered until something
sweeps for them. That sweep is the recovery card filed alongside this one, not this card's job — but this
card should not be read as closing the loop. It makes the loop *closable*.

## Tasks

1. Declare `land` in the operation's `input` (boolean, **default true**); read it in `reduce` into the
   `record` payload. The CLI flag is generated from the declaration, never hand-added.
2. Add step 0: resolve the effective `land` from the requested value AND credential presence.
3. Restructure `recordPrepVerdict` to the composed order above.
4. Return `followUp` whenever the push happens without a land, including the downgrade and push-failure
   branches.
5. **Rewrite two separate doc blocks in `we:scripts/operations/review-prep-io.mjs`**, both currently wrong
   and at different places — the round-3 card cited only one and located it in the other:
   - the **file header, lines 13–15**, which describes commit + `pr-land` as automatic;
   - **`recordPrepVerdict`'s own JSDoc at line 146**, which is where the string
     `"LANDS OR PARKS (never both)"` actually lives. The file header has never contained it.
6. Unit-test every branch.
7. Leave the existing orphan refs alone — recovering them is its own card, not this one.

## Delivery shape

Lands incrementally behind `main` in one PR with #3230 and #3238 — one function, three diffs, composed order
stated above. No branch needed.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep-io.test.mjs` passes a case
   asserting the **default** `record` on a credentialed host commits once, shells `we:scripts/pr-land.mjs`
   exactly once, and issues **no `git push` of its own** — pr-land owns the push on this path. Byte-identical
   to today's behaviour, which is what makes the default flip safe.
2. **Executable** — a case with an explicit `land: false` asserts pr-land is shelled **zero** times, exactly
   one `git push` is issued, and its **refspec names the recorded `sha`** rather than a branch tip — so the
   pushed ref carries one commit, not the caller's accumulated stack. This is the "six commits under one
   item's ref" defect; asserting only that a push happened would pass on the buggy code. Fails today.
3. **Executable** — a case with the default `land` on a **stubbed credential-less host** asserts the run
   **downgrades rather than refuses**: write, stage, commit and push each fire, pr-land is shelled zero
   times, and the result carries `{landed: false, reason: 'no-credential', clean, followUp}`. This is the
   cloud-VM case the card exists for, so it must serve it, not block it.
4. **Executable** — a case resuming a run record with **no `land` key** asserts the run **lands** — the
   `?? true` read giving an old record today's behaviour. Fails against a plain `view.input.land` read,
   which yields `undefined` and takes the push-only branch.
5. **Executable** — a case where the push fails asserts `{recorded: true, verified: true, pushed: false}`
   with the commit intact and `followUp` returned — and that it does **not** throw.
6. **Executable** — three cases, one per gate in `writeBacklogMd`, asserting the returned `reason`
   distinguishes a lane-ownership refusal from a secret-scrub refusal from a locus refusal. A single
   `reason: 'guarded-write'` for all three fails this.
7. **Executable** — a case asserting the **file header** (lines 1–31) no longer describes landing as
   automatic *and* that `recordPrepVerdict`'s JSDoc no longer contains `"LANDS OR PARKS"`. Both asserted
   positively — that they describe the credential downgrade — because a bare string-absence check is green
   today for the header and would be decorative.
8. **Mutation** — deleting step 7's push reddens case 2; deleting step 0's credential resolution reddens
   case 3; changing `?? true` to a plain read reddens case 4; deleting the push-failure branch reddens
   case 5. Each by name.
9. `npm run check:standards` shows no new warnings against the 0-error / 1435-warning baseline.
