---
kind: decision
status: open
dateOpened: "2026-06-30"
relatedItems: ["1933", "083"]
tags: [parallel-batch, isolation, closeout, dev-server, playwright, pr-flow]
---

# Where work happens: isolate automated writers in lanes + non-destructive closeout (escalation ladder toward observe-only main)

How much of the constellation's work must run in an **isolated lane** (clone, own HEAD, merge back via
`origin`) versus directly in the **shared primary checkout** — and what the automated closeout/integrator is
allowed to touch. Extends the #1933 clone model from "just the parallel orchestrator's execution lanes" to a
general stance.

## Motivating incident (the evidence, not a hypothetical)

In `batch-2026-06-29e` (`/workflow`), the orchestrator's **closeout ran in the shared primary checkout** and
**diffed the dirty working tree to infer "its own residue."** A **concurrent `/prepare` session** was at that
moment authoring decision #1983 in the same tree (status flip → `preparing`, a research topic + description, a
report, an edit to #1977) — all uncommitted. Closeout mis-read that mid-flight state as batch residue and
**reverted/deleted it** (`git checkout` on the tracked files, `rm` on the untracked ones). It caused no
permanent loss **only by luck**: the `/prepare` session was still live and re-saved its work.

Verified after the fact: **no workflow subagent ever wrote the #1983 files** (zero `Write`/`Edit` tool calls to
those paths across all 25 lane transcripts). So the original "a lane over-reached into #1983" diagnosis was
false — the collision was cross-*session*, in the one tree both sessions shared.

**Two distinct defects:**
1. **Ownership-by-dirty-tree.** Closeout guessed what it owned from `git status` instead of from the changeset
   it actually produced — so it could not tell its own residue from a stranger's live edits.
2. **Half the isolation is missing.** Only the orchestrator's **lanes** are sandboxed (clones). `/prepare`,
   serial `/batch`, manual edits, **and the orchestrator's own central steps** (pre-claim, integrate, closeout)
   all write the shared checkout.

## What's already clear (not up for decision)

- Lane **execution** isolation (clones, `lane/*` refs, central integrator) is correct and stays (#1933).
- The dirty working tree is the normal baseline; `claim` ignores git state (memory rule 105). Concurrent
  *commits* to `main` are safe (git merges append-only history). The hazard is **destructive working-tree ops**
  (`checkout`/`rm`/`stash`) and **reading the dirty tree as truth** — both by automation.
- Headless **Playwright does not need the human's screen** — a lane can screenshot + assert on its own port.
  "Visual verification requires the live checkout" was a conflation of *the human eyeballing* with *automated
  regression detection*; only the former needs the shared tree.

## The fork — an escalation ladder (which rung do we commit to, and in what order)

**Rung 1 — changeset-scoped, non-destructive closeout (the minimum).** Any agent/closeout/integrator may only
touch files in **its own recorded manifest**, and may **never** revert/delete a file it did not itself write.
No "infer my residue from the dirty tree." Kills defect #1 outright, cheaply, today.

**Rung 2 — all *automated* writers run in lanes and merge back green.** Generalize the lane model beyond the
parallel orchestrator: every automated/agent writer (incl. serial batch and the orchestrator's central steps)
works in a clone and converges via `origin`. `lane/*` refs become **proto-PR units** — which is why this
**hooks cleanly into a future PR flow** (branch → gate → review → merge): the seam already exists, you wire
review + remote CI onto it rather than inventing it. Interactive *human* work stays in `main`.

**Rung 3 — lanes for *everything*, including visual work (the full "observe-only main").** Enabled by a
**per-lane multi-origin dev server** — each lane boots its own ports with the **WE + FUI cross-origin** wiring
(the vite proxy/allowlist, #210) so the constellation actually renders — plus a **headless Playwright
before/after gate**. This is the mechanism that makes observe-only main viable even for visual items like the
`.fui-card` card class (#1895/#1982), whose correctness depends on cross-origin FUI loading. **Not gated on the
branch guard** (clones sidestep it); gated on **building the per-lane server harness**.

### Residual costs of rung 3 (why it's a roadmap, not a now)

- **Per-lane bring-up is the constellation, not one `--port`.** The visual items hinge on cross-origin
  behaviour (`.fui-card` lands only where the FUI registration ESM loads), so each lane needs WE + FUI origins
  up and wired — coordinated multi-origin bring-up per lane.
- **"Screenshot" ≠ "validated" for subtle calls.** Pixel-diff flags the intended change too, so regression vs
  intended needs a blessed baseline or a judge (#1167/#1552, maturing). Mitigant: the failure that bit #1895 —
  a surface going transparent/unstyled — is screenshot-obvious and judge-trivial, so rung 3 reliably catches
  the **gross-regression** class even today; the human's eye still wins on **design-quality** nuance.

## Considered and rejected (recorded)

- **Observe-only main for *humans too*, via clones.** Forcing every manual edit / interactive `/prepare`
  through a clone strands the work away from the single dev server you watch (HMR rooted at the primary
  checkout) — steep DX tax for interactive/visual loops, and the static gate can't certify the visual
  correctness you'd most want there anyway. Rung 3's per-lane Playwright harness is the *non-DX-breaking* way
  to get the same guarantee for automation; humans keep the live checkout.
- **Branch-based isolation (feature branch in the live checkout, dev server follows).** The normal PR-shop
  shape, and it would preserve the HMR loop — but **this repo's branch guard denies branch creation in the
  shared checkout** (the #1153 finding that forced clones over worktrees). So branch-based isolation isn't
  available without revisiting the guard; the clone + per-lane-port path (rung 3) reaches the same end without
  touching it.

## Recommendation

**Adopt rung 1 now** (non-destructive, changeset-scoped closeout — it removes today's whole class of bug for
near-zero cost), **rung 2 next** (lane-isolate all automated writers; banks the proto-PR seam), and hold
**rung 3 as a roadmap item** gated on the per-lane multi-origin Playwright harness (file it under #1933 / the
explorer-judge epics). Keep interactive human work in `main` throughout — the goal is to make *automation*
safe and PR-shaped, not to evict the human from their own checkout.
