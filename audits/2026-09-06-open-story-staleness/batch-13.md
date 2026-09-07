# Batch 13 — staleness audit (15 cards)

- ALREADY-DONE: 2 (#2387, #2914)
- SUPERSEDED: 0
- STALE-INFO: 5 (#666, #2128, #2873, #2938, #3128)
- STALE-PREMISE: 0
- DEAD-REFS (standalone): 0 — OK: 8

---

## #666 — Self-Driven Project
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** `ongoing: true` umbrella, correctly still open. Every `#N` ref and every path in the card
  resolves (`SELF-DRIVEN-PROJECT-DRAFT.md`, `reports/2026-06-15-self-driven-project-prior-art.md`,
  `reports/2026-06-15-backlog-split-analysis.md`, `src/_data/researchTopics/self-driven-project.json` all
  exist). Three statements have gone stale:
  1. `§B → #674 … **not yet sliceable** — re-`/slice` in plateau-app context once #672 lands` —
     `backlog/672-*.md` is `status: resolved` **and** `backlog/674-*.md` is itself `status: resolved`. The
     instruction has been overtaken on both halves.
  2. `§E … the #143 approach page stays parked` — `backlog/143-*.md` is `status: open`, not `parked`.
  3. "Net-new slices — carved 2026-06-15" lists §A–§D as #671/#672/#673/#674; **all four are now
     `resolved`**, so the epic currently has no open carved child of its own. As a standing program that is
     legitimate, but the card reads as if the slice wave is still in flight.
- **suggested action:** edit card — strike the "not yet sliceable / re-`/slice` once #672 lands" note on §B,
  correct #143's state to `open`, and add a one-line "carved wave 671–674 all landed; next wave TBD" so the
  ongoing epic states its actual current position. Do NOT resolve (`ongoing: true` by design).

## #2128 — Pilot consumption channel: publish the pilot-scoped artifact set
- **verdict:** STALE-INFO (trivial only — the substance re-verifies exactly)
- **confidence:** high
- **evidence:** re-checked every on-disk claim in `/home/user/frontierui` today, and they all still hold:
  `blocks/package.json` has `"private": true` and **no** `files` / `dependencies` / `publishConfig` /
  `repository`; `plugs/package.json` has **no** `private` field, `version 0.0.0`, `repository.url` still
  `https://github.com/frontierui/frontierui.git`, and a `files` allowlist naming only the 8 dirs the card
  lists; `fui:.github/workflows/` contains **only** `ci.yml` (no publish workflow); `package.json`'s
  `"customElements"` still points at `/tmp/cem-probe/custom-elements.json`; `scripts/gen-pilot-wrappers.mjs`
  does not exist yet; every other cited path (`tools/maas/produceWrapperBytes.mjs`,
  `tools/maas/wrapperServeHandler.mjs`, `tools/maas/vite-plugin.mjs`, `workbench/registry.ts`,
  `plugs/webvalidation/*.ts`, `plugs/webanalytics/analyticsConformance.ts`, `blocks/audit/AuditProvider.ts`,
  `blocks/renderers/component/jsxSource.ts`) exists. `blockedBy: ["907"]` — `backlog/907-*.md` is still
  `status: open`, so the blocker is live. Two counts have drifted:
  - "`exports` declares 22 subpaths" for `plugs` — now **23**.
  - "`<background-tasks>` … declared inline at `fui:workbench/registry.ts:328-354`" — the entry now begins
    at ~`:322` (doc comment) / `:329` (`id: 'background-tasks-live'`).
- **suggested action:** none required; optionally bump the two numbers on next touch. Card is otherwise
  accurate and correctly blocked.

## #2387 — Serial-batch → drain coordination: overlap-stack lanes, proof-of-land gate, push the handoff
- **verdict:** ALREADY-DONE (scope delivered)
- **confidence:** high
- **evidence:** every slice in the card's own "Slice plan" table is filed and `resolved`:
  `drain-dual-lock`→#2391, `hash-aware-cascade`→#2388, `manifest-stack-fields`→#2389, `lane-pool-base`→#2386,
  `bornas-proof-of-land`→#2392, `proof-gated-stacked-drain`→#2393, `producer-overlap-stacking`→#2394,
  `per-item-review-diff`→#2390, `push-at-close`→#2395, `finish-stack-repair`→#2396,
  `docs-stacked-batch`→#2397 (plus #2400, #2443, both resolved). Spot-checked the machinery on disk:
  `scripts/readiness/lane-manifest.mjs:81,112` implements `stackParents` (`#2387 F3` cited in the docblock);
  `scripts/backlog/id.mjs` carries the `bornAs` guard and `landedNumberFor`; `scripts/lane-stack.mjs:58`
  imports `CAPABILITY_MARKER_PATH`/`readCapabilityFromMain` from `scripts/readiness/drain-capability.mjs`
  (step 5's durable capability marker); `scripts/drain-push-at-close.mjs` exists and fires the detached
  lease-checked drain; `bornAs:` frontmatter is present on backlog cards repo-wide. All 11 touchpoint paths
  in the card's table exist.
- **suggested action:** resolve — but the epic has ONE open child, **#2442** (a low-priority follow-on
  polish, not part of the original slice plan). Park or resolve #2442 first (see below), then resolve #2387
  under the no-open-slice guard.

## #2873 — Spec-first self-approval (epic)
- **verdict:** STALE-INFO (minor)
- **confidence:** medium
- **evidence:** the epic's substance is intact — all five slices (#2875–#2879) are still `open`, and none of
  the machinery they call for exists (`isTrustChainTier` appears only in backlog prose; no `stryker.config.*`
  and no stryker dependency; a repo-wide grep for `probe-refuted`/`probe-passed`/`probe-runner` and for
  `test-manifest`/`specManifest` returns nothing under `scripts/`). One statement has moved:
  - "**Low priority — prioritize only after the current review-machinery PR pile closes** (the #2830/#2838
    cluster)" — `backlog/2838-*.md` is now `status: resolved` (dateResolved 2026-08-02). `backlog/2830-*.md`
    is still `status: active`, so the gating premise half-holds.
- **suggested action:** edit card — drop #2838 from the "PR pile" clause (keep #2830), or restate the
  precondition as "#2830". No change to the design.

## #2875 — Trust-chain tier predicate + coverage instrumentation
- **verdict:** OK — see the OK list. (Re-verified: `vitest.config.ts` `coverage.include` is still the #2082
  curated allowlist with the comment at ~L18-25 explicitly excluding `tools/` + `scripts/`; `scripts/lib/`
  is instrumented nowhere; `isTrustChainTier` does not exist in any `.mjs`/`.ts`. `scripts/lib/
  disposition-judge.mjs` and `scripts/lib/review-core.mjs` both exist.)

## #2914 — The converge loop requires diffBasis but no juror ever reads it
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** every item in the card's own "Done when" is satisfied on disk:
  - `scripts/lib/review-core.mjs` exports `isDiffBasisDegraded` (referenced at `:1043`) and
    `buildPanelMandate` now carries the guarded disclosure — `:1102-1105`, literally
    `if (diffBasis && isDiffBasisDegraded(diffBasis)) {` with the "never a bare
    `isDiffBasisDegraded(diffBasis)`" comment the card specified.
  - `scripts/review-core-cli.mjs:237,240,246` — `buildMandateText({ …, diffBasis })` forwards to
    `buildPanelMandate({ lens, diffBasis })` on the `'lens'` branch only; `:656` reads the
    `--diffBasis` flag in `runMandate`.
  - `scripts/workflows/review-parked-prs.mjs:1189` defines `const basisOf = (f) => (f && f.diffBasis ===
    'net') ? 'net' : 'three-dot';`, `:1190` captures it, `:1283` and `:1329` re-capture at both refetch
    sites (3 sites, as specified); `:672` `lensPrompt(..., diffBasis = 'net')`; `:1044-1055` implements the
    exact `basisDegraded` / `degrade` / reasons-list block the card wrote out verbatim, and `:1068-1072` is
    the safety net forcing `verdict='needs-human'` / `OUTCOME_ESCALATE`.
  - Tests: `scripts/lib/__tests__/review-core.test.mjs:2026-2033` (`isDiffBasisDegraded` unit tests),
    `:813` (the truthy-AND-degraded guard), `:2107-2108` (source-regression: the `basisOf` literal and
    exactly 3 `diffBasis = basisOf(fetched)` occurrences), `:2116-2117` (the `--diffBasis` shell-out flag).
  The card's own claim that "`fetched.diffBasis` is never read" is no longer true — it is read, threaded,
  and gated on, in all four production files the card scopes.
- **suggested action:** resolve.

## #2937 — Should the agent-behaviour rules that govern landing and review sit at the statute tier?
- **verdict:** OK
- **confidence:** high
- **evidence:** re-ran the card's measurement live —
  `scoreEscalation({ changedFiles: ['agent-memory-src/land-on-no-regression-not-perfection.md'], diffLines: 30 })`
  returns `{escalate: true, humanRequired: false, careLevel: 'elevated'}`, byte-for-byte the card's stated
  result. `STATUTE_PATHS` is still the two-regex `docs/agent/…` set at `scripts/lib/review-escalation.mjs:70-73`
  (line refs exact); no `agent-memory-src`/`skills-src` entry has been added to `TRUST_CHAIN`. All 15 named
  exemplar files exist, as does `reports/2026-08-15-agent-behaviour-review-gate-tier-2937.md`. The decision is
  *actively cited as still-open by the code*: `scripts/lib/gate-config.mjs:329-335` — "ADJACENT TO #2937,
  RESOLVED INDEPENDENTLY … #2937 is the still-open decision on whether the agent-BEHAVIOUR *prose* rules …
  need a tier bump … #2937 stays scoped to the prose surface it was opened for." `#2909` is resolved as the
  card says; `isPrincipleSurface` is still unbuilt (only referenced in comments/tests), as the card asserts.
- **suggested action:** none — ready to ratify as written.

## #2938 — How wide should the blast-radius net over the agent-instruction surfaces be?
- **verdict:** STALE-INFO (line refs only; the measurement and the fork are intact)
- **confidence:** high
- **evidence:** the measurement reproduces exactly — `isBlastRadiusPath()` returns `false` for
  `.claude/settings.json`, `.claude/commands/foo.md`, `AGENTS.md`, `CLAUDE.md` and
  `docs/agent/conventions.md`. `BLAST_RADIUS` is still the narrow two-anchor form the card quotes
  (`scripts/lib/review-escalation.mjs:245-255`). The second-order claims hold:
  `scripts/readiness/test-selection.mjs:93` is the byte-identical `/(^|\/)\.claude\//` and
  `scripts/readiness/__tests__/test-selection.test.mjs:53` pins
  `isSensitivePath('.claude/settings.json') === true`. Every doc in Fork 2's `DOCS_AGENT_ROUTER_PATHS` regex
  exists, as do the three deliberately-excluded ones. `#2939` and `#2935` both exist and are `open`.
  `FORK_HEADING_TERMS` is still a fixed phrase list (`scripts/check-standards-rules.mjs:539-542`), so the
  "lint gap" note still stands. Stale statements:
  1. "`producerReviewLabel` returns `review:human` … (`we:scripts/lib/review-escalation.mjs:658-662`)" —
     `producerReviewLabel` is now at **`:761-765`**; `:658-662` is unrelated `#3343` humanRequired-suppression
     prose. The *claim* is still correct; only the citation is wrong.
  2. Minor: `BLAST_RADIUS` cited as `:245-254`, actually `:245-255`.
  3. Worth knowing for whoever builds this: `scripts/check-standards-rules.mjs:94-100` records that
     `findBuriedForkSections` (the lint the card's "lint gap" section is about) **has no caller in
     `check-standards.mjs` at all** — it is a pure, unit-tested rule function that the gate never runs. The
     card treats it as a live-but-narrow lint; it is currently not wired.
- **suggested action:** edit card — repoint the `producerReviewLabel` cite to `:761-765`, and add the
  "not wired into the gate" fact to the lint-gap note. Then ratify; both forks are still live.

## #3128 — Reconcile #2576 per-option 1-5 ratings text against jury-core verdict model
- **verdict:** STALE-INFO (line refs into `jury-core.mjs` have drifted materially)
- **confidence:** high
- **evidence:** the *substance* is intact — `#2576`, `#2649`, `#1034` resolved; `#2575`, `#3114`, `#2577`
  open; `docs/agent/vision-tiers.md:127-132` still carries the #1034 ratification;
  `skills-src/review-design/SKILL.md:44` is still the "Output is advisory, not a gate" line;
  `docs/agent/jury-refinement-method.md:47` / `:51` ("a 4.5-vs-4.4 is a coin-flip") / `:99` ("Rate, don't just
  pick") are all exact; `AGENTS.md:61` is still the fork-ruling router row naming "per-option 1–5 ratings →
  weak-flag + search"; `docs/agent/build-ui.md:133-135` and `:258-261` still restate moves 3–4;
  `skills-src/design-committee/SKILL.md:8-9` still defers to the *When to run the full jury* section
  (`docs/agent/jury-refinement-method.md:15`), as the card says; `reports/2026-08-17-judge-grading-instruments.md`
  and `src/_data/researchTopics/judge-grading-instruments.json` both exist. But **every `jury-core.mjs` line
  citation is wrong now**:
  - `IMPACT_LEVELS` cited `:190-195` → actually **`:197-202`**
  - `IMPACT_GLOSS` cited `:203-208` → actually **`:210-215`**
  - `PREVENTION_IMPACT_BAR` cited `:257` → actually **`:264`**
  - `blocksAcceptance` cited `:530-534` → actually **`:971`**
  - `AGGREGATION` cited `:694` (with `:701` docblock, `:728` return) → actually **`:1193`** (returned at
    `:1227`); `:694` is now `evidenceStrength`'s JSDoc
  - "`jury-core.mjs:1359-1384` does not forbid a set-shaped subject … `subject` is a subject kind,
    `extractTouchSet(input)`" → the adapter contract is now at **`:1839-1901`**
  The *claims* those cites support all still verify (the values, names and semantics are unchanged), so this
  is citation rot, not a wrong argument.
- **suggested action:** edit card — refresh the six `jury-core.mjs` line references before ratifying. Fork 1
  itself is still live and unruled.

---

## OK

- #2875 OK
- #2876 OK — `coverage.include` in `vitest.config.ts` is still the #2082 curated allowlist whose own comment
  excludes `tools/` + `scripts/`; `scripts/lib/disposition-judge.mjs` / `review-core.mjs` are uninstrumented;
  no per-diff attribution exists; `blockedBy: ["2875"]` is still `open`.
- #2877 OK — `redRefute` is still a pure ledger function (`scripts/lib/disposition-judge.mjs:336`, called at
  `:397`); no probe-runner and no `probe-refuted`/`probe-passed` ledger events exist anywhere in `scripts/`;
  `blockedBy: ["2876"]` still open.
- #2878 OK — no `stryker.config.*` and no stryker entry in `package.json`; `blockedBy: ["2877"]` still open.
- #2879 OK — no test-manifest / `specManifest` gate exists; `#2838` (enforce-flip) is resolved and its
  `codifiedIn: docs/agent/platform-decisions.md#enforce-flip-triple-gated` anchor is real, so the
  enforce-flip gating premise is intact; the `it.fails` grounding note is a recorded refutation, not a
  live claim to re-check. `blockedBy: ["2878"]` still open.
- #2937 OK (full block above — kept there because the live measurement was re-run).
- #2442 OK — the premise re-verifies: `readBatchFeed` (`scripts/merge-ai-prs.mjs:1769-1777`) returns
  `{known:false, reason:'feed-absent'}` when the feed file is missing, and `:4800` only increments
  `batchNonRunningStreak` when `feed.known && feed.running.length === 0`, so `decideBatchesIdleExit` (`:1793`)
  can never fire with no feed — the drain runs to `--max-runtime-min` (default 60, `scripts/drain-push-at-close.mjs:149`)
  holding the lease, exactly as the card describes. `#2330` resolved, `#2445` still `open`, so the
  "a resident coordinator replaces this wholesale" priority note is still accurate. All 6 `scope:` paths exist.
  NOTE: this is the single open child blocking #2387's resolve — park it or land it.
- #3419 OK — `DISPATCHED_AGENT_SYSTEM_PROMPT_FILE` is still the hand-counted join at
  `scripts/operations/dispatch-lane-io.mjs:873`; the argv test at
  `scripts/operations/__tests__/dispatch-lane.test.mjs:1426` still compares only against the imported
  constant (tautological, as the card says); the `LAUNCH_KINDS` brief-path existence loop the card wants the
  new assertion beside is at `:1448-1450`; no existence assertion for the constant exists. Target file
  `skills-src/conveyor/dispatched-agent-system-prompt.md` does exist (so the assertion would pass today —
  card's "correct as shipped, coverage gap not a live bug" is right). Minor: the card's `## Done when`
  bullet 1 is still a literal `TODO` placeholder.
