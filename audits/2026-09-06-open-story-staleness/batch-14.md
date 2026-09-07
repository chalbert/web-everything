# Batch 14 — staleness audit (15 cards)

- ALREADY-DONE: 1 (#3045)
- SUPERSEDED: 0
- STALE-INFO: 12 (#1848, #2401, #2545, #3018, #2094, #2158, #1855, #2981, #2207, #2208, #3020, #2893)
- STALE-PREMISE: 0
- DEAD-REFS (as secondary verdict): 4 (#2545, #2158, #2981, #3020)
- OK: 2 (#2201, #2402)

---

## #1848 — Enterprise-level functionality (centrally-managed policy, account controls)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Slice 2 text says *"Enterprise SaaS account controls — … Carved 2026-07-09; needs `/prepare` + `/slice` on pickup."* That is done: `backlog/2402-…md` now carries `preparedDate: "2026-08-15"`, was converted to `kind: decision`, and carries two fully-argued forks + a graduation plan.
  - Everything else checks out: #2372 `status: resolved` (`dateResolved: 2026-07-10`), #1850 resolved, slice 3 (#2401) still `blockedBy: ["1391"]` with #1391 open. `reports/2026-07-09-backlog-split-analysis.md` exists.
- **suggested action:** edit card — change slice 2's trailing clause to "prepared 2026-08-15 as decision #2402; awaiting ratification, then `/slice`".

## #2094 — Framework-flavored delimiter bundles
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Frontmatter `blockedBy: ["2104"]` — **#2104 is `status: resolved`**. The blocker is gone; the epic reads as blocked when it is not.
  - Body: *"Rides behind the #2093 build (#2104 registry; #2110 regions)"* — #2093, #2104, #2110 all resolved.
  - Every named slice is resolved: #2113 (keystone), #2114, #2115, #2116, #2117, #2118, #2119 — all `status: resolved`. #1980 (the include/outlet gate) is also resolved, and #2024 (the cited analogue) resolved.
  - *"the anticipated mid-region-marker gap … gets its decision card from the first confirming gap list, not a guess"* — that card now exists and is prepared (#2201, `preparedDate: 2026-07-04`).
  - Not ALREADY-DONE: the epic's only remaining child #2201 is still an open decision, so it cannot resolve yet.
- **suggested action:** edit card — clear `blockedBy: ["2104"]`; add a status line that all six bundles + the keystone shipped and the sole remaining child is the #2201 decision (i.e. this epic is one ratification + one impl slice from done).

## #2158 — Package FUI component-render so the WE site builds single-repo
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** the decision itself is still live and unbuilt (no `@frontierui/*` package is published; WE still shells out to the FUI sibling), but the grounding digest's citations have rotted and one cost claim is now wrong:
  - **Wrong claim:** *"`happy-dom` (→ iconv-lite/safer-buffer) lands in WE's `node_modules` either way — a heavy tree into a 3-dep repo"*. `happy-dom: ^12.10.0` is **already a WE devDependency** (`we:package.json:101`). The "honest cost of the whole approach" it names is already paid; this materially weakens the argument against options A/D and should be re-weighed before ratification.
  - `we:package.json:97-101` cited for "zero `@frontierui/*` deps / a 3-dep repo" — those lines are now mid-`devDependencies` (`@parcel/core` … `happy-dom`). The underlying fact holds: `dependencies` = 3 (`detect-gpu`, `typescript`, `web-features`), zero `@frontierui/*` anywhere.
  - `we:docs/agent/platform-decisions.md:1498-1508` (#1946) — dead. #1946's "pinned artifact + build ordering" anchor is now at **:1590**; :1498-1508 is the route-view runtime-ingestion decision.
  - `platform-decisions.md:96` (`{#zero-impl}` source arrow) — dead; zero-impl now at **:1182** / **:2978**.
  - `platform-decisions.md:102-109` (#1771 "a generator that runs an impl → FUI") — dead; :102-109 is now the guard-bash refusal-posture text.
  - `platform-decisions.md:142` ("byte-replication is the interim") — dead; that clause is now at **:198**.
  - `platform-decisions.md:200` (embed boundary, `@frontierui/*` never in WE `node_modules`) — dead; now at **:256**.
  - `we:.github/workflows/deploy.yml:33-38` (FUI checkout + `FUI_READ_TOKEN`) and `:48-53` (`build:tools`) — dead. The file grew a long header comment; the real checkout step is now **:161-165** and `npm run build:tools` at **:177-180**.
  - `we:vitest.config.ts:132,134` (the `@frontierui/*` alias) — dead; those lines are now slow-test exclusions.
  - Still accurate: `we:scripts/lib/component-render-build-hook.cjs:46/59-63/75-76/84/91`, `we:scripts/lib/data-table-build-hook.cjs:35`, `fui:scripts/build-tools.mjs:56` (`packages: 'external'`), `fui:package.json:5` + `fui:blocks/package.json:6` (`private: true`), `we:tsconfig.json:18-19`.
- **suggested action:** edit card — repoint the eight dead citations, and re-write the happy-dom cost bullet (it is already in WE's devDeps, so it is not an added cost of A/D).

## #1855 — Model-usage watch (standing program)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Digest paragraph: *"Currently L0 — metrics defined, not yet instrumented."* Contradicted by the card's own maturity section (L1 since 2026-06-27) **and** by #1880 `status: resolved`, `graduatedTo: scripts/check-memory.mjs (--json front-A metrics + corpus skew) + .claude/skills/review-program/templates.md` — front-A metrics *are* instrumented (`--json` block in `we:scripts/check-memory.mjs`).
  - Dead path: *"stale/contradictory memory count — `memory/*.md` files…"*. There is **no `memory/` directory** in WE. The corpus moved to `agent-memory-src/` (`we:scripts/check-memory.mjs:60` says so verbatim: *"#2266 moved the corpus to `agent-memory-src/`"*).
  - Every child filed by the two logged runs is resolved: #1861, #1862, #1863, #1864, #1868, #1878, #1879, #1880, #1881 — 9/9. The L0→L1 carve items 1-3 are therefore all delivered; only item 4 (cadence/L1→L2) remains.
  - Review log's last entry is **2026-06-27**; the card's own front-B cadence is "monthly manual sweep" and front A re-runs on `/review-program 1855`. ~2.5 months without a run as of 2026-09-06. (#367, the cited scheduling pattern for L1→L2, is `status: parked` — worth noting, since graduation depends on it.)
  - #1249 (Program Test) resolved; #192 (reference-liveness, cited as a live sibling program) resolved; #1257 and #315 still open.
- **suggested action:** edit card + run `/review-program 1855` — drop the "Currently L0" clause, repoint `memory/*.md` → `agent-memory-src/*.md`, note items 1-3 of the carve delivered, and record that #367 (the L1→L2 scheduling pattern) is parked.

## #2201 — Mid-region-marker (`{{else}}` / `{:else}` / `@else`) decision card
- **verdict:** OK
- **confidence:** high
- **evidence:** re-verified the load-bearing citations — `fui:plugs/webnodes/recipes/RegionNode.ts:66` (`declare host: HTMLTemplateElement`, `.content` docblock at 62-66), `fui:plugs/webnodes/CustomNodeRegistry.ts:665-675` (binary open/regionName/regionClose recipe guard) and `:710-718` (the region walk), `we:src/_includes/spec-descriptions/plugs/customnoderegistry.njk:85-97` (the six static axes — no segment map) and `:114-116` (`AmbiguousPayloadError`/`MissingRegionCloseError`/`ReservedDelimiterError`/`DelimiterCollisionError`), `we:docs/agent/block-standard.md:578-584` (rule 3 "Nature = which static field is set", `#custom-node-recipes` anchor at :567). Gap still live: no `static mid` and no `programs` map anywhere in `fui:plugs/webnodes/`. #2115/#2118 resolved as claimed; both research artifacts exist.

## #2207 — Train the design-AI reviewer for branding & UI guidance
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Frontmatter `blockedBy: ["2209", "2353"]` — **#2353 is `status: resolved`** (`dateResolved: 2026-07-09`, `graduatedTo: plateau:src/branding-eval/journeyEvalHarness.ts`, file verified present). Only #2209 (the rubric decision) still gates this. The slice note's *"`blockedBy` #2209 (the rubric — still an open decision) + #2353 (the baseline)"* is half-stale.
  - The card's "Eval loop before feature work: define the agreement metric first… baseline stock-AI behaviour" is done by #2353 — the training-payload residual is what's left, which is correctly what this card is.
  - Three `relatedTo` items are now resolved: #1034, #1552, #1167. The "Training hooks for the explorer (#1167) & vision tools (#1552)" section reads as if those are in flight; they have landed, so the hooks need re-grounding against what actually shipped.
  - Assets all present: `plateau:branding.html`, `plateau:branding-proposals/journey.json`, `plateau:scripts/render-mark.mjs`, `plateau:branding-refs/` (85 entries), `we:skills-src/brand-mark-loop/`, `we:skills-src/review-design/`, both cited reports.
- **suggested action:** edit card — drop `2353` from `blockedBy` (leaving `["2209"]`), and note the eval baseline now exists at `plateau:src/branding-eval/journeyEvalHarness.ts` so the training loop has something to iterate against.

## #2208 — Design-intelligence watch (standing program)
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - *"the metric, cadence, and eval harness are not built"* — the **eval harness is built**: #2353 resolved 2026-07-09, `plateau:src/branding-eval/journeyEvalHarness.ts` exists.
  - L0→L1 carve item 3 (*"#2207 eval harness (agreement metric vs the journey labels)"*) is delivered — and it was carved out of #2207 to #2353, which this card never records.
  - L0→L1 carve item 2 (*"Library render page in plateau"*) is delivered: `plateau:branding-refs.html` exists, backed by the 85 JSON entries in `plateau:branding-refs/`.
  - Only carve item 1 (`check:branding` gate) is genuinely unbuilt — no `check:branding` script in either `we:package.json` or `plateau:package.json`; it is still gated on #2209 ratifying (#2209 `status: open`).
  - Review log has one entry (2026-07-03 founding run); its "Next run" list is two-thirds complete but unrecorded. ~2 months stale.
  - Cited assets all exist: `we:src/_data/researchTopics/constellation-branding-system.json`, `reports/2026-07-03-constellation-branding-system.md`.
- **suggested action:** edit card + run `/review-program 2208` — mark carve items 2 and 3 delivered (naming #2353), correct the "eval harness not built" sentence, and log a second run.

## #2401 — Dev-browser enterprise configuration — managed policy over per-developer settings
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the card is still correctly blocked (#1391 open, #1753 not resolved), but its whole "Preparation session (2026-08-15) — re-verified" block is now false on the tree:
  - *"no `shell/` directory, no `BrowserWindow`/`WebContentsView` usage anywhere in `plateau:packages/dev-browser/src`"* — **`plateau:packages/dev-browser/src/shell/` now exists** with `main.ts`, `layout.ts`, `ipc.ts`, `probe-preload.ts`, `chrome/` (chrome.ts, chrome-preload.ts, status.html) plus tests; `BrowserWindow` appears in `shell/main.ts` and `shell/layout.ts`.
  - *"(`grep -rl BrowserWindow packages/dev-browser/src` → empty; `find … -iname "*shell*"` → only an unrelated vscode-extension test file)"* — both greps now return the real shell.
  - *"#1391's foundational slice **#1753** … is also still `status: open`, no `dateResolved`, every `## Done when` box unchecked… **zero code has landed** for it yet."* — #1753 is now `status: active` with 3 of 5 `## Done when` boxes checked (only the two display-requiring launch checks remain).
  - The card's conclusion ("not viable to bring to build-ready right now") is weaker than stated: a shell process and a layout config surface now exist, so the "nowhere to hang per-developer settings" premise is close to dissolving. Still no settings/config store in `shell/` (grep: only `layout.ts`/`layout.test.ts` mention config), so it is not yet build-ready — but it is much closer than the card says.
- **suggested action:** edit card — replace the 2026-08-15 verification block with the current state, and re-run the preparation once #1753 flips to resolved (its unblock trigger is nearly met).

## #2402 — Enterprise SaaS account controls (shape fork)
- **verdict:** OK
- **confidence:** medium-high
- **evidence:** every load-bearing citation re-verified live — `plateau:src/main.ts:117` (`AuthState = { user: { name; email; role: string } | null; isLoggedIn }`, exactly as quoted), no `Organization`/`Seat`/`OrgRole`/`seatLimit` anywhere in `plateau:src` or `plateau:packages` (grep empty), `plateau:packages/saas/src/accounts/` absent as the card assumes, `we:permissions/contract.ts` present, `we:webpolicy/contract.ts:58` (`readonly scope?: string` with the exact "optional context/tenant scope this ruleset binds to" comment), `we:analytics/dev-metrics.ts:136` (`DevMetricsPolicy`), `fui:plugs/webanalytics/devMetrics.ts:211` (`resolveDevMetricsPolicy`), `fui:webpolicy/enforcement.ts` + `proof.ts` + both test files, `plateau:packages/saas/src/marketing/pricing.ts` Enterprise "Governance, ownership + approval workflows" bullet, and `plateau:packages/saas/src/control-plane/` being the self-governance dashboard (dashboard/audit-view/escalation-inbox/trip-planner), not a tenant console.
- **couldn't confirm:** the claim *"no settings/preferences surface exists anywhere in `plateau:src` or `plateau:packages`, grepped"* is defensible but brushes past `plateau:packages/saas/src/profiles/` — those are governance persona *charters*, and the file's own header states it carries no `preferences`/`surfaces` field, so the claim holds. Not worth an edit.
- **suggested action:** none (ready to ratify as written).

## #2545 — Mint the visual-diff intent
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** the work is genuinely undone — none of `we:src/_data/intents/visual-diff.json`, `we:src/_data/semantics/visual-diff-intent.json`, `we:src/_data/semantics/delta-region.json` exists; #2538 resolved, #2544 still open, `we:src/assets/visual-diff-surface-demo/index.html` present. Stale citations:
  - *"validated live against `validateIntent()` (`we:scripts/check-standards-rules.mjs:1193`…)"* — dead. `validateIntent` is now at **:1316**; :1193 is preset `composesIntents` validation.
  - *"`checkStatus()` accepts it, `we:scripts/check-standards-rules.mjs:854`"* — dead. `checkStatus` is now at **:1017**; :854 is backlog wiki-link linting.
  - *"only `requiresCapabilities` and the custom-intent `extends` chain are checked, `we:scripts/check-standards-rules.mjs:1193-1256`"* — same drift.
  - `we:scripts/gen-inventory.mjs:20` for the `AUTO-GENERATED:inventory` marker — the `START` constant is now at **:22**.
  - `we:docs/agent/conventions.md:144` ("term first") — the *Glossary Philosophy* heading is at :144, the "Term first" bullet at :145. Off by one; harmless.
  - `we:scripts/lib/intents-loader.cjs:16` (readdirSync glob) — still correct.
  - **Unverified metric:** *"this repo currently carries ~1,371 pre-existing warnings"* — I did not run `check:standards` (expensive); treat that number as likely drifted.
- **suggested action:** edit card — repoint the four `check-standards-rules.mjs` / `gen-inventory.mjs` line refs, and either re-measure or soften the "~1,371 warnings" figure.

## #2893 — Impl: `enforceFlipReady` predicate + CI probe + ledger + write gate
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** work genuinely undone — `enforceFlipReady` does not exist anywhere in `we:scripts/` (only `ENFORCE_FLIP_TRIGGER` at `we:scripts/lib/decision-routing.mjs:302` and `computeAgreementMetric` at :376), `we:scripts/lib/review-runner-core.mjs:88,113` still hard-codes `LAND_MODES.SHADOW`. But:
  - Frontmatter `blockedBy: ["2892", "2864", "2964"]` — **#2864 and #2964 are both `status: resolved`**. Only #2892 (`status: open`) still blocks. The card's long "blockedBy 2964 … so it must not land first" and "blockedBy 2864 … added 2026-08-04" paragraphs both describe cleared blockers.
  - **Refuted claim:** *"`enforceFlipReady` + the shadow ledger land in `we:scripts/lib/decision-routing.mjs` / `we:scripts/lib/auto-land-seam.mjs`, **neither of which is in `TRUST_CHAIN`**"*. `auto-land-seam.mjs` **is** registered — `we:scripts/lib/gate-config.mjs:140-147`, `{ role: 'auto-land-seam', tier: 'policy', leash: 'code' }`. Only `decision-routing.mjs` is still absent, so the leash-gating task is half its stated size.
  - *"#2820 (PR #975) and #2823 (PR #976) merged (now true)"* — both backlog items are `status: active` (residual work), so "merged" refers to the specific PRs, not the items; worth a word so a builder doesn't read the preconditions as fully green.
  - #2838, #2840, #2409 resolved as the card states; #2572 still open.
- **suggested action:** edit card — trim `blockedBy` to `["2892"]`, and correct the TRUST_CHAIN paragraph (auto-land-seam.mjs is registered at `gate-config.mjs:140-147`; only decision-routing.mjs needs adding).

## #2981 — Can judgment work split into a delegated draft half and an inline call half?
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** the decision is still open and correctly prepared (`reports/2026-08-16-prepare-2981-judgment-split.md` exists), and its doctrine still stands in the doc — but every `file:line` citation has rotted, which matters because this card's own default rests on quoting those lines:
  - `we:docs/agent/backlog-workflow.md:481` ("open the artifact it rules on… a summary cannot show what it left out") — dead; :481 is now D3-readiness loader text.
  - `:489` (*"the shipped text today explicitly parks the question here"*) — dead; :489 is the per-fork classification pass. The live sentence is **"Judgment-shaped work stays inline — unchanged by this reframe"** at ~**:591**, inside *Model routing* (`{#model-routing}` at **:576**).
  - `:499-500` (the Sonnet rung excluding judgment-shaped work) — dead; :499 is "Contract-first…", :500 is blank.
  - `:506` (absence-claim / "no size escape") — dead; that paragraph is now at **:608**.
  - `we:scripts/audit-backlog-health.mjs:118,388` (G4) and `:432` (D1) — drifted; G4 is documented at :30 and implemented at :124, D1 documented at :55 with its precision block at :189.
  - **Additional stale claim:** *"the shipped doc now says judgment stays inline **and points here**"*. It says the first half; it does **not** point here — `#2981` appears nowhere in `docs/agent/` (grep across `*.md`/`*.mjs`/`*.cjs` outside `backlog/` hits only the prep report). If the ruling is (a), the `codifiedIn` edit should add that pointer.
- **suggested action:** edit card — repoint the five `backlog-workflow.md` line refs and the two `audit-backlog-health.mjs` ones, and soften the "points here" claim to "should point here on ratification".

## #3018 — Alarm when a harvest's grounding-verification failure rate crosses a threshold
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** the gap is genuinely still open — no `groundingAlarm`, no `quotedTurn`, no transcript-pointer field anywhere in `we:scripts/conveyor/learnings-harvest.mjs` or `learnings-drop.mjs` (grep empty), and `blockedBy: ["3016"]` still holds (#3016 `status: open`). Stale statements:
  - *"`we:backlog/3015-…` is `status: active` (`dateStarted: "2026-08-14"`) — in progress right now, one step ahead of #3016"* — **#3015 is `status: resolved`, `dateResolved: "2026-08-17"`**. The publish-seam scrub that #3016 was waiting on now exists, so #3016 is unblocked and this card is one step (not two) from buildable.
  - *"the pool-entry schema (`ALLOWED_KEYS`, `FIELD_CAPS`) is `kind | summary | area | suggestion`"* — now `[...'kind','summary','area','suggestion', ...OPTIONAL_HICCUP_KEYS]` where `OPTIONAL_HICCUP_KEYS = ['blocking','proposedFix','approvalPending']` (#3421), `we:scripts/conveyor/learnings-drop.mjs:64-65`. Still no grounding field, so the card's conclusion survives; the quoted schema does not.
  - Line-ref drift: `learnings-drop.mjs:57-65` → the schema block is now :64-70; `validateEntry` "lines 103-139" → the allow-list loop is now at :121; `learnings-harvest.mjs:104-125` (`readPool`) → :105; `poolStatus` "187-193" → **:212**; `we:skills-src/harvest-learnings/SKILL.md:66-74` (Step 2 "Grounding") → the Grounding filter is now at **:107** (:66-74 is hiccup-field/corpus-health text); `we:skills-src/closing-session/SKILL.md:181` still lands in the right paragraph.
- **suggested action:** edit card — correct the #3015 status (resolved 2026-08-17), refresh the schema quote and the six line refs. #3016 is now the sole remaining prerequisite and is itself unblocked, so this card is closer to actionable than it reads.

## #3020 — guard-bash: bound the runner-exec recursion depth
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:** **both halves of the bug are still live** — `isTreeWritingBuildRun(segment)` at `we:scripts/guard-bash.mjs:601` takes no depth argument and self-recurses at :612 (`if (inv && inv.exec !== undefined) return isTreeWritingBuildRun(inv.exec);`), and the CLI's `const r = decide(cmd, guardCtx);` at **:2327** still sits *after* the `} catch { process.exit(0); }` at :2325. So the item is real. Its `scopeRationale` has gone badly stale, though:
  - **Refuted claim:** *"this file has no existing CLI-spawn test for guard-bash — confirmed by grep; `execFileSync` appears only once, at line ~1238, for differential quoted-shell fuzzing, never to invoke the guard-bash CLI entrypoint itself."* `we:scripts/__tests__/guard-bash.test.mjs:1866` now has exactly that: `const run = (command, cwd = '/tmp') => execFileSync(process.execPath, [GUARD], {…})`. The "NEW subprocess-spawn test" the card scopes is partly pre-built; the builder should extend the existing harness rather than author one.
  - Dead line refs throughout the `scopeRationale`: recursive call "line 423" → **:612**; CLI `decide(...)` "line 1616" → **:2327**; "try/catch at lines 1586-1615" → now :~2290-2325; `withNestedCommands` caps "782-783, 965-984" → `NESTED_DEPTH_CAP`/`NESTED_NODE_CAP` are at **:983-984**; test-file anchors "393-407, 1107-1123" and `execFileSync` "~1238" → the file is now 1999 lines with `execFileSync` at :20/:1449/:1866; `we:.claude/settings.json:54` (the PreToolUse Bash hook) → **:71**.
  - *"Overlap with siblings … both are status:open, unbuilt"* — **#2997 is now `status: active`** (same two files, disjoint functions). The concurrent-edit warning for the dispatcher is now a live collision, not a hypothetical. #3002 still open; #2986/#2994 resolved as stated.
- **suggested action:** edit card — repoint the seven line refs, delete the refuted "no CLI-spawn test" claim (point at `guard-bash.test.mjs:1866` instead), and upgrade the #2997 overlap note to reflect that it is in flight.

## #3045 — Register the clearer-identity module in TRUST_CHAIN at policy tier
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** all four `scope:` files carry the change, and the card's own "Done when" criteria pass:
  - `we:scripts/lib/gate-config.mjs:294-311` — the entry exists verbatim as designed: `{ role: 'clearer-identity', file: 'review-independence.mjs', tier: 'policy', leash: 'spec', homes: ['scripts/lib/review-independence.mjs'] }`, with the preceding comment block citing "#2844/#3045" and the same `#2771`-backstop-does-not-hold reasoning the card argues.
  - Predicate probe (run live against the tree): `isPolicySpecPath('scripts/lib/review-independence.mjs')` → **true** (and `isPolicyCorePath` → true).
  - `we:scripts/lib/__tests__/gate-config.test.mjs:166-170` — the new test exists: finds the `review-independence.mjs` TRUST_CHAIN entry and asserts `isPolicySpecPath(...) === true`.
  - `we:scripts/lib/__tests__/gate-invariants.test.mjs:86` — `'scripts/lib/review-independence.mjs', // #2844/#3045 …` is in `DECLARATIVE_LEASH_FILES`, the consumer array the card flagged as its missed scope gap.
  - `we:scripts/lib/review-independence.mjs` — the "NOT YET TRUST-CHAIN REGISTERED" paragraph is **gone** (grep returns nothing); the header's only surviving `TRUST_CHAIN` mention is a #3067 note citing "the TRUST_CHAIN paragraph above" as precedent for its own owed follow-up.
- **suggested action:** resolve. (Note for the resolver: the module header's #3067 note names a *separate*, still-owed follow-up — wiring `prCreatedAt`/`stampLostMarked` into `review-set-label.mjs`/`auto-land-seam.mjs` — which is not this card's scope and should not be swept in.)
