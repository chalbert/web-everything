---
bornAs: xzsnnta
kind: decision
status: open
dateOpened: "2026-08-05"
preparedDate: "2026-08-16"
tags: []
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/lib/review-policy.contract.json"]
---

# How wide should the blast-radius net over the agent-instruction surfaces be — enumerate named paths, or invert the we:.claude/ anchor to default-deny?

A named-path blast-radius list is correct only while someone remembers to register each future behaviour-defining surface, and three regressions proved that memory unreliable. This decides whether to keep enumerating or invert the we:.claude/ anchor to default-deny with an exemption list, and settles the same question for we:AGENTS.md, we:CLAUDE.md and non-statute we:docs/agent/.

Carved out of **#2939** (the build item), which now `blockedBy`-waits on this call. #2939 enumerates *which* surfaces are unregistered and proves each scores `false`; this item is the one design question that enumeration cannot answer for itself — **how the net decides about a surface nobody has enumerated yet.** Filed separately because #2939 is `kind: task`: an agent claiming it would otherwise hit this question mid-lane and either stall or rule on it unratified.

## Why this is a fork and not a preference

The branches genuinely cannot coexist. A *list* fails **open** on an unregistered name (the surface scores nothing until someone adds it); an *inverted anchor* fails **closed** (an unregistered surface escalates on the day it appears, until someone exempts it). One default has to be picked, because a path that matches neither rule must land somewhere, and the two rules disagree about exactly that path. This is not cost-vs-benefit — the two branches differ in which direction the *unknown* case errs, which is a correctness property, not an effort one.

## The measurement (verified at PR #1048's head)

`isBlastRadiusPath` returns `false` for every one of: `we:.claude/settings.json` (registers the `PreToolUse(Edit|Write)` write-gate hooks), `we:.claude/commands/`, `we:AGENTS.md`, `we:CLAUDE.md`, and non-statute `we:docs/agent/`. #2939 carries the full table and what each surface controls.

The recurrence pattern is the actual evidence: this class was closed **one surface at a time** — PR #1040 / PR #1043 / PR #1045 (the agent-memory corpus, unregistered) → #2909 (the two agent-behaviour trees, both spellings) → PR #1048's own round-4 review (the files the required check's *resolution* depends on — now carved out to [#2935](/backlog/2935/), still unregistered). Three rounds of the same review found three different unregistered surfaces. Each fix was correct and none of them predicted the next.

## Fork 1 — how the blast-radius net treats a surface nobody registered

**Fork-existence justification:** case (b), a real either/or — a path that matches no named pattern must score *something*, and the branches assign it opposite values (`false` = merge unreviewed, `true` = escalate). No composition supports both.

- **(a) Enumerate wider.** Register the named paths #2939 lists and keep the list a list. Cheapest, and the narrowest possible over-escalation. Fails **open** again the next time a behaviour-defining file appears under a name nobody predicted — which is the documented recurrence, not a hypothetical.
- **(b) Invert to default-deny (recommended default).** Anchor `(^|\/)\.claude\/` **whole** as blast-radius, with a short commented EXEMPTION list for the genuinely inert entries. An unregistered surface then fails **closed** the day it appears: a new `we:.claude/agents/` or a new hook file escalates with nobody having filed anything. The cost is over-escalation on the exempt-but-unlisted tail — the safe direction by the roster's own stated policy ("basename match … can only ever over-escalate … the safe direction, by policy"). Note the scope limit: this covers only `we:.claude/`. `we:AGENTS.md`, `we:CLAUDE.md` and `we:docs/agent/` sit outside that anchor and need Fork 2's answer regardless.
- **(c) A hybrid — invert `we:.claude/` and keep everything else enumerated.** Formally (b) for one directory and (a) for the rest. Worth stating explicitly so a ruling of "(b)" is not read as also inverting `we:docs/agent/`.

**Bold default: (b)** — it is the only branch whose correctness does not depend on a future editor remembering this item exists, and the recurrence record is that they do not.

**Concrete shape.** Today (`we:scripts/lib/review-escalation.mjs:245-254`), the `.claude/` coverage is two narrow anchors inside the flat `BLAST_RADIUS` list:

```js
const BLAST_RADIUS = [
  /^scripts\//,
  /(^|\/)\.claude\/(skills|agent-memory)(\/|$)/,   // only these two trees
  /(^|\/)(skills|agent-memory)-src(\/|$)/,
  /(^|\/)\.githooks\//,
  /(^|\/)\.github\//,
  ...STATUTE_PATHS,
  /^src\/_data\/(blocks|plugs|intents|protocols|semantics)\.json$/,
  ...CONFORMANCE_GRADING_PATHS,
];
```

Fork 1(b) replaces the two-tree anchor with a whole-directory anchor plus a short, commented exemption list checked *before* the wide match returns true:

