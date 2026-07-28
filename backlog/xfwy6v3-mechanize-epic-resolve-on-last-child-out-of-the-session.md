---
kind: story
size: 3
parent: "xthv8dq"
status: open
dateOpened: "2026-07-28"
scope: ["we:scripts/conveyor/pr-watch.mjs", "we:scripts/backlog.mjs"]
relatedTo: ["2606", "2700"]
tags: [conveyor, drain, resolve, epic, session-free]
---

# Mechanize epic-resolve-on-last-child out of the session

Today, flipping an epic `→ resolved` when its **last child story resolves** is a **session-run skill**: the `/resolve` command ([we:.claude/commands/resolve.md](../.claude/commands/resolve.md)) runs in discovery mode, reads the gate's *all slices done* nudge, applies the scope-delivered review, and closes the umbrella by hand. This item **mechanizes that pass into the runner/drain** so an epic resolves automatically when its final child lands — no session required. It is the epic-level counterpart of work already done at the story and lease level (see *Sibling*).

## Why this is on the session-free critical path

The parent epic's target is: a session does only queue + expose-state. Two of the "everything else" jobs it names are **resolve-on-land** and **lease-reap/release** — both must leave the session. Story-resolve and lease-release already have session-free homes (below); **epic-resolve-on-last-child is the remaining gap**. While it stays a `/resolve` skill, closing an umbrella needs a model in the loop, so a session can't fully leave.

## Sibling — the on-land cleanup this extends

- **Lease-release on land** is already mechanized: **#2700** wired ghost-release (lease-reaper + `pr-watch --release-session`) into the mechanical tick — the drain-side on-land cleanup pass in [we:scripts/conveyor/pr-watch.mjs](../scripts/conveyor/pr-watch.mjs) / [we:scripts/conveyor/lease-reaper.mjs](../scripts/conveyor/lease-reaper.mjs). "Release the lease" needs no session.
- **Story-resolve on land** is mechanized differently: the producer resolves its own story **in its lane clone** via `node [we:scripts/backlog.mjs](../scripts/backlog.mjs) resolve <NNN>` before opening the PR, so the story lands already `resolved`. No session-run pass closes a story after the fact.

**The epic is the case neither of those covers.** An epic carries no lane of its own — its children each land in their own PRs — so nothing resolves the umbrella on the land of its *last* child. That is the pass this item adds to the on-land cleanup, alongside #2700's lease-release.

## Scope of this item

- **Detect "last child just landed."** When a child story resolves on land, check whether every other `parent:`-edge child of its epic is now `resolved` — reuse the CLI's existing no-open-slice enumeration (#658, already in `we:scripts/backlog.mjs resolve`, which refuses to close an epic with open children by the `parent:` edge, never body prose).
- **Auto-resolve the umbrella** with `--graduated-to=none` (an epic delivered by its children spawns no new entity), running the same `resolve` splice the skill runs today, from the drain's on-land cleanup rather than a session.
- **Decide the scope-delivered-review boundary.** `/resolve` applies a judgment review (is the epic's *scope* delivered, or was only the carved slice closed?) before closing. The mechanized pass must either (a) resolve only when the check is script-decidable (all `parent:` children resolved AND no `blockedBy` / `childlessReason` / "first slice" deferral marker), or (b) escalate the judgment cases to the operator — never silently close over an uncarved tail. Draw the deterministic-core / thin-judgment line explicitly.

## Sibling program

Relates to **#2606** (Delivery throughput & latency program) — mechanizing this cleanup removes a session round-trip from every epic close, shortening time-to-land for the umbrella.

## Acceptance

- When a child story resolves on land and it is the epic's last open child, the drain/runner resolves the epic with no session in the loop.
- The no-open-slice guard (#658) is reused, not reimplemented — the pass never closes an epic that still has an open `parent:` child.
- Judgment cases (uncarved-scope / "first slice" / blocked-tail) are either excluded from the auto-close or escalated to the operator — never auto-closed over undelivered scope.

locus: we
