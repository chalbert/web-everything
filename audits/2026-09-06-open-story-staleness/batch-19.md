# Batch 19 — staleness audit (55 open backlog cards, web-everything)

Audited 2026-09-06. READ-ONLY; no repo writes.

- **ALREADY-DONE:** 4
- **SUPERSEDED:** 0
- **STALE-PREMISE:** 2
- **STALE-INFO:** 21 (several also carry DEAD-REFS)
- **DEAD-REFS (only):** 5
- **OK:** 23

---

## #490 — Build the on-device verdict classifier (umbrella)
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** The card describes its slices as pending — *"**A** corpus-export + codified recipe artifact (ready now) → **B** benchmark harness → **C** … → **D** … plus **E**"*. Current statuses: **A = #511 resolved**, **B = #512 resolved**, **E = #515 resolved**, **C = #513 parked**, **D = #514 open**. Also *"**Sizing:** `size:13` is a placeholder — slice into batchable pieces … once #489 has produced enough corpus"* — the frontmatter carries **no `size` field at all**, and the slicing already happened (5 children with `parent: "490"`). DEAD-REF: the body cites `we:anthropic-vision.mjs`; the real path is `we:scripts/design-refs/providers/anthropic-vision.mjs`.
- **suggested action:** edit card — replace the "sliced into A→E" plan paragraph with current slice statuses, drop the `size:13` sentence, fix the `anthropic-vision.mjs` path.

## #514 — In-browser ONNX Runtime Web + WebGPU vision provider
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** Cites `we:providers/anthropic-vision.mjs` — no such path. The file is `we:scripts/design-refs/providers/anthropic-vision.mjs`. (`we:scripts/design-refs/vision.mjs` and `registerVisionProvider` at :149 both check out.) Note also that `blockedBy: ["513"]` points at an item whose status is **parked**, not open — so this card is transitively parked, not merely blocked.
- **suggested action:** edit card (fix the path); consider marking parked to match #513.

## #555 — Collaborative deployed-patch preview (hosted SaaS for #410 overlays)
- **verdict:** OK
- **confidence:** high
- **evidence:** `blockedBy: ["554"]`; #554 is still `status: open` with `dateParked: "2026-06-14"`, exactly as the card describes ("#554-parked"). #410 is resolved, as the card states.

