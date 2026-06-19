---
type: decision
workItem: story
size: 3
parent: "746"
status: resolved
blockedBy: []
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-18"
locus: frontierui
relatedProject: webdocs
relatedReport: reports/2026-06-18-polyglot-conformance-badge-backing.md
tags: [webdocs, block-explorer, adapters, polyglot]
---

# Polyglot panel — what verdict backs a per-target *conformance* badge

Block Explorer polyglot-panel slice (c), sibling of [#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/).
The panel renders one tab per genWrapper target (`react` / `vue`) showing the generated wrapper source;
slice (c) wants a pass/fail **conformance badge** on each tab. **This decision has no greenfield design —
it picks which existing/buildable verdict the single badge truthfully renders.** The forks below are
grounded in a prior-art survey published as the `/research/` topic
[`polyglot-conformance-badge-backing`](/research/) (session report in `relatedReport`); the recommended
default is in **bold**. **RATIFIED 2026-06-18 — graded multi-dimensional model (see [Resolution](#resolution-ratified-2026-06-18)).**
The original single-verdict framing below ("the badge shows one verdict; A/B/C cannot coexist") was
**rejected in discussion** — conformance is a *stack* of independent checks, not one choice — so prepared
default **B** ("collapse into #967") is **superseded**. Ownership is **inherited from [#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/) /
the constellation-placement statute**, not re-decided. The forks below are retained as lineage.

The badge concern decomposes onto the real tree as:

- **The badge UI** — FUI workbench product surface: `fui:workbench/mount.ts:648` (`TARGET_LABELS = { react: 'React', vue: 'Vue' }`),
  tab loop at `:656`, slice-(c) reservation comment at `fui:workbench/mount.ts:635` ("no conformance badge (#913)").
  `locus: frontierui` already set.
- **What the generator emits** — `fui:tools/gen-wrapper/genWrapper.mjs:207-212` `generateWrapper` is a pure
  `(decl, target) => string` (emitters `reactWrapper` 74-143, `vueWrapper` 147-194): **source only, no
  diagnostics / no `lossy` flag / no conformance metadata**, and **no committed source golden** (tests
  are substring assertions, not snapshots).
- **The only deterministic golden committed** — `we:blocks/renderers/module-service/conformance/golden.json`
  is the #506 **MaaS** gate: 14 `X-MaaS-*` HTTP vectors, reference-JS vs `.NET` origin
  (`we:blocks/renderers/module-service/conformance/runner.ts`,
  `we:blocks/renderers/module-service/conformance/dotnetTarget.ts`). **Zero react/vue content** — a
  different generator/axis, not a per-target wrapper verdict.
- **The only react/vue conformance artifact** — `we:wrapper-conformance/runner.ts:37-46` +
  `we:wrapper-conformance/vectors.ts`:
  five contract vectors executed over a **live mounted `WrapperSubject`** (dispatches real DOM events,
  reads resulting attr/prop state). This is **behavioral** and is exactly **#967's** scope
  (`blockedBy: [912, 954]`, needs the #912 live sandbox).

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
| --- | --- | --- | --- |
| 1 — what verdict backs the *conformance* badge | **B — collapse into #967's behavioral badge** | A — deterministic wrapper-source golden | Med-high (~75–80%) |

## Fork 1 — What deterministic verdict, if any, backs the react/vue *conformance* badge?

**Why it's a fork (real either/or):** the panel shows **one** badge per target tab and a badge asserts
**one** meaning; A/B/C are three mutually-exclusive things that single badge could verify, and two of
them (A, C) are *excluded as broken-for-this-label* — a badge labelled "conformance" that actually
reports generator-drift (A) or clean-emit (C) over-claims a guarantee it does not verify. So this is a
genuine choice between *truthful backings*, not a support-all.

**Crux (grounded above):** the card was filed assuming an already-committed deterministic #506 verdict
backs the badge. Traced to the tree, that verdict is the MaaS axis (zero react/vue), genWrapper emits no
verdict metadata, and **the only thing that is genuinely a per-target react/vue conformance verdict is
behavioral** (`we:wrapper-conformance/`). Prior art agrees: custom-elements-everywhere.com — the
canonical per-framework conformance badge — scores frameworks **behaviorally** (real-browser Karma:
display / bind / children / events; React's "100% as of v19" is a runtime result, not a source snapshot).

**Options:**

- **B — Collapse #913's deterministic-conformance badge into #967's behavioral one. ✅ recommended (~75–80%).**
  The only signal that is genuinely *per-target conformance* is behavioral, confirmed by both the tree
  (the sole react/vue conformance artifact is `we:wrapper-conformance/`) and the canonical prior art
  (custom-elements-everywhere). #954 Fork 2 split deterministic-vs-behavioral on the premise that a
  deterministic verdict *existed*; that premise is false, so the two re-merge and the badge is just the
  behavioral one (#967). Architecturally clean: the badge rides #967's FUI-side runner reading WE-owned
  vectors (`we:wrapper-conformance/vectors.ts`), so only the *contract* crosses the WE→FUI seam,
  honoring #700 — matching #967's existing `locus: frontierui` + `blockedBy: 912`.
- **A — Build a deterministic wrapper-source golden.** Freeze genWrapper output per target; badge =
  "emitted source matches golden." On merit this is a **generator-regression** signal (Stencil's
  snapshot-vs-behavioral lesson; golden = "output unchanged unless intentionally changed"), **not** a
  conformance verdict — honest only if the badge is relabelled *"source-stable."* Behind a *conformance*
  label it over-claims, the same honesty flaw as C. *Rejected as the conformance badge.* A source-golden
  *regression test* for genWrapper is a legitimate independent artifact — see "Supported by default."
- **C — Cheap genWrapper *health* signal** (emit-success / no-lossy / no-diagnostics). *Rejected:*
  genWrapper emits **no** such metadata today (`generateWrapper` returns a bare string), so C has nothing
  to read without first building diagnostic emission into the generator; and "generated cleanly" ≠
  conformant — it implies a guarantee it never verifies.

**Per-fork classification.** Layer: the *badge* is FUI workbench product UI; the *conformance vectors*
are a WE-owned contract (`we:wrapper-conformance/vectors.ts` lives in webeverything); the *runner that
mounts a live subject and executes* is impl → FUI (*impl-is-not-a-standard*; #817 "a running handler is
impl"). Not a protocol decision (no new vendor-interop contract minted — reuses the existing wrapper
vectors). Not an intent dimension; the badge is a fixed UI element, not a configurable axis. Seam: the
relevant seam is #700 (WE↔FUI) — under B only vectors cross, which is the clean placement.

**Red-team note for the deciding agent.** The genuine residual (the only place judgment is really
needed): does the project want a *sandbox-independent deterministic tier* enough to keep a **relabelled
"source-stable"** badge (A, honestly framed) as a *second* badge **alongside** the behavioral one — the
Stencil "snapshot + behavioral cover different risks, keep both" lesson? If yes, the ruling is not "B
instead of A" but "B is the conformance badge; A's source-golden is a separately-filed generator-
regression test that may earn its own *source-stable* badge later." That second-badge question — not a
cost question — is the one to red-team. (A high-leverage flag: this fork rests on #967/#912 being the
live home for behavioral conformance; if those are descoped, re-open.)

---

## Context

### History — re-typed `idea` → `decision` 2026-06-18 (premise was false)

> **#954 ratified 2026-06-18 — split + unblocked.** #913 was originally the *combined* badge
> (deterministic #506 verdict **+** #891 behavioral runner). Per #954 the two were split
> (bias-toward-separation): #913 kept the deterministic-verdict badge (`blockedBy: 954` cleared on
> ratify); the behavioral badge moved to [#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/)
> (`blockedBy: [912, 954]`).

Pre-flight tracing then showed the data the deterministic badge reads **does not exist for react/vue**
(an axis mismatch, not a missing file): the panel's targets are `react`/`vue` (the genWrapper consume
targets), but the committed #506 golden is the MaaS serve-origin gate (reference-JS vs `.NET`, zero
react/vue), and no deterministic react/vue wrapper verdict is committed anywhere — the only react/vue
conformance artifact is the **behavioral** `we:wrapper-conformance/` runner, which is #967's scope. So
#954 Fork 2 handed #967 the real (behavioral) artifact and left #913 pointing at a "deterministic
verdict" that doesn't exist for its targets. Hence this decision. (See the digest above for the verified
`file:line` grounding; full survey in `relatedReport`.)

### Supported by default (not decisions)

- **A genWrapper *source-golden regression test* is independently fine** — freezing wrapper output and
  asserting "generator output unchanged unless intentionally changed" is a legitimate generator-stability
  test (it would replace the current substring assertions in
  `fui:tools/gen-wrapper/__tests__/genWrapper.test.mjs`). Ruling B does **not** forbid it; it only says
  that signal is **not the conformance badge**. If wanted, file it as its own generator-regression build
  item (separately prioritized), optionally surfaced as a distinct *"source-stable"* badge — never under
  a "conformance" label.

### Relationships

- **Parent:** epic [#746](/backlog/746-block-explorer/) (Block Explorer).
- **Sibling:** [#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/) — the
  behavioral badge; under the ratified graded model it is **the behavioral tier** (deepest), not the
  whole badge. (Superseded reading: prepared default B had #913 collapse *into* #967.)
- **Depends (transitively under B):** [#912](/backlog/912-polyglot-live-test-sandbox/) live-test sandbox
  (#967's `blockedBy`), which supplies the mounted `WrapperSubject` the behavioral runner needs.
- **Prior topic to correct:** the `forward-component-emit-substrate` (#811) research summary still
  asserts "conformance badge = the #506 deterministic gate" — the false premise this decision overturns.

## Resolution — ratified 2026-06-18

**The single-verdict premise is rejected; the polyglot conformance badge is GRADED / multi-dimensional.**
A badge does not pick *one* of A/B/C — conformance is a **stack of independent checks that catch
different failure classes** (the WCAG A/AA/AAA model; the custom-elements-everywhere multi-criterion
grid). The prepared Fork-1 default **B** ("collapse #913 into #967, the badge is *just* behavioral") is
**superseded** because it rested on the same "one badge = one verdict" framing.

**The conformance dimensions (each an honestly-labelled tier, not a rival):**

1. **Surface-contract** — does the generated wrapper expose the props / events / slots / generated-HTML
   the CEM declares? **Deterministic, no live sandbox.** This is *not* the survey's A (a byte-for-byte
   source golden = mere regression); it is a *semantic* check of emitted surface against the declared
   WE contract. Catches "generator silently dropped an event" *before* a sandbox exists — a different
   bug class than the behavioral tier. → **#913's reframed build scope** (spawned below).
2. **Framework best-practices** — idiomatic React (`forwardRef`, event-prop naming) / idiomatic Vue. A
   **lint axis**, almost certainly a separate tool; not in the original survey. → **new item** (spawned
   below), separately prioritized.
3. **Behavioral identity** — live mount, fire real events, assert attr/prop/ARIA state vs the vectors.
   The deepest, most authoritative tier. → **[#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/)**
   (needs the #912 live sandbox). Unchanged.

**The honesty rule (the surviving constraint).** A/C were rejected for over-claiming under a
"conformance" label; in a graded model that is **not** a reason to drop them — it is the *naming rule*:
each tier states **exactly** what it verifies. "Surface-stable" ≠ "behaviorally conformant" ≠
"idiomatic". No tier wears a bare "conformance" label that promises a guarantee it does not check.

**Ownership — inherited from [#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)
/ [constellation-placement](../docs/agent/platform-decisions.md#constellation-placement) (NOT re-decided here).**
Every dimension follows the same decomposition: its **vectors / schema / verifier → WE** (the *meaning*
of conformance); its **runnable runner / driver → FUI** (impl); a **hosted, multi-implementer exerciser →
Plateau** ("WE Conformity Test by Plateau" = #899's hosted layer, already ratified). The Block Explorer
badge is therefore a **FUI-workbench *consumer*** of a verdict — its authoritative multi-implementer home
is the Plateau exerciser, **not** a bespoke FUI-only suite. This dissolves the "wasteful to build a suite
for one implementer" concern: the corpus is implementer-agnostic (WE), the service is multi-implementer
(Plateau, WPT model), FUI is one client + the open reference backend.

**Per-fork classification holds:** badge UI = FUI product surface; conformance vectors = WE contract;
runner = FUI impl (*impl-is-not-a-standard*; #817). Only the contract crosses the #700 seam.

**Disposition:** #913 (the decision) resolves. It does **not** collapse into #967; it becomes the
**surface-contract tier**, spawned as its own build. Best-practices spawns a separate item. Behavioral
stays #967. The graded *model* is decided now; *which tiers build when* is separate prioritization
(behavioral waits on #912; surface is deterministic and can land sooner). Reversible (re-open if #967/#912
are descoped, or if a deterministic surface check proves to collapse into pure generator-correctness).
