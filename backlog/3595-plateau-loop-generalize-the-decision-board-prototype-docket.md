---
bornAs: xw6814m
kind: story
size: 3
parent: "2505"
status: open
blockedBy: ["3277", "3560", "3562"]
dateOpened: "2026-09-07"
tags: [plateau-loop, decision-board, console, constellation-placement]
---

# Plateau Loop: generalize the Decision Board prototype (docket, ratification ledger, queue view) into a plateau-app console feature

The Decision Board Artifact pages (we:backlog/3277, we:backlog/3560, we:backlog/3562, we:backlog/x7wehz2) are an interim WE-side prototype for the conveyor's own operational use: a leverage-ranked decision docket, a db-capability ratification ledger, and a live queue/capacity view, published as a hand-refreshed Artifact page. Per we:docs/agent/platform-decisions.md#constellation-placement (WE holds zero implementation) and the open Plateau Loop epic (we:backlog/2445 / we:backlog/2505), the durable home for these mechanics is a real plateau-app console feature, not a permanent WE Artifact page. Tracks that migration; does not block or replace the WE-side prototype.

## Origin (operator, 2026-09-07, verbatim)

"The board is a placeholder for the full app that is plateau loop (temp name), already should have filed
that mechanic moves to plateau." The operator offered "Plateau Loop" as a temp name for the eventual real
app — **it is in fact already this repo's own established name** for exactly this coordinator/console
product line: we:backlog/2445 ("Plateau Loop — extract the delivery machinery into a coordinator
product", opened 2026-07-11) and its child epic we:backlog/2505 ("Plateau Loop — operable backlog
console, built fresh in plateau", opened 2026-07-14) already exist, with ~40 open/resolved children
(we:backlog/2474, we:backlog/2484–2489 "loop console" trend/health/anomaly views, we:backlog/2507
"backlog view v1", etc.). This item does not rename or fork that epic — it re-uses it as-is and adds the
Decision Board's mechanics to its scope.

## What's actually in the WE-side prototype (grounded, not gestured at)

- **we:backlog/3277** — declares the operation that publishes/refreshes a decision or architecture
  Artifact page in place (not yet built: empty `## Done when` scaffold as of this filing). Every other
  item below is `blockedBy: ["3277"]` for exactly this reason.
- **we:backlog/3562** — a standing mechanical pass (we:scripts/conveyor/decision-docket-watch.mjs, not
  yet built) that ranks open decisions by the existing `leverageScore` heuristic
  (we:src/_data/backlog.js's `transitiveUnblocks*1000+directUnblocks`), auto-dispatches
  `prepare-decision` lane agents for the top 5 unprepared, and publishes the Decision Board's
  **"prepared to decide"** section with full fork content (options, tradeoffs, bold default, confidence)
  — never a summary.
- **we:backlog/x7wehz2** (open PR https://github.com/chalbert/web-everything/pull/1985, not yet
  merged/numbered) — the Decision Board's **"decided history"** section: a permanent, append-only,
  Artifact `db`-capability-backed ledger of ratified decisions (`decisions/<id>/rulings/<id>`: actor,
  timestamp, choice, rationale), written directly from a button/form on the published page.
- **we:backlog/3560** — a second consumer of #3277's operation: a live conveyor **queue/capacity status**
  page (queued items in priority order, in-flight/leased lane+agent+elapsed, blocked/parked with reason,
  recently-completed window) — current-state snapshot, not the historical/trend surface
  (we:backlog/3569 covers that separately and is explicitly **not** part of the Decision Board family;
  see its own body).

Together: one shared "Decision Board" Artifact, two sections (pending-decisions docket + decided-history
ledger), plus a related-but-separate queue-status page — all built for the **conveyor's own operational
use** (an operator or agent deciding/ratifying/watching delivery), not as a plateau-app product surface.

## Placement doctrine actually applied (not assumed)

Checked we:docs/agent/platform-decisions.md#constellation-placement first, per this repo's own
check-before-file discipline. Its literal test: contract/protocol/interface → WE; a **running,
capability-delivering surface** → FUI/product; **"WE holds zero implementation."** A published,
db-capability-backed, interactive Artifact page a person rules decisions from is exactly a delivered
capability, not a contract — so as a *permanent* surface it cannot stay WE-resident under this rule. The
narrow carve-out (WE-side conformance tooling a we:capability-manifest-style gate consumes) does not
cover an operator-facing decision-ratification UI.

Separately, we:docs/agent/platform-decisions.md's "Backlog tracking" ruling
(`#backlog-tracking-locus-now-distributed-next`, ratified by we:backlog/3129) settles *where this
tracking item itself lives*, as opposed to where the eventual code lives: **one record of truth in WE's
own `backlog/*.md` now**, with per-repo views as locus-filtered projections — no second backlog
directory, no separate plateau-app filing, until the (not-yet-triggered) distributed end-state ships.
Matching the ~40 existing we:backlog/2445 / we:backlog/2505 children (none of which carry a `locus:`
frontmatter field), this item is filed here, as a **tracker item**, exactly the pattern we:backlog/2505's
own text states: "Web Everything holds zero implementation — the impl lives in plateau-app. This epic and
its children are tracker items; WE is the reference model, not the code home."

So: **no new plateau-app-side filing, no `locus:` field** — this item joins the existing Plateau Loop
epic tree in WE's backlog, same as its ~40 siblings, and the real build (when scoped) lands in plateau-app
via the standard cross-repo landing (#500) exactly as those siblings' `graduatedTo` fields show.

## Why `blockedBy` the three landed WE items, not `x7wehz2`

we:backlog/x7wehz2 is not yet merged (PR #1985, branch `lane/x7wehz2-decision-ledger-artifact`) and so
does not exist as a resolvable id in this backlog yet — `check:standards`'s `blockedBy` graph check
(we:scripts/check-standards.mjs) hard-errors on an edge that doesn't resolve to a real item. Once #1985
lands and is JIT-numbered, add its number to this item's `blockedBy` array (a one-line follow-up), per
this repo's own convention for a filed-but-unlanded sibling (we:backlog/x7wehz2's own body left the same
kind of forward note for its then-unlanded sibling, we:backlog/3562).

## Cross-references added to the 4 existing Decision Board cards

- we:backlog/3277, we:backlog/3560, we:backlog/3562 — each now carries a short pointer to this item
  (`3595`, this filing's own bornAs id — swap for the real `#NNN` once JIT-numbered at land) so nobody
  building the Artifact prototype mistakes it for the permanent home.
- we:backlog/x7wehz2 (PR #1985) — not editable from this lane (unmerged, on another agent's own lane
  branch); flagged instead via a PR comment on #1985 asking the same cross-reference be added before or
  after merge.

## Not in scope here

- Deciding the *exact* plateau-app UI shape (a new nav surface vs. folded into the existing
  we:backlog/2507 "backlog view" vs. its own route) — that is a real design fork for whoever scopes the
  eventual build, not decided by this tracking item.
- Building anything now. This item is a placement/migration record; it stays `blockedBy` the WE-side
  prototype so the conveyor does not attempt to dispatch it before there is a proven mechanic to
  generalize.

## Done when

1. **Executable** — TODO: once we:backlog/3277, we:backlog/3560, we:backlog/3562 (and we:backlog/x7wehz2)
   have landed and the Decision Board prototype has run for real operator decisions, this item is
   `/prepare`d into a concrete plateau-app build scope (which console surface, which of the three
   mechanics generalize first) rather than left as a placeholder — the literal command depends on that
   scoping and cannot be written before it.
