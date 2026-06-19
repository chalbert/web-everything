# Polyglot panel — what verdict backs a per-target *conformance* badge (#913 prep)

**Decision prepared:** [#913](/backlog/913-polyglot-panel-per-target-conformance-badges-from-the-determ/)
(Block Explorer polyglot-panel slice c, under epic #746). Sibling of the behavioral badge
[#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/) (#954 Fork 2).

## The question

The polyglot panel renders one tab per genWrapper target (`react` / `vue`) showing the generated
wrapper source. Slice (c) wants a pass/fail **conformance badge** on each tab. The card was filed
assuming a "deterministic, already-committed #506 verdict" backs it — but tracing to the tree shows that
verdict **does not exist for react/vue** (it is the MaaS serve-origin gate, a different axis). So: *what
deterministic verdict, if any, can back a per-target conformance badge — or should the badge just be the
behavioral one (#967)?*

## Grounding in the real tree (verified)

- **Panel targets are react/vue only.** `fui:workbench/mount.ts:648`
  `TARGET_LABELS = { react: 'React', vue: 'Vue' }`; `TARGETS` imported from
  `fui:tools/gen-wrapper/genWrapper.mjs:26` (`TARGETS = ['react', 'vue']`). The slice-(c) reservation
  comment is at `fui:workbench/mount.ts:635` ("no conformance badge (#913)").
- **genWrapper emits source only — no verdict metadata.** `generateWrapper(declaration, target)`
  (`fui:tools/gen-wrapper/genWrapper.mjs:207-212`) is a pure `(decl, target) => string`. The emitters
  (`reactWrapper` 74-143, `vueWrapper` 147-194) return source strings. **No diagnostics, no `lossy`
  flag, no conformance metadata** is produced. Its tests
  (`fui:tools/gen-wrapper/__tests__/genWrapper.test.mjs`) are substring assertions, **not** snapshots —
  no committed golden of wrapper source exists anywhere in either repo.
- **The committed #506 golden is a different axis.** `we:blocks/renderers/module-service/conformance/golden.json`
  is 14 MaaS/HTTP vectors (`X-MaaS-*` headers) comparing a reference-JS origin vs a generated `.NET`
  origin (`we:blocks/renderers/module-service/conformance/runner.ts`,
  `we:blocks/renderers/module-service/conformance/dotnetTarget.ts`). **Zero react/vue content.** It is not
  a per-target wrapper verdict.
- **The only react/vue conformance artifact is behavioral.** `we:wrapper-conformance/runner.ts` +
  `we:wrapper-conformance/vectors.ts` — five contract vectors (`attributes-forwarded`, `rich-property-assigned`,
  `event-bridged`, `slots-projected`, `combo`) executed over a **live mounted `WrapperSubject`**
  (`we:wrapper-conformance/runner.ts:37-46` requires a `render()` that returns the host element; the runner dispatches real DOM
  events and reads resulting attribute/property state). This is exactly **#967's** scope, which is
  `blockedBy: [912, 954]` — it needs the #912 live-test sandbox for a mounted subject.

## Prior art surveyed

**1. custom-elements-everywhere.com — the canonical per-framework conformance badge.** This *is* the
reference design for "per-framework pass/fail conformance scoring" of custom-element interop. Its
methodology is **behavioral**: Karma tests run in real browsers (Chrome/Firefox) checking that a
framework can display a custom element, bind data, pass children, and listen for DOM events. The score
that drives React's famous "100% as of v19" badge is a *runtime behavioral* result, **not** a source
snapshot. The industry's idea of a "wrapper/interop conformance badge" is behavioral by definition.
([custom-elements-everywhere.com](https://custom-elements-everywhere.com/),
[webcomponents/custom-elements-everywhere](https://github.com/webcomponents/custom-elements-everywhere))

**2. Stencil output targets — the closest analog to genWrapper (CEM → react/vue wrappers).** The
ecosystem's testing wisdom is explicit: *"snapshots are great for structure, but you still want
assertions for behavior"* — snapshot/golden of generated source and behavioral assertions cover
**different risks** and are complementary, not interchangeable. A source golden catches *generator
drift*; only behavioral assertions verify the wrapper actually forwards props/events.
([stenciljs.com/docs/output-targets](https://stenciljs.com/docs/output-targets),
[Percy: snapshot vs unit testing](https://percy.io/blog/react-snapshot-testing-vs-unit-testing))

**3. Snapshot / golden testing in general.** A golden file is a *regression* signal: "this is what the
output should look like unless intentionally changed." It detects *unexpected change*; it does **not
validate logic or behavior**. A "source matches golden" badge truthfully claims *the generator's output
is unchanged* — it does **not** claim *the wrapper conforms*.
([golden/snapshot testing tradeoffs](https://www.thetesttribe.com/blog/snapshot-testing-in-the-backend/))

## Synthesis handed to #913

The survey sharpens the A/B/C fork by separating *what each candidate badge truthfully claims* from
*how much it costs to build* (the latter is prioritization, not a fork branch):

- **A — deterministic wrapper-source golden.** Freeze genWrapper output per target; badge = "emitted
  source matches golden." On merit this is a **generator-regression** signal (prior art 2 & 3), honest
  only if labelled *"source-stable"*. Behind a badge labelled **conformance** it over-claims a guarantee
  it does not verify — the same honesty flaw flagged for C. A source-golden regression test for
  genWrapper is a *legitimate independent artifact*, just not the conformance badge.
- **B — collapse #913's deterministic-conformance badge into #967's behavioral one.** The only signal
  that is genuinely *per-target conformance* is behavioral — confirmed by the tree (the sole react/vue
  conformance artifact is `wrapper-conformance/`, behavioral) **and** by prior art 1 (custom-elements-
  everywhere scores frameworks behaviorally). #954 Fork 2 split deterministic-vs-behavioral on the
  premise that a deterministic verdict existed; it does not, so the split's premise is false and the two
  re-merge. **Recommended default.**
- **C — cheap genWrapper *health* signal** (emit-success / no-lossy / no-diagnostics). genWrapper emits
  **no** such metadata today (it returns a bare string), so C has nothing to read without first building
  diagnostic emission into the generator; and "generated cleanly" ≠ conformant. Weakest on merit.

**Classification (per-fork pass).** The *badge* is FUI workbench product UI (`locus: frontierui`,
already set). The *conformance vectors* are a WE-owned contract (`we:wrapper-conformance/vectors.ts`) —
contract → WE per the constellation. The *runner that mounts a live subject and executes* is impl → FUI
(*impl-is-not-a-standard*; #817 "a running handler is impl"). Under B the badge rides #967's FUI-side
runner reading WE-owned vectors — only vectors (the contract) cross the WE→FUI seam, honoring #700. B is
the architecturally clean placement and matches #967's existing `locus: frontierui` + `blockedBy: 912`.

**Recommended ruling: B**, ~75–80%. The genuine residual for the decider: whether the project wants a
*sandbox-independent deterministic tier* enough to keep a **relabelled "source-stable"** badge (A,
honestly framed) as a *second* badge alongside the behavioral one (the Stencil "both, they cover
different risks" lesson) — vs. accepting that #913 is redundant with #967 and a source-golden, if wanted,
is just a generator-regression test filed separately. Not a cost question; a question of whether two
distinct *truthful* signals both earn a badge.

## Related prior topics

- `forward-component-emit-substrate` (#811) — the substrate that *emits* the wrappers; its summary still
  asserts "conformance badge = the #506 deterministic gate", which is the **false premise this topic
  corrects**. (Update note: that line predates the #913 re-type.)
- `behavioral-conformance-vectors-kit` (#899) — the behavioral conformance kit shape #967's runner sits
  inside.
- `polyglot-live-test-sandbox` (#912) — the live-test sandbox #967 (and thus B) depends on for a mounted
  subject.
