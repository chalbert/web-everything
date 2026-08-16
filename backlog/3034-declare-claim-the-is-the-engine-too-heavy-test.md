---
bornAs: x65hozr
kind: story
size: 5
parent: "3029"
status: resolved
blockedBy: ["3032"]
dateOpened: "2026-08-08"
dateStarted: "2026-08-16"
dateResolved: "2026-08-16"
graduatedTo: scripts/operations/claim.mjs
preparedDate: "2026-08-15"
scope:
  - we:scripts/operations/
  - we:scripts/backlog.mjs
  - we:scripts/backlog/
scopeRationale: "Three loci, widened during prep from the original operations/-only scope: two new declaration files plus a we:scripts/operations/run.mjs registration under operations/ (mirrors #3035/#3037's own scope shape); a rewire of we:scripts/backlog.mjs's claim verb to call the new operation (the acceptance criterion names the command-line caller, which is this file); and one extracted shared module under backlog/ (we:scripts/backlog/guarded-write.mjs) so the write-time guard chain is not duplicated. Each directory entry is genuinely spanned by this slice's own files, not a default-wide net."
tags: [plateau-loop, delivery, operations, claim]
---

# Declare claim — the is-the-engine-too-heavy test

An operation with **no model step and no human step**: `compute` and `effect` only. Claiming an item reads
ownership state and writes a status change; there is no judgment in it and nobody to ask.

## Why it is worth declaring something this small

