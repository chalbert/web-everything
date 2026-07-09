# Backlog split analysis — #2301 (focused `/slice 2301`)

**Date:** 2026-07-09
**Candidate:** #2301 *Force agent-memory and user-skill edits onto a lane* — `workItem: story`, `size: 5`, `status: open`.

Below the usual >8 split bar, but focused explicitly and the item's own body twice invites slicing
("May slice… re-run `/slice 2301`"). Investigated against the real surface before drawing any seam.

## Verdict: **COULD SPLIT** — 3 slices, DAG `A → {B, C}`

The three parts the body names are separable code surfaces with an **ordering** dependency, not a
coupling that forbids slicing. A `blockedBy` DAG enforces the safe order the item's pre-flight note
demands ("can't be *part-landed as-is*… _or a genuine slice_"). Slicing additionally isolates the one
**supervised, high-blast-radius** part (the live symlink repoint) from two **safe, batchable** parts —
a real quality/throughput gain, not fragmentation.

### Work investigated (file:line-citable)

| Part | Real surface | Notes |
|------|--------------|-------|
| 1 — repoint + dedicated lane | `we:scripts/lane-pool.mjs` lease infra (`#2275`, ~L285-360): a held lane is already "off-limits to `refresh`/`provision`'s `reset --hard`". A **permanent lease** (no TTL / never released) = the dedicated memory-lane — a small extension of existing mechanism. Plus the live repoint of `~/.claude/…/memory` (currently → `we:.claude/agent-memory` → `../agent-memory-src`). | Delicate: repoints the live machine-global symlink the running session writes through. Memory-wipe footgun. **Supervised.** |
| 2 — guard deny | `we:scripts/guard-lane.mjs:54-61` — the `inAgentMemory` allow carve-out (matches `agent-memory-src/` + legacy `.claude/agent-memory/`). Invert to `inPrimary && inAgentMemorySrc` → deny-with-reason. Covers user skills (same primary-leak class). | One file. Low risk **once A is in place** (before A, the deny would break the loop — hence `blockedBy: A`). |
| 3 — auto-land hook | `close-session §1a` already lands memory survivors via `we:scripts/lane-pool.mjs` + `we:scripts/pr-land.mjs --label-on-green`. Part 3 wires that transport to the memory-lane's own `agent-memory-src` diff on Stop / loop-tick / close. | Reuses existing transport; no new PR machinery. |

### Proposed slices

| Slice | Title | workItem | size | blockedBy | Batchable |
|-------|-------|----------|------|-----------|-----------|
| **A** | Provision a dedicated persistent memory-lane (permanent lease) + repoint the machine-global memory symlink at it | story | 3 | — | **No — supervised** (live repoint, memory-wipe footgun) |
| **B** | Invert the `guard-lane` agent-memory exemption into a primary-only deny-with-reason backstop (covers user skills) | story | 2 | A | Yes (after A) |
| **C** | Deterministic hook lands the memory-lane diff via `pr-land` on Stop/close — no agent-run `/pr` | story | 3 | A | Yes (after A) |

### DAG

```
A (repoint + dedicated lane, supervised)
├──▶ B (guard deny backstop)
└──▶ C (auto-land hook)
```
B and C are independent of each other (both need only A) → **batchable together once A lands.**

### Rubric check (all five hold)

1. **Size is volume, not a fork** — design fully specified, sub-fork (global vs per-session memory-lane) already **SETTLED** in the body. Three distinct code surfaces = volume. No slice buries a fork.
2. **≥2 nameable slices, each a real home** — A→`we:scripts/lane-pool.mjs`+symlink, B→`we:scripts/guard-lane.mjs`, C→close/Stop hook + `we:scripts/pr-land.mjs`. ✓
3. **Each slice ≤3 / task** — 3, 2, 3. ✓
4. **Clean DAG, real independence or incremental delivery** — A→{B,C}, honest edges; the DAG **enforces** the safe order the item requires (deny/hook never precede repoint). Incremental: A alone already delivers the headline DoD ("primary `git status` stays clean across a memory-writing session"). ✓
5. **Every slice leaves a valid demoable state** — A: write a memory → primary clean, write lands in the lane. B: direct primary `agent-memory-src` write → denied with reason. C: memory reaches `main` via a ready-to-merge PR. ✓

**Interim safety:** after A but before B, `we:scripts/guard-lane.mjs` still exempts the (now lane-resident) memory write via both `inLane` and the residual carve-out — no double-deny, no regression. B's deny only ever lands *after* A, so it never fires while the symlink still resolves to primary (the item's "naïve fix #2" failure is structurally excluded by the edge).

## Could not split further

- **Slice A is atomic:** "add dedicated-lane support" and "repoint the symlink" have no independent value apart (a lane with no symlink target is dead code; a repoint with no target has nowhere to point). Splitting A would fragment one coherent deliverable — **do not**.

## Case against splitting (recorded for the go/no-go)

Total is only 5 points and the parts are tightly ordered; landed together in one **supervised** pass, no
slicing is strictly needed. The split's value is specific: it lets the **3-point supervised repoint (A)**
stay supervised while the **safe 4 points (B+C) flow through the normal autonomous batch pipe** after A —
instead of forcing the trivial guard edit + hook wiring to also be supervised. That isolation + the
order-enforcing DAG is the reason to split; if you'd rather do all three in one supervised sitting, decline.

## No decision card needed

The only fork (per-session vs machine-global memory-lane) is SETTLED in the body. The "supervised vs
autonomous" question for A is an execution-risk tag carried on slice A, not an open design decision.
