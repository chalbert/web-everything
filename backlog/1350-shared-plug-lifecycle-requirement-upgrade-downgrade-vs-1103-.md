---
kind: decision
parent: "1250"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
codifiedIn: "docs/agent/platform-decisions.md#native-first-baseline"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-backlog-split-analysis.md
tags: [plugs, core, custom-elements, native-first, frontierui]
---

# Shared Plug lifecycle requirement (upgrade/downgrade) vs #1103 native-first drop

Decide whether the shared `Plug` lifecycle requirement should **drop `downgrade`** (keep `upgrade`
mandatory) to finish what #1103 started. #1103 dropped `downgrade()` from the scoped
`CustomElementRegistry` (native-first — native has no `downgrade`) but left the shared contract
(`we:plugs/core/Plug.ts` interface + `isPlug` guard + `HTMLRegistry` abstract method) still *requiring*
it — so WE's own `we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts` is now **RED** (registering the registry throws
because the guard demands a method the registry deliberately omits). Fork: **(A, rec. ~85%)** relax the
requirement to `localName + upgrade` (`downgrade?` optional) · **(C, rejected)** keep it and force the
registry to re-add `downgrade`, reversing #1103. Carved from #1304 during `/split`
([we:reports/2026-06-20-backlog-split-analysis.md](../reports/2026-06-20-backlog-split-analysis.md),
§ "Focused: #1304"); sibling under the #1250 plugs-reconcile epic.

## Ruling — ratified 2026-06-21: (A) drop the `downgrade` *requirement*, keep `upgrade` mandatory (~90%)

