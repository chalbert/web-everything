---
bornAs: x22ecxe
kind: decision
parent: "2475"
status: open
dateOpened: "2026-08-15"
preparedDate: "2026-08-16"
tags: []
---

# Per-repo backlog data model: distributed backlog/*.md + tooling per repo, or a locus-filtered view over the WE tracker?

## Digest

Carved out of [#2475](/backlog/2475-per-repo-backlog-files-each-constellation-repo-owns-its-own-/) during its
build-readiness prep (2026-08-15): #2475 (`story·8`, "each constellation repo owns its own `backlog/*.md`")
turned out to have **no design at all** — its one-paragraph body *is* an unnamed fork, which per the
carve/flip rule (`we:docs/agent/backlog-workflow.md` → *"A fork lives in a `kind: decision` item"*) belongs
here, not in a story handed to a builder. **This item is grounded in a real investigation of the live tree**
(paths cited below, plus the parent-epic and precedent items read directly during prep).

**Prepared 2026-08-16.** No published `/research/` topic — this is an internal cross-repo tooling/architecture
call, not a greenfield browser-standard design (no intent/block/plug/protocol/adapter is being minted), so the
web-platform survey (`we:docs/agent/design-first.md` step 1) does not apply; the prior-art requirement is
instead satisfied by grounding against the already-shipped internal precedent (#500, the plateau console
loader, the cross-repo delivery playbook — all cited below with `file:line`), matching the documented exemption
for "a decision that only ratifies shipped code." **Disclosure on the skeptic/screen passes below:** the
environment's concurrent subagent budget was saturated for the ~12+ minutes spent retrying at prep time
(repeated `Concurrent subagent limit reached` on every attempt, other sessions holding the slots), so the
pass-4 skeptic attack and pass-5 two-confusion screen were run by the preparing session itself rather than a
separate fresh-context sub-agent — a real, named deviation from the ideal discipline, not a silent skip. Both
passes were still run adversarially against all their required axes (see the `Skeptic:`/`Screen:` lines under
Fork 1) and the findings are folded into the fork below, including one genuine finding this session's own first
draft had missed (the parent epic #2472's own body text). **Superseded 2026-08-16:** a genuine
throwaway fresh-context agent (no prior involvement in this item, dispatched after the item had already
merged as PR #1395) has now independently re-run both passes — see the dated `Skeptic (fresh-context,
2026-08-16):` / `Screen (fresh-context, 2026-08-16):` notes under Fork 1. It reached the same
ratification-readiness conclusion and found one real citation-location defect the self-run pass had left
in (a "we:story-preparation-checklist.md item 8" mislabel), now corrected; `we:docs/agent/backlog-workflow.md:421`'s
fresh-context requirement is satisfied as of that pass.

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
    decentralization now is exactly the #3071 shape (`we:agent-memory-src/story-preparation-checklist.md`'s
    own #3071 callout, in its "Why" rationale and closing note — not item 8, which is about de-risking
    probes during preparation and never mentions #3071) — a well-scoped build that measures nothing about
    whether it unblocks anything real.
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
  - **Confronting the parent epic's own words, not just calling the premise "moot":** #2472's body states
    verbatim, "Its data-model prerequisite is per-repo backlog ownership: **each repo holds its own
    `backlog/*.md`** rather than everything living in Web Everything today" — i.e. the epic's own framing, as
    written, leans on (a)'s literal shape, not (b)'s. Ratifying (b) does not merely note that premise is
    dated; it **overrides** a sentence the parent epic still asserts. That's an acceptable outcome (the epic
    is `status: open`, `priority: low`, explicitly deferred and re-scopable, and this decision is the correct
    place to resolve the ambiguity it left unexamined) but it is not free: **ratifying (b) obligates a
    follow-up edit to #2472's own body** (strike or reframe the "each repo holds its own `backlog/*.md`"
    sentence) so the epic stops asserting a premise this decision just closed the other way. See Follow-up.
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

**Original self-run skeptic note (2026-08-15, superseded by the full 4-axis pass below, kept for the
trail):** attacked the default on *"doesn't this just recreate #500 a second time for a different surface,
itself an argument for (a)'s bigger investment?"* — survives: (b) is the console's loader learning to read
the *existing* #500 model's `locus` field, strictly less new surface than (a)/(c). Attacked on *"is 'no
evidenced need' too convenient — could the console itself be the evidenced need?"* — partially amends: the
console (#2505/#2507) is real and shipped, but demonstrates the read-view need (b) satisfies, not the
repo-*local* filing autonomy (a)/(c) distinguish on — doesn't move the default.

Skeptic: SURVIVES-WITH-AMENDMENT — a hostile pass attacked Fork 1's default on four axes.
**(1) Classification** — SURVIVES: the fork is a genuine forced either/or (landing/numbering authority for a
given item is singular), not a config dimension or something #500 already settled; #500 settled the
*landing* mechanism, not which repo owns the *tracking record*, so the fork survives as real. **(2) Merit** —
SURVIVES-WITH-AMENDMENT: the attack found that #2472's own body text ("each repo holds its own
`backlog/*.md`...") literally states (a)'s framing as the epic's declared prerequisite, which the original
draft called "moot" without quoting or confronting it directly. Folded in above (the "Confronting the parent
epic's own words" bullet) plus a Follow-up obligation to edit #2472 if (b) ratifies. The attack also pressed
"could FUI/plateau-app's lack of any non-GitHub-issue tracking channel itself BE the evidenced need for
decentralization?" — checked against #2456 (evidence gate, `status: open`, still short of its ~2-week
unattended bar) and #2472 (`priority: low`, itself deferred pending that gate): neither the epic nor the
gate names *repo-local filing autonomy* as a live want anywhere in their own text, only orchestration
readiness — so the premise holds, it just needed the direct #2472-quote confrontation now added. **Also
checked:** #500 is a *landing/gate* precedent (code lands in the target repo's own PR); this card correctly
uses it only for the landing-authority half of the argument, not for the read-view mechanism, which it
separately grounds in the shipped `plateau:src/backlog-view/loader.ts` `REPOS` seam — no conflation found.
**(3) Statute-overlap** — SURVIVES: independently grepped `we:docs/agent/platform-decisions.md` for every
anchor touching locus/repo/placement/registry/numbering/boundary turf —
[#constellation-placement](../docs/agent/platform-decisions.md#constellation-placement) (code *implementation*
placement, WE/FUI/Plateau — a different question than where *tracking data* lives),
[#repo-drain-check-contract](../docs/agent/platform-decisions.md#repo-drain-check-contract) (the drain's
CI-check boundary contract, not backlog data), and
[#pool-siblings-real-built-clones](../docs/agent/platform-decisions.md#pool-siblings-real-built-clones) (lane-pool
sibling *checkouts* for render/push, not backlog tracking) — all govern disjoint turf by a different test; none
collide with or duplicate a "single tracker + locus-filtered view" rule. **(4) Citation-scope** — SURVIVES:
read #500, #2456, and #2472 directly (not just this card's summary of them) — #2456's evidence-gate scope is
exactly what #2472 itself cites as its own blocker (#2472's body: "Deferred behind the phase-1 evidence gate
(#2456)"), so citing it to reject (a) is within scope, not overreach; #500's ruling is scoped to the
landing/gate registry, cited here only for that same claim. The `we:agent-memory-src/story-preparation-checklist.md`
"#3071 shape" reference ("a well-scoped build that measures nothing about whether it unblocks anything real")
is used as a cautionary parallel, not as authority narrower than its own scope — holds, but the original
citation mislabeled its location as "item 8"; the #3071 line actually lives in the checklist's "Why"
rationale (preceding the numbered list) and its closing note after item 9 — item 8 itself is about
de-risking risky probes during preparation and does not mention #3071. Corrected by the fresh-context
citation check below; the substance of the citation (a real, on-point cautionary parallel) was never wrong,
only its in-file location.

Screen: clear — two-confusion check on Fork 1. (1) Not an invisible implementation detail: the fork has a
named, real consumer (`plateau:src/backlog-view/loader.ts`'s `REPOS` seam and the humans who'd read a
per-repo view through it), and it is not a WE↔FUI standard-vs-implementation question at all — it never
touches an intent/block/plug/protocol/adapter, so there is no standard-layer side to misplace it onto. (2)
Merit survives the "free to build" hypothetical: even with (a) and (b) both zero-cost to build and perpetually
maintained, (a) still forces a permanent repo-qualified-id scheme onto every existing `#NNN` cross-reference
constellation-wide (correctness/legibility cost, not an effort cost), which (b) never incurs. The fork is not
prioritization in disguise — it is a real, standing structural trade-off independent of build cost.

**Skeptic (fresh-context, 2026-08-16):** the pass-4 skeptic and pass-5 screen above were originally run by
the preparing session itself (disclosed above) rather than a throwaway fresh-context agent, which
`we:docs/agent/backlog-workflow.md:421` requires. This note is that required fresh-context pass, run by a
session with no prior involvement in this item, after the item had already merged (PR #1395). Re-attacked
all four axes independently rather than re-deriving the self-run pass: **(1) Classification** — SURVIVES;
also pressed a sharper angle the self-run pass didn't raise: since neither named consumer needs the record
relocated, is Fork 1 a manufactured fork around an obvious call rather than a genuine either/or? Rejected —
obviousness of the default doesn't disqualify fork-ness under the stated test (a forced invariant where
exactly one branch is correct); (a)/(c) remain live, buildable alternatives with real (if rejected) merit
cases, not strawmen. **(2) Merit** — SURVIVES-WITH-AMENDMENT (as already folded into the fork above); no
further merit gap found. **(3) Statute-overlap** — SURVIVES: independently re-grepped
`we:docs/agent/platform-decisions.md` for every anchor heading touching backlog/locus/registry/repo/numbering/
track turf and found no anchor beyond the three already cited that governs backlog-data placement; the one
adjacent hit (`#registry-name-guard-namespace`) is about `CustomRegistry.define()` HTML-attribute-namespace
collisions, unrelated. **(4) Citation-scope** — independently re-verified #500, #2456, #2472,
`plateau:src/backlog-view/loader.ts` (its `REPOS` doc comment quoted verbatim matches),
`plateau:docs/backlog-console-design.md` §6b (exists, quoted framing matches), the
`we:scripts/check-standards-rules.mjs:74-83` `LOCI` registry (matches), `we:docs/agent/backlog-workflow.md`'s
*Repo-locus* section (~line 745, matches "~749-768"), and
`we:agent-memory-src/conveyor-main-drive-cross-repo-playbook.md` (its 8-item list —
#2789/#2795/#2791/#2794/#2714/#2790/#2715/#2712 — confirms "8 plateau-app items landed cross-repo in one
session"). **Found one real defect: the "item 8" attribution for the #3071 checklist reference was wrong**
(the #3071 line lives in the checklist's pre-list "Why" rationale and its post-item-9 closing note, not
inside item 8's own text, which is about de-risking probes and never mentions #3071) — fixed in both
places above (Fork 1's option (a) bullet and the Citation-scope paragraph). The underlying claim was never
substantively wrong, only its in-file pointer. The `393 + 211` locus-hit count is now `394 + 217` (re-grepped
live) — normal corpus drift in an active repo over one day, not a citation defect, left as an approximate
figure. **Net: no new problem found beyond the one the self-run pass's own citations already had latent
(now fixed); ratification-readiness holds on a genuine independent pass.**

**Screen (fresh-context, 2026-08-16):** independently re-ran both confusion checks rather than re-deriving
the self-run screen. **(1) Implementation-vs-standard** — clear: Fork 1 is a backlog/project-tracking
infrastructure decision (where agent-operations tracking data lives), not a WE↔FUI runtime-implementation
question; it never touches an intent/block/plug/protocol/adapter, so `constellation-placement`
(implementation-code placement) is a different axis entirely and nothing here misfiles onto it. **(2)
Merit-vs-prioritization** — clear: stress-tested the "free to build" hypothetical independently — even with
(a) built and maintained at zero cost, a repo-qualified-id scheme becomes structurally necessary the moment
two repos both mint a bare `#NNN`, which is a correctness/legibility cost intrinsic to the shape, not a
timing or effort artifact; and (a)'s "true local autonomy" merit case is a structural property (no WE
checkout required) independent of build cost too, so neither side of the fork is prioritization wearing
merit's clothes. **Net: screen holds on independent re-derivation; no confusion found.**

## Supported by default (not a fork)

- **File format / frontmatter schema** — whichever branch wins, a per-repo (or filtered) view reuses WE's
  existing item schema (`kind`/`status`/`size`/`tags`/etc., the same parse contract) rather than inventing a
  second vocabulary. Coexists under every branch; not a design choice.

## What this unblocks

Resolving this fork turns #2475 back into a buildable, correctly-scoped story (or resolves it as
`graduatedTo` this decision + a fresh, right-sized successor, if the ruling changes its shape enough that the
original card no longer describes the work). Until then #2475 stays `blockedBy` this item.

## Follow-up if Fork 1 ratifies (b)

- **Edit #2472's own body.** It currently states, verbatim, "Its data-model prerequisite is per-repo backlog
  ownership: each repo holds its own `backlog/*.md` rather than everything living in Web Everything today" —
  (a)'s framing. Ratifying (b) should come with a small follow-up edit to that sentence (reframe it as "a
  locus-filtered per-repo view over WE's existing tracker," per this decision) so the epic stops asserting a
  premise this item just closed the other way. Not a blocker on ratifying — a same-sitting or immediately-next
  mechanical edit.
- **The buildable child** (once #2475 is re-scoped or graduated): teach `plateau:src/backlog-view/loader.ts`'s
  `REPOS` seam a locus-filtered resolution mode (a `frontierui`/`plateau-app` slug resolves to WE's own
  `backlog/` root, `loadBacklog` filtered to `item.locus === slug`) and wire the new slugs through
  `plateau:vite.config.mts`'s `REPOS`/`DEFAULT_REPO` construction (`applyBoardSeed({ webeverything: weRoot }, …)`,
  ~lines 362 and 611). Predicted touch-set: `plateau-app:src/backlog-view/loader.ts`,
  `plateau-app:vite.config.mts` — this is what fed the provisional jury's `changedFiles` below.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (cross-repo tooling architecture — the console's repo seam is a chokepoint every
multi-repo view passes through, and a wrong call here is expensive to unwind across the constellation). This
jury binds against the item's predicted scope (`plateau-app:src/backlog-view/loader.ts`,
`plateau-app:vite.config.mts`) and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |

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
