# Quantifying the constitutional-amendment gate — cooling period, committed record, the #911 exemption, and project scope

**Date**: 2026-08-17
**Point**: #2564 Fork 5 ratified a *substantively entrenched* constitutional-amendment gate in three qualitative clauses (exempt from #911 supersede-with-lineage · a cooling period "in days, not sessions" · a committed external artifact). None of the three has a number, a format, or a mechanism. This report is the prep-time grounding for #3144, which turns each into something buildable — and records two findings that reshaped the forks.
**Research page**: `/research/constitutional-amendment-gate-quantification/`
**Backlog item**: `#3144`

---

## Question

What, concretely, does #2564 Fork 5's entrenchment gate require? Specifically:

1. How many days is the cooling period, what event starts it, what restarts it, and where does the number live?
2. What is the "committed external artifact" — format, location, and what makes it a trustworthy *independent* trace?
3. What enforces "exempt from #911's supersede-with-lineage" when supersede-with-lineage has no code at all?
4. What does "the gate scales with scope" mean for a *project*-scope constitution?

## Recommendation (the prepared defaults — not yet ratified)

The item started with four forks and ends with **three**. The skeptic refuted two of the four first-draft
defaults outright (see Finding 7 — the whole draft had been written against a review gate re-ratified three
weeks earlier), and a fresh-context re-screen dissolved a fourth fork as settled-by-precedent:

