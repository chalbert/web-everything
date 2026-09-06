# Adversarial verification — set B
Repo: /home/user/web-everything · date 2026-09-06 · READ-ONLY pass (no edits, no commits, no backlog.mjs)

## Repo-wide facts that bear on several cards

- `npm run check:standards` → **1 error, 1599 warnings**. The single error is
  `Backlog file "backlog/xlv5507-a-card-resolve-pr-can-land-before-the-impl-it-names-in-gradu.md" is on main
  with a NON-NUMERIC leading id` — a stranded-hash card, **unattributable to any card in this set**. Every
  clause below that says "check:standards 0 errors" is therefore *not literally* satisfied repo-wide; I do not
  fail any card on it, but no card in this set can claim a literally-zero gate either.
- No card in this set has an unchecked `- [ ]` box (`grep -c '^\s*- \[ \]'` = 0 for all 18).
- No card in this set carries a `graduatedTo:` frontmatter key, so there is no dangling graduation path.
- Several cards landed under their `bornAs` hash; hash-named symbols are counted as evidence per the brief.

---

## #3189 — extract the review-label provider port — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/__tests__/review-set-label.test.mjs scripts/lib/__tests__/review-label-provider.test.mjs`
→ **269 passed** (251 + 18), 48.6s.

| clause (verbatim) | evidence |
|---|---|
| 1. "a case asserting BOTH orderings through the real code with a stub provider: a PR already carrying `review:accepted` calls `setLabels` before `postComment`; one not carrying it calls `postComment` first" | `scripts/__tests__/review-set-label.test.mjs:1849` `describe('the write arc and its #2964 ordering')`; `:1885` `'COMMENT FIRST when review:accepted is not already live'` (`expect(order).toEqual(['postComment','setLabels'])`), `:1892` `'SWAP FIRST when it is already live'` (`['setLabels','postComment']`). Driven through the real `runReviewLabelCli` with `stubProvider` (`:1858`). |
| 2. "a test asserts the swap is never handed a label the PR does not carry" | `:1900` `it('never hands the swap a label the PR does not carry')` — asserts `spec.add === 'review:accepted'` and every `spec.remove` ∈ the PR's live labels. Observed at the port (`setLabels` spec), not only as a pure function. |
| 3. "the default provider is `gh` and its argv is byte-identical … proven by asserting the argv the adapter builds" | `scripts/lib/__tests__/review-label-provider.test.mjs:19` `describe('GH_ARGV is byte-identical to the pre-port inline calls')` — 9 cases incl. `:33` one `--add-label`/`--remove-label` per removal, `:52` comment by file, `:57` "names the state fields once, so a stub cannot drift from the real read", `:115` `ensureLabel shells the exact argv GH_ARGV builds`. |
| 4. "a refused run calls NO port operation — proven by a stub that records zero calls" | `:1908` `it('a REFUSED run performs no write at all — the refusal precedes the port')`; also `:2270`ff (the PR #1593 bodyless-bounce refusal) `expect(p.calls).not.toContain('setLabels'/'postComment')`. |
| 5. "`check:standards` 0 errors; the existing 1787-line suite passes unmodified except for additions" | Suite green (251 tests). Gate = 1 unattributable pre-existing error (see above). |

Attempts to break it that FAILED: the port is really injected (`provider` param threaded through `runReviewLabelCli`); the refusal-precedes-port property is asserted with a recording stub, not by argv inspection; `currentRepo` is on the provider so `gh repo view` (the "fifth site") stayed out of the port exactly as the card promised.

---

## #3200 — the drain re-stamps its own rebase — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/__tests__/merge-ai-prs-acceptance-restamp-and-review-coverage.test.mjs` → **50 passed**.

| clause | evidence |
|---|---|
| 1. "a test driving a drain-authored rebase-drop over a PR carrying valid acceptance markers, asserting the markers are re-stamped at the new head and the PR is NOT re-parked" | `needsAcceptanceRestamp` (`scripts/merge-ai-prs.mjs:~745`), test `:35` `'fires for the one case it exists for: THIS drain rebased an accepted, unheld PR'`; the write half is `restampAcceptance` (`scripts/merge-ai-prs.mjs:703`), called at `scripts/merge-ai-prs.mjs:3680`. **Weakest clause of the four** — the assertion is over the pure predicate + the spawn argv, not an end-to-end "PR is not re-parked". Accepted because `--to=restamp` is a distinct target whose `decideSetLabel` arm (`scripts/review-set-label.mjs:239`) is separately pinned at `:1975`ff, and `restamp` stamps markers (`review-set-label.mjs:652`, `:721`). |
| 2. "ONLY for a rebase the drain itself produced and only when the pre-rebase acceptance was valid — never … manufacture an acceptance" | `:39` no live acceptance → false; `:48` uncleared hold → false; `decideSetLabel` restamp `'REFUSES with no acceptance to carry — it may never manufacture one'` (`:1985`ff). Two independent refusals, as the card promises. |
| 3. "A rebase that is NOT content-preserving … still invalidates, with a test pinning that the escape does not widen" | `:52` `{action:'current'}` and `{action:'skip', reason:'real conflict beyond manifest'}` → false; `:59` `undefined`/`null` rebase (an author push) → false. |
| 4. "The durable comment records that the marker was re-stamped by the drain rather than earned by a fresh review" | `scripts/review-set-label.mjs:1025` heading `📌 review — acceptance re-stamped after a rebase (no new review)`; `scripts/merge-ai-prs.mjs:2039` same string; `scripts/lib/verdict-ledger.mjs:140` `RESTAMPED`; `scripts/lib/review-log-claims.mjs:117`. `restampAcceptance` passes `--actor=drain --channel=drain-rebase --reason=head moved to <sha> by this drain's own content-preserving rebase`. |

---

## #3206 — `record-verdict` operation — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/operations/__tests__/record-verdict.test.mjs` → **46 passed** (card promised 21).

| clause | evidence |
|---|---|
| 1. "`npx vitest run` over `we:scripts/operations/__tests__/record-verdict.test.mjs` passes 21 assertions" | 46 pass. Module `scripts/operations/record-verdict.mjs` + `record-verdict-io.mjs` both exist. |
| 2. "`record-verdict --help` … prints a usage line with `--runId` required and no `--pr` at all, derived by the CLI adapter" | Ran it: `usage: run.mjs record-verdict --runId=<string> --to=accepted|changes|clear-human [--actor=…] [--operatorInstruction=…] [--repoRoot=…] [--json]`. **No `--pr` anywhere.** |
| 3. "the skills that tell an agent to record a verdict name the operation rather than a hand-rolled request" | `skills-src/review/SKILL.md:262` — `node scripts/operations/run.mjs record-verdict --runId=<run-id> --to=…`. No hand-assembled `JSON.stringify` request survives in the skills tree. |

---

## #3207 — `verify` operation — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/operations/__tests__/verify.test.mjs` → **28 passed**.

| clause | evidence |
|---|---|
| 1. "a check whose output has no parseable summary is reported `unrun` and … the verdict is NOT `ok`, even with zero failures" | `scripts/operations/verify.mjs:50` `CHECK_OUTCOMES = ['pass','fail','unrun']`; `:95-96` the header states exactly the "`!failed` would be false for the right reason by accident" trap; `:105-119` reduces `unrun` into `blocking` with `why:'did-not-run'`. IO shell classifies at `scripts/operations/verify-io.mjs:82,83,90,97,107`. |
| 2. "`run.mjs verify --help` prints flags derived from the declaration, with no argv parser written" | Ran it: `usage: run.mjs verify --checkout=<string> [--mode=run|check, default run] [--gate=…] [--json]` + `read-only: every step is compute …`. `--checkout`, not `--cwd`, as the card promised. |
| 3. "reports a green lane as `ok` and a toolchain-less checkout as `unrun` — both verified live" | Not re-runnable live here (would run the whole gate); the single-home shelling is structural: `verify-io.mjs:41` `VERIFY_LANE_CLI = …/verify-lane.mjs`, i.e. it shells the one home rather than re-implementing `check:standards` + vitest — the specific defect the card says the first cut committed. |
| "Wired into the callers" (three named files) | `docs/agent/backlog-workflow.md:215` and `:1036`; `skills-src/conveyor/delivery-agent-brief.md:148,160,264,266`; `skills-src/next-backlog-item/SKILL.md:247-248` — each names `run.mjs verify` and each says to read `unrun` before believing a green. |

---

## #3208 — `stage-pr-view` refuses an incomplete view — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/operations/__tests__/stage-pr-view.test.mjs` → **75 passed** (card promised 23).

| clause | evidence |
|---|---|
| 1. "passes 23 assertions; collapsing absent-and-empty into one truthiness test reddens 8 …" | 75 pass. `checkStagedView` at `scripts/operations/stage-pr-view.mjs:120`: `if (!(field in view) \|\| view[field] === null \|\| undefined) missing.push(field)` (absent → refuse) and the returned `empty` list (present-and-empty → believed). Mutation counts not re-run (would require edits — this pass is read-only). |
| type check, not just presence | `:135` `else if (kindOf(view[field]) !== want) mistyped.push(...)`; `VIEW_FIELD_TYPES` at `:78`; `:127-133` throws when a `PR_VIEW_FIELDS` entry has **no declared type**, which is the anti-derivation guard the card argued for. |
| subject check | `:153` `if (view.number !== pr) throw` — the #1466 check applied at staging. |
| 2. "staging a view of a live PR with `labels` omitted is refused by name" | Refusal message names the missing fields verbatim and says what the reader would have concluded. Live half unverifiable here (no `gh` binary in this container). |
| 3. "`stage-pr-view --help` … prints usage the CLI adapter derived" | Ran it: `usage: run.mjs stage-pr-view --pr=<number> --repo=<string> [--fromTransport=…] [--refresh=…] [--from=…] [--repoRoot=…] [--dir=…] [--json]`. |

Wired, not orphaned: `checkStagedView` is called at `stage-pr-view.mjs:397` inside the `check` step.

---

## #3209 — `open-pr` operation — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/operations/__tests__/open-pr.test.mjs` → **52 passed** (card promised 22).

| clause | evidence |
|---|---|
| 1. "passes 22 assertions; defaulting the park to the home's first label reddens 1 …" | 52 pass. `scripts/operations/open-pr.mjs` + `open-pr-io.mjs` exist. |
| 2. "**Structurally anti-bypass** — a test asserts the io shell imports `child_process` and none of `node:https`/`node:http`/`node:net`/a fetch library" | `scripts/operations/__tests__/open-pr.test.mjs:509-517` — `expect(external).toContain('node:child_process')` then a loop refusing `node:https`, `node:http`, `node:net`, `undici`, `node-fetch`. Exactly the clause. |
| 3. "`open-pr --help` prints usage the CLI adapter derived" | Ran it. Notably `[--mode=park\|label-on-green\|no-wait\|land, default **park**]` and `[--parkLabel=review:human\|review:pending, default **review:pending**]` — both "defaults that are decisions" hold, including the non-obvious one (the home's *first* label is `review:human` and is NOT the default). |

---

## #3213 — scope on `suggest-next` — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/operations/__tests__/suggest-next.test.mjs` → **27 passed** (card promised exactly 27).

| clause | evidence |
|---|---|
| 1. "passes 27 assertions. Making the scope re-sort reddens 5 …" | 27/27. |
| 2. "`suggest-next --parent=2405` returns the … open children of that epic, in the board's own order, with no grep" | Ran live: `node scripts/operations/run.mjs suggest-next --parent=2405 --json` → rank 1 `#2416`, projected `"parent": "2405"` and `"tags": [...]`. The projection carries `parent` and `tags`, which the card says the first cut lacked. |
| 3. "the three flags appear in `--help` and in the HTTP describe route with no argv code written" | `--help`: `[--parent=<string>] [--tag=<string>] [--locus=<string>]`. Declaration reads them at `scripts/operations/suggest-next.mjs:389` (`reads: [... 'input.parent','input.tag','input.locus' ...]`) and `:395` (`scope: {parent, tag, locus}`) — declared, not parsed. |

---

## #3268 — the session cannot author what its juror judges — **CONFIRMED-DONE**

Covered by the same 75-test `stage-pr-view.test.mjs` run.

| clause | evidence |
|---|---|
| 1. "`chooseViewSource` refuses when neither `--fromTransport` nor `--from=` is given, and refuses when both are. Neither is a default" | `scripts/operations/stage-pr-view.mjs:181` `chooseViewSource`; `VIEW_SOURCES` closed set at `:165`; test `describe('exactly one view source, chosen in writing')` at test `:253`. |
| 2. "`checkViewProvenance` REFUSES a hand-supplied view on any repo whose `ops/pr-views` branch exists on origin" | `stage-pr-view.mjs:228`; test `describe('a hand-supplied view is REFUSED wherever CI can serve — the structural half')` at test `:283`. This is the clause the card says "carries the item". |
| 3. "the transport read is `git show origin/ops/pr-views:<path>` with no filesystem seam … asserted by driving the reader with a booby-trapped `read` and proving it is never called" | test `:466` comment "a booby-trapped `read` through the shared factory proves the transport branch never reaches it"; `createTransportReader` at `stage-pr-view-io.mjs:207` (separate from `createFileReader` at `:376`). |
| 4. "`checkViewFreshness` refuses a view whose `headRefOid` is not the head `origin/<headRefName>` now points at, and refuses (rather than skipping) when that head cannot be resolved" | `stage-pr-view.mjs:291`; test harness `stale()` at test `:331`; `probeHeadOid` at io `:185`. |
| 5. "each of the above was mutation-tested" | Recorded on the card; mutations not re-run (read-only pass). |
| the `_stagedFrom` provenance stamp | test `:398` `expect(written._stagedFrom).toMatchObject({ source: 'transport', ref: TRANSPORT_REF })`. |
| option (b)'s CI half actually exists | `.github/workflows/stage-pr-view.yml` is on disk, separate from `apply-review-request.yml` — the "separate workflow on a separate branch" the card required so the applier keeps `contents: read`. |

---

## #3350 — an automated rebase defeats the drain's re-sync — **CONFIRMED-DONE**

| clause | evidence |
|---|---|
| 1. the literal `node -e` check ("exit 1 today") | **Ran it verbatim: now exits 0** (`match true`). The note sits within 1200 chars before `export function isRebaseDropCandidate` — at `scripts/merge-ai-prs.mjs:630`. |
| 2. "The note states the invariant **and its reason**: *do not rebase a queued PR from outside the drain, because a rebase restarts `test`, `testGreen` goes false, and the PR stops being a rebase-drop candidate*" | `:630` `#3350 — INVARIANT: **do not rebase a queued PR from outside the drain.** The reason is the load-bearing half,` … `:634` "…so **the precondition can never hold** and the self-healing queue becomes a livelock." Also carried to the **call sites**: `:3604` `Invariant: do not rebase a queued PR from outside the drain.` + `:3607` the reason — which is what the card's own `grep` complained was missing "within 1400 lines of :609 or of the rebase-pass call sites". |
| 3. "`npm run check:standards` — no error attributable to this card" | The one error is the unrelated stranded-hash card. |
| the retracted Done-when #1 | Correctly retracted on the card; `merge-ai-prs.test.mjs:1042/:1051` still exist and pass. |

---

## #3351 — validate a juror's cited file — **CONFIRMED-DONE** (with a literal-command caveat)

| clause | evidence |
|---|---|
| 1. `npx vitest run review-pr -t "#3351" \| grep -qE "Tests +[0-9]+ passed"` | **The command as written FAILS.** Ran it: `Tests 265 skipped`, zero matched, no "N passed" line. The work landed under the `bornAs` hash: `npx vitest run review-pr -t "#x6t2z6h"` → **25 passed** (159-test file, 134 skipped). Per the brief, a hash-named symbol counts as evidence, so I do not fail the card — but the criterion's own command needs `#x6t2z6h` substituted to be runnable. |
| 2. fixture library covering: off-scope cited file; line past EOF; negative/zero line; prose where structured findings belong; 50 findings; missing and unknown disposition; contradicting summary in both directions; two seats disagreeing; empty/whitespace summary; `findings` not an array | `scripts/operations/__tests__/review-pr.test.mjs:1880` `THE FAKE-JUROR FIXTURE LIBRARY (#x6t2z6h)`, `FAKE_JURORS` at `:1908` — `hallucinatedPath`, `lineBeyondEof`, `lineNonPositive` (0/-12/3.7), `proseInsteadOfFindings`, `objectInsteadOfFindings`, `volume` (50), `dispositionMissing`, `dispositionUnknown`, `dispositionUnearned`, `summarySaysCleanFindingsSayBlocked`, `summarySaysBlockedFindingsSayClean`. Two-seats-disagree: `:2248`. Empty/whitespace summary: `:579` and `:2145` (per seat). All driven end-to-end through the real engine via `driveFixture`/`atConfirm` (`:1968`). |
| 3. "A legitimate in-scope finding still blocks, at every canonicalisation variant tested" | `:2025` in-scope finding keeps `CITATION_SCOPES.IN_SCOPE`; canonicalisation variants at `:2039-2042` (`a/<path>`, trailing `:326`, backticked). |
| the ruling ("downgrade + disclose", never drop/refuse) | `review-pr.mjs:1289` (`citationScope` computed from `read.netChangedFiles`, skipped when `degraded`), `:1355` "THE VERDICT BASIS IS THE ADMITTED SET; THE PUBLISHED LIST IS THE WHOLE ONE", `:1445-1451` the withheld count is named in the confirm question. Forgery guard: `:2073` `'a juror CANNOT withhold its own finding by writing citationScope itself'`. |

---

## #3357 — guard every committed pr-land invocation — **PARTIAL**

The guard exists and is real: `scripts/__tests__/lane-verify.test.mjs:495` `describe('#3321 — every pr-land COMMAND STRING the tracked file set ships declares its posture (caller sweep)')`. Harvest is `git grep -lF -- pr-land.mjs` over the tracked set (`trackedMentioningPrLand`, `:551`) minus one pinned exclusion (`scripts/pr-land.mjs`, its own `--help` banner, count-pinned at 14 hits). `#3242` (the "one caller has no legal way to comply" blocker) is `status: resolved`, so that dependency is clear.

**Clauses NOT met:**

1. **Done-when 3 — "The count of call sites flagged across the tree at landing is recorded here."** The card body records **no count**. (Contrast the sibling #3362, which does record 12 / 10.) The card's own "Watch the false-positive direction" section asks for the same number and it is likewise absent. This is a flat, unambiguous miss.
2. **Done-when 2, as written — "Assert it against a file created by the test, not a file already in the tree."** The two mutation probes (`:625` `PROBES`) inject a line into **real tracked files' source text** (`scripts/lane-review.mjs`, `skills-src/pr/SKILL.md`) in memory. No file is created by the test. The *spirit* (a file the guard was never told about) is met; the *letter* is not.
3. **The array-argv arm is still an enumeration — the exact defect the card exists to close.** `:728` `it('the drain builds its argv as an ARRAY, and that array declares the posture too')` asserts a regex against **one hard-coded filename** (`const DRAIN = 'scripts/lane-drain.mjs'`). The describe's own limits section concedes: *"Argvs built as ARRAYS … are invisible to any command-string scan and are pinned by a separate case."* A `buildPrLandArgs`-shaped caller added to a **third** file is not caught — which is the card's stated failure mode ("a check that enumerates the files it knows about … is a hand sweep wearing a guard's clothes").
4. **Scope drift.** The card declares `scope: [we:scripts/check-standards-rules.mjs]` and asks for "a check over committed source" that **refuses rather than warns** because "a warning on stderr reaches nobody". Nothing matching `xv3nqsg` or "verification posture" exists in `scripts/check-standards-rules.mjs`; the delivered guard is a vitest case in `scripts/__tests__/lane-verify.test.mjs`, titled `#3321`, i.e. it landed as continuation rounds of the *fix* card the item was deliberately filed separately from.

Done-when 1 (replay against both historical misses) IS met: `:589-608` asserts the harvest contains `skills-src/batch-backlog-items/parallel-execute.workflow.js`, `scripts/lane-drain.mjs`, and the round-3/round-4 misses by construction; `:703` and `:717` pin the four `/workflow` argvs and their stripped-flag wedge.

---

## #3360 — deploy only a CI-verified SHA — **PARTIAL**

The **implementation is fully present and correct**, including both halves the card's retraction says are load-bearing:

- `.github/workflows/deploy.yml` — trigger is `workflow_run: {workflows:["CI"], branches:[main], types:[completed]}` (+ `workflow_dispatch` break-glass), `DEPLOY_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}`.
- Fork guard: job `if:` requires `workflow_run.conclusion == 'success' && workflow_run.event == 'push' && workflow_run.head_repository.full_name == github.repository`. That is precisely the retraction's first correction.
- Re-derive step `Refuse an unverified SHA`: **A. ancestry** via `gh api repos/…/compare/main...$DEPLOY_SHA --jq .status` accepting only `behind|identical`; **B. required checks** via `check-runs?filter=latest` reduced `group_by(.name) | map(max_by(.started_at))` requiring `["smoke","test"]`. That is the retraction's second correction, ancestry included.
- The full retraction is written into the file header as the card demanded.

**Clause NOT met — the card's ONLY acceptance clause is an unfilled placeholder:**

> `## Done when`
> `1. **Executable** — TODO: a command that fails before this item lands and passes after.`

No executable criterion was ever authored, and no test exists: `grep -rn "deploy.yml\|xmiuo0r" scripts/**/*.mjs` returns **nothing**. There is no command that fails before and passes after, so the item has no way to tell when it is done — the vacuity shape #3340 exists to catch, and #3350's own retraction section calls out by name. Substance shipped; the stated criterion is unwritten and unverifiable.

---

## #3362 — state a check's predicate and candidate set — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/review-corpus/__tests__/gates.test.mjs` → **63 passed**.

| clause | evidence |
|---|---|
| 1. "a gate over `backlog/*.md` and script docblocks flags an unqualified universal … and **passes** a claim stating its scan and predicate. Both directions" | `unqualifiedCompletenessClaim` at `scripts/review-corpus/gates.mjs:1004`, registered `:1070` as `{name:'unqualified-completeness-claim', targets:'backlog card or script comment'}`. Negative direction: `gates.test.mjs:283` (bare claim fires), `:339`. Positive direction: `:355` — the same sentence **with** "across the 213 candidates the sweep scans from a `git grep` over the tracked set" → `[]`. Also `:373` prescription (`must declare`) → `[]`, `:376` already-hedged → `[]`, `:388-391` quoted/blockquoted reproductions exempt, `:411-427` script-comment arm, `:505` registry-coverage case. |
| 2. "The count flagged across the tree at landing is recorded here" | Recorded on the card: **12 findings (0.36%) over 3339 `backlog/` files; 10 over 576 `.mjs`/`.cjs` under `scripts/`**, with the first-draft 25 → 12 reduction itemised per predicate defect, and **all twelve adjudicated by hand** in a table (6 true / 1 arguable / 5 false). This is the clause #3357 is missing. |
| 3. "`npm run check:standards` — 0 errors" | 1 unattributable pre-existing error (see top). |

---

## #3363 — record the reviewer's identity per round — **CONFIRMED-DONE**

Test run: `npx vitest run scripts/review-corpus/__tests__/mine-review-corpus.identity.test.mjs` → **16 passed**.

| clause | evidence |
|---|---|
| 1. "a newly mined round carries the reviewer-identity field, and a test asserts a round missing it is reported as **unknown** rather than silently compared" | Emitter: `scripts/review-corpus/mine-review-corpus.mjs:217` `reviewer identity (#3363)`, `:496` "WHO reviewed, beside WHAT they found. Never omitted", `:610` travels on the case, `:688` index version bumped to 2, `:713-717` prints the roll-up and the same-head-pair breakdown. Tests: `mine-review-corpus.identity.test.mjs:61` every mined case carries `reviewerIdentity` with all `IDENTITY_FIELDS`; `:147` `describe('#3363 — sameReviewer is THREE-valued, and never guesses same')`; `:168` `expect(sameReviewer(mined, null).answer).toBe('unknown')` and `:169` `sameReviewer(null,null) → 'unknown'` — a pre-field round is **not** read as `different` and **not** read as `same`. `IDENTITY_NEVER_EMITTED` / `IDENTITY_REQUIRED_FOR_SAMENESS` make the "capture slightly more than seems necessary" bar explicit. |
| 2. "`npm run check:standards` — 0 errors" | 1 unattributable pre-existing error. |

---

## #3390 — `lane-pool acquire --lane=N` dirty-tree guard — **CONFIRMED-DONE**

Test run (this file is in the default-config *exclude* list; run via the integration config):
`npx vitest run --config vitest.integration.config.ts scripts/__tests__/lane-pool-refresh-guard.test.mjs` → **15 passed**.

| clause | evidence |
|---|---|
| 1. "a test reproducing the incident (stage uncommitted + untracked changes in a lane, let its lease go TTL-stale, run `acquire --lane=N` without `--force`) fails before … and passes after (acquire refuses, or otherwise preserves the content, without `--force`)" | `scripts/__tests__/lane-pool-refresh-guard.test.mjs:262` `describe('acquire --lane=N dirty/ahead guard on a TTL-stale reclaim (#3390)')` — three cases: (a) `:263` untracked work survives, `reclaim.code !== 0`, stderr matches `/would destroy that work/` **and** `/--force/`, file content asserted intact; (b) `:294` ahead/locally-committed-unpushed, `rev-parse HEAD` unchanged; (c) `:326` `--force` still reclaims (documented override, end state unchanged). Implementation: `scripts/lane-pool.mjs:1074-1090` — the `#3390` block calling `laneDirtyOrAhead(dir, repo.branch)` on the explicit-lane TTL-stale path, before the `checkout -B --force` + `clean -fd` at `:1190`. |
| the "open question" (provably-pushed carve-out) | Resolved in code — the guard refuses by default and `--force` is the documented escape, mirroring the file's existing live-lease `--force` idiom exactly as the Ask proposed. Also cross-covered at `scripts/__tests__/lane-pool-acquire-base.test.mjs:264` `'WITHOUT --force, now REFUSES a dirty tracked-file conflict rather than discarding it (#3390)'`. |

---

## #3494 — parked-PR conflict watch — **CONFIRMED-DONE** (two caveats worth reading)

Test run: `npx vitest run scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` → **30 passed**.

| clause | evidence |
|---|---|
| 1. "`isParkedConflictTarget(pr)` is true iff `mergeable === 'CONFLICTING'` AND … uncleared `review:human`/`review:pending`/`review:changes` hold; false for a `review:accepted`-only PR and for any non-CONFLICTING `mergeable`. All branches unit-tested." | `scripts/conveyor/parked-pr-conflict-watch.mjs:89` `isParkedConflictTarget`, `:102` `planConflictLabelChange`, `:116` `buildConflictComment`, `:142` `defaultListParkedPrs`, `:159` `watchParkedPrConflicts`. 30 tests green. |
| 2. "Running the … `sweep` verb against the live repo applies a `merge-status:conflicting` label + posts one comment on PR #1920 …, and a second run is a no-op" | **This clause was FALSE at landing and I can prove it from git.** Commit `5d051f22` — *"WE #xoh8fkw: fix parked-PR conflict watch — it never actually applied its conflicting label"* — records that `repo` defaulted to `null` and every write failed silently inside the pass's own best-effort try/catch on every normal tick, plus a second live bug (`CONFLICT_LABEL_META.description` was 163 chars vs GitHub's 100-char cap → HTTP 422). It is now verified live against real PR **#1932** (per that commit message), not #1920. The follow-up card `backlog/3496-…` is **`status: active`**, i.e. still open. So the clause holds today only through an unresolved sibling card. |
| 3. "wired into `makeCliMechanicalPasses` so it runs on the standing headless-runner tick, with no separate cron/daemon" | `skills-src/conveyor/runner.mjs:267` `runQuiet('conveyor/parked-pr-conflict-watch.mjs', ['sweep'])`, immediately after the `branch-drift.mjs` line at `:261`; documented at `:186-192`. |
| 4. "`npm run check:standards` is 0 errors; the full `vitest` suite is green" | 1 unattributable pre-existing gate error; the full suite was not run in this pass (only the targeted files, all green). |

Caveats: (a) the live-verification clause was demonstrably not satisfied by this card's own commit and is carried by `active` #3496; (b) clause 4's "full vitest suite green" is unverified here.

---

## #1836 — epic: every plug public API functional unplugged — **PARTIAL**

Children by `parent: "1836"` edge (`grep -l 'parent: "1836"' backlog/*.md`) — 23 items:

resolved: 1837, 1838, 1839, 1840, 1841, 1842, 1843, 1844, 1845, 1846, 1856, 1857, 1858, 1859, 1860, 1872, 1887, 1888, 1889, 1890, 1899, 1900, 1926
**not resolved: 1901 — `status: parked`** (`parkedReason: maturityGated`, `maturityTrigger: "adoptionSignal: a real host needs to embed the workbench stage for UNTRUSTED/third-party blocks"`).

**The break.** The repo's own no-open-slice guard counts `parked` as open. `openChildrenOf` in `scripts/backlog.mjs:157-167`:

```js
const status = readField(content, 'status') || 'open';
if (status !== 'resolved') open.push({ num: idFromName(f), status });
```

and its docblock: *"Returns every child item whose `status` isn't `resolved`, so `resolve` can refuse to close an umbrella with live work under it."* `scripts/backlog/epic-resolve.mjs:71` — `if (s.openChildrenCount > 0) return { action: 'skip', reason: 'open-children' }`. So `resolve 1836` is refused today without `--force`, and `check:standards` mirrors the same rule (`scripts/check-standards.mjs:904`). **#1836 cannot be resolved while #1901 is parked.**

Everything else in `## Acceptance` does check out:

| acceptance clause | evidence |
|---|---|
| "`PLUG_UNPLUGGED_TEST_ENFORCED` is `error`" | `scripts/check-standards-rules.mjs:1791` `export const PLUG_UNPLUGGED_TEST_ENFORCED = true;` and `:1806` `if (PLUG_UNPLUGGED_TEST_ENFORCED) errors.push(...)`. Contract entry at `scripts/check-standards.contract.json:35`. |
| "doc-site parity table renders from a live registry and is covered by a drift gate" | #1844 resolved — page `src/plugs-parity.njk` → `/plugs/parity/`, fetcher `src/assets/js/plug-parity.js` over the #1890 cross-origin `_maas/parity/` route; drift gate is #1889. |
| "MaaS serves any component in plugged or unplugged form; the default served IR is unplugged" | #1841 + #1843 resolved (decision #1838 ratified). |
| "Each plug is consumable as its own npm package (pending decision #1)" | Re-decided, not skipped: #1837 upheld the monolith, so #1846 was reframed to subpath-export conformance and resolved with `graduatedTo: fui:plugs/package.json`. Legitimate re-scope, recorded on the child. |
| "Each workbench has a working plugged/unplugged toggle" | #1845 + #1900 resolved. |
| "The plugged-only residue is enumerated and minimal" | #1839 (bar) + #1887 (manifest seed) resolved. |

Verdict: substantively delivered, **blocked on one parked child**. Resolving it requires either unparking/closing #1901 or an explicit `--force` with the parked-child carve-out argued.

---

## #2305 — the lane-isolation guard exists only in web-everything — **PARTIAL**

All three `Done when` boxes are marked `[x]`. Two of them hold; the first does not, in this environment.

| clause (verbatim) | verdict |
|---|---|
| `- [x] An edit to any constellation primary is denied from any of the three repos and their lanes.` | **NOT MET here.** Ran the card's own status verb: `node scripts/guard-lane-install.mjs status` → **"guard-lane: NOT registered in /root/.claude/settings.json — run `install`"**. And the card's own "Verified" table still reproduces exactly: `/home/user/frontierui/scripts/guard-lane.mjs` — no such file; `/home/user/plateau-app/scripts/guard-lane.mjs` — no such file; neither repo has `.claude/settings.json`; `/root/.claude/settings.json` contains 0 occurrences of `guard-lane`. The only registration on disk is the **relative** one in `web-everything/.claude/settings.json:46` (`"command": "node scripts/guard-lane.mjs"`) — i.e. precisely the state the card opened against. So an edit to a constellation primary from a frontierui or plateau-app checkout proceeds unchecked in this environment. |
| `- [x] There is one source of the rule, not three copies that can diverge.` | **MET.** `scripts/guard-lane-install.mjs` exists (print / status / install / uninstall, backup + repair-rather-than-append), and `primaryGuardPath` derives the workspace root the same way the guard does, so a lane-local copy is never registered. One script, one registration point. |
| `- [x] The symlinked-lane case is either closed or recorded as accepted with its reachability stated.` | **MET.** Recorded in `scripts/guard-lane.mjs`'s `workspaceRootOf` doc comment and pinned by a regression test: `scripts/__tests__/guard-lane.test.mjs:66` `it('RESIDUAL (accepted, not reachable today): a symlinked lane leaf erases the .lanes segment and workspaceRootOf falls back to the wrong root')`, asserting `workspaceRootOf(asIfSymlinkedLane)` is `'/elsewhere'` and **not** `WORKSPACE`. Reachability argued from `lane-pool.mjs`'s `cloneLane`. |

**Why clause 1 fails.** What was delivered is an **installer**, plus a one-off machine-local `install` the card itself describes as having "went in accidentally — a shell-expanded backtick executed `install`". Nothing in the repo makes the registration true on a fresh checkout or a fresh machine, and the card openly books that residue as *"Still owed: gating **is it installed** in `check:standards`. Deliberately not done here — it would fail on any machine without the hook, including CI, and that trade needs its own decision."* That "still owed" is exactly what makes clause 1 a property of one operator's laptop rather than of the constellation. The box was ticked on the strength of a single machine's state, and this container disproves it. No follow-up backlog item for the check:standards gating was found.
