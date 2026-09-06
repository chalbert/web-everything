# Batch 12 — staleness audit (11 cards, audited 2026-09-06, READ-ONLY)

- ALREADY-DONE: 0
- SUPERSEDED: 0 (but #2209's forks 2/3/5 are partially displaced — see STALE-PREMISE note there)
- STALE-INFO: 9 (#2301, #2351, #2575, #2209, #2134, #3010, #2544, #1245, #2961)
- STALE-PREMISE: 0 primary (1 partial, inside #2209)
- OK: 2 (#2577, #3194) — DEAD-REFS: 0 (no `#N` ref in this batch pointed at a nonexistent item; all backticked paths resolved except where noted)

---

## #1245 — Reference-runtime blocks (router, navigation, …) are duplicated and drifting between WE and FUI
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The epic is still legitimately open (residual: `we:blocks/resource-loader/`, `we:blocks/renderers/` — both present, 41 `.ts` files between them; only open child is #3194, the other four (#1310/#1311/#1312/#1326) are resolved). But the "**Deferred — could-not-split-here**" bullet list is no longer true: it names *"6 bootstrap families (`router`, `parsers`, `text-nodes`, `for-each`, `transient`, `attributes`)"* plus `wizard`+`workflow-engine`, `stores`, `view`+`tabs` as still-gated, and **none of those dirs exist in `we:blocks/` any more**. `ls /home/user/web-everything/blocks/` today = `__tests__ adapters audit dockable lifecycle master-detail renderers resource-cache resource-loader router selection stepper tree-select trusted-html`; `we:blocks/router/` is now spec-only (13 files, 1,464 lines, matching #3154's "1,486 lines across 13 files"). The card's own 2026-08-17 note *does* state the correct residual ("Still residual … `resource-loader` and `renderers` — the last two of the 16 named families"), so the head sections contradict the tail. Also stale in the Scope section: the 2026-06-20 "duplicated `blocks/` dirs present in both" list (8 + 10 families) is down to 2.
- **suggested action:** edit card — collapse the "Slices"/"Deferred" section to the two genuine residuals (`resource-loader`, `renderers`), marking the rest delivered (#3154 + the four resolved children); keep the 2026-08-17 note as the live plan.

## #2134 — Project-status vocabulary drift: amend the statute with a distinct PROJECT_LIFECYCLE
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The decision itself is still genuinely open and un-implemented — no `PROJECT_LIFECYCLE` and no `checkProjectStatus` exist in `we:scripts/check-standards-rules.mjs` (grep: only `PROJECT_TIERS`/`validateProjectTier`), and the statute still says *"project `status` is not enum-validated"*. But nearly every citation in the grounding digest has drifted:
  - `LIFECYCLE` cited at `check-standards-rules.mjs:789` → actually **:977**; `STATUS_SYNONYMS` :790 → **:978**.
  - `PROJECT_TIERS` + `validateProjectTier` cited at :856-884 → actually **:1044-1061**; `checkStatus` :822-850, :831, :810, :835-840, :784, :824-825, :859-861 all shifted by ~190 lines.
  - Statute rule 6 cited at `docs/agent/platform-decisions.md:136-143` → the "`poc` is the convention — project `status` is not enum-validated" text is now at **:210**; the `#portfolio-project-tiering` forward-reference cited at :470-472 is now at **:540**.
  - `check-standards.mjs` refs: "stays deliberately outside LIFECYCLE" :184 → **:226**; `RESEARCH_STATUSES` warn :224 → **:276**; the Block `implementedBy` warn :172 → shifted.
  - `src/_data/backlog.js:114-120` / `:118` → the `concept` demotion logic is now around **:120-122 / :167**.
  - `src/css/style.css:962-970 / :966,968 / :967 / :970` → now **:973-977** (`status-candidate` :973, `status-implemented` :974, `status-stable` :975, `status-open` :977).
  - **Counts moved:** "45 entries … concept 17 / poc 24 / draft 4" → **46 files, concept 18 / poc 24 / draft 4**. The "45/45 already conform" zero-migration claim still holds (46/46).
  - Still true and re-verified: `src/_data/webhandlers.json` + `src/_data/webportals.json` both still exist (the orphaned `speculative` exhibit is live).
- **suggested action:** edit card — refresh every `file:line` citation and the 45→46 / concept 17→18 counts before the ruling turn; the forks themselves need no change.

## #2209 — Ratify the constellation branding system — philosophy, naming, marks, icon rules
- **verdict:** STALE-INFO (with a partial STALE-PREMISE on forks 2/3/5)
- **confidence:** medium-high
- **evidence:**
  - **Partial premise displacement.** The card presents forks 2 (WE favicon variant), 3 (FUI mark strategy) and 5 (Plateau mark geometry) as ready-to-ratify mark calls. Since then a whole execution chain was filed under epic **#2256** that owns exactly those: **#2249** (system-wide visual language, flat-minimal vs rich-dimensional — *"the single most upstream branding call … gates every mark"*), **#2250** (WE multi-color umbrella vs monochrome), **#2251/#2252/#2253** (finalize the WE / FUI / Plateau marks, each `blockedBy: [2249, 2250]`), and **#2255** (*"Ratify #2209 and roll out the brand assets"*, `blockedBy: ["2209","2250","2251","2252","2253"]`), whose own text says the mark calls must be *"settled and folded into #2209"* first. `plateau:branding-proposals/TRANSITION.md` says the same in the operator's words: *"brand rubric decision, prepared / ready-to-ratify — **DO NOT ratify without the decisions below**"*. So #2209's per-mark forks can no longer be ruled as written — their inputs are open decisions filed after it. **#2209 carries no `blockedBy` and does not reference #2249/#2250/#2251-2253/#2255/#2256 anywhere** (grep for those ids in the card returns nothing).
  - **Stale counts, fork 1:** "≈174 'Frontier UI' across WE + plateau src vs 36 'FrontierUI'" → today WE `src` 179 vs 9, plateau `src`+`index.html` 8 vs 1 (≈187 vs 10); the 34 remaining `FrontierUI` occurrences are all inside `fui:src` (site templates), which is what the fork already says is the migration set. Fork substance unchanged.
  - **Still accurate (verified):** the Fork 4 violet split is live — `plateau:favicon.svg` still `#6d5efc` while `plateau:src/styles/theme.css` uses `#6453f4`; `plateau:branding.html`, `plateau:scripts/gen-branding.mjs`, `plateau:branding-proposals/` (incl. `fork2-b-w-only.svg`) all exist; `we:src/assets/logo.svg` is still the W + ghost-E squircle and `fui:src/assets/logo.svg` still the F/U/I letterforms; `fui:src/_layouts/base.njk` / `index.njk` / `_data/site.js` still render "FrontierUI"; Fork 6's rubric has a live consumer (`we:skills-src/brand-mark-loop/SKILL.md` cites *"WE #2209 Fork 6 brand attribute sets"*) but no ratified rubric doc exists yet.
- **suggested action:** edit card — add the dependency picture (`blockedBy` or at minimum a "chain" note naming #2249/#2250 upstream and #2251-#2253/#2255 downstream), state which forks are still rulable today (1, 4, 6) vs which now depend on the language/color calls (2, 3, 5), and refresh the fork-1 corpus counts.

## #2301 — Force agent-memory and user-skill edits onto a lane (epic)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Part 2 of the three-part design has **already shipped** and the card still describes it as the current bug:
  - Card: *"`we:scripts/guard-lane.mjs:54-61` keys on realpath and **explicitly exempts** any path containing `agent-memory-src/` or `.claude/agent-memory/`"* and *"So a memory Write sails straight into `we:agent-memory-src/` in the primary working tree"*. **False today.** `scripts/guard-lane.mjs` lines 47-56 now carry the inverted rule — *"AGENT MEMORY IS NOT EXEMPT (2026-07-09, superseding a conflicting 2026-07-03 … note) … all three aliases resolve to `agent-memory-src/…` under the primary and are denied"* — and `laneGuardDecision` computes `isMemory` (`:161-162`) only to append an *explanatory* clause to the **deny** message. Child **#2352 is `resolved`**.
  - The Definition-of-done bullet *"`we:scripts/guard-lane.mjs` no longer special-cases agent-memory as an allow exemption"* is therefore already satisfied.
  - The "Pre-flight note (2026-07-07)" argues parts 2+3 cannot be part-landed without part 1 (*"shipping the `guard-lane` deny (part 2) without part 1's repoint would deny every memory write"*) — overtaken by events: part 2 landed alone. Part 1 (**#2350**) is `active` with only its agent-doable half landed (the `--reserve` primitive); its human-gated symlink cutover is outstanding. Part 3 (**#2351**) is `open`.
  - The "Note" ("May slice … re-run `/slice 2301`") is stale — the epic *was* sliced into #2350/#2351/#2352.
- **suggested action:** edit card — rewrite "The bug, exactly" and the pre-flight note to reflect that the guard is already inverted (#2352), and restate the remaining work as #2350's supervised cutover + #2351's Stop hook.

## #2351 — Land the memory-lane diff via a deterministic hook on Stop
- **verdict:** STALE-INFO (minor — line-number drift only; substance re-verified and holding)
- **confidence:** high
- **evidence:** Every load-bearing premise re-checked today and still true: **no `Stop`/`SessionEnd` hook exists** (`we:.claude/settings.json` `hooks` has only `PreToolUse` :40 and `PostToolUse` :76; the only repo-wide `"Stop"` hits are inside this card); **`we:scripts/memory-land-at-stop.mjs` does not exist**; **#2350 is still `active`** with the human-gated repoint undone (its own Progress section: *"Human-gated half — NOT done"*), so `blockedBy: ["2350"]` is real; **#2352 is `resolved`** as the card says; `we:skills-src/closing-session/SKILL.md`, `we:scripts/conveyor/learnings-drop.mjs`, `we:scripts/drain-push-at-close.mjs`, `we:scripts/pr-land.mjs`, `we:scripts/readiness/file-locks.mjs`, `we:scripts/lib/lane-lease.mjs` all exist. Drifted citations:
  - `we:scripts/readiness/drain-lock.mjs` `DRAIN_LOCK_ROOT` cited **:49** → actually **:65**; `NUMBERING_LOCK_PATH`/`DRAIN_LEASE_PATH` cited **:51-54** → **:69-70**; `acquireDrainLease` :161 / `drainLeaseStatus` :197 not re-checked but same file shifted ~16 lines.
  - `we:scripts/pr-land.mjs` `prCreateBodyGuard` cited **:346** → actually **:363**.
  - `we:scripts/drain-push-at-close.mjs` cited as "165 lines" with detach at :94-119 → now **166 lines**.
  - Exact and unchanged: `isReservedLease` `lane-lease.mjs:58`; `file-locks.mjs` `reserve` :237, `readLockEntry` :208, `releaseLockDir` :225.
- **suggested action:** none required (the drift is cosmetic); optionally bump the four line refs when the item is picked up.

## #2544 — Design the visual-differ protocol — two renders to typed delta regions
- **verdict:** STALE-INFO (minor — line-number drift only)
- **confidence:** high
- **evidence:** Substance intact: `we:scripts/lib/visual-comparator.mjs` and `we:scripts/lib/design-pixels-adapter.mjs` exist with the described shapes; `groundVisualLens` is still the only consumer; the finding kinds `dimension-mismatch` / `pixel-delta-exceeded` / `region-shift` are all present; #2538 and #2671 are `resolved`; #2545 (mint the `visual-diff` intent) is still `open` and no `visual-diff` intent file exists yet. Drifted citations:
  - finding shape cited `visual-comparator.mjs:155` → the `region-shift` finding is now emitted at **:162** (`dimension-mismatch` :108, `pixel-delta-exceeded` :128).
  - skip semantics cited `visual-comparator.mjs:200` → the `skipped: true` return is at **:194** (doc at :187).
  - `groundVisualLens` cited `design-pixels-adapter.mjs:214` → **:213**.
  - "classified-in-place `scripts/lib/*` seam" cited `docs/agent/platform-decisions.md:128` → that rule is now at **:184** (:128 is the guard/precondition anchor).
  - Wording nit: *"The review surface contract is the **ratified** `visual-diff` intent (#2538)"* reads as if the intent is minted; #2538 ratified the *shape + the decision to mint*, and the mint itself (#2545) is still open.
- **suggested action:** none / optional edit — refresh the four line refs and soften the "ratified intent" phrasing to "the intent shape ratified in #2538, minting tracked as #2545".

## #2575 — Decision-record schema — persist rationale so decisions are explainable and reopenable
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Still genuinely open — `we:scripts/backlog/ruling-record.mjs` does **not** exist (nor its test), and `we:docs/agent/backlog-workflow.md` carries no schema section. The naming-collision analysis still holds (`we:blocks/renderers/decision-trace/renderDecisionTrace.ts` and `we:src/_includes/project-webdecisions.njk` both present). But the grounding numbers, which the card presents as freshly verified (2026-08-15) and which several design choices lean on, have all moved:
  - *"487 `kind: decision` items"* / *"487 existing decision items predate it"* → **523** today.
  - *"`grep -l '^ratifiedBy:'` finds **exactly two**"* (2828, 2851) → **eight**: 2626, 2828, 2851, 2854, 3118, 3214, 3400, 3402. The "sparse-but-precedented" argument gets *stronger*, but the card's stated fact and its "(only 2 already carry `ratifiedBy`)" out-of-scope rationale are both wrong now.
  - *"`relatedTo` … widely used (221 items)"* → **332** items.
  - Line refs drifted: `jury-core.mjs` `VERDICTS` cited :70 → **:77**; `validateJuryEvent` cited :1034 → **:1533**. `jury-ledger.mjs` `foldJuryLedger` cited :330-341 → **:388+**; gitignore note cited :65-74 → **:61-65**; the "a PR, a design, a decision" doc comment cited :11 → **:17**.
  - Cross-refs all resolve and are correctly stated: #2574/#2576/#2649/#2654/#2641/#355/#2657 resolved, #3128 open, parent #2577 open.
- **suggested action:** edit card — refresh the three counts (523 / 8 / 332) and the five jury-core/jury-ledger line refs; the `ratifiedBy`-present fixture list (task 2b) can now pick from eight items.

## #2961 — A refusal-only test proves nothing — cover the impure half of a CLI
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Nothing has been built (no `isTTY`/`EAGAIN` rule in `we:scripts/check-standards-rules.mjs`; no "refusal-only" text in `we:docs/agent/testing.md`) and the named live instance is still live: `we:scripts/review-core-cli.mjs:320-321` is exactly `if (!process.stdin.isTTY) { const raw = readFileSync(0, 'utf8').trim();`. **The card's "There is a live instance" (singular) is now understated — there are two.** `we:scripts/conveyor/tick-core.mjs:1151` has the same `process.stdin.isTTY` pairing. Since the card's guard requires *"Fix the `we:scripts/review-core-cli.mjs` instance in the same change, or the rule lands red"*, the second instance must be fixed in the same change too or the rule still lands red.
- **suggested action:** edit card — add `we:scripts/conveyor/tick-core.mjs:1151` to the live-instance list and to the `scope:` block (currently `scope:` names only `check-standards-rules.mjs`, its test, and `docs/agent/testing.md` — it does not even list `review-core-cli.mjs`, which the Done-when requires changing).

## #3010 — Adopt a repo-wide process-work freeze and a product quota
- **verdict:** STALE-INFO
- **confidence:** medium-high
- **evidence:** The decision is still open and uncodified (no freeze/quota anchor in `we:docs/agent/platform-decisions.md`; `we:scripts/lib/output-mix.mjs` `computeOutputMix` still exists as the metric instrument). Stale statements:
  - Fork 1(a)'s named exception list says *"#3001 (named operations) `open` **decision — itself unresolved**, sitting on its own exception list"* — **#3001 is now `resolved`**. That was one of the card's four exception-list exhibits and the only one it flagged as self-referentially unresolved. (The other three still hold: #3007 open, #2979 active, #2948 open.)
  - Board counts: *"476 `open` + 18 `active` = 494 in-flight … 494 → 508 within the same hour"* → today **671 open + 36 active = 707 in-flight** (plus 36 parked). The card explicitly says these are directional/point-in-time, so this is soft — but the deltas are large enough that a reader should not anchor on 494.
  - *"The statute-lint tail A2 cites as '~25 items' is 11 today"* → **10 open** today (2 of the 12 tagged items now resolved). Immaterial drift.
  - The output-mix regime claim (completed week +0 product / +51,165 machinery) was not re-run here — flagged as unverified rather than asserted either way.
- **suggested action:** edit card — drop or requalify the "#3001 … itself unresolved" exhibit, and re-stamp the board counts (or replace them with a "re-run at ratification" instruction) before the ruling turn.

---

### OK
- #2577 OK — short epic; still open with one open child (#2575); the other three children (#2576, #2650, #2665) are resolved, and no Ruler surface exists in `plateau-app` yet. Referenced siblings #2505/#2527 are still open, #2574 resolved. (Only nit, not worth an edit: the digest's "Facets tracked as child stories: the jury-refinement method + the decision-record schema" no longer enumerates all four children.)
- #3194 OK — every claim re-verified against `frontierui` today and all four deltas are still absent: `fui:blocks/router/elements/RouteViewElement.ts` `observedAttributes = ['scroll','base','transition','keep-alive','merge-precedence']` (zero occurrences of `entry`) and no `console.error`/`try` guard at the stamp site; `fui:blocks/router/behaviors/RoutePrefetchBehavior.ts` still hand-rolls `new IntersectionObserver` (:73) with no `createViewportPresenceObserver`; `fui:blocks/__tests__/unit/router/types.test.ts` is 351 lines with **zero** `matchAllRoutes` mentions; `RouteViewElement.test.ts` is 734 lines — both line counts match the card exactly; `we:blocks/__tests__/e2e/router-empty-clone.spec.ts` still exists (vacuous assertion still vacuous). Parent #1245 open, #3154 resolved.
