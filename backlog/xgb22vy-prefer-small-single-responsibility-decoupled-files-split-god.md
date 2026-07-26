---
kind: decision
status: open
dateOpened: "2026-07-26"
relatedTo: ["x4ttbgl", "xhptp3x"]
tags: [decision, authoring, files, throughput, scope-lease, parallelism]
---

# Prefer small, single-responsibility, decoupled files; split god-files

Adopt "prefer small, single-responsibility, decoupled files" as a platform authoring rule, so delivery agents split large files by default rather than growing them. This is a throughput lever, not just tidiness: file-level scope-leases only help if files are actually small — a god-file locks everything that touches it regardless of how fine the lease granularity is. **OPEN, not yet prepared or ratified** — a human ratifies this later; on ratify it codifies into `we:docs/agent/platform-decisions.md` per the repo's decision convention (`codifiedIn` is set only at resolve).

## The proposed rule

Files should be **small, single-responsibility, and decoupled**. When a file grows into a god-file — many responsibilities, a wide surface many items must touch — the default is to **split it** along its responsibility seams. Delivery agents apply this as a standing authoring default when they build, not as a special project.

## Why it is a throughput lever

The scope-lease engine (#2560) keeps unrelated lanes apart by the files they touch. But a lease is only as fine as the files are small. When one file carries many responsibilities, **every** item that touches **any** of them declares a scope over that file — so they serialize against each other even with zero real overlap. A god-file is a single lock point that defeats lease granularity. Splitting god-files is therefore the enabler that makes finer-grained leases (#xhptp3x) actually deliver parallelism, not just narrower strings.

## Evidence — current lock-points (line counts 2026-07-26)

- `we:scripts/merge-ai-prs.mjs` — 2242
- `we:scripts/check-standards-rules.mjs` — 2194
- `we:scripts/check-standards.mjs` — 1675
- `we:scripts/lib/review-core.mjs` — 1252
- `we:scripts/backlog.mjs` — 1058
- `we:scripts/lane-pool.mjs` — 1001

Each is a file that many delivery items must edit, so each is a serialization point today.

## Caveat — not absolute

This is a default, not a hard cap. **Cohesion matters more than line count**: do not fragment a genuinely single-responsibility file into a scatter of tiny coupled files just to hit a number. Over-fragmentation trades one problem (a wide lock) for another (a diffuse surface, hidden coupling across many files). Split where the responsibilities are genuinely separable and the split aids parallelism.

## On ratify

- **Codify the rule** into `we:docs/agent/platform-decisions.md` (a new standing-rule section with its own `#anchor`), and set `codifiedIn` on resolve.
- **Reflect it in the delivery-agent brief** (`we:.claude/skills/conveyor/delivery-agent-brief.md`): agents split god-files where it aids parallelism without fragmenting cohesion.

## Relationships

- **#xhptp3x** — finer scope-lease granularity: this decision is the enabler that makes file-level leases pay off; the six god-files above are its first split targets.
- **#x4ttbgl** — the conveyor orchestration epic: same throughput program, the structural (files) counterpart to the orchestration (sessions) work.