```js
// Genuinely inert entries under .claude/ — each line names why it is safe to exempt.
const CLAUDE_DIR_EXEMPT = [
  /(^|\/)\.claude\/settings\.local\.json$/,   // personal override, gitignored in practice
];
const BLAST_RADIUS = [
  /^scripts\//,
  // whole-tree default-deny anchor replaces the two narrow tree anchors above
  /(^|\/)\.githooks\//,
  /(^|\/)\.github\//,
  ...STATUTE_PATHS,
  /^src\/_data\/(blocks|plugs|intents|protocols|semantics)\.json$/,
  ...CONFORMANCE_GRADING_PATHS,
];
export function isBlastRadiusPath(path) {
  const p = String(path || '');
  if (/(^|\/)\.claude\//.test(p)) return !CLAUDE_DIR_EXEMPT.some((re) => re.test(p));
  return BLAST_RADIUS.some((re) => re.test(p)) || BLAST_RADIUS_ENGINE_BASENAMES.has(basenameOf(p));
}
```

This is additive to the existing four-spelling `.claude/skills|agent-memory` anchors (kept or folded in — either is behaviour-equivalent once the whole tree is covered) and correctly starts catching `we:.claude/settings.json` and `we:.claude/commands/`, the two live gaps #2939's table names as actually behaviour-defining (the hook registry and the command router), not merely as a hypothetical widening.

