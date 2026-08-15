---
bornAs: xojug01
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2717"]
scope: ["plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts", "plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html"]
dateOpened: "2026-07-27"
tags: []
---

# S0b · Frozen-target annotation + anchor map + mount-conformance harness

Annotate the ft-integrated-v3 target with data-uc anchors on every rendered=yes surface, commit it as the frozen target, and scaffold the functional-DOM mount-conformance test (built anchor-set + per-anchor tokens vs the frozen target + the pinned date-format matcher).

## Deliverable
Annotate the frozen ft-integrated-v3 target with `data-uc` anchors on every `rendered=yes` surface + each `__setState` variant; commit it as the FROZEN target. Scaffold the functional-DOM mount-conformance test: built-DOM anchor-SET + per-anchor tokens vs the frozen target + the pinned date-format matcher.

## FT cases → rendered=yes
Conformance infra for all yes cases (no new render).

## Scope
- `plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts`
- `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`

**Consumers (checked, none today):** no import or subprocess caller of either file exists yet in `plateau-app` (`grep -rl "mount-conformance\|ft-integrated" .` — zero hits, verified 2026-08-15). The one real future consumer is S0c (#2735, `blockedBy: ["2720"]`), which reads `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html` as its golden-master reference for the PNG baseline diff — a file-read, not an import, so it does not widen this item's scope.

## Decided design

**Source of the frozen target.** The epic (#2705) and the taxonomy story (#2709) both cite one "Live integrated page": `https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046`. Fetched and verified 2026-08-15: a self-contained HTML mockup (31 representative features, both themes via CSS custom properties) exposing `window.__setState` with exactly four named variants — `empty`, `scan`, `feature`, `dag` (no others; confirmed by reading the function body). No asset anywhere in either repo is labelled "v3" today — that label is this design session's own shorthand, not a repo-checked-in name. **Task 1 below is to re-confirm this specific artifact (cross-checked against the trace artifact `ba98baf4-3430-47bd-b90b-386be86d529d` and session history) is the final ratified state before freezing it** — an honest open item, not a blocker: it costs minutes to confirm and any later artifact would be fetched the same way.

**What "mount-conformance" mounts.** `plateau-app:src/feature-tracker/mount.ts` (the real screen component) does **not exist yet** — it is built by S1b (#2721), which sits on an independent branch of the slice DAG (`blockedBy: ["2718","2719"]`, not `2720`) and is not required for S0c (#2735, `blockedBy: ["2720"]` only) either. The whole S0 chain (S0r → S0a → S0b → S0c, #2716→#2717→#2720→#2735) is designed to land **before** any real component exists. So "built anchor-set" cannot mean "anchors found on a live-mounted component" — it means: parse `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`'s own markup at test-run time (via `DOMParser`, not by mutating the global `document`, to avoid cross-suite pollution — vitest's `environment: 'happy-dom'` is global per `plateau-app:vitest.config.ts:16`, which is exactly what "functional-DOM" names, as opposed to the separate Playwright/live-browser gate `plateau-app:tests/visual/real-route-fidelity.spec.ts` uses for a different surface). "Mount-conformance" is a **self-consistency guard on the frozen fixture**: does the checked-in HTML actually carry the anchor set + tokens the design says it should, so a later hand-edit to the file can't silently drop or relabel a case. The LIVE-component cross-check (does the real screen, once built, match this frozen target) is a different, later concern already owned elsewhere — visually by S0c's PNG golden-master (#2735) and behaviourally by S12 (#2730) — not by this item's `data-uc` diff.

**Expected-map authorship.** Per the acceptance line ("the expected map is authored in the design, not the build"): the *set* of codes is derived mechanically from `plateau-app:src/feature-tracker/feature-tracking.webcases.ts`'s already-landed, already-frozen `FT_CASES` (`.filter(c => c.rendered === 'yes')`, 71 codes — confirmed today: `FT_CASES`/`RENDERED_COUNT`/`SPEC_BEFORE_RENDER` exist now, landed by S0r/#2716, family split S16·F12·K9·M32·E1·L1·C0·R0 per `plateau-app:src/feature-tracker/feature-tracking.webcases.ts:64-119`) — so the *set* can never drift from the reconciled register. The *per-anchor tokens* (what each anchor must carry beyond its code) are hand-authored literals inside the new test file, because their real vocabulary (mirroring card-taxonomy's `assert:` line / `parseAssert()` / `CARD_GRAMMAR_BY_UC`, see `plateau-app:src/backlog-view/lane-board.test.ts:1-31`) is defined by S0a (#2717), which is **not built yet** — do not guess it now; read #2717's actual landed exports first (Task 2).

**Date-format matcher's home.** Scope is closed to the two declared files, so the matcher (a small set of named regexes — ISO `\d{4}-\d{2}-\d{2}`, `Mon DD` e.g. `Jul 27`, `in N wks`, `QN`, full month names) lives as module-local consts/helpers inside `plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts`, not a new shared module — consistent with the honest-forecast §0 ruling already frozen in `plateau-app:src/feature-tracker/feature-tracking.webcases.ts:122-156` (projection window / past-delivered date / explicit no-date), which this matcher checks the *format* of, not the *honesty* of (that's a separate, already-covered invariant).

## Interfaces / protocol

- **Import**, from `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (exists today): `FT_CASES: readonly FtCase[]` (`{code, family, n, rendered}`), used as `FT_CASES.filter(c => c.rendered === 'yes').map(c => c.code)` to build the expected anchor SET (71 entries).
- **Import**, from #2717's landed `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` additions (not yet built — read the real shape when #2717 lands, do not pre-guess): whatever per-case assert-line / token-parsing helper it exports, mirroring `parseAssert`/`CARD_GRAMMAR_BY_UC` from `plateau-app:src/backlog-view/card-taxonomy.webcases.ts`.
- **Fixture load**: `readFileSync(join(dirname(fileURLToPath(import.meta.url)), FIXTURE_NAME), 'utf8')` where `FIXTURE_NAME` is `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`'s basename — same pattern as `plateau-app:tools/explorer/__tests__/fixtures.test.ts` and `plateau-app:packages/extensions/src/chrome-extension/panel-detect.test.ts`.
- **Parse**: `new DOMParser().parseFromString(html, 'text/html')` (happy-dom global env, `plateau-app:vitest.config.ts:16`), then `doc.querySelectorAll('[data-uc]')` for the built anchor-set.
- **Negative control** (proves the check is real, not vacuous): a small in-test-only mutated copy of the fixture string (swap or drop one `data-uc` value) must make the same assertion FAIL — do not mutate the checked-in file to prove this.

## Tasks (ordered)

1. Confirm the frozen-target source: re-open `https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046` and the trace artifact `ba98baf4-3430-47bd-b90b-386be86d529d`; verify this is the final ratified integration (post Round-2/frame-committee), not an earlier iteration. Record which URL/version was frozen.
2. Read #2717's actual landed `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` / `plateau-app:src/feature-tracker/feature-tracking.webcases.test.ts` (must have merged first — this item is `blockedBy: ["2717"]`) to learn the real per-case assert-line/token vocabulary.
3. Capture the artifact's rendered DOM across all four `__setState` variants (`empty`, `scan`, `feature`, `dag`) in one theme (light is the CSS default — theme is a token swap, not a structural change, so one theme's markup is sufficient for anchor placement).
4. Assemble `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html` as a single static file unioning the four captured states (e.g. one container per state) — no new rendering, only re-arranging what `__setState` already draws.
5. For each of the 71 `rendered=yes` FT codes, locate its real surface in the assembled markup and add `data-uc="FT-<code>"` (plus whatever per-anchor tokens #2717 defines). **If a code has no locatable surface** (most likely among the 16 `yes` S-family/screen-level codes, since some screen configurations — e.g. filter-to-zero, mobile drilldown — are interaction-driven, not `__setState`-driven, and their *rendered* rendering is S9/#2722's job, not this item's) — that is a reconciliation defect in the already-merged #2716 register, not something to paper over: escalate it (comment on #2716/#2705, or file a follow-up) rather than inventing a fake anchor.
6. Write `plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts`: parse the fixture, assert the built anchor-set exactly equals the 71-code expected set, assert per-anchor tokens against #2717's real vocabulary, implement the date-format matcher and assert it against every date-like text node in the fixture.
7. Add the negative-control test (mutated in-test fixture copy) that proves a relabelled/wrong surface fails.
8. Run `npm test` (plateau-app) locally; confirm green and that the landing diff touches only the two declared files (plus this card).

## Done when
- `plateau-app:src/feature-tracker/feature-tracking.mount-conformance.test.ts` exists, matches the plateau-app vitest include glob (`plateau-app:vitest.config.ts:16` — the `src/**/*.test.ts` pattern), and runs under plain `npm test` with no separate wiring.
- The test asserts the built anchor-set (parsed from `plateau-app:src/feature-tracker/ft-integrated-v3.annotated.html`) exactly equals `FT_CASES.filter(c => c.rendered === 'yes').map(c => c.code)` — no missing code, no extra `data-uc`.
- A mutated/relabelled in-test copy of the fixture makes the same assertion fail (proves the expected map is independent of the file).
- The date-format matcher matches ISO / `Mon DD` / `in N wks` / `QN` / full month names on representative fixture strings, and rejects at least one malformed example.
- `npm test` is green in `plateau-app`; `git diff --name-only` for the landing commit touches exactly the two scope files.

## Delivery shape
Single-piece landing (not incremental): the test is meaningless without its fixture and vice versa, and neither modifies existing code (pure addition — `plateau-app:src/feature-tracker/mount.ts` doesn't exist yet, nothing else references these two files) — lands directly on `plateau-app` `main` behind no flag, same shape as #2716's landing (one commit, one PR, per `git log --oneline` scoped to the feature-tracker directory).

## Preparation status
Prepared per checklist items 1–8 (`we:agent-memory-src/story-preparation-checklist.md`) — claims verified against live repo/artifact state 2026-08-15, design decided with the not-yet-built-component conflict resolved, interfaces cited, tasks ordered, Done-when made testable, delivery shape stated. **Item 9 (independent review of this preparation) has not happened** — per the checklist, "prepared" and "build-ready" are different states; this card should get that independent pass before a build starts against it.

## Acceptance
The frozen target has an anchor on each yes surface; a relabelled/wrong surface FAILS (the expected map is authored in the design, not the build); the date-matcher matches ISO / `Mon DD` / `in N wks` / `QN` / month names.
