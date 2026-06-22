---
kind: decision
size: 3
status: resolved
locus: webeverything
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-20-1246-reference-runtime-canonical-home.md
tags: [bootstrap, cold-start, navigation, view-engine, migration-drift]
---

# Cold-start bootstrap break: NavSectionBehavior imports deleted ../view/ViewEngine (migrated to FUI) — 500s + aborts bootstrap, blanks all behavior demos

## Ruling (ratified + executed 2026-06-22)

**Deleted the WE navigation runtime (impl → FUI); the #155 registration proof follows the impl to FUI.**
Per the foundational rule *WE holds zero standard implementation* (#1246/#1282) and the embed boundary
(WE may not import FUI blocks), the dangling import could not be repointed — it was **deleted**. Shipped:
removed `we:blocks/navigation/` + the `registerNavigation` import/call/log in `we:plugs/bootstrap.ts`;
deleted the orphaned nav unit/integration/e2e tests, the #155 bootstrap-fixture + its e2e, and the
already-orphaned `view`/`tabs`/`wizard` tests (#1326/#1357 fallout); re-hosted `we:demos/navigation-demo.html`
as a #701 `fuiDemo` iframe (FUI canonical) + updated its registry entry; regenerated CEM. **Verified** on a
fresh-process cold start (Vite :3002): `we:plugs/bootstrap.ts` 200s (was 500), and a Playwright load of the
interpolation demo renders (987 chars, **0 console errors, 0 ViewEngine/resolve errors**) — the original
"blank behavior demos" repro is fixed. `check:standards` green. **Unblocks #1207.** The #155
bootstrap-registration coverage now lives FUI-side (FUI owns the behaviors + their nav unit/integration/e2e
tests); an optional WE-website dogfood smoke-test (subject = a FUI behavior) is left as a separate website
concern, not filed. `navigation` was carved out of #1245's deferred bulk-delete (recorded there).

---

**Grounding digest.** [`we:blocks/navigation/NavSectionBehavior.ts:23`](../blocks/navigation/NavSectionBehavior.ts#L23)
imports `../view/ViewEngine`, but `we:blocks/view/ViewEngine.ts` was deleted by #1326 (migrated to
`fui:blocks/view/ViewEngine.ts`). On a fresh-process cold start Vite 500s that module
(`Failed to resolve import "../view/ViewEngine"`); since
[`we:plugs/bootstrap.ts:276`](../plugs/bootstrap.ts#L276) → `registerNavigation` → `NavSectionBehavior`,
the failed import aborts the whole bootstrap graph, so every interpolation/behavior demo renders empty on
cold start (warm singleton hides it). **#1207 is `blockedBy` this.** The home is **not** an open question —
it is **forced** by the already-ratified, codified rule **"WE holds zero standard implementation"**
([#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/) reverses #697 +
[#1282](/backlog/1282-fully-zero-implementation-in-the-we-project/), codified
`we:docs/agent/platform-decisions.md#constellation-placement`). Applying that rule, the **proof that rode on
`nav:list` (#155 bootstrap-auto-upgrade) follows the impl → FUI** — re-homing it onto another WE behavior is
excluded, since those behaviors are themselves impl bound for FUI. The only real residual is **sequencing**
(move the proof before the delete, so coverage never goes red). Already-researched ground — no new
`/research/` topic; grounded in the #1246 canonical-home report (`relatedReport`) + the placement statutes.

**Axis-framing.** Under the placement test ([#817](/backlog/817-block-protocol-impl-boundary-cut-line/) "does FUI
consume the runtime?" / [#1467](/backlog/1467-conformance-verifier-vs-subject/) verifier-vs-subject), a
running render behavior is **impl → FUI**. `NavListBehavior`/`NavSectionBehavior` are running behaviors;
`NavSectionBehavior` consumes `ViewEngine` for show/hide
([`:35`](../blocks/navigation/NavSectionBehavior.ts#L35), `:70`, `:114`) — the same `ViewEngine`
`fui:blocks/tabs/TabGroupBehavior.ts` already consumes from FUI (precedent). FUI hosts the **complete,
superset** suite (`NavListBehavior` byte-identical bar the import path; `NavSectionBehavior` FUI=146 >
WE=129, adding #941 shadow-root `controlledElement` + #944 Escape-to-collapse; plus `NavMenubarBehavior`
with no WE twin) — so the WE copy is the **stale/inferior fork**, which *strengthens* delete-not-keep. WE
**may not** import `@frontierui/blocks` at build time (the [embed boundary](../docs/agent/platform-decisions.md#we-fui-embed-boundary)),
so the dangling import **cannot be repointed at FUI** — it must be **deleted**. That collapses the
home call to a forced invariant (below). Applying zero-impl, the #155 proof's home is **also** forced
(→ FUI); what remains is only the sequencing/scope of moving it (Fork 1).

## Recommended path at a glance

**Forced invariant — delete the WE nav runtime, do not repoint** (see below). One genuine fork:

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| Fork 1 — where the #155 bootstrap-registration proof goes | **(b) the proof follows the impl → FUI** (WE keeps, at most, a website-dogfood smoke-test whose subject is a *FUI* behavior) | (a) re-home onto another WE behavior — **excluded**: WE holds zero standard impl | high |

## Forced invariant — delete the WE nav runtime (impl → FUI), do not repoint

Delete `we:blocks/navigation/` (`NavListBehavior`, `NavSectionBehavior`, `registerNavigation`, `index`),
drop the `registerNavigation` import + call from `we:plugs/bootstrap.ts` (and the stale
`Navigation registered…` `console.log` at `:295`/`:298`), and remove the now-orphaned
`we:blocks/__tests__/unit/navigation/` + `we:blocks/__tests__/integration/navigation.test.ts`. This is a
forced invariant, not a weigh — the two alternatives are *excluded*:

- **(restore a WE-side `ViewEngine` / keep the nav impl in WE)** — *excluded* by the ratified, codified
  **zero-impl** rule (#1246 reverses #697; #1282; `#constellation-placement`): WE holds zero block
  implementation, so re-duplicating `ViewEngine` is exactly the drift the rule forbids.
- **(repoint the import to `@frontierui/blocks/view/ViewEngine`)** — *excluded* by the embed boundary
  (`#we-fui-embed-boundary`): WE may import the plug **layer** (`@frontierui/plugs`) but **not** FUI
  **blocks** at build time. There is no alias for it and adding one inverts the WE→FUI direction.

Wholesale, not a split: no *staying* WE artifact statically imports the behaviors — the catalog
([`we:src/_data/blocks/nav-list.json`](../src/_data/blocks/nav-list.json), `implementedBy` → FUI), the
semantics JSON, and `we:demos/reveal-nav-conformance.ts` (self-contained #609 popover checks, imports
nothing from `we:blocks/navigation/`) are independent spec/docs artifacts that survive untouched. The live
WE site already dogfoods FUI's `sectioned-nav` (`we:src/_layouts/base.njk`, #865/#870 mode-C), so deleting
the local runtime does not change the rendered site.

## Fork 1 — where the #155 bootstrap-auto-upgrade proof goes

*Fork-existence:* a real either/or — the deletion above **removes the subject the #155 proof rides on**, so
the proof needs a new home and the two homes cannot coexist. `we:demos/registered-behaviors-bootstrap-fixture.html`
+ [`we:blocks/__tests__/e2e/registered-behaviors-bootstrap.spec.ts`](../blocks/__tests__/e2e/registered-behaviors-bootstrap.spec.ts)
exist *only* to prove a bootstrap `define` line actually fires; the fixture is explicit — *"the
bootstrap-registry proof rides on nav:list, a retained WE behavior"* (the proof already **hopped to
nav:list** when grid behaviors retired to FUI under #697). `we:demos/navigation-demo.html` +
`we:plugs/__tests__/e2e/navigation.spec.ts` are also live consumers via bootstrap. So a blind delete leaves
the #155 coverage red — the proof must move *first* (this is the skeptic's load-bearing catch; the original
"nothing stays behind" claim was false).

- **(b) The proof follows the impl → FUI.** The #155 proof validates *implementation registration* (does a
  registered block behavior auto-upgrade). The behaviors are FUI impl, so the proof belongs with them —
  migrate the bootstrap-registration coverage to FUI (it already owns `registerNavigation` + the suite).
  **Recommended default.** Confidence high. If WE's docs site wants its own *dogfood* smoke-test that its
  bootstrap mounts/upgrades a behavior, that is legitimate — **but its subject must be a FUI-provided
  behavior** (consumed via the dogfood path), never a WE-local one; file it as a website concern, not a
  reason to keep WE impl.
- **(a) Re-home the proof onto another still-retained WE behavior** (`route:link`/`for-each`) — **Excluded
  by the foundational rule: WE holds zero standard implementation.** Those behaviors are themselves impl
  that must leave for FUI (#1246/#1282); parking the proof on one perpetuates WE impl and just moves the
  same break down the deletion queue. The "#697 hop-to-the-next-WE-behavior" pattern was the *symptom* of
  not yet applying the rule, not a target state.
- **(c) Keep a WE test-only no-op fixture behavior** to prove WE registration wiring — *Rejected:* a
  fixture-only behavior is still a WE-resident implementation; if the WE site needs registration coverage
  it dogfoods a FUI subject (per (b)), it does not mint a local one.

*Skeptic: SURVIVES-WITH-AMENDMENT → flipped the default after applying the zero-impl rule.* The skeptic
refuted the original "wholesale, nothing stays behind" framing — the #155 fixture + two e2e specs are live
consumers, so the delete is unsafe **until the proof is moved first**. Applying the foundational rule (no
WE standard impl; website dogfoods FUI) then **excluded the original (a) re-home-onto-a-WE-behavior default**
and flipped it to (b): the proof follows the impl to FUI. The forced-invariant home call (delete, don't
repoint) and the superset/boundary claims all survived.

---

## Context

### Supported by default (not decisions) — execution scope

- **Sequence:** move the #155 proof to FUI (Fork 1 (b)) **before/with** the delete, never after — else the
  e2e goes red. Bundle both in the one #1504 build.
- **Full delete/migrate set:** `we:blocks/navigation/` (4 files) · `we:plugs/bootstrap.ts`
  import+call+`console.log` (lines 55–60, 276, 295/298) · `we:demos/navigation-demo.html` (+ its CSS) ·
  `we:plugs/__tests__/e2e/navigation.spec.ts` · `we:blocks/__tests__/e2e/registered-behaviors-bootstrap.spec.ts`
  (or repoint to the Fork 1 (a) subject) · `we:demos/registered-behaviors-bootstrap-fixture.html` (repoint
  to the new subject) · `we:blocks/__tests__/unit/navigation/` + `we:blocks/__tests__/integration/navigation.test.ts`
  · stray generated build artifacts (sourcemaps, declarations) under `we:blocks/navigation/`.
- **Also orphaned by #1326/#1357 (clean up in the same pass):** `we:blocks/__tests__/unit/view/`,
  `we:blocks/__tests__/unit/tabs/`, `we:blocks/__tests__/unit/wizard/` — their WE source was already
  deleted; FUI carries its own copies of these tests.
- **Verify:** Playwright cold start on a 2nd port confirms the behavior demos render (the original repro);
  `npm run check:standards` green; the #155 e2e green on its new subject.
- **Optional WE website smoke-test:** if the docs site wants coverage that its bootstrap mounts/upgrades a
  behavior, that is a *website-dogfood* test whose subject is a **FUI** behavior — file separately; it is
  not a reason to retain any WE impl and does not block this delete.

### Classification (per-fork pass)

Placement of **impl**, not a new standard entity. The behaviors are running renderers → **FUI** by the
#817/#1467 placement test; WE retains only the **standard/spec** artifacts (catalog `implementedBy` → FUI,
semantics, the self-contained conformance demo). No protocol/intent/DI-registry seam is created. The
governing statutes are already codified (`#constellation-placement` zero-impl, `#we-fui-embed-boundary`),
so this item **applies** them — it mints nothing. No ruling taken here — `/next decision` makes the call.
