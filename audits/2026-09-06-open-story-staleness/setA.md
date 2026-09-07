# Adversarial verification — set A (14 cards)

Verifier ran read-only. No edits, no commits, no backlog state changes.
Repos: `/home/user/web-everything` (WE), `/home/user/frontierui` (FUI).

## Global caveat that touches several cards

`npm run check:standards` in WE currently exits with **1 error**, unrelated to any card in this set:

```
error  Backlog file "backlog/xlv5507-a-card-resolve-pr-can-land-before-the-impl-it-names-in-gradu.md"
       is on main with a NON-NUMERIC leading id "xlv5507" — a land route bypassed JIT numbering (#2288)
       and stranded a hash (#2319).
1 error(s), 1599 warning(s)
```

Cards #2914, #2949, #3045, #3100, #3177 each carry a "`npm run check:standards` — 0 errors" clause. That
clause is literally unmet **today**, but the error is a stranded-hash backlog file, provably not produced by
any of these cards' own changes. Verdicts below are not downgraded for it; it is recorded so the resolve pass
does not claim a clean gate.

Environment limit: **no `dotnet` SDK on this host** (`which dotnet` → not found), so #2383's harness could not
be executed. Java IS present and #2369's harness was executed for real.

---

## #2369 — JVM SSR renderer: resource:loader + defer — **CONFIRMED-DONE**

Card has no `## Done when`; its acceptance is the demo clause: *"passes resource-loader + defer vectors
byte-for-byte"*, plus scope files and `blockedBy: 2368`.

- `blockedBy` #2368 → `status: resolved` (`backlog/2368-jvm-ssr-renderer-foundation-if-switch-directives.md`).
- `frontierui:plugs/webdirectives/ssr/jvm/src/main/java/com/frontierui/webdirectives/ssr/JvmServerRenderer.java`
  — `markerToken` returns `"resource:loader"` (:31) and `"defer"` (:32); `renderInner` emits the
  resource:loader success branch via `Renderers.interpolate(el.inner, data)` (:73-77) and defer's
  `<placeholder>` branch only (:78-85). Both are the inner-branch-over-interpolate shape the card specifies.
- `…/src/test/java/…/ConformanceHarness.java:35` — `IMPLEMENTED = {if, switch, resource:loader, defer}`.
- **RAN IT**: `bash plugs/webdirectives/ssr/jvm/build.sh` (vectors resolved through the
  `/home/user/webeverything → web-everything` symlink):
  `7 passed, 0 failed, 3 skipped`, including
  `PASS webdirectives-ssr/resource-loader/resolved-data-inline` and
  `PASS webdirectives-ssr/defer/placeholder-branch-emitted`. Byte-comparison is strict (UTF-8 `Arrays.equals`).
- Only `for-each` vectors are SKIPped, which the card explicitly leaves to a later #2069 slice.

Attempted breaks that failed: no unchecked boxes, no children, no `graduatedTo`, scope files both exist,
harness exits 2 if nothing is graded (so a silent-zero pass is impossible).

## #2383 — Native .NET SSR renderer foundation + if/switch — **CONFIRMED-DONE** (execution-blocked caveat)

Clauses, verbatim from the card body, each with its artifact:

- *greenfield .NET build subtree at `frontierui:plugs/webdirectives/ssr/net/`* — exists: `src/{NetServerRenderer,
  Renderers,HtmlParse,Json,ServerRenderer,ConformanceHarness}.cs`, `tests/ConformanceTests.cs`,
  `WebDirectivesSsr.Conformance.csproj`, `build.sh`, `README.md`.
- *source parse (a real HTML parser/DOM, e.g. AngleSharp … parser choice is a conforming black box per #2030)*
  — hand-rolled `HtmlParse.cs` (213 lines: `Siblings`, `ParseAttrs`, `FindMatchingClose`, `RegionMatches`), a
  structural port of the JVM `HtmlParse.java` that passes vectors. `csproj` states zero runtime NuGet dep by
  design. This is the one clause a hostile reader could contest ("AngleSharp" was the named example) — but the
  card itself says the parser is a black box under #2030 and the JVM twin shipped on the same basis (#2368
  resolved), so this is a permitted substitution, not a miss.
- *top-level template-is dispatch loop + normative space-padded marker wrapping + RenderMarkerOptions* —
  `NetServerRenderer.Render` (:33-64): `"<!-- " + token + " " + openOptions + " -->"` / `"<!-- /" + token + " -->"`,
  line-for-line equivalent to the JVM renderer I executed above.
