---
bornAs: x9kptqv
kind: story
size: 8
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [ratify-gate, provenance, check-standards, hooks, drain, citation-verification]
---

# Ratify-gate + provenance hooks — make the unreconciled-resolve + PR-number-as-#NNN + hash-slug-drift + unresolved-citation failures script-decidable

Review-bounce failures from #957/#959 become deterministic gates: (1a) a resolve that leaves its own narrative artifacts (PR body, report) contradicting the diff, and (1b) a same-day multi-fork resolve carrying no explicit ratify marker; (2) an #NNN cross-ref citing an implausible/unrelated item or a PR number; (3) a hash slug cited outside backlog+docs that the at-land rewrite never heals; (4) findBadBodyLinks missing bare hash-slug links; (5) a `we:path:line` code reference that resolves to no such file or an out-of-range line, plus a symbol-anchored citation convention that keeps a cite pinned to a function/const name instead of a brittle line number. Per #51 (hookable-vs-judgment): script-decidable tells → hook, judgment stays in context. **These are all one gate family — "a reference asserted without resolving it against the source" — surfaced across the #957 round-1 and round-2 bounces (see [The unifying root class](#the-unifying-root-class-a-reference-asserted-without-resolving-it)).**

## Why this exists

The #957 and #959 ratification reviews **bounced** on distinct failures, each of which had already baked bad state before the human caught it. Under the **hookable-vs-judgment rule ([#51](/backlog/) — script-decidable → hook, judgment stays in context)** every one of these has a *greppable tell*: they are mechanical, not matters of taste. So each belongs in a deterministic gate, not in a reviewer's memory. This story turns them into gate errors that reproduce their real instances.

**Correction — #959 was NOT a self-ratify.** An earlier version of this story cited "the #959 self-ratify" as gate 1's real instance. That was wrong: the operator **did** ratify #2801 on 2026-08-01, and the human review of PR #959 withdrew the finding. What actually happened is narrower and more general, and it is what gate 1a hooks: the PR body was written at the *prepare* commit (`fb11461c`, 16:20) and the ratify landed 32 minutes later (`dd4a40b6`, 16:53) **without refreshing the PR body or the session report** — both of which still said "not ruled — ratification is `/next decision`'s job". A diff-only reviewer reading correct evidence therefore reached a wrong conclusion and bounced a legitimate PR. The cost was a full review round, not bad state — but the same unreconciled resolve could just as easily hide a real violation.

The judgment — *is this the right ruling? is this the right provenance?* — stays in context where it belongs. What moves to a hook is only the mechanical tell: a resolve whose narrative artifacts still assert the prior answer, a same-day multi-fork resolve with no ratify marker, a `#NNN` pointing at an implausible item, an un-rewritten hash slug, a link the link-checker's regex can't see.

