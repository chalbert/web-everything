# Repo-locus migration (#885) — low-confidence `we:` defaults for a manual spot-check pass

The #885 one-time bulk migration marked every code-path reference across `backlog/*.md` +
`reports/*.md` with a `<repo>:` locus prefix (the #883 convention, #884 gate). Inference was
**WE-first** (resolves in WE → `we:`, else `fui:`, else `plateau:`). **0** tokens resolved in
both FUI and plateau (no genuine cross-repo ambiguity). The list below is the **394** tokens
(**237** distinct) that resolved in **no** tree and were defaulted to `we:` — overwhelmingly
WE-historical (e.g. `we:base.html`, removed in #795) or WE-conceptual/future paths, for which `we:`
(the backlog's own home repo) is the correct default. Captured here for a human spot-check; any that
should be `fui:`/`plateau:` can be corrected in place. Listed inside a fence so the now-enforced
gate does not re-flag these bare paths.

```
token	(count)	sample locations
renovate.json	(10)	101-auto-update-pipeline.md:25, 101-auto-update-pipeline.md:85, 101-auto-update-pipeline.md:92 …
mf-manifest.json	(10)	104-app-shell-compatibility-map.md:49, 104-app-shell-compatibility-map.md:87, 104-app-shell-compatibility-map.md:95 …
lock.mjs	(9)	083-agent-file-lock-coordination.md:21, 083-agent-file-lock-coordination.md:92, 083-agent-file-lock-coordination.md:165 …
tests/a11y/route-allowlist.ts	(9)	770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs.md:22, 774-auto-derive-the-a11y-gate-route-set-from-the-11ty-collection.md:18, 793-remediate-we-docs-a11y-violations-flip-the-rendered-site-gat.md:15 …
Document.patch.ts	(6)	138-auto-complete-element-and-demo.md:120, 156-autocomplete-conformance-demo-substrate-crash.md:59, 160-plateau-autonomous-custom-elements.md:41 …
getStandInElement.ts	(6)	156-autocomplete-conformance-demo-substrate-crash.md:58, 160-plateau-autonomous-custom-elements.md:21, 160-plateau-autonomous-custom-elements.md:64 …
base.html	(6)	772-static-template-a11y-lint-in-check-standards-structural-rule.md:24, 772-static-template-a11y-lint-in-check-standards-structural-rule.md:26, 772-static-template-a11y-lint-in-check-standards-structural-rule.md:27 …
bootstrap.tsx	(5)	138-auto-complete-element-and-demo.md:119, 160-plateau-autonomous-custom-elements.md:38, 160-plateau-autonomous-custom-elements.md:47 …
plugs/package.json	(5)	607-audit-all-resolved-backlog-items-against-the-guiding-princip.md:91, 613-audit-tool-d1-d3-g1-drift-noise-precision-filters.md:15, 613-audit-tool-d1-d3-g1-drift-noise-precision-filters.md:26 …
process.config.json	(5)	782-self-driven-project-control-plane-goal-tolerance-envelope-tr.md:17, 782-self-driven-project-control-plane-goal-tolerance-envelope-tr.md:20, 2026-06-15-self-driven-project-artefact-contract-spec.md:108 …
project.json	(5)	783-decide-the-fui-catalog-block-family-denominator-dir-we-spec-.md:191, 882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:40, 2026-06-16-fui-catalog-family-denominator.md:81 …
backlog.json	(5)	882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:30, 882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:36, 882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:46 …
../compiler/src/component-transform/index.js	(4)	038-component-converter-playground.md:33, 700-component-converter-playground-placement.md:37, 2026-06-15-backlog-split-analysis.md:656 …
catalog-info.yaml	(4)	092-provider-consumer-graph-platform-manager.md:67, 092-provider-consumer-graph-platform-manager.md:102, 2026-06-12-provider-consumer-graph.md:28 …
Filter.test.ts	(4)	122-filter-clearable-trait-surfaces.md:81, 138-auto-complete-element-and-demo.md:108, 148-filter-error-channel-live-status.md:54 …
migrations.json	(4)	191-upgrader-version-migration-codemods.md:23, 2026-06-12-upgrader-version-migration-codemods.md:4, 2026-06-12-upgrader-version-migration-codemods.md:52 …
verdicts.json	(4)	480-build-vision-gated-capture-qc-client-for-the-design-ref-corp.md:51, 489-archive-quarantined-frames-persist-frame-verdict-pairs-as-a-.md:29, 2026-06-13-backlog-split-analysis.md:280 …
src/_layouts/base.html	(4)	772-static-template-a11y-lint-in-check-standards-structural-rule.md:24, 795-delete-dead-src-layouts-base-html-and-flip-the-nav-active-st.md:13, 795-delete-dead-src-layouts-base-html-and-flip-the-nav-active-st.md:15 …
route-allowlist.ts	(4)	799-where-does-rendered-site-regression-tooling-home-we-specs-vs.md:26, 847-a11y-gate-derives-route-set-from-sitemap-scope-c-sampling.md:16, 847-a11y-gate-derives-route-set-from-sitemap-scope-c-sampling.md:22 …
radius.md	(4)	802-per-component-token-table-data-sourcing-for-the-web-docs-blo.md:33, 802-per-component-token-table-data-sourcing-for-the-web-docs-blo.md:37, 2026-06-16-component-token-table-sourcing.md:34 …
./contract.js	(4)	817-constellation-placement-of-guard-validity-merge-validator-re.md:41, 873-factor-pure-contract-modules-from-runtime-impl-across-we-con.md:24, 873-factor-pure-contract-modules-from-runtime-impl-across-we-con.md:24 …
./provider.js	(4)	834-resolve-loan-origination-s-customguardregistry-we-standard-m.md:34, 873-factor-pure-contract-modules-from-runtime-impl-across-we-con.md:24, 873-factor-pure-contract-modules-from-runtime-impl-across-we-con.md:25 …
testharness.js	(4)	899-behavioral-conformance-vectors-in-browser-implementer-valida.md:47, 899-behavioral-conformance-vectors-in-browser-implementer-valida.md:58, 2026-06-18-behavioral-conformance-vectors-kit.md:21 …
LiveStatus.test.ts	(3)	137-live-status-windowed-trait-surfaces.md:93, 148-filter-error-channel-live-status.md:55, 156-autocomplete-conformance-demo-substrate-crash.md:29
Windowed.test.ts	(3)	137-live-status-windowed-trait-surfaces.md:95, 145-windowed-scroll-height-driven-path.md:57, 164-windowed-scrollheight-active-offwindow.md:55
blocks/__tests__/e2e/data-grid-bootstrap.spec.ts	(3)	144-data-grid-behavior-auto-upgrade-e2e.md:46, 155-registered-behaviors-auto-upgrade-coverage.md:19, 157-editable-grid-behavior-auto-upgrade-e2e.md:44
.oxlintrc.json	(3)	284-validation-normalize-live-config-cli-run-see-over-a-project-.md:16, 284-validation-normalize-live-config-cli-run-see-over-a-project-.md:22, 284-validation-normalize-live-config-cli-run-see-over-a-project-.md:27
registry-item.json	(3)	652-assembler-emit-format-its-relationship-to-the-623-626-workbe.md:58, 2026-06-15-assembler-recipe-emit-prior-art.md:48, 2026-06-15-assembler-recipe-emit-prior-art.md:70
angular.json	(3)	882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:40, 2026-06-17-blocks-json-per-file-split.md:55, 2026-06-17-blocks-json-per-file-split.md:109
./traits/sort.js	(3)	2026-06-02-lazy-traits-loading.md:16, 2026-06-02-lazy-traits-loading.md:33, 2026-06-02-lazy-traits-loading.md:36
remoteEntry.json	(3)	2026-06-11-app-shell-compatibility-map.md:22, 2026-06-11-app-shell-compatibility-map.md:76, 2026-06-11-app-shell-compatibility-map.md:259
front-end-platform-book.md:1228-1230	(3)	2026-06-11-tool-agnostic-chart-config.md:4, 2026-06-11-tool-agnostic-chart-config.md:10, 2026-06-11-tool-agnostic-chart-config.md:26
FocusDelegationSelection.split.test.ts	(2)	021-composite-widget-collapse-to-bundle.md:21, 021-composite-widget-collapse-to-bundle.md:24
src/blocks/attributes/FocusDelegation.ts	(2)	029-focus-delegation-controller.md:20, 029-focus-delegation-controller.md:26
block.njk	(2)	035-autocomplete-block.md:20, 054-multi-select-dropdown-block.md:24
.changeset/config.json	(2)	101-auto-update-pipeline.md:25, 2026-06-11-auto-update-pipeline.md:16
.github/dependabot.yml	(2)	101-auto-update-pipeline.md:25, 2026-06-11-auto-update-pipeline.md:16
CHANGELOG.md	(2)	102-changelog-manifest-standard.md:21, 2026-06-12-research-freshness-model.md:32
HttpResponse.json	(2)	107-mock-proxy-dev-service.md:51, 2026-06-11-mock-proxy-dev-service.md:15
d.ts	(2)	116-bootstrap-consume-trait-manifest.md:71, 238-component-compiler-webpack-real-build-conformance.md:57
frontierui/blocks/renderers/jsx/JSXRenderer.ts	(2)	125-extract-adapter-packages.md:68, 240-jsx-runtime-dedupe-in-repo-consumers.md:32
src/definitions/anchor.md	(2)	136-anchor-trait-behavior.md:18, 149-anchor-positioning-strategy-provider.md:79
3011/auto-complete-demo.html	(2)	156-autocomplete-conformance-demo-substrate-crash.md:17, 156-autocomplete-conformance-demo-substrate-crash.md:39
Element.patch.ts	(2)	160-plateau-autonomous-custom-elements.md:53, 162-insert-adjacent-element-patch-trailing-node-bug.md:18
auto-complete-demo.ts	(2)	160-plateau-autonomous-custom-elements.md:85, 160-plateau-autonomous-custom-elements.md:105
e2e/auto-complete-demo.spec.ts	(2)	161-native-anchor-flip-viewport-overflow.md:60, 168-plateau-in-browser-test-harness.md:54
e2e/insert-adjacent-element.spec.ts	(2)	162-insert-adjacent-element-patch-trailing-node-bug.md:64, 165-playwright-evaluate-object-serialization-patched-pages.md:58
plateau/e2e/windowed-scroll.spec.ts	(2)	163-windowed-variable-row-heights.md:43, 164-windowed-scrollheight-active-offwindow.md:32
patch.ts	(2)	165-playwright-evaluate-object-serialization-patched-pages.md:30, 165-playwright-evaluate-object-serialization-patched-pages.md:35
blocks/intents/plugs/protocols/projects.json	(2)	315-competitive-coverage-gap-analysis-program.md:42, 613-audit-tool-d1-d3-g1-drift-noise-precision-filters.md:23
frontierui/plugs/package.json	(2)	449-wire-the-we-plugs-alias-in-frontier-ui-and-delete-the-vendor.md:35, 449-wire-the-we-plugs-alias-in-frontier-ui-and-delete-the-vendor.md:53
../../../webeverything/src/_data/intents.json	(2)	669-interactive-build-your-own-component-assembler-workbench-ser.md:30, 2026-06-15-backlog-split-analysis.md:259
blocks/__tests__/e2e/durable-tier-verification.sw.spec.ts	(2)	708-build-the-a-durable-tier-verification-demo-real-reloaddurabi.md:28, 816-fui-e2e-verification-lanes-for-the-hosted-block-impl-demos-p.md:17
reports/app-conformance-burndown.json	(2)	711-migrate-check-app-conformance-plus-burndown-series-onto-the-.md:17, 2026-06-15-backlog-split-analysis.md:815
parcel-resolver-trait-enforcer.js	(2)	756-parcel-trait-enforcer-adapter-resolve-the-plugin-config-deli.md:39, 756-parcel-trait-enforcer-adapter-resolve-the-plugin-config-deli.md:114
vite.config.ts	(2)	756-parcel-trait-enforcer-adapter-resolve-the-plugin-config-deli.md:102, 2026-06-06-adapter-real-project-integration.md:90
webcases/compile-requirement.ts	(2)	797-requirement-to-webcase-compiler-deterministic-1-n-projection.md:23, 2026-06-16-backlog-split-analysis.md:347
in-document.js	(2)	808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d.md:18, 808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d.md:27
embed-guest.js	(2)	808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d.md:18, 808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d.md:27
demos.json/blocks.json	(2)	835-host-the-auto-insurance-exercise-app-in-fui.md:23, 837-we-iframe-embeds-the-two-fui-hosted-exercise-apps-in-the-doc.md:29
workspace.json	(2)	882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:40, 2026-06-17-blocks-json-per-file-split.md:55
description.njk	(2)	882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:73, 2026-06-17-blocks-json-per-file-split.md:100
spec.json	(2)	882-split-the-monolithic-blocks-json-into-one-file-per-block-spe.md:73, 2026-06-17-blocks-json-per-file-split.md:100
wptreport.json	(2)	899-behavioral-conformance-vectors-in-browser-implementer-valida.md:76, 2026-06-18-behavioral-conformance-vectors-kit.md:27
vite/rollup/webpack/esbuild/parcel-plugin.ts	(2)	905-decide-exactly-what-of-we-s-trait-enforcer-moves-to-fui-vs-s.md:50, 2026-06-18-905-trait-enforcer-relocation-surgery.md:47
worfklow-blocks.md	(2)	2026-02-22-resource-specs-and-plans.md:82, 2026-02-22-resource-specs-and-plans.md:243
framework-adapters.md	(2)	2026-02-22-resource-specs-and-plans.md:136, 2026-02-22-resource-specs-and-plans.md:244
transient-components.md	(2)	2026-02-22-resource-specs-and-plans.md:187, 2026-02-22-resource-specs-and-plans.md:245
biome.json	(2)	2026-06-07-dev-authoring-preferences-architecture-intents.md:18, 2026-06-07-dev-authoring-preferences-architecture-intents.md:28
src/blocks/attributes/CompositeWidget.ts	(1)	021-composite-widget-collapse-to-bundle.md:19
plateau/src/blocks/renderers/jsx-renderer.ts	(1)	072-jsx-recover-auto-define.md:17
/_maas/user-card.js	(1)	081-module-as-a-service-provider.md:58
tools/.../virtual.d.ts	(1)	116-bootstrap-consume-trait-manifest.md:61
Autocomplete.trace.test.ts	(1)	122-filter-clearable-trait-surfaces.md:81
Clearable.test.ts	(1)	122-filter-clearable-trait-surfaces.md:81
blocks/__tests__/unit/renderers/data-grid.test.ts	(1)	123-data-grid-cell-navigation-block.md:54
blocks/__tests__/unit/renderers/editable-grid.test.ts	(1)	132-editable-data-grid-cells.md:70
plateau/src/blocks/attributes/Anchor.ts	(1)	136-anchor-trait-behavior.md:51
__tests__/Anchor.test.ts	(1)	136-anchor-trait-behavior.md:54
plateau/src/blocks/attributes/Anchored.ts	(1)	136-anchor-trait-behavior.md:55
__tests__/Anchored.test.ts	(1)	136-anchor-trait-behavior.md:58
__tests__/Autocomplete.trace.test.ts	(1)	136-anchor-trait-behavior.md:59
plateau/src/definitions/anchor.md	(1)	136-anchor-trait-behavior.md:62
positioning/strategies.test.ts	(1)	136-anchor-trait-behavior.md:100
plateau/src/blocks/elements/AutoComplete.ts	(1)	138-auto-complete-element-and-demo.md:91
plateau/src/blocks/elements/__tests__/AutoComplete.test.ts	(1)	138-auto-complete-element-and-demo.md:107
src/blocks/attributes/Windowed.ts	(1)	145-windowed-scroll-height-driven-path.md:44
plateau/src/auto-complete-demo.ts	(1)	148-filter-error-channel-live-status.md:59
blocks/__tests__/e2e/data-grid-edit-bootstrap.spec.ts	(1)	157-editable-grid-behavior-auto-upgrade-e2e.md:38
plateau/src/plugs/custom-elements/CustomElementRegistry.ts	(1)	160-plateau-autonomous-custom-elements.md:19
auto-complete-demo.html	(1)	160-plateau-autonomous-custom-elements.md:30
Node.patch.ts	(1)	160-plateau-autonomous-custom-elements.md:53
anchor.md	(1)	161-native-anchor-flip-viewport-overflow.md:59
plateau/src/plugs/custom-elements/pathInsertionMethods.ts	(1)	162-insert-adjacent-element-patch-trailing-node-bug.md:16
src/plugs/custom-elements/pathInsertionMethods.ts	(1)	162-insert-adjacent-element-patch-trailing-node-bug.md:52
plateau/src/blocks/attributes/Windowed.ts	(1)	164-windowed-scrollheight-active-offwindow.md:40
QueryProperty.ts	(1)	164-windowed-scrollheight-active-offwindow.md:62
plateau/src/plugs/custom-elements/Node.patch.ts	(1)	165-playwright-evaluate-object-serialization-patched-pages.md:47
e2e/patch-evaluate-serialization.spec.ts	(1)	165-playwright-evaluate-object-serialization-patched-pages.md:56
HTMLElement.patch.ts	(1)	165-playwright-evaluate-object-serialization-patched-pages.md:58
intents.json/protocols.json	(1)	166-governance-persona-roster-charter-schema.md:67
plateau/playwright.config.ts	(1)	168-plateau-in-browser-test-harness.md:46
e2e/autonomous-connect.spec.ts	(1)	168-plateau-in-browser-test-harness.md:48
/auto-complete-demo.html	(1)	168-plateau-in-browser-test-harness.md:55
auto-complete-demo.spec.ts	(1)	168-plateau-in-browser-test-harness.md:68
autonomous-connect.spec.ts	(1)	168-plateau-in-browser-test-harness.md:68
tooltip.md	(1)	174-tooltip-element.md:30
slider.md	(1)	175-slider-range-block.md:30
segments.md	(1)	176-segmented-control-compound-children.md:28
form.md	(1)	177-form-block.md:32
access-control.md	(1)	178-access-control-authorization-gate.md:43
reports/YYYY-MM-DD-topic.md	(1)	192-longitudinal-research-freshness-system.md:17
traits.json/project-webtraits.njk	(1)	200-trait-delivery-default-eager-override.md:76
demos/validity-merge-demo.html/.ts/.css	(1)	215-validity-merge-runtime-plug-element-internals.md:64
wicg.github.io/webcomponents/proposals/Scoped-Custom-Element-Registries.html	(1)	227-auto-define-strategy-axis.md:102
blocks/.../mapping-conformance.test.tsx	(1)	252-readiness-spec-gap-model-proposer.md:70
check.js	(1)	267-build-time-check-validation-adherence-tool.md:27
oxlint.json	(1)	284-validation-normalize-live-config-cli-run-see-over-a-project-.md:22
.eslintrc.json	(1)	284-validation-normalize-live-config-cli-run-see-over-a-project-.md:27
-benchmark-corpus.md	(1)	316-benchmark-corpus-design-systems-ui-libraries.md:34
contract.json	(1)	332-mock-proxy-dev-server-provider.md:26
cli.ts/server.ts	(1)	333-mock-proxy-console-surface.md:16
-capability-extraction.md	(1)	346-capability-extraction-normalization-schema.md:31
-coverage-gap-detection.md	(1)	347-capability-mapping-gap-detection.md:31
webeverything/webdocs/generator.ts	(1)	426-incumbent-ingestion-adapters-storybook-mintlify-to-the-webca.md:49
coverage-summary.json	(1)	433-build-the-v1-ingest-adapters-sarif-junit-coverage.md:31
a/b.json	(1)	453-check-standards-author-time-lint-for-unquoted-colon-scalars-.md:13
-design-ref-codification.md	(1)	481-build-the-design-ref-codification-pass-per-396-ruling.md:45
codification.json	(1)	481-build-the-design-ref-codification-pass-per-396-ruling.md:45
transformers.js	(1)	488-on-device-ui-screenshot-vision-model-as-a-plateau-capability.md:100
main.ts/index.html	(1)	502-plateau-app-shell-compatibility-map-dashboard-computed-bcd-s.md:50
result.json	(1)	515-scheduled-small-model-frontier-re-benchmark-stay-current-per.md:21
eslint.mjs/oxlint.mjs	(1)	552-storybook-ingestion-adapter-storybook-csf-to-the-webcases-pi.md:20
-fork-existence-test-sweep.md	(1)	602-fork-existence-test-sweep-find-single-solution-mandates-that.md:55
demos/converter.html	(1)	613-audit-tool-d1-d3-g1-drift-noise-precision-filters.md:27
burndown.json	(1)	613-audit-tool-d1-d3-g1-drift-noise-precision-filters.md:27
-component-workbench-landscape.md	(1)	624-inventory-the-component-workbench-docs-tool-landscape-storyb.md:33
formats.json	(1)	626-map-workbench-features-to-we-standards-which-intents-blocks-.md:36
standards-protocol/adapters.json	(1)	663-adapter-driven-source-form-a-framework-adapter-emits-its-nat.md:48
../../../webeverything/src/_data/assemblerPresets.json	(1)	669-interactive-build-your-own-component-assembler-workbench-ser.md:45
reveal-nav.html	(1)	669-interactive-build-your-own-component-assembler-workbench-ser.md:51
3001/demos/component-converter.html	(1)	701-iframe-based-component-viewer-embed-fui-hosted-standard-demo.md:52
webeverything/src/_data/blocks.json	(1)	705-fui-site-s-own-block-surface-7-of-21-its-relationship-to-the.md:21
sdk.js	(1)	732-overlay-modal-escape-for-embedded-demos-iframe-box-vs-host-r.md:72
-unplugged.html	(1)	733-embed-fui-droplist-demo-on-blocks-autocomplete-establish-the.md:30
plateau-app/.../technical-configurator/configurator.ts	(1)	752-embedded-technical-configurator-plateau.md:72
frontierui/tests/a11y/route-allowlist.ts	(1)	771-mirror-the-rendered-site-a11y-gate-into-frontier-ui-3001.md:22
embed-host.js	(1)	808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d.md:18
dist/embed/embed-host.js	(1)	808-exercise-fui-embed-sdk-b1-overlay-escape-end-to-end-dialog-d.md:27
-placement.md	(1)	817-constellation-placement-of-guard-validity-merge-validator-re.md:23
3001/demos/auto-insurance.html	(1)	835-host-the-auto-insurance-exercise-app-in-fui.md:24
3001/demos/loan-origination.html	(1)	836-host-the-loan-origination-exercise-app-in-fui.md:27
adapter/backlog/block/capability/capability-adapter/demo/intent/plug/project/research-topic/resource/state-pages.njk	(1)	846-author-sitemap-njk-over-collections-all-emit-sitemap-xml.md:20
file.tsx	(1)	851-incumbent-component-ingest-adapter-paste-a-mui-incumbent-com.md:24
protocols.njk/intents.njk	(1)	871-build-the-design-system-bundle-infrastructure-designsystems-.md:17
../validity-merge/contract.js	(1)	873-factor-pure-contract-modules-from-runtime-impl-across-we-con.md:30
app-shell.js	(1)	881-decide-the-we-fui-mode-c-host-config-transport-for-dogfooded.md:57
src/_includes/block-descriptions/error-recovery.njk	(1)	2026-02-22-resource-specs-and-plans.md:20
plans/resource-router.md	(1)	2026-02-22-resource-specs-and-plans.md:62
plans/usable-title.md	(1)	2026-02-22-resource-specs-and-plans.md:71
resource-router.md	(1)	2026-02-22-resource-specs-and-plans.md:241
usable-title.md	(1)	2026-02-22-resource-specs-and-plans.md:242
plans/configurable-debounced.md	(1)	2026-02-23-configurable-loading-threshold.md:3
plans/customizable-fetcher.md	(1)	2026-02-23-customizable-fetcher.md:3
plans/composition.md	(1)	2026-02-23-dom-less-composition.md:3
plans/translations.md	(1)	2026-02-23-internationalization.md:3
plans/scoped-event-resource.md	(1)	2026-02-23-scoped-event-discrimination.md:3
plans/virtual-elements.md	(1)	2026-02-23-virtual-elements.md:3
/.claude/plans/help-me-improve-form-dapper-manatee.md	(1)	2026-05-30-form-validation-standard-assessment.md:8
block-descriptions/validation.njk	(1)	2026-05-30-form-validation-standard-assessment.md:21
validation.njk	(1)	2026-05-30-form-validation-standard-assessment.md:350
/.claude/plans/i-think-change-tracking-recursive-wind.md	(1)	2026-05-31-change-tracking-observability.md:9
/.claude/plans/i-d-like-you-to-fluffy-noodle.md	(1)	2026-05-31-webintl-project.md:4
reports/2026-05-31-standards-gap-analysis.md	(1)	2026-05-31-webintl-project.md:9
plateau/src/blocks/attributes/CompositeWidget.ts	(1)	2026-06-02-dropdown-trait-composition.md:7
__tests__/FocusDelegationSelection.split.test.ts	(1)	2026-06-02-dropdown-trait-composition.md:373
plateau/src/blocks/attributes/FocusDelegation.ts	(1)	2026-06-02-dropdown-trait-composition.md:373
CompositeWidget.ts	(1)	2026-06-02-dropdown-trait-composition.md:373
.../provider.ts	(1)	2026-06-03-collection-operations-intent.md:57
.../presets.ts	(1)	2026-06-03-collection-operations-intent.md:58
.../configurator.ts	(1)	2026-06-03-collection-operations-intent.md:59
deno.json	(1)	2026-06-06-adapter-real-project-integration.md:71
MyComponent.ts	(1)	2026-06-06-front-end-platform-book.md:1274
MyComponent.constants.ts	(1)	2026-06-06-front-end-platform-book.md:1275
MyComponent.actions.ts	(1)	2026-06-06-front-end-platform-book.md:1276
MyComponent.test.ts	(1)	2026-06-06-front-end-platform-book.md:1277
3000/demos/jsx-adapter-demo.html	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:59
__fixtures__/mapping-cases.ts	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:111
mapping-conformance.test.ts	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:112
/e2e/jsx-adapter-demo.spec.ts	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:116
blocks/renderers/jsx/__fixtures__/mapping-cases.ts	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:128
blocks/__tests__/unit/renderers/mapping-conformance.test.ts	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:134
plugs/__tests__/e2e/jsx-adapter-demo.spec.ts	(1)	2026-06-06-jsx-adapter-demo-testing-plan.md:150
eslint.config.js	(1)	2026-06-07-dev-authoring-preferences-architecture-intents.md:19
jsconfig.json	(1)	2026-06-07-dev-authoring-preferences-architecture-intents.md:20
devcontainer.json	(1)	2026-06-07-dev-authoring-preferences-architecture-intents.md:23
.vscode/settings.json	(1)	2026-06-07-dev-authoring-preferences-architecture-intents.md:24
casl.js	(1)	2026-06-11-access-control-authorization-gate.md:19
federation.manifest.json	(1)	2026-06-11-app-shell-compatibility-map.md:77
renovate.config.js	(1)	2026-06-11-auto-update-pipeline.md:16
backlog/166-...md	(1)	2026-06-11-governance-persona-charter-schema.md:76
plotly.js	(1)	2026-06-11-tool-agnostic-chart-config.md:20
chart.js	(1)	2026-06-11-tool-agnostic-chart-config.md:20
.tokens.json	(1)	2026-06-12-design-token-theming-system.md:30
backlog/466-...md	(1)	2026-06-13-backlog-kind-axis.md:38
protobuf.js	(1)	2026-06-13-polyglot-maas-origin.md:54
lib/modules/platform/types.ts	(1)	2026-06-14-bot-pr-mechanics.md:87
backlog/370-...-expressive-symbols-...md	(1)	2026-06-14-cross-cutting-accessible-name-intent.md:45
vscode-docs/profiles.md	(1)	2026-06-14-persona-preset-primitive.md:76
registry.json	(1)	2026-06-15-assembler-recipe-emit-prior-art.md:71
presets.json	(1)	2026-06-15-backlog-split-analysis.md:20
self-driven-step-tree.njk	(1)	2026-06-15-backlog-split-analysis.md:89
capabilities/edge-baseline.ts	(1)	2026-06-15-backlog-split-analysis.md:594
X.html	(1)	2026-06-15-backlog-split-analysis.md:1224
capability-manifest/provider.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:20
capability-manifest/guard.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:21
validation-generation/provider.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:22
validation-generation/cel.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:23
validation-generation/crossField.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:24
validation-generation/registry.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:25
validation-generation/fieldError.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:26
validation-generation/adapters/index.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:27
validation-generation/service.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:28
../blocks/renderers/report/renderReport.js	(1)	2026-06-16-730-capability-manifest-validation-generation-placement.md:58
sitemap.xml.njk	(1)	2026-06-16-a11y-gate-route-auto-derivation.md:29
plateau-app/.../configurator.ts:581	(1)	2026-06-16-backlog-split-analysis.md:260
plateau-app/.../seed-render-strategy.ts	(1)	2026-06-16-backlog-split-analysis.md:261
webcases/validate-requirement.ts	(1)	2026-06-16-backlog-split-analysis.md:346
webcases/requirement-schema.ts	(1)	2026-06-16-backlog-split-analysis.md:346
styles/docs/sass.md	(1)	2026-06-16-design-system-bundle-prior-art.md:22
packages/tokens/src/types.ts	(1)	2026-06-16-design-system-bundle-prior-art.md:22
.sassrc.js	(1)	2026-06-16-parcel-trait-enforcer-config-delivery.md:43
custom-elements-manifest.config.js	(1)	2026-06-16-per-component-api-data-sourcing.md:183
nx.json	(1)	2026-06-17-blocks-json-per-file-split.md:109
stencil.config.ts	(1)	2026-06-17-we-fui-wrapper-handoff.md:43
testdriver.js	(1)	2026-06-18-behavioral-conformance-vectors-kit.md:27
commands.json	(1)	2026-06-18-behavioral-conformance-vectors-kit.md:30
```
