# Enforcing the zero-implementation boundary — audit-once versus a standing fitness function

**Date**: 2026-08-17
**Point**: The zero-impl rule has no carrier at all, the repo already built the right cross-repo gate and then deleted its subject, and the recurring defect is not stale prose but instruments that silently stop covering anything. Prepared as the grounding for decision #1770.
**Research page**: `/research/zero-impl-boundary-enforcement/`

---

## Question

Backlog item **#1770** is a review-gate decision: *"once all relocations land, audit the end-state
constellation placement and confirm the zero-impl / standard·impl·product line is tight."* Its stated call was
**A — tight** or **B — residuals found**.

That is not a decidable fork; it is the *result* of a measurement. So the question this research answers is the
one level up:

> When a repo carries a hard layering rule — here, *"WE holds zero implementation"*
> (`we:docs/agent/platform-decisions.md`, [constellation-placement](../docs/agent/platform-decisions.md) rule 1,
> #1246/#1282) — what **instrument** confirms the rule holds, and what keeps that confirmation true a month
> later?

## Recommendation

**GO on a narrow, three-part instrument — not a whole-tree classifier, and not a codified map.**

1. **Re-point the dormant byte-parity gate.** `validatePlugWeFuiDrift` + `PLUG_SHARED_CORE_FILES` already exists,
   is unit-tested, and has `PLUG_DRIFT_ENFORCED = true`. It is vacuous because #1047 deleted its subject
   `we:plugs/`. It is the only mechanism that catches the actual observed defects.
2. **A new-path check over the named debt roots only**, with a **path-set ratchet** (a path may leave the debt
   list, never join it).
3. **A coverage tripwire** — an `existsSync`-guarded check whose subject has vanished must ERROR, not skip.
   This is the **best-evidenced** of the three (finding 3 is its evidence base) and the only one that protects
   the other two: #872 is chartered to retire the byte-replication that part 1 gates, so part 1's own subject is
   scheduled for deletion, and only part 3 catches that recurrence.

**The whole-tree classifier was drafted, executed, and rejected on measurement.** See finding 5.

**On the decision shape:** two independent fresh-context screens found merit *flatly conceded* — the rule is
ratified statute with no carrier — so per #2092 the validation gate **dissolves** to accepted-on-merit plus a
scheduling edge, compressing the human turn to a batch-confirm. The card stays `open`: a prep author's prose
concession is not the human validation.

## Key findings

### 1. The zero-impl rule has no enforcement whatsoever

Grepping `we:scripts/`, `.githooks/` and `.github/workflows/` for the rule's own lineage (`1282`, `1246`,
`zero-impl`, "delivery runtime", "WE-resident") returns **two hits, both prose comments**, both belonging to the
#2052 standard-vs-site classifier. There is no `check:no-impl` and no path classifier over `we:blocks/`. The
clause *"no **new** WE-resident delivery runtime may be added"* is enforced by model judgment alone.

The nearest guard, `we:scripts/guard-backward-edge.mjs`, denies a static `@frontierui` import — but its
documented scope (`:13`) is WE's own `src/**`. Ten non-test files under `we:blocks/` already carry that import
and every one sits outside the scope.

### 2. The repo already built the right instrument, then deleted its subject

`validatePlugWeFuiDrift` (`we:scripts/check-standards-rules.mjs`, wired at `we:scripts/check-standards.mjs:1588`
§8f) is a **cross-repo byte-identity gate** with a curated `PLUG_SHARED_CORE_FILES` list and
`PLUG_DRIFT_ENFORCED = true`. It is exactly the shape needed for the two vendored-generator defects. It is
**vacuous**: `we:plugs/` was deleted by #1047, its `existsSync` guard is false, and it reports success while
checking nothing.

