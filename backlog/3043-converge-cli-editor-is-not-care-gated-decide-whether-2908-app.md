---
bornAs: xr3ecpv
kind: decision
blockedBy: ["2908"]
relatedTo: ["2970"]
status: open
dateOpened: "2026-08-08"
preparedDate: "2026-08-16"
tags: [review, converge-loop]
---

# /converge's editor is not care-gated — decide whether #2908 applies to the lane-working-tree loop too

No greenfield design is at stake here — this is internal delivery-tooling policy, grounded entirely in the
shipped mechanism (every claim below is a `file:line` cite into the real tree), so no `/research/` prior-art
survey applies; the same carve-out #2908 itself used for this exact question. **One fork.** The recommended
default below is **(b) — leave `/converge` ungated and codify why**. It survived a dedicated skeptic attack
(see `Skeptic:` below) on the strength of two facts the original framing under-weighted: #2908's hazard is a
**two-party** one (a machine substituting for *another person's* fix, irreversibly, on *their* branch), and
`/converge` has no second party — the operator who runs it **is** the owner of the tree it edits — *and*
`/converge` is stated ADVISORY-ONLY and never itself opens, labels, or lands a PR, so nothing it does reaches
another reviewer without the operator separately choosing to promote it.

## The axis

Two editor call-sites exist today, and they are gated **differently**:

- **The parked-PR loop** (`we:scripts/workflows/review-parked-prs.mjs`) gates its editor to care `low` only
  (#2908, codified `we:docs/agent/platform-decisions.md:3430` `#converge-editor-enabled-at-low-only`). The gate
  lives in the **harness**, not a shared core: `editorMayPush(pinned, careLevel)` at
  `we:scripts/workflows/review-parked-prs.mjs:252`, re-checked every round at `:1299`, mirroring the tested spec
  `editorMayPush` in `we:scripts/lib/review-core.mjs:768`. The policy itself — which bands qualify, and the
  2-round floor an editor-enabled band needs — is single-sourced in `we:scripts/lib/jury-core.mjs`:
  `EDITOR_ENABLED_CARE_LEVELS = [low]` (`:755`), `EDITOR_MIN_ROUNDS = 2` (`:765`), and the pure predicate
  `editorPolicyForCareLevel(careLevel)` (`:785-803`) that combines them.
- **`/converge`** (`we:scripts/converge-cli.mjs` driving `we:scripts/lib/converge-core.mjs`) has **no gate at
  all**. `convergeStep`'s `continue` branch returns `CONVERGE_ACTIONS.EDIT` unconditionally
  (`we:scripts/lib/converge-core.mjs:536-539`) — nothing there reads `careLevel`, and
  `we:scripts/lib/converge-core.mjs` doesn't even import `editorPolicyForCareLevel` (its declared jury-core
  contract, `:27-33`, lists ten
  exports and that isn't one). The CLI honors the action just as unconditionally:
  `we:scripts/converge-cli.mjs:424-430` builds an `edit` instruction the moment `result.action ===
  CONVERGE_ACTIONS.EDIT`, no care check in between. And `/converge`'s **default** care band is `elevated`,
  not `low` (`we:scripts/converge-cli.mjs:70-76`) — deliberately, per that file's own comment, because at the
  *old* default (`low`, 1 round) "THE EDITOR COULD NEVER RUN." So today, typing bare `/converge` runs the
  editor, unexamined, at precisely the care band (`elevated`) that #2908 excluded **on evidence** — PR
  #1018, the loop's only observed editor failure (a 15-file "fix" that the next round faulted three ways,
  including a fail-open in the very gate the fix had just written).

**Why this is a fork, not a dissolve.** The two mechanisms cannot both be "the rule" — either the same
editor-enablement predicate governs both call sites, or `/converge` keeps running unexamined. This isn't a
config dimension a caller picks per-run (like a `--care` band itself): it is a fixed policy choice about
whether a **second, independent** editor path is subject to the rule #2908 ratified for the first one, made
once, for everyone who runs `/converge`. And it is exactly the fork #2970 needs answered first: that item
(`we:backlog/2970-migrate-the-parked-pr-review-harness-onto-the-extracted-conv.md:15`) merges the two loops'
control flow onto the shared core, and whichever gate answer lands first is the one the merge inherits by
default — hence `2970`'s `blockedBy: ["3043"]`.

### Recommended path at a glance

| | recommended default | main alternative | confidence |
| --- | --- | --- | --- |
| Fork 1 | **(b) leave `/converge` ungated; codify the asymmetry** | (c) gate to `low`-only + lower `/converge`'s default care to `low` | med — a real judgment call, not a forced invariant |

## Fork 1 — Does `/converge`'s editor inherit #2908's low-only gate?

*Fork-existence justification:* the two coherent branches — "one shared enablement rule" and "two
independently-policed call sites" — cannot both be true of the same code at the same time; a given run of
`/converge` either checks `editorPolicyForCareLevel` before pushing or it does not. Not a cost question:
strip implementation effort to zero and the branches still differ in what a machine is permitted to do to a
tree with no human having looked at the round yet.

**(a) Extend the gate into `convergeStep` itself, unconditionally.** Make the pure core refuse to emit `EDIT`
outside `EDITOR_ENABLED_CARE_LEVELS`. **Rejected as the implementation shape, independent of the policy
call.** `we:scripts/lib/converge-core.mjs`'s own header (`:18-20`) states the seam deliberately: the core does the
*sensing and reduction*, the harness *executes actions*; #2970's whole reason to exist is that the parked-PR
loop's gate is already a harness-level policy check (`editorMayPush`, above), not a core-reduction rule.
Baking a *specific* enablement policy into the shared pure core would (1) make every future caller of
`convergeStep` inherit today's `low`-only policy with no seam to differ, exactly the coupling #2970 is
building the shared core to avoid, and (2) contradict the core's own "every export is a total function,
policy-free" framing. The uniform-policy *intent* (a)'s title asks for is real and is captured instead by
**(c)** below, at the harness layer where the parked-PR loop's gate already lives — this option is a
mislocation of that intent, not a distinct policy, so it drops out.

- **(b) Leave `/converge` ungated, and record why the two loops differ — deliberately, in the statute.**
  `we:scripts/converge-cli.mjs` and `we:scripts/lib/converge-core.mjs` ship byte-for-byte as they are today;
  the only change is a new entry in `we:docs/agent/platform-decisions.md` stating the asymmetry and its
  ground. **Rationale, beyond the
  reversibility point the original framing already made:** #2908's own stated hazard
  (`we:backlog/2908-…:180-182`, *"the branches cannot coexist — a given pass either mutates the author's branch
  or it does not, and the mutation is not reversible from the author's side… a machine-authored patch
  substituting for the author's own fix is still a correctness, trust and accountability difference"*) is a
  **two-party** hazard: a machine silently subs in for a *different person's* fix, on *their* branch,
  without their moment-to-moment consent. `/converge` has no second party in that relationship — the
  operator who typed `/converge` **is** the owner of the lane it edits, is present for the run, and can
  `git diff` / `git checkout --` / `git reset` before anything reaches a PR. What survives from #2908's
  evidence is the *narrower*, mechanism-quality claim (PR #1018: an editor can produce a confidently-wrong
  fix at `elevated`, and the next round's re-judge is what caught it, not a person) — a real risk, but one
  `/converge`'s own re-judge round already targets, and one that is about editor *reliability*, not about
  *whose* branch it is. Codifying this keeps #2908's rule scoped to the hazard it actually named.
  - **Code shape (illustrative — a doc-only change, not a diff to ship with the ruling):** nothing in
    `we:scripts/converge-cli.mjs` or `we:scripts/lib/converge-core.mjs` changes; `we:docs/agent/platform-decisions.md`
    gains an anchor (working title `#converge-loop-editor-scoped-to-branch-mutation`) that cross-references
    `#converge-editor-enabled-at-low-only` and states the scope explicitly: *"the low-only gate applies to
    the editor path that mutates a branch other than the operator's own working tree; `/converge`, which
    edits the lane the operator pointed it at, is out of scope, on the ground stated here."*
- **(c) Gate `/converge` to `low`-only too, and lower its default care band to `low` so the editor stays
  reachable by default.** Pairs the harness-level check from (a)'s intent with a default-care change so
  daily `/converge` usage doesn't silently become review-only. **Rejected as the default, not as
  unreasonable** — it is the honest way to get uniformity if the two-party distinction in (b) is judged not
  to hold. Costs: (1) it changes `/converge`'s **panel** rigor by default (from `elevated`'s richer roster to
  `low`'s 1-juror-per-lens, `EDITOR_MIN_ROUNDS`-floored 2 rounds) purely to keep the *editor* reachable —
  conflating "how hard should the panel look" with "may a machine push," the exact two-different-questions
  point `#converge-editor-enabled-at-low-only` itself makes about `high`-band diffs
  (`we:docs/agent/platform-decisions.md:3432`, *"Care is still advisory for RIGOR… they do not park a PR for
  a human"*) — here it
  would make rigor and enablement move together for the first time, for reasons of `/converge`'s UX rather
  than the risk model; (2) an operator who wants both a richer default panel *and* auto-editing loses that
  combination, and must now pass `--care=low` explicitly to get either.
  - **Code shape:** add the harness-level check at `we:scripts/converge-cli.mjs:424` (mirroring
    `we:scripts/workflows/review-parked-prs.mjs:1299`'s `editorMayPush`):
    ```js
    } else if (result.action === CONVERGE_ACTIONS.EDIT) {
      const policy = editorPolicyForCareLevel(result.state.careLevel);
      if (!policy.editorEnabled) {
        instruction.escalation = buildEscalationPacket(result.state, { ...result, reason: 'editor-not-enabled-at-care' });
      } else {
        instruction.edit = resolved.transport.applyRevision({
          findings: result.findings, round: result.state.round, roundCap: result.state.roundCap, ctx: envelope.ctx,
        });
      }
    }
    ```
    plus `const DEFAULT_CARE = CARE_LEVELS.LOW;` at `we:scripts/converge-cli.mjs:76` (was `CARE_LEVELS.ELEVATED`).

**Sub-question folded in, not a separate fork:** whichever way Fork 1 goes, the *mechanical* location of a
harness-level gate (if one is added) is settled by the code-shape note under (c) above — a check in
`we:scripts/converge-cli.mjs`'s step handler, not inside `convergeStep` — so #2970's migration has a single
answer to carry forward regardless of which policy wins.

**Skeptic:** `SURVIVES-WITH-AMENDMENT.` *(Self-conducted — the dedicated subagent dispatch this pass normally
uses was unavailable at prep time (concurrency limit); the four-axis attack below was run directly against
the draft, hardest against the classification and merit axes, and its strongest finding is folded in rather
than asserted away.)* **Classification:** does not dissolve to a config dimension — #2908 itself treated
"which care bands enable the editor" as a genuine ratifiable fork on the *same* axis (`we:backlog/2908-…`,
Fork 1), so the precedent already rejects reading this as a self-evident knob rather than a policy call.
**Merit — the strongest attack, and where the amendment lands:** *"PR #1018's failure mode — an editor
producing a confidently-wrong fix — doesn't care whose branch it's on; an operator trusting a clean `land`
verdict could still promote a self-inflicted defect into a PR, at which point the 'reversible from their
side' framing has already been spent."* This is a real gap in the original framing, and checking it against
the shipped skill closes it rather than refuting (b): **`/converge` is stated ADVISORY by design and never
promotes anything itself** — `we:skills-src/converge/SKILL.md`'s own frontmatter: *"it reports a verdict and
never opens, labels, or lands a PR… whether the work ships stays the human's call."* So the two-party
argument doesn't rest only on git-undo (a technical possibility a rushed operator could skip); it rests on a
**second, independent, structural checkpoint** — nothing in this loop can reach a PR without the operator
separately choosing to run `we:scripts/pr-land.mjs` afterward, at which point ordinary PR review (and, for anything
routed there, the parked-PR loop's *own* low-only gate) still applies. The amendment: (b)'s rationale above
is strengthened with this citation rather than resting on reversibility alone. **Statute-overlap:** the
proposed anchor cross-references `#converge-editor-enabled-at-low-only` explicitly and narrows its own scope
in the same sentence ("applies to the editor path that mutates a branch other than the operator's own
working tree") — no duplication, since the two anchors would govern disjoint mechanisms by the text as
written. **Citation-scope:** (b) does not over-read #2908's authorizing scope — #2908's own `scope:`
frontmatter names only `we:scripts/workflows/review-parked-prs.mjs` + `we:scripts/lib/jury-core.mjs` +
`we:scripts/lib/review-core.mjs` + `we:scripts/review-core-cli.mjs` (`we:backlog/2908-…:14-18`), and its
Fork 1 crux is framed throughout around "the author's branch" / "the
author's own fix" (`we:backlog/2908-…:180-182`), never generalized to "any material an editor touches" — so
(b) reads the citation at its stated width, not narrower than it. (a)/(c) were checked too: (a) is fairly
retired as a mislocated implementation of the same intent (c) already captures, not a strawman — nothing in
its case depends on being harder than necessary; (c)'s cost (coupling panel rigor to editor reachability) is
real and stated plainly rather than inflated.

**Screen:** `clear`. *(Self-conducted against the two fixed questions, same tool-availability note as
above — treat as un-attacked-by-a-second-mind and re-run at the decision turn if a fresh reader is
available.)* Q1 (standard-vs-impl): no boundary issue — both call sites are internal delivery tooling under
`scripts/`, nothing here is observable across the WE↔FUI boundary, and whether commits land in the
operator's own working tree vs. someone else's branch is fully observable process behavior, not a hidden
impl detail (mirrors `#2908`'s own screen verdict, `we:backlog/2908-…:268-269`). Q2 (merit-vs-prioritization):
imagine both branches free to build and instantly maintained — merit still differs: "a machine may silently
rewrite the operator's own tree with no gate" and "a machine may only do that below a risk threshold" are a
real trust/safety difference regardless of build cost, not a timing or effort question wearing a fork's
clothes.

**Skeptic (fresh-context, 2026-08-16):** `SURVIVES-WITH-AMENDMENT` — a second, independent four-axis pass
(per `we:docs/agent/backlog-workflow.md:421`'s fresh-context requirement; the prior pass above was
self-conducted and flagged as such). Every cited `file:line` was independently re-opened and confirmed to
say what the item claims: `we:scripts/lib/converge-core.mjs:536-539`'s `continue`-branch `EDIT` return is
unconditional, `editorPolicyForCareLevel` is absent from both the import list (`:49-61`) and the declared
jury-core contract (`:27-33`); `we:scripts/converge-cli.mjs:424-430` builds the edit instruction with no care
check in between, and `DEFAULT_CARE = CARE_LEVELS.ELEVATED` at `:76`, with the "editor could never run"
rationale verified verbatim; `we:scripts/workflows/review-parked-prs.mjs:252-254`'s `editorMayPush` and
`we:scripts/lib/jury-core.mjs:755/765/785`'s `EDITOR_ENABLED_CARE_LEVELS`/`EDITOR_MIN_ROUNDS`/
`editorPolicyForCareLevel` all match as cited. **Classification, merit, citation-scope: SURVIVE independently**
— re-confirmed by direct read of `we:backlog/2908-…`'s `scope:` frontmatter (`:14-18`, exactly the four files
cited, none of which is `we:scripts/converge-cli.mjs`/`we:scripts/lib/converge-core.mjs`) and its Fork 1 crux
(`:178-181`, framed throughout around "the author's branch" / "the author's own fix," never generalized).
**Statute-overlap: the axis that lands.** The item's proposed codified anchor cross-references only
`#converge-editor-enabled-at-low-only`. A broader grep of `we:docs/agent/platform-decisions.md` for the same
subject — does a Layer-1 self-review pass ever clear a diff on its own — surfaces two directly on-point,
already-ratified anchors the citation-scope check missed: **`#build-lane-self-review-non-zero-floor`** (#2828,
ratified 2026-08-01) and **`#agent-convergence-independent-validation`** (#2398). #2828 rules that a build's
Layer-1 self-review is "a non-clearing FIX pass… It never claims to be the safety net," bounded by an
independent Layer-2 clearance (#2398: "a builder may not clear its own diff") **regardless of that Layer-1
pass's rigor or depth** — and `/converge`'s own `we:skills-src/converge/SKILL.md` states it is the bounded
successor to exactly this category of pass (it replaces the prose loop at
`we:skills-src/conveyor/delivery-agent-brief.md`'s Step 6, "spawn one adversarial code-review subagent…
address every finding to convergence," which today still runs unmigrated). This matters beyond being a
stronger citation: `/converge`'s own frontmatter names a caller the (b) rationale's "operator… is present for
the run" leg does not cover — *"or when a delivery agent needs its converge-before-PR pass"* — an unattended
session with no live human watching each round. Under that caller, the "present, can `git reset` before
anything reaches a PR" leg of (b)'s three-part argument does not hold, which could look like it reopens the
merit gap. It does not, because the *load-bearing* leg was never presence — it is structural: independently
confirmed no bypass exists anywhere in `we:scripts/pr-land.mjs` / `we:scripts/workflows/review-parked-prs.mjs`
for a PR that already went through a `/converge` pass — every PR, however authored, still routes through the
same `#2908`-gated `review:pending` loop. #2828/#2398 say this is true **by ratified statute**, independent of
who or what triggered the Layer-1 pass, which is a strictly stronger and more durable ground than the
`we:skills-src/converge/SKILL.md` prose the prior pass leaned on (a doc file, not a
`we:docs/agent/platform-decisions.md` principle-surface — it carries none of
`#human-is-principle-surface-not-path`'s edit-gating, so its "advisory only" promise could drift under a
routine impl PR with no human-ratification step, unlike a statute anchor). **Amendment:** the eventual
codified anchor should cross-reference `#build-lane-self-review-non-zero-floor` and
`#agent-convergence-independent-validation` alongside `#converge-editor-enabled-at-low-only`, and the
"operator is present" clause should read as reinforcing, not load-bearing. No conflict between the anchors —
#2828/#2398 govern *whether Layer-1 self-review ever clears a diff on its own* (never), a layer above the
narrower question `#3043` answers (*may the Layer-1 editor write a fix at all*) — so this is a missed
reconciling citation, not a collision. **Secondary finding, non-differentiating:** the "advisory-only"
invariant's specific "never `git commit`/`push`/`gh pr create`" clause
(`we:scripts/lib/converge-transports.mjs:218`) is enforced by a **prompt-level instruction to the editor
subagent**, not a code-level or tool-permission gate — no matching block exists in `we:scripts/guard-bash.mjs`,
and the `we:skills-src/converge/SKILL.md` dispatch table (`edit` row) names no restricted agent/tool profile.
Flagged for completeness but it does not discriminate between (b) and (c): the identical convention-only
enforcement applies to whichever band's editor actually runs under either fork, and the statute-overlap
finding above is what actually backstops it (a PR still can't land without clearing the independently gated
Layer-2 loop, whatever the Layer-1 editor did or didn't obey).

**Screen (fresh-context, 2026-08-16):** `clear`. Independently re-run against the same two fixed questions.
Q1 (standard-vs-impl): confirmed clear — both call sites are internal delivery tooling under `scripts/`, no
WE↔FUI boundary is implicated, and whether an editor writes to the operator's own lane vs. another author's
branch is externally observable process behavior, not a hidden impl detail. Q2 (merit-vs-prioritization):
confirmed clear — stripping cost from both branches, (b) leaves an unattended editor able to write at
`elevated` by default with no override, while (c) restricts that to `low` and, as its own stated cost, couples
panel rigor to editor-reachability; that is a real trust/safety-vs-rigor difference, not a timing or effort
question wearing a fork's clothes.

### Review jury (provisional — pre-registered #2638)

_Care band: **elevated** (system-machinery — whichever branch is ratified touches shared review/convergence
plumbing (`we:scripts/lib/jury-core.mjs`, `we:scripts/lib/converge-core.mjs`) or the statute layer
(`we:docs/agent/platform-decisions.md`); not `high` — no branch here is a self-referential edit to the guard
that would police this very change). Predicted touch-set for the eventual buildable child, by branch:
(b) → `we:docs/agent/platform-decisions.md` only; (c) → `we:scripts/converge-cli.mjs`,
`we:scripts/lib/jury-core.mjs` (no change needed — reused), `we:docs/agent/platform-decisions.md`._

- **correctness (mandatory):** does the ruling's ground actually match the shipped code cited above — in
  particular, does `/converge` truly have no second-party branch owner, and does `editorPolicyForCareLevel`
  really compose the way the (c) snippet assumes?
- **standards-conformance (mandatory):** does the codified statute entry (whichever branch) cross-reference
  `#converge-editor-enabled-at-low-only` rather than duplicating or silently narrowing it (#1886
  statute-overlap)?
- **simplicity:** does the ratified branch avoid coupling panel rigor to editor enablement unless that
  coupling is the explicit point (the cost (c) names)?

## Context

### Lineage

`blockedBy: 2908` (resolved 2026-08-08, codified `#converge-editor-enabled-at-low-only`) — this item is the
question #2908 deliberately left open when it scoped itself to the parked-PR loop only
(`we:backlog/2908-…:14-15`, `scope:` lists only `we:scripts/workflows/review-parked-prs.mjs` +
`we:scripts/lib/jury-core.mjs` + `we:scripts/lib/review-core.mjs` + `we:scripts/review-core-cli.mjs`).
`relatedTo: 2970` — the migration that merges the two loops' control flow onto the shared
`we:scripts/lib/converge-core.mjs`, gated `blockedBy: ["3043"]` specifically so this fork is ruled before the
merge picks an answer by accident (`we:backlog/2970-…:15`).
