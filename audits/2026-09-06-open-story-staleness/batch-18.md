# Batch 18 — staleness audit (38 open cards, audited 2026-09-06, READ-ONLY)

- **ALREADY-DONE: 5** — #3200, #3208, #3209, #3213, #3390
- **SUPERSEDED: 0**
- **STALE-PREMISE: 2** — #2888, #3185
- **STALE-INFO: 12** — #2858, #2887, #2963, #3110, #3174, #3188, #3270, #3280, #3285, #3292, #3173, (+#2886 line-drift only, listed under DEAD-REFS)
- **DEAD-REFS (primary or co-verdict): 4** — #3270 (`.claude/commands/review.md` absent), #3292 (cited commits gone), #2886 (line cites), #2888 (line cites)
- **OK: 19** — see list at end

---

## #143 — A page presenting our general approach to working with AI
- **verdict:** OK
- **confidence:** high
- **evidence:** `blockedBy: ["1104"]` — `backlog/1104-*.md` still `status: open`; `backlog/1137-*.md` still `open`; `backlog/089-*.md` still `open`. The card's own 2026-08-15 preparation check is still literally true.
- **suggested action:** none

## #2858 — Cost-on-card accrual is unreachable at close
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The card's load-bearing evidence is *"a grep for `costUsd` / `costTokens` / `costSessions` across all 2 829 backlog items returns **zero** matches — no card has ever carried a cost since the guard landed."* Both halves are now false:
  - `grep -l '^costUsd:' backlog/*.md` returns **12** cards, 8 of them opened on/after 2026-08-27: `3368` ($116.73), `3383` ($658.92), `3390` ($3.12), `3395` ($19.68), `3407` ($5.98), `3417` ($254.16), `3424` ($4.99), plus older `2572`/`2882`/`2936`/`2999`/`3002`. So accrual demonstrably happens now.
  - The corpus is **3 475** items, not 2 829.
  - The card also quotes the guard string *"Every card mutation (cost/claim/resolve/…) must run in a LANE clone"* — that exact string no longer appears in `scripts/backlog.mjs` (the surviving guard prose at `scripts/backlog.mjs:992` is the build-queue-config variant).
- **suggested action:** edit card — re-measure the evidence paragraph (state the real count and which sessions produced the accruals), and re-check whether the primary-checkout close path is still the blocked one before treating (a)/(b)/(c) as live forks. Do **not** resolve without confirming the close-from-primary path specifically.

