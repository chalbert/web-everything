---
kind: decision
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#pr-flow-rollout-mechanism"
preparedDate: "2026-07-02"
relatedTo: ["1143", "2123", "2148", "2149", "2151", "2152", "2153"]
relatedReport: reports/2026-07-02-deferred-merge-queue-substrate.md
tags: [lane, merge-queue, integrator, pr-flow, session-hygiene, decision]
---

# Should lane landing move to a deferred merge queue drained by a unified merge command?

## Ruling — ratified 2026-07-02

**All five fork defaults ratified as authored**, including the two skeptic-corrected forms that flip the raw user direction (Forks 3 and 5) — re-affirmed with the line-additive-but-breaking false-positive class and the branch-level-native-queue holes in full view. The top-level (defer landing to a human-drained unified merge queue) stands.

- **Fork 1 — #1996 relation:** (a) compatible refinement + a rider that **quotes & neutralizes "on gate-green"** (binds merge *authority* + green *precondition*, not the trigger *instant*; drain cadence is a separate dimension, default deferred-batch).
- **Fork 2 — lane metadata:** (a) standalone `we:.lane-manifest.json` in the WE lane commit (one-sided add, preserves the #1869 conflict-free WE-lane merge); the drain deletes it at landing.
- **Fork 3 — merge-risk lock lifetime:** (a) serial-replay is **primary**; (c) expand/contract micro-slice is an **opt-in optimization over a whitelist of provably-safe additive regions only**, cherry-picked **verbatim** (byte-identical re-add). A `we:package.json` **dependency add / version bump**, an `"overrides"` block, or an ordering-sensitive registration is **NOT whitelisted** → serial-replay. Sub-fork A: the **drain** authors the split. Codified as an explicit amendment to [#merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md).
- **Fork 4 — ready-to-merge state:** (a) a **local** queued token written at push (`we:claims.json`-adjacent, read offline — preserves Rule #105); `lane/*` refs deleted at a **single point** after the whole couple's WE resolve is confirmed reachable on `main`.
- **Fork 5 — merge substrate:** (b) PRs as the review/CI surface (self-approved, 0 required reviewers + a required CI check); **GitHub native merge queue OFF**; the **custom drain owns every merge** in impl-first/WE-last couple-order. Pure local `git merge` (a) is the retained fallback if the `gh` dependency isn't worth it.

**Codified in:** a rider under [#pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md) (top-level + Forks 1/2/4/5) + an amendment to [#merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md) (Fork 3). Implementation arm: #2148, #2149, #2151, #2152, #2153.

**Live concurrent example (2026-07-02):** a parallel session adding the `wrangler` devDependency to `we:package.json` (+ `we:package-lock.json` churn) is the canonical **non-whitelisted** Fork-3 case — a dependency add is line-additive but semantically load-bearing, so it lands by serial-replay, never micro-slice. It attaches to this ruling as an illustration; it is **not** folded into this decision's changeset.

Today lanes land on main **live, inside the producing run** — correct within one run, but two concurrent runs race on the shared primary checkout, and every session babysits a 20–70 min integration. Proposal (**user direction, 2026-07-02**): **every lane-producing session stops at "lane pushed + item marked ready-to-merge"** — parallel `/workflow` and solo lanes (#2123) alike — and landing moves to a **unified merge command** the human launches as ready items accumulate, draining the queue serially under the existing integrator contract (full gate per merge, rebase-and-retry, impl-repos-first/WE-last).

**Which layer:** agent-workflow / session-tooling — nothing crosses the WE↔FUI standard boundary or touches a registry. Codifies as a rider under [we:docs/agent/platform-decisions.md#pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md) — **and, for Fork 3, as an explicit amendment to [#merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md) (that anchor governs the ③-stays-locked turf Fork 3 touches — skeptic-surfaced).**

> **Prep note — two skeptic REFUTATIONS flip user-directed defaults on correctness.** The prep skeptic refuted the stated form of **Fork 3 (c) expand/contract as *primary*** and **Fork 5 (b) native-queue hybrid** — both directions the user pointed at 2026-07-02. Neither idea is dead: (c) survives as a *whitelisted opt-in optimization* and PRs survive as the *review/CI surface*. But the raw forms had concrete correctness holes (a line-additive-but-semantically-breaking classifier; GitHub's branch-level native queue grabbing couples' WE-half PRs out of impl-first/WE-last order). The defaults below are flipped to the corrected forms; the decision turn can re-affirm the raw direction with eyes open — see each `Skeptic:` line.

## Grounding digest

- **The integrator half already exists and is proven — it just lives *in-run*.** [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js) merges one lane at a time, full gate per merge (#1937), rebase-retry on conflict, `INTEGRATION_ORDER = ['frontierui', 'plateau-app', 'we']` (impl-first / WE-last so a failed impl never leaves a false "resolved" — [we:parallel-execute.workflow.js:146](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L146)), deletes the remote ref only after that repo's merge lands ([we:parallel-execute.workflow.js:69](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L69)), asserts the `resolveCommit` is reachable before trusting `resolved` ([we:parallel-execute.workflow.js:275](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L275)), regenerates derived once. 16/18 landed green 2026-07-01. The decision **relocates** this pipeline out of the producing run; it does not design a new one.
- **The merge-risk lock layer** is [we:scripts/readiness/file-locks.mjs](../scripts/readiness/file-locks.mjs) — an atomic lock-dir with a **15-min heartbeat-lease TTL** (`DEFAULT_LEASE_MINUTES = 15`, [we:file-locks.mjs:47](../scripts/readiness/file-locks.mjs#L47)) — gating the `RESERVED_MERGE_RISK` denylist in [we:scripts/readiness/lane-partition.mjs](../scripts/readiness/lane-partition.mjs#L42). The denylist exists because "two disjoint-line edits to a monolithic registry JSON merge CLEANLY yet can be semantically wrong" ([we:lane-partition.mjs:14](../scripts/readiness/lane-partition.mjs#L14)). Build config (`we:package.json`, `we:.eleventy.js`, `we:vite.config.mts`) is **currently NOT on the denylist** — it merges optimistically ([we:lane-partition.mjs:33](../scripts/readiness/lane-partition.mjs#L33)); #2149 proposes adding the two irreducible monoliths.
- **`active→resolved` flip rides the WE lane commit** and lands only when that lane merges (workflow header [we:parallel-execute.workflow.js:64](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L64)), and that merge is conflict-free *because* it is a **one-sided change** off `lane/_base`. So while an item sits *queued*, on `main` it is still `active` — and anything the queued state adds to the WE commit must preserve that one-sided property.
- **Claim is deliberately local-and-offline** ([we:backlog.mjs:128-145](../scripts/backlog.mjs#L128)) — "claim never inspects the tree", per **Rule #105 (Claim Ignores Git State — ownership = `status:active`, not the working tree)**. Fork 4's queued-signal must not break that.
- **Prior art** (report [we:reports/2026-07-02-deferred-merge-queue-substrate.md](../reports/2026-07-02-deferred-merge-queue-substrate.md)): GitHub's native merge queue is **per-repo AND branch-level** (governs *all* PRs to a branch — no per-PR opt-out); author self-merge at 0 required reviewers is fully supported; gate-on-merged-tree is the settled correctness floor (NRSR / bors / Zuul); **cross-repo atomic landing *is* solved off-the-shelf** (Aviator ChangeSets, Zuul `Depends-On:`) but only as external SaaS/CI, not `gh`; ParallelChange authorizes an additive hunk landing ahead of consumers **when a human judged it additive** — it does not authorize a mechanical line-diff as the additive classifier.

## Axis-framing

The top-level "queue vs keep-landing-in-run" is **settled by user direction** and already red-teamed against its alternatives in "Why" below — the two rejected branches (an **integrator merge lock**, coarse; a **per-run integration clone**, keeps landing in-run) both keep landing *inside* runs, the exact property the queue removes. So the live decisions are the **five sub-mechanics** the relocation forces. They split by kind: Fork 1 is a **statute-reconciliation** (how the deferral composes with #1996's "auto-merge on gate-green" clause — [we:platform-decisions.md:2331](../docs/agent/platform-decisions.md#L2331)); Forks 2, 3, 5 are **code-shape / merit** forks; Fork 4 is a **representation** fork (how "queued" is encoded so claim/reopen/closeout don't misread it — under the #105 local-ownership constraint). The correctness floor is fixed and off-limits to every fork: the drain **must run the full gate on the merged tree per merge** ([#gate-on-merged-tree-lane-fast-fail](../docs/agent/platform-decisions.md)) — and, the skeptic added, that gate must run in **one environment**, not split CI-vs-local (Fork 5).

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Relation to #1996 "auto-merge on gate-green" | **Compatible refinement + a rider that quotes & neutralizes "on gate-green"** (fixes merge authority + green-precondition, not trigger instant) | Amend the clause text wholesale |
| 2 | Durable lane metadata encoding | **Standalone `we:.lane-manifest.json` in the WE lane commit; drain deletes it at landing** | Ref-name convention; **or** a fenced block in `we:backlog/NNN.md` (breaks #1869 one-sided merge) |
| 3 | Merge-risk lock lifetime | **(a) serial-replay is primary; (c) expand/contract only over a whitelist of provably-safe additive regions** (⚠ flips user direction toward raw-(c) on correctness) | (c) as a general line-diff classifier (REFUTED); (b) hold-lock |
| 4 | Ready-to-merge state representation | **Local queued token written at push (`we:claims.json`-adjacent, read offline) + single ref-deletion after whole-couple resolve confirmed** | Pure remote `ls-remote` derivation (TOCTOU + breaks #105); `status: queued` main-write |
| 5 | Merge substrate | **PRs as the review/CI surface; the custom drain owns *every* merge in couple-order (native queue OFF)** (⚠ flips user direction toward native-queue on correctness) | Native queue managing WE `main` (REFUTED — branch-level, breaks ordering); (a) pure local `git merge` (coherent fallback) |

## Why (queue over the in-run alternatives — the settled top-level)

- **Kills the multi-run race structurally.** The pre-claim (`status:active` + we:claims.json), the central write-time lock dir, and slug-named `lane/*` refs already compose across runs; the shared primary checkout during integrate/serial/regen does not. A merge queue removes it: producers never touch main, one drain command owns landing.
- **Converges every landing path.** `/workflow`, solo-session lanes (#2123), and the gated-PR direction all land through one door — main becomes convergence-only for automation.
- **Decouples sessions from landing.** A session ends at lane-push; no in-run liveness heartbeat for the integration half.
- **The card is enough context for the merging session.** The integrator's surviving-conflict fallback is *already* serial-replay from the item card, and the **full gate per merge is the landing authority** ([pr-flow-rollout-mechanism](../docs/agent/platform-decisions.md)), not the merger's understanding. Live-merging's one genuine edge is freshness; the human controls that by draining often.

---

## Fork 1 — Relation to the #1996 "landing is fully automatic" call

**Fork exists because** the two branches produce *contradictory statute*: either #1996's "**auto-merge on gate-green, no manual merge, no mandatory human review**" clause ([we:platform-decisions.md:2331](../docs/agent/platform-decisions.md#L2331)) is *amended* (the human-launched drain re-inserts a human trigger into a clause that says "no manual merge"), or it is *refined* (the clause governs the merge decision + precondition, not its scheduling). Both are coherent; they cannot both be codified. (The #2123 rider already pre-authorized #2138 to own this overlap — [we:platform-decisions.md:2384](../docs/agent/platform-decisions.md#L2384).)

- **(a) Compatible refinement + a targeted rider (default).** "auto-merge on gate-green" fixes the merge **authority** (the gate decides, no per-item human review, no hand-resolved merge) and its **precondition** (green) — but not the **trigger instant**. **When** the (still fully-automatic) merge fires — immediately at green vs when a human drains the accumulated queue — is a *cadence* dimension the clause's *authoring intent* never addressed (its own follow-on rationale is about review: "per-item human review is opt-in but never required"). Codify a rider that **explicitly quotes and neutralizes the "on gate-green" phrasing**: "'on gate-green' binds the merge authority + green-precondition, not the trigger instant; drain cadence (inline / deferred-batch / later scheduled) is a separate dimension, default deferred-batch." Prior art: GitLab merge trains / bors batches decouple "ready" from "merged" via a separate drainer and are still called automatic.
- **(b) Amendment.** Rewrite the "fully automatic" bullet to "automatic *once drained*." Heavier, and mis-describes the mechanism — nothing about the *merge* became manual.

**Skeptic:** SURVIVES-WITH-AMENDMENT — the literal "auto-merge **on gate-green**" is a *timing* binding the bare default reads out; a future reader citing the untouched bullet finds a contradiction. Fix folded into (a): the rider must **quote and neutralize "on gate-green"** (authority + precondition, not trigger instant), not merely assert "the clause never spoke to cadence." Statute-overlap: reconcilable by the rider (no collision left unresolved). Citation-scope: #1996's clause was authored about the *review-gate* question, so its scope does not reach cadence — supports (a).
**Screen:** clear — real merit (the two branches produce different *governing statute*, changing whether a future inline-drain violates the rule); tooling-side, no WE↔FUI boundary crossed.

## Fork 2 — Durable lane metadata

**Fork exists because** the deferred drain needs *one* source of truth for each item's cross-repo shape — which repos' `lane/*` refs form the item, the impl-first/WE-last order ([we:parallel-execute.workflow.js:146](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L146)), and `blockedBy` edges **between queued items** ([we:parallel-execute.workflow.js:410](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L410)) — and today that lives **only in the orchestrator's memory** (the in-run `crossRepoRefs` array, [we:parallel-execute.workflow.js:273](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L273)), which evaporates when the producing session ends. The manifest is a **superset** of the in-run array (it must also carry cross-*item*, cross-*session* `blockedBy` the run-scoped array never held). Two encodings can carry it; mutually exclusive as *the* authority.

- **(a) Standalone `we:.lane-manifest.json` committed in the WE lane commit (default).** A **new file** (never a fenced block inside `we:backlog/NNN.md`), so it is a **one-sided add** that preserves the #1869 conflict-free WE-lane merge ([we:parallel-execute.workflow.js:64](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L64)) and does **not** pollute the resolve diff the human reviews. Git-durable, survives session end, rich enough for structured order + cross-item `blockedBy`. **The drain deletes the manifest as part of landing** (co-located with the `lane/*` ref deletion at [we:parallel-execute.workflow.js:69](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L69)) so `main` carries no post-drain queue cruft.
- **(b) Ref-name convention.** Encode the shape in the `lane/*` ref name. Cheap, but a ref name **cannot carry structured cross-item `blockedBy` edges or a multi-repo ordered list** without becoming an unparseable sigil, and can't be diffed/reviewed. Refuted on expressivity.

Manifest shape for the default:

```jsonc
// we:.lane-manifest.json — a NEW file in the WE lane commit (one-sided add; drain deletes it at landing)
{
  "item": 2138,
  "batchSlug": "batch-2026-07-02-wf",
  "repos": [                         // integrator merges in this order: impl-first, WE last
    { "repo": "frontierui", "ref": "lane/2138-fui-o2" },
    { "repo": "we",         "ref": "lane/2138-we-o2", "carriesResolve": true }
  ],
  "blockedBy": [2151],               // cross-ITEM edge: do not drain until #2151 has landed
  "mergeRiskFiles": ["we:package.json"]  // for Fork 3's whitelisted additive-region check
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the original "*or a fenced block in we:backlog/NNN.md*" alternative breaks the #1869 one-sided-merge property and pollutes the resolve diff, and a committed manifest becomes dead cruft on `main` post-drain. Fixes folded: pin to a **standalone `we:.lane-manifest.json`** (never in the item file); **drain deletes it at landing**; note it is a **superset** of the run-scoped `crossRepoRefs`, not a verbatim persist.
**Screen:** clear — where merge-order metadata lives is tooling-internal; (b) is provably less expressive, a real correctness/expressivity difference, not effort.

## Fork 3 — Merge-risk lock lifetime under deferred landing

**Fork exists because** deferred landing *reopens a closed hazard*: today write-time locks ([we:scripts/readiness/file-locks.mjs](../scripts/readiness/file-locks.mjs)) release when the producing session ends (at push). If a lane releases at push but sits queued, a later lane can edit the same denylist file against a `main` that **doesn't yet contain the queued change** — the clean-but-wrong structured-merge window ([we:lane-partition.mjs:14](../scripts/readiness/lane-partition.mjs#L14)) reopens between push and drain. The candidates cannot coexist as *the* primary strategy — (a) serializes, (b) holds the lock across the whole queue wait, (c) shrinks the lock-hold window to the non-additive remainder.

- **(a) Drain detects denylist overlap among queued lanes → serial-replay the second (default — primary).** This is exactly what [#merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md) already ratifies for ③-irreducible files (build config is ③: "stays locked"), and the per-merge gate enforces it anyway. Correct and statute-aligned; costs concurrency only on the shared file.
- **(b) Hold locks until merged (lease/TTL).** The 15-min `DEFAULT_LEASE_MINUTES` ([we:file-locks.mjs:47](../scripts/readiness/file-locks.mjs#L47)) reclaims a dead owner, but a queued item may wait *hours* for a human drain — far past any sane lease — so the lock either expires (reopening the hazard) or grows unbounded (a dead session wedges the file). Poor fit for human-paced draining.
- **(c) Expand/contract early additive micro-merge — *opt-in, over a whitelist of provably-safe additive regions only* (user direction 2026-07-02, guard-railed).** When a lane's denylist-file delta is a **whitelisted safe-additive region** — *appending a new `we:package.json` script key*, *a new per-entry registration line in `we:.eleventy.js`* — extract it as an **early ready-to-merge micro-slice** the drain lands eagerly and out-of-order (the [ParallelChange](https://martinfowler.com/bliki/ParallelChange.html) *expand* phase), releasing the lock before the bulk lane finishes. **Not** a general line-diff classifier: a change may be *line-additive yet semantically breaking* (a `dependencies` version bump, an `"overrides"` block, a side-effectful/ordering-sensitive registration) — those are **not** whitelisted and fall back to (a). Composes with the denylist-shrinking track: **#2148** removes the FUI directive barrels from the denylist entirely (best — no lock needed), **#2149** declares the irreducible residual (`we:package.json`, `we:.eleventy.js`) — the whitelisted append-cases within those are where (c) pays off.

### Fork 3 sub-fork A — who authors the micro-slice split

**Fork exists because** the split must be authored *somewhere* and the two loci exclude each other (double-authoring = two conflicting micro-slices).

- **(a) The drain detects a whitelisted safe-additive region and extracts it (default).** The drain already reads the manifest's `mergeRiskFiles` (Fork 2) and holds the merged-tree gate; matching a hunk against the *whitelist of safe regions* is a mechanical check it can own, keeping the producing agent's contract unchanged and centralizing the policy (matching how the integrator centralizes all shared-registry effects) — no N-implementer drift.
- **(b) The producing agent splits at push time.** Knows its own intent, but fans the policy out to every lane and can't see sibling lanes' overlapping deltas — the drain can.

**Correctness obligation for Fork 3 (c)** *(demoted from a "sub-fork" — the two-confusion screen flagged it as a lone forced requirement, not a decision with a competing branch)*: the micro-slice hunk MUST be extracted **verbatim** (`git cherry-pick` the exact hunk, never re-authored) so the second apply — when the bulk lane rebases onto post-drain `main` ([we:parallel-execute.workflow.js:66](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L66)) — is a **byte-identical no-op** (git treats an identical addition from a common base as non-conflicting). A reformat between applies (e.g. prettier re-run) would break byte-identity → a real conflict. The per-merge gate is the *safety net* if this is botched, **not** the correctness argument.

Micro-slice extraction shape (default, keyed to the real denylist + lock CLI):

```jsonc
// drain, per queued item, before the bulk merge (Fork 3c default, guard-railed):
// 1. for each mergeRiskFiles entry, match the lane hunk against the WHITELIST of safe-additive regions
//    (append-a-new-npm-script-key | new-per-entry-registration-line) — NOT a general "+ lines only" test
// 2. whitelisted → git cherry-pick the hunk VERBATIM as lane/<item>-micro, gate, land it, release the lock
//    (node scripts/readiness/file-locks-cli.mjs release we:package.json)
// 3. NOT whitelisted (dep bump | overrides | ordering-sensitive registration) → fall back to Fork 3 (a)
// 4. drain the bulk lane later; the verbatim re-add is a byte-identical no-op, re-gated on merge
```

**Skeptic:** **REFUTED as primary** (as a general classifier) → **default flipped to (a) serial-replay; (c) demoted to a whitelisted opt-in optimization.** Strongest attack: a mechanical additive-classifier has a *line-additive-but-semantically-breaking* false-positive class (dependency bumps, `overrides`, side-effectful registrations) on **exactly the ③ files (c) targets**; the micro-slice gates green *in isolation* and lands, so the breakage surfaces at a *sibling's* later merge — meaning (c) degrades to (a) *after* a wasted round-trip rather than before, and never delivers the promised parallelism for the dangerous cases. Statute-overlap: (c) as stated **amends [#merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md)'s "③ stays locked" rule by a *different* test** (retro-compatibility, not reducibility) — so it must be codified against *that* anchor, not only as a rider under #pr-flow. Citation-scope: ParallelChange authorizes additive-lands-ahead **when a human judged it additive**, not a mechanical line-diff. ⚠ **This flips the raw user direction (toward (c)-as-primary)** — the decision turn may re-affirm (c), but should see the false-positive class and the #1935 amendment first. Sub-fork A: SURVIVES-WITH-AMENDMENT — drain-authored, but over the *whitelist*, not a general classifier.
**Screen:** parent clear (three genuinely different race/parallelism strategies); sub-fork A clear; **sub-fork B demoted** (screen flag `prio` — a single forced correctness requirement with no competing branch, now the acceptance-criterion above).

## Fork 4 — A real ready-to-merge state

**Fork exists because** the forced invariant — *a queued item must not be re-claimable or read as abandoned by reopen/closeout* — needs a **representation**, and the encodings exclude each other. The invariant itself is forced; the fork is *where the signal lives* — under the **#105 constraint that claim ignores git state and stays local/offline** ([we:backlog.mjs:128-145](../scripts/backlog.mjs#L128)). While queued the item is still `active` **on `main`** ([we:parallel-execute.workflow.js:64](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L64)), so a naive `status`-read sees `active` and would re-offer it.

- **(a) Local queued token written at push (default).** The producing session, at lane-push, writes a **local** queued marker adjacent to `we:claims.json` (the same central-state home claim already reads, [we:backlog.mjs:41](../scripts/backlog.mjs#L41)); claim/reopen/closeout read it **offline** and treat a queued item as unclaimable. No new commit-to-main during the queued window, and — crucially — **no network `ls-remote` on the ownership hot path**, so Rule #105's "claim ignores git state, stays local" property is preserved. Paired with the drain deleting `lane/*` refs **only after the whole couple's WE resolve is confirmed reachable on `main`** ([resolveCommit reachability, we:parallel-execute.workflow.js:275](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L275)) — a single deletion point that closes the re-offer window.
- **(a′) Pure remote-ref derivation** (`git ls-remote origin 'lane/<num>-*'`). Rejected: (i) a **TOCTOU re-offer window** — for a cross-repo couple the drain deletes the impl ref before the WE resolve is visible on `main`, so a concurrent claim can see `active` + fewer/zero refs = claimable while the item is actually landing; (ii) it puts a **network round-trip on the claim path**, contradicting #105's local-and-offline claim (a remote hiccup forces fail-open → wrong re-offer, or fail-closed → wedge).
- **(b) `status: queued` committed to main at push.** Reads distinctly on the board like `preparing` (#375), and claim/reopen already branch on `status`. But it **reintroduces a producer→main write** during the queued window — the very thing the deferral removes. Buys board-visibility at that cost.

Queued-guard predicate for the default (local, offline — preserves #105):

```js
// in the claim / reopen / closeout path: a LOCAL queued token (not the tree, not the remote) gates ownership
async function isQueued(item) {
  if (item.status !== 'active') return false;
  const queued = readQueuedSet();          // we:claims.json-adjacent local file the producing session wrote at push
  return queued.has(item.num);             // offline; no ls-remote, no working-tree read (Rule #105)
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the original ref-existence derivation opens a **TOCTOU re-offer window** during cross-repo drain (ref deleted before the status flip is visible) and puts a **network `ls-remote` on the ownership path, contradicting Rule #105** ("claim ignores git state"). Fixes folded: derive from a **local queued token** written at push (offline read), and delete refs at a **single point after the whole couple's resolve is confirmed reachable**. This pulls the default toward a durable *local* signal without a second main-write.
**Screen:** clear — the invariant is forced but *where the signal lives* is a live representation fork with a real correctness-vs-observability tradeoff; tooling-side (the `status` field is backlog-item data, not a WE registry).

## Fork 5 — Merge substrate: local `git merge` vs self-approved PR / GitHub merge queue

**Fork exists because** the drain's landing step converges through *one* substrate and the two are mutually exclusive at the transport layer (a lane lands via `git push origin main` **or** via `gh pr merge`). This is the arm #2151 (CI-on-PR), #2152 (branch protection), #2153 (PR drain) build out. **User direction 2026-07-02** points at exploring the PR/(b) substrate.

- **(b) PRs as the review/CI surface; the custom drain owns *every* merge in couple-order (default — the corrected hybrid).** Each ready lane opens a self-approved PR (`gh pr create`, **no external reviewer** — 0 required approvals + a required CI check, #2152), giving a native diff/review surface per lane (a home for the `multiLaneFiles` eyeball) and a GitHub-native status-check gate (#2151). But **the GitHub *native merge queue* stays OFF**, and the **custom drain does the actual merge** via `gh pr merge` in impl-first/WE-last couple-order. This keeps **one gate environment** and **preserves the cross-repo ordering the native queue cannot**. (If the native queue is ever wanted for throughput, couples' WE-half PRs route through a **drain-controlled staging branch** so WE `main`'s queue never sees an out-of-order couple PR.) Ground state (verified 2026-07-02, #2152): `gh` authed as `chalbert`, `main` has no branch protection — a clean slate.
- **(a) Pure local `git merge` (coherent fallback).** The drain does `git merge origin/main` in a clone, gates the merged tree, `git push origin main`; the `lane/*` ref is the queue token. No GitHub dependency, trivially preserves ordering + single-gate — but no native diff/review surface. **More coherent than the *refuted* native-queue hybrid**, so it is the fallback if the PR surface isn't worth the `gh` dependency.
- **(a″) Native merge queue manages WE `main`** (the originally-stated hybrid). **Rejected:** GitHub's native queue is a **branch-level** setting — enabling it for solo WE lanes **also governs couples' WE-half PRs**, which its FIFO would land *out of* impl-first/WE-last order ([INTEGRATION_ORDER, we:parallel-execute.workflow.js:146](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L146)); and it splits the gate into two non-identical environments (GitHub CI for solo, local drain for couples) that must stay bit-identical.

*Prior-art caveat (research-surfaced):* cross-repo *atomic/ordered* landing **is** solved off-the-shelf — [Aviator ChangeSets](https://docs.aviator.co/mergequeue/concepts/changesets), [Zuul `Depends-On:`](https://zuul-ci.org/docs/zuul/latest/gating.html) — but only as external SaaS/CI, not `gh`. Adopting one is a real alternative, **rejected on lock-in + on already-owning a proven custom integrator**.

Substrate contrast (both keyed to the real drain step):

```bash
# (a) pure local git merge — the queue token is the lane ref (coherent fallback)
git -C "$clone" merge --no-ff "origin/lane/2138-we-o2"
npm run check:standards && npm test        # full gate on the MERGED tree (#1937), ONE environment
git -C "$clone" push origin main
git push origin :lane/2138-we-o2           # delete the ref after landing

# (b default) PRs for review/CI surface; the CUSTOM DRAIN merges in couple-order (native queue OFF)
gh pr create --base main --head lane/2138-we-o2 --fill      # no reviewer; 0 required approvals (#2152)
# ... CI (#2151) runs the SAME check:standards on the PR — the one gate environment ...
# drain merges impl-first/WE-last itself (NOT `gh pr merge --auto` on a native queue):
gh pr merge <fui-pr> --squash && gh pr merge <we-pr> --squash   # ordered by the drain, not GitHub FIFO
```

**Skeptic:** **REFUTED as the stated native-queue hybrid** → **default flipped to "PRs-as-surface + custom drain owns all merges, native queue OFF".** Strongest attack: GitHub's native merge queue is a **branch-level** setting on WE `main` — you cannot enable it for solo WE lanes while exempting a couple's WE-half PR, so once on it grabs couple PRs out of impl-first/WE-last order; and it creates **two non-identical gate environments** (CI vs local drain). Fix folded: native queue off, PRs used only for the review/CI surface, the custom drain does every merge in order (or couples via a drain-controlled staging branch). ⚠ **This flips the raw user direction (toward native-queue)** — pure local `git merge` (a) is *more* coherent than the refuted hybrid and is retained as the fallback.
**Screen:** clear — transport/substrate is tooling-internal (no WE↔FUI boundary); the branches differ on real capabilities (native review/CI surface vs no-GitHub-dependency), not effort.

---

Successor to the two-concurrent-runs question raised against the #1933 clone model (2026-07-02 session); builds on #1933 lanes + #1995 push-retry; sibling of #2123 (solo-session lanes — a producer feeding the same queue). Prep research: [we:reports/2026-07-02-deferred-merge-queue-substrate.md](../reports/2026-07-02-deferred-merge-queue-substrate.md); research topic `deferred-merge-queue-substrate`.