This is a deliberate probe, not filler. The risk [#3029] is managing is that engines over-abstract, and the
failure is silent — every operation fits, each one slightly badly, and four kinds quietly becomes seven. The
cheapest way to catch that is to run the smallest possible operation through the machine early: **if declaring
`claim` feels like ceremony, the engine is over-built and we learn it here**, on two points, rather than on the
fifth conversion.

A concrete thing to watch: `claim` has a real invariant that ownership is `status: active`, **not** git state — an
uncommitted working tree is never a reason to drop a claim. That invariant belongs in the pure core. If expressing
it in a declaration is awkward, that is a finding about the engine, and it should be written down rather than
worked around.

## Preparation findings (2026-08-15) — `claim` is not as small as the card's title implies

Re-verified against the live machinery, not assumed. `node we:scripts/backlog.mjs claim` is `we:scripts/backlog.mjs`'s
`transition()` function (`we:scripts/backlog.mjs:306-475`), and it does far more than "read ownership state and
write a status change":

- **The ownership invariant is already live and already pure.** `we:scripts/backlog/frontmatter.mjs:212-222`
  (`applyTransition(content, 'claim', {today, as})`) refuses unless `status === 'open'`, and never reads git —
  the invariant the card names is not aspirational, it exists today, in a function this operation should call,
  not re-derive.
- **Three real IO-backed guards sit in front of that pure core**, each reading a small JSON sidecar or `git
  status`, none of them mentioned in the card: the ready-to-merge/queued guard (`we:scripts/backlog.mjs:323-330`,
  `we:scripts/readiness/queued-state.mjs#isQueued`), the prepare-hold guard (`we:scripts/backlog.mjs:335-341`,
  `we:scripts/readiness/prepare-hold-state.mjs#isHeld`/`#heldBy`), and the claim-first dirty-file guard
  (`we:scripts/backlog.mjs:352-356`, a scoped `git status --porcelain -- <rel>`). `--force` overrides all three.
  **None of the three is covered by an existing test** — `we:scripts/__tests__/backlog-cli-snapshot.test.mjs`
  covers the happy path and the interactive/background messaging split, not these guards.
- **The write itself is guarded, not a bare `writeFileSync`.** `we:scripts/backlog.mjs:105-163`
  (`writeBacklogMd`/`writeBacklogMdUnguarded`, module-local, **not exported**) refuses a write into the shared
  primary checkout (`laneGuardDecision`, #2302/#104/#2219/#2339), scrubs the content for secrets (`scrubPublish`,
  #3015) and scans it for un-prefixed locus refs (`scanRepoLocusPrefixes`, #883) before calling `writeFileSync`.
  Two live golden-corpus fixtures pin the lane-isolation refusal text exactly:
  `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd.json` and
  `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd-override.json`. A declared operation whose sink re-derives this chain instead of calling it is
  the exact "re-declares, does not re-implement" defect the epic's own "Not in scope" line forbids — and because
  `writeBacklogMd` is not exported today, calling it from a new file is not possible without first extracting it.
- **`claim` has real subprocess consumers, not import consumers** — the same shape #1517/#1868's memory index
  and the checklist's item 1 warn about. None of them import `we:scripts/backlog.mjs`; all of them shell
  `node we:scripts/backlog.mjs claim <NNN>` as an instruction or a test fixture: `we:skills-src/batch-backlog-items/SKILL.md`,
  `we:skills-src/next-backlog-item/SKILL.md`, `we:skills-src/prepare-decision-item/SKILL.md`,
  `we:skills-src/closing-session/SKILL.md`, `we:skills-src/conveyor/delivery-agent-brief.md`, and the two
  golden-corpus fixtures above. `we:scripts/mine-golden-corpus.mjs` is the one exception that touches `claim`
  logic directly — it replays `applyTransition(before, 'claim', opts)` itself (`we:scripts/mine-golden-corpus.mjs:119-121`),
  never shells the CLI, so it is unaffected as long as `applyTransition` itself is untouched (it is — see the
  decided design below).

None of this is a reason to abandon the probe — if anything it sharpens the point: the thing worth learning is
whether a `claim` this guard-laden **still** fits `compute` + `effect` cleanly. But it does mean the card's
original `size: 2` undercounted the real surface, and the acceptance line ("the ownership invariant enforced in
the pure core") is easy to satisfy trivially (declare a toy operation that only calls `applyTransition` and skips
the three real guards) in a way that would make the probe dishonest. The decided design below keeps the real
guards in scope on purpose.

## Decided design

Three steps, `compute` → `compute` → `effect`, no `judge`, no `confirm` — structurally identical to
`we:scripts/operations/dispatch-lane.mjs`, the one existing operation with the same shape (also no judge, no
confirm, also a real IO-backed guard set feeding a pure verdict). That is the concrete evidence this shape is
already proven to fit something non-trivial, which is the strongest argument for building it this way rather than
inventing a new pattern:

| step    | kind      | does |
|---------|-----------|------|
| `read`  | `compute` | shapes one injected `readClaimContext({ref})` call into a `read` finding: resolved file/id, current `status`, `queued`, `heldBy`, `dirty`, `today` |
| `plan`  | `compute` | replays the SAME guard order `we:scripts/backlog.mjs:317-357` uses (queued → prepare-hold → dirty-file, each skippable by `force`), then calls `applyTransition` (imported, not re-derived) for the actual splice |
| `write` | `effect`  | declares ONE effect carrying the already-computed new file bytes; the sink applies them through the extracted guarded writer |

**`plan` THROWS on a real guard violation** (already claimed, queued, prepare-held, or dirty-file, absent
`--force`) rather than returning a benign zero-effect verdict. This is a deliberate divergence from
`dispatch-lane`'s "nothing to dispatch this tick" pattern: dispatch-lane's non-dispatch is a *normal* outcome
most ticks produce, but `claim`'s guard violations are exactly what `we:scripts/backlog.mjs`'s `die()` treats as
exit-1 failures today (see `we:scripts/backlog.mjs:326-328`, `:340`, `:356`) — matching that contract, not
softening it, is what "the ownership invariant enforced in the pure core" has to mean if it is going to be
checked rather than merely asserted. This mirrors how `we:scripts/operations/review-pr.mjs`'s `record` step
throws when `decideSetLabel` disallows a swap (`we:scripts/operations/review-pr.mjs:509-518`) — a declared step
throwing on a genuine refusal is an established pattern in this engine, not a new one.

**The declared operation runs in parallel to `we:scripts/backlog.mjs claim`, and `we:scripts/backlog.mjs claim`
is rewired to call it** for the guard+splice+write core, exactly as `we:scripts/operations/review-pr.mjs` (#3035)
did not just add a new dormant capability but replaced the review skill's own hand-rolled flow (its "How it
landed" note: *"The skill body went 246 → 106 lines"*, `we:backlog/3035-declare-review-pr-and-generate-its-cli-adapter.md`).
The acceptance line — *"`claim` runs through the declared operation from the command-line caller"* — reads the
same way: `we:scripts/backlog.mjs claim <NNN>` is *the* command-line caller today, so it is the one that has to
actually route through the engine, not stay a second, un-migrated implementation sitting beside a new one nobody
calls. Reservations-clearing, the `we:.claude/skills/batch-backlog-items/claims.json` attribution baseline, and the rename-slug/two-turn-stop/background
messaging (`we:scripts/backlog.mjs:406-475`) are explicitly **excluded** from the declared operation itself —
they are `we:scripts/backlog.mjs`-specific UX/bookkeeping, not the ownership invariant, and stay in
`we:scripts/backlog.mjs`, now reading their inputs off the operation's returned finding instead of local
variables. This mirrors review-pr leaving the chat-rename discipline out of the declaration entirely.

## Interfaces

`we:scripts/operations/claim.mjs` (new, mirrors `we:scripts/operations/dispatch-lane.mjs`'s shape):

```js
export const CLAIM_OP = 'claim';
export const CLAIM_EFFECT = 'backlog.claim-write';

// PURE. Shapes one readClaimContext() result. Refuses a not-found ref.
export function shapeClaimRead(raw, { ref } = {}) { /* { found, abs, rel, id, status, content, queued, heldBy, dirty, today } */ }

// PURE. Same guard order as we:scripts/backlog.mjs's transition(). Throws on a real refusal (see decided design).
// Calls applyTransition (imported from we:scripts/backlog/frontmatter.mjs) for the splice itself.
export function planClaim(read, { as, force } = {}) { /* -> { claiming: true, content, id, claimedStatus, today } */ }

export function claimOperation({ readClaimContext } = {}) {
  // throws TypeError if readClaimContext is not a function — same injected-IO contract as
  // we:scripts/operations/review-pr.mjs#reviewPrOperation and dispatch-lane.mjs#dispatchLaneOperation.
  return op(CLAIM_OP, {
    input: {
      ref: 'string',                                                       // NNN or xNNNNNN — resolveFile's own input shape
      as: { type: 'string', required: false, default: 'active', enum: ['active', 'preparing'] },
      force: { type: 'boolean', required: false, default: false },
    },
    verdictFrom: 'plan',
    read:  compute({ reads: ['input.ref'], fn: (view) => shapeClaimRead(readClaimContext({ ref: view.input.ref }), { ref: view.input.ref }) }),
    plan:  compute({ reads: ['input.as', 'input.force', 'findings.read'], fn: (view) => planClaim(view.findings.read, { as: view.input.as, force: view.input.force }) }),
    write: effectStep({
      reads: ['verdict', 'findings.read'],
      effects: (view) => [{
        type: CLAIM_EFFECT,
        // IDEMPOTENT: TRUE — the payload's `content` is a value plan() already fully computed; re-writing the
        // identical bytes on replay is safe, same reasoning as review-pr's staged write-up effect (ordinal 0).
        idempotent: true,
        payload: { abs: view.findings.read.abs, rel: view.findings.read.rel, content: view.verdict.content },
      }],
    }),
  });
}
```

`we:scripts/operations/claim-io.mjs` (new, mirrors `we:scripts/operations/dispatch-lane-io.mjs`):

```js
// Composes the SAME sources we:scripts/backlog.mjs's transition() reads: file resolution (idFromName/normalizeId
// off we:scripts/backlog/id.mjs, mirroring resolveFile), we:scripts/readiness/queued-state.mjs#isQueued,
// we:scripts/readiness/prepare-hold-state.mjs#isHeld/#heldBy, and a scoped `git status --porcelain -- <rel>`
// (best-effort: a git hiccup reads as clean, matching we:scripts/backlog.mjs:353-355's own convention).
export function createClaimReader({ root = REPO_ROOT } = {}) { /* -> ({ref}) => rawContext */ }

// Applies the ONE effect through the extracted guarded writer (see Tasks) — never a bare writeFileSync.
export function createClaimSinks({ root = REPO_ROOT } = {}) {
  return { [CLAIM_EFFECT]: async (payload) => { writeBacklogMd(payload.abs, payload.rel, payload.content); return { abs: payload.abs, rel: payload.rel }; } };
}
```

`we:scripts/backlog/guarded-write.mjs` (new — extracted, not reimplemented, from `we:scripts/backlog.mjs:105-163`):

```js
// writeBacklogMd(abs, rel, content, {root}) and writeBacklogMdUnguarded(abs, rel, content, {root}) — the SAME
// lane-guard + secret-scrub + locus-prefix chain, moved verbatim. Its internal `die()` calls (process-exiting)
// become `throw new Error(...)`, since a shared library cannot exit the caller's process; we:scripts/backlog.mjs's
// own call sites wrap the call and pass the thrown message to their own `die()` to keep today's exact exit-1
// text and code unchanged.
export function writeBacklogMd(abs, rel, content, { root } = {}) { /* … */ }
export function writeBacklogMdUnguarded(abs, rel, content, { root } = {}) { /* … */ }
```

Registration — `we:scripts/operations/run.mjs`'s `OPERATIONS` table gains one entry (the "declaring a second
operation buys its command line for free" property the file's own header states):

```js
[CLAIM_OP]: () => ({ declaration: claimOperation({ readClaimContext: createClaimReader() }), sinks: createClaimSinks() }),
```

which alone makes `node we:scripts/operations/run.mjs claim --ref=<NNN> [--as=preparing] [--force] [--json]` work.

**Open implementation detail, named rather than solved here (the builder's call, informed by the two real
constraints):** `we:scripts/backlog.mjs` is a synchronous, `process.exit()`-driven CLI script end to end, and
`we:scripts/operations/cli-adapter.mjs`'s `driveRun`/`runOperationCli` are `async`. Rewiring `transition()`'s
`v === 'claim'` branch to call the operation means either (a) making `we:scripts/backlog.mjs`'s top-level
dispatch `async` (the same shape `we:scripts/operations/run.mjs`'s own `IS_CLI` block already uses — `.then()` /
`.catch()` around a single async entry), touching every verb, or (b) driving the run with a narrower synchronous
helper that only exercises `compute`/`effect` steps (this operation never awaits a judge or a person, so nothing
in this ONE run is genuinely asynchronous — the `await` in `driveRun` exists for operations that suspend, and
`claim` never does). Recommendation: (b) — a `runClaimOnce({declaration, registry, sinks, input})` helper local
to `we:scripts/operations/claim-io.mjs` or `we:scripts/backlog.mjs` itself that drives `read`→`plan`→`write` to
completion without going through the general async adapter, since introducing `async` across the whole 500+-line
CLI to serve one verb is a materially larger and riskier change than this slice's own scope. State this decision
on the card once the builder has actually tried it — if (b) turns out not to compose cleanly with
`applyPendingEffects` (which is itself `async`), that is exactly the kind of "declaring this felt heavy" finding
the probe exists to surface, and belongs in the required verdict paragraph, not silently worked around.

## Consumers (verified, not assumed)

Everything that shells `node we:scripts/backlog.mjs claim` — `we:skills-src/batch-backlog-items/SKILL.md`,
`we:skills-src/next-backlog-item/SKILL.md`, `we:skills-src/prepare-decision-item/SKILL.md`,
`we:skills-src/closing-session/SKILL.md`, `we:skills-src/conveyor/delivery-agent-brief.md`, and the golden-corpus
fixtures `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd.json` and
`we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd-override.json` — is **not edited** by this slice. Its job is to verify none of them observe a
behavior change: same messages, same exit codes, same frontmatter bytes, same lane-isolation refusal text. That
non-regression is exactly what the Done-when list below tests directly rather than asserts.

## Tasks

1. Extract `writeBacklogMd`/`writeBacklogMdUnguarded` out of `we:scripts/backlog.mjs` (lines 105-163) into
   `we:scripts/backlog/guarded-write.mjs`, exported; update `we:scripts/backlog.mjs` to import and call them —
   a pure move, zero behavior change. Verify: `we:scripts/__tests__/backlog-cli-snapshot.test.mjs` and the two
   `backlog-mutation-primary-cwd*` golden-corpus fixtures still pass unchanged.
2. Write `we:scripts/operations/claim.mjs` (`claimOperation`, `shapeClaimRead`, `planClaim`, `CLAIM_OP`,
   `CLAIM_EFFECT`) per the Interfaces section — importing `applyTransition` from
   `we:scripts/backlog/frontmatter.mjs`, `isQueued` from `we:scripts/readiness/queued-state.mjs`, `isHeld`/
   `heldBy` from `we:scripts/readiness/prepare-hold-state.mjs`. Unit-testable with a stub reader, mirroring
   `we:scripts/operations/__tests__/dispatch-lane.test.mjs`'s structure.
3. Write `we:scripts/operations/claim-io.mjs` (`createClaimReader`, `createClaimSinks`) per the Interfaces
   section, calling the extracted writer from task 1. Mirrors `we:scripts/operations/dispatch-lane-io.mjs`.
4. Register `CLAIM_OP` in `we:scripts/operations/run.mjs`'s `OPERATIONS` table.
5. Resolve the async-vs-sync question named above, then rewire `we:scripts/backlog.mjs`'s `transition()` for
   `v === 'claim'`: replace the inline queued/prepare-hold/dirty-file guard block and the
   `applyTransition`+`writeBacklogMd` calls with a call into the declared operation. Reservations-clear,
   `we:.claude/skills/batch-backlog-items/claims.json` attribution, and the rename/stop/background messaging stay put, now reading the operation's
   returned finding instead of local variables. Preserve every existing message and exit code exactly.
6. Run `we:scripts/__tests__/backlog-cli-snapshot.test.mjs` in full — every existing `claim` case must pass with
   zero changes to its assertions.
7. Run the two lane-guard golden-corpus fixtures from task 1 again post-rewire — same requirement.
8. Add unit tests for the three previously-untested guards (queued, prepare-held, dirty-file) plus `--force`
   override and idempotent replay of the `write` effect, mirroring
   `we:scripts/operations/__tests__/dispatch-lane.test.mjs` / `dispatch-lane-io`'s test shape.
9. Write the required probe-verdict paragraph on this card (see Acceptance) — informed by what tasks 1-8 actually
   cost, in particular whether the async/sync seam in task 5 composed cleanly or fought the model.

## Done when

- `node we:scripts/operations/run.mjs claim --ref=<NNN>` transitions a fixture item open → active, stamps
  `dateStarted`, and produces file bytes identical to what `node we:scripts/backlog.mjs claim <NNN>` produces today.
- A queued item, a prepare-held item, and an item whose own file is dirty each refuse claim through **both**
  callers (same underlying guard, not two copies) with an actionable message; `--force` overrides each.
- `we:scripts/__tests__/backlog-cli-snapshot.test.mjs`'s existing `claim` suite (happy path, two-turn stop
  message, conveyor background carve-out, `--as=preparing`, JSON payload) passes with zero assertion changes.
- `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd.json` and
  `we:scripts/golden-corpus/hook-guard-bash/backlog-mutation-primary-cwd-override.json` pass unchanged — the
  lane-isolation refusal is reached the same way through the new sink as through the old inline write.
- A `write` effect replayed after a simulated crash between `pending` and `applied` produces byte-identical
  output and does not double-write.
- `npm run test:unit` (scoped to `we:scripts/operations/__tests__/` and `we:scripts/__tests__/backlog*`) and
  `npm run check:standards` are both green.
- The card carries the required probe-verdict paragraph (see Acceptance) — a green build with no verdict
  recorded does not satisfy this item.

## Delivery shape

Lands as **one PR**, matching every prior slice under epic #3029 (`review-pr` #3035, `dispatch-lane` #3037 each
landed as a single PR, not split across `main`). It can be structured as ordered, individually-readable commits
inside that PR — extraction (task 1) → declaration + io + registration (tasks 2-4) → the `we:scripts/backlog.mjs`
rewiring (task 5) → tests (6-8) — but does not merge piecemeal: shipping the declaration without actually wiring
the real command-line caller through it would leave the acceptance line unmet, exactly as `we:backlog/3035-*.md`'s
own precedent shows (it explicitly migrated the review skill in the same slice, not a follow-on one).

## Acceptance

`claim` runs through the declared operation from the **command-line** caller, with the ownership invariant
enforced in the pure core. The HTTP caller is deliberately *not* an acceptance criterion here — it arrives with
[#3036] and, if the epic's claim holds, needs nothing from this slice — which is why this item is blocked only
on the engine and stays independently landable. **The slice is not done until it records a verdict on the probe** — one
paragraph on the item saying whether the declaration felt proportionate, and if not, exactly what was heavy. A
green build with no verdict recorded misses the point of the slice.

## Independent review — not yet done

Per the story-preparation checklist's item 9 (`we:agent-memory-src/story-preparation-checklist.md`), this card is
**prepared**, not yet **build-ready**: everything above is grounded against the live code as read on 2026-08-15,
but the preparer is the wrong person to catch a mistake in their own reasoning, and none of it has had an
independent, headless-sessioned pass yet. `we:scripts/operations/review-prep.mjs` — the operation this repo
already built for exactly this pattern — is the mechanized way to run that pass
(`node we:scripts/operations/run.mjs review-prep --item=3034 --repo=chalbert/web-everything`); it was deliberately
**not** run as part of this preparation, because its `record` step commits and hands the result straight to
`we:scripts/pr-land.mjs` on a clean verdict, which would self-land this card without the human-in-the-loop review
this task's own instructions call for. Run it (or an equivalent independent read) before a build starts against
this card.

## How it landed (2026-08-16) — the required probe verdict

Built per the decided design: `we:scripts/operations/claim.mjs` (`shapeClaimRead`/`planClaim`/`claimOperation`,
`compute` → `compute` → `effect`, no judge, no confirm), `we:scripts/operations/claim-io.mjs` (the injected
reader + the one sink), `we:scripts/backlog/guarded-write.mjs` (the extracted `writeBacklogMd`/
`writeBacklogMdUnguarded`, now throwing instead of exiting), a registration in
`we:scripts/operations/run.mjs`, and the rewire of `we:scripts/backlog.mjs`'s `claim` verb onto
`claimViaOperation()`. All Done-when items verified live (see the smoke test transcript in this build's
session): the queued/prepare-held/dirty-file guards refuse through both callers with identical text,
`--force` overrides each, `we:scripts/__tests__/backlog-cli-snapshot.test.mjs`'s existing `claim` suite and
both `backlog-mutation-primary-cwd*` golden-corpus fixtures pass with zero assertion changes, a simulated
crash-then-replay of the `write` effect reproduces byte-identical output without a structural double-apply
(`we:scripts/operations/__tests__/claim.test.mjs`), and `check:standards` is green (0 errors).

**The ownership invariant itself was never the heavy part.** `applyTransition`'s `status !== 'open'` refusal
was already pure and already existed; `planClaim` calls it unchanged. The three real IO-backed guards
(queued / prepare-held / dirty-file) also mapped onto `compute` cleanly — replaying `we:scripts/backlog.mjs`'s
own guard order and having `plan` THROW on a refusal (mirroring `dispatch-lane`/`review-pr`'s precedent) read
as a natural fit, not ceremony. If the card had stopped at "declare the guard chain + splice," the answer
would be a clean "no, it wasn't too heavy."

**Where it WAS heavy: the async/sync seam named in the card's "open implementation detail" (Task 5), and it
is heavy in a way that is structural to the engine, not to `claim`'s own logic.** `we:scripts/backlog.mjs` is
a synchronous, `process.exit()`-driven CLI; the engine's effect application (`applyPendingEffects`) is `async`
by construction, because it is sized for an operation that may genuinely suspend (a `judge` spawn, a
cross-process `dispatch: true` in-flight park). `claim` never does either, but it still had to pay for the
whole apparatus that exists to serve operations that do: a `driveRun` call that takes an (unusable, unreached)
`judge` parameter because the adapter's signature has no "this operation can never suspend on one" shortcut;
an in-flight run record with effect keys, idempotency flags and applied/pending/failed status tracking, for a
write whose real crash-safety was ALREADY provided for free by the frontmatter's own `status` field (a
half-applied claim just leaves `status: open`, and a retried claim naturally either succeeds or is refused by
the SAME invariant — no replay-from-a-persisted-run-record was ever actually needed for the CLI's own call
site, only for `node we:scripts/operations/run.mjs claim`'s independent, resumable entry point); and a genuinely awkward "wrap one
verb in an async function and `.catch()` it at the switch" seam bolted onto an otherwise fully synchronous
500+-line file, which option (a) — making the whole CLI async — would have made worse, not better; (b) (the
one built) contains the damage to one function but is still visibly a graft. **Net: the guard-chain-plus-write
part of `claim` is a good fit for `compute`/`compute`/`effect`; the fixed cost every declared operation pays
for suspend/resume, cross-process replay and run-record bookkeeping is sized for `review-pr`/`dispatch-lane`,
and `claim` paid the same fixed cost for none of the benefit.** The concrete number: the old inline
implementation was ~90 lines in one file; the new one is ~450 lines across four files to do the identical job
with identical output, and roughly half of that growth is the suspend/replay/async-adapter scaffolding rather
than the guard logic itself. That is the finding the probe exists to surface — not a reason to have skipped
declaring `claim`, but real evidence that a THIRD, lighter-weight step vocabulary — or a `compute`-plus-
single-effect fast path that skips the suspend/resume ceremony entirely for an operation that never suspends —
is worth considering before a fourth small, judge-less, confirm-less operation is declared onto this same
machinery.
