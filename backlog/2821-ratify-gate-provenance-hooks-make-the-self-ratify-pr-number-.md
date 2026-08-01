---
bornAs: x9kptqv
kind: story
size: 5
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [ratify-gate, provenance, check-standards, hooks, drain]
---

# Ratify-gate + provenance hooks — make the unreconciled-resolve + PR-number-as-#NNN + hash-slug-drift failures script-decidable

Review-bounce failures from #957/#959 become deterministic gates: (1a) a resolve that leaves its own narrative artifacts (PR body, report) contradicting the diff, and (1b) a same-day multi-fork resolve carrying no explicit ratify marker; (2) an #NNN cross-ref citing an implausible/unrelated item or a PR number; (3) a hash slug cited outside backlog+docs that the at-land rewrite never heals; (4) findBadBodyLinks missing bare hash-slug links. Per #51 (hookable-vs-judgment): script-decidable tells → hook, judgment stays in context.

## Why this exists

The #957 and #959 ratification reviews **bounced** on distinct failures, each of which had already baked bad state before the human caught it. Under the **hookable-vs-judgment rule ([#51](/backlog/) — script-decidable → hook, judgment stays in context)** every one of these has a *greppable tell*: they are mechanical, not matters of taste. So each belongs in a deterministic gate, not in a reviewer's memory. This story turns them into gate errors that reproduce their real instances.

**Correction — #959 was NOT a self-ratify.** An earlier version of this story cited "the #959 self-ratify" as gate 1's real instance. That was wrong: the operator **did** ratify #2801 on 2026-08-01, and the human review of PR #959 withdrew the finding. What actually happened is narrower and more general, and it is what gate 1a hooks: the PR body was written at the *prepare* commit (`fb11461c`, 16:20) and the ratify landed 32 minutes later (`dd4a40b6`, 16:53) **without refreshing the PR body or the session report** — both of which still said "not ruled — ratification is `/next decision`'s job". A diff-only reviewer reading correct evidence therefore reached a wrong conclusion and bounced a legitimate PR. The cost was a full review round, not bad state — but the same unreconciled resolve could just as easily hide a real violation.

The judgment — *is this the right ruling? is this the right provenance?* — stays in context where it belongs. What moves to a hook is only the mechanical tell: a resolve whose narrative artifacts still assert the prior answer, a same-day multi-fork resolve with no ratify marker, a `#NNN` pointing at an implausible item, an un-rewritten hash slug, a link the link-checker's regex can't see.

