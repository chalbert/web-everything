# Backlog split analysis — #1783 (the #899/#1294 conformance-surface foundation)

**Date:** 2026-06-26
**Focus:** `/slice 1783` after #1784 ratified (b) the #899 declarative-vector KIT for facts→verdict runtimes.
**Verdict:** **PARTIAL SPLIT.** One slice carves clean and batchable now (the WE synchronous binding variant); the runner-bundle slice buries an unresolved fork and is **could-not-split** until a new placement decision lands.

## Investigation (real seams, not the body's framing)

- **The WE side is small and ready.** `we:conformance-vectors/schema.ts:21-27` *already* models synchronous vectors ("Virtual-clock offset … omitted = synchronous / order-only"; `neverObserved` is the temporal-only guard). The only friction is `we:conformance-vectors/binding.ts:24-39` — `ConformanceBinding.clock` is a **required** field, so a facts→verdict binding is forced to carry temporal machinery it never uses. Making `clock` optional (or shipping a no-op `SynchronousClock`) is a self-contained WE change with existing tests (`we:conformance-vectors/__tests__/`).
- **The runner is generic but plateau-homed.** `plateau:src/conformance-engine/conformanceVectors.ts` (172 LOC) + `plateau:src/conformance-engine/virtualClock.ts` (83 LOC) import **zero** plateau-specific code — only the WE `@webeverything/conformance-vectors/*` contracts + a shared `Finding` type. #1597 homed it in plateau as the "neutral runner" (#1576-(2)).
- **The FUI-origin-bundle requirement collides with the edge rule.** #1784 ruled the docs site mode-C-loads a **FUI-origin** runner bundle (a plateau-origin bundle is refused by mode-C's #765 trust gate, `fui:embed/in-document.ts:44-45`). But FUI **must not import plateau** — that is a backward edge (WE→FUI→plateau; the DAG bans upstream code imports, #1595), build-time or runtime. So "re-export the plateau runner as a FUI bundle" is not buildable as stated — it needs the runner's home resolved first.
- **Webpolicy isn't in FUI yet** (`fui:webpolicy/` absent) — confirming #1783 is the *generic* foundation; the webpolicy-specific binding + corpus belong to #1294's relocation, not here.

## Could split (carve now)

| Slice | workItem · size | Home | Scope | Batchable |
|---|---|---|---|---|
| **A — WE clock-optional synchronous `ConformanceBinding` variant** | story · 3 | webeverything | Make `clock` optional (or add a no-op `SynchronousClock`) in `we:conformance-vectors/binding.ts`; confirm the validator/schema sync path; add a synchronous-binding test. Unblocks any facts→verdict binding from needing temporal machinery. | ✅ ready now |

## Could not split (gated on a new decision)

| Slice | Failed rubric condition | Unblocking action |
|---|---|---|
| **B — FUI-origin conformance-runner mode-C bundle (+ end-to-end smoke proof)** | *no buried fork* + *real home*: the bundle can't be built without resolving how the plateau-homed runner becomes FUI-origin-loadable without a FUI→plateau backward edge | Resolve new decision **(filed below)**: the conformance-runner's home/serving given the FUI-origin-bundle requirement |

### The buried fork → a new `type:decision`

**Home of the generic conformance runner, given the FUI-origin mode-C-bundle requirement.** Coherent branches (none free):
- **(i) Re-home the generic runner plateau→FUI** as a reference-impl-tier engine (it is impl-agnostic, zero-plateau-dep) — aligns with #899's own "runnable backends → FUI"; plateau keeps only the *hosted exerciser*. Reverses #1597/#1576-(2)'s "neutral runner → plateau."
- **(ii) Keep the runner in plateau; widen mode-C's #765 trust allowlist** to admit the plateau demo-host origin for the docs site. Reopens the #765 trust boundary.
- **(iii) Other** (e.g. a thin FUI-authored runner that consumes only WE contracts, leaving plateau's as the hosted variant — a controlled duplication of a 255-LOC generic engine).

This is a genuine fork (#899 "backends→FUI" vs #1597 "runner→plateau" are in tension once the runner must be FUI-origin-loadable), so it goes to its own card, not buried in #1783's body.

## Proposed shape

Convert #1783 → storied epic with: **Slice A** (ready, batchable) + **Slice B** (blocked on the new runner-home decision). File the runner-home decision; B `blockedBy` it. #1294 stays blocked on #1783 (now an epic) until both slices land.