The shared `Plug` contract relaxes to `localName + upgrade` with `downgrade?` **optional**: `isPlug`
([we:plugs/core/Plug.ts:36-44](../plugs/core/Plug.ts#L36)) drops its `downgrade` check, `HTMLRegistry`
([we:plugs/core/HTMLRegistry.ts:27](../plugs/core/HTMLRegistry.ts#L27)) relaxes `abstract downgrade` to
optional, `Plug` ([we:plugs/core/Plug.ts:30](../plugs/core/Plug.ts#L30)) makes `downgrade?` optional, and
the three unconditional `plug.downgrade(root)` call sites in
[we:plugs/unplugged.ts](../plugs/unplugged.ts) (lines 63, 160, 188) become `plug.downgrade?.(root)`. This is
the direct extension of #1103 (native-first): the platform ships `upgrade` *without* `downgrade` because
upgrade is a one-way prototype swap, so the faithful contract mirrors that asymmetry. Red-team for (C) was
*API symmetry*; it fails — that is the exact argument #1103 already rejected at the registry level.

**The card's 15% residual is RESOLVED, not waived** — grounded in the live tree during the decision turn.
The discussion probed "is `downgrade` ever 100% needed?" and the answer sharpened the ruling: **drop the
*requirement*, never the *capability*.** Real load-bearing `downgrade` bodies exist and run on runtime
teardown paths (not HMR-only) — [we:plugs/webbehaviors/CustomAttributeRegistry.ts:329](../plugs/webbehaviors/CustomAttributeRegistry.ts#L329)
(`#removeAttributesFromTree` + `#disconnect` — tears down behaviors **and disconnects its MutationObserver**),
[we:plugs/webinjectors/InjectorRoot.ts:259](../plugs/webinjectors/InjectorRoot.ts#L259) (removes injectors + stops observing),
[we:plugs/webexpressions/CustomTextNodeRegistry.ts:91](../plugs/webexpressions/CustomTextNodeRegistry.ts#L91), plus
`CustomCommentRegistry`/`CustomContextRegistry`/`CustomStoreRegistry`. These fire via
[`detach()` auto-downgrade](../plugs/unplugged.ts#L109) (SPA subtree removal) and
[`unregister()`](../plugs/unplugged.ts#L62) — skipping them leaks observers. Only the monotonic
`CustomElementRegistry` genuinely can't downgrade (the parsers are explicit no-ops). So `downgrade?` optional
keeps every real consumer working while letting the element registry omit it. The runtime **already** assumes
optional: [we:plugs/webinjectors/InjectorRoot.ts:305-308 (unregister)](../plugs/webinjectors/InjectorRoot.ts#L305-L308) null-guards
(`'downgrade' in provider && typeof … === 'function'`) before calling — (A) is the contract catching up to
what the runtime already does.

**Successor build:** #1413 (shared `core/` relax + `we:plugs/unplugged.ts` null-guard, both repos) — turns the
red `we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts` green. #1309 plugs drift gate
stays `blockedBy` this (now ratified).

## The problem — #1103's drop left the shared contract un-reconciled (and WE is RED)

[#1103](/backlog/1103-define-customelementregistry-downgrade-semantics/) ruled **(B) drop `downgrade()`**
from the scoped `CustomElementRegistry` (native-first: native `CustomElementRegistry` has no `downgrade`;
the custom-element state machine is monotonic). That landed on the *registry*
([we:plugs/webregistries/CustomElementRegistry.ts:169-173](../plugs/webregistries/CustomElementRegistry.ts#L169)
— the "No downgrade()" comment) — **but the shared plug contract that the registry implements still
mandates `downgrade`:**

- [we:plugs/core/Plug.ts:30](../plugs/core/Plug.ts#L30) — the `Plug` interface requires
  `localName + upgrade(root) + downgrade(root)`, and the `isPlug` type guard
  ([we:plugs/core/Plug.ts:36-44](../plugs/core/Plug.ts#L36)) checks **all three** are present.
- [we:plugs/core/HTMLRegistry.ts:26-27](../plugs/core/HTMLRegistry.ts#L26) — declares
  `abstract upgrade(node)` **and** `abstract downgrade(node)`.
- [we:plugs/unplugged.ts:36-39](../plugs/unplugged.ts#L36) — `register(plug)` throws
  *"object must implement the Plug interface (localName, upgrade, downgrade)"* if `isPlug` fails.

**These three files are byte-identical in WE and FUI** (`diff -rq plugs/core/` = only one unrelated test
differs; `we:plugs/unplugged.ts` identical) — so this is a **shared-`core/` decision, not a FUI-only
architecture call** (the #1304 body mis-scoped it as the latter).

**Live consequence — WE's own test is RED.** `npx vitest run we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts`
fails at [we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts:22](../plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts#L22)
(`register(registry)` → `isPlug` → throws, because the registry dropped `downgrade` but the guard still
demands it). #1103 fixed the registry surface and left the contract that validates it inconsistent.

## The fork — what lifecycle should the shared `Plug` requirement mandate?

**Fork-existence:** real — exactly one shape is right and the current state is broken (red test). The
question is the *requirement* in `Plug`/`isPlug`/`HTMLRegistry`, **not** which native methods a registry
keeps (native `CustomElementRegistry` keeps `upgrade` — `customElements.upgrade(root)` — and FUI's
registry delegates straight to it,
[fui:plugs/webregistries/CustomElementRegistry.ts:130-131](../../frontierui/plugs/webregistries/CustomElementRegistry.ts#L130); only `downgrade` is the native-omitted one).

**`upgrade` stays mandatory** — it is a real native API (`customElements.upgrade(root)`), load-bearing
(it's how scoped elements actually get upgraded), and native-first keeps it. The fork is **only** about
`downgrade`, the native-omitted method #1103 dropped.

| Option | `Plug` requires | Net effect |
|---|---|---|
| **(A — recommended) drop `downgrade`, keep `upgrade`** | `localName + upgrade` (+ optional `downgrade?`) | Mirrors native `CustomElementRegistry` exactly (has `upgrade`, no `downgrade`); minimal change; fixes the red test. `downgrade` becomes optional — called if a plug implements it. |
| **(C) keep `downgrade` required** | `localName + upgrade + downgrade` | Forces `CustomElementRegistry` to re-add a `downgrade` member — **reverses #1103 at the registry level** (or special-cases the registry out of `isPlug`). Rejected: re-litigates a ratified native-first call to satisfy a guard. |

### Recommended default — **(A) drop `downgrade`, keep `upgrade`** (~85%, native-first)

This is the direct extension of #1103: the platform ships `upgrade` *without* `downgrade` precisely because
upgrade is one-way, so the faithful contract mirrors that asymmetry — require `upgrade`, make `downgrade`
optional. `isPlug` ([we:plugs/core/Plug.ts:36-44](../plugs/core/Plug.ts#L36)) drops its `downgrade` check
(keeps `localName` + `upgrade`); `HTMLRegistry` ([we:plugs/core/HTMLRegistry.ts:27](../plugs/core/HTMLRegistry.ts#L27))
relaxes `abstract downgrade` to optional; `Plug` ([we:plugs/core/Plug.ts:30](../plugs/core/Plug.ts#L30))
makes `downgrade?` optional.

**Concrete consequence — null-guard the downgrade call site:** `unplugged.downgrade()` calls
`plug.downgrade(root)` **unconditionally**
([we:plugs/unplugged.ts](../plugs/unplugged.ts) — the reverse-order `for … plug.downgrade(currentRoot)` loop,
plus the same call in `unregister()` at [we:plugs/unplugged.ts:62](../plugs/unplugged.ts#L62)). Option (A)
changes those to `plug.downgrade?.(currentRoot)`. `upgrade` call sites are untouched (it stays mandatory).
All edits land in **both repos** (the `core/` + `we:plugs/unplugged.ts` files are identical).

**Confidence ~85%. The residual:** confirm no non-element plug (the interface is generic over all plugs,
not just `CustomElementRegistry`) genuinely *needs* `downgrade` mandated — i.e. a plug whose teardown
correctness depends on the guard guaranteeing every sibling plug also tears down. If one exists, it keeps
its own `downgrade` (still allowed) — only the *requirement* relaxes — so (A) stays safe regardless.

**Red-team note for the deciding turn:** the case for (C) over (A) is *API symmetry* — `upgrade`/`downgrade`
"look like" a matched pair, so a contract requiring one feels like it should require both. Counter: that is
exactly the argument #1103 already rejected at the registry level — the platform ships `upgrade` *without*
`downgrade` on purpose (upgrade is a one-way prototype swap), and mirroring that asymmetry *is* the
native-first position. Relaxing the guard to match is the contract finally catching up to the ratified
registry surface, not a new call. Residual if (A) wins: a plug that *does* implement `downgrade` is still
honored (the call site null-guards, it doesn't skip) — so nothing regresses.

## Scope of the eventual convergence (not part of this card — the successor build)

On ratification, the successor build edits the **shared** `we:plugs/core/Plug.ts` + `we:plugs/core/HTMLRegistry.ts`
+ `we:plugs/unplugged.ts` (and their FUI-identical twins), turning the contract green in both repos. That
convergence is what makes the webregistries domain **byte-drift-clean**, so the #1309 plugs drift gate is
`blockedBy` this decision (it cannot pass while a permanent `we:plugs/webregistries/CustomElementRegistry.ts` downgrade-diff
persists between the repos — a permanent `we:plugs/webregistries/CustomElementRegistry.ts` diff). The #1304 reconcile slices themselves are **not** blocked by this card — they
preserve FUI's existing `downgrade` and proceed independently.

## Lineage
- Builds on (does not reopen) [#1103](/backlog/1103-define-customelementregistry-downgrade-semantics/)
  (resolved; native-first registry surface) — this card reconciles the *contract* #1103 left inconsistent.
- Carved from [#1304](/backlog/1304-reconcile-fui-plugs-webregistries-up-to-we-contract-anchored/) during
  `/split`; sibling under the [#1250](/backlog/1250-re-reconcile-fui-plugs-up-to-we-contract-anchored-add-a/)
  plugs-reconcile epic, governed by [#1270](/backlog/1270-reconcile-fui-plugs-up-to-we-contract-anchored-not-repoint-d/)
  (contract-anchored; holes-get-fixed — this *is* a contract hole getting fixed, principle 2).
