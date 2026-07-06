# Backlog split analysis — 2026-07-05 (focused: #2275)

Focused `/slice 2275`. #2275 *"Generalize the lane pool into a use-agnostic leased-checkout allocator"* is a
`story·5` — **below the `size > 8` split threshold**, so not a normal candidate. It qualifies as a *focused*
split for a different reason: **scope (1)+(2) just shipped** (the lease primitive — [PR #167](https://github.com/chalbert/web-everything/pull/167),
`ready-to-merge`), leaving the story **half-done**, and the remaining scope (3)+(4) carries a real
foundational seam. Slicing turns a half-done story into an honest epic: a *resolved* slice for the delivered
lease primitive + open slices for the remaining drain/merge migration, so the migration is a claimable card,
not scope buried in a "still-open" story.

## Work-investigation pass (grounded — I just built scope 1+2)

- **Delivered (scope 1+2):** `we:scripts/lane-pool.mjs` `acquire`/`release` + the pure
  `we:scripts/lib/lane-lease.mjs` (18 unit tests). This is a real, landed artifact → its slice is **resolved**.
- **The migration surface (scope 3+4)** — the bespoke drain clone recipe:
  `we:skills-src/drain/SKILL.md:22-52` hand-rolls `git clone --local <primary> ../we-drain-clean`; its mirror
  `we:.claude/skills/drain/SKILL.md:32`. The lander resolves cross-repo sibling clones at
  `we:scripts/merge-ai-prs.mjs:468-474` (`siblingCloneDir` → `../frontierui`, `../plateau-app`) for
  rebase-drop of non-local tips.
- **The foundational seam I found live:** a leased pool lane can stand in for `../we-drain-clean` *only if the
  pool root carries **writable** `frontierui` + `plateau-app` clones* — but today the pool provisions just a
  `frontierui` **symlink** (a render artifact, `we:scripts/lane-pool.mjs:165-199`) and **no `plateau-app`** at
  all. A naive `acquire`-and-`cd` migration would **regress** cross-repo rebase-drop. So the sibling-clone
  provisioning is a genuine prerequisite the migration builds on — a real slice boundary, not fragmentation.

## Could split — #2275 → epic (1 resolved + 2 open slices)

| Slice | kind / size | Scope | Blocked by |
|---|---|---|---|
| **A** — lease primitive (`acquire`/`release` exclusive hold) | `story` / 2 · **RESOLVED** | Scope (1)+(2), already landed via PR #167: atomic `O_EXCL` lease marker, `refresh`/`provision` skip a held lane, `status` surfaces it, pure `we:scripts/lib/lane-lease.mjs` + 18 tests. `graduatedTo: none` (enhanced `we:scripts/lane-pool.mjs`, added `we:scripts/lib/lane-lease.mjs`). | #2267 (✓) |
| **B1** — allocator provisions writable `frontierui`+`plateau-app` sibling clones | `story` / 3 | Extend the `ensureFuiSibling` pattern (`we:scripts/lane-pool.mjs:165-199`) into a **sibling-clone provisioner**: real, pushable clones of the other constellation repos at the pool root, so a leased lane's `../frontierui`/`../plateau-app` (what `we:scripts/merge-ai-prs.mjs:468-474` resolves) are valid rebase-drop targets — not the render-only symlink. Foundational + independently unit-testable. | — |
| **B2** — migrate `/drain` + `/merge` onto the leased allocator (+ config root) | `story` / 3 | Scope (3)+(4): rewrite the `/drain` + `/merge` skill preconditions (`we:skills-src/drain/SKILL.md:22-52` + the `.claude` mirror) and `we:scripts/merge-ai-prs.mjs` to `acquire → work → release` instead of `git clone --local … ../we-drain-clean`; delete the hand-rolled recipe; make the checkout root allocator config so no skill hardcodes `../we-drain-clean` / the `.lanes` root. | B1 |

**Slice DAG (incremental delivery):** `#2267 (✓) → A (✓ this PR)`; `B1` (free) ; `A + B1 → B2`.

**Rubric verdict — all five hold:**

1. **Volume, not fork.** No buried decision — the reframe (a lane is a use-agnostic leased checkout) is
   settled in the body; scope 4's *managed-root / remote-executor* forks are already carved out as explicit
   follow-ons. What remains is build volume, not an open call.
2. **≥2 nameable slices, each a real home.** A (resolved), B1, B2 — each its own `story`.
3. **Slices land small.** A·2, B1·3, B2·3 — all ≤3, named files `file:line`-grounded above.
4. **Clean DAG, incremental delivery.** A already shipped and is valuable alone; B1 ships a standalone
   allocator capability (unit-testable, harmless if unused); B2 consumes both. Each is a usable increment.
5. **Every slice leaves a valid, demoable state.** A landed green; B1 leaves the pool with extra sibling
   clones (valid, unused-safe); B2 leaves the drain migrated. Proven by tests + exercising the CLI/drain
   (allocator tooling, not a standards feature — same proof bar as A).

## Could not split

None — the focused candidate splits cleanly. (Note: this is a *below-threshold* focused split justified by
partial completion, not an oversized-story split.)

## Net

**#2275**: converts `story·5` → **epic** (size dropped; umbrella digest). A is scaffolded **resolved**
(records the delivered 2 pts); B1/B2 open (6 pts remaining). Because these ride on top of the still-unlanded
PR #167 (which already edits #2275), the split executes as a **second commit in the same lane / PR** to avoid
two PRs conflicting on `#2275` — retitling #167 to cover both.