## #646 — Devtools composition assembler (epic)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Every child is terminal except one parked item. `parent: "646"`: #652 resolved, #667 resolved, #668 resolved, **#669 resolved** ("Read-only interactive assembler surface"), #688 resolved, #689 resolved, #856/#857/#858/#859/#860 all resolved, **#660 parked**. The card still describes #669 as *"the deferred interactive workbench tool; re-slice in plateau-app context once #667 lands"* — that re-slice already happened (#688 authoring canvas, #689 eject) and both landed. The presets paragraph ("Now carved (2026-06-17): … #856 … #860") is likewise all-resolved. #713 is resolved as the card anticipates.
- **suggested action:** edit card to record the delivered state, then review for resolution — the epic has **zero open children** (only parked #660).

## #715 — webtraits: tree-shakable trait composition (epic)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's stated goal-set is all delivered: *"proven by one conformance suite"* = #722 resolved; *"served framework-agnostically through the MaaS origin (#461)"* = #719 + #743 resolved (#461 resolved); *"documented publicly on FUI's site"* = #721 resolved; the baseline #716/#717 + adapters #744/#756/#787 all resolved. The only non-resolved child is **#718**, itself an umbrella whose children are #1658 resolved and #1659 parked.
- **suggested action:** edit card (record the delivered goal-set), then review for resolution alongside #718.

## #718 — SWC-native trait transform + Babel pre-step (umbrella)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Both listed child slices are terminal: **#1658 resolved** (the card still describes it as *"Specifiable now → `priority: low` (built ahead of a concrete consumer…)"*), **#1659 parked**. No open slice remains. The "Not a double-count with #232/#1629" note still holds (#232 open, #1629 parked).
- **suggested action:** edit card to reflect #1658 landed; review for resolution (only a parked child remains).

## #1226 — Parity Loop (program epic, `ongoing: true`)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The 2026-07-01 review log is badly out of date. It says *"Coverage **1/8 live** — only the thin contract (#1227) is genuinely in code"*, *"both infra keystones (loader #2017, harness #2024) are unbuilt and **dammed behind the `preparing` decision #2026**"*, *"**Ant had no child at all**"*, and that #1243 is "resolved-but-stubbed". Today **all nine children are resolved**: #1227, #1243, #2017, #2022, #2023, #2024, #2025, #2026, #2031, #2032. The co-evolving validator chain (#1167/#1219/#1220/#1221) is also fully resolved. `reports/2026-07-01-program-parity-loop.md` exists.
- **suggested action:** edit card — run the program watch (`/review-program`) and append a fresh review-log entry; the stated coverage figure is ~14 months of work out of date in effect.

## #1257 — Platform-standards watch (program epic, `ongoing: true`)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card asserts *"Currently **L0**: the metric, sweep, and cadence are not yet built"* and, in the review log, *"Front-A metric not yet built (carved as #1267)"*. **#1267 is resolved and the metric is in code**: `we:scripts/check-standards-rules.mjs:423` — *"── Front-A native-first conformance metric (#1267) ──"*, pure over the `we:src/_data/nativeFirstWatch.json` ledger (file exists). All nine filed slices (#1261–#1269) are resolved; #192 (cited as a sibling watch) is resolved; #291 is still parked as stated. Review log's "Next run" is dated 2026-06-20, ~2.5 months stale.
- **suggested action:** edit card — bump the maturity claim off L0 (item 1 of the L0→L1 carve is done) and re-run the watch to refresh the log.

## #2156 — CI-owned semantic-version releases via release-please
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The closing paragraph says publishing is *"blocked until `main` is reliably green via the PR-lane merge flow (#2138/#2152)"*. **#2138 and #2152 are both resolved**, and the sibling card #2157 already records (2026-07-04) that *"the code blocker has LIFTED"* — only the credential humanGate remains. The wiring itself is verified present: `release-please-config.json`, `.release-please-manifest.json` (`contracts: 0.1.0`), both workflows, `contracts/package.json` at `0.1.0`. `npm view @webeverything/contracts` still returns **E404** (confirmed today), so the residual work is real.
- **suggested action:** edit card — replace the "blocked until main is green" paragraph with "blocked on the credential gate only (see #2157)".

## #2157 — Review the npm-publish lag (contracts 0.1.0 tagged, unpublished)
- **verdict:** OK
- **confidence:** high
- **evidence:** Verified today: `npm view @webeverything/contracts version` → E404, manifest + package.json both at `0.1.0`. The card's own 2026-07-04 correction already retired the stale `blockedBy`.

## #2451 — /prepare candidate set must be origin-fresh and defer-aware
- **verdict:** OK
- **confidence:** high
- **evidence:** `we:scripts/readiness/engine.mjs:189-192` still applies `isFiller` (`priority === 'low'`) to `tierAopen` only — the Tier-B gap the card names is intact. `we:scripts/check-readiness.mjs` still carries only the #2204 fetch-first guard (~:90-112, cited as :91-110 — a two-line drift, immaterial). All scope paths exist.

## #2868 — check:standards + scaffold gate: reject a duplicate-subject open item
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Cites `duplicateBacklogNums`, `we:scripts/check-standards-rules.mjs:2082`; the function is now at **:2286**. The gate itself is still unbuilt (no locus/title-token index; `we:scripts/backlog.mjs` has no `--dup-ok`). A *different* twin-detector, `duplicateBornAs` (:2325), has since landed — it covers the same-`bornAs` case only, not the locus+title-token class this card asks for, and its own docblock explains why it is distinct. #2836 (the motivating twin) is still open.
- **suggested action:** edit card (line number; add a note that `duplicateBornAs` now covers the sibling class, so DoD item 4's back-index rationale should be re-checked).

## #2904 — netChangedFiles never reaches the mechanized review panel
- **verdict:** OK
- **confidence:** high
- **evidence:** Still true. `we:scripts/review-core-cli.mjs:246` calls `buildPanelMandate({ lens, diffBasis })` — no `netChangedFiles`; the library builder accepts it (`we:scripts/lib/review-core.mjs:1052`). `we:scripts/workflows/review-parked-prs.mjs` has zero `netChangedFiles` references, and the fourth composer `we:skills-src/jury/resolve-roster.mjs` is un-threaded as the card says. *Minor drift:* the card quotes the call as `buildPanelMandate({ lens })`; it now also passes `diffBasis`.

## #2905 — Run /code-review on a trust-chain diff BEFORE pr-land
- **verdict:** OK
- **confidence:** high
- **evidence:** Neither A1 nor A2 has landed: a case-insensitive grep for `code-review` in `we:skills-src/pr/SKILL.md` and for `mutation` in `we:docs/agent/testing.md` returns **nothing**. Both scope paths exist; the trust-chain module list (`merge-ai-prs.mjs`, `lane-drain.mjs`, `lane-stack.mjs`, `gate-config.mjs`) all exist.

## #2906 — Totality gate: a step that withholds work must report what it withheld
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** **Both `scope:` entries are dead.** `we:scripts/lib/check-standards-rules.mjs` does not exist — the module is at `we:scripts/check-standards-rules.mjs` (no `lib/`). `we:scripts/__tests__/check-standards-rules.test.mjs` does not exist either — that suite has been split into six topic files (`check-standards-rules-backlog-integrity.test.mjs`, `-conformance-gates`, `-content-lint`, `-githook-flags`, `-lock-point-and-exports`, `-registry-validators`). No `@partial` / `ForLandedPass` rule exists yet, so the work is still open. #2899/#2900 (the motivating fixes) are resolved as described; #2837 and #2993 are still open.
- **suggested action:** edit card — correct both `scope:` paths (which the dispatcher reads for collision planning, so this is not cosmetic).

## #2924 — acquire proves containment at pick time, then destroys the lane ~30s later
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Fixed in `we:scripts/lane-pool.mjs:1155-1171` — after the `git fetch origin --prune` and immediately before the destructive `checkout -B --force`, an explicitly `#2924`-tagged block re-runs `laneDirtyOrAhead` + `aheadIsProvablyPushed(dir, localRemoteShas(dir))` on fresh post-fetch remote-tracking refs and **fails closed** ("no longer provably safe to reset as of this fetch … Use --force to proceed anyway"). Dedicated regression suite: `we:scripts/__tests__/lane-pool-acquire-reverify-containment.test.mjs` (header cites #2924; :107 asserts the error names `#2924`). All three acceptance bullets are met (fresh-state proof, fetch supplies the local objects #2919 wanted, still fails closed).
- **suggested action:** resolve.

## #2926 — Convergence loop's reduce and its returned ledger disagree on the disposition
- **verdict:** OK
- **confidence:** medium
- **evidence:** No `#2926` marker anywhere in `scripts/` or `skills-src/`; `we:scripts/workflows/review-parked-prs.mjs` still computes `disposition` at both the per-round reduce (:477-488, :757-800) and the Ledger phase (:114), with no single-source derivation. Both scope paths exist. Could not re-observe the original journal file (`.claude/projects/…/wf_33cfe58f-954/journal.jsonl`) — that evidence pointer is unverifiable from the repo.

## #2927 — Gate the /pr exit-code table against pr-land's emit sites
- **verdict:** OK
- **confidence:** high
- **evidence:** No gate exists: no `emit`-site parser in `we:scripts/check-standards.mjs` and nothing in `we:scripts/__tests__/pr-land.test.mjs` compares against `we:skills-src/pr/SKILL.md`. The four historical drifts the card cites have all been hand-fixed as it says (exit 4 `blocked-on-infra` documented at SKILL.md:241; `enqueued` documented; `--fallback-git` narrowed to `gh-error`). Notably `behind` is already annotated at SKILL.md:235 (*"listed by `pr-land`, but not producible from this CLI"*), which is exactly the annotation the card's reachability bullet asks for — the DoD's remaining half is the mechanical check.

## #2929 — Sweep the retired "unlabelled-is-a-hold" framing out of the corpus
- **verdict:** OK
- **confidence:** high
- **evidence:** All four sites still carry the retired framing: `we:docs/agent/backlog-workflow.md` (now :1036, was :807), `we:skills-src/batch-backlog-items/SKILL.md` (now :96, was :86 and now :367, was :352), `we:agent-memory-src/104-feedback_commit_to_default_branch_ok.md:12`. Line drift is expected — the card explicitly says *"Line numbers are a snapshot — grep for the phrasing, not the line."*

## #2930 — Fail closed when the rollup contradicts itself
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** `scope:` names `we:scripts/__tests__/merge-ai-prs.test.mjs`, which **no longer exists** — split into six `merge-ai-prs-*.test.mjs` files (the rollup material now lives in `merge-ai-prs-review-escalation-and-rollup-dedup.test.mjs`). The work itself is unbuilt and the description is accurate: `isRequiredCheckGreen` (`we:scripts/merge-ai-prs.mjs:450`) still returns on the single `latestRequiredCheck` conclusion with no contradiction veto; `rollupRowKind` (:440) and `isRequiredCheckFailed` (:462) are as described.
- **suggested action:** edit card — repoint `scope:` at the correct split test file.

## #2934 — Prove the rollup invariant exhaustively
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** The sole `scope:` entry `we:scripts/__tests__/merge-ai-prs.test.mjs` does not exist (same six-way split as #2930). The matrix itself is unbuilt — the only `0001-01-01` handling in the split suites is a single narrative fixture at `merge-ai-prs-review-escalation-and-rollup-dedup.test.mjs:382-386`.
- **suggested action:** edit card — repoint `scope:`.

## #2940 — Gate in-flight backlog hash citations outside the drain's rewrite scope
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The motivating example is stale twice over: *"`we:scripts/lane-drain.mjs` cites `2411`, which resolves to nothing."* — `2411` **no longer appears** anywhere in `we:scripts/lane-drain.mjs` (grep count 0), **and** `#2411` now resolves to a real, resolved item ("Move the lane-manifest off the tree into the PR body"). The class itself is still live (a scan finds ~20+ `#x……` citations under `scripts/**`, e.g. `scripts/produce-pr-view.mjs:5`, `scripts/readiness/dispatch-plan.mjs:4`, `scripts/review-core-cli.mjs:124`), and no gate exists. Also worth flagging for the builder: a naive `x[0-9a-z]{6}` scan false-positives on ordinary words (`xplicit` inside "explicit") — the rule needs the `#` anchor.
- **suggested action:** edit card — replace the `2411` example with a live one from the scan above.

## #2941 — Gate that a relaxation's compensating control is wired on the outcome path it opens
- **verdict:** OK
- **confidence:** high
- **evidence:** No such rule exists — `we:scripts/lib/review-skill-guard.mjs` and `we:scripts/check-standards.mjs` contain nothing about terminal branches or compensating controls. `renderFindingLine` is present at `we:scripts/lib/review-render.mjs:90` (as the card's round-1 fix describes) and `we:scripts/lib/verdict-totality.mjs` (the cited model) exists. #2942 is resolved as the card says.

## #2954 — Derive the care level for working-tree convergence from the touch-set
- **verdict:** STALE-PREMISE
- **confidence:** high
- **evidence:** The card's motivation is *"`--care` is optional in `we:scripts/converge-cli.mjs` and **defaults to `low`** … `panelRigorForCareLevel('low')` yields the weakest active panel — **1 round, 1 juror per lens** … the default review is the shallowest one available."* That is no longer true: `we:scripts/converge-cli.mjs:76` sets `const DEFAULT_CARE = CARE_LEVELS.ELEVATED;`, with a docblock at :69-75 explaining the change (*"The DEFAULT care band is `elevated`, not `low` (PR #1064 review)"* — because at `low` the editor round could never run at all). The ask (derive the band from the touch-set rather than defaulting) is still unbuilt and still defensible, but the "falls to the weakest panel available" framing must be rewritten. `classifyTouchSet` (`review-core.mjs:902`) and `deriveCareLevel`/`CARE_WEIGHTS`/`CARE_BANDS` (`review-escalation.mjs`) all still exist as the fix-shape suggests.
- **suggested action:** edit card — rewrite the "Where the gap is" section against the `elevated` default; re-assess whether the item still earns its priority.

## #2957 — Give the gate-self clearance procedure and its threat model a docs/agent home
- **verdict:** OK
- **confidence:** high
- **evidence:** Still true: `we:docs/agent/` holds no review-workflow doc (directory listing checked — architecture, backlog-workflow, block-standard, build-ui, conventions, delivery-loop, demo-workflow, design-first, dispatcher-runbook, exercise-app-workflow, jury-refinement-method, memory-management, platform-decisions, plugs-testing-strategy, reference-retirement, research-workflow, skill-authoring, testing, vision-tiers, vm-sessions). The clearance procedure still lives in `we:skills-src/review/SKILL.md:227,262,275`. #2895 resolved, successor #2946 still open — both as stated. (The card's own note that `docs/agent/review-workflow.md` does not exist is *not* a dead ref; it is the file this item will mint.)

## #2958 — Forbid a trust-deciding predicate as a function parameter
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** `scope:` names `we:scripts/check-standards-rules.mjs` (**correct — exists**) and `we:scripts/__tests__/check-standards-rules.test.mjs` (**does not exist** — split into six topic files, same as #2906/#2934). Work is unbuilt; the sanctioned `allowClearHuman` boolean is present at `we:scripts/review-set-label.mjs:180,428,442` exactly as the card describes, and `humanCeremony` is absent from the tree as it says.
- **suggested action:** edit card — repoint the test path.

## #2973 — converge-cli bare boolean flags coerce; header cites a nonexistent gate name
- **verdict:** OK
- **confidence:** high
- **evidence:** Both defects intact. `we:scripts/converge-cli.mjs:161` (`typeof flags.care === 'string' ? flags.care : DEFAULT_CARE`) and `:253` (`typeof flags.transport === 'string' ? … : 'working-tree'`) still coerce a bare flag; `--jurors` still goes through `num('jurors', flags.jurors)` at :173. `we:scripts/lib/converge-core.mjs:37` still says *"`check:standards` (rule 16, `checkDeclaredContract`)"* — the real export is `validateDeclaredModuleContract`. The card's stated `--care` default (`elevated`) matches the code.

## #2975 — The convergence loop can LAND on stale material when a driver omits lensResults
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Fixed in `we:scripts/lib/converge-core.mjs:470-482` — a new branch `1c. MALFORMED OBSERVATION (#2975)` placed **before** the `if (!obs.panel.observed) return … PANEL` short-circuit (:485), terminating with `ESCALATE` / `NEEDS_HUMAN` / `STALE_OBSERVATIONS` when an `editResult` or `redTeamResult` arrives with no `lensResults`. Its comment states the ordering requirement verbatim. Three tests in `we:scripts/lib/__tests__/converge-core.test.mjs`: :287 (editResult with no lensResults escalates), :297 (redTeamResult, same), **:305 `'#2975 END TO END — the reproduction from the backlog item can no longer reach `land`'`**. All four "Done when" bullets are met.
- **suggested action:** resolve.

## #2976 — The declared-module-contract gate misses an undeclared import under the LAST declaration
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Fixed in `we:scripts/check-standards-rules.mjs`: a new `lastDeclarationEnd(header, scanFrom)` (:2577-2588) bounds the final declaration by its own backtick-list grammar, and `validateDeclaredModuleContract` (:2613-2619) calls it instead of falling back to `header.length` — with a comment naming **#2976** and a second docblock (:2561-2575) recording a review-r2 refinement (the first cut used a blank-line search, which still fell through when prose followed immediately). Two fixtures in `we:scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs`: :433 (`FAILS on an undeclared import under the LAST declaration even with trailing prose after it (#2976)`) and :460 (the no-blank-line variant). All three "Done when" bullets met.
- **suggested action:** resolve.

## #2977 — Resolve relative markdown links in docs/agent and skills-src at the gate
- **verdict:** STALE-INFO
- **confidence:** medium-high
- **evidence:** The gate is still absent (`we:scripts/check-standards.mjs` has no relative-link resolution), so the work stands — but **every count in the card has moved**. Card: *"50 of 129 relative links dangling … across 22 files … 129 links, 75 resolve, 4 site routes, 46 symlink-view, 4 stale."* A re-run of the card's own method today over `we:docs/agent/` + `we:skills-src/` gives **236 links, 173 resolve, 4 site routes, 47 symlink-view, 12 stale** (my resolver may differ marginally at the margins, but the total has roughly doubled and the stale bucket tripled). The named example holds: `we:docs/agent/backlog-workflow.md` still links to `../../scripts/__tests__/exec-kind.test.mjs`, which does not exist. New stale targets since filing include `docs/agent/backlog-workflow.md → src/_data/blocks.json`, `docs/agent/conventions.md → src/_data/blocks.json`, `docs/agent/memory-management.md → index-x.md`, `docs/agent/vision-tiers.md → ../../src/_data/intents.json`, `skills-src/review-design/SKILL.md → ../../../src/_data/intents.json`, and — worth noting — `skills-src/converge/SKILL.md` and `skills-src/drain/SKILL.md` link to `../../backlog/xl5jroq-…` and `../../backlog/x27e4xs-…`, i.e. **`bornAs`-hash filenames for #3159 and #3158**, which is exactly the #2940 rot class.
- **suggested action:** edit card — refresh the measurement paragraph; the 46-link symlink class is still the dominant bucket, so the fork framing is unchanged.

## #2980 — Deny command substitution in backlog CLI argument values at the bash guard
- **verdict:** OK
- **confidence:** high
- **evidence:** Unbuilt and corroborated in-tree: `we:docs/agent/backlog-workflow.md:39` states the single-quote rule and closes with *"A deterministic bash-guard deny for this class is filed and **not yet built**, so today the rule holds only because you follow it."* `we:scripts/guard-bash.mjs` handles command-substitution *parsing* (`substitutionBodies`, :1014) for the #2367 collision threat model but has no backlog-CLI argument deny. All five relative links in the card resolve.

## #2990 — check-standards rule: every hasUnclearedReviewLabel call site must pass explicit options
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The core claim survives — `we:scripts/pr-land.mjs` still has the one **bare** production call — but the card's correction table is now wrong in every row. Current sites: `merge-ai-prs.mjs:586` (was :562), `:1158` (was :921), `:1848` (was :1502), `:3722` (was :2948); `pr-land.mjs:416` (was **:399**, still bare); `lib/review-escalation.mjs:1669` (was :1243, internal). There is also a **seventh** site the table does not list: `we:scripts/conveyor/parked-pr-conflict-watch.mjs:92` (passes `{ allowPending: false }`). The "six call sites, not two" headline is now itself undercounting.
- **suggested action:** edit card — re-derive the table (it is the card's central artifact) and widen the count to seven.

## #2991 — check-standards rule: exported symbol with no non-test caller + unused import
- **verdict:** OK
- **confidence:** high
- **evidence:** Neither rule exists in `we:scripts/check-standards-rules.mjs`. The acceptance premise still holds: `planDrainPass` now **does** have a production caller (`we:scripts/merge-ai-prs.mjs:4230`, inside `runCli`), and the file's own comment at :1440 records the R4 history, so rule 1 would pass on the current tree as the card predicts.

## #2993 — check-standards rule: a catch feeding a merge decision must set a degradation flag
- **verdict:** OK
- **confidence:** high
- **evidence:** Rule unbuilt (no `@partial`-style or catch-scan rule in `check-standards.mjs`). The behaviour half the card says is already pinned is present: `contextComplete` threads through `joinImplToCouples` (`we:scripts/merge-ai-prs.mjs:906-954`) with `carrierDeferDecision` failing closed on `health === null`. Both scope paths exist. #2989 is `active`.

## #3025 — todoMarker.appliesTo enforced in both directions
- **verdict:** OK
- **confidence:** high
- **evidence:** Still one-directional. `we:scripts/lib/review-policy.mjs` checks `appliesTo`'s own shape at :189-193 and the positive `todo ⇒ appliesTo includes "reasons"` implication at :211 (`fail(\`reason "${r.token}" carries a todo marker, but todoMarker.appliesTo does not include "reasons"\`)`), and no other section is inspected for `todo`/`owedTo`. Both scope paths exist; the body's relative link `../scripts/lib/review-policy.mjs` resolves. Cited line ranges have drifted by 1-2 (~185-193 → 184-194; ~209-212 → 211) — immaterial, the card writes them as approximate. #3027 resolved as stated.

## #3107 — Wire --adopt into the dispatch surfaces so Gap 1's occupancy protection isn't dormant
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's central measured claim — *"verified against the real pipeline, **nothing in-repo calls it**"* — is **no longer true**. `we:skills-src/conveyor/delivery-agent-brief.md:43` now self-acquires with `--adopt` (`--session={{SESSION_SLUG}} --scope={{SCOPE}} --item={{ITEM_NUM}} --adopt`), with an explanatory block at :46-48. `we:docs/agent/delivery-loop.md:120-138` now documents the dispatcher/worker split explicitly (*"a driver must NOT pass `--adopt` here … the dispatcher → worker hand-off `adopt` exists for (#2997 r2)"*), which settles the second half of the "What to do" paragraph and DoD bullet 3. DoD bullet 2 (one real dispatched lane demonstrating a sibling's Edit/Write is refused end-to-end) is the only part I could not confirm. #2997 is still `active`.
- **suggested action:** edit card — strike the "nothing in-repo calls it" finding and reduce the item to the outstanding end-to-end demonstration, or resolve if that demonstration is judged already covered.

## #3155 — Gate the 61 drifted same-path WE↔FUI file pairs
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** No gate exists (the only WE↔FUI drift validator is `validatePlugWeFuiDrift`, which as the card says works off a hand-authored pair list, not path equality). But the measurement in the title and body has moved: re-running the card's own definition today (`git ls-files` in both repos, extensions `.ts/.js/.mjs/.cjs/.json/.css/.html`, same relative path) gives **80 same-path pairs / 28 byte-identical / 52 drifted**, versus the card's `91 / 30 / 61`. The card itself warns the count is definition-sensitive, so treat the delta as directional rather than exact. `we:reports/2026-08-17-zero-impl-boundary-enforcement.md` exists; #1770 and #872 are still open; #1282 is resolved (as a ruling, consistent with the card's use of it).
- **suggested action:** edit card — re-measure and restate the baseline (the DoD asks the declaration to record it, so a stale headline number will be copied into the artifact).

## #3158 — Tool-free panel jurors cannot run the mutation probe their mandate demands
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The finding is intact — `we:scripts/lib/judge-panel.mjs` still has **no** `allowedTools` (grep: zero hits), while `MUTATION_PROBE_RULE` is still unconditionally appended to the mandate at `we:scripts/lib/review-core.mjs:1119` (defined :238). But `blockedBy: ["3145"]` is **stale**: #3145 is resolved. Related #3028/#3050/#3057 and #2439 are all resolved too, so nothing blocks this item. Both scope paths exist.
- **suggested action:** edit card — clear the `blockedBy` (it is holding an unblocked item out of dispatch).

## #3159 — Give the revision-round editor its own tool-bearing headless spawn
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Work intact (no single-spawn tool-bearing shim over `judgeSpawn`; `we:skills-src/jury/panel-fanout.mjs`, `we:scripts/lib/judge-panel.mjs`, `we:scripts/lib/judge-spawn.mjs` all exist as described). But `blockedBy: ["3145"]` is **stale** — #3145 is resolved, as are #3028, #3050, #2439. Separately: `we:skills-src/converge/SKILL.md` and `we:skills-src/drain/SKILL.md` both link to this card as `../../backlog/xl5jroq-…md`, its pre-numbering `bornAs` filename, which 404s (the #2940 class).
- **suggested action:** edit card (clear `blockedBy`); fix the two skill links to `3159-…md` (a #2940/#2977 instance).

## #3166 — Drain's auto-rebase-drop can't clear a we:AGENTS.md inventory conflict
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** Substance holds — `manifestConflictDisposition` is still at `we:scripts/lib/rebase-drop-manifest.mjs:68`, and no regenerate-on-conflict strategy exists for derived artifacts. Line refs have drifted: `isRebaseDropCandidate` is cited at `we:scripts/merge-ai-prs.mjs:615`, actually **:641**; *"the rebase-drop pass at we:scripts/merge-ai-prs.mjs:2993-3070"* now points at unrelated `--batch-feed` option parsing. Also the "Done when" is an unfilled scaffold placeholder (**`1. Executable — TODO: a command that fails before this item lands and passes after.`**), which is the exact class #3172 wants gated.
- **suggested action:** edit card — refresh the two line refs and author a real Done-when.

## #3168 — Lane occupancy protection is opt-in and fails open until adopted
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The gap is unchanged — `we:scripts/guard-lane.mjs:37-45` still lists both fail-open residuals verbatim (*"1. A lane whose occupant was never DECLARED is not protected … Protection is opt-in per lane, via `--adopt`/`adopt`"*, *"2. … this arm separates SESSIONS, not sibling agents of one session"*), so DoD bullet 3 is untouched. But the cited locus has drifted: `isForeignOccupancy` is at `we:scripts/lib/lane-lease.mjs:233`, not **:195-199** (that range now holds `isConfirmedOwnLease`'s tail). Note also that #3107's `--adopt` wiring has since landed in the conveyor brief, which narrows (but does not close) the practical fail-open window this card describes.
- **suggested action:** edit card — fix the line ref and note the #3107 wiring in the "Done when" 2 alternative.

## #3171 — Should compareProportions offer a small-sample-valid method?
- **verdict:** OK
- **confidence:** high
- **evidence:** All four cited loci are accurate: `we:scripts/lib/gate-health.mjs:153` is `const usable = Math.min(kA, nA - kA, kB, nB - kB) >= 5;`, :167/:172 are `usable`/`separated` and the `too few observations for a normal approximation` note, and :355/:365-369 are `assessCriteria`'s `short`/`testable`/`shortBy`/`shortCells`. #3143 still open (as the card requires for the coupling argument), #3090 resolved. Un-prepared, no `preparedDate` — consistent with its own DoD.

## #3172 — Declare a file-backlog-gap operation
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's measured premise — filing a backlog gap was done ~10× by hand *"with zero declared-operation support — unlike review-pr/dispatch-lane/claim/gate-health/suggest-next, all already registered"* — is now partly false. A **`scaffold` operation exists and is registered**: `we:scripts/operations/scaffold.mjs` (header: *"THE `scaffold` DECLARATION (#xrrpfo7, under epic #3029) — bring a new backlog item into existence, with the refusals that stop a malformed one from being born"*, and *"a 1,786-call session audit on 2026-08-21 counted 45 raw `backlog.mjs scaffold` calls … and 0 through any operation, because there was none"*), wired into `we:scripts/operations/run.mjs:57,131`. It covers the write+guard half (locus scan, JIT hash id, guarded write). What #3172 still adds beyond it is the **judge/confirm step that rejects an unfilled Done-when placeholder before landing**, plus the commit/land/dispatch-review chain — and that gap is real (see #3166 above, whose Done-when is exactly such a placeholder).
- **suggested action:** edit card — re-scope Phase 1 against the existing `scaffold` operation (extend it, or compose it) rather than as a greenfield build.

## #3175 — Declare a write-guarded content operation for memory notes
- **verdict:** OK
- **confidence:** high
- **evidence:** No memory-note operation exists (`scripts/operations/` has no memory/note declaration). #3015 (`scrubPublish`) is resolved as the card assumes; sibling items #3160 and #3161 are still open, #3162 open.

## #3177 — dispatch-lane redispatch can coexist with a supposedly-killed prior session
- **verdict:** ALREADY-DONE
- **confidence:** medium-high
- **evidence:** `we:scripts/operations/dispatch-lane.mjs` now carries exactly the DoD-1(a) behaviour: a pre-launch guard over the run store filters `allRuns` through **`dispatchStillHolds`** (:409-460) and, when any record still holds, returns `dispatching: false` with a `holdReason` — *"this operation already has a dispatch in flight for #N (run …)"* (:635-665). The guard's docblock names both failure modes explicitly, including *"releasing on the CLOCK ALONE handed the same lane to a second agent while the first was still listed as running"*, and resolves them on a **liveness** axis (`entry.live`, stamped by `we:scripts/operations/dispatch-lane-io.mjs#stampLiveness` from `claude agents --json`): `live: true` holds at any age; `live: false` (killed pid, listed-and-absent) ages out in minutes; nullish falls back to the clock. That covers DoD 2's "kill the pid, do nothing else, redispatch" sequence by detecting and aging out the stale record. Tests: `we:scripts/operations/__tests__/dispatch-lane.test.mjs:283` (stalled-but-listed still holds) and `:299` (`gone` → does not hold), plus fixture-driven end-to-end assertions at `dispatch-lane-fixture-harness.test.mjs:294-320` (`expect(read.holdReason).toMatch(/already has a dispatch in flight/)`, `/STILL LISTED/`), and a dedicated `dispatch-liveness-hardening.test.mjs`. `we:scripts/conveyor/tick-core.mjs:264` refers to *"reopening the double-dispatch `#3177` already reproduced live"* as a guarded-against regression.
- **suggested action:** resolve — but have the resolver confirm DoD 2's exact kill-pid-then-redispatch sequence is asserted by name, since the tests pin the liveness predicate rather than that literal script.

## #3210 — A review verdict cannot be recorded once its run record is gone with the host
- **verdict:** OK
- **confidence:** high
- **evidence:** Unfixed and unchanged. `we:scripts/operations/record-verdict.mjs` still takes `--runId` with no `--pr` and reads every fact from the host-local run record (header :19-22: *"SO THE INPUT IS A RUN ID, NOT A VERDICT … There is no `--pr` flag to get wrong"*); `we:scripts/operations/run-store.mjs` still writes into the gitignored `.operations/` sidecar. No `#3210` marker anywhere in `scripts/`. The three-way fork (a/b/c) is unsettled. Note #3206 (the card that declared `record-verdict`) is still `open` even though the operation is in the tree — worth a separate look, outside this batch.

## #3211 — Extract the applier subject predicate so record-verdict stops copying its regex
- **verdict:** OK
- **confidence:** high
- **evidence:** The duplication is intact: `we:scripts/apply-review-request.mjs:108` and `we:scripts/operations/record-verdict.mjs:63` each independently spell `/^[\w.-]+\/[\w.-]+$/` (the latter also `!Number.isInteger(pr) || pr <= 0`). No `isUsableSubject` export exists. The file-header claim the card says is currently false (*"it states no request rule of its own"*) is still there at record-verdict.mjs:24.

## #3212 — verify-lane refuses to re-verify after an ordinary second commit
- **verdict:** OK
- **confidence:** high
- **evidence:** Unchanged. `we:scripts/verify-lane.mjs:197-198` still emits `status: 'superseded'` with the exact message the card quotes (*"refusing to START verification for … the on-disk marker holds a terminal … record for … (an overlapping verify-lane run)"*), discriminating solely on "terminal record, different sha". No `--force`/`--supersede` flag and no `merge-base --is-ancestor` check anywhere in the file. Corroborated from the other side: `we:docs/agent/backlog-workflow.md:1036` warns readers about the stale-marker interaction and cites **#3212** by name.

## #3266 — The stop-hook git check reads lane work as unpushed on main
- **verdict:** OK
- **confidence:** medium (unverifiable by design)
- **evidence:** The subject file `~/.claude/stop-hook-git-check.sh` is outside all three repos, as the card's own Note says (*"no PR in this repo can fix it"*), so nothing here can be confirmed or refuted. The in-repo half of the premise still holds: `we:scripts/lane-pool.mjs` does `git checkout -B <branch> <baseRef>` pinning the lane's local branch to `main` (:1173 region), and the primary-read-only rule is enforced by `we:scripts/guard-bash.mjs`.

## #3269 — `backlog.mjs claim` is a delegating front door
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** medium-high
- **evidence:** DEAD-REF: the body cites **`we:readiness/claims.json`** twice; no such path exists. The real location is `.claude/skills/batch-backlog-items/claims.json` (`CLAIMS_PATH` in `we:scripts/backlog.mjs:84` and `we:scripts/readiness/record-touch.mjs:33`). STALE-INFO: **DoD 2 and DoD 3 already appear satisfied.** DoD 2 — `node we:scripts/operations/run.mjs claim --ref=` appears at **zero** call sites across `skills-src/`, `docs/`, `.claude/` and `AGENTS.md`; the single hit (`we:skills-src/next-backlog-item/SKILL.md:197`) is prose describing the PR #1508 regression, not an instruction. DoD 3 — the rule is now stated where a sweeper reads it: `we:skills-src/next-backlog-item/SKILL.md:196-205` carries a blockquote spelling out the delegation and the three things the operation does not own, alongside `we:scripts/operations/declared-homes.mjs:55-60` (the negative control) and `we:scripts/lib/skill-operation-wiring.mjs:96` (`homeDelegates`). Only DoD 1 (a sweep artifact recording the exclusion with its reason) is unconfirmed. #3224 and #3253 are both resolved.
- **suggested action:** edit card — fix the `claims.json` path and mark DoD 2/3 satisfied; the item may then be small enough to close on DoD 1 alone.

## #3293 — A carried correction paragraph must name the revision it describes
- **verdict:** OK
- **confidence:** high
- **evidence:** Unbuilt: `we:scripts/check-backlog-workflow.mjs` exists but contains no correction-paragraph or deictic-antecedent rule (grep for `correction`/`deictic`/`previous body` → nothing), nor does `we:scripts/lib/citation-check.mjs`. Sibling preventions #3292, #3294, #3295 are all still open, as the card's closing paragraph implies.

## #3358 — Pin the FUI sibling ref in the WE deploy build
- **verdict:** OK
- **confidence:** high
- **evidence:** `we:.github/workflows/deploy.yml:161-164` still checks out `repository: chalbert/frontierui` with a `token:` and **no `ref:`**, so the build still tracks FUI default-branch HEAD exactly as the card states. The single `scope:` path exists. #3360 (the deploy-gate change it was deliberately carved out of) is still open. `kind: decision` with an unfilled Executable TODO is consistent with the card's own "the whole item is the choice" note.

## #3365 — Caller sweep should require gate-scoping consistency across lane-local verify arcs
- **verdict:** STALE-PREMISE (+ stale blocker, drifted line refs)
- **confidence:** high
- **evidence:** The card's premise is that three of four documented arcs *"inherit `verify-lane`'s default, which scans the WHOLE repo"*, citing `we:scripts/verify-lane.mjs:52` as that default. **#3372 (resolved) replaced it.** `we:scripts/verify-lane.mjs:184` now reads `const GATE = typeof flags.gate === 'string' ? flags.gate : resolveDefaultGate({ runGit: git, env: process.env }).command;`, and `resolveDefaultGate` (`we:scripts/lib/verify-lane-gate.mjs:94-110`) is **automatically diff-scoped**: it turns on `WE_DIFF_TEST_SELECTION` by default, emits `npx vitest related <selected files>` when the shrink applies, and scopes the health gate to `npm run check:standards -- --local --files=<changed>` whenever `canScopeCheckStandards` allows (unscoped only for `backlog/` and gate-self/policy-core paths). So an unscoped arc no longer means an unscoped run, and the "pre-existing unrelated error inherited from main records a RED marker" failure mode is largely closed by construction. Additionally: `blockedBy: ["3321"]` is **stale** — #3321 is resolved. And the measured table's line refs have drifted: `we:docs/agent/backlog-workflow.md:1003` → the arc is now at **:1036** (with a second verify mention at :215); the `/batch` arc is still scoped at `we:skills-src/batch-backlog-items/SKILL.md:85`.
- **suggested action:** edit card or park — re-measure against `resolveDefaultGate` and decide whether a gate-scoping consistency check still earns its keep now that the default is scoped; clear the `blockedBy` either way.

## #3428 — citation-gate-dedup test's NUL-byte delimiter makes the file undiffable
- **verdict:** DEAD-REFS
- **confidence:** high
- **evidence:** The defect is still live and verified: `python3 -c "print(b'\x00' in open('scripts/__tests__/citation-gate-dedup.test.mjs','rb').read())"` → **True** (55 NUL bytes), and git treats the file as binary. Two of the three "deliberate NUL-sentinel scripts" it names are misspelled: **`we:scripts/renumber-collisions.mjs`** is actually `we:scripts/backlog/renumber-collisions.mjs`, and **`we:scripts/component-render-build-hook.cjs`** is actually `we:scripts/lib/component-render-build-hook.cjs`. (`we:scripts/guard-bash.mjs` is correct; the provenance comment the card points at is `we:scripts/check-standards.mjs:1442`, which uses bare basenames.) #3426 is resolved as stated.
- **suggested action:** edit card — fix the two paths (they would be copied into any follow-up NUL-scanning rule's allow-list).

## #3458 — releaseSessionForNum has no fix/ci-heal branch
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The gap is real and unchanged: `we:scripts/conveyor/tick-core.mjs:685-690` — `releaseSessionForNum` branches only on `prepareKindByNum` (`prepare-decision-<num>` / `prepare-<num>` / `conveyor-<num>`), with no `fix-<pr>` / `ci-heal-<pr>` case. But `blockedBy: ["3332"]` is **stale** — #3332 is resolved (which is what made this a live cost in the first place, per the card's own framing). The cited *"LIVE PREPARE guards (`we:scripts/conveyor/tick-core.mjs:605`)"* line ref has also drifted — :600-610 is now the CI-heal attempt/cap block. #3165 and #2700 are resolved, `we:scripts/operations/dispatch-lane.mjs` and both fix briefs exist.
- **suggested action:** edit card — clear the `blockedBy` (it is holding an unblocked, small item out of dispatch) and refresh the :605 ref.

---

## OK (current and accurate)

- #555 OK · #2157 OK · #2451 OK · #2904 OK · #2905 OK · #2926 OK · #2927 OK · #2929 OK · #2941 OK · #2957 OK · #2973 OK · #2980 OK · #2991 OK · #2993 OK · #3025 OK · #3171 OK · #3175 OK · #3210 OK · #3211 OK · #3212 OK · #3266 OK · #3293 OK · #3358 OK

## Cross-cutting notes for whoever acts on this batch

1. **A six-way test split broke four `scope:` fields.** `we:scripts/__tests__/check-standards-rules.test.mjs` and `we:scripts/__tests__/merge-ai-prs.test.mjs` no longer exist (split into `check-standards-rules-*.test.mjs` ×6 and `merge-ai-prs-*.test.mjs` ×6). Cards #2906, #2958, #2930, #2934 all point at the dead names. Since the conveyor dispatcher plans lane collisions from `scope:`, these are functional, not cosmetic. A repo-wide sweep for those two paths in `backlog/` would likely find more than my four.
2. **Three cards carry a `blockedBy` on a resolved item** — #3158 and #3159 (→ #3145 resolved), #3458 (→ #3332 resolved), plus #3365 (→ #3321 resolved). All four are being held out of dispatch by a blocker that lifted.
3. **Line-number citations rot fast.** Nine cards in this batch cite line numbers that have drifted (#2868, #2990, #3155, #3166, #3168, #3458, #3365, #2906, #3025). #2929 is the model here — it says *"Line numbers are a snapshot — grep for the phrasing, not the line."*
