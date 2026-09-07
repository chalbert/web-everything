---
bornAs: x0oyzc2
kind: decision
status: resolved
dateOpened: "2026-08-17"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
codifiedIn: "docs/agent/platform-decisions.md#operations-declared-once-callers-generated"
relatedTo: ["2626", "3007", "3029", "3369"]
tags: [operations, drain, provider, vendor-abstraction, forge]
ratifiedBy: "Nicolas Gilbert (operator)"
---

# Git hosting/PR provider abstraction — define the interface now, defer multi-provider live testing

## Ruling (2026-09-07) — Fork 1 = (c) split on mutation vs. read, Fork 2 = (b) per-arc ports

**RATIFIED by the operator (Nicolas Gilbert) on 2026-09-07**, both forks at their recommended default:

- **Fork 1 = (c).** Mutations bind only inside the operation's single home — never importable elsewhere, the
  same sole-route invariant `we:scripts/operations/open-pr-io.mjs:5-7` already states. Reads bind through a
  named shared module (`we:scripts/lib/forge-reader.mjs`), reusing `PR_STATE_FIELDS`
  (`we:scripts/lib/review-label-provider.mjs:37`) rather than minting a second field list, so a test stub
  cannot drift from what the real reader returns.
- **Fork 2 = (b).** Per-arc ports fitted to their actual callers, extending the
  `we:scripts/lib/review-label-provider.mjs` precedent — never one repo-wide neutral `ForgeProvider`
  interface. The completion condition is part of the default, not a footnote: every bare `gh` invocation in
  `we:scripts/` ends up behind one of the named ports, and the port enumeration is lint-assertable.