**Skeptic:** SURVIVES-WITH-AMENDMENT. Classification holds — a given unmatched path must land on exactly one side, so this is a real either/or, not a config dimension or a support-both. Merit holds and is *stronger* than the item's first pass showed: the file's own comment (`we:scripts/lib/review-escalation.mjs:118-123`) already names `we:.claude/settings.json` / `we:.claude/commands/` as real, open gaps deliberately left out of the narrow two-tree anchor — so (b) does not invent new coverage, it closes gaps the code author already flagged. No statute collision: [`#blast-radius-advisory-care-not-a-gate`](docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate) (#2563) governs a different question (what an escalation *does* — dial AI-panel rigor, never park for a human by itself) and composes cleanly with this one (which paths *count*). Citation-scope fix: the item's "the safe direction, by policy" line was a paraphrase of a different in-file comment (the `BLAST_RADIUS_ENGINE` basename-match note) rather than a direct cite of #2563 — now cited by anchor above, and scoped correctly as *supporting context that bounds the cost of failing closed*, not as authority for which paths belong in the net (that authority is this decision's own). One second-order effect worth carrying forward rather than re-litigating: `isBlastRadiusPath` is also read by `isSensitivePath` in `we:scripts/readiness/test-selection.mjs`, so widening this set also widens that gate's deny-list — already documented in-file (`we:scripts/lib/review-escalation.mjs:205-234`) as a currently-inert consequence (that selection path is flag-gated off today), and the direction is the safe one there too.

**Screen:** clear. (1) Not an implementation-detail-vs-standard confusion — there is no WE↔FUI/consumer boundary in play; this is WE's own internal delivery/review governance, correctly framed as a policy call within that layer. (2) A real merit difference survives the free-to-build counterfactual: given the identical unregistered path, (a) and (b) produce opposite outcomes (merge unreviewed vs. escalate) regardless of how cheaply either rule is built or kept current — that is an outcome divergence, not a disguised maintenance-cost argument.

## Fork 2 — the volume-sensitive half: non-statute `we:docs/agent/`

**Fork-existence justification:** case (b) — registering the whole tree and registering a router subset produce different scores for the same file, and a file cannot hold both.

- **(a) Register the whole `we:docs/agent/` tree.** Consistent and unforgettable. Escalates every prose touch-up in a large, frequently-edited directory, and every escalation parks a PR awaiting a review — the one place the over-escalation cost is not obviously cheap.
- **(b) Register a narrower predicate — the *router* files only (recommended default).** `we:AGENTS.md`, `we:CLAUDE.md`, and the named Tier-1 docs that route behaviour, not every reference under the tree. Keeps the volume cost off the tail while covering what actually re-routes a session.
- **(c) Leave `we:docs/agent/` unregistered beyond the existing statute patterns.** Status quo. Stated for completeness; it is the branch the recurrence record argues hardest against.

**Bold default: (b)** — the volume objection is real and specific to this tree, and a named router set answers it without giving up coverage of the files that actually change routing.

**Concrete shape.**

```js
const DOCS_AGENT_ROUTER_PATHS = [
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/agent\/index-[a-z-]+\.md$/,   // the Tier-1 sub-indexes AGENTS.md's own table links into (index-arch.md, index-std.md, …)
];
```

**Skeptic:** SURVIVES-WITH-AMENDMENT, and the amendment is the load-bearing one. As first drafted, "register a narrower predicate — the router files only" is itself a *named list* (`we:AGENTS.md`, `we:CLAUDE.md`, "the named Tier-1 docs that route behaviour") — the same enumeration shape Fork 1(a) is rejected for, so on its face it re-inherits the fail-open weakness this whole item exists to close: a brand-new router doc, added without anyone remembering to register it, scores nothing. Two things resolve rather than merely acknowledge this, verified against the real router (`we:AGENTS.md`): (1) `we:AGENTS.md` itself is in the recommended set, and `we:AGENTS.md`'s own body *is* the routing table — every Tier-1 doc it routes to appears as a row in the table at `we:AGENTS.md:49-67` (confirmed: `we:docs/agent/conventions.md`, `we:docs/agent/testing.md`, `we:docs/agent/architecture.md`, `we:docs/agent/backlog-workflow.md`, … are all linked there). Adding a new router doc is, in practice, never a bare new file — it is a new file *plus* the same-PR edit that adds its row to `we:AGENTS.md`'s table (an unlinked router doc is not yet functioning as a router). Because `we:AGENTS.md` is already a registered path, that same-PR edit trips escalation on its own, even before the new doc's own path is separately added to `DOCS_AGENT_ROUTER_PATHS` — closing the PR #1040-shaped gap for the *addition event* specifically, which is the case the recurrence record is actually worried about. (2) The residual that remains is narrower and should be named rather than hidden: a Tier-1 doc that is *renamed* or *split* without its `we:AGENTS.md` row being touched in the same diff would still slip through undetected until the next audit — worth a `we:scripts/lib/__tests__/review-escalation.test.mjs` case per #2939's Done-when ("a case for a surface that does not exist yet"), not a reason to change the default. No statute collision found beyond the one already resolved under Fork 1 (`#blast-radius-advisory-care-not-a-gate`, which applies identically here — escalating a docs/agent touch dials AI-panel rigor, it does not by itself park for a human). Citation-scope: the item's Fork 2(a) downside ("every escalation parks a PR awaiting a review") is accurate as written — `producerReviewLabel` sets `review:pending` on *any* `escalate`, human-required or not (`we:scripts/lib/review-escalation.mjs:658-662`), so the volume cost is a real, recurring reviewer/panel round-trip, not merely a hypothetical.

**Screen:** clear, after deliberately testing the "prioritization in fork costume" angle and rejecting it. (1) Same as Fork 1 — no standard-vs-impl boundary confusion; this is WE's own governance layer. (2) The harder case: with build/maintenance cost hypothetically zero, does the case for (b) over (a) evaporate? No — because the real cost this fork trades against is not build/maintenance effort but a *recurring operational* cost (each escalated PR consumes real reviewer/AI-panel attention at the moment it lands), which the "free to build, perfectly self-maintaining" counterfactual does not remove. Registering the whole tree at zero build cost still produces a materially higher escalation *volume* on every prose touch-up, a real ongoing outcome difference from registering the router subset — so the fork survives as a genuine coverage-vs-volume merit tradeoff, not a disguised effort question.

## A lint gap this item is on record about

The buried-fork lint (`findBuriedForkSections` in [`we:scripts/check-standards-rules.mjs`](scripts/check-standards-rules.mjs)) matches a **fixed phrase list**, `FORK_HEADING_TERMS` — `open design`, `open decision`, `open question`, `open fork`, `design tension`, and the `… to settle` forms. This fork originally lived inside #2939 under the heading *"The open call — enumerate wider, or invert to default-deny"*, which contains none of those phrases, so the lint did **not** fire on a `kind: task` item carrying a live unresolved fork with three options and a preferred candidate. Round 4 of PR #1048's review caught it by reading, not by gate. Widening the phrase list (or replacing it with a shape test — a section whose body is an option list with a bold default) is a real follow-up; it is deliberately **not** bundled into PR #1048, whose scope was frozen. Recorded here so the weakness is on the record rather than in a review transcript.

## Done when

- Both forks are ruled and the ruling codified (statute or `we:docs/agent/*.md`, per the resolve gate for a `kind: decision`).
- The ruling states, in one line, what happens to a surface **nobody has enumerated** — that sentence is the whole point of the call, and a ruling that only lists paths has not answered it.
- #2939 can then be built: its `blockedBy` edge to this item clears, and its Done-when bullets become mechanical.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

Care is `high` because the predicted touch-set includes `we:scripts/lib/review-policy.contract.json` (the declarative-leash contract — any diff there forces `review:human` on its own) alongside `we:scripts/lib/review-escalation.mjs` (registered gate-derivation code) and its test file — the same three paths already named in this item's own `scope:` frontmatter, which double as the buildable child's (#2939) predicted scope at carve-off.