## #2886 — Carve #2884's three-option fork into a decision item
- **verdict:** OK (work still owed) + **DEAD-REFS** (line cites)
- **confidence:** high
- **evidence:** Still owed: `backlog/2884-*.md` has **no `blockedBy`**, its `scope:` is still `["we:scripts/lib/review-escalation.mjs"]` only, and the three-option fork is still inline in its body ("Options worth weighing, rather than assuming the first one:" — three bolded options, no default). `backlog/2883-*.md`'s third DoD bullet still names no escape hatch. No `kind: decision` card carving #2884's fork exists (the nearest, #3053, is a *resolved* decision about the stale-re-park **hold tier**, a different fork; it lists #2884 only as a related slice).
  Stale line cites (content still exists, at new lines):
  - `we:src/_data/backlog.js#L461` → the derivation is no longer at :461 (that line is now `item.projectPending = …`).
  - `we:docs/agent/backlog-workflow.md#L514` (stop-risk) and `#L541` (the carve rule) → the carve rule now lives at **`:728`**.
- **suggested action:** edit card — repoint the three line cites; otherwise leave open.

## #2887 — Widen the buried-fork lint past heading matching
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Substance still true — `findBuriedForkSections` (`scripts/check-standards-rules.mjs:559`) still gates on `FORK_HEADING_TERMS` alone (`:572` — `if (!FORK_HEADING_TERMS.some((t) => low.includes(t))) continue;`), and `FORK_HEADING_TERMS` (`:539-542`) is still exactly the nine phrases the card lists. But every line cite has drifted:
  - `check-standards-rules.mjs#L434-455` (the matcher) → now **`:559-580`**
  - `#L414-417` (`FORK_HEADING_TERMS`) → now **`:539-542`**
  - `#L537-546` (`findNonBatchableMarkers`) → now **`:679-693`**
  - `we:src/_data/backlog.js#L443-444` (the quoted "can't be decided from fields… selection still skims the body for a fork") → now **`:481-482`**
  - *"the first pass over the existing 2858 items"* → the corpus is now **3 475** items, so the false-positive sweep this card sizes is ~22% bigger.
- **suggested action:** edit card — repoint the five cites and the corpus count.

## #2888 — Name the sanctioned gate-self override /review needs
- **verdict:** STALE-PREMISE (+ DEAD-REFS)
- **confidence:** high
- **evidence:** The card exists to stop #2882 from being *built literally* and stranding every gate-self PR. That risk is gone:
  - `backlog/2882-*.md` is **`status: resolved`** (dateResolved 2026-08-03) — it shipped without stranding anything.
  - The sanctioned override the card asks #2882 to name now **exists**: `scripts/review-set-label.mjs` carries a `clear-human` target in `REVIEW_LABEL_TARGETS` (`:110`), documented at `:18` (*"`--to=clear-human` IS EXEMPT FROM THAT REFUSAL"*) and `:34` (*"#2895 — INVARIANT 2 says who may NOT clear a gate-self PR; the `clear-human` target says how the one who MAY"*). `backlog/2895-*.md` is **resolved**.
  - Third DoD bullet (correct the "drain's own advisory-review stamp" attribution in two places): **half done** — the wrong sentence is **gone from `skills-src/review/SKILL.md`** (grep: no hit); it survives only in the *resolved* card `backlog/2882-…:29`.
  - Fourth DoD bullet (add `relatedTo` edge #2882↔#2416): **not done** — #2882's `relatedTo` is `["2409","2644","2470"]`; `backlog/2416-*.md` is still `open`.
  Dead line cites: `scripts/review-set-label.mjs#L79-L87`, `#L91-L99`, `#L207-L211`, `#L274` all point into unrelated code now (the file grew — `:79-99` is now an import block). `skills-src/review/SKILL.md#L50` and `#L62` likewise (`:50` is now about `assertLaneCwd`).
- **suggested action:** park or resolve as largely delivered — what remains is a `relatedTo` edge and a prose correction inside an already-resolved card. If kept, rewrite the card down to just those two residues and drop the "strands every gate-self PR" framing.

## #2928 — pr-land reports reason:parked with exit 0 even when the park apply failed
- **verdict:** OK
- **confidence:** high
- **evidence:** Bug unchanged. `scripts/pr-land.mjs:1008-1023`: `let parkApplied = false;` → `try { ghC([...'--add-label', parkLabel]); parkApplied = true; } catch (e) { if (!AS_JSON) process.stderr.write(...) }` → `emit({ …, reason: 'parked', …, reviewLabelApplied: parkApplied, … }, 0)`. Still one reason, still exit 0, warning still gated on `!AS_JSON`. Both interim workarounds the card asks to retire are still planted: `skills-src/pr/SKILL.md:198-200` and `skills-src/conveyor/delivery-agent-brief.md:478`.
- **suggested action:** none

## #2939 — Register the remaining behaviour-defining surfaces in BLAST_RADIUS
- **verdict:** OK
- **confidence:** high
- **evidence:** Ran `isBlastRadiusPath` from `scripts/lib/review-escalation.mjs` directly — every surface in the card's table still returns `false`: `.claude/settings.json`, `.claude/commands/drain.md`, `AGENTS.md`, `CLAUDE.md`, `docs/agent/backlog-workflow.md`, `.claude/agents/x.md`, `.mcp.json` (control: `skills-src/pr/SKILL.md` → `true`). `blockedBy: ["2938"]` is accurate — `backlog/2938-*.md` is still `status: open` (`preparedDate: 2026-08-16`). `scripts/lib/review-policy.contract.json` exists.
- **suggested action:** none

## #2943 — Gate module-level frozen lookup tables
- **verdict:** OK
- **confidence:** high
- **evidence:** The PR #1046 point-fix landed as the card says (`scripts/lib/jury-core.mjs:114` `export const frozenLookup`, `rankIn` at `:117`, `VERDICT_STRICTNESS`/`IMPACT_GLOSS`/`IMPACT_STRICTNESS`/`DISPOSITION_EARNS_ROUND` all built through it) — but the ask is the **gate**, and no `check:standards` rule for it exists (`grep frozenLookup scripts/check-standards*.mjs` → no hits). "Nothing stops the next table" is still true.
- **suggested action:** none

## #2944 — Gate finding-CONTRACT parity
- **verdict:** OK
- **confidence:** high
- **evidence:** All three defects intact. No `@finding-producer` marker exists anywhere (`grep -rn '@finding-producer' scripts/ skills-src/` → 0 hits). The hand-copied enum twins are still there verbatim: `scripts/workflows/review-parked-prs.mjs:416` and `skills-src/jury/subject-jury.workflow.js:302`, both `const IMPACT_LEVEL_VALUES = ['cosmetic', 'degraded', 'broken', 'unrecoverable'];`, each feeding a JSON-schema `enum:` (`:438` / `:308`).
- **suggested action:** none

## #2945 — Minimal local review console
- **verdict:** OK
- **confidence:** high
- **evidence:** `scripts/review-console.mjs` does not exist. `backlog/2555-*.md` (the superseding board) still `open`; `backlog/2946-*.md` still `open`.
- **suggested action:** none

## #2946 — Human-presence gesture (WebAuthn)
- **verdict:** OK
- **confidence:** high
- **evidence:** `blockedBy: ["2945"]` accurate (#2945 open, and `scripts/review-console.mjs` — this card's own scope — does not exist yet). `tier: someday` framing unchanged; `clear-human` shipped via #2895 exactly as the card assumes, with no assertion gate.
- **suggested action:** none

## #2963 — Guard cross-session backlog frontmatter edits
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Substance still owed (`scripts/backlog-guard.mjs` has no ownership/`status: active` check — only the `--pre` missing-required-field predictor at `:6`/`:80`; `node scripts/backlog.mjs reparent` does not exist). Stale statements:
  - `relatedTo: ["2983"]` — **#2983 is now `status: resolved`**, so the card's framing (*"`/consolidate` (#2983) **defines** its candidate set as…"*) describes a shipped skill, not a proposal.
  - Cite `we:docs/agent/backlog-workflow.md:258` for *"a racing agent is detected by the item reading `status: active`"* → that sentence is now at **`:378`**; `:258` is the determinism-ladder table. The companion *"edit only the items you're already working"* is now at **`:244`**.
  - Cite `we:skills-src/consolidate-backlog-items/SKILL.md:24-25` → the passage is now at **`:25-27`**, and its wording has narrowed: step 1 now opens *"Build the candidate clusters **over open items**"* while still instructing the full-board frontmatter scan. The hole survives but the quoted framing is no longer exact.
- **suggested action:** edit card — repoint the three cites and requote the SKILL.md line as it now reads.

## #2996 — The #2920 spawn-count regression test passes against the pre-fix code too
- **verdict:** OK
- **confidence:** high
- **evidence:** Fixture unchanged. `scripts/__tests__/lane-pool-ahead-provably-pushed-single-spawn.test.mjs:113` still does `git(['push','--quiet','origin','HEAD:refs/heads/lane/landed'], lane)` inside the spawn-count describe (`:98-99`), so HEAD is still a live remote tip and the `remoteShas.has(head)` short-circuit still fires ahead of the loop. The card's cited pattern reference (`lane-pool-acquire-stale-origin.test.mjs`, the ANCESTOR-branch mover) still exists.
- **suggested action:** none

## #3109 — Review Anthropic's multiagent-systems research against our delivery-loop findings
- **verdict:** OK
- **confidence:** medium
- **evidence:** Pure capture card, explicitly "no fix, no design, no ruling". `scope: we:docs/agent/delivery-loop.md` exists. Nothing in it can go stale except by being acted on, and no evidence it was. Could not verify whether the article has since been read/actioned elsewhere.
- **suggested action:** none

## #3110 — `classifyDispatchPr` can attribute a later retry's merged PR to an earlier entry
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Bug intact — `scripts/operations/dispatch-lane-io.mjs:1099` `classifyDispatchPr` still matches by item number (`:1105` `mine = prs.filter(p => laneRefItemNum(p?.headRefName) === key)`) then filters on `startedMs` alone (`:1114`), with no attempt-id and no cross-entry check. But the card's positional statements have all moved:
  - *"line 800"*, *"`mine`, line 806"*, *"`attributable`, line 815"* → now **`:1099`, `:1105`, `:1114`**.
  - *"`lane/build-3095`, … not yet on `main` at filing time, landing imminently via #3095"* — it has since landed; the code is on `main` in the primary checkout, so the "verify on the lane branch" instruction is obsolete.
  - The docblock the third DoD bullet asks to amend is now at `:1085-1098`.
- **suggested action:** edit card — repoint the three line cites and drop the "not yet on main" framing.

## #3149 — Surface stuck background-agent permission prompts to the orchestrator
- **verdict:** OK
- **confidence:** high
- **evidence:** No detection exists — `grep -in 'permission prompt|waitingFor|claude agents' scripts/operations/gate-health.mjs scripts/operations/gate-health-io.mjs` → 0 hits. Scope paths (`scripts/operations/gate-health.mjs`, `scripts/conveyor/`) exist. `relatedTo: ["2972"]` intact.
- **suggested action:** none

## #3169 — pr-land infra-block recording silently no-ops and still reports recorded:true
- **verdict:** OK
- **confidence:** high
- **evidence:** Both halves unchanged. `scripts/pr-land.mjs:666-667`: `recordInfraBlockIO({...}); recorded = true;` inside a bare `try { } catch { /* best-effort */ }` — the return value is never inspected, and `:671-673` still emits `recorded` plus an unconditional `resumeHandle`. `scripts/conveyor/infra-blocked.mjs:219` still `if (normNum(num) === '' || !ref) return s;` (silent no-op; the card cites `:217-220`, now `:217-219` — effectively exact).
- **suggested action:** none

## #3173 — Declare a recover-pr operation
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** Not built — no `recover-pr.mjs` in `scripts/operations/` and no `RECOVER_PR_OP` in the 17-entry `OPERATIONS` map (`scripts/operations/run.mjs:84`). Dependencies accurate: `backlog/3149-*.md` and `backlog/3162-*.md` both still `open`. Stale: criterion 3 pins the proof to *"the two live PRs left open for this purpose (#1451, #1445)"* — those were deliberately parked broken on **2026-08-17**, three weeks ago, and #1445 has since been re-pushed and re-worked (see `backlog/3185-*.md`, which lists #1445's re-push among the 2026-08-18 connector-opened PRs, and `backlog/3200-*.md`, whose whole incident is #1445 being cleared and re-parked). Both are almost certainly closed/merged, making the criterion unsatisfiable as written. Could not confirm PR state — no `gh` binary on this host.
- **suggested action:** edit card — replace the "prove against #1451/#1445" criterion with a fixture-or-next-live-case criterion, and re-verify the four stuck-states still occur.

## #3174 — Git hosting/PR provider abstraction
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** Still an unprepared decision (no `preparedDate`). Stale counts/claims:
  - *"18 of its 37 children are open as of this filing"* — #3029 now has **112 children, 72 open** (counted by `parent: "3029"` frontmatter across `backlog/`). The "overlapping surface" argument the ratify criterion leans on has changed scale by ~3×.
  - `backlog/3033-*.md` (the ratify slice named as still open) is indeed still `open`; #3029 itself still `open`. ✓
  - *"MCP … has no adapter built and no grep hits in `we:scripts/operations/` today"* — the "no adapter" half holds (only `cli-adapter.mjs` / `http-adapter.mjs`), but there is now a grep hit: `scripts/operations/explore.mjs:8` ("no CLI/HTTP/MCP callability"). Prose-only, so the substance survives; the literal claim does not.
  - `#2626` (the ratified vendor-abstraction requirement it leans on) is `status: resolved` — still a valid citation.
- **suggested action:** edit card — restate the #3029 child counts, and soften the MCP grep claim.

## #3179 — Replace the forgeable clear-human comment marker with a local ledger
- **verdict:** OK
- **confidence:** high
- **evidence:** `parseLatestHumanClearedSha` is still imported and still on the drain's hot path: `scripts/merge-ai-prs.mjs:113` (import) and `:3946` (`humanClearedSha = parseLatestHumanClearedSha(cd.comments || [])`). No local ledger for PR+SHA+tampering-reasons exists. The mirror pattern the card points at, `scripts/lib/review-baseline-state.mjs`, exists.
- **suggested action:** none

## #3185 — Repair authored-by-actor stamps on PRs opened through the connector
- **verdict:** STALE-PREMISE
- **confidence:** high
- **evidence:** The card's entire "why this is preventive, not a bug" rests on: *"Confirmed the refusal is NOT live today — `we:scripts/review-set-label.mjs` passes no `prCreatedAt` — so this is preventive, and nothing is currently blocked by it. That is why it is a task, not a bug."* **That is now false.** `scripts/review-set-label.mjs` reads and passes both inputs: `:587` `let prCreatedAt = '';` → `:602` `prCreatedAt = typeof parsed.createdAt === 'string' ? parsed.createdAt : '';` → `:661-662` `prCreatedAt, stampLostMarked: hasStampLostMarker(prBody),`, with `:655` explicitly noting the opt-in inputs are now passed by a live caller. Independently corroborated by `backlog/3267-*.md` (filed 2026-08-24): *"Since #3067 (`3a98c0a6`, merged 2026-08-21) `we:scripts/review-set-label.mjs` passes `prCreatedAt` / `stampLostMarked` … so a stampless PR created after the 2026-08-08 regime start resolves to `STAMP_LOST` and is REFUSED."* `backlog/3067-*.md` is `status: active`. `scripts/pr-body-edit.mjs --repair` exists (`:4`, `:15-19`), so the fix path is intact.
- **suggested action:** edit card and **re-prioritise** — the six PRs (#1463, #1465, #1466, #1467, #1468, #1445) are now live-refusable, not latent. Rewrite the "De-risked during prep" bullet and re-check whether the six are still open (if all merged, the repair is moot and only DoD bullet 4 — closing the hole at source — survives; that overlaps #3267 criterion 1).

## #3188 — Should an agent session be restricted to declared operations
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:** The policy question is untouched — `.claude/settings.json` still has exactly **20 allow rules and `deny: []`** (verified by parsing the file), so that measurement holds. But the coverage baseline the whole Fork-2 argument rests on has moved:
  - *"Six operations exist (`claim`, `dispatch-lane`, `gate-health`, `review-pr`, `review-prep`, `suggest-next`)"* → **17** are registered in `scripts/operations/run.mjs:84`: `review-pr`, `review-prep`, `record-verdict`, `verify`, `mutation-check`, `gap-sweep-status`, `resolve`, `scaffold`, `suggest-next`, `pr-status`, `gate-health`, `route-pr-outcome`, `dispatch-lane`, `claim`, `open-pr`, `explore`, `stage-pr-view`.
  - *"of all the work performed, exactly ONE class of action went through a declared operation"* — a 2026-08-18 session measurement, now 19 days and 11 operations old. The card's own conclusion (*"any plan that ignores that will stall on its first uncovered task"*) is materially weaker at 17 operations, including `open-pr`, `verify`, `resolve` and `claim` which cover several of the raw-bash classes it enumerates.
- **suggested action:** edit card — re-measure the operation inventory and the coverage baseline before ruling Fork 1/2; the "distance is very large" premise needs re-testing.

## #3200 — The drain's own rebase revokes the acceptance it is waiting for
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** Built end to end under this card's own `bornAs: x5e2ldj`:
  - `scripts/merge-ai-prs.mjs:703` `export function restampAcceptance({ pr, repo, newHead, cwd, spawn })` shelling the single home with `--to=restamp --actor=drain` (`:707`), documented at `:651-659` as *"#x5e2ldj — shell the SINGLE HOME to re-stamp"*.
  - `:721-736` the PURE *"after a DRAIN-AUTHORED rebase, is an acceptance re-stamp owed?"* decision, quoting the very POSITION sentence this card cites, and gating on `humanCleared` — *"A re-stamp CARRIES an acceptance; with none there is nothing to carry, and `decideSetLabel`'s `restamp` refuses independently (two refusals, deliberately)"* → criterion 2.
  - `scripts/review-set-label.mjs:110` adds `restamp` to `REVIEW_LABEL_TARGETS`; `:140` *"moves NO label at all"*; `:233-239` the refusals; `:649-653` stamps the markers but is excluded from the independence check.
  - Criterion 4 (the record must not overstate): `scripts/merge-ai-prs.mjs:2039` `restamp: '📌 review — acceptance re-stamped after a rebase (no new review)'`.
  - Tests: `scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs` (dedicated file), plus `scripts/__tests__/review-set-label.test.mjs`.
- **suggested action:** resolve

## #3205 — A juror that found nothing and a juror that barely looked reduce to the same accept
- **verdict:** OK
- **confidence:** high
- **evidence:** Nothing consults effort telemetry — `grep -n 'numTurns|costUsd|unjudged|effort' scripts/lib/jury-core.mjs` → 0 hits. The three-way fork ((a) `unjudged` verdict / (b) required non-empty rationale / (c) report-don't-gate) is still unruled, and the card correctly says it should not be built until it is.
- **suggested action:** none — but note this card is a fork sitting inside a `kind: story` body, i.e. exactly the shape #2887/#2886 in this same batch exist to catch. Worth carving.

## #3208 — Declare a stage-pr-view operation that refuses an incomplete PR view
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `scripts/operations/stage-pr-view.mjs` + `stage-pr-view-io.mjs` exist and are registered in `scripts/operations/run.mjs:35-36` (`stagePrViewOperation, STAGE_PR_VIEW_OP` / `createPayloadReader, createStagePrViewSinks, defaultViewDir`) with `[STAGE_PR_VIEW_OP]` in the `OPERATIONS` map. The card's specific design decisions are all implemented: the injected-not-restated rule at `stage-pr-view.mjs:27-29` and its refusal at `:324` (*"needs the reader's own `PR_VIEW_FIELDS` and `prViewFileName` — this file restates …"*); the deliberately-not-derived type table at `:74` (*"asserted against `PR_VIEW_FIELDS` in the suite rather than derived from it"*) with the per-field refusal at `:132`; the injected filename at `stage-pr-view-io.mjs:203`/`:224`. Tests: `scripts/operations/__tests__/stage-pr-view.test.mjs` (**75** `it()` cases vs. the card's 23) plus `stage-pr-view-integration.test.mjs`. The transport is also documented in `skills-src/review/SKILL.md` under *"On a host where `gh` cannot authenticate — stage the view first (#xhqqy9j)"* — this card's own `bornAs`.
- **suggested action:** resolve

## #3209 — Declare an open-pr operation so the PR-opening guards cannot be walked around
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `scripts/operations/open-pr.mjs` + `open-pr-io.mjs`, registered at `scripts/operations/run.mjs:59-60` with `[OPEN_PR_OP]` in `OPERATIONS`. Its header (`:1-29`) restates this card's reasoning verbatim, including the credential boundary and the "re-decides nothing, especially not verification" constraint. Every named criterion is pinned in `scripts/operations/__tests__/open-pr.test.mjs` (**52** `it()` cases vs. the card's 22):
  - park defaults: *"defaults the park to the PENDING label, never the human-only gate"* (`:50`), *"refuses to build without the home's own park-label list"* (`:39`), *"parks by default"* (`:62`);
  - no-re-decide: *"does NOT re-decide the lane-verification gate — that has one home"* (`:119`), *"CANNOT waive the gate — no input reaches a disabling flag"* (`:132`);
  - the structural anti-bypass assertion (criterion 2) at `:509-516` — `expect(external).toContain('node:child_process')` and a loop forbidding `node:https`/`node:http`/`node:net`/`undici`/`node-fetch`;
  - `refused` vs `unrun` kept apart (`describe('classifySubmit — refused and could-not-run are different facts')`, `:308`).
- **suggested action:** resolve

## #3213 — Give suggest-next a scope
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** `scripts/operations/suggest-next.mjs:197` `export const SCOPE_FIELDS = Object.freeze(['parent', 'tag', 'locus'])`; `:215` `export function applyScope(items, scope = {})` — filter-only, padded-number parent compare (`:217`, documented at `:208`), case-insensitive tag (`:218`), locus (`:219`). Declared as three optional inputs at `:355-367` with the "a filter is never a second ordering" comment, and threaded into `reads:` at `:389`. Empty-scope-is-not-empty-pool: `scopedOut` at `:290`/`:306` with the `:299` comment quoting this card's own reasoning. Projection carries `parent`/`tags`/`locus` at `:264`/`:274`. Tests: `scripts/operations/__tests__/suggest-next.test.mjs` — **27** `it()` cases, exactly the card's "passes 27 assertions".
- **suggested action:** resolve

## #3265 — lane-pool's root and `--reference` deadlock a cloud VM
- **verdict:** OK
- **confidence:** high
- **evidence:** The card's own 2026-08-27 closeout note is still exactly right. Criteria 1/2/5 landed (`scripts/lib/lane-pool-paths.mjs` and `scripts/__tests__/lane-pool-root-and-shallow.test.mjs` both exist). Criterion 3 is still unaddressed — `scripts/lane-pool.mjs:330-339` `ensureOneSibling` still does `catch (e) { log('  ⚠ … sibling clone failed …'); rmSync(dest, …); return; }`, i.e. the warn-and-continue the criterion asks to replace. Criterion 4 (live two-lane VM observation) unverifiable from here.
- **suggested action:** none

## #3267 — The credential-less fallback drops the author stamp
- **verdict:** OK
- **confidence:** high
- **evidence:** Criterion 1 not done — `grep -in 'stamp' scripts/operations/open-pr.mjs scripts/operations/open-pr-io.mjs` → **0 hits**; the `plan` step carries no `authored-by-actor` marker. The card's own corrected claim about the guard being armed is verified true (`scripts/review-set-label.mjs:587/602/661-662` pass `prCreatedAt`/`stampLostMarked`). Criterion 3 (the fallback-decision fork) is still unruled. Note: this card correctly supersedes `backlog/3185-*.md`'s stale "refusal is not live" statement.
- **suggested action:** none — but see #3185: these two now contradict each other and #3267 is the correct one.

## #3270 — An escalation to review:human has no defined protocol
- **verdict:** STALE-INFO + **DEAD-REFS**
- **confidence:** high
- **evidence:** DEAD-REF: the card names `we:.claude/commands/review.md` twice (in *"Where it belongs"* and in DoD bullet 2) — **that file does not exist**. `.claude/commands/` holds 23 files and `review.md` is not among them; the review entry point is `skills-src/review/SKILL.md` (surfaced as the `review` skill). Substance still owed: no test asserts the drain's escalation comment names the three obligations, and no "run the advisory review / fix / suggest a verdict" text appears anywhere in `scripts/`, `skills-src/` or `.claude/commands/`. Also a formatting defect on the card itself: it carries **two** `## Done when` headings (a placeholder *"TODO: a command that fails before this item lands and passes after"* near the top, then the real three-criterion one), which will read as an unprepared card to any agent that claims it.
- **suggested action:** edit card — drop the `.claude/commands/review.md` target (name the `review` skill instead), and delete the duplicate placeholder `## Done when` block.

## #3280 — Review lens: an 'X already handles this' claim must line-cite the code performing X
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** The clause has **not** landed — `LENS_EXPECTATIONS[MANDATE_LENSES.CORRECTNESS]` (`scripts/lib/review-core.mjs:1852`) still reads exactly *"The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong."* But two things moved:
  - **Line drift:** the card cites `review-core.mjs:1847` (twice) → `LENS_EXPECTATIONS` is now declared at **`:1851`**, correctness at **`:1852`**. The test-suite cite `review-core.test.mjs:1663` → the `LENS_EXPECTATIONS / expectationForLens` describe block is now at **`:1724`**.
  - **Partial coverage arrived by another route:** a new `MANDATE_LENSES.CLAIM_ACCURACY` lens now exists (`review-core.mjs:1854`) whose expectation is *"Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff"*, with grounding rules at `:1871-1887` (*"A claim-accuracy finding with no [what you ran] …"*). That covers much of this card's target, though not its specific demand that an *already-handles* claim carry a line-cite of the performing code.
- **suggested action:** edit card — repoint the two cites, and re-scope against `CLAIM_ACCURACY`: decide whether the residue belongs on `correctness` at all, or as a sharpening of the new lens. Do **not** resolve — the clause itself is absent.

## #3281 — check:standards rule: a decision card may name exactly one default per fork
- **verdict:** OK
- **confidence:** high
- **evidence:** No such rule exists — `grep -n 'DEFAULT|Recommended default' scripts/check-standards-rules.mjs` returns only an unrelated re-export at `:1698`. Scope files exist. Note the card's cite of the #1935 neighbour at `check-standards-rules.mjs:864` has drifted (the `kind === 'decision'` guard region has moved with the file), and `check-standards-rules.test.mjs:1396` likewise — minor.
- **suggested action:** none (optionally repoint the two anchor line numbers)

## #3285 — Review lens: an acceptance criterion naming an existing test must quote the assertion
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:** The clause has **not** landed (see #3280 — the correctness expectation at `review-core.mjs:1852` is unchanged). Stale statements:
  - Cites `review-core.mjs:1847`, `:1846-1854`, `:1843-1844` → now `:1851-1860`, with `expectationForLens` at `:1901-1904`.
  - Cites `review-core.test.mjs:1663-1675` and `:1696` → now `:1724-1736` and `:1816`.
  - **The incident's own citation has been repaired.** The card's whole exhibit is that `scripts/__tests__/lane-pool-reap-on-acquire.test.mjs:73` *"has no holder-is-gone condition"*. `#3283` is now `status: resolved` and that test carries an explicit note at `:97` — *"#3283 RE-POINTED — this case previously minted the ghost with `acquire(1, 'conveyor-9999')` … is now NECESSARY BUT NOT SUFFICIENT"* — with `:107` `backdateLease(ghost, DEFAULT_LEASE_TTL_MINUTES + 60); // its holder outlived its heartbeat — a real ghost`. Line 73 is now inside `beforeEach`. (`lane-lease.mjs:35` `DEFAULT_LEASE_TTL_MINUTES = 240` still cites exactly. ✓)
  - The `CLAIM_ACCURACY` lens (`review-core.mjs:1854`) partially covers the class, same caveat as #3280.
- **suggested action:** edit card — repoint the cites and rewrite the exhibit as historical ("caught and since repaired by #3283") rather than present-tense.

## #3292 — A mutation-kill count must be measured by re-running the affected case in isolation
- **verdict:** STALE-INFO + **DEAD-REFS**
- **confidence:** high
- **evidence:** Substance owed — `scripts/operations/mutation-check.mjs` has `unrun()` arms for `not-restored` (`:134`), `not-applied` (`:148`,`:176`), `suite-unrun` (`:155`,`:168`) and `baseline-red` (`:161`), but **no `count-unattributable`** and no suite-breadth check. DEAD-REFS: the entire verification recipe is pinned to *"head `611f160d` of `lane/test-harness-fake-claude`"* and *"`11a7d778`, where this was first measured"* — **neither object exists in this repo** (`git cat-file -e` fails on both). The lane branch is gone, so the must-refuse/must-accept fixture as written is not reproducible; the file-count anchor (*"the suite names 38 files"*) is also unverifiable at that head and `scripts/operations/__tests__/` now holds **56** files.
- **suggested action:** edit card — re-anchor the fixture to a reachable commit on `main` (or restate it as a mutant + suite description without a lane-head pin) and re-measure the file count.

## #3385 — Derive the delivery-loop flowchart from operations-engine config
- **verdict:** OK
- **confidence:** high
- **evidence:** Still explicitly unprepared (no `preparedDate`, card says so). Its factual premises hold: `scripts/operations/registry.mjs` and `engine.mjs` exist, declarations carry `reads: [...]` edges (e.g. `suggest-next.mjs:389`), and `OPERATIONS` in `run.mjs:84` is the walkable map it proposes projecting. `relatedTo: ["3383"]` — #3383 exists and is the delivery-loop epic. No diagram generator exists.
- **suggested action:** none (candidate for `/prepare`)

## #3390 — lane-pool acquire --lane=N has no dirty-tree guard
- **verdict:** ALREADY-DONE
- **confidence:** high
- **evidence:** The guard landed in the exact branch the card names (`cmdAcquire`'s `if (flags.lane !== undefined)`, `scripts/lane-pool.mjs:1033`), at `:1074-1094`, with a comment block that reproduces this card's incident verbatim (*"Real incident: lane-11's lease went TTL-stale mid-epic with 4 built-and-tested files sitting as uncommitted/untracked edits; this exact path silently destroyed them"*):
  ```js
  if (!flags.force && !targetWasReserved && !flags['no-reset']) {
    const { dirty, uncommitted, ahead } = laneDirtyOrAhead(dir, repo.branch);
    if (dirty || ahead > 0) { fail(`lane-${n} has ${uncommitted} uncommitted change(s) … would destroy that work via its reset-to-origin step. Use --force …`); }
  }
  ```
  It resolves the card's own open question by taking the refuse-unless-`--force` route. Tests reproduce the incident directly: `scripts/__tests__/lane-pool-refresh-guard.test.mjs:262` `describe('acquire --lane=N dirty/ahead guard on a TTL-stale reclaim (#3390)')` with assertions at `:284` and `:313`, plus `scripts/__tests__/lane-pool-acquire-base.test.mjs:264` *"WITHOUT --force, now REFUSES a dirty tracked-file conflict rather than discarding it (#3390)"* (`:272`). Cross-references to `#3390` also appear at `lane-pool.mjs:1074`/`:1158` and `lane-pool-item-map.test.mjs:42`.
- **suggested action:** resolve

## #3429 — createWeScanRunner's mtime staleness guard doesn't prove the Rust binary is in sync
- **verdict:** OK
- **confidence:** high
- **evidence:** No lockstep rule exists — the only coupled-file lint in `scripts/check-standards-rules.mjs` is the Playwright container-pin one at `:2483-2515`, which is the *pattern* the card proposes mirroring, not the rule itself. All named files exist: `scripts/lib/rust-scan-bridge.mjs`, `scripts/rust-scan/src/secret_scrub.rs`, `scripts/rust-scan/src/stdout_flush.rs`, `scripts/lib/__tests__/rust-scan-bridge.test.mjs`. `backlog/3426-*.md` exists.
- **suggested action:** none

## #3480 — Personal cross-project Claude Code skills repo
- **verdict:** OK
- **confidence:** high
- **evidence:** Both named skills are still in WE: `skills-src/mechanical-delivery-doctrine/` and `skills-src/inspect-agent-health/` (the "agent-health-inspection skill"). Nothing has migrated. `backlog/3383-*.md` exists (referenced only to say this card is deliberately *not* parented under it).
- **suggested action:** none

---

## OK (single-line)

- #143 OK
- #2886 OK (work still owed) — carries DEAD-REFS, see block above
- #2928 OK
- #2939 OK
- #2943 OK
- #2944 OK
- #2945 OK
- #2946 OK
- #2996 OK
- #3109 OK
- #3149 OK
- #3169 OK
- #3179 OK
- #3205 OK (note: unruled fork inside a `kind: story` body — carve candidate)
- #3265 OK
- #3267 OK
- #3281 OK
- #3385 OK
- #3429 OK
- #3480 OK
