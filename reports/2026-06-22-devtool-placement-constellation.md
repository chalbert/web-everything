# Dev-tool placement across the constellation — prior-art survey & prepared forks (#1565)

**Date:** 2026-06-22 · **Decision:** [#1565](/backlog/1565/) · **Research topic:**
[/research/devtool-placement-constellation/](/research/devtool-placement-constellation/)

## The question

A user ruling — **"dev-tools belong in Plateau, not FUI"** — must be turned into a precise, codifiable
placement rule across the four-repo constellation (WE = standard/contracts, zero impl; FUI = the
reference *implementation* of the standards; Plateau = the *product* layer). Today's state is mixed and
conflicting: the autonomous explorer and the dev-panel plugin sit in FUI; the block-explorer workbench
was *ratified* FUI-owned (#809); a prior codified rule (the reproduction-conformance program #1225)
states "the deterministic diff engine … is **FUI** (impl/devtool)". So the ruling collides with at least
two ratified placements, and a blanket "move every tool to Plateau" reading would also drag WE's own
conformance verifiers (#1467) out of the standard layer. The decision (#1565) must state the rule
precisely, classify every tool, and spawn the relocation slices. It **blocks** [#1553](/backlog/1553/)
(the trainable-judge constellation boundary).

## Prior-art survey (the load-bearing finding)

Five external precedents were surveyed; they **converge on one principle, and it matches the project's
own ratified `project_conformance_verifier_vs_subject` (#1467) exactly**: *the dividing line is the
consumer.* A surface a **human operates** (workbench / inspector / configurator) is a developer
**product**, separate from the implementation it inspects. A tool that **reads an implementation's
observable output as DATA** (a conformance verifier) is **machinery that lives with the standard**.

| Precedent | Arrangement | Transferable principle |
|---|---|---|
| **Chrome DevTools vs Blink/V8** | DevTools is a separate web app (own repo, builds without the engine); talks to the engine only over the CDP protocol (JSON commands out, JSON events back). | **The inspector is not the thing inspected.** A human-operated surface observes the impl's output over a contract; it never *is* the impl. |
| **Storybook vs the component library vs Chromatic** | Storybook is a dev-dependency "frontend workshop" that operates *on* your components (they live in your repo, it renders them); Chromatic is the same team's *commercial cloud product* that consumes the **story** format. | OSS dev-tool + commercial product layered over a stable format — exactly the open-core WE/FUI/Plateau shape. The tool is separate from its subject; the format is the only lock. |
| **Material Web vs Material Theme Builder vs m3.material.io** | Three distinct homes: components (the Material Web library), a configurator that **emits tokens as data**, and the docs/spec site. The token namespace is the contract. | A configurator is a tool that emits **config as data**, which the impl consumes — zero lock-in, lives in the tooling/product layer, not the component library. |
| **WPT reftests / the testharness runner / Test262** | Conformance suites live **with the standard** (tc39, web-platform-tests orgs), shared by every implementation; they read the impl's **observable output as data** (rendered pixels, a PASS/FAIL enum, behavioral asserts) and never embed engine internals. | **A verifier that reads output as data is conformance machinery — it pairs with the standard, not the product.** This *is* #1467 / WPT, externally confirmed. |
| **Monorepo packages-vs-apps split** (Radix, MUI, Chakra, shadcn, Turborepo, Nx) | The publishable **library** lives in the packages/libs layer; every **deployable surface that consumes it** — docs, playground, Storybook, tooling, CLIs — lives in the apps layer. Turborepo: "Library Packages … aren't independently deployable"; Nx 80/20 (thin apps over a fat lib). | Developer tooling and product surfaces are **apps-layer (→ Plateau)**, structurally separated from the reference library (**→ FUI**). Naming varies; the separation holds universally. |

**The synthesized cut (the consumer/embed test):**

1. **Reads an implementation's observable output as DATA** (verifier / golden-vector / trace) →
   **conformance machinery → stays WE** (per #1467, WPT/Test262). *Untouched by the new ruling.*
2. **Is a build-time implementation transform / reference-impl generator** (codegen, CSS lowering,
   bundler plugins) → **impl → stays FUI** (per impl-is-not-a-standard #020/#291). *Untouched.*
3. **Is a developer-operated surface you run against your OWN build** (workbench, inspector, explorer
   CLI chrome, configurator, dev-panel) → **product tooling → Plateau.** *This is the ruling's target.*
4. **Ships embedded on THIRD-PARTY / customer sites as a distribution/showcase of the impl** →
   **FUI distribution** (Plateau-routing would re-introduce the cross-origin boundary #809 dissolved).
   *The #809 carve-out.*

## How the survey reshaped the forks (skeptic-driven)

Three throwaway skeptics attacked the initial defaults; two flipped:

- **Fork 1 (the rule).** Initial: a 3-way sort. Skeptic: stating it as a 3-prong sort *relists settled
  law* (#1467, impl-is-not-a-standard) as if the ruling needed it, diluting a clear directive and
  leaving the trigger tool litigable. **Amended** to ONE positive test (operated-surface → Plateau) with
  the third-party-embed carve-out, citing the existing rules as *unchanged*. SURVIVES-WITH-AMENDMENT.
- **Fork 2 (block-explorer #809).** Initial: reverse #809 → Plateau. Skeptic: the #809 driver is
  *third-party-site embedding* (a distribution feature of how FUI is consumed), and "Plateau renders FUI
  same-origin" is **false** for the customer-site case — it re-introduces the cross-origin boundary #809
  specifically dissolved. The block-explorer is "reference-impl that only looks like tooling." **Default
  flipped: carve OUT, stays FUI** — #809 is the cited precedent, *not* reversed.
- **Fork 3 (explorer).** Initial: whole explorer → Plateau. Skeptic: the explorer's Layer-1/Layer-2
  oracles **read output as data** and Layer-2 drives WE conformance vectors through FUI bindings (the
  runtime half of #899/#1467 conformance machinery) — moving them to Plateau is *inconsistent* with the
  refined rule. **Default flipped: split** — conformance harness (Layer-1/2) stays FUI, vision (Layer-3)
  stays Plateau (no-leakage #475), only the product CLI chrome → Plateau.

The net: the user's ruling **stands and is honored** (every human-operated surface-you-run-against-your-
own-build moves to Plateau), but it is a *refinement* of the existing constellation-placement statute, not
a wholesale override — and it does **not** disturb #1467 (verifiers), impl-is-not-a-standard (codegen),
or #809 (the third-party-embed carve-out).

## Tool census (full inventory) & classification

See the decision item for the live table. Summary of the classification under the cut above:

- **Stays WE (conformance machinery / contracts):** the `we:scripts/check-standards.mjs` suite, backlog
  CLIs, `we:tools/trait-enforcer/traitManifestContract.ts`, the `auditDataTable`-class verifiers (#1467).
- **Stays FUI (build-time impl transforms / reference-impl generators):** `fui:tools/scope-isolator`,
  `fui:tools/trait-enforcer` impl, `fui:tools/gen-wrapper`, `fui:tools/ingest-adapter`,
  `fui:tools/maas` serve plugins; **+ the explorer's Layer-1/2 conformance harness** (Fork 3);
  **+ the block-explorer workbench** (Fork 2, #809 carve-out).
- **→ Plateau (developer-operated product surfaces):** the **explorer CLI chrome / orchestration /
  report-bundling** (Fork 3); the **dev-panel / spec-explorer Vite plugin** (currently duplicated WE+FUI
  byte-for-byte — relocation also de-duplicates); the **mock-server** dev utility.
- **Already correct (Plateau):** Technical Configurator, dev-browser/IDE-bridge, intent-configurator,
  design/vision-review, compatibility-map — confirm, no move.
- **Vision (Layer-3 of explorer):** Plateau, already codified (#475 no-leakage).

## Downstream consequences to name

- **Revisit the reproduction-conformance diff-engine line** (`we:docs/agent/platform-decisions.md`
  §reproduction-conformance, "diff engine is FUI"): consistent with Fork 3's split (deterministic harness
  FUI, vision Plateau) — the *chrome* relocates, the harness does not. No contradiction; note it
  explicitly when codifying.
- **#1553 Fork 3** is robust either way (it already wrote "if #1565 relocates the explorer to Plateau,
  the producer/transport role stays the same but moves repos, and the Plateau-owns-impl / WE-owns-contract
  split is unaffected"). Resolving #1565 unblocks it cleanly.

## Sources

- Chrome DevTools / CDP: https://chromedevtools.github.io/devtools-protocol/ · https://github.com/ChromeDevTools/devtools-frontend · https://v8.dev/docs/inspector
- Storybook / Chromatic: https://storybook.js.org/ · https://github.com/storybookjs/storybook · https://www.chromatic.com/
- Material: https://github.com/material-components/material-web · https://github.com/material-foundation/material-theme-builder · https://m3.material.io/
- WPT / Test262: https://web-platform-tests.org/ · https://web-platform-tests.org/writing-tests/reftests.html · https://github.com/tc39/test262
- Monorepo conventions: https://turborepo.dev/docs/core-concepts/package-types · https://nx.dev/concepts/more-concepts/applications-and-libraries · https://github.com/radix-ui/primitives · https://ui.shadcn.com/docs/registry

## Related

- Decision: [#1565](/backlog/1565/) (this prep). Blocks [#1553](/backlog/1553/) (trainable-judge boundary).
- Codified rules touched: `constellation-placement`, `we-fui-embed-boundary` (#809 rule 5),
  `no-leakage-client` (#475), `reproduction-conformance` (#1225); memories
  `project_conformance_verifier_vs_subject` (#1467), `project_block_explorer_chrome_decoupled_from_distribution`
  (#809), `feedback_runtime_di_vs_devtools_provider_seam`, `feedback_minimize_lock_in_protocol_only_lock`.
