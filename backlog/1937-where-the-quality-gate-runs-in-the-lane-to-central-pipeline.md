---
kind: decision
parent: "1933"
status: open
dateOpened: "2026-06-28"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-gate-location-lane-central.md
tags: []
---

# Where the quality gate runs in the lane-to-central pipeline

In #1933's lane-to-central pipeline, where does the quality gate (`npm run check:standards`, plus the test
suite where relevant) run? A central broker (this checkout) is the sole integration + lock authority and the
only tree the human watches; agents work in lane clones, refresh from `origin/main`, edit, commit, push a
temp `lane/*` branch, and the broker merges + gates + pushes `main`. This decision places the gate in that
flow. The axis is latency-of-feedback vs authority-of-verdict — sharpened by a **measured repo fact**: an
isolated lane tree **false-reds** on whole-repo consistency rules that cannot pass without sibling lanes'
changes present (the #1153 in-worktree false-red finding; mechanism scoped out in resolved #1159).

Prior-art survey + sourcing: `we:reports/2026-06-28-gate-location-lane-central.md`. It finds every mature
merge queue (Bors / "Not Rocket Science Rule", GitHub merge queue's speculative merge commit, Zuul's
dependent pipeline) fixes the **authoritative** gate to the *merged/combined* tree, while running a fast
pre-merge check close to the author — i.e. **both**, never one alone.

## Grounding (repo facts that constrain the forks)

- The lane-scoping the forks lean on **already exists**: `we:scripts/check-standards.mjs:1385-1410` implements
  `--local`/`--files=<list>`; `we:scripts/readiness/claimScope.mjs:213` (`partitionLocal`) demotes
  `descriptor.global` findings under `--local`; `we:scripts/check-standards-rules.mjs:58-61` marks
  `dUnresolvedRef.global`. Resolved #1159 (`/backlog/1159-scope-check-standards-local-files-to-skip-global-consistency/`)
  built this so a lane gate blocks ONLY on file-local truth and defers global-consistency to merge.
- The false-red is **live-measured**, not theoretical: in the first real multi-lane run (#1153,
  `/backlog/1153-live-validate-batch-parallel-on-a-real-multi-lane-batch/`) 4 of 7 concurrent lanes false-red'd
  in isolation and then gated green on the integrated tree.
- Cross-repo lanes (#1933 slice 4: WE → frontierui → plateau-app) mean the authoritative gate must run on an
  *assembled multi-repo* tree — only the central integrator can build that (Zuul's cross-project DAG analogue).

## Forks

### Fork A — Lane-local gate (run the gate before pushing the `lane/*` branch)

- **Lane-only, FULL gate** — run `npm run check:standards` (no flags) in the lane before push. Fastest author
  feedback, but **false-reds in isolation**: the lane cannot satisfy global-consistency rules that depend on
  sibling lanes (#1153's 4-of-7). Cannot be the authority — a lane that reds is often green on merge. Rejected
  as the *sole* gate.
- **Lane-only, SCOPED gate** — run `check:standards --local --files=<lane's edited files>` (#1159 mode): blocks
  on file-local findings, demotes global-consistency to notes. No false-reds, fast — but on its own it *never
  verifies the global invariants at all*, so a real cross-lane inconsistency lands unblocked.

**Recommended default: a lane gate exists, but ONLY as the SCOPED `--local --files=<lane files>` fast-fail —
never the full gate, never the authority.** *Confidence: high.* The full lane gate is defeated by the
live-measured #1153 false-red; the scoped lane gate is exactly what #1159 already built to fix it. Grounding:
`we:scripts/check-standards.mjs:1385-1410`, #1159, #1153. (This fork's value is realized only in combination
with Fork B — see Fork C.)

### Fork B — Central gate (run the gate after merge, on the consistent tree)

- **Central-only, FULL gate after merge** — the broker merges `lane/*` into `main` and runs the full no-flag
  `check:standards` (+ tests) on the assembled tree before pushing `main` to `origin`. Authoritative and
  false-red-free (the tree is now consistent), and it is the only place the cross-repo assembled tree exists.
  The cost as a *sole* gate: the lane discovers its own genuinely-file-local errors **late** — after a wasted
  push + merge attempt + broker round-trip — instead of before push.

**Recommended default: the FULL no-flag central gate after merge IS the authority, and is non-negotiable
regardless of what Fork A decides.** *Confidence: high.* This is the "Not Rocket Science Rule" / test-then-promote
invariant every mature queue enforces (Bors fast-forwards `main` only on a green *merged* commit; GitHub gates
the speculative merge commit; Zuul gates the assembled DAG). It is also the only gate that can see #1933's
cross-repo assembled tree. Grounding: report §1–3, #1933 slice 4.

### Fork C — Both (scoped lane fast-fail + full central authority)

- **Both** — the lane runs the Fork-A SCOPED `--local --files` fast-fail for quick local feedback (catches the
  author's own file-local mistakes before a wasted push); the broker runs the Fork-B FULL gate after merge as
  the binding verdict. The two halves are **non-overlapping by construction** (#1159 deliberately removes the
  global rules from the lane gate and defers them to the unflagged central gate) — so this is not redundant
  double-running, it is a clean split of file-local-fast vs global-authoritative.

**Recommended default: ADOPT Fork C — scoped lane fast-fail + full central authoritative gate.**
*Confidence: high.* This is the settled shape of every merge queue surveyed (pre-merge fast checks + post-combine
authoritative gate; report §4). It is *more* obviously right here than in a generic CI because #1159 already
partitioned the gate into exactly the two non-overlapping halves this fork needs — the lane gate is
already-de-false-redded, and the global invariants are already marked for central-only enforcement. Residual:
the lane fast-fail is an optimization, not a correctness gate — if a lane skips it (or it is cheap to merge
and let central catch it), nothing is lost but a round-trip; so Fork C may be implemented as
lane-gate-best-effort + central-gate-mandatory. Grounding: #1159 (the existing partition), report §4, #1933.

## Recommended path

| Fork | Question | Recommended default | Confidence | Grounding |
| --- | --- | --- | --- | --- |
| A | Gate in the lane before push? | Yes, but ONLY scoped `--local --files=<lane files>` (#1159) — never the full gate | high | `we:scripts/check-standards.mjs:1385-1410`, #1159, #1153 |
| B | Gate centrally after merge? | Yes — FULL no-flag gate on the assembled tree IS the authority (non-negotiable) | high | report §1–3, #1933 slice 4 |
| C | One place or both? | **Both** — scoped lane fast-fail + full central authority (lane best-effort, central mandatory) | high | #1159 partition, report §4 |

**Net recommended ruling (for the eventual decision turn, not made here):** adopt **Fork C** — the central
full gate after merge is the authority (Fork B), and the lane runs the #1159 scoped fast-fail as a best-effort
pre-push convenience (Fork A scoped). This mirrors merge-queue practice and reuses the gate-partition the repo
already built.