- *shared helpers (ResolvePath, mustache Interpolate)* — `Renderers.cs`: `ResolvePath`, `Interpolate`,
  `Stringify`, `Truthy`, `RenderMarkerOptions`.
- *if + switch* — `RenderInner` (:70-88), `MarkerToken` → `control:if` / `control:switch`.
- *.NET-side cross-language conformance harness reading `we:conformance-vectors/webdirectives-ssr.vectors.json`
  and byte-comparing per #2354* — `src/ConformanceHarness.cs` + `tests/ConformanceTests.cs`
  (`report.Failed.Count == 0` reports EVERY failure, plus a `report.Passed.Count > 0` graded-something guard).
- *wired into `dotnet test` + repo CI* — `frontierui:.github/workflows/ci.yml:61-67` (setup-dotnet 8.0.x) and
  `:93-96` `run: bash plugs/webdirectives/ssr/net/build.sh` inside the `test` job; `build.sh` exports
  `WEBDIRECTIVES_SSR_VECTORS` and hard-fails (exit 2) when the vectors file is missing.
- *Demo: passes if, switch, state-tokens vectors byte-for-byte* — **NOT executed here**: no dotnet SDK on this
  host. Residual weakness worth naming: `ConformanceTests` **self-skips** (returns, test green) when vectors
  are unreachable, so a local `dotnet test` in a bare clone proves nothing; only the `build.sh`/CI path
  (which sets the env var and fails closed) actually grades. That is documented in the test's own header.

## #2387 — EPIC: serial-batch → drain coordination — **PARTIAL**

Children (`grep -l 'parent: "2387"' backlog/*.md`), 14 total:

| child | status |
|---|---|
| 2386 lane-pool-base | resolved |
| 2388 hash-aware-cascade | resolved |
| 2389 manifest-stack-fields | resolved |
| 2390 per-item-review-diff | resolved |
| 2391 drain-dual-lock | resolved |
| 2392 bornAs-proof-of-land | resolved |
| 2393 proof-of-land gate | resolved |
| 2394 producer-overlap-stacking | resolved |
| 2395 push-at-close | resolved |
| 2396 finish-stack-repair | resolved |
| 2397 docs-stacked-batch | resolved |
| 2400 drain hash-rewrite dangles | resolved |
| 2443 interactive drain watch lease | resolved |
| **2442 push-at-close drain: prompt exit when no batch feed** | **open** |

**Clause not met:** an epic cannot resolve while a child is open. #2442 (`kind: story`, `size: 3`,
`priority: low`, scope `we:scripts/drain-push-at-close.mjs` + 5 more) is open and explicitly still describes
live behaviour ("idle-polls until `--max-runtime-min`, holding the lease"). Its own note parks it as
"settled-but-low-value-now", i.e. deliberately unbuilt, not silently done. All 11 slice-plan slices did land,
so the epic is substantively delivered — but the claim "fully delivered" fails on the open child.

## #2423 — per-PR review-escalation relief valve — **CONFIRMED-DONE**

Clauses: per-PR override that leaves the rubric live for the rest of the pass; the override still refuses
`review:human`/`review:changes`; tests: relieved PR merges on allowPending while a fresh gate-self PR in the
SAME pass still parks `review:human`; bare flag keeps behaviour **or** is deprecated with a loud pointer.

- `we:scripts/merge-ai-prs.mjs:181` `parseNoReviewEscalation(argv)` — repeatable + comma-separated; bare/empty
  value → `{ passWide: true, prs: [] }` (legacy).
- `:210` `applyEscalationRelief(gate, {relieved})` — waives only an agent-reviewable `review:pending` park;
  `:562-563` and `:3725` keep `review:human`/`review:changes` refused even under the flag.
- `:4061-4068` per-PR call site: `relieved: escalationRelief.prs.includes(Number(v.num))`, so non-named
  candidates keep the full rubric.
- Deprecation pointer: `:3049` writes a loud stderr warning for the bare form; `LAND_REASON` gains
  `relief-waived` and `relief-waived-pass-wide` (`:2151-2152`) so each lands announced.
- Docs: `we:skills-src/drain/SKILL.md:276-283` documents PREFERRED per-PR vs DEPRECATED pass-wide.
- Tests **RAN GREEN**: `scripts/__tests__/merge-ai-prs-review-escalation-and-rollup-dedup.test.mjs` (63) +
  `…-ai-detection-and-drain-ordering.test.mjs` (103) — 166 passed. Covers parse (repeatable, comma, bare,
  garbage), waive-only-pending, refuse-human, refuse-changes, `relieved:false` no-op.