Sibling context: this is the enforcement companion to the review-hardening work in [#2563](/backlog/2563-blast-radius-is-advisory-care-level-not-a-park-gate-converge-/) (advisory care-level, not a park gate) and [#2439](/backlog/2439-independent-hardened-validator-redteam-accepted-acceptance-l/) (independent hardened validator + `redteam:accepted`). Those hardened *how review runs*; this hardens *what the gate catches before review even starts*.

### The unifying root class: "a reference asserted without resolving it"

The #957 review bounced **twice** on the same shape, and it is the shape every gate below shares: **a reference is asserted in prose without being resolved against the source it points at.** An `#NNN`, a `we:path:line` locus, a hash slug, a count "N statutes" — each is a *claim about the source* that a machine can *check against the source*. When the author writes the claim from memory and never resolves it, the claim drifts, and the drift outlives the session as cite-able statute (rule #25 — provenance is the statute layer).

The bounces are its recurring instances:
- **Round 1** surfaced the `#NNN` mis-cite ("carved from #955" landing on an unrelated resolved polyglot-sandbox decision — gate 2) and the hash-slug drift (gate 3/4).
- **Round 2** surfaced two more of the *same* class: a wrong `we:path:line` pointer — `applyLedger` cited at `we:scripts/lane-drain.mjs:596` when it is **defined** at `we:scripts/backlog/id.mjs:144` and only **called** at `we:scripts/lane-drain.mjs:641` (gate 5) — and a **mislabeled count**, research-topic counts described as "statute/anchor" counts (the judgment case in §7).

Because the family is one root class, most of it is **script-decidable** (#51-style hookable): resolving a citation against its target is exactly what a machine does better than a reviewer, who cannot hold every line number and item subject in memory. The gate lives where the source is, so it keeps working after the PR is gone. The one member that is *not* fully deterministic — a count whose *label* is wrong even though the number is right — stays a documented judgment case (§7), because deciding whether "5 research topics" was *meant* to be "5 statutes" needs the author's intent, not just the file.

**This story already contains a live instance of gate 5/6:** gate 3 below cites "`applyLedger` / `numberPendingHashes` (`we:scripts/lane-drain.mjs:566`)" — but `applyLedger` is only *imported and called* in `we:scripts/lane-drain.mjs`; it is **defined** in `we:scripts/backlog/id.mjs:144`. Line 566 is `numberPendingHashes`, not `applyLedger`. A symbol-anchored cite (§6) — `we:scripts/backlog/id.mjs#applyLedger` — would have survived; the bare `:566` did not. The gate must reproduce on its own item body.

## The gates

### 1a. Resolve-reconciles-its-narratives gate — the one that would have prevented the #959 round

**The tell.** A commit that flips a `kind: decision` item to `status: resolved` while the PR body, the item's `relatedReport`, or any other artifact in the same change still asserts the **prior** answer — "not ruled", "prepare only", "ratification is `/next decision`'s job", "awaiting ratification" — must FAIL.

This is the whole-item-integrity rule (`we:docs/agent/backlog-workflow.md:294`) made mechanical: after a leading-answer change, *every* place the prior answer appears must be reconciled **in the same turn**. The negation phrases are a small closed set and fully greppable; the artifact set is enumerable from the resolve itself (the item, its `codifiedIn` target, its `relatedReport`, the PR body, any research write-up the item links).

**Why it's a gate, not judgment.** Whether the ruling is *right* is judgment. Whether the report attached to a `status: resolved` item still says "not ruled" is a string comparison. No reviewer should have to catch that, and on #959 none could — a diff-only reviewer cannot see the chat, so an unreconciled narrative is the *only* evidence it has, and it is actively misleading.

**Mechanism.** A `check:standards` error (in `we:scripts/check-standards-rules.mjs`) that, for each `status: resolved` decision item, scans its `relatedReport` + `codifiedIn` targets for prior-answer phrases; plus a drain-side check that the PR body of a PR resolving a decision does not contain them. The `check:standards` half is the durable one — it keeps working after the PR is gone.

**Real instance it must reproduce.** **PR #959**: `dd4a40b6` resolved #2801 and codified the statute, while the PR body and `we:reports/2026-08-01-design-source-home-locked-target.md` both still said "not ruled — prepare only". Result: a legitimate ratified PR was bounced for a governance violation that had not occurred, costing a full review round. With this gate the resolve fails until the narratives are reconciled.

### 1b. Same-day multi-fork resolve — escalate, never hard-block

**The tell.** A `kind: decision` item flipping to `status: resolved` where `preparedDate == dateResolved` (prepared and resolved in the same run/day) **AND** the item still carries a **live fork** — signalled by **≥2 coherent named `## Fork` branches, AND/OR a confidence score, AND/OR a `SURVIVES-WITH-AMENDMENT` skeptic verdict** (any one of the three is enough; it is not a hard "≥2 forks" conjunction).

"A live fork" is greppable: the body's `## Fork` sections show ≥2 coherent named branches, and/or a confidence score, and/or a `SURVIVES-WITH-AMENDMENT` skeptic verdict — all tells that the fork was genuinely live (a `SURVIVES-WITH-AMENDMENT` verdict means a red-team *amended* a branch, which per `we:docs/agent/backlog-workflow.md:296` is a live fork and never an auto-close).

**This is an ESCALATION signal, not a violation.** #959 proves the shape is legitimate: #2801 was prepared and ratified the same day, by the operator, with four live forks — entirely correct. Ratifying a multi-fork decision requires an explicit **human ratify utterance** (`we:docs/agent/backlog-workflow.md:295-296`), and the *only* sanctioned auto-ratify is the fork-existence test collapsing to exactly one coherent branch (`:296`) — but the machine cannot see the utterance, only its absence from the file. So the gate must demand **evidence of the utterance** (a ratify marker the resolve records — e.g. a `ratifiedBy:` frontmatter field, or the `## Ruling` block naming who ratified and when), not forbid the shape.

**Mechanism.** A `check:standards` error that fires only when same-day + ≥2-live-forks + `resolved` occurs **with no ratify marker present**. Recording the marker is the cheap, always-correct action; it also gives gate 1a and every future diff-only reviewer the evidence they currently lack. A `PreToolUse` write gate on `we:backlog/*.md` is the stronger placement (blocks before commit), provided it stays satisfiable by adding the marker.

**Real instances it must reproduce.** Two fixtures — one that carried the marker, one that needed it — are what make this gate testable rather than aspirational:
- #2801 as resolved by `dd4a40b6`: same-day, four live forks, no ratify marker anywhere in the item → escalate. The corrected item (which records "RATIFIED by the operator on 2026-08-01") must **pass**.
- The **#957 decision item** (`xgtiq7f`, build-lane self-review scope): same-day (`preparedDate == dateResolved == dateOpened`), a live fork (`SURVIVES-WITH-AMENDMENT` skeptic, four amendments folded, a recommendation, an explicit "ratifiable line"), and — through three review rounds — **no ratify marker** → escalate. This is precisely the shape 1b was written from, and it fired on the very PR it was authored during (round 4 caught the unrecorded ratification). The corrected item (now carrying `ratifiedBy: "Nicolas Gilbert (operator)"` in front-matter **and** a `## Ruling` block naming the operator + date) must **pass** — the second half of the pair (needed-the-marker) alongside #2801 (had-the-marker).

### 2. `#NNN` citing an unrelated / implausible item

**The tell.** A `#NNN` cross-reference whose resolved target's `kind`/`title` is implausible for the citing sentence. Example from the bounces: a sentence saying "carved from #955" landing on an **unrelated resolved polyglot-sandbox decision** — the cited item's subject has nothing to do with the citing claim.

**Two levels of gate:**
- *Minimum:* a **cross-ref plausibility check** — flag an `#NNN` whose target `kind`/`title` is implausible for the citing context (e.g. a "carved from #NNN" / "slice of #NNN" claim whose target is a resolved decision on an unrelated subject).
- *Ideal:* **forbid citing a PR number as `#NNN`.** In this repo `#NNN` means a **backlog item**, never a pull request. A `#NNN` that resolves to a PR number rather than a backlog item is unambiguously wrong and fully machine-checkable.

**Why it matters.** This failure **baked a wrong provenance into permanent statute ~15×** — the same bad `#NNN` propagated across the item and its codified refs. Provenance is cite-able statute (the platform-decisions layer); a wrong `#NNN` is a wrong law citation that outlives the session.

**Mechanism.** A `check:standards` rule that, for each `#NNN` cross-ref, resolves the target and checks (a) it is a real backlog item (not a PR number), and (b) its kind/title is plausible for the citing sentence. Level (a) is a hard error; level (b) can start as a warning and tighten.

### 3. Hash-slug drift outside the at-land rewrite scope

**The tell.** `numberPendingHashes` (`we:scripts/lane-drain.mjs#numberPendingHashes`) — via the numbering brain `applyLedger` it calls (`we:scripts/backlog/id.mjs#applyLedger`) — rewrites hash→NNN **only** in `we:backlog/*.md` + `we:docs/agent/*.md`. A hash slug (`xNNNNNN`) cited from **anywhere else** never self-heals → **dead link post-land**.

Three such dirs all appeared in #957:
- `we:reports/`
- `we:src/_data/researchTopics/`
- `we:src/_includes/research-descriptions/`

A citation like `[...](xNNNNNN-slug.md)` or `#xNNNNNN` in any of these survives the at-land renumber untouched, so once the item lands with a real NNN the reference dangles permanently (the same failure class the `we:docs/agent/*.md` scope-widening in `we:scripts/lane-drain.mjs:580` was added to fix — this extends it).

**This class is justified twice over inside #957 alone:** round 1's dead `2819` links and round 4's `#xgtiq7f` leak are the same defect four rounds apart, both in files the rewrite never touches. The round-4 leak was a `#xgtiq7f` in `we:src/_data/researchTopics/risk-based-care-scaled-review-gating.json` (which renders on the public `/research/` page) and a `we:backlog/xgtiq7f-*.md` glob in the report's file table — fixed by naming the decision in prose / citing epic `#2804` instead of the hash. The cheap interim mitigation before this gate lands is a convention, not a hook: **never write a hash slug outside `backlog/` + `docs/agent/`** — cite the epic or name the thing in prose.

**Two ways to close it (either satisfies acceptance):**
- **Widen the rewrite scope** in `numberPendingHashes` to include `we:reports/`, `we:src/_data/researchTopics/`, and `we:src/_includes/research-descriptions/` (same tracked-only, landed-only guard as the existing backlog + docs sweep). This *self-heals* the citation.
- **OR make an un-rewritten hash slug outside `we:backlog/` + `we:docs/agent/` a hard error** — a `check:standards` rule that flags any `xNNNNNN` slug reference living outside the rewrite scope, forcing the citation to be fixed by hand before land.

Widening the scope is the more robust fix (heals silently); the hard error is the cheaper fix (never silently dangles). Either meets acceptance for this slice.

### 4. `findBadBodyLinks` misses bare hash-slug links

**The tell.** `findBadBodyLinks` (`we:scripts/check-standards-rules.mjs:586`) catches a dead backlog link only when the target matches a **`\d{3}-` prefix** (`we:scripts/check-standards-rules.mjs:608`, regex `^(?:\.{0,2}\/)?(?:backlog\/)?\d{3}-[a-z0-9-]+\.md(?:#.*)?$`). So a **pre-renumber** link of the form `[..](xNNNNNN-slug.md)` is **invisible** to the gate — the hash-slug form has no `\d{3}-` prefix.

This is the *most likely* link to go stale: a hash-slug link is by definition to a not-yet-numbered item, exactly the reference that the at-land renumber must heal (gate 3) — and if the renumber misses it, the link-checker can't even see it to warn.

**Mechanism.** Extend the `findBadBodyLinks` target-matching so the bare hash-slug form (`[..](xNNNNNN-slug.md)`, with the same optional `./`, `../`, `backlog/` prefixes and `#anchor` suffix as the numbered form) is also caught. This closes the loop with gate 3: gate 3 heals or errors on the hash slug at land; gate 4 makes the link-checker able to *see* it in the meantime.

### 5. `we:path:line` reference resolution — a cited locus must resolve to a real file + in-range line

**The tell.** A `we:<path>:<line>` code-locus citation (or its `plateau:` / `fui:` in-repo forms — see below) whose `<path>` names **no such file**, or whose `<line>` is **past the end of the file**. This is the exact round-2 finding made mechanical: `applyLedger` was cited at `we:scripts/lane-drain.mjs:596`, a line where `applyLedger` does not appear — it is defined at `we:scripts/backlog/id.mjs:144` and called at `we:scripts/lane-drain.mjs:641`. A reviewer had to open the file to catch it; `check:standards` can resolve it for free.

**Scope of what's checkable.** The prefix already tells the gate *which repo* to resolve against (rule from `we:docs/agent/conventions.md:56` — the repo-locus convention). For **in-repo `we:` citations the check is fully deterministic**: the file is in this working tree, so a dangling path or an out-of-range line is a hard error. For **cross-repo `fui:` / `plateau:` citations** the target isn't in this checkout, so path/line existence can't be resolved here — those stay unchecked by this gate (a sibling repo's own gate would resolve them), and the gate must **not** false-positive on a `fui:`/`plateau:` locus. A line *range* (`we:foo.mjs:164-194`) resolves on its start and end bounds.

**Why it's a gate, not judgment.** Whether the cited line is the *right* place to point is judgment; whether the file exists and the line is within it is two `fs.stat` + line-count comparisons. It reproduces its own instance: the pre-fix `we:scripts/lane-drain.mjs:596` cite must fail this gate; the corrected `we:scripts/backlog/id.mjs:144` must pass.

**Mechanism.** A `check:standards` rule (in `we:scripts/check-standards-rules.mjs`) that scans `backlog/*.md`, `reports/*.md`, and `docs/agent/*.md` for `we:<path>:<line>` (and `:<start>-<end>`) tokens, resolves in-repo `we:` targets against the tree, and errors on a missing file or a line beyond EOF. Cross-repo prefixes are recognized and skipped, never errored. This rides alongside the existing locus-prefix linter (`we:scripts/lint-locus-prefix.mjs`) — that gate proves the prefix is *present*; this one proves the target it names actually *resolves*.

### 6. Symbol-anchored citation convention — prefer a symbol name over a brittle line number

**The problem.** A `we:path:line` cite is correct only until the file is edited; then every downstream line number silently drifts (the round-2 `:596` was very likely a once-correct line that moved). A citation to a **symbol** — a function or `const` name — survives edits, because the symbol moves *with* its definition. The convention should make the symbol form the authored default for code definitions, and lint a bare `:line` cite of a definition when a symbol anchor is available.

**The convention (to document in `we:docs/agent/conventions.md`, the repo-locus section at `:56`).** When citing the **definition** of a named export/function/const, prefer the symbol-anchor form — `we:scripts/backlog/id.mjs#applyLedger` — over `we:scripts/backlog/id.mjs:144`. Line refs stay legitimate for pointing *inside* a body (a specific statement, a regex, a comment) where no symbol names the exact spot; the convention targets *definition* cites, which are the ones that drift hardest and matter most (a definition is the thing most often cited as statute).

**The lint (script-decidable half).** A `check:standards` warning that, for a `we:<path>:<line>` cite whose `<line>` lands on a top-level `export function <name>` / `export const <name>` / `function <name>` declaration in the resolved file, suggests the `#<name>` symbol form. Starts warn-level (it's a convention nudge, not a correctness error like gate 5) and can tighten. The symbol-anchor form itself must also *resolve* — `#applyLedger` is only valid if that symbol is defined in the named file — so gate 5's resolver is extended to accept and verify the `#symbol` anchor as an alternative to `:line`.

**Reproduces on this item.** The gate-3 `we:scripts/lane-drain.mjs:566` cite of `applyLedger` (which is *defined* in `we:scripts/backlog/id.mjs`) is both a gate-5 error (wrong file for that symbol) and a gate-6 case (should be a `#applyLedger` symbol anchor). Landing this story includes correcting that cite so the item passes its own gates.

### 7. Count / label matches its source — documented judgment case (no deterministic form yet)

**The tell (round-2, finding 2).** A stated **count with a label** — "N statutes", "N anchors", "5 codified rules" — where the *number* was produced by counting one thing but the *label* names another (the round-2 instance: research-topic counts described as "statute/anchor" counts). The number can be exactly right while the label is wrong.

**Why this one stays judgment, not a gate.** Verifying it requires knowing *what the author meant to count* — was "5" meant as 5 research topics (correct label) or 5 statutes (wrong)? That intent isn't in the file; only the author has it. A machine can count rows in a source, but it cannot know which noun the sentence *should* have used, so there is no non-brittle greppable tell. Per #51 this is exactly the judgment half: it stays in the reviewer's context and in this documented note, **not** in a hook — unless a later, genuinely deterministic form appears (e.g. a count written as `count(researchTopics)=5` that the gate could re-derive from the named source). Recorded here so the reviewer knows to check label-against-source on count claims, and so a future deterministic form has a home.

### 8. Declarative-leash touch vs declared care level — a routing claim must be derived from the STATUTE, not the `tier:` field (surfaced by #957 round 5)

> **Retraction note.** An earlier form of this gate (added on #957 round-4 advice) keyed off `we:scripts/lib/gate-config.mjs`'s `tier: 'policy'` field and would have hard-errored any item declaring `elevated` for **derivation code**, forcing it to `review:human`/`high`. That was **wrong** and is retracted: the ratified [#2771] statute splits the policy tier and routes derivation code to the committee at `elevated`. This gate is rewritten to key off the **statute**, and its must-pass fixture is the corrected #957 item at `elevated`, not `high`.

**The tell.** A `kind: decision` item whose **predicted touch-set** names a **declarative-leash** file — the machine-diffable policy contract (`we:review-policy.contract.json`), the roster (`we:scripts/lib/gate-config.mjs`), or the invariant/conformance suites (`we:scripts/lib/gate-invariants.test.mjs`, `we:scripts/lib/review-policy.conformance.test.mjs`) — **while declaring anything less than `review:human`**. A diff to the declarative leash is a genuine policy change and stays human-gated; declaring it `elevated`/committee/agent-clearable is the contradiction the gate catches.

**The authority is the statute, not the code.** This gate keys off the ratified [`#review-human-declarative-leash-only`](/backlog/2771-narrow-the-review-human-escalation-criteria-implementation-m/) ([#2771], ratified 2026-07-28) split — declarative leash → `review:human`; **derivation code** (`we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-core.mjs`, `we:scripts/lib/review-policy.mjs`) → sized independent committee at `elevated`/`review:pending` — **not** off `we:scripts/lib/gate-config.mjs`'s `tier: 'policy'` field. The `tier:` field lumps derivation code and the declarative leash into one tier; the statute splits them, and today's `scoreEscalation` still returns `humanRequired` for a derivation-code touch **only because [#2785]** (the narrowing implementation, `blockedBy` #2771) is still open. A gate reading the `tier:` field or a live `humanRequired` return would hard-error every item that *correctly* declares `elevated` for derivation code the moment #2785 lands — the round-4 mistake this gate is the retraction of (see gate 9 — the ruled-but-not-yet-implemented gap that made the code read as authority).

**Why it's script-decidable (belongs in this family).** The predicted touch-set is a list of `we:` paths in the item body; the declarative-leash basename set is fixed by the statute (`POLICY_SPEC` in `we:scripts/lib/gate-config.mjs`). Cross-referencing the two — does any predicted path name a declarative-leash file? — is a lookup, and the required floor (`review:human`) follows deterministically. A "claim about the gate derived from the gate's *statute*," same root class as the rest of #2821 (a reference asserted without resolving it against the source).

**Real instances it must reproduce.**
- **Must pass:** the corrected **#957 item** `xgtiq7f` — predicted touch-set names `we:scripts/lib/review-core.mjs` (derivation code), declared care `elevated` / committee routing per #2771. Correct, never a violation.
- **Must fire:** an item whose predicted touch-set names `we:review-policy.contract.json` or the roster in `we:scripts/lib/gate-config.mjs` while declaring `elevated` (less than `review:human`) — a real policy change mislabeled agent-clearable. (The pre-round-5 `xgtiq7f`, forced to `high` off the `tier:` field, is the mirror error the *old* gate 8 made — recorded here as what this gate must **not** do.)

### 9. Ruled-but-not-yet-implemented marker — a ratified anchor whose implementation follow-on is still `open` must say so (surfaced by #957 round 5)

**The tell.** A ratified `we:docs/agent/platform-decisions.md` anchor whose `**Lineage:**` (or ruling body) names an **implementation follow-on** — an item `blockedBy` the ruling that carries the actual code change — that is still `status: open`. For that window the *code contradicts the ruling by design*: the statute rules one way, the not-yet-shipped implementation means the running code still behaves the old way, and a reader of either one alone is misled. This is exactly the round-5 retraction: a reviewer read `we:scripts/lib/gate-config.mjs` as the authority because [#2771]'s implementation ([#2785]) had not landed, so the live `humanRequired` return still reflected the *old* routing.

**Why it's a gate, not judgment.** Whether the ruling is right is judgment; whether an item named in a ratified anchor's Lineage as its implementation follow-on is still `open` is a status lookup. A machine resolves the follow-on `#NNN` and reads its `status:`.

**Mechanism.** A `check:standards` rule that, for each ratified anchor, resolves any implementation-follow-on `#NNN` named in its Lineage and — if that item is still `open` — renders a **"⚠ ruled, not yet implemented — the code still behaves the old way until #NNN lands"** marker on the statute itself. The marker clears automatically when the follow-on resolves. The gap becomes visible at the point of reading, so nobody takes the code as the authority the way round-5's reviewer did.

**Real instances it must reproduce.**
- **[#2771]** (`#review-human-declarative-leash-only`, ratified 2026-07-28): its Lineage names implementation follow-on **[#2785]** (`blockedBy` #2771), still `open` → marker fires. Today's `scoreEscalation` returns `humanRequired` for derivation code precisely because #2785 has not landed — the exact gap that misled #957 round 4.
- **`#build-lane-self-review-non-zero-floor`** (the #957 anchor, ratified 2026-08-01): its Layer-1 `selfReviewDepthForCareLevel` build slice is **unfiled** → marker fires (a ratified rule whose code does not yet exist at all). Filing that slice and naming it in the anchor's Lineage both clears the marker and closes the provenance gap.

## Acceptance

Each failure becomes a **deterministic gate error that reproduces its real instance** — a test/fixture that fails today and passes once the gate lands:

1. **(1a)** A `kind: decision` flipping to `resolved` while its `relatedReport` / PR body still says "not ruled" / "prepare only" / "awaiting ratification" → gate error (reproduces PR #959's unreconciled resolve). Passing requires reconciling every artifact in the same turn.
   **(1b)** A same-day (`preparedDate == dateResolved`) `kind: decision` with a **live fork** (≥2 `## Fork` branches **AND/OR** a confidence score **AND/OR** a `SURVIVES-WITH-AMENDMENT` skeptic — any one suffices) flipping to `resolved` **and carrying no ratify marker** → gate error. Passing requires the collapse-to-one-branch condition or a recorded ratify marker. Two fixtures: the **corrected** #2801 (records "RATIFIED by the operator on 2026-08-01") and the **corrected #957 item** `xgtiq7f` (records `ratifiedBy:` + a `## Ruling` naming the operator) must both pass; the pre-correction `xgtiq7f` (same-day, live fork, no marker) must fire — a legitimate same-day ratify is never blocked, but an unrecorded one always escalates.
2. A `#NNN` citing a PR number → hard error; a `#NNN` whose target kind/title is implausible for the citing sentence → flagged (reproduces the "carved from #955" → unrelated polyglot-sandbox mis-cite).
3. A hash slug cited from `we:reports/`, `we:src/_data/researchTopics/`, or `we:src/_includes/research-descriptions/` either self-heals at land (scope widened) or is a hard error before land (reproduces the #957 dead-link-post-land).
4. A `[..](xNNNNNN-slug.md)` link is caught by `findBadBodyLinks` (reproduces the invisible pre-renumber link).
5. An in-repo `we:<path>:<line>` cite whose file is missing or whose line is past EOF → hard error (reproduces the round-2 `we:scripts/lane-drain.mjs:596` mis-cite of `applyLedger`, which is defined at `we:scripts/backlog/id.mjs:144`); the corrected cite passes. A `fui:` / `plateau:` cross-repo locus is recognized and **not** errored (its target isn't in this checkout).
6. A `we:<path>:<line>` cite landing on a top-level `export function` / `export const` / `function` definition → warned toward the `we:<path>#<symbol>` symbol-anchor form; the `#<symbol>` form is accepted by gate 5's resolver and verified to exist in the named file. This story's own gate-3 cite of `applyLedger` is corrected to the symbol form as part of landing.
7. **(judgment, not a gate)** A count whose *label* misnames what was counted (round-2's research-topic counts labeled "statute/anchor") is recorded as a documented reviewer-check in §7 — no hook, because verifying the label needs author intent, not just the source. No fixture; it stays context until a deterministic form appears.
8. A `kind: decision` whose predicted touch-set names a **declarative-leash** file (`we:review-policy.contract.json`, the roster in `we:scripts/lib/gate-config.mjs`, the invariant/conformance suites) while declaring less than `review:human` → gate error, keyed off the [#2771] statute (not the `tier:` field). The corrected #957 item `xgtiq7f` (derivation-code touch, `elevated`/committee per #2771) must **pass**; a policy-contract touch declaring `elevated` must **fire**. (This retracts and replaces the round-4 form that keyed off `tier: 'policy'` and would have forced derivation code to `high`.)
9. A ratified `we:docs/agent/platform-decisions.md` anchor whose Lineage names an implementation follow-on still `status: open` → renders a "ruled, not yet implemented" marker on the statute (reproduces [#2771] via open [#2785], and the #957 `#build-lane-self-review-non-zero-floor` anchor whose build slice is unfiled). The marker clears when the follow-on resolves.

`check:standards` stays at 0 errors on the current tree after the gates land (they fire only on the bad shapes above) — including on **this item's own body**, once the gate-3 `applyLedger` cite is corrected to `we:scripts/backlog/id.mjs#applyLedger`.

## References

- **[#51](/backlog/)** — hookable-vs-judgment rule: script-decidable → hook, judgment stays in context. Each of these is a mechanical tell, so each is a hook.
- **[#2563](/backlog/2563-blast-radius-is-advisory-care-level-not-a-park-gate-converge-/)** — review escalation / advisory care-level. Sibling review-hardening.
- **[#2439](/backlog/2439-independent-hardened-validator-redteam-accepted-acceptance-l/)** — independent hardened validator + `redteam:accepted`. Sibling validator-hardening.
- Surfaced by the **#957 / #959 ratification review bounces** — the failures this story hooks. The **#957 round-1** bounce surfaced gates 2–4 (the `#NNN` mis-cite + hash-slug drift); the **#957 round-2** bounce surfaced gates 5–6 (the `we:scripts/lane-drain.mjs:596` mis-cite of `applyLedger`) and the §7 label-vs-source judgment case; the **#957 round-4** bounce surfaced the declarative-leash-vs-care-level check (gate 8) and gate 1b's second fixture (the unrecorded ratification); the **#957 round-5** bounce **retracted** round-4's gate-self correction — rewriting gate 8 to key off the [#2771] statute rather than `we:scripts/lib/gate-config.mjs`'s `tier:` field — and surfaced gate 9 (the ruled-but-not-yet-implemented marker). Note #959's bounce was a **false positive** caused by an unreconciled resolve (gate 1a), not by a self-ratify; the accept verdict on PR #959 withdraws that finding. All are one root class — "a reference asserted without resolving it against the source" (see [The unifying root class](#the-unifying-root-class-a-reference-asserted-without-resolving-it)) — now including the *reviewer* as the author and the **statute layer** as the source skipped (round 5).
- **[#25](/backlog/)** — provenance = the statute layer: a wrong cite (`#NNN`, `we:path:line`, count) is a wrong law citation that outlives the session. This is why the citation-resolution family is worth a gate.
- **[#2801](/backlog/2801-productized-design-source-home-locked-in-code-target-referen/)** — the decision whose resolve exposed gate 1a; its report carries the same prevention analysis.
- **`we:docs/agent/conventions.md`** — the repo-locus code-path reference convention (`we:` / `fui:` / `plateau:` prefixes, line refs) this story's gates 5–6 extend from "the prefix is present" to "the target resolves + prefer a symbol anchor". Enforced today by `we:scripts/lint-locus-prefix.mjs` (prefix-present); gate 5 adds a resolver alongside it.
- Code loci: `we:scripts/check-standards-rules.mjs` (gates 1a, 1b, 2, 4, the 3-error-form, and the gate-5 `we:path:line` resolver + gate-6 symbol-anchor lint), `we:scripts/check-standards.mjs`, `we:scripts/lane-drain.mjs` (`numberPendingHashes`, gate 3-heal-form; PR-body check for gate 1a — note the numbering brain `applyLedger` it calls is *defined* in `we:scripts/backlog/id.mjs#applyLedger`), `we:scripts/lint-locus-prefix.mjs` (the prefix gate the gate-5 resolver rides alongside), `we:docs/agent/conventions.md` (gate-6 convention text), and a `PreToolUse` write gate on `we:backlog/*.md` (gate 1b write-time form).
