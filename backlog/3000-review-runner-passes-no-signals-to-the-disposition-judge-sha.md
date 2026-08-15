---
bornAs: x9ns6bc
kind: story
size: 3
parent: "2572"
status: open
dateOpened: "2026-08-08"
tags: [review, review-runner, disposition-judge, shadow-mode, gate-self]
scope:
  - we:scripts/review-runner.mjs
  - we:scripts/lib/review-runner-core.mjs
  - we:scripts/__tests__/review-runner.test.mjs
  - we:scripts/lib/__tests__/review-runner-core.test.mjs
---

# review-runner passes no signals to the disposition judge — shadow log never exercises the gate-self/human-required/non-convergence hard invariants

`runShadowPass` (`we:scripts/review-runner.mjs:181`) calls `runnerShadowPlan` with no `signals`, so `proposeDisposition`'s HARD INVARIANT step (gate-self / human-required / non-convergence) never fires — the shadow log records what a clean panel verdict alone would do, not what the real (future-enforcing) gate would do on a gate-self PR.

## The gap

`runShadowPass` (`we:scripts/review-runner.mjs:181`):

```js
const { intent, plan } = runnerShadowPlan({ ledger, config, currentLabels: item.labels });
```

passes no `signals`. `runnerShadowPlan` (`we:scripts/lib/review-runner-core.mjs:101`) defaults it to `{}` and forwards straight through to `decideDispositionLabel` on the next line:

```js
export function runnerShadowPlan({ ledger = [], config, signals = {}, mandatoryLenses, currentLabels = [] } = {}) {
  const intent = decideDispositionLabel({ ledger, config, signals, mandatoryLenses, currentLabels });
```

`decideDispositionLabel` (`we:scripts/lib/disposition-land-seam.mjs`) hands `signals` straight to the judge, `proposeDisposition` (`we:scripts/lib/disposition-judge.mjs:229`), whose own default is again `{}`:

```js
export function proposeDisposition({ ledger = [], config, signals = {}, mandatoryLenses = MANDATORY_LENSES } = {}) {
  ...
  // 1 — HARD INVARIANT + caller-supplied hard escalates (checked BEFORE the ledger; no verdict overrides them).
  if (signals.gateSelf) { return escalate('gate-self', …); }               // we:scripts/lib/disposition-judge.mjs:243
  if (signals.humanRequired) return escalate('human-required', …);         // we:scripts/lib/disposition-judge.mjs:246
  if (signals.nonConvergence) return escalate('non-convergence', …);       // we:scripts/lib/disposition-judge.mjs:247
```

With `signals` absent end-to-end, all three read `undefined` and none fire. **Every shadow disposition the runner logs is computed as if the PR were never gate-self, never a #2285 conflict-of-interest, and never a round-cap deadlock** — the exact three cases `proposeDisposition`'s own header says are "checked BEFORE the ledger; no verdict overrides them."

## Why it matters

The runner is forced-shadow by construction: `runnerShadowPlan` hard-codes `LAND_MODES.SHADOW` (`we:scripts/lib/review-runner-core.mjs:106`) and the CLI refuses `--enforce` (`we:scripts/review-runner.mjs:197-200`), so `plan.apply` is always `false` — **nothing is mis-merged today**. The damage is upstream of merging: the shadow log is the evidence #2572's shadow→enforce flip will be judged against (see the #2754 agreement-streak metric in `we:scripts/lib/decision-routing.mjs`, the sibling mechanism for the decision-flow analog). On a gate-self PR the shadow log will record `auto-dispose` where the real (enforcing) gate is *structurally incapable* of doing anything but escalate. A shadow run that cannot reproduce the one decision it exists to validate cannot support the conclusion it's built to support — and per `we:scripts/lib/gate-config.mjs:221-222`, `we:scripts/lib/review-runner-core.mjs` is *itself* registered `leash: 'spec'` (declarative-leash, policy tier), so this exact defect sits in a file the runner would misjudge about itself.

## Verification (this defect was re-derived from source, not taken on trust)