The same pattern killed a second check. §9c *codegen-placement invariants* (#964) at
`we:scripts/check-standards.mjs:1786` reads a MaaS module that #1730 deleted; `existsSync`-guarded, arm (2)
silently went dead.

### 3. The real failure mode is silent scope-loss, not stale documentation

The first draft of this research argued *"prose rots, code stays true."* **This repo refutes that.** Four
instances of one defect — an instrument whose subject disappears with nothing reporting the coverage drop:

| Instance | How it lost its subject |
| --- | --- |
| `validatePlugWeFuiDrift` | Subject `we:plugs/` deleted by #1047 → vacuous, still green |
| §9c arm (2) | Subject MaaS module deleted by #1730 → dead, still green |
| gen-wrapper fixture | Sanctioned by #892 on 2026-06-18; #1282 withdrew the whole tier on 2026-06-20 — it **survived its own repeal by two days** |
| #1245 slice coverage | 16 families named in the plan, 4 carved into items; all 4 resolved, so the epic reads done |

A ruling changes a rule but enumerates nothing. A check that cannot report *"I now cover N paths, down from M"*
is one deletion away from decorative.

### 4. The residual mass, measured

Tracked, non-test TypeScript, via `git ls-files`:

Under `we:blocks/` the total is **8,960**; deducting 1,147 lines of fixtures, 1,220 of contract and types
modules, and the 330 contract-only lines of `we:blocks/renderers/module-service/` gives **≈6,263 lines of
delivery runtime**. Per-family figures below are *whole-family* totals (they include each family's own
contract/types/fixture lines), so they sum above that aggregate rather than partitioning it.

| Location | Lines | Call |
| --- | --- | --- |
| `we:blocks/` total | 8,960 | ≈6,263 delivery runtime after deductions |
| `we:blocks/router/` | 2,843 (19 files) | Custom elements, behaviors, artifact emitters — impl (~741 types/fixtures) |
| `we:blocks/renderers/` | 3,970 | JSX renderer, strategy + auto-define registries — impl |
| `we:blocks/resource-loader/` | 784 | Orchestrator with state machine + AbortController — impl |
| **Nine subsystem roots outside `we:blocks/`** | **5,883** | Provider+registry pairs — rule 2's literal example |
| `we:capabilities/` | 2,418 | Live feature detection + policy resolution |
| `we:validation-generation/` | 1,570 | Header self-declares *"the **impl** half … kept in WE for now"* |
| `we:guard/` | 397 | Header self-declares *"the runtime-impl half"* |
| `we:validity-merge/` · `we:validator-resolution/` | 373 · 346 | |
| `we:source-resolution/` · `we:commitment-policy/` | 264 · 255 | |
| `we:conformance-evidence/` · `we:module-resolution/` | 143 · 117 | |

Against that: the relocations that ran, ran cleanly. `we:tools/maas/vite-plugin.ts` is gone (#1730);
`we:plugs/` is gone (#1047); ~23 subsystem roots are a single contract module each. The failure is not the
moves — it is that nothing holds the line between them.

**Cross-repo duplication:** at the **same relative path**, across TypeScript/JavaScript/JSON/CSS/HTML —
**92 pairs, 30 byte-identical, 62 drifted**, no reconciliation gate live. A wider file-set definition gives
109/30/79; the number is definition-sensitive, so the method is stated. Notably this measure **misses** the two
headline generators, which sit at different relative paths (`we:scripts/` vs `fui:tools/`) — which is why the
re-pointed gate needs a declared pair list rather than a path-equality sweep.

### 5. The whole-tree classifier was drafted, executed, and fails

Widening #2052's `classifySurfacePaths` from its `src/` zone to the whole tracked tree is the intuitive move.
Running the drafted matcher set verbatim over all 6,980 tracked paths: 712 site / 1,114 standard / 124 impl /
4,256 neutral / **774 hard errors** — including 41 under `we:contracts/`, 26 under `we:conformance-vectors/`, 12
under `we:capability-manifest/`, 11 under `we:webcases/`: precisely the set finding 4 certifies as correctly
placed. All 12 contract and types modules under `we:blocks/` also error, because the standard-surface matchers
only reach `we:src/_data/`.

Worse, it is **green on both motivating defects**. gen-wrapper would be allow-listed as known debt, and the
observed drift is FUI growing while WE stands still — the WE-side count never moves. A path classifier cannot
see file content and cannot see the sibling repo.

And #2052's own source comment (`we:scripts/check-standards-rules.mjs:2048`–`:2052`) documents the widening as
**considered and rejected**: *"classifying them would be noise and would red-gate the whole repo."* The precedent
runs the opposite way to how the first draft cited it.

### 6. A hand audit of a working tree produces false residuals

An initial sweep flagged three `we:blocks/` directories as "orphaned copies" — files but no TypeScript source.
`git ls-files` shows **zero tracked files** in all three: local build debris, invisible to CI, not a placement
residual. A `git ls-files`-based instrument is immune to this class of error; a human reading the working tree is
not.

## Prior art

Full comparison table and sources in the `/research/` write-up. The three load-bearing conclusions:

- **Only five surveyed tools ship true exhaustiveness** (`import-linter` `exhaustive`, `eslint-plugin-boundaries`
  `no-unknown-files`, ArchUnit's all-classes-contained assertion, Nx's untagged-denial, dependency-cruiser's
  `not-in-allowed`). Default-deny is the *language* norm and the *lint* exception — and every config-driven
  fail-closed tool ships a catch-all that turns it off. Every failure in the survey traces to the escape hatch.
- **No standards body has a written "this repo holds no implementation" policy.** WPT carries the only *named*
  anti-implementation rule found anywhere (a lint banning Chromium Mojo bindings). OpenFeature is the closest
  analogue and its honest carve-out is the lesson: its spec repo *does* ship code under a tools directory. Zero
  implementation is enforceable only once the exceptions are written down.
- **A current-state inventory does not belong in a decision record** — Zimmermann's "Mega-ADR" / "Blueprint in
  Disguise" anti-patterns, Microsoft's *"Avoid making decision records design guides"*, and Lethbridge et al.'s
  finding that a document's accuracy governs its use more strongly the closer it sits to the code. The shape that
  dissolves the doc-vs-check question is OpenFeature's and test262's **generator + diff gate**: the map becomes a
  projection of the classifier, so it cannot go stale.

**Two corrections to the folk version of the fitness-function argument**, worth carrying: in *Building
Evolutionary Architectures* a CI check is a **triggered** fitness function, not a *continual* one (continual means
production monitoring), so the axis is automated-vs-manual; and the general technique never reached "Adopt" on the
ThoughtWorks Radar — only narrow, concrete instantiations did. Both support the narrow instrument over the broad
one.

## Files created/modified

| File | Action |
| --- | --- |
| `we:backlog/1770-audit-the-end-state-constellation-placement-once-all-relocat.md` | Rewritten to the validation-gate shape; `preparedDate` stamped |
| `we:src/_data/researchTopics/zero-impl-boundary-enforcement.json` | Created — research topic registry entry |
| `we:src/_includes/research-descriptions/zero-impl-boundary-enforcement.njk` | Created — research write-up |
| `we:reports/2026-08-17-zero-impl-boundary-enforcement.md` | This report |