- Scope drift noted, not a defect: the card names `we:scripts/__tests__/merge-ai-prs.test.mjs`; that file was
  since split into the three `merge-ai-prs-*.test.mjs` files where the coverage now lives.

## #2914 — converge loop requires diffBasis but no juror reads it — **CONFIRMED-DONE**

`## Done when` clauses, one by one:

1. *`isDiffBasisDegraded('net')` false, everything else true — proven by a unit test* →
   `scripts/lib/review-core.mjs:1809`; tests at `scripts/lib/__tests__/review-core.test.mjs:2026-2034`.
2. *`buildPanelMandate({lens, diffBasis:'three-dot'})` carries the disclosure; with no `diffBasis` it is
   byte-identical, golden fixture passing unmodified* → guarded `if (diffBasis && isDiffBasisDegraded(...))` at
   `review-core.mjs:1105`; param added at `:1053`; the golden-fixture test still present and green (`:689` era
   test in the 304-test file, all pass).
3. *A round whose `diffBasis !== 'net'` forces `reducePanelRound`'s degrade → needs-human/escalate, proven by
   source-regression test* → `scripts/workflows/review-parked-prs.mjs:1046` `const basisDegraded = diffBasis !== 'net'`
   feeding `degrade`; `basisOf` at `:1189`, captured at all three fetch sites (`:1190`, `:1283`, `:1329`);
   source-regression assertions at `review-core.test.mjs:2107` (basisOf literal) and `:2108`
   (`toHaveLength(3)` — exactly the three capture sites).
4. *Mandate CLI invocation carries `--diffBasis` and the CLI forwards it* → `review-parked-prs.mjs:685`
   (`mandate --lens=${lens} --diffBasis=${diffBasis}`), `scripts/review-core-cli.mjs:240/246/656`; asserted at
   `review-core.test.mjs:2116-2117` and by the CLI suite.
5. *`npm test` green for the touched files* — **RAN**: `review-core.test.mjs` (304) + `review-core-cli.test.mjs`
   (50) = 354 passed.
6. *`check:standards` 0 errors* — see global caveat (1 unrelated stranded-hash error).

## #2924 — acquire proves containment then destroys the lane ~30s later — **CONFIRMED-DONE**

`## Acceptance` clauses:

- *proof … from state no older than the `fetch --prune` that immediately precedes it* →
  `we:scripts/lane-pool.mjs:1155` `git fetch origin --prune`, then `:1161-1173` re-runs
  `laneDirtyOrAhead(dir, repo.branch)` + `aheadIsProvablyPushed(dir, localRemoteShas(dir))` and `fail()`s
  before the destructive `git checkout -B … --force` at `:1189` and `clean -fd` at `:1190`.
- *closes #2919's object-locality limit* → the re-check reads `localRemoteShas` (`:655`,
  `for-each-ref refs/remotes/origin`), i.e. local objects brought by the fetch, not an `ls-remote` snapshot.
- *still fails closed* → `if (dirty || !provablyPushed) fail(...)`; only an explicit `--force` bypasses, which
  is an operator override, not a default.
- Regression test exists and **RAN GREEN**:
  `scripts/__tests__/lane-pool-acquire-reverify-containment.test.mjs` (2 tests) — it deletes the ref on origin
  inside the window and asserts the acquire errors matching `/#2924/`.

## #2949 — acceptance criteria written to be proven not judged — **CONFIRMED-DONE**

`## Done when`, four numbered clauses:

1. *scaffold produces a body with a `## Done when` section; asserted in `scaffold.test.mjs`; the
   `frontmatter.test.mjs` trailing-content assertion updated, not deleted* → `scripts/backlog/scaffold.mjs:101-105`
   (`doneWhen` skeleton with an `**Executable**` TODO); `scaffold.test.mjs:71-78`;
   `frontmatter.test.mjs:220-221` (both the `toContain('## Done when')` AND the retained
   `toMatch(/\n[^\n#-].*\n$/)` — updated, not removed).
2. *`scripts/__tests__/audit-backlog-health.test.mjs` asserts `missingDoneWhenProof` on four cases* → file
   exists, 5 tests, all green.