- All line numbers above were re-read directly and confirmed current as of this filing (2026-08-08).
- **The `clearable` items `runShadowPass` iterates carry only `{pr, repo, labels}`** — `discoverPending`/`lookupLabels` (`we:scripts/review-runner.mjs:94-133`) call `gh pr list`/`gh pr view` with `--json number,labels` only; no changed-files, diff-lines, dismissed-findings, or cross-repo data is ever fetched. So **the signals cannot simply be threaded through from data already in hand — they must be newly derived**, and the two escalate families need different derivations:
  - `gateSelf` / `humanRequired` need the PR's changed-file set, which the runner does not currently fetch at all. The existing `scoreEscalation` (`we:scripts/lib/review-escalation.mjs:300`) already computes exactly this (`leashFiles`/`statuteFiles` → `humanRequired`, via `isDeclarativeLeashPath`/`isStatutePath`) from a `changedFiles` array — it is the reusable seam, but a diff-files fetch (e.g. `gh pr view --json files` or `gh pr diff --name-only`) has to be added to the runner first.
  - `nonConvergence` (a #2311 round-cap deadlock) is in principle derivable from the ledger already being read (`NEGOTIATION_ROUND_CAP = 5` in `we:scripts/lib/jury-core.mjs:538`, compared against the ledger's `maxRound`), but no existing helper exposes that as a boolean — `reduceLedger`/`summarizeLedger` (`we:scripts/lib/disposition-judge.mjs:81`, `we:scripts/lib/review-runner-core.mjs:116`) report `rounds`/`lensVerdicts` but not "hit the cap without an accept." This is new derivation logic, not a wire-through.
- No unit test in `we:scripts/__tests__/review-runner.test.mjs` or `we:scripts/lib/__tests__/review-runner-core.test.mjs` references `signals` at all — the gate-self/human-required/non-convergence branch of the shadow path is not just unfixed, it is also completely unexercised by the existing suite.
- Checked `we:scripts/lib/gate-config.mjs` (lines 197-230): it registers `we:scripts/lib/review-runner-core.mjs` and `we:scripts/review-runner.mjs` as `leash: 'spec'` — declarative-leash, policy tier — with the stated rationale that `runnerShadowPlan`'s forced-shadow constant "decides what clears the gate." A fix here therefore lands inside the leash file set and should be expected to escalate to `review:human` at PR time; this is **noted as an expectation, not treated as a blocker**.
- Searched the backlog for a prior filing of this exact gap (`runnerShadowPlan`, `proposeDisposition`, `gate-self`). Found #2830 (parent epic), #2864 (a *different*, already-resolved #2830-review finding: ledger-freshness binding, M4), and #2867 (the #2830 review's deterministic check:standards guards, none of which cover this). No existing item names the missing-signals gap; this is a fresh finding, not a duplicate.
- **My own read CONFIRMS the diagnosis as given — nothing in it was contradicted.** The one correction worth recording: the task's line citation for `proposeDisposition` was `we:scripts/lib/disposition-judge.mjs:227`, which is the `@returns` JSDoc line immediately above the function; the function's actual code line (and the `signals = {}` default) is `we:scripts/lib/disposition-judge.mjs:229`. Cited as `:229` above.

## What this is NOT

This is **not a live merge hole**. `runnerShadowPlan` is hard-coded to `LAND_MODES.SHADOW` and `plan.apply` is always `false` — no PR is merged, no label is written, nothing mutates as a result of this defect today. The bug is entirely in what the shadow *log* would claim about a gate-self PR while the runner remains observe-only; it becomes load-bearing only once (if) the shadow→enforce flip for this runner is proposed, at which point the current code would let a gate-self PR through auto-dispose in reality, not just on paper.

## Acceptance criteria (original filing)

- `runShadowPass` (or `runnerShadowPlan`'s caller) derives real `signals.gateSelf` / `signals.humanRequired` from the PR's actual changed-file set (fetched fresh, not inferred from labels), reusing `scoreEscalation` / `isGateSelfPath` rather than re-deriving the leash/statute path rules.
- `signals.nonConvergence` is derived from the ledger already being read (a round-cap deadlock with no accept verdict), not left `undefined`.
- A shadow-log record for a synthetic gate-self PR (leash-file diff, otherwise-clean unanimous-accept ledger) now shows `disposition: escalate`, `reason: 'gate-self'` — proving the hard invariant fires in shadow, not just in the judge's own unit tests.
- Equivalent coverage added for `humanRequired` (statute-path diff) and `nonConvergence` (round-cap-exhausted ledger) shadow records.
- `we:scripts/__tests__/review-runner.test.mjs` and/or `we:scripts/lib/__tests__/review-runner-core.test.mjs` gain tests exercising all three signals end-to-end through `runShadowPass`/`runnerShadowPlan`, not just through `proposeDisposition` directly.
- No change to `runnerShadowPlan`'s forced-`LAND_MODES.SHADOW` or the CLI's `--enforce` refusal — this item is scoped to making the shadow log accurate, not to arming enforcement.

## Cross-references

- Parent epic: #2572 (wire the scheduled converge-and-label runner).
- Sibling #2830-review finding, same shape: #2864 (ledger-freshness binding before the enforce flip) — filed, not fixed, per the same "design gap the shadow's fail-closed behaviour keeps non-blocking" reasoning.
- `we:scripts/lib/gate-config.mjs` — leash-defining policy-tier registration for the files this fix touches.
- **Same call site, filed separately (2026-08-08, PR #1113 review):** #3009 — `runShadowPass` also
  passes no `authorId`/`clearerId` to `runnerShadowPlan`, which matters once PR #1100 (#2844) lands and
  adds a self-clear-refusal rail keyed on those ids. Not folded into this item: that fix needs
  `authorId`/`clearerId` to exist as `runnerShadowPlan` parameters at all, which only PR #1100 adds —
  this item's `signals` fix needs nothing that isn't already on `main` today. Merging them would either
  force an unwanted `blockedBy` onto this item's already-actionable fix, or leave part of a merged item's
  acceptance criteria structurally unclosable until #1100 lands. Same scope files
  (`we:scripts/review-runner.mjs`, `we:scripts/lib/review-runner-core.mjs`), so the two should not be
  worked concurrently — the dispatcher's scope-overlap hold covers that.
- Related, different file, same review pass: #3008 — the converge daemon's persisted `shadow.jsonl`
  (`we:scripts/converge-daemon-pass.mjs`, shipped by PR #1113, not yet on `main`) drops per-PR detail and
  cannot feed the ratified `computeAgreementMetric` gate (#2838) in its current shape either.

---

## Preparation (2026-08-15)

### Scope + consumers, verified

The four declared `scope:` files are the complete blast radius. Swept both ways:

- **ES importers of `we:scripts/lib/review-runner-core.mjs` / `we:scripts/review-runner.mjs`** — grepped every
  `.mjs` file repo-wide. Real importers are exactly `we:scripts/review-runner.mjs` (imports the core) and the
  two test files. Every other hit is a `backlog/*.md` cross-reference or a `we:scripts/lib/gate-config.mjs` /
  `we:scripts/lib/__tests__/gate-invariants.test.mjs` TRUST_CHAIN roster **string literal** (the roster's `file`
  field, which names entries by bare basename) — a registry entry, not a call; it matches by basename so no
  roster edit is needed here.
- **Subprocess callers** — grepped for `we:scripts/review-runner.mjs` in `.yml`/`.json`/`.sh` and found none
  directly, but `we:scripts/converge-daemon-pass.mjs` shells it: `buildRunnerArgv` builds
  `['we:scripts/review-runner.mjs', '--json', …]` (`we:scripts/converge-daemon-pass.mjs:107`), and
  `we:scripts/converge-daemon-pass.mjs:261` runs it via `spawnSync(process.execPath, buildRunnerArgv(cfg), …)` —
  **corrected during independent review**: an earlier draft of this paragraph mis-cited this as an
  `execFileSync` call at line 107; it is `spawnSync` at line 261, with line 107 only building the argv array.
  This is the item's one real external consumer. It only reads the runner's `--json` stdout — it never imports
  `runShadowPass` or touches its signature — so the fix flows to it automatically once `main()` (the CLI entry)
  is wired to derive real signals. **No change needed in `we:scripts/converge-daemon-pass.mjs`**, confirmed by
  reading its call site, not assumed.
- **Direct callers of the four functions this item touches** (`runShadowPass`, `runnerShadowPlan`,
  `buildShadowRecord`, `partitionRunnerPRs`) — grepped by function name repo-wide. Same two files plus the two
  `we:scripts/lib/gate-config.mjs` comment mentions (prose, not calls). Confirmed closed.

### Size — 3, basis stated

One new ~15-line pure function (`deriveRunnerSignals`) reusing three already-imported/importable primitives
(`scoreEscalation`, `reduceLedger`, `NEGOTIATION_ROUND_CAP`), one new ~12-line impure seam function
(`loadChangedFilesFromGh`, the same `gh pr view --json files` → `.path` pattern already shipped at
`we:scripts/merge-ai-prs.mjs:3216`), a one-parameter signature extension on an existing function with a
backward-compatible default, and test additions in the two existing suites. No new files, no cross-repo touch,
no schema/contract change. Comparable in shape to other already-shipped single-seam wiring items in this
backlog.

### De-risking done during prep (checklist item 8)

Two real gotchas were found by reading the actual call graph before design, not left for the build to
discover:

1. **The obvious wiring point silently drops the new data.** The natural place to attach a PR's changed-file
   list looked like `discoverPending`/`lookupLabels` (`we:scripts/review-runner.mjs:99-134`), extending their
   `gh --json number,labels` calls to `number,labels,files` (confirmed `files` is a valid field for both `gh pr
   list` and `gh pr view` via `gh pr list --json bogus` field-listing). **But** those discovered items flow
   through `partitionRunnerPRs` → `partitionAgentClearable` (`we:scripts/lib/review-escalation.mjs:791-804`),
   which **reconstructs** each clearable entry as `{ pr, repo, labels: item.labels }` — any other field
   (`changedFiles`) would be silently dropped before it ever reached `runShadowPass`. `partitionAgentClearable`
   is also single-sourced with the convergence workflow's own filter (its docstring says so explicitly), so
   widening its output shape would touch a shared function **outside this item's declared scope** for a
   cosmetic convenience. **Decided:** don't touch the discover/partition path at all. Fetch changed files
   **inside `runShadowPass`**, per clearable item, via a new injectable seam — mirrors the existing `loadLedger`
   seam exactly (same function, same fail-closed-per-PR-try/catch shape) and stays entirely inside this item's
   four files.
2. **A live-`gh` default would silently make the existing unit tests network calls.** `runShadowPass`'s existing
   `loadLedger` parameter defaults to `loadLedgerFromDurableLog`, which is safe to leave as a default because it
   is a **filesystem** read that fails closed to `[]` for a nonexistent PR. The changed-files seam's real
   implementation is a **network** call (`gh pr view`). If the new fourth parameter defaulted to the real `gh`-
   shelling function, the three existing tests in `we:scripts/__tests__/review-runner.test.mjs` — which call
   `runShadowPass(clearable, CONFIG, loadLedgerFn)` with only three arguments — would start shelling to `gh`
   for PR numbers `974`/`975`/`1`/`2` against `chalbert/web-everything` on every `vitest run`, a flaky,
   slow, and unintended-network-access regression discovered by reading the test file, not assumed. **Decided:**
   the new fourth parameter's *default* is a safe no-op (`() => []`, never touches the network) — mirroring the
   already-established "callers that don't opt in keep prior behaviour" pattern used elsewhere in this module
   (e.g. `we:scripts/review-runner.mjs:176`'s own `loadLedger` default). Only the CLI's `main()` explicitly wires
   the real `gh`-backed loader. The three existing tests are therefore expected to keep passing **unmodified** —
   that is itself part of Done-when below, not an assumption.

### Decided design

**Signal derivation is a new pure function in `we:scripts/lib/review-runner-core.mjs`, called by `runShadowPass`
in `we:scripts/review-runner.mjs` before it invokes `runnerShadowPlan`.** `runnerShadowPlan` itself is
unchanged — it already accepts a `signals` parameter (`we:scripts/lib/review-runner-core.mjs:107`), which has
simply never been supplied by its one real caller. No new fork here: this is the seam the original filing
already named ("`runShadowPass` (or `runnerShadowPlan`'s caller) derives real `signals…`").

**`gateSelf` / `humanRequired` mapping — reuse `scoreEscalation`, and use its *existing* two-field split
directly rather than re-deriving a distinction.** `scoreEscalation` (`we:scripts/lib/review-escalation.mjs:542`)
already separates the leash-only signal from the broader human gate:

- `score.signals.gateSelf` is set **only** when the diff touches a declarative-leash file
  (`isDeclarativeLeashPath` / `POLICY_SPEC_BASENAMES` — the machine-diffable contract, the roster, the
  invariant/conformance suites).
- `score.humanRequired` (top-level) is `true` when the diff touches a leash file **or** a statute file
  (`isStatutePath` — `we:docs/agent/platform-decisions.md` or any `docs/agent/*statute*` doc) — i.e. it is the
  broader #2285 conflict-of-interest flag, confirmed against the `#2285` cross-references in
  `we:scripts/lib/jury-core.mjs:60`, `we:scripts/lib/review-core.mjs:489-523`, and
  `we:scripts/lib/review-escalation.mjs:56` (`review:human`'s own label description: "The diff edits the gate
  policy or the statute layer — only a human may clear it (#2285…)").

`proposeDisposition` (`we:scripts/lib/disposition-judge.mjs:243-247`) checks `signals.gateSelf` **before**
`signals.humanRequired`, so setting `humanRequired: score.humanRequired` (true for leash **or** statute) is safe
even though it overlaps `gateSelf`'s true cases: a leash-file diff is caught by the `gateSelf` branch first and
reports the more specific `'gate-self'` reason; a statute-only diff falls through to the `humanRequired` branch
and correctly reports `'human-required'`. This is exactly `scoreEscalation`'s own established shape — no new
path-matching logic is written; `deriveRunnerSignals` only reads two fields off `scoreEscalation`'s return.

**`nonConvergence` is new derivation, not a wire-through — confirmed no existing helper exposes it.**
`proposeDisposition` never imports `NEGOTIATION_ROUND_CAP` (checked its import list,
`we:scripts/lib/disposition-judge.mjs:35-41` — only `we:scripts/lib/jury-core.mjs`'s verdict-strictness
helpers) and `reduceLedger`'s output (`ReducedLedger`) carries `maxRound` but no cap comparison. The ledger
event stream itself has no explicit "round-cap-exhausted" event (`JURY_EVENT_TYPES`,
`we:scripts/lib/jury-core.mjs:914-920`, has only `roster-picked` / `juror-running` / `finding` / `verdict` /
`round-advanced` — no outcome/escalate event), so a deadlock is only visible by **comparing** the round count to
the cap, which is exactly what disposition-judge's own doc comment says the caller must detect
(`we:scripts/lib/disposition-judge.mjs:209`: "a #2311 round-cap deadlock **the caller detected**").
`deriveRunnerSignals` computes it as: the ledger's round count (`maxRound + 1`, reusing `reduceLedger`, the same
0-based→1-based convention `summarizeLedger` already uses, `we:scripts/lib/review-runner-core.mjs:137`) has
reached `NEGOTIATION_ROUND_CAP`, **and** the MANDATORY-lens panel has not reached a clean accept.

**Correction from independent review:** the first draft of this design scoped the "has the panel accepted"
check over `strictestLensVerdict(reduced.lensVerdicts)` — *every* lens in the reduced ledger, mandatory and
advisory alike. That is wider than the codebase's real round-cap mechanism: both `proposeDisposition`'s own
step 4 (`we:scripts/lib/disposition-judge.mjs:120-124`, the `strictestMandatory` reduce) and the convergence
loop's panel-verdict derivation are scoped strictly to `MANDATORY_LENSES` (correctness/security,
`we:scripts/lib/jury-core.mjs:675`) — an advisory lens (e.g. `simplicity`) dissenting at the round cap would
have set `nonConvergence: true` under the first draft even though the real enforce-era loop would not call that
non-convergence. **Fixed:** `deriveRunnerSignals` now filters `reduced.lensVerdicts` down to `mandatoryLenses`
(default `MANDATORY_LENSES`, same default `proposeDisposition` itself uses) before taking the strictest, so the
two round-cap definitions — the runner's shadow signal and the judge's own step-4 panel check — read the exact
same lens subset. Reusing the already-defined-in-this-file `strictestLensVerdict` helper
(`we:scripts/lib/review-runner-core.mjs:45`) rather than a third copy of the strictness fold; `mandatoryLenses`
is accepted as an optional parameter (mirroring `runnerShadowPlan`'s own `mandatoryLenses` passthrough) purely
for test symmetry — the runner itself never overrides it.

### Interfaces and protocol

**`we:scripts/lib/review-runner-core.mjs`** — new imports (`scoreEscalation` added to the existing
`we:scripts/lib/review-escalation.mjs` import; `NEGOTIATION_ROUND_CAP` and `VERDICTS` added to the existing
`we:scripts/lib/jury-core.mjs` import) and one new exported pure function:

```js
import { REVIEW_LABELS, hasReviewLabel, partitionAgentClearable, scoreEscalation } from './review-escalation.mjs';
import { verdictStrictness, NEGOTIATION_ROUND_CAP, VERDICTS, MANDATORY_LENSES } from './jury-core.mjs';

/**
 * Derive the three HARD-INVARIANT signals `proposeDisposition` checks BEFORE it reads the ledger (#3000).
 * PURE — takes already-fetched data (the runner fetches `changedFiles` fresh via `gh`; `ledger` is the same one
 * `runShadowPass` already reads for the plan itself), does no I/O.
 * `nonConvergence`'s "has the panel accepted" check is scoped to `mandatoryLenses` ONLY (default
 * `MANDATORY_LENSES`) — matching `proposeDisposition`'s own step-4 `strictestMandatory` reduce exactly, so an
 * advisory-lens dissent at the round cap does not read as a deadlock the real judge would not call one.
 * @param {{ changedFiles?: string[], ledger?: Array<object>, mandatoryLenses?: string[] }} o
 * @returns {{ gateSelf: boolean, humanRequired: boolean, nonConvergence: boolean }}
 */
export function deriveRunnerSignals({ changedFiles = [], ledger = [], mandatoryLenses = MANDATORY_LENSES } = {}) {
  const score = scoreEscalation({ changedFiles: Array.isArray(changedFiles) ? changedFiles : [] });
  const reduced = reduceLedger(ledger);
  const rounds = reduced.maxRound + 1;
  const mandatoryVerdicts = {};
  for (const lens of mandatoryLenses) {
    if (reduced.lensVerdicts[lens] !== undefined) mandatoryVerdicts[lens] = reduced.lensVerdicts[lens];
  }
  const strictest = strictestLensVerdict(mandatoryVerdicts);
  return {
    gateSelf: Boolean(score.signals.gateSelf),
    humanRequired: Boolean(score.humanRequired),
    nonConvergence: rounds >= NEGOTIATION_ROUND_CAP && strictest !== VERDICTS.ACCEPT,
  };
}
```

(`reduceLedger` and `strictestLensVerdict` are already in-module — no new import for either.)

**`we:scripts/review-runner.mjs`** — `CONSTELLATION_REPOS` added to the existing
`we:scripts/lib/constellation-repos.mjs` import; `deriveRunnerSignals` added to the existing
`we:scripts/lib/review-runner-core.mjs` import; one new function; one parameter added to `runShadowPass`
(backward-compatible default); `main()`'s one call site updated:

```js
import { repoKeyForSlug, CONSTELLATION_REPOS } from './lib/constellation-repos.mjs';
import {
  partitionRunnerPRs, runnerShadowPlan, buildShadowRecord, deriveRunnerSignals,
} from './lib/review-runner-core.mjs';

/** The default CHANGED-FILES seam (#3000) — read-only `gh pr view --json files`, mapped to plain paths.
 *  Mirrors merge-ai-prs.mjs's existing `files.map((f) => f.path)` fallback pattern. An unreadable file list
 *  degrades to `[]` (gateSelf/humanRequired then read false) rather than aborting the PR's shadow record —
 *  matches the ledger seam's existing per-PR fail-closed-record posture. */
function loadChangedFilesFromGh(item) {
  const slug = (CONSTELLATION_REPOS[item.repo] && CONSTELLATION_REPOS[item.repo].slug) || DEFAULT_REPO_SLUG;
  try {
    const out = execFileSync('gh', [
      'pr', 'view', String(item.pr), '--repo', slug, '--json', 'files',
    ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const parsed = JSON.parse(out);
    return (Array.isArray(parsed.files) ? parsed.files : [])
      .map((f) => f && f.path).filter((p) => typeof p === 'string' && p);
  } catch { return []; }
}

/**
 * Run one SHADOW pass … (existing docstring, extended)
 * @param {(item:{pr:number,repo:string,labels:Array})=>string[]} loadChangedFiles - defaults to a SAFE no-op
 *   ([]), never the network — see prep note "a live-gh default would silently make the existing unit tests
 *   network calls". Only `main()` wires the real `gh`-backed loader.
 */
export function runShadowPass(
  clearable, config, loadLedger = loadLedgerFromDurableLog, loadChangedFiles = () => [],
) {
  const records = [];
  for (const item of clearable) {
    const subject = `${item.repo}#${item.pr}`;
    let ledger = [];
    try { ledger = loadLedger(subject) || []; } catch { ledger = []; }
    let changedFiles = [];
    try { changedFiles = loadChangedFiles(item) || []; } catch { changedFiles = []; }
    const signals = deriveRunnerSignals({ changedFiles, ledger });
    const { intent, plan } = runnerShadowPlan({ ledger, config, signals, currentLabels: item.labels });
    records.push(buildShadowRecord({ item, ledger, intent, plan }));
  }
  return records;
}
```

In `main()` (`we:scripts/review-runner.mjs:245`), change the one call site:

```js
const records = runShadowPass(clearable, config, loadLedgerFromDurableLog, loadChangedFilesFromGh);
```

**Error shape / degraded behaviour:** a PR whose file list cannot be fetched (rate-limited, deleted, network
error) is **not** newly surfaced as a separate error class — it silently degrades to `changedFiles: []`, i.e.
`gateSelf`/`humanRequired` read `false` for that PR (the pre-fix behaviour, for that PR only), while
`nonConvergence` is unaffected (it only reads the ledger, already fetched). This is a known, accepted residual:
the fix makes the common case accurate without adding a new fail-closed-vs-fail-open decision for a
gh-transport failure that the existing `loadLedger` seam already treats the same way (catch → `[]` → the plan
falls back to the pre-fix posture for that one signal, not a crash).

**No data migration.** No persisted shape changes — the shadow log's JSON record shape
(`buildShadowRecord`'s output) is unchanged; only the *values* it now might compute (`disposition`, `reason`,
`wouldClear`) change for the PRs that actually carry a leash/statute-file diff or a round-cap-exhausted ledger.

### Tasks

1. `we:scripts/lib/review-runner-core.mjs` — add `scoreEscalation` to the `we:scripts/lib/review-escalation.mjs`
   import and `NEGOTIATION_ROUND_CAP`, `VERDICTS` to the `we:scripts/lib/jury-core.mjs` import; implement and
   export `deriveRunnerSignals` exactly as specified above.
2. `we:scripts/lib/__tests__/review-runner-core.test.mjs` — unit tests for `deriveRunnerSignals` directly (cheap,
   pure-function coverage before the end-to-end wiring test):
   - `changedFiles` containing the real, currently-registered `leash: 'spec'` file
     `we:scripts/lib/gate-config.mjs` (verified at `we:scripts/lib/gate-config.mjs:294-301`) →
     `{ gateSelf: true, humanRequired: true }`.
   - `changedFiles` containing the real statute path `we:docs/agent/platform-decisions.md` →
     `{ gateSelf: false, humanRequired: true }`.
   - `changedFiles: []`, ledger at round `NEGOTIATION_ROUND_CAP - 1` (0-based `maxRound`) with a non-accept
     verdict on a MANDATORY lens → `nonConvergence: true`.
   - `changedFiles: []`, ledger at round `NEGOTIATION_ROUND_CAP - 1` with all mandatory lenses at `ACCEPT` but
     an ADVISORY lens (e.g. `simplicity`) dissenting → `nonConvergence: false` — pins the independent-review
     correction (an advisory-only dissent at the cap is not a mandatory-panel deadlock).
   - `changedFiles: []`, `cleanDiverseLedger()` (the file's existing clean-accept fixture) → all three `false`.
3. `we:scripts/review-runner.mjs` — add `CONSTELLATION_REPOS` to the `we:scripts/lib/constellation-repos.mjs`
   import; implement `loadChangedFilesFromGh`; extend `runShadowPass`'s signature with the fourth,
   safely-defaulted parameter and wire it into the loop; update `main()`'s one call site to pass
   `loadChangedFilesFromGh`.
4. `we:scripts/__tests__/review-runner.test.mjs` — add end-to-end tests calling `runShadowPass` with an explicit
   synthetic `loadChangedFiles` (never the real `gh`-backed one) alongside the file's existing
   `cleanDiverseLedger()` fixture:
   - leash-file `loadChangedFiles` + clean ledger → `records[0].disposition === 'escalate'`, `.reason ===
     'gate-self'`, `.wouldClear === false`.
   - statute-file `loadChangedFiles` + clean ledger → `.disposition === 'escalate'`, `.reason ===
     'human-required'`.
   - empty `loadChangedFiles` + a round-cap-exhausted, never-unanimous ledger (build a `MANDATORY_LENSES`-shaped
     ledger with verdicts across 5 rounds that never all reach `ACCEPT` simultaneously, mirroring
     `contestedLedger()`'s style in the core test file but spanning rounds `0..NEGOTIATION_ROUND_CAP-1`) →
     `.disposition === 'escalate'`, `.reason === 'non-convergence'`.
   - confirm the file's three **existing** tests (clean-ledger would-clear, empty-ledger fail-closed, throwing-
     loader fail-closed) are left syntactically unmodified and still pass, proving the new fourth parameter's
     default is backward compatible.
5. Run `npx vitest run we:scripts/lib/__tests__/review-runner-core.test.mjs
   we:scripts/__tests__/review-runner.test.mjs` and `npm run check:standards` (0 errors expected — doc/code
   gate, no contract changes here).

### Delivery shape

One piece, not incremental. `deriveRunnerSignals` has exactly one caller (`runShadowPass`) and no independent
value landed alone — shipping it unwired would be dead code the test-only-export scan (#2967) would itself
flag. All four scoped files change together in one PR.

**Expect `review:human` at PR time.** Both `we:scripts/review-runner.mjs` and
`we:scripts/lib/review-runner-core.mjs` are registered `leash: 'spec'` in `we:scripts/lib/gate-config.mjs:197-230`
— this fix edits declarative-leash files by definition, so it is expected to escalate to a human reviewer rather
than clear on an agent panel. Noted as an expectation carried over from the original filing, not a blocker to
preparing or building this item.

### Independent review of this preparation (checklist item 9)

Reviewed by a separate, freshly-launched agent session with no memory of drafting this card, instructed to
re-read every cited source file itself (not trust the citations) and check the interfaces, the de-risking
claims, and the consumer sweep independently. **Verdict: HIGH confidence, build-ready**, with two findings, both
corrected in this card before landing:

1. **Citation error (non-load-bearing).** The "Subprocess callers" paragraph originally mis-cited
   `we:scripts/converge-daemon-pass.mjs:107` as an `execFileSync` call; it is actually `spawnSync` at line 261,
   with line 107 only building the argv array (`buildRunnerArgv`). The substantive conclusion (no change needed
   in that file) was independently re-verified and still holds — corrected above.
2. **Design gap.** The first draft's `nonConvergence` derivation checked the strictest verdict across *all*
   lenses in the ledger, not just `MANDATORY_LENSES` — wider than `proposeDisposition`'s own step-4 scope, so an
   advisory-lens-only dissent at the round cap could have set `nonConvergence: true` in a case the real judge
   would not call a deadlock. Fixed above (`deriveRunnerSignals` now filters to `mandatoryLenses` before taking
   the strictest verdict) and pinned by a new task-2 unit test.

Every other claim — code citations, import lists, `scoreEscalation`/`partitionAgentClearable`/`gh --json files`
behavior, the 3-argument shape of the existing tests, and the consumer sweep — was independently re-derived from
source by the reviewing agent and found correct.

### Done when

- Mutating `deriveRunnerSignals` to ignore `changedFiles` (e.g. hardcode `gateSelf: false, humanRequired: false`)
  reddens the task-2 leash-file and statute-file unit tests.
- Mutating `deriveRunnerSignals`'s `nonConvergence` to always `false` reddens the task-2 round-cap unit test.
  Widening it back to score over all lenses (not just `mandatoryLenses`) reddens the task-2 advisory-dissent
  unit test (the independent-review correction).
- Reverting `runShadowPass`'s fourth-parameter wiring (e.g. never calling `loadChangedFiles`, or not passing
  `signals` into `runnerShadowPlan`) reddens the task-4 end-to-end gate-self/human-required/non-convergence
  tests — this is the acceptance bar the original filing named: a synthetic gate-self PR shadow record must show
  `disposition: escalate, reason: 'gate-self'` through the **actual runner entry point**, not only through
  `proposeDisposition` called directly.
- The three pre-existing tests in `we:scripts/__tests__/review-runner.test.mjs` (clean-ledger would-clear,
  empty-ledger fail-closed, throwing-loader fail-closed) still pass with zero edits to their own bodies —
  proving the fix does not change behaviour for a caller that does not opt into the new signal.
- `main()`'s CLI path uses `loadChangedFilesFromGh` (not the safe no-op default) — inspectable by reading
  `we:scripts/review-runner.mjs`'s one `runShadowPass(...)` call site inside `main()`.
- `npm run check:standards` is 0 errors on the live repo with the change applied (confirmed 0 errors / 1366
  warnings on the unmodified tree as this prep's baseline, 2026-08-15).
