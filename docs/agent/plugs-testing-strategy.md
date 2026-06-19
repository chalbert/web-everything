# Plugs testing strategy

> **Status:** foundational artifact for the plugs test-coverage wave (epic #1002, slice #1009).
> Defines the per-plug coverage **bar** and exposes the per-plug **seams** the FUI coverage snapshot
> lacks. The deferred coverage slices (#1010 webvalidation, #1011 patch-interaction, plus the per-plug
> backfill #1002 re-slices after this lands) all measure themselves against this bar.

A **plug** (`we:plugs/<domain>/`) is a runtime that can install itself by monkey-patching the platform
(the *plugged* mode) **or** be used as a plain opt-in library through instantiation (the *unplugged*
mode). The #606 ruling makes the unplugged form **mandatory and the real-app surface**; plugged is the
POC/demo path. Testing a plug therefore has two orthogonal axes — the **mode** it runs in and the
**layer** the test sits at — and the bar requires coverage on both.

## The two axes

### Mode: unplugged vs plugged (#606 / #636)

| Mode | What it proves | How a test signals it |
| --- | --- | --- |
| **Unplugged** (non-invasive) | The plug works as a library with **no global patch** — importing it installs nothing; registries are plain `CustomRegistry` instances and behaviours are pure. This is the proof the plug does **not require** plugged mode. | A `we:plugs/<domain>/__tests__/unit/<domain>.unplugged.test.ts` (or a shared `we:plugs/__tests__/unplugged.*.test.ts`) that mentions `unplugged` and touches the domain. The `check:standards` dual-mode gate keys off exactly this. |
| **Plugged** | The patch installs correctly and the patched global APIs (`Node.*`, `createElement`, `injectors()`, …) behave — register + upgrade in a real (or happy-dom) DOM. | Any of the domain's own unit/integration tests, or a shared e2e spec exercising it via the global-patched path. |

Both modes are **enforced** by `validatePlugDualMode` (`we:scripts/check-standards-rules.mjs`, fs walk
in `we:scripts/check-standards.mjs`): a plug missing **either** mode's test fails the gate
(`PLUG_UNPLUGGED_TEST_ENFORCED = true`). A plug must never require plugged mode — the unplugged test is
the automated proof.

### Layer: unit (happy-dom) vs e2e (real browser)

| Layer | Runner / environment | Scope | Location |
| --- | --- | --- | --- |
| **Unit / integration** | Vitest + **happy-dom** | Per-module logic, registry semantics, a single patch's behaviour, both modes. Fast, no browser. | `we:plugs/<domain>/__tests__/unit/*.test.ts`, `…/__tests__/integration/*.test.ts` |
| **e2e** | **Playwright**, real Chromium | The full plugged `we:plugs/bootstrap.ts` over a live page — patch interactions, real DOM/Node semantics, third-party-library coexistence, SW lanes. | `we:plugs/__tests__/e2e/*.spec.ts`, `…/*.sw.spec.ts` |

happy-dom is **not** a real browser: it does not exercise the genuine `Node.*` static constants, the real
prototype chains, or third-party libraries that read them (the #960 Parchment/Quill class of regression).
A patch invariant that must hold in a real browser **needs an e2e**, not a unit test — see the
patch-interaction invariants below. This is why the gap table treats "has a dedicated real-browser spec"
as a distinct column from "passes the dual-mode gate".

## The per-plug bar

1. **Dual-mode (#606):** ship a passing unplugged-mode test **and** a plugged-mode test. Non-negotiable;
   gate-enforced.
2. **Line/branch coverage:** the global threshold in `we:vitest.config.ts` is **80%** for lines,
   functions, branches, statements over `plugs/**/*.ts` (and `blocks/**/*.ts`), excluding `**/index.ts`,
   `**/__tests__/**`, and `*.test.ts`/`*.spec.ts`. This is a **whole-mirror floor**, not a per-plug gate —
   a thin plug can sit below 80% as long as the aggregate clears it, which is the per-plug seam the
   coverage wave closes.
3. **Patch-interaction invariants:** any plug that patches a global must have a test (e2e where the
   invariant is browser-real) proving the patch is **non-destructive** under the full bootstrap (below).
4. **Dedicated real-browser e2e:** a plug whose plugged behaviour touches real `Node`/DOM semantics or
   third-party DOM libraries should carry (or be exercised by) a Playwright spec, not just happy-dom units.

## Patch-interaction invariants (the #1011 harness scope)

When several plugs install under one `we:plugs/bootstrap.ts`, the global state must survive **all** of
them. The invariants:

- **`Node.*` static constants intact** (`TEXT_NODE`/`ELEMENT_NODE`/…) after every patch — the exact #960
  regression that broke Parchment/Quill. happy-dom can mask this; assert it in a real browser.
- **Third-party DOM libraries still instantiate** under the bootstrap (no patched method changes a
  signature a library depends on).
- **Plugged ↔ unplugged parity** where behaviour must be identical — the same input yields the same
  result whether or not the global patch is installed.

These are **cross-plug** invariants (one coherent suite, not per-plug); #1011 builds the harness.

## New-plug checklist

When adding `we:plugs/<domain>/`:

- [ ] An **unplugged-mode** unit test `__tests__/unit/<domain>.unplugged.test.ts` proving no-global-patch
      use (standalone instantiation, two scoped instances stay independent).
- [ ] A **plugged-mode** test (the domain's own register/upgrade unit/integration test, or a shared e2e).
- [ ] If the plug patches a global: a **patch-interaction** assertion (e2e if the invariant is
      browser-real) that the patch is non-destructive under the full bootstrap.
- [ ] Source modules stay above the **80%** coverage floor (don't drag the mirror aggregate down).
- [ ] If it ships a contract that FUI consumes: the type-only half lives in a `contract.ts` seam
      (`@webeverything/contracts/<domain>` candidate), the runtime half next door — see the `we:guard/`
      and `we:analytics/` precedents.

## Per-plug coverage / gap table (WE `we:plugs/` mirror, 2026-06-18)

Counts are the WE-mirror source modules (excluding `index.ts`), the domain's own unit/integration test
files and `it`/`test` cases, the #606 dual-mode status (gate classification), and the count of shared
real-browser e2e specs that exercise the domain. **All 11 plugs now clear the dual-mode gate** — the open
seam is the **e2e** column (five plugs are unit/unplugged-only) and the thin-plug coverage tail.

| plug | src mods | unit files | unit cases | unplugged | plugged | shared e2e | seam |
| --- | --: | --: | --: | :-: | :-: | --: | --- |
| webanalytics | 1 | 2 | 12 | ✓ | ✓ | 0 | new (#1012); no e2e yet |
| webbehaviors | 7 | 4 | 83 | ✓ | ✓ | 4 | — |
| webcomponents | 4 | 3 | 55 | ✓ | ✓ | 4 | — |
| webcontexts | 3 | 5 | 65 | ✓ | ✓ | 3 | — |
| webdirectives | 1 | 2 | 36 | ✓ | ✓ | 0 | **no real-browser e2e** |
| webexpressions | 8 | 5 | 88 | ✓ | ✓ | 0 | **no e2e; 8 mods / 5 unit files (thin)** |
| webguards | 1 | 2 | 12 | ✓ | ✓ | 0 | **no real-browser e2e** |
| webinjectors | 9 | 18 | 188 | ✓ | ✓ | 6 | — (reference depth) |
| webregistries | 3 | 3 | 37 | ✓ | ✓ | 4 | — |
| webstates | 2 | 3 | 59 | ✓ | ✓ | 3 | — |
| webvalidation | 5 | 6 | 51 | ✓ | ✓ | 0 | **no dedicated e2e (#1010 fills)** |

**Open seams the coverage wave (#1002) closes, in priority order:**

1. **Dedicated real-browser e2e for the five unit/unplugged-only plugs** — webvalidation (#1010),
   webdirectives, webexpressions, webguards, webanalytics. These pass happy-dom + unplugged but have no
   Playwright proof of their plugged behaviour over real `Node`/DOM semantics.
2. **Cross-plug patch-interaction harness** (#1011) — the #960-class `Node.*`-statics + third-party-lib +
   parity invariants, which no current test covers.
3. **Thin-plug coverage tail** — webexpressions (8 modules, 5 unit files) is the widest surface-to-test
   gap; the 80% floor is a mirror aggregate, so per-plug under-coverage hides here.

> **Measurement note.** Per-plug line-% is governed by the single 80% aggregate in `we:vitest.config.ts`,
> not a per-plug gate; a clean per-plug line-% breakdown requires a quiescent tree (the full happy-dom
> suite must be green), so it is captured per-plug as each coverage slice lands rather than as a one-shot
> snapshot here. The table above measures **test-layer/mode presence** — the structural gap the FUI
> snapshot lacks — which is stable regardless of concurrent in-flight work.
