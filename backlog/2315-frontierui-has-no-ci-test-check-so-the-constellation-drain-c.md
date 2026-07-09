---
kind: decision
size: 3
status: open
dateOpened: "2026-07-06"
preparedDate: "2026-07-09"
tags: [ci, drain, frontierui, constellation]
---

# frontierui has no CI test check, so the constellation drain can never auto-land its lanes

> **Prep note (2026-07-09, `/prepare all`).** No `/research/` topic — this ratifies shipped constellation
> tooling, not a greenfield standard, so the "prior art" is the repo itself (grounding digest below), per
> *backlog-workflow.md → a decision that only ratifies shipped code skips the web survey but still needs the
> concrete-refs check*. **The grounding reframes the card: the answer is already landed and proven** — the
> premise "frontierui has no CI check at all" is stale as of 2026-07-06. The prepared call is a **ratify of the
> boundary contract** (FUI exposes a green required check named `test`), which the landed sibling-checkout
> workflow already satisfies — plus one follow-up (option b) and one artifact follow-up to file, not resolve.

## Grounding digest

- **The check is already built and green.** `fui:.github/workflows/ci.yml` carries a job literally named
  `test` (`fui:.github/workflows/ci.yml:31`) that checks out `chalbert/web-everything` at `path: webeverything`
  **with no token** (`fui:.github/workflows/ci.yml:41-45`) so FUI's hardcoded WE-sibling relative reads
  resolve, then runs `build:tools` + `build:packages`, `npm run test:unit`, and `check:standards`. Committed
  2026-07-06 (same day #2315 opened). **Verified live-green:** `gh pr view 24` returns
  `statusCheckRollup: [{name: "test", conclusion: "SUCCESS", workflowName: "CI"}]`; the manually-squashed PR #11
  that surfaced this card had an empty rollup.
- **This satisfies the exact gate #2315 named.** `isRequiredCheckGreen(pr, requiredCheck='test')`
  (`we:scripts/merge-ai-prs.mjs:207-213`) finds a rollup entry named `test` and returns `SUCCESS` — so a green
  FUI PR now passes. Adding the workflow **alone** unblocks the drain; making the check GitHub-*required* via
  branch protection is #2246's separate, credentialed scope.
- **The token objection in the original body is false for this direction.** #2315 worried it "adds a cross-repo
  read token to every frontierui PR." It does not: **WE is public**, so FUI's checkout of it is tokenless
  (`fui:.github/workflows/ci.yml:41-45`) — the mirror image of WE's own CI, which *does* need `FUI_READ_TOKEN`
  to read the **private** FUI (`we:.github/workflows/ci.yml:48-52`). The asymmetry (public WE, private FUI) is
  what makes the sibling checkout cheap in the FUI→WE direction.
- **The check is meaningful, not hollow.** Only two `functionalAuthoringForm` describes are `describe.skip`ped
  (`fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs:25,49`) plus one file excluded
  (`fui:vitest.config.ts:77`) — all three because a WE artifact (`we:src/_data/authorModeSource.json`, and the
  webtheme vector source `we:conformance-vectors/surfaceVectors.ts`) was **never committed to WE** (absent in
  `git ls-files` and on disk), so it is ENOENT in *every* environment, sibling checkout or not. The remaining
  ~386 test files + `build:tools`/`build:packages` + `check:standards` all run against the real public-WE
  checkout. Un-skipping the two needs the WE artifact authored + committed — a **separate follow-up**, not part
  of this gate.
- **Option (b) is orthogonal reporting hardening, not the fix.** `classifyPr` returns the *same* skip reason —
  `required check "test" is not green` (`we:scripts/merge-ai-prs.mjs:246`) — for both "check ran red" and "no
  `test` check configured" (`isRequiredCheckGreen` returns `false` on an absent check, `:210` — a fail-*closed*
  skip, the safe default). Now that the check is landed the conflation is moot for FUI; distinguishing the two
  would only convert a silent skip into an explicit deliberate case for a *future* CI-less constellation repo.

