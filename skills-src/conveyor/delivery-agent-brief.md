# Conveyor delivery-agent brief (template) — build ONE item, stop at ready-to-merge (#2608)

> **This is a TEMPLATE, not a runnable skill.** The `/conveyor` skill (#2613) instantiates it — filling the
> `{{PLACEHOLDERS}}` below with the launch entry the dispatch-plan script (#2609) produced — and passes the
> result as the prompt for **one background delivery agent** spawned per launch entry. One agent = one item =
> one lane = one PR. The agent does the JUDGMENT work (build the item); every script-decidable decision around
> it is a script it shells, per
> [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)
> (#2607).

## Fill these before spawning

| Placeholder | What the conveyor fills it with |
|---|---|
| `{{ITEM_NUM}}` | the backlog item number (or `xNNNNNN` hash) from the launch entry — e.g. `2608` |
| `{{ITEM_SPEC_PATH}}` | the item's backlog file — `backlog/{{ITEM_NUM}}-<slug>.md` |
| `{{LANE}}` | the free lane id the dispatch plan assigned this launch (`launch[].lane`) — e.g. `4` |
| `{{SESSION_SLUG}}` | a stable per-item session slug, e.g. `conveyor-{{ITEM_NUM}}` (ties `acquire`↔`release`, `claim`↔`resolve`) |
| `{{SCOPE}}` | the item's predicted `scope:` frontmatter, repo-qualified & comma-joined — e.g. `we:scripts/conveyor,we:.claude/skills/conveyor` |

> **Two kinds of placeholder.** `{{LIKE_THIS}}` are **conveyor-injected** — the skill substitutes them from the
> launch entry before spawning you (the table above). `<like-this>` are **agent-runtime values** you produce as
> you work — the `<slug>` you pick for the lane ref, the `<pr-body>` file you write, the `<n>`/PR number
> `pr-land` reports back. Do not expect the conveyor to fill a `<...>`; that's your job at the moment it's used.

---

## Your job (one sentence)

Build backlog item **#{{ITEM_NUM}}** to spec in an isolated lane clone, get its gate green, **review your own
diff to convergence with an adversarial subagent**, open a PR (`ready-to-merge`, or parked `review:human`
**only for good reason**), drop a learnings entry — then **EXIT WITHOUT MERGING**. The resident drain daemon
(`plateau:tools/drain-daemon/`) is the single landing serializer; it lands green couples and parks escalations
`review:human` for the main session. You never run `gh pr merge`.

## The arc — one command per transition

### 1. Acquire a lane-pool clone (never edit the primary checkout)

```bash
export LANE_SESSION={{SESSION_SLUG}}
LANE=$(node scripts/lane-pool.mjs acquire --lane={{LANE}} --purpose=conveyor-delivery \
  --session={{SESSION_SLUG}} --scope={{SCOPE}}) && cd "$LANE"
```

- `--lane={{LANE}}` takes the exact lane the dispatch plan assigned (it was in the free-lane set at plan time).
  If that lane lost its race to a sibling, `acquire` fails loud — report it and exit; the conveyor re-plans.
- `--scope={{SCOPE}}` declares this lane's predicted file-scope into the lease marker. It is **advisory** — it
  NEVER gates the acquire (the whole-clone lease is the real lock), but the scope-lease collector reads it so
  the dispatch plan won't launch an overlapping sibling. All work happens in `$LANE`, never the primary.

### 2. Claim the item (the claim rides the PR — never left `active` on main)

```bash
node scripts/backlog.mjs claim {{ITEM_NUM}} --session={{SESSION_SLUG}}
```

Claim flips `open → active` + stamps `dateStarted` **in the lane clone**. (You are a background agent — do the
claim, the readiness pre-check, and the build in the same run; the two-turn human arc does not apply here.)
**The `claim` CLI prints a two-turn "⏸ stop here / let the chat be renamed" message meant for INTERACTIVE human
sessions — you MUST ignore it and proceed to the readiness pre-check + build in the SAME run** (as this brief's
arc directs). Obeying it literally would STALL a background delivery agent.
**Before writing any code, run the readiness pre-check (step 3)** — that step owns the full re-read of
`{{ITEM_SPEC_PATH}}` and the `blockedBy` re-check.

### 3. Readiness pre-check — is this card still worth building? (a LIGHT gate, not a deep analysis)

State drifts between when the operator cleared this item and when your lane picked it up: a blocker can
**re-open**, other work can land the **same** change, a spec can go **stale**. So **before writing any code**,
re-confirm the item is still buildable **as written, against the fresh `main` your lane just reset to**. This
enacts the **Definition-of-Ready lens** (#2618 — the durable home of what "ready" means) at *claim* time —
the same "still holds against the current tree, no reopened fork, no reappeared blocker" re-read the delegation
rule already requires, and the "re-evaluate `blockedBy` at every seam" discipline
(`we:docs/agent/backlog-workflow.md`). Keep it **proportionate**: read the item + take a quick look at `main`,
**NOT** a full audit that doubles the build cost. Check four things:

- **Still ready** — re-confirm on the fresh clone that **every `blockedBy` edge is resolved**. A blocker cleared
  at prepare time can have **re-opened** since it was queued (read each blocker's current `status:`). → reason
  `re-blocked <num>`.
- **Up to date / not stale** — a quick sanity read that the spec **still makes sense against current `main`**: it
  wasn't **already done** or **superseded** by other work that landed while it queued (the "desynced — spec
  changed under it" case). A skim, not a deep diff audit. → reason `stale/superseded`.
- **Scope sane** — the item **carries a `scope:`** and it's **plausible for the spec** (auto-prepare authored
  it; just sanity-check it matches the described work, not obviously wrong). → reason `scope-wrong`.
- **Coherent** — **buildable as written**: not a placeholder / TODO-digest stub, not internally contradictory,
  the ask clear enough to implement. → reason `incoherent`.

**PASS** — all four hold → proceed to build (step 4 onward).

**FAIL** — any check trips → **do NOT build, and do NOT try to fix the item yourself.** Release the claim
cleanly so the item returns to the pool (not stranded), hand the lane back, and RETURN the one-line escalation
naming the reason:

```bash
node scripts/backlog.mjs release {{ITEM_NUM}} --session={{SESSION_SLUG}}   # active → open — back in the pool
node scripts/lane-pool.mjs release --lane={{LANE}} --session={{SESSION_SLUG}}
```

Return: `#{{ITEM_NUM}} → not-ready (re-blocked <num> | stale/superseded | scope-wrong | incoherent)`. **This is
a GOOD reason to stop** — the *escalate-by-good-reason-only* rule cuts both ways, and a card that drifted out
from under its spec is exactly the kind of thing worth surfacing. The conveyor hands it to the operator to
**re-prepare / re-check / drop**; it **never silently builds a stale card**. No PR is opened — nothing was
built (this is the one pre-build stop; see *Escalations*).

### 4. Build it to spec

Do the actual work in `$LANE`: implement `{{ITEM_SPEC_PATH}}`, keep `## Progress` synced, capture any
leftover work as new backlog items (`scaffold` with `blockedBy` + a digest) rather than half-doing them.

### 5. Run the gate GREEN (in the item's own locus)

A WE item's gate is `npm run check:standards`. For a cross-locus item, run **that** locus's gate
(look up `LOCI[item.locus]` in `check-standards-rules.mjs`). **The gate must be green before you push** — a red
gate is a hard stop (see *Escalations*). Then resolve:

```bash
npm run check:standards          # (or the item's locus gate)
node scripts/backlog.mjs resolve {{ITEM_NUM}}
```

### 6. Review your own diff — spawn an adversarial code-review subagent (converge BEFORE the PR)

A green gate proves the **checks** pass; it does **not** prove the **diff is correct**. Before you open the
PR, get the work reviewed — the gate is the deterministic core, this review is the judgment a script cannot
do (per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)).
Spawn **one adversarial code-review subagent** on your working diff and **AWAIT its completion — its final
report (return value) IS the verdict.** The harness delivers a spawned subagent's final report to its spawner
automatically, so you read that returned report directly; nothing can lose it in transit.

- **Read-only, diff-focused.** It reviews *this lane's* diff — **correctness first**, plus the lens the change
  earns: a **security** pass for anything touching untrusted input, secrets, auth, or file/network I/O; an
  interface/compat pass for a contract change; and so on. It reports findings; it does not edit.
- **The verdict rides the RETURN, never a name-addressed message.** Instruct the review subagent to put its
  FULL verdict — converged / the findings list / any blockers — in its **final report/return**, NOT to
  `SendMessage` it back to you by name. Do **not** rely on a name-addressed hand-back: a name can be
  unreachable once an agent completes ("no agent named … reachable"), which stalls the converge-before-PR
  handshake (#2624). Read the verdict off the returned final report.
- **Address every finding to CONVERGENCE — don't rubber-stamp, don't silently drop.** Fix the real issues in
  the lane. A finding you judge not-real is **dismissed with a one-line reason** (never dropped in silence).
  Re-run the review after any nontrivial fix, until a pass comes back clean (or with only
  dismissed-with-reason findings). **Only then** proceed to the PR.

### 7. Commit on the lane's current branch + publish HEAD to the `lane/...` ref + open the PR (label green ONLY after `test` passes)

Commit only this item's files (explicit paths, never `git add -A`; one commit) on the lane's **current branch**
(its local `main`) — do **NOT** `git checkout -b lane/...`; the single-branch hook blocks branch creation even
inside a lane clone. You never create the `lane/...` branch locally: `pr-land` **publishes HEAD** to that ref
for you via `--ref=... --sha=HEAD`. Then open the PR through the canonical producer — **never a hand-rolled
`gh pr create`** (that skips the #2307 producer review-labeling). **Cross-locus item?** This step opens a
**couple** — two PRs, impl-first / WE-last, manifest on the WE PR — see *Cross-locus items — the two-PR couple*
below in place of the single-PR steps 7–9:

```bash
# Write the commit message to a file, then commit -F it. Do NOT put the message
# in a bash heredoc: backticks in a heredoc (e.g. `scope:`) run as a subshell
# (`bad substitution`). A message file has no such footgun.
printf '%s\n' "WE #{{ITEM_NUM}}: <one-line summary>" "" \
  "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" > <msgfile>
git commit -F <msgfile> <explicit-paths>

node scripts/pr-land.mjs --ref=lane/{{ITEM_NUM}}-<slug> --sha=HEAD --base=main \
  --body-file=<pr-body> --label-on-green
```

`--label-on-green` is the **producer mode** you want: it opens the self-approved PR, **waits for the required
`test` check, applies the `ready-to-merge` label ONLY once it is green, then STOPS**. It does **not** trigger a
drain — the resident drain daemon lands the labelled PR on its next pass. The `ready-to-merge` label means
"fully checked, the drain may land" — it is applied by `pr-land` after CI is green, never eagerly at open, so a
red PR never enters the drain's queue.

`pr-land --label-on-green` BLOCKS until the required `test` check is green (often several minutes). Run it
BACKGROUNDED (or with a generous timeout) — a foreground call may hit the tool timeout mid-wait, which is
EXPECTED and harmless: the PR is already open (`checking`), and re-invoking `pr-land` with the SAME `--ref` is
idempotent (it targets the existing PR and applies the label, never a duplicate).

- End the commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- If the PR's CI ends up red, it is left **unlabelled** — that is an escalation (below), not a land.

**Which label — escalate `review:human` by good reason ONLY.** The escalation call is **judgment**, not a
script ([#deterministic-core-thin-judgment](../../../docs/agent/platform-decisions.md#deterministic-core-thin-judgment)).
**Default** is `--label-on-green` (opens `ready-to-merge`; the daemon lands it with no human in the loop) — a
clean, reviewed, non-statute PR whose `test` is green lands that way, and that is the norm, not the exception.
Open the PR **parked** instead — `--label=review:human` (STOPS at open, no auto-land), or leave it
**unlabelled** (`--no-wait`) on a red gate — ONLY when an *Escalations* condition below applies. Do **NOT**
blanket-park a clean, reviewed PR "so a human can see it".

### 8. Append a structured learnings entry to the session drop-box (#2614)

Append **exactly one** structured, generalized-lesson entry to the session drop-box — a friction hit, a missing
convention, a doc/skill gap, or an improvement idea from building this item. The drop-box (#2614) is
`scripts/conveyor/learnings-drop.mjs`; it is a **write-time-gated scrub** that REJECTS any entry carrying raw
code, diffs, secrets, absolute/repo-identifying paths, or PII (the schema is tenant-ready by construction), so
keep every field a short generalized lesson — **no** code, paths, or repo names:

```bash
node scripts/conveyor/learnings-drop.mjs \
  --kind=<friction|missing-convention|doc-gap|skill-gap|improvement> \
  --summary="<one sentence — the lesson>" \
  --area="<coarse label, e.g. lane gating / check:standards>" \
  --suggestion="<short recommendation>" \
  --session={{SESSION_SLUG}}
```

The flags are `--kind`/`--summary`/`--area`/`--suggestion` (all four required) plus an optional `--session`;
`--summary` is capped at 240 chars (over-length is rejected) — keep it to one tight sentence.
There is deliberately **no** `--item`/`--entry`/free-form field (the allow-list is the privacy boundary — a
disallowed key is rejected, never appended). If your entry is rejected, it named something it should not have —
generalize it and retry; do **not** try to force it through. Skip this step only if you genuinely hit no
generalizable friction. Distributed capture (every agent, cheaply, in the moment); the `/closing-session` sweep
curates centrally.

### 9. EXIT — do not merge, do not release, do not wait

**Stop here.** Do NOT run `gh pr merge`. Do NOT run a drain. Do NOT `release` the lane — the resident drain
daemon lands the PR. The **merge watcher** (`scripts/conveyor/pr-watch.mjs <pr-number>`) is spawned by the
**conveyor skill, not by you**, on the PR number `pr-land` reported for this item in step 7; its process exit
(merged / parked / closed) wakes the main session and re-dispatches the freed lane. Your OWN process EXIT is the
signal you are done. Return a one-line result to the conveyor: `#{{ITEM_NUM}} → PR #<n> (ready-to-merge |
escalated <label> | gate-red)`. **A red gate / red CI is NOT watcher-visible** (it reads only state/labels) —
your one-line RETURN is the only signal that surfaces it, so always report it explicitly.

## Cross-locus items — the two-PR couple (impl-first / WE-last)

Most items are single-locus: build **and** resolve both land in WE — one lane, one PR (the arc above). A
**cross-locus** item is the exception. Its implementation lives in an impl repo (`frontierui` or
`plateau-app`), but its **resolve** — the `active→resolved` flip, plus `claims.json` and the item file —
**always** lives in WE (#96). Such an item can't ship as one PR: it fans out into a **couple** — TWO coupled
PRs, one per repo — that the drain lands in order (impl-first, WE-last). This surfaced in #2539 (a `frontierui` impl PR plus its WE
PR): the delivery agent expected one PR and had no brief for the fan-out. **When your item's locus is not
`we`, use this in place of the single-PR steps 7–9** (steps 1–6 are unchanged; run the impl repo's locus gate
in step 5).

- **One agent, two lanes, two PRs.** You still own ONE item. Acquire a SECOND lane for the impl repo — the
  pool is repo-parameterized (`node scripts/lane-pool.mjs acquire --repo=<impl-checkout> …`) — do the impl
  work in that lane and the WE resolve in your WE lane. Keep the halves scoped: impl files on the impl PR, the
  resolve (+ any WE docs/tests) on the WE PR. Do not fold impl changes into the WE half or vice-versa.

- **Impl-first / WE-last is the land order — and WE carries the resolve.** The drain merges the couple in
  `INTEGRATION_ORDER`: impl repos first (`frontierui`, then `plateau-app`), WE **last**. WE lands only after
  every impl half is green and merged, because the WE half carries the `active→resolved` flip — a failed impl
  merge must never leave a false `resolved` on `main`. A broken impl half therefore holds the whole couple; it
  never half-lands.

- **The lane manifest rides the WE PR — and ONLY the WE PR.** The couple's landing metadata is a
  `.lane-manifest.json` (built by `scripts/readiness/lane-manifest.mjs`): it names **every** repo's `lane/*`
  ref in merge order, plus cross-item `blockedBy` edges and `mergeRiskFiles`. Author it on the WE half and pass
  it to that PR's `pr-land` with `--manifest-file=<path>`; `pr-land` embeds it in the WE PR **body** (not a
  tracked file), and the drain reads it off the head ref to order the merges. `validateManifest` enforces the
  shape — WE must be present, and **exactly one** repo carries the resolve: WE. The impl PR carries **no**
  manifest; open it as a plain `pr-land` (no `--manifest-file`).

- **The WE half is review-parked; the couple's atomicity is the merge ORDER.** The WE PR carries the manifest,
  so `pr-land`'s producer rubric scores it `crossRepo` (`repos.length > 1`) and parks it — `review:pending`, or
  `review:human` if it also touches statute / gate-self. A coordinated multi-repo couple earns a second look.
  The impl PR is manifest-less, so it is **not** independently review-parked; the drain's couple-join (#2393)
  matches its `lane/*` ref against the WE manifest's `repos[]` and makes it inherit only the couple's
  **cross-item** `blockedBy` / `stackParents` (so it can't jump a dependency on *another* item). The atomicity
  that matters — **the WE resolve never lands ahead of its impl** — rests on three robust facts about the WE
  half: it is ALWAYS `crossRepo` review-parked, it orders LAST (impl-first / WE-last), and a human gates it. So
  the resolve waits on `review:accepted` on the WE PR, and the drain merges impl-first, WE-last. Be clear-eyed
  about the corollary of the impl half NOT being parked: with no cross-item blocker, the **impl half can land
  first — before a human clears the WE review** (impl code is additive; the item simply stays `active` until
  its WE half resolves). A human clears the WE PR's review label (via `/review` in the main session); the
  drain then lands any not-yet-landed impl half, then WE.

- **You still EXIT WITHOUT MERGING.** Open both PRs (`--label-on-green`, or parked for a good reason per
  *Escalations*), drop your one learnings entry, and stop — the drain lands the couple in order. Report BOTH PR
  numbers in your one-line return so the couple is visible:
  `#{{ITEM_NUM}} → PR #<we-pr> (+ impl #<impl-pr>) (ready-to-merge | escalated <label> | gate-red)`.

---

## Escalations — when you do NOT reach ready-to-merge

Escalation is **by good reason only** — a clean, reviewed, non-statute PR with a green `test` lands via the
daemon with **no human in the loop**, and that is the default. Escalate — the item does **not** auto-land and
is reviewed in the **main session**, never by you — ONLY when one of these holds. **Never blanket-park** a
clean PR "so a human can see it": over-parking makes the human the bottleneck the conveyor exists to remove
and dilutes what `review:human` means.

0. **Not ready — the readiness pre-check failed (a PRE-BUILD stop, no PR).** The step-3 gate found the card
   drifted out from under its spec: a `blockedBy` **re-opened**, the spec is **stale/superseded**, its `scope:`
   is **wrong**, or it's **incoherent**. This is the one case that opens **no PR** — you release the claim
   (`active → open`, back in the pool) and hand the lane back per step 3, then RETURN
   `#{{ITEM_NUM}} → not-ready (re-blocked <num> | stale/superseded | scope-wrong | incoherent)`. It is a **good
   reason to stop**: the conveyor surfaces it to the operator to re-prepare / re-check / drop. Do **not** try to
   fix the item yourself, and do **not** build a card that no longer holds.
1. **Statute-touching change** — the item edits a policy-core / gate-self path (see `scripts/lib/gate-config.mjs`).
   `pr-land`'s deterministic rubric (`scoreEscalation` → `producerReviewLabel`, #2307) applies **`review:human`**
   at PR-open, and the daemon parks it. Do not try to clear it yourself.
2. **Gate red** — `check:standards` (or the locus gate) fails from your own work, OR the PR's `test` check ends
   red. The PR is left **unlabelled** (never `ready-to-merge`); report the failing check and stop. Do not weaken
   or delete a test to go green.
3. **A review finding that needs human judgment** — the step-6 adversarial review surfaced an issue you could
   not safely self-clear (you fixed what you could to convergence; this one needs a human call). Open the PR
   parked `review:human` (`--label=review:human`).
4. **Genuine uncertainty** — you are not confident the change is right and want a human eye before it lands.
   Park it `review:human`. (Uncertainty is a *good reason*; "so a human can see a clean change" is not.)
5. **`review:changes`** — a human bounced a prior version of this diff. Repair before any land; if it is still
   red after your fix, it stays parked.

In every **post-build** escalation case (1–5) the outcome is the same: **the daemon parks the PR `review:human`
(or leaves it unlabelled on a red gate), and it is reviewed in the main session** (`/review`). The **pre-build**
case (0) has no PR to park — you return the claim to the pool and surface the `not-ready` reason, and the
conveyor routes it to the operator. Either way you surface the reason in your one-line return and exit — you
never merge, never override, never self-clear a review, and never build a card that failed the readiness gate.

## Guardrails (the non-negotiables)

- **Never edit the primary checkout** — all work is in the acquired lane clone (#104/#2183).
- **Never merge** — you stop at `ready-to-merge`; the resident drain daemon is the sole writer to `main`.
- **Never hand-roll `gh pr create` + `gh pr edit --add-label`** — route through `pr-land` so the #2307
  producer review-label is applied at open.
- **One item, one lane, one PR** — do not fold unrelated work in; capture leftovers as new backlog items. (The
  **cross-locus couple** is the sole exception: one item, two lanes, two PRs — impl-first / WE-last, manifest
  on the WE PR; see *Cross-locus items — the two-PR couple*.)
- **Work only through the normal verbs** (claim → lane clone → `lane/{{ITEM_NUM}}` branch → PR → daemon merge →
  resolve) — those are exactly the channels the lane board reads, so state is reflected **for free**. No parallel
  state store, ever (#2612 ruling).
