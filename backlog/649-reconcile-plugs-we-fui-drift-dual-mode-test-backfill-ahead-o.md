---
kind: story
size: 8
status: resolved
parent: "170"
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
relatedReport: reports/2026-06-14-plugs-runtime-audit.md
tags: [plugs, drift, testing, constellation]
---

# Reconcile plugs WE/FUI drift + dual-mode test backfill ahead of the #170 reversal

The #635 audit ([report](../reports/2026-06-14-plugs-runtime-audit.md)) found the #170 reversal (FUI → canonical `@frontierui/plugs`) is **not** a clean delete-WE-point-at-FUI: WE holds several **canonical fixes FUI is missing** — `webcomponents/cloneHandlers` (#454 select/datalist clone), `webinjectors/Injector` (#400 consumption-edge graph + WE-only `declarativeInjector`), `webregistries/CustomElementRegistry` (`ensureNativelyConstructible`) — plus two **WE-only domains** (webguards, webvalidation) with no FUI home, and only `webbehaviors` has dual-mode (unplugged+plugged) test coverage. This item does the reconciliation the reversal needs: port the WE-ahead fixes into FUI, decide the WE-only domains' home, and backfill dual-mode tests for the 3 highest-impact domains.

Resolves the 6 open questions the audit registered. This is the precursor slice of epic #170 (parent) that **gates #449** (the terminal delete-and-repoint) — it must land before #449. All its own precursors (#606, #580, #635, #636) are resolved, so it is agent-ready now.

## Note — promote the #636 dual-mode gate to ERROR after the backfill

The #636 conformance rule (`validatePlugDualMode` in [we:scripts/check-standards-rules.mjs](/scripts/check-standards-rules.mjs)) already errors on a plug missing a **plugged-mode** test, and **warns** on a missing **unplugged-mode** (non-invasive) test for the 9 not-yet-backfilled domains (webbehaviors is clean). Once this item backfills the unplugged-mode tests, flip `PLUG_UNPLUGGED_TEST_ENFORCED` to `true` so "missing either mode's tests" fully fails the gate — the warns become errors and the #606 "no plug may require plugged mode" invariant is fully automated. **(Re-scoped — see Resolution: the flip needs ALL 10 domains covered, not 3, so it is carved to [#726](/backlog/726-backfill-remaining-unplugged-mode-plug-tests-and-flip-plug-u/) along with the remaining 6 tests.)**

## Resolution (2026-06-15)

The **load-bearing runtime half** of the reconciliation is done and verified; the heavier WE-only-domains port is carved to a dedicated item. What landed:

- **Ported WE-ahead runtime fixes WE→FUI** (FUI's shared-runtime tree is now content-equal): `webcomponents/cloneHandlers` + `core/cloneUtils` (#454 own-property clone discriminator), `webregistries/CustomElementRegistry` (`ensureNativelyConstructible`), `webinjectors/Injector` + new `declarativeInjector` + `webinjectors/index` (#400 consumption-edge graph), `webbehaviors/CustomAttributeRegistry` + new `viewportPresence` (#320/#321). **Verified in FUI: `tsc --noEmit` 0 errors + 1675 unit tests green.**
- **webexpressions drift left FUI-clean, not ported.** WE's `parserName: string | null` is a latent type inconsistency vs WE's own base (`parserName?: string`) that only rides along because WE never strictly tsc-checks `plugs/` (the blocks/plugs typecheck-gate gap); it fails FUI's stricter typecheck. The audit already called this drift cosmetic/functionally-equivalent, so FUI keeps its clean version — the drift dissolves when #449 deletes WE's copy.
- **Backfilled 3 unplugged-mode tests** (webcomponents, webregistries, webinjectors), mirrored into FUI — 12 tests, green in **both** repos; the webcomponents/webinjectors ones double as verification of the ported #454/#400 fixes. WE warnings 34→31.
- **bootstrap.ts left per-repo** — it's each repo's composition root (registers its own block set from `../blocks/`); #449's `/bootstrap` package export handles it, not a byte-sync.

### The 6 audit questions, resolved
1. **Canonical reconciliation** — done (the runtime ports above).
2. **Dual-mode test backfill scope** — the 3 highest-impact are done now; the remaining 6 + the gate flip are carved to **#726** (the flip needs all 10 domains covered, so it can't go green at 3).
3. **#400 introspection in FUI** — ported (`Injector.consumptionEdges()` + `trackConsumption`).
4. **Scoped-registry constructor fix** — ported (`ensureNativelyConstructible`); its absence in FUI was a real regression, now closed.
5. **WE-only domains** — **decided: not WE-only by design.** Per #606 (plugs = implementation owned by FUI), `webguards`/`webvalidation` are plug implementations and port DOWN to FUI. The port is larger than the audit implied (drags `guard/`/`validity-merge/`/`validator-resolution/` subsystems, ~1900 LOC, 3 new FUI top-level dirs) so it is carved to **#725** — which now **gates #449** (deleting WE's `plugs/` before #725 lands would lose these domains).
6. **viewportPresence vs inline IntersectionObserver** — converged (FUI took WE's `viewportPresence` abstraction with the `CustomAttributeRegistry` port).

**Spawned:** #725 (WE-only domains → FUI, gates #449), #726 (remaining 6 unplugged tests + flip the enforce flag, blocked by #725).
