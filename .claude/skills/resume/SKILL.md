# Resume stuck lanes — finish the producer's half-done work, then land (#2200)

`/drain` lands couples that are **already ready**. But a producer (`/workflow`, `/batch`) routinely leaves
lanes that *aren't* ready — a **conflict** with a peer that landed first, a red required **`test`** (the lane
shipped a real bug), or (rarely) a **`blockedBy`** item that isn't landed yet. `/drain` skips those forever.
`/resume` is the consumer that **takes them over**: it seeds a finisher subagent with the **existing lane ref**
(reuse the ~done work — never rebuild from scratch), repairs only the broken part, and hands the now-ready
couple to the normal drain transport.

> **Reuse, not rebuild.** The work sits intact on the `lane/*` refs (WE + any coupled `frontierui` ref). Only
> the *landing* broke. A finisher clones the existing ref, rebases onto `main`, and fixes what's red — it does
> NOT re-provision a fresh lane or redo the item.

## Preconditions

- Run the mechanical parts from an **isolated clean clone on `main`** — never the shared primary checkout
  (#2197: a dirty primary makes the housekeeping `git pull` conflict and strands the tree mid-merge).
  Provision one outside `.lanes/` and **never `git pull` in the primary** — all fetch/rebase/sync happens in
  the clone. (Env setup for the finisher — symlink `node_modules` + a sibling `../frontierui` — is in the
  finisher playbook below.)
- `gh` authenticated (`gh auth status`). Landing goes through the same self-approved transport as `/drain`
  (`scripts/merge-ai-prs.mjs` / `scripts/pr-land.mjs`).
- The single-branch guard forbids `git checkout <branch>` / `git switch` / worktrees in shared checkouts. A
  finisher gets a real working tree by **`git clone --branch <laneRef> --single-branch`** (clone is not
  guarded) and pushes only to `lane/*` (allowed) — no branch switch anywhere.

## Run it

```
node scripts/lane-resume.mjs discover            # classify every stuck ready-to-merge lane + why, blockedBy-ordered
node scripts/lane-resume.mjs discover --json     # same, machine-readable (the plan the skill iterates)
```

**Always `discover` first.** It buckets the labelled PRs into `ready` (not stuck — `/drain` takes them),
`conflict` (rebase + resolve), `test-red` (a real bug to fix), `blocked` (blocker not landed — defer), and
`unknown` (recompute mergeability and re-run). It reads each lane's `.lane-manifest.json` for `item` / `repos`
/ `blockedBy`, treats a blocker as landed when its backlog file is `status: resolved` on `main`, and orders
lanes so none precedes one it is `blockedBy`.

## How the skill drives it (per pass)

1. **`discover --json`** → the ordered plan. Drop `ready` (hand to `/drain`) and `blocked` (report, defer).
2. **For each remaining lane, in order**, spawn ONE finisher subagent (Agent tool) seeded with the lane. Run
   **independent lanes in parallel**; keep a `blockedBy` chain **serial**. For a **cross-repo** couple, the
   finisher lands the impl (`frontierui`) ref **before** the WE ref (impl-first / WE-last).
3. The finisher's contract (seed = the existing ref, NOT fresh `main`):
   - `git clone --branch <laneRef> --single-branch … && cd …`; symlink `node_modules` + a sibling
     `../frontierui` if the gate/generators need them.
   - `git fetch origin main && git merge FETCH_HEAD` → **resolve conflicts**; **regenerate derived artifacts**
     rather than hand-merging them (e.g. `node scripts/grammar-scorecard.mjs` re-emits the fidelity report).
   - Run the **full** scoped gate/tests (not the file-scoped fast-fail) — the lane owns a CI-green PR (#2199).
   - **drop the transient `.lane-manifest.json`**, commit, `git push origin HEAD:refs/heads/<laneRef>`, and
     confirm the required `test` check goes green.
4. **Land** the repaired couple with the existing transport — `node scripts/merge-ai-prs.mjs
   --label=ready-to-merge` (= `/drain`) — impl-first/WE-last, `blockedBy` order. Resume does **not**
   re-implement landing.

### The one knob — how autonomous on a red test

- **resolve-only (default):** finishers fix *conflicts + regenerated artifacts* (mechanical, safe) and land
  those. A genuinely-red `test` is reported back, not code-patched.
- **`--fix` (opt-in):** the finisher also debugs and fixes the failing code, then lands. Powerful, but an agent
  "making tests pass" can paper over a real bug — only with explicit go.

## Guardrails

- **Reuses transports, never re-implements them** — repair happens in the lane clone; landing is `/drain` +
  `pr-land`. No raw `git merge`/`git push` of `main`.
- **Never rebuilds a lane from scratch** — always seeds the finisher with the existing ref. If a lane is
  truly unrecoverable, report it; don't silently re-do the item.
- **Idempotent** — a re-run's `discover` no longer lists a landed lane; a partially-repaired lane resumes from
  its pushed state.
- **Respects `blockedBy`** — never finishes a lane ahead of an unlanded blocker.