3. *`npm run check:health` prints an `A1` section and count against the real corpus* → `audit-backlog-health.mjs`
   `flags.A1` (:377), push (:463-464), `desc.A1` (:565), `section('A1', …)` (:591), summary line (:600). Observed
   live during the test run: `audit: 3475 items, 869 flags (… A1=470 …)`. (Card predicted ≈287/427; the corpus
   grew — the clause asks for a printed section and count, which it prints.)
4. *`check:standards` 0 errors* — global caveat.

Also delivered though not in Done-when: docs ladder at `docs/agent/backlog-workflow.md:255,346`; skill tie-break
at `skills-src/next-backlog-item/SKILL.md:147`. Parent #2948 status not required for a child's completion.

Tests **RAN GREEN**: audit-backlog-health (5) + scaffold (…) + frontmatter (…) = 51 passed.

## #2953 — /review skill call sequence fails on first use — **CONFIRMED-DONE**

Three named papercuts (the card's de facto criteria):

1. *`--body-file` refuses the agent scratchpad* → fixed by widening + realpath:
   `scripts/review-set-label.mjs:398-406` — `bodyFileRoots = [cwd, tmpdir(), '/tmp']`, compared after
   `realpath`, with the darwin `/private/tmp` symlink reasoning in the docblock (:357-371). The skill also now
   documents it: `skills-src/review/SKILL.md:231-232`.
2. *`renderReviewNotice` says `accept`, CLI says `accepted`* → `scripts/lib/review-core.mjs:1353-1357`
   normalizes `'accepted' → 'accept'`; error text updated; not a silent fail-open (unknown values still throw).
3. *No PR-state guard* → `review-set-label.mjs:579-623` — `state` rides the existing `gh pr view --json` call
   (no new hop), `classifyPrLiveness` + `inertPrMessage`, `fail(..., 1)` on anything but OPEN.

Tests **RAN GREEN**: `scripts/__tests__/review-set-label.test.mjs` (251) + `review-core.test.mjs` (304).

## #2975 — convergence loop can LAND on stale material — **CONFIRMED-DONE**

`## Done when`:

- *step-4 input escalates instead of returning `panel`* → `scripts/lib/converge-core.mjs:470-482`, block "1c.
  MALFORMED OBSERVATION (#2975)", placed **before** the `if (!obs.panel.observed) return PANEL` at :484 —
  exactly the ordering fix the card demanded: `if (!obs.panel.observed && (obs.edit.observed || obs.redTeam.observed))
  → ESCALATE / NEEDS_HUMAN / STALE_OBSERVATIONS`.
- *a unit test in the core asserts it* → `scripts/lib/__tests__/converge-core.test.mjs:282`.
- *the end-to-end sequence can no longer reach `land`* → `converge-core.test.mjs:305` — "#2975 END TO END — the
  reproduction from the backlog item can no longer reach `land`".
- *`skills-src/converge/SKILL.md` action table stays as-is; the core enforces it* → no `#2975` edit in that
  SKILL.md (grep empty) — i.e. the prose was left alone, as required.

Tests **RAN GREEN**: 66 tests.

## #2976 — declared-module-contract gate misses an undeclared import under the LAST declaration — **CONFIRMED-DONE**

`## Done when`:

- *last declaration's slice bounded by its own text rather than `header.length`* →
  `scripts/check-standards-rules.mjs:2608-2619` — `end` is computed from `lastDeclarationEnd` (the
  declaration's own backtick-list grammar), explicitly **not** by searching for a blank line
  (:2563-2567 documents why the blank-line heuristic was rejected in review round 2).
- *a fixture with trailing prose after the last declaration is added, and it fails before the fix* →
  `scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs:433` (trailing prose) **and** `:460`
  (no blank-line separator — the harder round-2 case).
- *the injection described above reports an error* → covered by those two fixtures; I did not perform the live
  in-tree injection because this pass is read-only (would require editing `scripts/lib/converge-core.mjs`).
  This is the one clause verified by proxy (fixture) rather than by reproducing the card's own mutation.

Tests **RAN GREEN**: 55 tests.

## #3045 — register clearer-identity module in TRUST_CHAIN — **CONFIRMED-DONE**

`## Done when (testable)`, executed directly:

```
isPolicySpecPath('scripts/lib/review-independence.mjs') → true
scoreEscalation({changedFiles:['scripts/lib/review-independence.mjs'],diffLines:40})
  → { escalate:true, humanRequired:true, careLevel:'high',
      reasons:['blast-radius (…)','gate-self (scripts/lib/review-independence.mjs) — declarative leash, human review required'] }
```

- Roster entry: `scripts/lib/gate-config.mjs:294-302` (`role: 'clearer-identity'`, its own dated header comment).
- *"NOT YET TRUST-CHAIN REGISTERED" paragraph absent* → grep over `scripts/lib/review-independence.mjs` returns
  nothing.
- *new gate-config test* → `scripts/lib/__tests__/gate-config.test.mjs:165` (the #2844/#3045 test).
- *`DECLARATIVE_LEASH_FILES` membership* → `scripts/lib/__tests__/gate-invariants.test.mjs:86`.
- Tests **RAN GREEN**: gate-config (13) + gate-invariants (39) + review-independence (in the same run) — all pass.
- *`check:standards` exits 0* — global caveat (unrelated stranded-hash error).
- *the PR is labeled `review:human`* — a landed-PR property, not re-verifiable from the tree; the scorer probe
  above is the mechanical equivalent and it returns `humanRequired: true`.

## #3100 — agent-memory-src missing from the at-land hash rewrite scope — **CONFIRMED-DONE**

Six `- [ ]` boxes are unchecked in the card body (a filing artifact — every one is satisfied on disk):

1. *`numberPendingHashes` reads tracked `agent-memory-src/*.md` like `docs/agent/*.md`, includes them in
   `files` for `applyLedger`, and stages rewritten paths* → `scripts/lane-drain.mjs:605,615,642-654`
   (`const MEMORY = join(CWD,'agent-memory-src')`, `ls-files agent-memory-src/*.md` tracked set, mapped into the
   files array; missing dir is non-fatal).
2. *a hash cited in agent-memory-src is rewritten in the same land commit — new case in
   `lane-drain-numbering.test.mjs`* → `:269-283` (asserts `Filed #2201` after the land, same commit).
3. *`bornAs:` lines still protected — asserted explicitly* → `:285-301`.
4. *the CITATION gate scans `agent-memory-src/*.md` and a dead hash-slug there WARNs — new case in the
   citation-check test* → `scripts/check-standards.mjs:1351` (`scanDir('agent-memory-src/', ['.md'])`),
   `:1191`, `:1337`; `scripts/lib/citation-check.mjs:46` (`HASH_REWRITE_DIRS` now includes `agent-memory-src/`)
   and the **new gate 3b** `findDanglingMemoryHashSlugs` (:339-360) — deliberately *not* the card's literal
   "add it to `HASH_SLUG_OUT_OF_SCOPE_DIRS`" instruction, which the card's own independent review had already
   mutation-proven contradictory (:52-58 records exactly that). Tests:
   `scripts/__tests__/citation-check.test.mjs:358-399`, including the "does NOT false-positive … the #3100
   interface bug this gate exists to avoid" case. **Deviation from the literal clause, in the direction the
   card's own review demanded — intent met, not skipped.** (Note the card's cited test path
   `we:scripts/lib/__tests__/citation-check.test.mjs` does not exist; the suite lives at
   `scripts/__tests__/citation-check.test.mjs`.)
5. *the 7 measured dead hash references replaced with `#NNN`* → `grep -rnoE '\bx[0-9a-z]{6}\b' agent-memory-src/
   | grep -v bornAs` returns **nothing**. Corpus clean.
6. *`check:standards` 0 errors + the re-grep returns nothing unresolved* → re-grep clean (above);
   check:standards per the global caveat.

Tests **RAN GREEN**: lane-drain-numbering (21) + citation-check (76).

## #3117 — judge-spawn juror fails first attempt with a bare error — **CONFIRMED-DONE**

Card is a `kind: task` with no `## Done when`; its ask is: *"capturing stderr or the raw parsed object in the
thrown message when result is empty, so a future occurrence is diagnosable"*.

- `scripts/lib/judge-spawn.mjs:649-662`: the `parsed.result` truthy branch still throws the CLI text verbatim;
  the empty-result branch now throws `judge-spawn: the juror failed with no result text. parsed: <JSON, 600 chars>`
  plus `stderr[-600..]: …` (or `stderr: <empty>`). Exactly the "raw parsed object + stderr" the card asked for.
- Tests: `scripts/lib/__tests__/judge-spawn.test.mjs:345`
  (`/no result text[\s\S]*end_turn[\s\S]*zzzz[\s\S]*exit code 1/` — asserts the parsed payload AND the stderr
  tail AND the `exit code N` fallback all reach the message) and `:1183`.
- Tests **RAN GREEN**: 119 passed / 4 skipped.
- Scope (`we:scripts/lib/judge-spawn.mjs`) matches; no children, no unchecked boxes.

## #3177 — dispatch-lane redispatch can coexist with a killed prior session — **PARTIAL**

`## Done when` has four clauses. Clause 1 is satisfiable on the current tree; **clause 2's named test does not
exist**, and no artifact anywhere is authored against #3177 (only one comment mentions it).

Clause 1 — *a test asserts that `dispatch-lane --num=<item>` with a prior in-flight record (even if its OS
process is dead) either (a) refuses and reports why, or (b) marks it superseded AND confirms the prior session
is actually dead before spawning* — **MET, but by adjacent items' work**:
- `scripts/operations/dispatch-lane.mjs:644-669` — `holdingRuns` / `dispatchStillHolds`, returning
  `dispatching:false` with a `holdReason` naming the runId and telling the operator to `wake.mjs --resolve`
  first. `dispatchStillHolds` (:471-505) holds unconditionally on `live===true`, ages out on `live===false`
  only past a listing grace anchored on `lastSeenLiveAt`, and uses the clock ONLY when liveness is unknown.
- Test: `scripts/operations/__tests__/dispatch-lane-fixture-harness.test.mjs:283-302` — "the double-dispatch
  guard holds while the prior dispatch is LIVE", asserting `/already has a dispatch in flight/` and `/STILL LISTED/`.
- Read-side floor: `scripts/conveyor/tick-core.mjs:259-289` `durableBuildNums` (tested,
  `conveyor/__tests__/tick-core.test.mjs:73-99`).
- **But every one of these is attributed to #3073 / PR #1211 / #3353 / #3403 / #3457 — none to #3177.** The one
  place #3177 is named is `tick-core.mjs:264`, and it names it as the failure #3403 guards against, i.e. as
  prior art, not as this card's delivery.

Clause 2 — *a test simulates exactly this sequence (kill pid, do nothing else, redispatch) and asserts the
operation either detects the stale record and cleans it up itself, or refuses with a clear "release the item's
in-flight record first" message rather than silently spawning a duplicate* — **NOT MET**. No such test exists:
`grep -rn "3177"` over `scripts/`, `skills-src/`, `docs/`, `agent-memory-src/` returns exactly one hit (the
comment above), and no `describe`/`it` in `scripts/operations/__tests__/` simulates a pid-kill-then-redispatch
sequence. The nearest coverage is `dispatch-abort.test.mjs` (which is #3383's `claude stop`-not-`kill`
composition) and `wake-cli.test.mjs:466-473` (`assertHandleNotLive` refusing a live handle) — related, but
neither is the sequence this clause names. Behaviourally there is also a real residual the clause targets: once
a listing reads `live:false` past `DISPATCH_GUARD_LISTING_GRACE_MINUTES`, the operation **dispatches anyway**
and only *reports* `agedOutRuns` — the stale record is neither cleaned up nor refused (`dispatch-lane.mjs:849-852`
says so in its own comment: "They are still `in-flight` on disk and still need closing out").

Clause 3 — *scoped to the write/redispatch side, not a re-implementation of #3149/#3162* — n/a as a proof
obligation.

Clause 4 — *`check:standards` 0 errors and the relevant new test file is green* — there is **no new test file**
to be green, and check:standards has the 1 unrelated error (global caveat).

**Verdict rationale:** the double-dispatch hazard is materially closed by other items' machinery, so this is
not NOT-DONE; but the card's own clause 2 (its named test, and the stale-record cleanup/refusal it demands) is
unsatisfied, so the "fully delivered" claim fails.

---

## Summary

| card | verdict |
|---|---|
| 2369 | CONFIRMED-DONE |
| 2383 | CONFIRMED-DONE (dotnet not installed here; verified structurally + CI-wired) |
| 2387 | PARTIAL — child #2442 open |
| 2423 | CONFIRMED-DONE |
| 2914 | CONFIRMED-DONE |
| 2924 | CONFIRMED-DONE |
| 2949 | CONFIRMED-DONE |
| 2953 | CONFIRMED-DONE |
| 2975 | CONFIRMED-DONE |
| 2976 | CONFIRMED-DONE |
| 3045 | CONFIRMED-DONE |
| 3100 | CONFIRMED-DONE (gate half delivered as gate 3b, a documented deviation from the literal clause) |
| 3117 | CONFIRMED-DONE |
| 3177 | PARTIAL — Done-when clause 2 (kill-pid-then-redispatch test + stale-record cleanup/refusal) unmet |