- **Fork 1 — what class of surface may confer the entrenchment.** A **`POLICY_SPEC` declarative-leash
  member** — the one class that is human-only and permanently whole-file pinned by #2840 trigger 3, so it is
  the higher-order instrument clause (i) needs. *Which* leash file is an implementation choice, not the
  ruling — the first draft named files as branches and the re-screen flagged that as implementation altitude.
  Not an unregistered file (agent-clearable today), and not the rubric (ratified agent-clearable by #2771).
- **Fork 2 — the cooling clock.** It may read only the **forge-side merge timestamp** of the PR that landed
  the record. A substantive change to the proposed text **cancels** the period. The interval must **exceed
  one continuous working stretch** (ruled), while its value is a config default (`P10D`). The gate **parks**
  the PR with its ripe-at date rather than hard-refusing, per `#blast-radius-advisory-care-not-a-gate`.
- **Fork 3 — project scope.** A project joins the tier by being **listed in the platform-scope declaration**,
  so joining or leaving is itself a platform-tier act. Never a self-declaration in an ungated project file.
  No project is listed, so project scope is defined-but-unpopulated; `plateau-app:constitution.md` is outside
  the tier by construction.
- **Dissolved — the committed record's shape.** Drafted as a fork; the re-screen showed the excluded branches
  were already excluded by clause (iii)'s own word *committed*, and the only argument separating the
  survivors ("an amendment is a decision, so it takes the decision form") is **settled by precedent**, not a
  merit either/or. Recorded as settled: a **mandatory amending decision item** plus a
  `we:reports/YYYY-MM-DD-constitution-amendment-<slug>.md` transcript via `relatedReport` — and stated
  plainly, the record is **evidence, not a gate**, since nothing verifies the red-team ran.

## Key findings

### Finding 1 — "supersede-with-lineage" has no mechanism, so there is nothing to be exempt from

#911's reversibility rule is documented prose in two places — `we:docs/agent/platform-decisions.md:39`
("A reversal supersedes the rule here *with lineage* … never erase it") and the mechanics at
`we:docs/agent/backlog-workflow.md:383` ("a reversal is a normal decision turn, not an erasure"). There is:

- **no `supersede` verb** in `we:scripts/backlog.mjs` (full verb list at `we:scripts/backlog.mjs:1213-1236`);
- **no `supersedes`/`supersededBy` frontmatter field** for backlog items;
- **no validator** that knows about decision lineage at all.

The only mechanized supersede-with-lineage in the repo is for **research topics** — bidirectional
`supersedes`/`supersededBy` pointers validated at `we:scripts/check-standards.mjs:273-286`, with the
"refresh-as-new-dated-artifact, never in place" rule at `we:docs/agent/research-workflow.md:51-72`. That is
the working precedent to copy, and it is notable that its entrenchment property comes from *immutability of
the dated artifact*, not from a permission check.

Consequence: clause (i) cannot be built as a carve-out from an existing gate. It has to be re-expressed as
something that binds on a surface that *does* have code — which is what **Fork 1** does (the conferring
surface class). Fork 3 is a different question: project **scope**.

### Finding 2 — the only statute gate that exists is whole-file, and it is the floor, not the ceiling

`we:scripts/lib/review-escalation.mjs:70-73` matches `^docs/agent/platform-decisions\.md$` and routes **every**
diff to that file to `review:human` (`we:scripts/lib/review-escalation.mjs:41`, `:574`, `:580`). It cannot
distinguish a constitution-tier anchor from an ordinary one — the identification mechanism #2568 Fork 1
produces is the missing input. #2568's skeptic already folded the **stacking, not replacing** amendment
(`we:backlog/2568-constitution-curation-form-which-core-principles-vs-specs-an.md:106-111`): the entrenched
path escalates *past* the existing floor rather than substituting for it. #3144 inherits that and does not
re-decide it.

### Finding 3 — no cooling period, and no prepared→ratified date comparison, exists anywhere in the repo

`prepare-stamp` writes `preparedDate` (`we:scripts/backlog.mjs:532-548`) and `resolve` writes `dateResolved`
(`we:scripts/backlog.mjs:322-346`), but **nothing compares them**. Readiness treats `prepared` as a boolean
(`we:scripts/readiness/engine.mjs:152-155`). The repo's only calendar-arithmetic gate is research freshness —
`addIsoDuration` + `deriveResearchFreshness` in `we:scripts/lib/research-freshness.cjs:20-55`, an ISO-8601
duration compared against a date, already tested and dual-module. That is the ready-made primitive for a
cooling period; it is warn-only in its current use, so the enforcing half is new work.

### Finding 4 — the jury ledger cannot serve as the committed record; `reports/` can

The existing transcript machinery writes to `.conveyor/jury/*.jsonl`
(`we:scripts/lib/jury-ledger.mjs:61-73`) — explicitly gitignored operational state, so it is the opposite of
"a committed external artifact." By contrast `reports/` is already **gate-enforced as committed and
reachable**: `validateReportsNotHidden` (`we:scripts/check-standards-rules.mjs:1406-1417`) errors on a report
no `/research/` topic or backlog `relatedReport` points at, and the untracked-artifact guard
(`we:scripts/check-standards.mjs:1041-1050`) flags an authored-but-uncommitted report pre-push. It is the only
committed, gate-validated artifact channel that exists today.

The trust question — a report the amending agent writes is *emitter-controlled*, so it can assert a red-team
that never ran — has a ratified answer already: #2978's admission rule
(`we:docs/agent/platform-decisions.md:3496`) requires a **quoted grounding turn plus a transcript pointer**,
verified "against a file the *harness* writes, not one the emitter controls." That verification is itself
**ratified but unbuilt** (no `transcriptPointer` code exists under `we:scripts/`), so #3144's default inherits
a build, not a shipped check — stated honestly rather than papered over.

### Finding 5 — a per-project constitution already exists in the wild, outside every gate

`plateau-app:constitution.md` (4.8 KB, authored 2026-07-14) is a real, published project constitution, rendered
at a public `/constitution` route by `plateau-app:packages/saas/src/marketing/constitution.ts` — which bundles
the repo-root file via Vite `?raw` so "the page never drifts from the doc", i.e. single-authoring-SoT +
derived projection *already correctly applied*. It is subject to no amendment ceremony: `STATUTE_PATHS` is
WE-anchored and matches nothing outside `we:docs/agent/`.

But it is **not** what #2564 means by a project constitution. #2564's "project" is a **WE standards project** —
the `ownedByProject` owner of intents/protocols (`we:backlog/2564-adopt-spec-based-programming-across-the-constellation-schema.md:126-131`,
e.g. `webrealtime`; 46 such projects live under `we:src/_data/projects/`). `plateau-app:constitution.md` is a
product north-star that explicitly disclaims build decisions ("It does **not** decide how we build anything").
So the discovery is a **vocabulary collision**, not a governance breach — and it is exactly why **Fork 3**'s
default makes tier membership turn on a *declared* platform-scope entry rather than on an artifact's name.

### Finding 6 — #3144's own premise about #2568 went stale during the gap

#3144's body says #2568 is "not yet prepared (no `preparedDate`)". #2568 carries
`preparedDate: "2026-08-16"` and a fully-shaped Fork 1 with a `Skeptic:` and two `Screen:` passes. The
reconciliation half of #3144 is therefore **closed by #2568's prep**, not open work: #2568 now cites #2564
Fork 5 as a hard constraint, argues the three clauses are process properties rather than storage properties,
and proposes the review-escalation extension. #3144 is re-scoped in this pass to the residual quantities.

### Finding 7 — the biggest one: a whole governance cluster was uncited, and it inverts two defaults

The prep skeptic ran a grep for `2771|2785|2840|principle-surface|declarative-leash` over both `#3144` and
`#2568` and got **zero hits**. That is the entire 2026-07-28 → 2026-08-02 governance re-ratification, and it
governs exactly the turf all four forks rule on:

- **#2771** (`we:docs/agent/platform-decisions.md:3408`) **split the policy tier.** The declarative leash —
  `we:scripts/lib/review-policy.contract.json`, `we:scripts/lib/gate-config.mjs`, the invariant/conformance
  suites — stays `review:human`. The **derivation code**, naming `we:scripts/lib/review-escalation.mjs`
  explicitly, is **ratified agent-clearable**.
- **#2840** (`:3478`) made `review:human` fire on a **principle surface**, and is "the canonical definition of
  that term for the whole governance cluster". Trigger 1 is already **per-anchor** inside the statute
  document; trigger 3 pins every `POLICY_SPEC` file human-gated whole-file, **permanently**.
- **#2839** (`:3470`) — a principle change and its implementation may never travel in one diff.
- **#2851** (`:3430`) — the human step is authoring or weakening a principle, never enforcing one.

Consequences folded into the item: the first draft had put the constitution's only real protection **inside
the file #2771 made agent-clearable**, so an AI panel could have emptied it; and it had rejected the contract
as "not entrenched" while homing the day-count in a new file matched by **no** gate at all — a strictly
higher bar applied to the number than to the gate enforcing it. Both defaults flipped. The leash is the
answer to Fork 5(i)'s hardest question (*what higher-order instrument can confer an exemption?*), and it
already exists.

Two further skeptic findings, both verified and folded: **every timestamp the draft named is settable by the
actor being gated** — a git committer date is `GIT_COMMITTER_DATE`, and `git log -1` returns the *latest*
commit touching the path, so it silently restarts rather than cancels — and the draft's **non-authoring-session
condition cannot fire on this class of PR**, because `--to=clear-human` is explicitly exempt from the
self-clear refusal (`we:scripts/lib/review-independence.mjs:42-48`, an exemption the file documents as
load-bearing) and a subagent inherits its parent's session id (`:301-307`).

## Prior-art survey

See `/research/constitutional-amendment-gate-quantification/` for the full survey. What the external
precedent supports, in four lines:

1. **On the day-count — nobody derived their number from evidence.** The attested band is 72 hours (Apache,
   justified by *timezone coverage*, not deliberation) → 10 days (Rust's Final Comment Period, the only one
   that states *any* rationale: "ten calendar days, so that it is open for at least 5 business days" — a
   stated minimum with margin, **not** arithmetic that yields 10; the shortest span guaranteed to contain
   five working days is 7) → 14 days
   (the modal but underived answer: IETF working-group Last Call, Debian, EIP, the EU withdrawal right) → 28
   days (W3C's Advisory Committee minimum, and IETF's *doubling* for individual submissions that had no prior
   deliberating body — structurally always the solo case). Three widely-assumed facts are wrong and worth not
   repeating: **TC39 has no waiting period at all**, Node.js is 48 hours rather than 72, and Rust's FCP
   **cancels** on a new substantive argument rather than restarting.
2. **No constitutional system entrenches by duration alone.** Denmark, Norway, the Netherlands, Belgium,
   Finland, Sweden and nine US states all require an **intervening election** — a change in who is deciding.
   Sweden's nine-month rule is measured *backwards from the election*. Time is treated as insufficient
   because it does not change the decider.
3. **Self-declared entrenchment is decorative** — the finding that reshaped Fork 3. Under *Thoburn v
   Sunderland CC* a statute does not become immune to implied repeal by saying so; the category is conferred
   by the court, **from outside**. *Trethowan*'s self-referential lock bound only because a higher-order
   instrument authorised it. Roznai's *double amendment* problem is the residual: whatever confers the
   exemption must also protect itself.
4. **The empirical case for cooling periods is weak to negative** — Utah's 72-hour waiting period changed
   ~2% of already-certain decisions; delay does not debias anchoring; the unconscious-thought advantage
   failed a large multi-lab replication; the one solid positive (Buçinca et al., CSCW 2021) used a pause on
   the order of seconds and attributes the effect to interrupting the automatic accept. **These are
   secondary-source figures gathered in the survey and not re-verified against the source papers** — the
   direction is what the recommendation uses, never an exact subject count or duration. So the interval's defensible job is
   *a window for new information plus a structural condition*, never "reflection improves the call".

## Files created/modified

| File | Action |
|---|---|
| `we:backlog/3144-curate-the-constitution-tier-s-full-principle-set-and-quanti.md` | Re-scoped to the three quantification forks, prepared to DoR, `preparedDate` stamped |
| `we:reports/2026-08-17-constitutional-amendment-gate-quantification.md` | Created (this report) |
| `we:src/_data/researchTopics/constitutional-amendment-gate-quantification.json` | Created |
| `we:src/_includes/research-descriptions/constitutional-amendment-gate-quantification.njk` | Created |