Sibling context: this is the enforcement companion to the review-hardening work in [#2563](/backlog/2563-blast-radius-is-advisory-care-level-not-a-park-gate-converge-/) (advisory care-level, not a park gate) and [#2439](/backlog/2439-independent-hardened-validator-redteam-accepted-acceptance-l/) (independent hardened validator + `redteam:accepted`). Those hardened *how review runs*; this hardens *what the gate catches before review even starts*.

## The gates

### 1a. Resolve-reconciles-its-narratives gate — the one that would have prevented the #959 round

**The tell.** A commit that flips a `kind: decision` item to `status: resolved` while the PR body, the item's `relatedReport`, or any other artifact in the same change still asserts the **prior** answer — "not ruled", "prepare only", "ratification is `/next decision`'s job", "awaiting ratification" — must FAIL.

This is the whole-item-integrity rule (`we:docs/agent/backlog-workflow.md:294`) made mechanical: after a leading-answer change, *every* place the prior answer appears must be reconciled **in the same turn**. The negation phrases are a small closed set and fully greppable; the artifact set is enumerable from the resolve itself (the item, its `codifiedIn` target, its `relatedReport`, the PR body, any research write-up the item links).

**Why it's a gate, not judgment.** Whether the ruling is *right* is judgment. Whether the report attached to a `status: resolved` item still says "not ruled" is a string comparison. No reviewer should have to catch that, and on #959 none could — a diff-only reviewer cannot see the chat, so an unreconciled narrative is the *only* evidence it has, and it is actively misleading.

**Mechanism.** A `check:standards` error (in `we:scripts/check-standards-rules.mjs`) that, for each `status: resolved` decision item, scans its `relatedReport` + `codifiedIn` targets for prior-answer phrases; plus a drain-side check that the PR body of a PR resolving a decision does not contain them. The `check:standards` half is the durable one — it keeps working after the PR is gone.

**Real instance it must reproduce.** **PR #959**: `dd4a40b6` resolved #2801 and codified the statute, while the PR body and `we:reports/2026-08-01-design-source-home-locked-target.md` both still said "not ruled — prepare only". Result: a legitimate ratified PR was bounced for a governance violation that had not occurred, costing a full review round. With this gate the resolve fails until the narratives are reconciled.

### 1b. Same-day multi-fork resolve — escalate, never hard-block

**The tell.** A `kind: decision` item flipping to `status: resolved` where `preparedDate == dateResolved` (prepared and resolved in the same run/day) **AND** the item still carries **≥2 live forks**.

"≥2 live forks" is greppable: the body's `## Fork` sections show ≥2 coherent named branches, and/or a confidence score, and/or a `SURVIVES-WITH-AMENDMENT` skeptic verdict — all tells that the fork was genuinely live (a `SURVIVES-WITH-AMENDMENT` verdict means a red-team *amended* a branch, which per `we:docs/agent/backlog-workflow.md:296` is a live fork and never an auto-close).

**This is an ESCALATION signal, not a violation.** #959 proves the shape is legitimate: #2801 was prepared and ratified the same day, by the operator, with four live forks — entirely correct. Ratifying a multi-fork decision requires an explicit **human ratify utterance** (`we:docs/agent/backlog-workflow.md:295-296`), and the *only* sanctioned auto-ratify is the fork-existence test collapsing to exactly one coherent branch (`:296`) — but the machine cannot see the utterance, only its absence from the file. So the gate must demand **evidence of the utterance** (a ratify marker the resolve records — e.g. a `ratifiedBy:` frontmatter field, or the `## Ruling` block naming who ratified and when), not forbid the shape.

**Mechanism.** A `check:standards` error that fires only when same-day + ≥2-live-forks + `resolved` occurs **with no ratify marker present**. Recording the marker is the cheap, always-correct action; it also gives gate 1a and every future diff-only reviewer the evidence they currently lack. A `PreToolUse` write gate on `we:backlog/*.md` is the stronger placement (blocks before commit), provided it stays satisfiable by adding the marker.

**Real instance it must reproduce.** #2801 as resolved by `dd4a40b6`: same-day, four live forks, no ratify marker anywhere in the item → escalate. The corrected item (which records "RATIFIED by the operator on 2026-08-01") must **pass**.

### 2. `#NNN` citing an unrelated / implausible item

**The tell.** A `#NNN` cross-reference whose resolved target's `kind`/`title` is implausible for the citing sentence. Example from the bounces: a sentence saying "carved from #955" landing on an **unrelated resolved polyglot-sandbox decision** — the cited item's subject has nothing to do with the citing claim.

**Two levels of gate:**
- *Minimum:* a **cross-ref plausibility check** — flag an `#NNN` whose target `kind`/`title` is implausible for the citing context (e.g. a "carved from #NNN" / "slice of #NNN" claim whose target is a resolved decision on an unrelated subject).
- *Ideal:* **forbid citing a PR number as `#NNN`.** In this repo `#NNN` means a **backlog item**, never a pull request. A `#NNN` that resolves to a PR number rather than a backlog item is unambiguously wrong and fully machine-checkable.

**Why it matters.** This failure **baked a wrong provenance into permanent statute ~15×** — the same bad `#NNN` propagated across the item and its codified refs. Provenance is cite-able statute (the platform-decisions layer); a wrong `#NNN` is a wrong law citation that outlives the session.

**Mechanism.** A `check:standards` rule that, for each `#NNN` cross-ref, resolves the target and checks (a) it is a real backlog item (not a PR number), and (b) its kind/title is plausible for the citing sentence. Level (a) is a hard error; level (b) can start as a warning and tighten.

### 3. Hash-slug drift outside the at-land rewrite scope

**The tell.** `applyLedger` / `numberPendingHashes` (`we:scripts/lane-drain.mjs:566`) rewrites hash→NNN **only** in `we:backlog/*.md` + `we:docs/agent/*.md`. A hash slug (`xNNNNNN`) cited from **anywhere else** never self-heals → **dead link post-land**.

Three such dirs all appeared in #957:
- `we:reports/`
- `we:src/_data/researchTopics/`
- `we:src/_includes/research-descriptions/`

A citation like `[...](xNNNNNN-slug.md)` or `#xNNNNNN` in any of these survives the at-land renumber untouched, so once the item lands with a real NNN the reference dangles permanently (the same failure class the `we:docs/agent/*.md` scope-widening in `we:scripts/lane-drain.mjs:580` was added to fix — this extends it).

**Two ways to close it (either satisfies acceptance):**
- **Widen the rewrite scope** in `numberPendingHashes` to include `we:reports/`, `we:src/_data/researchTopics/`, and `we:src/_includes/research-descriptions/` (same tracked-only, landed-only guard as the existing backlog + docs sweep). This *self-heals* the citation.
- **OR make an un-rewritten hash slug outside `we:backlog/` + `we:docs/agent/` a hard error** — a `check:standards` rule that flags any `xNNNNNN` slug reference living outside the rewrite scope, forcing the citation to be fixed by hand before land.

Widening the scope is the more robust fix (heals silently); the hard error is the cheaper fix (never silently dangles). Either meets acceptance for this slice.

### 4. `findBadBodyLinks` misses bare hash-slug links

**The tell.** `findBadBodyLinks` (`we:scripts/check-standards-rules.mjs:586`) catches a dead backlog link only when the target matches a **`\d{3}-` prefix** (`we:scripts/check-standards-rules.mjs:608`, regex `^(?:\.{0,2}\/)?(?:backlog\/)?\d{3}-[a-z0-9-]+\.md(?:#.*)?$`). So a **pre-renumber** link of the form `[..](xNNNNNN-slug.md)` is **invisible** to the gate — the hash-slug form has no `\d{3}-` prefix.

This is the *most likely* link to go stale: a hash-slug link is by definition to a not-yet-numbered item, exactly the reference that the at-land renumber must heal (gate 3) — and if the renumber misses it, the link-checker can't even see it to warn.

**Mechanism.** Extend the `findBadBodyLinks` target-matching so the bare hash-slug form (`[..](xNNNNNN-slug.md)`, with the same optional `./`, `../`, `backlog/` prefixes and `#anchor` suffix as the numbered form) is also caught. This closes the loop with gate 3: gate 3 heals or errors on the hash slug at land; gate 4 makes the link-checker able to *see* it in the meantime.

## Acceptance

Each failure becomes a **deterministic gate error that reproduces its real instance** — a test/fixture that fails today and passes once the gate lands:

1. **(1a)** A `kind: decision` flipping to `resolved` while its `relatedReport` / PR body still says "not ruled" / "prepare only" / "awaiting ratification" → gate error (reproduces PR #959's unreconciled resolve). Passing requires reconciling every artifact in the same turn.
   **(1b)** A same-day (`preparedDate == dateResolved`) `kind: decision` with ≥2 live forks flipping to `resolved` **and carrying no ratify marker** → gate error. Passing requires the collapse-to-one-branch condition or a recorded ratify marker. The **corrected** #2801 (which records "RATIFIED by the operator on 2026-08-01") must pass — a legitimate same-day ratify is never blocked.
2. A `#NNN` citing a PR number → hard error; a `#NNN` whose target kind/title is implausible for the citing sentence → flagged (reproduces the "carved from #955" → unrelated polyglot-sandbox mis-cite).
3. A hash slug cited from `we:reports/`, `we:src/_data/researchTopics/`, or `we:src/_includes/research-descriptions/` either self-heals at land (scope widened) or is a hard error before land (reproduces the #957 dead-link-post-land).
4. A `[..](xNNNNNN-slug.md)` link is caught by `findBadBodyLinks` (reproduces the invisible pre-renumber link).

`check:standards` stays at 0 errors on the current tree after the gates land (they fire only on the bad shapes above).

## References

- **[#51](/backlog/)** — hookable-vs-judgment rule: script-decidable → hook, judgment stays in context. Each of these is a mechanical tell, so each is a hook.
- **[#2563](/backlog/2563-blast-radius-is-advisory-care-level-not-a-park-gate-converge-/)** — review escalation / advisory care-level. Sibling review-hardening.
- **[#2439](/backlog/2439-independent-hardened-validator-redteam-accepted-acceptance-l/)** — independent hardened validator + `redteam:accepted`. Sibling validator-hardening.
- Surfaced by the **#957 / #959 ratification review bounces** — the failures this story hooks. Note #959's bounce was a **false positive** caused by an unreconciled resolve (gate 1a), not by a self-ratify; the accept verdict on PR #959 withdraws that finding.
- **[#2801](/backlog/2801-productized-design-source-home-locked-in-code-target-referen/)** — the decision whose resolve exposed gate 1a; its report carries the same prevention analysis.
- Code loci: `we:scripts/check-standards-rules.mjs` (gates 1a, 1b, 2, 4 and the 3-error-form), `we:scripts/check-standards.mjs`, `we:scripts/lane-drain.mjs` (`numberPendingHashes`/`applyLedger`, gate 3-heal-form; PR-body check for gate 1a), and a `PreToolUse` write gate on `we:backlog/*.md` (gate 1b write-time form).
