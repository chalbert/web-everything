---
bornAs: x22ecxe
kind: decision
parent: "2475"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Per-repo backlog data model: distributed backlog/*.md + tooling per repo, or a locus-filtered view over the WE tracker?

## Digest

Carved out of [#2475](/backlog/2475-per-repo-backlog-files-each-constellation-repo-owns-its-own-/) during its
build-readiness prep (2026-08-15): #2475 (`story·8`, "each constellation repo owns its own `backlog/*.md`")
turned out to have **no design at all** — its one-paragraph body *is* an unnamed fork, which per the
carve/flip rule (`we:docs/agent/backlog-workflow.md` → *"A fork lives in a `kind: decision` item"*) belongs
here, not in a story handed to a builder. **This item is grounded in a real investigation of the live tree
(paths cited below) but has NOT been through the full decision-prep discipline** — no published `/research/`
topic, no fresh-context skeptic sub-agent, no `Screen:` line. Treat it as **○ needs prep**, not
`✓ ready to ratify`; `preparedDate` is deliberately not stamped. A future `/prepare` pass (or the ratifying
operator directly, if the framing below is enough) still owes it the fork-existence screen and a skeptic
attack before it's DoR.

**Headline finding: the premise #2475/#2472 were framed on may already be moot.** #2472 (parent epic,
opened 2026-07-12) frames per-repo files as *the* data-model prerequisite for cross-repo orchestration. But
[#500](/backlog/500-build-cross-locus-batch-locus-gate-registry-per-item-in-repo/) (resolved 2026-06-13,
**before** #2472/#2475 were even opened) already shipped a **working, centralized** cross-repo model: one
`locus:`-tagged item in WE's own `backlog/*.md`, gated in its own repo (`LOCI[locus].repoPath` /
`gateCommand` / `commitTarget`, we:scripts/check-standards-rules.mjs:74-83), with code landing in the target
repo's own PR while the tracking record stays in WE. It is proven at scale, not theoretical:
we:agent-memory-src/conveyor-main-drive-cross-repo-playbook.md documents 8 plateau-app items landed
cross-repo in one session via exactly this pattern (build lands in `plateau-app`'s own lane pool + repo; a
**separate, mechanical WE resolve PR** flips the WE card). #2475's stated design ("each repo owns its own
`backlog/*.md`... **not copied**") never engages with this — it reads as framed before, or without
reference to, #500's shipped result.

## What's actually being asked (recovered from the two consumers, since the card doesn't say)

The card names no interfaces and no consumer contract. The two places that *do* care are:

1. **The Plateau Loop console's repo seam** — plateau:src/backlog-view/loader.ts (built under
   [#2506](/backlog/2506-plateau-loop-how-the-backlog-console-reads-a-repo-s-backlog-/)/[#2507](/backlog/2507-backlog-view-v1-read-only-backlog-view-in-plateau/), both **resolved**) already reads **one
   repo's `backlog/*.md` off disk** via a `slug → checkout root` `REPOS` registry (its own top-of-file
   comment, lines 1-38), stating: *"v1 registers the one constellation repo that owns a live backlog today
   (Web Everything); adding a repo here is all multi-repo (#2472) needs on this side."* Today FUI and
   plateau-app have **no `backlog/` directory at all** (a directory scan of both sibling checkouts turns up
   nothing named `backlog`), so a second `REPOS` entry pointed at either one would just render "no items" —
   there is nothing there to show *unless* #2475 physically creates files, or this loader module is taught
   to derive a virtual per-repo view from WE's existing data.
2. **plateau:docs/backlog-console-design.md §6b** (north-star, explicitly NOT-build-now) already assumes
   "repo is one configurable input" and cites #2472/#2475 as the multi-repo path — but never itself commits
   to *distributed files* over *filtered view*; it only assumes *some* per-repo seam exists.

Neither consumer needs the tracking **record** physically relocated — both need a **per-repo read surface**.
That gap between "a per-repo view" (what's actually wanted) and "each repo owns its own file" (what the
card says) is the fork below.

## Fork 1 — how does a repo's backlog become "its own"?

*Fork-existence:* genuine either/or for the *landing/numbering authority* question — a given future WE-side
item's frontmatter status flip is authoritative in **exactly one** place (either WE's drain or a per-repo
equivalent), and the two mechanisms are mutually exclusive **for the same item**. The options below are not
simply "support both freely" because (a) requires standing up a second (and third) independent numbering +
landing authority that (b) makes structurally unnecessary — building both is pure duplicated cost with no
consumer for the duplicate half. Named per the standing test in `we:docs/agent/backlog-workflow.md` ("a
forced invariant... where exactly one branch is correct and the alternative is flawed").

**Crux:** WE's own tracker is **not just files** — it is `backlog/*.md` *plus* a large, deeply
cross-referenced machinery suite that gives those files meaning: JIT hash-id birth → drain-assigned
sequential `NNN` at land (the *"sole serial writer to main"*, we:scripts/backlog.mjs + the drain, ~1,260 +
1,449 lines respectively), `blockedBy`/`parent` cross-refs assumed same-number-space,
we:scripts/audit-backlog-health.mjs (G1–G7 governance checks), `check:standards` backlog-shape validation,
we:scripts/lane-pool.mjs claim/lease semantics. "Each repo owns its own `backlog/*.md`" is ambiguous between
*just the file format* (cheap) and *the whole authority stack above it* (a second and third full fork of
that tooling, each needing its own numbering scheme, its own "drain"-equivalent serial writer, its own
audit-health mirror — FUI and plateau-app have ordinary human/CI-reviewed PRs today, not a JIT-hash→NNN
drain-rewrite flow, so this isn't "point the existing drain at another repo," it's building the authority
stack twice more from scratch).

- **(a) Fully distributed — each repo gets its own `backlog/` directory *and* its own numbering/landing
  authority**, i.e. a from-scratch fork of the scaffold → JIT-hash-birth → drain-assigned-NNN → audit
  pipeline, independently in FUI and plateau-app. This is the reading closest to the card's literal words
  and to #2472's "first-class registry" framing.
  - **Merit case:** genuine decentralization — a FUI-only or plateau-app-only contributor could file and
    operate backlog items without WE checked out at all. True local autonomy, not a WE-mediated view.
  - **Merit cost, not just effort:** cross-repo `parent`/`blockedBy` edges (used constellation-wide today,
    e.g. #2475 → #2472, #2507 → #2506) can no longer assume one number space — a bare `#NNN` becomes
    ambiguous the moment two repos both have a `#NNN`, forcing a repo-qualified id scheme (`fui:#118` vs
    plain `#118`) through every existing doc, script, and prose cross-reference that currently treats `#NNN`
    as globally unique. That is a correctness/legibility regression on every existing consumer of the
    numbering convention, not merely more code to write.
  - *Rejected as the default* — not on cost, on there being **no evidenced consumer for the autonomy**: the
    epic this rolls under (#2472) is itself, by its own frontmatter, "**Deferred behind the phase-1 evidence
    gate (#2456)**" — and #2456 (`status: open` as of this prep) explicitly says the ~2-week
    unattended-operation evidence bar is **not yet met** ("keep running", 2026-07-14 interim review). No one
    has yet demonstrated FUI/plateau-app need to operate a backlog independent of WE; building the
    decentralization now is exactly the #3071 shape (`we:agent-memory-src/story-preparation-checklist.md`
    item 8's counter-example) — a well-scoped build that measures nothing about whether it unblocks anything
    real.
- **(b) A locus-filtered virtual per-repo view — no new files, no new authority.** WE's tracker stays the
  single record of truth (unchanged from today); the console's `REPOS` registry (the loader module above)
  gains a mode where a repo slug (`frontierui`, `plateau-app`) resolves to **WE's own `backlog/` directory,
  filtered to `item.locus === slug`** instead of a distinct checkout path. Landing/resolve keeps using
  exactly the already-shipped, already-proven mechanism: cross-repo build lands in the target repo's own PR
  (`commitTarget`), the WE tracking record is flipped by a thin, mechanical, separately-dispatched "WE
  resolve" step (documented and running today per we:agent-memory-src/conveyor-main-drive-cross-repo-playbook.md).
  - **Merit case:** delivers the actual named consumer (a live, multi-repo-browsable console) with an
    additive, small change to one already-built module instead of forking ~3,400 lines of numbering/audit/
    drain machinery twice. No migration: the ~600 existing `locus: frontierui` / `locus: plateau-app` items
    (393 + 211 hits over the backlog corpus) keep working unchanged — "WE is not deleted" is trivially true
    because nothing physically moves. `#NNN` stays globally unique; no repo-qualification scheme needed
    anywhere.
  - **Merit cost:** FUI/plateau-app contributors still route through WE's tracker to see or file
    cross-repo-tracked work — no standalone local autonomy. (Nothing stops a FUI-only contributor from
    filing an ordinary FUI-repo GitHub issue for FUI-internal, non-WE-orchestrated work today; that channel
    is untouched by this fork either way.)
  - **Default — recommended**, on the concrete evidence above: it is the only branch with a demonstrated,
    shipped precedent at the *exact* thing it needs to do (cross-repo tracking + cross-repo landing), and it
    does not carry (a)'s numbering-authority regression.
- **(c) Hybrid — a genuinely separate, but numbering-independent, `backlog/` directory in FUI and
  plateau-app for *net-new, repo-local-only* items** (e.g. a FUI-only test-infra task nobody in WE needs to
  orchestrate), while every cross-repo / WE-orchestrated item stays exactly as today (locus-tagged, tracked
  centrally). Each such repo-local item is scoped to stay **hash-id forever** (no drain-equivalent to
  promote it to a permanent `NNN`) or is rendered under a repo-qualified id from birth (`fui:x7k2q9a`, never
  colliding with WE's space because it's never promoted into it).
  - **Merit case:** gives (a)'s local-autonomy benefit for the narrow slice of work that is genuinely
    repo-local and never needs WE orchestration or cross-repo `blockedBy`/`parent` edges, without forking
    WE's numbering authority.
  - **Merit cost:** two coexisting "shapes" of backlog item across the constellation (permanently-hashed
    repo-local items vs. permanently-numbered WE-tracked items) is a new vocabulary a contributor must learn
    to read, and — this is the fork-existence justification for **excluding** it as the default, not merely
    a runner-up — **no repo-local-only backlog need has been demonstrated yet either**: neither FUI's nor
    plateau-app's own agent-instructions docs, nor any existing backlog item, ask for repo-local tracking
    distinct from what an ordinary GitHub issue in that repo could already do. Absent that demonstrated
    need, (c) is speculative infrastructure for a case (b) doesn't yet need to solve.
  - *Rejected as the default, kept as the documented escalation path*: if a genuine repo-local-only tracking
    need is demonstrated later (unlike (a), this does not require re-litigating the whole numbering authority
    — only a small, additive extension of (b)'s filtered-view model).

**Default: (b) — teach the console's `REPOS` registry a locus-filtered virtual view over WE's existing,
single `backlog/*.md`; no new files, no new numbering authority, no migration.** Escalate to (c) only if a
concrete repo-local-only tracking need is later demonstrated (name it before building it); (a) is rejected
outright pending real evidence that FUI/plateau-app need to operate independent of WE, which is precisely
what the still-open #2456 evidence gate exists to establish for the parent program.

**Self-run skeptic pass (not the fresh-context sub-agent the full DoR discipline calls for — flagged above
as a prep gap, not skipped silently):** attacked the default on *"doesn't this just recreate #500 a second
time for a different surface, itself an argument for (a)'s bigger investment?"* — **survives**: (b) is not a
new mechanism, it is the console's loader learning to read the *existing* #500 model's `locus` field, i.e.
strictly less new surface than (b) as originally scoped, and zero new surface compared to (a)/(c). Attacked
on *"is 'no evidenced need' too convenient — could the console itself be the evidenced need?"* — partially
**amends** the write-up: the console (#2505/#2507) is real and already shipped, but it was built and works
today against **one** repo via the existing `REPOS` seam; nothing in its shipped state demonstrates a need
for repo-*local* filing autonomy specifically (that's (a)'s and (c)'s distinguishing claim, not (b)'s) — the
console need is satisfied by (b) alone, so the amendment doesn't move the default.

## Supported by default (not a fork)

- **File format / frontmatter schema** — whichever branch wins, a per-repo (or filtered) view reuses WE's
  existing item schema (`kind`/`status`/`size`/`tags`/etc., the same parse contract) rather than inventing a
  second vocabulary. Coexists under every branch; not a design choice.

## What this unblocks

Resolving this fork turns #2475 back into a buildable, correctly-scoped story (or resolves it as
`graduatedTo` this decision + a fresh, right-sized successor, if the ruling changes its shape enough that the
original card no longer describes the work). Until then #2475 stays `blockedBy` this item.

## Context

**Investigation trail (paths actually opened, 2026-08-15):** we:scripts/check-standards-rules.mjs:74-83 (the
`LOCI` registry); `we:docs/agent/backlog-workflow.md` §*Repo-locus* (lines ~749-768, the shipped cross-locus
batch model); [#500](/backlog/500-build-cross-locus-batch-locus-gate-registry-per-item-in-repo/) (resolved
2026-06-13, the shipping ruling this fork leans on); we:agent-memory-src/conveyor-main-drive-cross-repo-playbook.md
(live cross-repo delivery evidence, 8 items); plateau:src/backlog-view/loader.ts (the console's actual repo
seam, `REPOS` registry + its list-loader function); plateau:docs/backlog-console-design.md §6b (the
north-star framing #2472/#2475 are cited from); [#2472](/backlog/2472-plateau-loop-multi-project-registry-manage-we-frontier-ui-an/)
(parent epic, `status: open`, explicitly deferred behind #2456); [#2456](/backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence/)
(`status: open`, evidence bar not yet met as of its last interim review). Directory scans of both sibling
checkouts (`frontierui`, `plateau-app`) confirmed **neither repo has a `backlog/` directory today**.
