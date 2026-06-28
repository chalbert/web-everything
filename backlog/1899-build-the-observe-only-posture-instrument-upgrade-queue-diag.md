---
kind: story
size: 8
parent: "1836"
relatedProject: webplugs
locus: frontierui
status: open
dateOpened: "2026-06-28"
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
