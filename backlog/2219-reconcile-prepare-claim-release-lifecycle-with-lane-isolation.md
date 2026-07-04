---
kind: decision
status: open
dateOpened: "2026-07-03"
relatedTo: ["2123", "2138", "2187", "2191", "2200"]
relatedReport: reports/2026-07-02-deferred-merge-queue-substrate.md
preparedDate: "2026-07-04"
tags: [lane, isolation, prepare, claim, release, session-tooling, pr-flow, decision]
---

# Reconcile the claim / release / preparedDate lifecycle with lane isolation (solo `/prepare`, `/next`, `resolve`)

**Residual of [#2123](/backlog/2123-should-a-solo-session-non-workflow-also-run-in-an-isolated-w/)** (ratified
2026-07-02: *every* edit-action session — solo `/prepare`, `/next`, `resolve`, `/workflow` alike — runs in an
isolated lane clone and lands via the PR/merge-queue flow, no content-session carve-out). #2123 ruled *that*
the work lanes; it did **not** reconcile the solo skills' **frontmatter lifecycle** with that isolation. The
close-out prose still teaches the primary-checkout-era dance, and that dance now straddles two trees.

> **Prep note — the *direction* is contract-derived; the live residual is the concurrency mechanism.** The prep
> survey found the governing contract is **already ratified**: the item-file frontmatter splice (`status`,
> `preparedDate`) is a **backlog edit**, and [#2191](../docs/agent/platform-decisions.md#pr-flow-rollout-mechanism)'s
> carve-out is "`we:claims.json`-class **local signals ONLY** … never widens to … **backlog edits** (all of which
> take the lane→PR path)" ([we:platform-decisions.md:2490](../docs/agent/platform-decisions.md#L2490)). So Option
> (a) "keep the primary status splice" is not a live branch — it *reintroduces the exact primary↔`main` divergence*
> the ratified rule forbids. **But the direction being forced does *not* make the call free:** the prep skeptic
> refuted an earlier "just drop the splice, the reservation covers concurrency" grounding — the dropped
> `open→preparing` was a **hard selection-exclusion** ([we:scripts/readiness/engine.mjs:65](../scripts/readiness/engine.mjs#L65)),
> and a `reserve` hold is only a *soft deprioritize* (TTL 120 min, local-only). So the real live sub-fork is **how
> to preserve the concurrency guarantee** once the status splice leaves `main`: a *strengthened local hold that
> hard-excludes* (the #2138-Fork-4 queued-token shape, default) vs *accept the bare soft reservation + a bounded
> cross-clone gap*. Derive the contract *first* (#1839 residue-bar discipline), then price the residual — done below.

## The tension (concrete)

`/prepare`'s close-out (see `we:.claude/skills/prepare-decision-item/SKILL.md`, *Close out*) is authored as:

1. `node we:scripts/backlog.mjs claim <NNN> --as=preparing` — today a **primary-tree frontmatter splice**
   (`we:scripts/backlog.mjs` is not hooked by `guard-lane`, which only intercepts the `Edit`/`Write` tools —
   [we:guard-lane.mjs:62-66](../scripts/guard-lane.mjs#L62)).
2. Author the item **body** + write the `/research/` topic files — direct `Edit`/`Write` → **`we:guard-lane.mjs`
   blocks these on primary** ([we:guard-lane.mjs:62-66](../scripts/guard-lane.mjs#L62)), so they must happen in
   the **lane clone → PR**.
3. Stamp `preparedDate` via a raw frontmatter `Edit` — also `guard-lane`-blocked on primary → **lane/PR**.
4. `node we:scripts/backlog.mjs release <NNN>` (`preparing → open`, [we:backlog.mjs:235](../scripts/backlog.mjs#L235)) — a primary splice again.

So a single prepare session would split its durable output across **two trees**: `claim`/`release`/status on
**primary** (via the CLI), while **body + research topic + `preparedDate`** can only land via the **lane PR**.
Two failure modes follow — and both are already *named as forbidden* by ratified statute:

- **Divergence.** After the lane PR lands on `main`, the **primary** item file still carries the old body and no
  `preparedDate` (primary is never `git pull`ed — memory: *never git pull in the primary*). The primary working
  tree disagrees with `main` on the very item just prepared. This is precisely what
  [#primary-read-only-lanes-only](../docs/agent/platform-decisions.md#primary-read-only-lanes-only) exists to
  prevent: *"every change reaches `main` through a `lane/*` → PR … nothing lands on `main` ungated"*, and
  *"coordination writes that need immediacy (claims/reservations) happen **in-lane** … not in the primary"*
  ([we:platform-decisions.md:72](../docs/agent/platform-decisions.md#L72)).
- **Net-zero status delta, but a *real* concurrency job.** `claim(preparing)` + `release(open)` **cancel** to a
  net-zero status delta on `main`; the only durable change is *body + research topic + `preparedDate`* — all
  atomically landable in **one lane PR**. *But* the transient `open→preparing` was **not** doing nothing: it was a
  **hard selection-exclusion** ([we:scripts/readiness/engine.mjs:65](../scripts/readiness/engine.mjs#L65)) that
  stops a concurrent `/prepare`/`/next` from double-preparing the item during the window. Dropping the splice
  therefore *removes* that guarantee — and the local signals `claim` touches do **not** replace it (`claim` *clears*
  the reservation [we:backlog.mjs:196](../scripts/backlog.mjs#L196); `we:claims.json` is the #952 attribution
  baseline, not a lock; a `reserve` hold only *deprioritizes*). So this is **not** a costless "vestigial bracket"
  drop — the concurrency function must be **re-homed** to a strengthened local hold (the fork's default), not
  discarded.

The same straddle exists, more weakly, for a solo `/next` build (claim → body in lane → `resolve`) and for
`resolve` itself (a `decision`'s `resolve` also splices frontmatter + writes `codifiedIn`).

## Grounding digest

- **The concurrency guarantee today rides the `open→preparing` *status* flip — a *hard selection-exclusion*, not
  the local files.** *(Corrected after the prep skeptic refuted an earlier, inverted grounding.)* Selection reads
  **only `open` items** — `we:scripts/readiness/engine.mjs` drops every non-`open` item from *every* tier
  ([we:scripts/readiness/engine.mjs:65](../scripts/readiness/engine.mjs#L65) — `if (it.status !== 'open' … ) continue`;
  and the Tier-B/`--select` filter [we:engine.mjs:176](../scripts/readiness/engine.mjs#L176) — `items.filter(it => it.status === 'open')`).
  So `open→preparing` makes the item **invisible** to `/next`, `--select`, and the batch pack — a *hard* lock
  (#375: `preparing` drops it from selection exactly like `active`). By contrast the **`claim` CLI does NOT create
  a concurrency hold** — it *removes* the item from `we:reservations.json`
  ([we:backlog.mjs:196](../scripts/backlog.mjs#L196), `removeNums`), and `we:claims.json` is the #952
  *gate-attribution baseline*, "**not the lock**" ([we:backlog.mjs:199-200](../scripts/backlog.mjs#L199)). And a
  **`reserve` hold is only a *deprioritize***, never an exclusion — foreign-held items *sink to the back* but "are
  still packed if budget remains" (invariant 1, [we:scripts/readiness/reservations.mjs:14](../scripts/readiness/reservations.mjs#L14);
  [we:scripts/check-readiness.mjs:94](../scripts/check-readiness.mjs#L94)), with a 120-min TTL
  ([we:reservations.mjs:35](../scripts/readiness/reservations.mjs#L35)). **So a bare reservation is a strictly
  weaker guarantee than the `preparing` it would replace** — this is the real cost the fork must price, and the
  reason the default below *strengthens* the local hold rather than merely dropping the status splice.
- **Precedent for a *local token that hard-excludes*: #2138 Fork 4's queued token.** A queued item is still
  `active` on `main`, yet `claim`/`release` **refuse** it by reading a **local** offline token
  ([we:backlog.mjs:151](../scripts/backlog.mjs#L151), the `#2138 Fork 4` guard) — a hard exclusion with *no*
  main-write, exactly the shape a prepare-hold needs. Rule #105 (*Claim Ignores Git State*) authorizes the offline
  local read; #2138 Fork 4 proves it can be a *hard* refusal, not just a deprioritize.
- **Ratified statute already forbids the primary backlog splice.** [#2191](../docs/agent/platform-decisions.md#pr-flow-rollout-mechanism)
  (ratified, under #2203 strict-lock): *"The sanctioned-direct carve-out is `we:claims.json`-class **local signals
  ONLY** (`we:claims.json`/`we:queued.json`/`we:reservations.json`) … it never widens to memory content, source,
  content, or **backlog edits** (all of which take the lane→PR path)"*
  ([we:platform-decisions.md:2490-2494](../docs/agent/platform-decisions.md#L2490)).
- **The claim-locus is *explicitly deferred to this line*.** The #2123 rider closes with: *"The claim-locus and
  lane before-state-soundness **mechanics** are session-tooling carried in the #2138 merge-queue line … not part
  of this scope ruling"* ([we:platform-decisions.md:2510-2512](../docs/agent/platform-decisions.md#L2510)). #2219
  *is* that reconciliation.
- **The parallel `/workflow` path already resolved the identical question — in favour of the lane.** For batch
  work the `active→resolved` flip **rides the WE lane commit and lands only when that lane merges**; while an item
  sits queued it is *still `active` on `main`* ([#2138 grounding](2138-should-lane-landing-move-to-a-deferred-merge-queue-drained-b.md), workflow header
  [we:parallel-execute.workflow.js:64](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L64)); the
  producing run's result is *"a set of OPEN ready-to-merge PRs the drain lands … no landed state"*
  ([we:parallel-execute.workflow.js:69](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L69)).
  **[#2138 Fork 4](2138-should-lane-landing-move-to-a-deferred-merge-queue-drained-b.md) (ratified)** chose a
  **local queued token** over a `status: queued` main-write for exactly this trade — "no new commit-to-main during
  the queued window," concurrency via the offline local signal (Rule #105). #2219 extends that *same* precedent
  from the batch `active→resolved` case to the solo `open→preparing→open` / `preparedDate` case.
- **#2187 already puts the *claim itself* in the lane for decisions.** *"At a decision **claim** the skill
  provisions/reuses the preview lane"* ([we:platform-decisions.md:2519](../docs/agent/platform-decisions.md#L2519)),
  and the ratify path is a **`resolve --codified-to` run inside the lane clone → ready-to-merge PR** (mirrors
  `we:scripts/pr-land.mjs`). So for the *decision* skills the lane exists *at claim time* — there is no "before
  the lane exists" window for a primary claim to occupy.

## Axis-framing

The item's stated axis splits into a **settled direction** and a **live sub-fork**. The *direction* — where the
item-file `status`/`preparedDate` lives — resolves against a contract that is **already law** (a
**contract-derived classification**, the #1839 residue-bar test run *after* deriving the contract independently):
the item-file field is **git-tracked backlog content on `main`**, #2191 rules every backlog edit onto the lane→PR
path, and Option (a) (*keep the primary status splice*) **breaks that derived contract** (ungated primary write +
the forbidden primary↔`main` divergence). So (b) *everything rides the lane* is forced. **But the prep skeptic
refuted the naïve reading that this makes the call free:** the `open→preparing` splice being dropped was a **hard
selection-exclusion** ([we:scripts/readiness/engine.mjs:65](../scripts/readiness/engine.mjs#L65)), and no existing
local signal replaces it (a `reserve` hold only *deprioritizes*). So a genuine **sub-fork** remains — *how to
preserve the prepare-window concurrency guarantee* — with two coherent, mutually-exclusive answers (a strengthened
hard-excluding local hold vs a bare soft reservation), plus a **forced downstream** (rewrite three skills' close-out
prose). Which layer: **agent-workflow / session-tooling** — nothing crosses the WE↔FUI standard boundary or touches
a registry (same classification the sibling #2138 carries). Codifies as a **rider in the #pr-flow-rollout-mechanism
cluster** (the home of #2138/#2191/#2123/#2187), *reconciling* — never contradicting — those anchors.

## Recommended path at a glance

| Fork | Question | Recommended default (post-skeptic) | Main alternative (excluded) |
| --- | --- | --- | --- |
| 1 | Where does the solo frontmatter lifecycle (`status` + `preparedDate`) live? | **(b) Everything rides the one lane→PR** — the item-file `status`/`preparedDate` are authored in the lane, never spliced to primary. *Contract-forced.* | **(a) Keep a primary-tree status splice** — REFUTED by ratified #2191 + #primary-read-only (forbidden primary↔`main` divergence) |
| 1-sub | How is the prepare-window concurrency guarantee preserved once `open→preparing` leaves `main`? | **(b-strong / c) A strengthened *local* prepare-hold that HARD-excludes** (the #2138-Fork-4 queued-token shape: selection skips it + `claim` refuses it, offline per Rule #105), with a lease that outlasts a real prepare — owned by a small lane-run CLI verb. | **(b-plain) A bare `reserve` hold** — a *soft* deprioritize only (TTL 120 min, local-only): re-opens a double-prepare gap in a thin pool / on TTL-expiry / cross-clone. Retained as the fallback if the tooling isn't worth it, with the gap named. |

## Fork 1 — Where the solo frontmatter lifecycle lives

**Fork exists because** (top level) one branch — **(a) keep the primary status splice** — is a *coherent-looking but
statute-broken* branch that must be explicitly ruled out: it re-opens the primary↔`main` divergence that
[#2191](../docs/agent/platform-decisions.md#pr-flow-rollout-mechanism) + [#primary-read-only-lanes-only](../docs/agent/platform-decisions.md#primary-read-only-lanes-only)
already forbid for *any* backlog edit. **And** (sub-fork) the two ways to preserve the concurrency guarantee once
the `preparing` main-write is gone — a *hard-excluding* local hold vs a *soft* reservation — cannot both be the
taught mechanism, and they differ on a real guarantee-strength axis, not just effort.

- **(a) Keep the split — `claim`/`release` stay a primary-tree status splice (excluded / broken).** The item-file
  `status` `open→preparing→open` bracket is written directly to the primary tree via the guard-exempt CLI, as an
  early concurrency cue. **Refuted:** (i) `status` on the item file is git-tracked backlog content, and #2191 rules
  it onto the lane→PR path — the CLI's *guard-lane exemption* is a property of the enforcement hook (the CLI isn't an
  `Edit` call), **not** a licence in the rule, which #2191 states in scope terms ("never widens to … backlog
  edits"); (ii) it reintroduces the named **divergence** failure mode (primary carries `preparing`/stale body
  forever; `main` carries the prepared state). There is no "before the lane exists" window for decisions anyway
  (#2187 provisions the preview lane *at* claim).
- **(b) Everything rides the one lane→PR — the direction (default, contract-forced).** **All** item-file frontmatter
  transitions — `status` *and* `preparedDate` — plus the body and the `/research/` topic are authored **in the
  lane** and land in the **one PR**; nothing splices to the primary item file. The item stays `open` on `main`
  through the prepare window and flips to `open + preparedDate` = *"✓ ready to ratify"* atomically when the PR
  lands. Same *net-state* direction [#2138 Fork 4](2138-should-lane-landing-move-to-a-deferred-merge-queue-drained-b.md)
  ratified for the batch case (no transient status main-write), lifted to the solo `preparing`/`preparedDate` case.
  This settles *where the frontmatter lives* — it does **not** by itself settle concurrency, which the sub-fork does.

  **Sub-fork — how the prepare-window concurrency guarantee is preserved:**
  - **(b-strong / c) A strengthened *local* prepare-hold that HARD-excludes (default).** Re-home the guarantee the
    dropped `preparing` splice provided into a **local token** — the exact shape of #2138 Fork 4's queued token:
    selection **skips** it and `claim` **refuses** it ([we:backlog.mjs:151](../scripts/backlog.mjs#L151)), read
    offline per Rule #105 — with a lease that **outlasts a real prepare** (or refreshes across the session), not
    the 120-min reservation TTL. Best owned by a small **lane-run CLI verb** (the (c) shape, e.g.
    `we:scripts/backlog.mjs prepare-stamp`) that writes the hold *and* the lane-side `status`/`preparedDate` as one
    audited path. This restores a *hard* exclusion with **no** main-write and no divergence — strictly the strongest
    option that stays inside the contract.
  - **(b-plain) A bare `reserve` hold (fallback).** Use the existing `reserve` hold as-is. Simpler (no new tooling),
    but it only **deprioritizes** ([we:scripts/readiness/reservations.mjs:14](../scripts/readiness/reservations.mjs#L14))
    — a thin pool can still pack the held item, the 120-min TTL can expire mid-prepare, and the hold is
    local-only/never-pushed so a fresh clone, a second machine, or the human reading the rendered `/backlog` board
    sees only `main` (`open`). These are **real, bounded** double-prepare gaps; acceptable *only if* the (b-strong)
    tooling isn't judged worth it — and they must be **named**, not hand-waved (the earlier draft's error).

Close-out shape under the default (keyed to the real CLI + guard):

```bash
# (b + b-strong default) — solo /prepare: HARD local hold + all durable state in ONE lane→PR, no primary splice
node we:scripts/backlog.mjs prepare-hold 2219       # LOCAL hard-exclude token (claim refuses it; selection skips it) — Rule #105, lease > a prepare
node we:scripts/lane-pool.mjs status --json         # provision/reuse the (preview) lane — #2187
# ... in the LANE clone: author body + /research/ topic + stamp status(open)+preparedDate ...
node we:scripts/backlog.mjs prepare-stamp 2219      # (c verb) writes status(open)+preparedDate into the LANE tree
node we:scripts/pr-land.mjs                          # the ONE PR: body + research topic + status + preparedDate land atomically
node we:scripts/backlog.mjs prepare-release 2219    # drop the LOCAL hold; NO item-file status splice ever touched primary

# (b-plain fallback) — no new verb: a bare reserve/unreserve bracket, accepting the named soft-hold gaps:
node we:scripts/backlog.mjs reserve 2219            # SOFT deprioritize only (TTL 120m, local-only) — the weaker guarantee
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the fresh-context refutation **flipped the Merit axis** and the default was
rewritten. **(0) Classification:** SURVIVES — the *direction* (b) is contract-derived (Option (a) fails the #2191
scope clause), correctly not a free representation fork; but the refutation showed the residual is **not** the
"ergonomic b-vs-c" the earlier draft claimed — it is a real **guarantee-strength sub-fork**, now stamped as such.
**(1) Merit:** *REFUTED as first drafted, then fixed.* The earlier grounding asserted "the reservation already
covers the anti-double-work guarantee" and called the `preparing` board-state "cosmetic" — both **false against the
code**: `open→preparing` is a **hard selection-exclusion** ([we:engine.mjs:65](../scripts/readiness/engine.mjs#L65)),
whereas `reserve` only *deprioritizes* (TTL 120m, local-only), and `claim` *clears* the reservation
([we:backlog.mjs:196](../scripts/backlog.mjs#L196)) rather than writing the lock. Fix folded: the default now
**re-homes** the guarantee into a hard-excluding local hold (b-strong), the concrete double-prepare holes
(thin-pool / TTL-expiry / cross-clone) are named, and the #375 `preparing` state is treated as a *selection-level
exclusion*, not a cosmetic. **(2) Statute-overlap:** SURVIVES — the #pr-flow-rollout-mechanism rider ("solo
prepare/next/resolve item-file frontmatter rides the lane→PR; the direct-local carve-out stays `we:claims.json`-class
signals only, now including a hard-exclude prepare-hold token") **composes** with #2191, #primary-read-only, #2138
Fork 4 (the queued-token precedent it reuses), and #2187 — no anchor amended, no conflict inherited. **(3)
Citation-scope:** SURVIVES-WITH-AMENDMENT — lead authority re-anchored to **#2123's own defer-clause** ("the
claim-locus mechanics are carried in the #2138 line", [we:platform-decisions.md:2510](../docs/agent/platform-decisions.md#L2510))
**+ #2138 Fork 4** as the on-point precedent; #2191's *close-out* rider is demoted to the *general* backlog-edit-scope
citation (its clause reaches any backlog edit, so still valid authority — just not the primary one).
**Screen:** clear — (fresh-context two-confusion screen) the fork rules on **session-tooling** (where a backlog-item
field is written + where the concurrency token lives), invisible across the WE↔FUI boundary, not an impl concern on
the standard side; and with both sub-fork branches imagined free-to-build, a **merit** gap remains — (b-strong) is a
*hard* exclusion, (b-plain) a *soft* deprioritize with real gaps — a genuine correctness difference, not
prioritization. (The refutation specifically dissolved the earlier "b-vs-c is just build-the-verb-later" prioritization
framing: the verb is the *mechanism* of the stronger guarantee, not a cosmetic follow-on.)

## Downstream (forced, whichever way it rules)

The `/prepare`, `/next-backlog-item`, and `/resolve` skills' close-out prose must be **rewritten to match** the
ruling — they currently teach the primary-checkout `claim → … → release` dance with no mention of the lane split.
Under the (b + b-strong) default the rewrite is: *hard local prepare-hold → provision/enter lane → author body +
research + `status`/`preparedDate` in the lane → land the one PR → release the hold*; the item-file `status` splice
drops. (A separate, already-made cheap edit front-loads an "enter a lane first (#2123)" pointer atop those skills;
it does **not** resolve this lifecycle seam.) **Implementation arm (b-strong / c):** a `we:scripts/backlog.mjs`
prepare-hold token that `claim`/selection treat as a **hard exclusion** (reusing the #2138-Fork-4 queued-token guard
at [we:backlog.mjs:151](../scripts/backlog.mjs#L151)) with a lease longer than a prepare, plus a lane-run
`prepare-stamp` verb (and a `guard-lane` carve permitting it inside a `.lanes/` clone) — a separately-filed build
that the (b-plain) fallback does **not** require. **Codification:** a rider in the #pr-flow-rollout-mechanism
cluster, anchored on **#2123's defer-clause** ([we:platform-decisions.md:2510](../docs/agent/platform-decisions.md#L2510),
which explicitly hands the claim-locus mechanics to this line) **+ #2138 Fork 4** (the queued-token precedent), with
#2191's carve-out cited as the general backlog-edit-scope rule. The same lifecycle applies, weaker-form, to solo
`/next` (`resolve`) — file that prose rewrite as a sibling once this rules.

---

Residual of #2123 (solo-session lanes); sibling of #2138 (the parallel-path precedent this ruling generalizes) and
#2187 (decision preview-lane, which provisions the lane at claim). Prep links the prior merge-queue-substrate
research (no new web survey — this ratifies shipped tooling + prior rulings):
[we:reports/2026-07-02-deferred-merge-queue-substrate.md](../reports/2026-07-02-deferred-merge-queue-substrate.md).
