# Finish stuck lanes — take over the producer's half-done work, then land (#2200)

> **Invoked as `/finish`.** (Was `/resume`, renamed 2026-07-03 — `/resume` is a Claude Code built-in that
> shadowed the skill so it never dispatched. The mechanism + `lane-resume.mjs` keep the "resume" mnemonic.)

`/drain` lands couples that are **already ready**. But a producer (`/workflow`, `/batch`) routinely leaves
lanes that *aren't* ready — a **conflict** with a peer that landed first, a red required **`test`** (the lane
shipped a real bug), or (rarely) a **`blockedBy`** item that isn't landed yet. `/drain` skips those forever.
`/finish` is the consumer that **takes them over**: it seeds a finisher subagent with the **existing lane ref**
(reuse the ~done work — never rebuild from scratch), repairs only the broken part, and hands the now-ready
couple to the normal drain transport.

> **Reuse, not rebuild.** The work sits intact on the `lane/*` refs (WE + any coupled `frontierui` ref). Only
> the *landing* broke. A finisher clones the existing ref, rebases onto `main`, and fixes what's red — it does
> NOT re-provision a fresh lane or redo the item.

> **All 3 repos by DEFAULT (#2383 — parity with `/drain`'s #2287).** `discover` sweeps the whole constellation
> — web-everything **+ frontierui + plateau-app** — reusing the SAME `resolveRepos` as the drain, so a stuck
> plateau-app or frontierui lane is found without a per-repo copy of the skill. Every `gh` call is `--repo`-scoped;
> a remote lane reads its manifest via the GitHub API and lands through that repo's **sibling clone** (deferred to
> the drain, #2263). The backlog is WE-global, so a remote lane's `blockedBy` still resolves against the one WE
> backlog. **Manifest-less repos degrade gracefully:** a lane with no `.lane-manifest.json` (e.g. plateau-app's
> own batch branches) gets `item`/`blockedBy` null → unordered *within* its repo, exactly like the drain's
> orphan-PR handling — never an error. Pass `--this-repo` (or `--repos=owner/a,owner/b`) to scope.

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
node scripts/lane-resume.mjs discover            # classify every stuck lane across ALL 3 repos + why, blockedBy-ordered (#2383)
node scripts/lane-resume.mjs discover --json     # same, machine-readable (the plan the skill iterates); each lane is tagged with its `repo`
node scripts/lane-resume.mjs discover --this-repo        # scope to the cwd repo only (opt out of the constellation sweep)
node scripts/lane-resume.mjs discover --repos=owner/a,owner/b   # an explicit repo set
node scripts/lane-resume.mjs land <pr> --dry-run # plan the enqueue of ONE repaired lane PR (enqueue vs rebase-drop vs skip)
node scripts/lane-resume.mjs land <pr> --repo=owner/name   # land a REMOTE constellation-repo PR (use discover's `repo` tag); omit for the cwd repo
node scripts/lane-resume.mjs land <pr>           # #2290: rebase-drop the manifest if only it conflicts, then ENQUEUE (label + trigger a single-couple drain) — never merges directly
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
4. **Land** the repaired couple. **#2290 — the drain is the sole writer to `main`.** Either hand the now-clean
   PR to `/drain` (`node scripts/merge-ai-prs.mjs --label=ready-to-merge`), or run `node
   scripts/lane-resume.mjs land <pr>` (#2202), which **enqueues** it (labels `ready-to-merge` + triggers a
   single-couple drain) rather than merging directly — both share the ONE #2198 rebase-drop-manifest helper, so
   a lane that only conflicts on the manifest lands without a human. Impl-first/WE-last, `blockedBy` order.

### The one knob — how autonomous on a red test

- **resolve-only (default):** finishers fix *conflicts + regenerated artifacts* (mechanical, safe) and land
  those. A genuinely-red `test` is reported back, not code-patched.
- **`--fix` (opt-in):** the finisher also debugs and fixes the failing code, then lands. Powerful, but an agent
  "making tests pass" can paper over a real bug — only with explicit go.

## Finisher playbook (#2202 — learned on the 2026-07-03 run)

**Env setup (do this first in every finisher clone).** Generators and gates need real deps and the sibling
impl repo: **symlink `node_modules` from the primary** (`ln -s <primary>/node_modules node_modules`) and make
the clone a **sibling of a `../frontierui`** checkout (cross-repo artifact builds resolve `../frontierui`). A
missing either → the gate fails with a spurious "cannot find module" that looks like a code bug but is an env
gap.

**Per-repo gate + env (each repo differs; run THAT repo's gate, not WE's):**

| Repo | Full gate the finisher must run | Env quirk beyond the symlink |
|---|---|---|
| **web-everything** | `npm run check:standards` | sibling `../frontierui` |
| **frontierui** | that repo's `test` script | sibling `../webeverything` |
| **plateau-app** | `node scripts/check-render-conformance.mjs` **+** `npx vitest run` | siblings `../frontierui` **and** `../webeverything`; **recreate the `@plateau/*` workspace links** |

> **plateau-app workspace-link gap (#2383 — learned 2026-07-09).** plateau-app is an npm-**workspaces** monorepo
> (`packages/*` = `@plateau/*`). A symlinked `node_modules` borrowed from a primary that predates a package
> split has **no `@plateau` scope**, so vite/vitest can't resolve `@plateau/tooling/*` and you get a spurious
> "Failed to resolve import" that looks like a lane bug but is an env gap (CI's fresh `npm install` links them).
> Fix the clone WITHOUT touching the primary: rebuild `node_modules` as a real dir that symlinks every entry
> from the primary's `node_modules`, then add `node_modules/@plateau/<pkg> → <clone>/packages/<pkg>` for each
> workspace package. `@plateau/tooling` resolves via its `exports` map (`"./*": "./src/*.ts"`); `@plateau/saas`
> /`core` have NO exports map and instead resolve through `vite.config.mts` aliases — so a NEW `@plateau/*` import
> the lane adds needs EITHER an exports map on that package OR a vite alias, or it 500s at boot.

**Conflict resolution table — resolve each conflicted path by its CLASS, never a blind hand-merge:**

| Conflicted path | Resolution |
|---|---|
| `.lane-manifest.json` (the transient manifest) | **drop it** — it is per-lane bookkeeping, not content (the `land`/drain helper does this automatically). |
| coordination JSON — `claims`/`reservations`/`capacity`/`queued` — and the `.claude/agent-memory/` tree | **take-main** — a peer session owns the newer state; your lane's copy is stale. |
| generated artifacts — grammar-scorecard report, `we:AGENTS.md`, parity report | **REGENERATE, don't hand-merge** — re-run the generator (`gen:inventory`, `grammar-scorecard.mjs`, the parity report) so the output matches the merged inputs. |
| code | **union additive by intent** (keep both sides' additions when they're independent). A genuine **same-line overlap** → **STOP and report** — never guess which side wins. |

**Recurring test-red root causes (fix MINIMALLY — never weaken or delete a test):**

- **epic-closeout** — resolving the last child of an epic ⇒ the umbrella epic must be resolved too (the
  all-slices-done gate). Resolve the parent.
- **living-catalog count-pins** — a new deliverable moves a `toBe(N)` count assertion. Bump the pinned N to the
  new true count (the test is a catalog census, not a regression).
- **reports-not-hidden** — a new `reports/*.md` the item produced trips the "report not referenced" gate. Add a
  `relatedReport:` field to the backlog item pointing at it.
- **stale generated inventory** — `we:AGENTS.md`'s generated block drifted. Regenerate it (`npm run
  gen:inventory`); never hand-edit the generated region.
- **backlog id-collision** — two files claim one NNN. The **newcomer yields** to the next free NNN
  (`scripts/backlog-renumber-collisions.mjs`, or rename by hand to the next free id).

**Landing nuances:**

- `UNSTABLE` + `test=pass` **IS mergeable** — only the `test` check is required; `cla` / Workers-Builds are
  non-required and their red never blocks a land (`landDecision` encodes this).
- **Land shared-file lanes SERIALLY and re-rebase between them** — two lanes touching one file each need the
  later one rebased onto the just-landed main; don't fan them out concurrently.
- **`discover` should warm-recompute mergeability** (`gh pr view` each) so no lane shows `UNKNOWN` — an
  `unknown` disposition means the recompute hasn't run yet, not that the lane is unlandable.

## Guardrails

- **Reuses transports, never re-implements them** — repair happens in the lane clone; landing is `/drain` +
  `pr-land`. No raw `git merge`/`git push` of `main`.
- **Never rebuilds a lane from scratch** — always seeds the finisher with the existing ref. If a lane is
  truly unrecoverable, report it; don't silently re-do the item.
- **Idempotent** — a re-run's `discover` no longer lists a landed lane; a partially-repaired lane resumes from
  its pushed state.
- **Respects `blockedBy`** — never finishes a lane ahead of an unlanded blocker.
