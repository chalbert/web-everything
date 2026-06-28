---
kind: story
size: 8
parent: "1836"
relatedProject: webplugs
locus: frontierui
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
relatedReport: reports/2026-06-27-plugged-diagnostic-compatibility-postures.md
tags: [plugs, unplugged, residue, diagnostic, compatibility, dev-experience, config]
---

# Build the observe-only posture instrument + upgrade queue (diagnostic & compatibility) — FUI

## Digest

Implement the posture family ratified in #1872: an observe-only prototype-method wrapper (observe-then-forward, NOT a Proxy) over the method set plugged patches, plus a microtask-batched dirty-set upgrade queue with a shipped synchronous flush(). Two linked build-time investigations gate the instrument choice: (1) measure each instrument's CAPTURE SET — the wrapper (creation-time + call-site, patched-method-set only) vs a global MutationObserver (any connected insertion, post-hoc, no call-site) — to confirm the likely complementary split (wrapper->diagnostic, MO->compatibility); (2) test whether a PURE-MutationObserver compatibility (patches nothing) is complete enough to FOLD INTO unplugged as an opt-in autoUpgrade config knob (candidate default-on). Layer carve: posture enum/contract -> WE type-only; instrument + queue -> FUI; selected value -> project config. Diagnostic/compatibility default off in prod; runtime posture switch needs a reload (insertion-patch teardown irreversible).

## Governing decision

Ruled by **#1872** (ratified 2026-06-27) — *Plugged diagnostic & compatibility modes*. Both forks ratified at
their prepared defaults; the wrapper-vs-`MutationObserver` instrument choice is the open capture investigation
this build resolves with measured evidence. See the report
[we:reports/2026-06-27-plugged-diagnostic-compatibility-postures.md](reports/2026-06-27-plugged-diagnostic-compatibility-postures.md).

## Scope (build-ready)

1. **Posture enum/contract → WE (type-only).** The posture identifiers + the per-plug/global selection shape as
   a type-only contract (config-extends-platform-default).
2. **Observe-only instrument → FUI.** The prototype-method wrapper (observe-then-forward over the same set
   plugged patches — `createElement`, insertion methods), giving call-site attribution for **diagnostic**.
3. **Upgrade queue → FUI.** Microtask-batched dirty-`Set` flush + shipped synchronous `flush()`; dedup is
   cost-load-bearing (`fui:plugs/unplugged.ts` `upgrade` has no early-return, re-walks every plug).
4. **Investigation (1) — capture map.** Measure what the wrapper vs a global `MutationObserver` each actually
   capture; confirm/revise the complementary split (wrapper→diagnostic, MO→compatibility).
5. **Investigation (2) — pure-MO fold.** Test whether MO-only compatibility (patches nothing) is complete
   enough to **fold into unplugged** as an opt-in `autoUpgrade` config knob (candidate default-on, but always a
   knob — MO is semantics-safe but not footprint-free). If so, the enum may not need a separate `compatibility`
   member. Relates #1858 (unplugged ergonomics).

## Riders (from #1872)

- Postures and plugged both own `Element.prototype.append` etc. → **install-time mutually exclusive** with
  plugged (the pure-MO path is exempt — it patches nothing).
- Insertion-patch teardown is irreversible → **runtime posture switch needs a page reload**, not a hot swap.
- Diagnostic output is a signal source the autonomous explorer (#1167) can consume (downstream consumer).

## Progress (batch-2026-06-27)

Built the #1872 posture family across the ratified layer carve:

1. **Posture enum/contract → WE (type-only):** `we:contracts/posture.ts` (zero runtime emit, #1282) —
   `PluggedPosture = 'unplugged' | 'diagnostic' | 'plugged'`, the per-plug/global `PostureSelection`, and the
   `UnpluggedAutoUpgradeConfig` (the folded compatibility knob). Aliased into FUI (`fui:tsconfig.json` +
   `fui:vitest.config.ts`).
2. **Observe-only instrument → FUI:** `fui:plugs/observeOnly.ts` `installObserveInstrument()` — a **global**
   prototype-method **wrapper** (observe-then-forward, NOT a `Proxy`; mirrors plugged's reassignment) over
   `createElement` + the insertion method set (`append`/`prepend`/`before`/`after`/`replaceWith`/
   `replaceChildren`/`insertAdjacentElement` + `appendChild`/`insertBefore`). Reports call-site +
   creation-time attribution to an `onObserve` sink (the diagnostic value), forwards the original result
   untouched (semantics never altered), and enqueues the connected root for a deferred upgrade. Returns a
   teardown that restores every original (clean-realm switch).
3. **Upgrade queue → FUI:** `UpgradeQueue` — microtask-batched dirty-`Set`, flushed once per tick over a
   snapshot, with a synchronous `flush()` escape hatch. Snapshot-then-clear so a root enqueued *during* flush
   re-schedules (never lost). Dedup is cost-load-bearing (unplugged `upgrade` has no early-return).
4. **Investigation (1) — capture map:** confirmed (test) the **complementary split** #1872 anticipated — the
   wrapper captures element **creation before connection** (and call-site), which a `MutationObserver`
   structurally cannot; an MO sees only connected, post-hoc insertions. → wrapper = **diagnostic**, MO =
   **compatibility**.
5. **Investigation (2) — pure-MO fold:** `installAutoUpgradeObserver()` is the pure-`MutationObserver`
   compatibility path — it **patches nothing** (verified: no prototype member reassigned), so it violates no
   unplugged invariant and **folds into unplugged** as the `autoUpgrade` knob (candidate default-on, always
   overridable) rather than a separate posture rung. So the enum needs no separate `compatibility` member —
   `diagnostic` is the only separate observe-only rung (it *must* patch to attribute).

**Selected posture VALUE → project config** (config-extends-platform-default) is the downstream consumer's
concern — this build ships the contract + instrument; a project selects `PostureSelection`. Riders honoured:
diagnostic is install-time mutually exclusive with plugged (it reassigns the same members), the pure-MO path
is exempt, and the instrument's teardown is for tests/clean-realm switches (a live posture switch still wants
a reload). Tests: `fui:plugs/__tests__/unit/observeOnly.test.ts` (8) — queue dedup/microtask/sync-flush/
snapshot-reentrancy, wrapper semantics-unchanged + creation/insert attribution + root-enqueue + teardown
restore, pure-MO no-patch wiring, the capture-set split. `check:standards` (FUI + WE) + `tsc` green.