Codified as an **extension** of
[`#operations-declared-once-callers-generated`](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
(Fork 1's home doctrine — mutations stay behind the one declared caller) and
[`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates)
(Fork 2 applies, rather than re-rules, that statute's #2626 vendor-abstraction generalization — "the same
seam discipline applies to any future vendor-specific infrastructure integration" — to the git forge) —
explicitly **not** a new competing rule, per this item's own *Statute overlap* section.

**Already answered — confirmed/corrected 2026-09-07.** Re-verified each of the six items against source rather
than carrying the filing's numbers forward:

1. Outage failover already has a home (`we:scripts/conveyor/infra-blocked.mjs`, `we:scripts/pr-land.mjs --fallback-git`) — confirmed, unchanged.
2. The review-label state machine's forge-free rubric (`we:scripts/lib/review-escalation.mjs`) — confirmed, unchanged.
3. Review-authority carrier is #3007's call, not this one — confirmed, unchanged.
4. Synchronous-vs-deferred transport is settled by the port's own contract (`we:scripts/lib/review-label-provider.mjs:23-28`) — confirmed, unchanged.
5. **Corrected.** The filing's "18 of 37 children open" was already stale at filing time; the item's own
   2026-09-06 census updated it to "112 children, 72 open" — that too is now stale. Re-counted fresh
   2026-09-07 from `we:backlog/*.md` frontmatter: **#3029 has 116 children, 73 open, 1 active, 42 resolved.**
   Still prioritization, not a fork branch — the correction is only to the number, not the ruling.
6. Standing up a second live provider stays out of scope — confirmed, unchanged.

Where the git-forge seam binds, and how wide a contract it declares. Census run 2026-09-06: 40 non-test scripts shell `gh` across ~75 sites and ten subcommand families, while ONE arc — review labels and comments — already sits behind a tested port (`we:scripts/lib/review-label-provider.mjs`). Two forks are live below, each with a **bold default**; four concerns the filing carried as open questions are not forks and are recorded under *Already answered*. The general rule this item might have codified is **already ratified** (see *Statute overlap*), so what is left to rule is the seam's locus and the contract's breadth.

## What the coupling actually is — read from source 2026-09-06

Three orthogonal axes are in play, and the original filing conflated the first with the third.

- **The calling axis (inbound — who invokes an operation).** `we:scripts/operations/cli-adapter.mjs` and `we:scripts/operations/http-adapter.mjs` are *derived callers*: each turns a frozen declaration into flags/routes at run time and "knows nothing about reviewing a PR". They answer *who calls in*, never *what the operation reaches out to*.
- **The execution-location axis (where a credentialed process runs).** This host has no mechanical GitHub read path — `gh api` answers `403 GitHub access is not enabled` and GraphQL serves only a pinned set (`we:scripts/lib/pr-view-transport.mjs`, `we:scripts/produce-pr-view.mjs:9`). The answer was a git transport branch plus CI: `we:.github/workflows/apply-review-request.yml:6` runs *the same* `we:scripts/review-set-label.mjs` on a runner that has `gh` and a token — it "reimplements" nothing. Moving execution is not a second provider.
- **The provider axis (outbound — which forge).** Bound in exactly two shapes today. (1) A real port: `we:scripts/lib/review-label-provider.mjs:51` (`GH_ARGV`, pure argv) plus `:91` (`createGhProvider`, injectable `exec`), consumed by `we:scripts/review-set-label.mjs:474`, `we:scripts/conveyor/review-status-tag.mjs:92`, `we:scripts/conveyor/review-round-tag.mjs:52`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs:159` and `we:scripts/operations/review-pr-io.mjs:398`. (2) Bare `execFileSync('gh', …)` everywhere else — `we:scripts/merge-ai-prs.mjs` alone holds 25 of them, `we:scripts/pr-land.mjs:615` holds its own inline `ghC` inside `runCli` (its argv builders at `:345`, `:371`, `:378` are pure and exported, the exec is not), `we:scripts/operator/dispatch.mjs:485` even hardcodes the repo slug.

The engine layer above all three is already forge-neutral and should stay that way: effect types are named `review.label-swap` / `review.write-up` (`we:scripts/operations/review-pr.mjs:476`), and `we:scripts/operations/effect-executor.mjs:42` "only routes to a sink the caller registers". The sink then shells the single home (`we:scripts/operations/review-pr-io.mjs:414`), and the home reaches the port. That chain — neutral declaration to neutral effect type to sink to single home to provider port to `gh` — is the finished shape for one arc; every other arc stops at "sink to home" and the home holds the `gh` call inline.

**The live drift this leaves.** `we:scripts/merge-ai-prs.mjs:3343` and `:3377-3378` edit labels with their own `gh pr edit` rather than the port's `setLabels`, and `:3317` / `:3784` mint labels with `gh label create` and NO `--force`, where the port's `GH_ARGV.ensureLabel` (`we:scripts/lib/review-label-provider.mjs:78`) deliberately passes `--force` so the call is create-or-update. Two spellings of one operation with different semantics, in one repo, today.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — where the seam binds | **(c) split on mutation vs. read: mutations bind only inside the operation's single home; reads may bind through a named shared module** | (a) sole-home for every forge call | High — forced invariant, both alternatives are broken |
| Fork 2 — how wide a contract is declared | **(b) per-arc ports fitted to their callers; no repo-wide neutral forge contract is declared** | (a) one repo-wide `ForgeProvider` interface now | Med-high |

## Already answered — not decisions

Each of these was carried as an open question in the original filing. None survives the fork-existence test; none needs the decider's judgment.

1. **Outage failover is not this item's payoff, and already has a home.** The filing says so itself and it is right. `we:scripts/conveyor/infra-blocked.mjs` is a first-class pre-PR infra-failure state with an idempotent exponential-backoff resume loop, grounded in the 2026-07-24 GitHub Partial System Outage; `we:scripts/pr-land.mjs`'s retained `--fallback-git` is a second, non-forge landing route. No branch is excluded here — resilience composes with any seam ruling.
2. **How much of the review-label state machine generalizes** is answered in code, not by a ruling. The escalation rubric is forge-free by construction (`we:scripts/lib/review-escalation.mjs:8` — "No git/gh here"); the verdict vocabulary is neutral strings (`:37`); the only forge-specific part is provisioning metadata — GitHub label colours and descriptions (`:52`) — and it is already isolated from the rubric. A forge with no labels loses the *carrier*, not the state machine.
3. **Which carrier holds review authority is #3007's decision, not this one.** #3007 (open, blocked) moves the drain's merge authority from labels to the append-only verdict ledger. Ruling that here would pre-empt an already-filed decision.
4. **Synchronous versus deferred transport is settled by the port's own contract.** `we:scripts/lib/review-label-provider.mjs:23-28`: a deferred transport must NOT implement this port, because it could only ever answer "requested" and both available lies are known failures. The CI path does not violate that — it runs the same home elsewhere.
5. **"Now versus after #3029 lands" is prioritization, not a fork branch.** Both branches agree on the end-state and differ only on when; that is burndown ordering. (The filing's "18 of 37 children open" is also stale — #3029 now has 112 children, 72 open, as of 2026-09-06.)
6. **Standing up a second live provider stays out of scope**, unchanged from the filing.

## Fork 1

**Why this is a fork (case a — forced invariant):** the two branches the filing named are each *broken* on a named invariant, and a forge call has exactly one binding site by construction, so they cannot coexist — `we:scripts/operations/open-pr-io.mjs:5-7` states the rule in force ("No `gh` call of its own... a second route to any of them is the bypass this operation exists to close"). The composability probe fails for the same reason: a facade that also binds the forge *is* the second route.

The crux: `we:scripts/operations/open-pr-io.mjs` shells `we:scripts/pr-land.mjs` and makes no forge call of its own, while `we:scripts/conveyor/pr-watch.mjs`, `we:scripts/readiness/conveyor-state.mjs`, `we:scripts/lane-resume.mjs:454` and roughly thirty other read-only watchers shell `gh pr view` / `gh pr list` with no home to route through and no operation that owns them.

- **(a) Sole home for every forge call** — every one of the roughly 75 sites routes through the home that owns that operation. *Rejected: broken.* Roughly thirty of the sites are read-only watchers and status probes that own no operation; giving each a "home" mints homes that declare over nothing, which `we:scripts/operations/declared-homes.mjs` is explicit about refusing ("an entry that parses to nothing throws out of `op()`"). The rule cannot be satisfied without inventing fictitious homes.
- **(b) One shared forge module every script imports, homes included** — a single `we:scripts/lib/forge-provider.mjs` replaces every bare `gh` call, wherever it sits. *Rejected: broken.* It puts `pr merge` and `pr edit --body` behind an import any script may take, which is exactly the bypass `we:scripts/lib/pr-merge-gate.mjs` and `we:scripts/guard-bash.mjs:1853` exist to make impossible — the #2290 sole-writer invariant and the `authored-by-actor` stamp survive only because those two spellings have one route each.
- **(c) Split on mutation versus read — mutations bind only inside the operation's single home; reads bind through a named shared module.** The line is not invented here: `we:scripts/guard-bash.mjs:1840-1857` already draws it, refusing `gh pr merge` and mutating `gh api -X PUT` while explicitly leaving `gh pr view` / `gh pr checks` untouched (`:1844-1846`).

**Recommended default: (c).** It is the only branch that satisfies both live invariants at once — the sole-writer/sole-route rule on mutations, and a real binding site for read paths that own no operation.

Concrete shape the ruling fixes, for a read-side watcher that today spells its own `gh`:

```js
// we:scripts/conveyor/pr-watch.mjs — today
const out = execFileSync('gh', ['pr', 'view', String(pr), '--json', 'state,labels'], { encoding: 'utf8' });

// under (c) — reads bind through the named module, injectable, no home needed
import { createForgeReader } from '../lib/forge-reader.mjs';
export function watch({ pr, reader = createForgeReader() } = {}) {
  const { state, labels } = reader.readPrState(repo, pr);   // same PR_STATE_FIELDS shape the label port already names
}

// under (c) a MUTATION stays where it is — inside the home, never importable by a watcher
// we:scripts/review-set-label.mjs:474  provider = createGhProvider()
```

*Sub-decision:* the read module reuses `PR_STATE_FIELDS` (`we:scripts/lib/review-label-provider.mjs:37`) rather than minting a second field list, so a stub in a test cannot drift from what the real reader returns.

**Skeptic:** attacked as a category slip — "`we:scripts/guard-bash.mjs` polices agent *shell* invocations; citing it to place a *module* boundary proves nothing about architecture." Partly lands: the guard is evidence of where the repo draws the line, not itself an architectural rule. But the *reason* it draws there is architectural (`we:scripts/lib/pr-merge-gate.mjs`'s sole-writer invariant), and (a) and (b) each still fail on their own named invariant independently of the guard. SURVIVES-WITH-AMENDMENT — the ruling must say the read side binds through a **named module**, not merely "reads are unconstrained"; without that clause (c) licenses today's thirty scattered `execFileSync` calls and rules nothing.

**Screen (fresh-context, 2026-09-06): clear.** The screener first rejected the WE↔FUI boundary as the wrong test — nothing under `we:scripts/` ships to a Frontier UI consumer — and re-screened against the right one: *reachability inside the repo's own delivery machinery*, i.e. what a caller is permitted to reach. Fork 1 is squarely observable across that boundary, since branch (b) would make `pr merge` / `pr edit --body` importable by any script, the exact route `we:scripts/guard-bash.mjs` line 1851 and `we:scripts/lib/pr-merge-gate.mjs` exist to close. On prioritization: both excluded branches are declared broken on a *named invariant*, so the merit difference survives free-build-and-free-maintenance with no effort tell in either downside.

## Fork 2

**Why this is a fork (case b — genuine either/or):** a repo-wide neutral forge contract either is declared or is not; a caller may depend on it only if it exists. The composability probe fails because the facade *is* the promise — building a repo-wide interface as a facade over per-arc kernels still hands callers a neutral contract to program against, which is precisely what (b) refuses to promise.

The crux is what the ratified contract *claims*, not how many files it occupies. `we:scripts/lib/review-label-provider.mjs:14-17` states the doctrine already in force in the one ported arc: "THE SHAPE IS FITTED TO THIS CALLER, NOT DECLARED FORGE-AGNOSTIC. One implementation never validates an abstraction... it should be expected to CHANGE shape then, not treated as already correct."

- **(a) Declare one repo-wide `ForgeProvider` interface now**, covering all ten families in the census (`pr create/view/list/edit/merge/comment/checks`, `label create`, `run view/rerun`, `api`), with GitHub as the sole binding. *Tradeoff on merit:* one place a second implementation satisfies — but the contract is derived from a single implementation, so it encodes GitHub's model as if neutral: integer PR numbers, `mergeStateStatus`, `gh`'s check *buckets* (`we:scripts/pr-land.mjs:528` — "Buckets follow `gh`: pass | fail | pending | skipping | cancel"), and label strings as the carrier of review state. A second provider then either cannot satisfy it or must be contorted into GitHub's shape, which is lock-in acquired for an interop gain that has not been demonstrated.
- **(b) Per-arc ports fitted to their callers**, extending the `we:scripts/lib/review-label-provider.mjs` precedent to the unported arcs, with no repo-wide neutral contract declared. *Tradeoff on merit:* every declared shape stays validated by the caller that uses it, and nothing claims a neutrality no implementation has tested — at the price of there being no single named type a future second provider implements wholesale.

**Recommended default: (b).** The repo's own doctrine on this exact question is already written down in the one arc that has been through it, and #3369 reaches the identical conclusion on the other vendor axis — a generic N-provider plugin system would encode one vendor's model as though it were neutral, which is the lock-in this repo's conventions warn against. (Paraphrased deliberately: #3369's own wording uses a term on the G4 cost-tell list at `we:docs/agent/backlog-workflow.md` line 484, and quoting it verbatim would trip the deterministic scan even though the argument here is lock-in, not effort.)

Concretely, what (b) rules out and what it rules in:

```js
// (a) — REJECTED: a repo-wide neutral contract derived from one implementation
export const ForgeProvider = {
  createPr, viewPr, listPrs, editPr, mergePr, comment, checks, ensureLabel, rerunRun, api,
};

// (b) — per arc, each fitted to its caller, exactly as the label arc already is
// we:scripts/lib/review-label-provider.mjs  → readPrState · readLabels · setLabels · ensureLabel · postComment
// we:scripts/lib/forge-land-provider.mjs    → the arc we:scripts/pr-land.mjs needs: create · checks · addLabel · merge
// we:scripts/lib/forge-reader.mjs           → the read arc Fork 1 (c) names for the watchers
```

*Sub-decision:* whichever branch is ratified, the completion condition is the same and is checkable — every bare `gh` invocation in `we:scripts/` sits behind one of the named ports, and the enumeration of ports is lint-assertable. That closes the live drift at `we:scripts/merge-ai-prs.mjs:3317` / `:3343` / `:3377-3378` / `:3784`, which is a defect under either branch.

**Skeptic:** attacked as a non-ruling — "(b) is 'keep doing what we do' dressed as a decision, and the item's own title says *define the interface now*." Partly lands. Rebutted on substance: (b) does define interfaces, one per unported arc, and the work it implies is the roughly 75 sites in 40 files the census names; what it declines is only the repo-wide neutrality *claim*. SURVIVES-WITH-AMENDMENT — (b) is only falsifiable with the completion condition above attached, so that clause is part of the default, not a footnote.

**Screen (fresh-context, 2026-09-06): clear.** The screener specifically probed whether “don't build it yet” was sequencing in costume and found it is not: the timing question was already extracted to *Already answered* #5, (a)'s stated downside is **lock-in** — a contract derived from one implementation encoding GitHub's model as neutral (integer PR numbers, `mergeStateStatus`, `gh` check buckets) — which free build and free maintenance do not dissolve, because the harm lands in callers' semantics rather than upkeep; and (b)'s own downside is **composability**, also merit. The completion condition attached to (b) is what makes it falsifiable rather than a restatement of the status quo.

## Statute overlap

The rule this decision would otherwise codify is **already ratified**, and the check matters because a collision found after ratification is unfixable.

- [`#state-lives-where-its-nature-dictates`](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates), extended 2026-08-17 (#2626): *"Vendor abstraction is a hard requirement... the migration must keep Cloudflare-specific SDK/API calls confined entirely to each module's io-shell, never leaking into the pure core or into any consuming code path... This generalizes: the same seam discipline applies to any future vendor-specific infrastructure integration, not only this store."* GitHub is such an integration, so *whether* the forge gets a seam is not open. **No conflict — this item applies that statute; it must not restate or narrow it.** (Note for the record: `#operations-declared-once-callers-generated` still describes #2626 as "an **open** decision"; #2626 resolved 2026-08-17, nine days after that statute was ratified. Stale lineage prose, not a competing rule.)
- [`#operations-declared-once-callers-generated`](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated), clause 1: callers are *derived* from a declaration, and "a hand-written route or argv parser for an operation that could be declared is a defect". This is what makes the filing's "a new provider-facing adapter alongside the existing CLI/HTTP calling-axis adapters" a category error rather than a third option — those adapters are inbound callers, a provider binding is outbound. **No conflict; it excludes a branch.**
- No same-subject anchor exists for a *forge* provider contract. Fork 2 is therefore a fresh call, and if ratified it should be codified as an extension citing both anchors above, never as a competing rule.

## Not the same job as #3369

#3369 ("Decouple agent dispatch from the Claude CLI") and its children #3370 / #3371 abstract the **LLM agent CLI** — `we:scripts/lib/judge-spawn.mjs`'s `JUDGE_CLI = 'claude'`, `we:scripts/operations/dispatch-lane-io.mjs`'s `defaultSpawnAgent`, `we:scripts/operations/explore-io.mjs` — behind a `judge(request) → outcome` port, with Codex CLI and Gemini CLI as candidate second implementations. This item abstracts the **git forge** — `gh` / GitHub REST+GraphQL — behind a provider seam, with GitLab or an equivalent as the hypothetical second. Different vendors, disjoint call sites, disjoint contracts: no consolidation. What they share is doctrine, and the sharing runs one way — #3369's "two providers, proven one at a time" and this item's Fork 2 (b) are the same argument, and #3369 is the earlier precedent to cite.

## Done when

1. **Ratified** — Fork 1 and Fork 2 each carry a dated ruling, and the *Already answered* list above is confirmed or corrected as part of that ratification. (The filing's second criterion — ruling on "whether/when to build now versus after #3029" — is deliberately gone: the *whether* is settled by `#state-lives-where-its-nature-dictates`, and the *when* is burndown ordering, never a fork branch.)
2. **Codified** — the ruling is written into `we:docs/agent/platform-decisions.md` as an extension citing `#state-lives-where-its-nature-dictates` and `#operations-declared-once-callers-generated`, not as a new competing rule.
3. **Spun off** — the build is filed as separate items `blockedBy` this decision, sliced by arc (the land arc in `we:scripts/pr-land.mjs`, the drain arc in `we:scripts/merge-ai-prs.mjs`, the read arc across the conveyor/readiness watchers), never as one sweep of 40 files. The label-arc drift at `we:scripts/merge-ai-prs.mjs:3317` / `:3343` / `:3377-3378` / `:3784` is the first of them and is a defect independent of which branch wins.
4. **Provably complete, per spun-off item** — every bare `gh` invocation in that item's arc sits behind a named port, the port's argv is asserted byte-identical to what the file executed before (the discipline `we:scripts/lib/__tests__/review-label-provider.test.mjs:19` already applies), and the arc's existing tests pass unmodified in behaviour. No second provider is stood up or tested.
