# Batch 03 — staleness audit (22 open cards, review/gate/drain cluster)

- ALREADY-DONE: 0
- SUPERSEDED: 0
- STALE-INFO: 13 (#2405, #2416, #2745, #2750, #2933, #3003, #3007, #3215, #3216, #3217, #3379, #3380, #3382)
- STALE-PREMISE: 0
- OK: 9 (#2999, #3002, #3231, #3255, #3375, #3376, #3377, #3381, #3393)

Cross-cutting: **#3321 is `resolved` (2026-08-27) while four of its children (#3379/#3380/#3381/#3382)
are still `open`** — a resolved parent over open slices. And **#3214 is `resolved`, so four cards that
carry `blockedBy: ["3214"]` (#3007, #3215, #3216, #3217) read as unblocked while the store they actually
depend on does not exist**; #3255's `Done when` item 5 already owns the retarget. Verified against
`/home/user/web-everything` @ `05e5f4c` (2026-09-06).

---

## #2405 — Harden and self-improve the PR-validation gate
- **verdict:** STALE-INFO + DEAD-REFS
- **confidence:** high
- **evidence:**
  - The card's body describes exactly two deliverables and **both are resolved children**:
    part (1) = `backlog/2406-gate-invariant-tripwires-hermetic-integration-tests-self-ref.md`
    (`status: resolved`); part (2) = `backlog/2408-close-session-surfaces-review-pr-flow-improvement-suggestion.md`
    (`status: resolved`). The suites it asks for exist:
    `/home/user/web-everything/scripts/lib/__tests__/gate-invariants.test.mjs` (676 lines) and
    `/home/user/web-everything/scripts/__tests__/gate-entrypoint-integration.test.mjs`.
  - DEAD-REF: the body's *"a self-reference in `GATE_SELF_PATHS` so only invariant changes still need a
    human"* names a symbol that **no longer exists**. It was replaced by the `TRUST_CHAIN` roster in
    `/home/user/web-everything/scripts/lib/gate-config.mjs` (#2448); the only surviving mention is the
    obituary comment at `gate-config.mjs:42` (*"Before this, the set was literal regexes buried in the
    scorer (`GATE_SELF_PATHS` …)"*).
  - The epic is nonetheless very much alive as an umbrella: 12 open children hang off it
    (#2416, #2745, #2750, #2999, #3002, #3003, #3007, #3215, #3216, #3217, #3231, plus active #2415)
    — none of which the two-part body describes.
- **suggested action:** edit card — rewrite the body to describe what the epic now umbrellas
  (gate/review/drain hardening broadly), record that its original two-part scope shipped as #2406 + #2408,
  and replace `GATE_SELF_PATHS` with `TRUST_CHAIN` / `gate-config.mjs`.

## #2416 — Gate: honor `review:accepted` only when a human applied it
- **verdict:** STALE-INFO
- **confidence:** medium-high
- **evidence:** The headline claim — *"DOCUMENTED POLICY WITH NO CODE ENFORCEMENT"* — is now materially
  false. INVARIANT 2 is enforced in code in at least four places:
  - `/home/user/web-everything/scripts/review-set-label.mjs:272-280` — `decideSetLabel` **refuses**
    `--to=accepted` on a `review:human` PR (*"gate-self: review:human is human-ceremony-only — clear via
    /review in a session"*); the docblock at `:28` states it as the invariant.
  - `/home/user/web-everything/scripts/lib/auto-land-seam.mjs:18,20,35-41` — *"A `review:human` PR is never
    laundered to accepted … in shadow OR enforce."*
  - `/home/user/web-everything/scripts/workflows/review-parked-prs.mjs:329,610,617,1372-1393` — the panel
    workflow re-fetches CURRENT labels and **drops** `review:human` / label-unverifiable PRs fail-closed.
  - `/home/user/web-everything/scripts/lib/__tests__/gate-invariants.test.mjs` — the #2406-style tripwire
    suite exists (and is itself `leash: 'spec'`, so editing it forces a human).
  - DEAD-REF: *"`decideReviewGate` (…~line 268)"* — `decideReviewGate` is now at
    `scripts/lib/review-escalation.mjs:2137` (the file grew to 174 KB); the accepted-first check is at `:2145`.
  - What genuinely REMAINS unbuilt: the specific *closed-set-of-callers* tripwire — an invariant test that
    scans every script in the repo asserting nothing else issues `gh pr edit --add-label review:accepted`
    against a `review:human` PR. No such repo-scanning test exists (checked every `readdirSync`/`globSync`
    test under `scripts/__tests__/` and `scripts/lib/__tests__/`), and `merge-ai-prs.mjs` still issues raw
    `gh pr edit … --add-label` at `:3343`, `:3378`, `:3906`, `:3957`, `:4099`.
- **suggested action:** edit card — narrow it to the residual (the repo-wide tripwire + single accept-mutation
  chokepoint), delete the "no code enforcement" framing, fix the `~line 268` reference. Note #2745 `blockedBy`s
  this card, so a rescope here unblocks that too.

## #2745 — A formerly-`review:human` PR must survive its human gate
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:**
  - The linchpin is genuinely unbuilt — `grep -rn "human-owed\|humanOwed\|human_owed" scripts/ skills-src/`
    returns **nothing**. The story is real work.
  - Stale: "Required fix" item 2's first half — *"Route the `/review` **changes** bounce through
    `decideSetLabel({to:'changes'})` … instead of a raw `gh pr edit` in `we:skills-src/review/SKILL.md`"* —
    **is already done**. `/home/user/web-everything/skills-src/review/SKILL.md:158` now reads
    *"**The label swap goes through `we:scripts/review-set-label.mjs`** — the single home (#2644)"*, and
    there is no raw `gh pr edit` label write left in that file.
  - All paths in `scope:` still exist (`scripts/conveyor/rearm-review.mjs`, `skills-src/review/SKILL.md`,
    `scripts/lib/review-escalation.mjs`, `scripts/merge-ai-prs.mjs`).
  - `blockedBy: ["2416"]` is still genuinely open, but see #2416 above — the dependency it names
    ("the human-applied-accept signal") is partly satisfied already.
- **suggested action:** edit card — strike the SKILL.md-raw-edit half of fix item 2 (delivered by #2644),
  leaving the durable marker (item 1), rearm re-derivation (item 2b), and the drain backstop (item 3).

## #2750 — `review:changes` must veto the merge (the drain landed a review:changes PR)
- **verdict:** STALE-INFO (heavily — this is the most out-of-date card in the batch)
- **confidence:** high
- **evidence:**
  1. **"Fix direction" bullet 3, the server-side belt, HAS SHIPPED.** The card asks for *"a required status
     check that fails while `review:changes` is present … so a non-drain / manual merge cannot bypass the
     client-side gate."* That is now
     `/home/user/web-everything/.github/workflows/review-gate.yml` + `scripts/check-review-gate.mjs`
     (+ `scripts/__tests__/check-review-gate.test.mjs`), whose header reads *"#2412 Layer 5 — a required
     status check that reads RED for as long as the PR carries an un-cleared review hold
     (`review:pending`/`review:changes`/`review:human`) … it exists to close the one hole the code-side gate
     can't see, a MANUAL `gh pr merge`."* `backlog/2412-*.md` is `status: resolved`, `dateResolved: 2026-09-04`.
     Caveat, stated in the workflow itself: the check name must be added to branch protection by a repo admin
     before it actually blocks — not verifiable from the repo.
  2. **The "Secondary contributing factor" is FIXED.** The card says the accept swap *"does **not** remove a
     pre-existing `review:changes`"*. `/home/user/web-everything/scripts/review-set-label.mjs:291-299` now
     returns `removeLabels: [REVIEW_LABELS.pending, REVIEW_LABELS.changes]` for `to === 'accepted'` — landed
     by #2974 (`status: resolved`, 2026-08-08), which is cited in the code comment at `:283-290`.
  3. **The `hasUnclearedReviewLabel` claim is half-fixed and half-reversed.** The card says it *"returns false
     once `review:accepted` is present"*. It now refuses `accepted + human` and `accepted + pending` first
     (`scripts/lib/review-escalation.mjs:1603-1636`), but `accepted + changes` is **deliberately NOT refused**
     — the comment at `:1629-1631` says *"#2974 RULED that the reviewer verdict wins over a stale bounce."*
     That is the exact reversal #3231 flags.
  4. **`REVIEW_HOLD_LABELS` + #2832** now single-source the hold family and strip `ready-to-merge` alongside a
     hold (`review-escalation.mjs:1651`, `review-set-label.mjs:334`) — bullet 2 of the fix direction.
  5. DEAD-REFS — every line reference in the card is dead: `decideReviewGate (~L520/L524/L529/L531-535)` →
     `review-escalation.mjs:2137/2145/…`; `hasUnclearedReviewLabel (~L461)` → `:1603`;
     `merge-ai-prs.mjs (~L1908, ~L1734-1743)` → the file is now 399 KB and those line numbers are unrelated;
     `review-set-label.mjs (~L90-95, ~L102-108)` → the accept branch is at `:291`, the changes branch at `:328`.
- **suggested action:** edit card and re-scope to the residual, then reconcile with #3231. Bullets 2 and 3 of
  "Fix direction" and the whole "Secondary contributing factor" section are delivered; bullet 1 ("checked
  alongside/before the `review:accepted` short-circuit") was ruled the OTHER way by #2974 and must be either
  retracted here or re-ratified. Realistically the card's remaining value is confirming branch protection
  actually requires the `review-gate` check.

## #2933 — Extend citation gate 3 to scan `scripts/` for dangling hash slugs
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - The build is still owed: `numberPendingHashes` in `/home/user/web-everything/scripts/lane-drain.mjs:612-645`
    sweeps `backlog/`, `docs/agent/` (#2428) and `agent-memory-src/` — **not** `scripts/`.
  - Stale evidence: the card's motivating example — *"PR #1049 alone leaves **13** `#2932` citations across
    `we:scripts/merge-ai-prs.mjs`, `we:scripts/lane-resume.mjs`, `we:scripts/conveyor/pr-watch.mjs` and their
    three test files"* — no longer holds. `#2932` appears **zero** times anywhere under `scripts/`
    (`backlog/2932-*.md` is `status: resolved`); those cites were evidently hand-repaired.
  - The class is much bigger than the card's number: intersecting every `#x……` slug cited under `scripts/`
    against every `bornAs:` in `backlog/` yields **70 dangling hash citations** today (e.g. `#x3q28ce` =
    #3007's `bornAs`, cited in `scripts/`; `#x9xqexm`, `#x169fqe`, `#xd6moh1`, `#xdompzx` in
    `scripts/lib/review-escalation.mjs` / `scripts/lib/jury-core.mjs` / `scripts/review-set-label.mjs`).
  - `blockedBy: ["2821"]` is still genuinely open.
- **suggested action:** edit card — replace the `#2932`/PR #1049/13-cites example with the current measured
  figure (70 dangling slugs under `scripts/`), which strengthens rather than weakens the case.

## #2999 — Codification shortcut: generate the statute edit, verify by regeneration
- **verdict:** OK
- **confidence:** high
- **evidence:** Arm A is unbuilt — `scripts/backlog.mjs:344-353` still passes `--codified-to` only into
  `applyTransition`, writing the **frontmatter** half (`status`/`dateResolved`/`codifiedIn`) and never the
  statute-doc half. `scripts/lib/rules-loader.cjs` exists as cited; #2771 and #2785 are both `resolved`
  (consistent with the card, which describes them as prior rulings it replaces).
- **suggested action:** none.

## #3002 — Command guard: deny unresolvable shell re-execution instead of enumerating positions
- **verdict:** OK
- **confidence:** high
- **evidence:** Still enumerating, still failing open on nested execution.
  `/home/user/web-everything/scripts/guard-bash.mjs:2147,2172` are the **only** `unparseableReason` call sites
  and both are gated on an unterminated quoted run — exactly the "one state" the card describes. The nested
  scanner at `:2184` is `withNestedCommands(segments, command)`, i.e. recursion into an enumerated position
  list, not a deny-on-unresolvable. The `codifiedIn` anchor resolves:
  `docs/agent/platform-decisions.md:94` `{#guard-unresolvable-reexecution-denies}`.
  `scripts/lib/lane-verify.mjs` exists as cited.
- **suggested action:** none.

## #3003 — Guard destructive git at the primary checkout
- **verdict:** STALE-INFO (minor)
- **confidence:** medium
- **evidence:**
  - The hole is real and still open: in `/home/user/web-everything/scripts/guard-bash.mjs`, the destructive-git
    branch is `if (!primaryCwd && isDestructiveLaneGitOp(s))` at `:1694`, and the lease context is only
    gathered `if (!primaryCwd && isLaneCwd(cwd) && hasDestructiveLaneOp(cmd))` at `:2324`. At `primaryCwd`
    only backlog mutations (`:1659`) and the main-session build nudge (`:1738`) fire — a
    `git reset --hard` at primary is still allowed. The table's "allowed" cell is accurate.
  - Stale statement: *"`we:scripts/guard-bash.mjs` … has no `reset` / `clean` / `restore` handling **at all**"*
    (§ "The coverage hole, verified"). It now has extensive handling — `isDestructiveLaneGitOp` at `:1362-1379`
    covers `reset --hard`, `clean -f[d]`, `checkout/restore/switch` discards and force-push, with
    lease-ownership denials at `:1692-1727` (#2367/#2413/#2997). The handling is scoped to lane clones, which
    is the point; but the sentence as written contradicts the card's own table row two lines above it.
  - All cited paths exist (`scripts/guard-lane.mjs`, `scripts/guard-bash.mjs`, `scripts/__tests__/guard-bash.test.mjs`).
- **suggested action:** edit card — change "no handling at all" to "no handling **at the primary checkout**;
  the existing `isDestructiveLaneGitOp` machinery is gated on `!primaryCwd`", and point Arm A at
  `guard-bash.mjs:1694` as the line to invert.

## #3007 — Make the review-verdict ledger the merge authority
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - The card's own "Still true, and unchanged by the slicing" claims **all three re-verify today**:
    `ledgerCoversHead` is defined at `scripts/lib/verdict-ledger.mjs:579` and referenced nowhere outside its
    own module; `scripts/lib/pr-merge-gate.mjs` contains **zero** occurrences of "ledger";
    `summarizeAgreement().phase2Safe` is `counts.disagree === 0 && counts.unledgered === 0`
    (`verdict-ledger.mjs:740`). The card is factually excellent.
  - Stale: `blockedBy: ["3214", "3215", "3217", "3216"]` — **#3214 is `resolved`** (2026-08-20,
    `codifiedIn: docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates`). It should name
    **#3255** instead, which is the unbuilt deliverable that decision ruled and which says so explicitly in
    its own `Done when` item 5: *"#3007, #3215, #3216 and #3217 name THIS item in `blockedBy` instead of
    resting on the resolved decision."*
- **suggested action:** edit card — swap `"3214"` for `"3255"` in `blockedBy` (or land #3255, which does it).

## #3215 — Ledger the holds the drain applies itself
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Body claims verify: `applyLabel` holds in `scripts/merge-ai-prs.mjs` are unledgered (the only
    `appendVerdict` callers are `scripts/review-set-label.mjs:808` and
    `scripts/operations/review-pr-io.mjs:519`); `scripts/review-ledger-check.mjs:141-145` still prints the
    dedicated `unledgered` line with the "OWED BEFORE PHASE 2" banner;
    `summarizeAgreement().phase2Safe` is as quoted (`verdict-ledger.mjs:740`).
  - Stale: `blockedBy: ["3214"]` — #3214 is `resolved`. The real blocker is #3255 (see #3007 above).
- **suggested action:** edit card — retarget `blockedBy` to `"3255"`.

## #3216 — Revisit the ledger write-miss posture before the authority moves
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Body claims verify: the fail-soft append is still in place —
    `scripts/lib/verdict-ledger.mjs:827` `const raw = locked ? record : { ...record, unlocked: true };`,
    documented at `:85-86` and `:805`.
  - Stale (two, coupled): `blockedBy: ["3214"]` names a **resolved** item; and the card's own hinge — *"Which
    way it should go depends on where the ledger ends up living … so this follows the home decision rather
    than pre-empting it"* — no longer describes an open question. #3214 ruled option A′ on 2026-08-20 and it
    IS codified; the home is the `ops/review-requests` git transport, i.e. the card's own "a git transport
    that either pushes or errors" branch. The posture question is now answerable, and the real dependency is
    the unbuilt #3255.
- **suggested action:** edit card — retarget `blockedBy` to `"3255"` and rewrite the closing paragraph to say
  the home is decided (git transport) so the posture can be chosen now.

## #3217 — The shadow reviewer must append its would-clear decisions to the verdict ledger
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:**
  - The core ask is still owed: neither `scripts/review-runner.mjs` nor `scripts/lib/review-runner-core.mjs`
    imports `verdict-ledger.mjs` or calls `appendVerdict` — the only two `appendVerdict` callers remain
    `review-set-label.mjs:808` and `review-pr-io.mjs:519`.
  - Stale: *"only logs that to stderr, so the agreement history the enforce flip needs is **never recorded
    anywhere durable**."* That is no longer true. `#3008` (`status: resolved`, `dateResolved: 2026-08-19` —
    i.e. the day **before** this card was opened) made `scripts/converge-daemon-pass.mjs` persist the shadow
    records: `buildPassRecord` at `:118-146` carries `wouldClear`, `wouldKeepParked` and a per-PR
    `records: [{subject, pr, repo, wouldClear, reason}]` array, appended at `:295` to
    `<stateRoot>/shadow.jsonl` (`:81`) — a HOME-anchored file that survives `reset --hard` (`:54`). The
    record's own comment at `:126-129` states the honest limit: *"this log is NOT yet the `reviewShadowLedger`
    #2838's `enforceFlipReady` reads, and does not feed `computeAgreementMetric` in its current shape (no
    `match`/`outcome` per record) — that durable ledger is #2893's job."*
  - Stale: `blockedBy: ["3214"]` — resolved; real blocker is #3255.
- **suggested action:** edit card — replace "never recorded anywhere durable" with "recorded only in the
  converge daemon's own `shadow.jsonl` (#3008), in a shape that cannot be compared against human verdicts",
  cross-link #2893, and retarget `blockedBy` to `"3255"`.

## #3231 — A later item silently overruled #2750's ruled fix on the accept branch
- **verdict:** OK
- **confidence:** high
- **evidence:** Confirmed live and still unreconciled.
  `scripts/review-set-label.mjs:291-299` — the plain `accepted` branch **strips**
  `[pending, changes]`, citing #2974. `scripts/lib/review-escalation.mjs:1629-1631` — `accepted + changes`
  is explicitly **not** refused, *"#2974 RULED that the reviewer verdict wins over a stale bounce."*
  Meanwhile #2750 is still `open` with its "Fix direction" bullet 1 (check `changes` before/alongside the
  `accepted` short-circuit) unretracted, and #2974 is `resolved` with no reversal note on either card.
  Interesting wrinkle the card does not yet record: the **re-stamp** branch at `:252-262` DOES refuse,
  with a stated distinction (*"`accepted` strips a stale `changes` because a reviewer just decided; a
  re-stamp decides nothing"*) — so the reconciliation the card asks for may already exist as a code comment
  and only need lifting onto both cards.
- **suggested action:** none (work it — and note the `:252-262` re-stamp refusal as the drafted rationale).

## #3255 — Move the verdict ledger onto the ops/review-requests git transport
- **verdict:** OK
- **confidence:** high
- **evidence:** `verdictLedgerDir()` at `scripts/lib/verdict-ledger.mjs:768` still returns the machine-global
  `~/.claude/verdict-ledger` (documented at `:749`), and `verdictLedgerPath(repo)` at `:795` joins it —
  exactly as the card states. The `#2626` amendment is codified
  (`docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates`, #3214 resolved). Every path in
  the long `scope:` list that I sampled exists. The refusal it quotes from `review-set-label.mjs` (*"an orphan
  row in the merge authority is NOT inert"*) is still in that file.
- **suggested action:** none — this is the unblocking item for #3007/#3215/#3216/#3217 and should be
  prioritised accordingly.

## #3375 — A reviewer may answer "unverifiable as submitted"
- **verdict:** OK
- **confidence:** high
- **evidence:** Unusually well-cited and every citation I sampled is byte-current against
  `/home/user/web-everything/scripts/lib/jury-core.mjs`: `DISPOSITIONS` `:284`; `deriveFindingDisposition`
  `:318`; `IMPACT_LEVELS` `:197`; `PREVENTION_IMPACT_BAR` `:264`; `EVIDENCE_KINDS` `:653`;
  `EVIDENCE_STRENGTH` `:665`; `EVIDENCE_GLOSS` `:675`; `isReproCommand` `:760`; `classifyFindingEvidence`
  `:783`; `admitFindingsByEvidence` `:839`; `deriveVerdict` `:895`; `deriveNegotiationOutcome` `:1030`;
  `buildSubjectMandate` `:1944`. Supporting artifacts all exist:
  `reports/2026-08-27-creator-owed-proof-burden-shift.md`,
  `src/_data/researchTopics/creator-owed-proof-not-reviewer-rederivation.json`,
  `scripts/operations/mutation-check.mjs`. Related items #3312/#3341/#3354/#3362 all resolve.
- **suggested action:** none — ready to ratify (`preparedDate: 2026-08-27` already set).

## #3376 — Three review-gate constants escaped the policy contract
- **verdict:** OK
- **confidence:** high
- **evidence:** Both defects re-verify.
  Defect 1: `scripts/lib/jury-core.mjs` is **absent from `TRUST_CHAIN`**
  (`scripts/lib/gate-config.mjs:99-405` lists 27 members; jury-core is not one), so
  `PREVENTION_IMPACT_BAR` (`jury-core.mjs:264`), `MANDATORY_LENSES` (`:1137`) and `EVIDENCE_FLOOR` carry no
  policy tier. `RATIFIED_POLICY_SPEC_FLOOR` at `gate-config.mjs:431-436` is the four basenames the card names.
  Defect 2: `scoreEscalation` still merges caller thresholds —
  `scripts/lib/review-escalation.mjs:585,589` `thresholds = {}` … `const t = { ...DEFAULT_THRESHOLDS, ...thresholds }`;
  `scripts/review-core-cli.mjs:183,201,283` still takes `mandatoryLenses` straight from caller JSON into
  `derivePanelVerdict`. The retraction's own backstop citation is exact:
  `scripts/lib/__tests__/review-policy.conformance.test.mjs:56` imports `panelRigorForCareLevel, PANEL_LENSES`
  from `../jury-core.mjs`, and `:628` is the band-conformance `it(...)` pinning lenses/jurorsPerLens/roundCap.
  `researchTopics/review-system-lever-catalogue.json` exists.
- **suggested action:** none.

## #3377 — Seating a variable-N scoped panel
- **verdict:** OK
- **confidence:** high
- **evidence:** All three "facts from the tree" hold.
  `STEP_KINDS` is still closed at four — `scripts/operations/step-kinds.mjs:36`
  `Object.freeze(['compute', 'judge', 'confirm', 'effect'])`. Every cited file exists
  (`engine.mjs`, `judge-panel.mjs`, `cli-adapter.mjs`, `review-policy.contract.json`, `jury-core.mjs`,
  `skills-src/jury/subject-jury.workflow.js`). `blockedBy: ["3158"]` is still open; `#3326` still open;
  `#3050` and `#3031` are `resolved` exactly as the card describes them (built-and-unwired / ratified statute).
- **suggested action:** none.

## #3379 — check:standards' stranded-hash rule cannot be fixed through a normal PR
- **verdict:** STALE-INFO
- **confidence:** medium
- **evidence:**
  - Substance stands: `strandedHashesOnMain` reads `origin/main` via
    `execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'backlog/'])` and the whole
    block is wrapped in a fail-soft `try/catch` whose comment is the one the card quotes.
  - DEAD-REFS — all three line citations have drifted:
    `we:scripts/check-standards-rules.mjs:2218` → `strandedHashesOnMain` is exported at **`:2391`**;
    `we:scripts/check-standards.mjs:550` → the `ls-tree` call is at **`:553`**;
    `we:scripts/check-standards.mjs:553` (the fail-soft catch) → **`:584`**.
  - Unmentioned partial mitigant: `#2956` already downgrades a hash-led file *touched within the drain's own
    JIT-numbering window* from error to warning (`check-standards.mjs:555-574`, the `commitTimeFor`
    `--first-parent` probe). It does not close the chicken-and-egg outside that window, so finding 2 survives —
    but the card reads as if no exemption machinery exists, and any implementer should start from `#2956`'s
    shape for the "exempt a PR whose diff strictly reduces the stranded set" option in `Done when` 3.
  - Parent `#3321` is `resolved` while this child is open.
  - Its own filename is now correctly numbered (`3379-…`), so finding 3's example has self-healed.
- **suggested action:** edit card — fix the three line refs and add a sentence on `#2956`'s existing in-flight
  window as the precedent for `Done when` 3.

## #3380 — Targeted coverage floor on the sole-writer drain files
- **verdict:** STALE-INFO (minor)
- **confidence:** high
- **evidence:**
  - Substance stands: `/home/user/web-everything/vitest.config.ts` `coverage.include` (`:27-56`) lists only
    standards/impl planes — `scripts/` and `tools/` are absent — and `coverage.thresholds` (`:70-75`) is a flat
    global `lines/functions/branches/statements: 80` with **no per-file or per-glob entry** for
    `scripts/merge-ai-prs.mjs`, `scripts/lane-drain.mjs`, `scripts/pr-land.mjs`, `scripts/verify-lane.mjs`
    (all four files exist). No inverted `untested-export` scan exists (the only `test-only-export` machinery is
    the existing forward scan in `scripts/check-standards-rules.mjs` + its lock test).
  - DEAD-REF: the card cites `we:vitest.config.ts:29-35` for the "build tooling, mostly .mjs" exclusion
    comment; that comment is now at **`:19-26`** (the `~68%` measurement line is `:23-24`).
  - Parent `#3321` is `resolved` while this child is open.
- **suggested action:** edit card — change `vitest.config.ts:29-35` to `:19-26`.

## #3381 — A headless one-shot reviewer cannot wait for a completion notification
- **verdict:** OK
- **confidence:** medium
- **evidence:** The suspend/hand-back protocol the card objects to is still exactly as described:
  `scripts/operations/run.mjs:14-15` documents `review-pr --resume=<run-id> --answer=…` as the caller's
  come-back step, and `scripts/operations/review-pr.mjs:1205-1206` states *"DECLARES the juror call in
  `judgeSpawn`'s option shape (#3028) and spawns NOTHING: the engine suspends and the caller does the spawn
  between two `advance` calls."* So a headless one-shot caller still meets a "still running, come back later"
  state. `scripts/verify-lane.mjs` (the sibling synchronous pattern it points at) exists. Minor wording nit
  only: the card says review-pr *"runs the juror's gates in the background"*, whereas the engine actually
  suspends and the **caller** does the spawn — same consequence for a one-shot process, different mechanism.
  Parent `#3321` is `resolved` while this child is open.
- **suggested action:** none (optionally sharpen the "runs in the background" phrasing to "suspends and hands
  the spawn back to the caller").

## #3382 — Stacked warn-and-continue points on the land path compound into silent strands
- **verdict:** STALE-INFO
- **confidence:** high
- **evidence:**
  - Substance stands: `landDegraded` (or any equivalent collector) appears **nowhere** in `scripts/`; the two
    warn-and-continue points are still independent and unlinked.
  - DEAD-REFS — every line citation has drifted (`merge-ai-prs.mjs` is now 399 KB):
    `we:scripts/merge-ai-prs.mjs:4220` (the *"local main NOT fast-forwarded (diverged, or a reapplied local
    edit conflicts) — reconcile by hand"* line) → **`:4462`**;
    `we:scripts/merge-ai-prs.mjs:4223-4240` (the `resyncDetachedCwdForLand` call site) → **`:4468-4472`**;
    the function itself is defined at **`:2857`**. The numbering step is at `:4514-4532`.
  - Parent `#3321` is `resolved` while this child is open.
- **suggested action:** edit card — refresh the three line refs (`:4462`, `:4468-4472`, and add
  `resyncDetachedCwdForLand` at `:2857`).

## #3393 — review-pr cannot seat the claim-accuracy lens
- **verdict:** OK
- **confidence:** medium-high
- **evidence:** `PANEL_LENSES` is still `[...MANDATORY_LENSES, ...ADVISORY_LENSES]`
  (`scripts/lib/jury-core.mjs:1181`, mandatory pair at `:1137`), and `scripts/operations/review-pr.mjs` still
  declares exactly two `judge` steps whose lens set is read back at `:1650`
  (`declaration.steps.filter((s) => s.step.kind === 'judge')`) — so `Done when` 2 ("a lens set that is not
  hard-coded to two members") is unmet. The PR #1569 counter-evidence the card cites at `jury-core.mjs:713` is
  present (`:712-713`, *"the `claim-accuracy` juror found a real test defect TWO ROUNDS before anyone else"*).
  Related items #3319/#3335/#3344 are all `resolved`, consistent with the card's framing.
  One nuance worth adding rather than a staleness defect: `--lens=claim-accuracy` **substitutes** into the
  first (caller-chosen) seat rather than adding a third (`review-pr.mjs:207-211, 239, 1061-1062` —
  *"IT SUBSTITUTES, IT DOES NOT ADD (#3344)"*), so the lens can technically sit today at the cost of dropping
  `correctness`. The card's *"structurally could not sit"* is true for **adding** it, not for seating it at all.
- **suggested action:** edit card (optional) — one sentence noting the #3344 substitution path exists, so
  `Done when` 1 must assert claim-accuracy seats *in addition to* the mandatory pair, not merely that a juror
  for it runs.