## Axis-framing

The live axis is **the boundary contract between a constellation repo and the drain: "the repo exposes a green
required check named `test`."** The drain consumes only the check's *name + conclusion*
(`isRequiredCheckGreen(pr, 'test')`, `we:scripts/merge-ai-prs.mjs:207-213`) — *how* FUI turns that check green
(which CI job shape) is FUI-private impl, invisible across the repo↔drain boundary. So the ratifiable call is
the contract, and the sub-question ("sibling-checkout job vs a scoped job") is a **merit-weighing over FUI's
private CI impl**, not a forced invariant: a scoped no-sibling job is *constructible* (a green suite behind a
growing exclude list), just hollow and higher-maintenance — inferior, not invalid. The landed sibling-checkout
job already satisfies the contract, so this ratifies shipped code. Option (b) is a distinct, WE-internal drain
diagnostic — a plain follow-up, not a competing branch. Fork 1 turns on a concrete code-level shape (the
check-name contract the drain matches + FUI's landed job), so it carries a code example.

## Recommended path at a glance

| Item | Question | Recommended default (post-skeptic) | Main alternative |
| --- | --- | --- | --- |
| Fork 1 | What does a constellation repo owe the drain, and does FUI meet it? | **Ratify the boundary contract — "the repo exposes a green required check named `test`" — which FUI's landed sibling-checkout `fui:.github/workflows/ci.yml` already satisfies (green on PR #24, tokenless).** The job shape is FUI-internal impl. | A **scoped no-sibling job** (FUI-internal alternative — constructible but hollow: a large exclude list certifying almost nothing; inferior on merit, not invalid) |
| Follow-up | Also add (b): make `classifyPr` distinguish "no `test` check configured" from "red" | **File later, reporting-only + fail-closed; defer until a *second* CI-less constellation repo is actually queued** (speculative today — FUI now has CI, plateau-app is a product). | — |
| Follow-up | Author + commit `we:src/_data/authorModeSource.json` so the 2 skipped maas tests run | File as a story (not resolved here). | — |

## Fork 1 — The repo↔drain check contract (and FUI's landed impl of it)

**Fork exists because** the two coherent readings of the ratifiable object genuinely differ: the drain's
contract is satisfied by *any* green check named `test`, and the *flawed* reading — that WE must ratify FUI's
particular job shape — puts an FUI-private impl detail on the standard side. What crosses the boundary is the
contract ("a green required check named `test`"); which YAML produces it is FUI's call. Within that, the
sibling-checkout-vs-scoped sub-question is a merit-weighing (comprehensive check vs hollow check), not a forced
invariant — so this is a **ratify of the contract**, already met by the landed workflow.

- **Ratify the contract; the landed sibling-checkout job is FUI's impl of it (default).** FUI's `test` job
  checks out the WE sibling tokenless (WE is public), builds tools+packages, runs the unit suite +
  `check:standards`, and is green on a drain-landed PR (#24) — satisfying `we:scripts/merge-ai-prs.mjs:207-213`
  with **zero new credential**. It certifies broadly (~386 test files); only the two artifact-missing maas
  describes are skipped, honestly and documented, mirroring the existing `fui:vitest.config.ts:75-78` exclude.
- **Scoped no-sibling job (FUI-internal alternative, inferior on merit).** A `test` job that runs only the
  sibling-independent tests behind an exclude list is *constructible* green — the FUI suite's pure
  `plugs/**`/`blocks/**` DOM tests don't touch WE. But it drops every test that reads the WE sibling (the
  `@webeverything/*` aliases, `fui:vitest.config.ts:80-181`), so the check certifies far less and the exclude
  list grows with the suite. Lower fidelity, higher maintenance — a valid but dominated FUI impl choice, not a
  standard-level fork WE ratifies.

The contract + FUI's landed impl (keyed to the real gate + workflow):

```yaml
# The boundary contract WE ratifies: a green required check NAMED `test`.
# Drain side — consumes only name + conclusion (we:scripts/merge-ai-prs.mjs:207-213):
#   isRequiredCheckGreen(pr,'test') → rollup.find(c => c.name==='test').conclusion==='SUCCESS'
# FUI-side impl that satisfies it — fui:.github/workflows/ci.yml (landed, green on PR #24):
jobs:
  test:                                   # ← the contract: a check named `test`
    steps:
      - uses: actions/checkout@v4         # this repo → path: frontierui
        with: { path: frontierui }
      - uses: actions/checkout@v4         # the WE sibling → tokenless (WE is PUBLIC)
        with: { repository: chalbert/web-everything, path: webeverything }
      - run: npm ci && npm run build:tools && npm run build:packages
      - run: npm run test:unit            # ~386 files run; 2 artifact-missing maas describes are describe.skip'd
      - run: npm run check:standards
# The scoped-no-sibling alternative would drop the second checkout + the WE-sibling-reading tests —
# green, but certifying far less. FUI's internal call; the drain can't see the difference either way.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT (hostile 4-axis attack). **Merit** — could not refute: PR #24's `test`
rollup is live-`SUCCESS` (`we:scripts/merge-ai-prs.mjs:207-213`), the WE checkout is genuinely tokenless
(`fui:.github/workflows/ci.yml:41-45` vs WE's `FUI_READ_TOKEN` at `we:.github/workflows/ci.yml:48-52`), and the
check certifies ~386 files, not a hollow shell. **Classification** — amended: the original "forced-invariant,
a2 is *broken*" framing was overstated (a scoped no-sibling job is constructible-but-hollow, not invalid) and
rested on a non-sequitur ("`build:packages` compiles the packages the tests import"); reframed to the boundary
contract + a merit-weighing over FUI's private impl, and the garbled clause dropped. **Statute-overlap** — none:
`we:docs/agent/platform-decisions.md` carries no anchor governing "a required check named `test`"; this is a one-off CI-transport
ratify (`--codified-to=one-off`), and #2246 (branch protection) is complementary/sequential, not conflicting.
**Citation-scope** — clean. Caveat folded: FUI's WE checkout pins no `ref:`, so a FUI PR builds against WE's
latest `main` — WE-side drift can turn FUI's `test` red for unrelated reasons (an accepted, symmetric
constellation coupling; note at resolve).

**Screen:** flagged(impl) → fixed. The fresh-context screen flagged that ratifying FUI's *job shape* rules on an
FUI-private impl invisible across the repo↔drain boundary; the fix (applied) reframes the ruling to the
**check-name contract** and demotes sibling-vs-scoped to FUI-internal impl. Merit axis clear (the hollow-check
alternative is a genuine correctness gap, not a cost/timing difference).

## Follow-ups to file (not resolved here)

1. **Option (b), reporting-only + fail-closed, deferred.** If/when a *second* constellation repo is added
   before its CI exists, make `classifyPr` (`we:scripts/merge-ai-prs.mjs:246`) report "no required check
   configured" distinctly from "red" — but purely as a *reporting* change that **keeps the fail-closed skip**
   (never treat a check-less repo as landable). Speculative today (FUI now has CI); file when a real second
   repo needs it, not now.
2. **Author + commit `we:src/_data/authorModeSource.json`** (the artifact the maas authoring tests read at
   `fui:tools/maas/functionalAuthoringForm.mjs:56`) so the two `describe.skip`ped tests
   (`fui:tools/maas/__tests__/functionalAuthoringForm.test.mjs:25,49`) run under the `test` check. Relates to
   the maas authoring-form work (#1602/#1619).

---

Relates #2153 (the drain transport this gate lives in), #2246 (branch protection that makes the `test` check
GitHub-*required* — a separate credentialed step). Ratifying = confirm the boundary contract (met by the landed
workflow), then file the two follow-ups above.
