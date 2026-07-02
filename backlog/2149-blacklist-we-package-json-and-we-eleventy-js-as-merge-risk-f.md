---
kind: decision
status: open
relatedTo: ["1952", "2148", "2077", "1935", "1938", "2138", "2123"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
preparedDate: "2026-07-02"
tags: [lane, merge-risk, parallel-batch, session-tooling, decision]
relatedReport: reports/2026-07-02-merge-risk-blacklist-package-json-eleventy.md
---

# Decision: are we:package.json and we:.eleventy.js merge-risk (blacklist) files, or does the #1952 line-structured-optimistic principle cover them?

Prepared decision — two forks, each with a **bold** default grounded in the `/research/merge-risk-blacklist-package-json-eleventy/` topic and the linked report. The prep skeptic split the two files: they are **not symmetric**. `we:package.json`'s only clean-but-wrong class (duplicate keys) is deterministically lintable, so it stays optimistic with a new merge-gate lint instead of a blacklist entry; `we:.eleventy.js`'s clean-but-wrong class (same-name / ordering-sensitive JS registrations) is not lintable, so it is declared ③ merge-risk now, with the statute's standing category-① split-and-exit path as its future off-ramp.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — `we:package.json` | **(c) stay optimistic + a deterministic duplicate-key lint in the per-merge gate (lands in the ruling's own changeset)** | (b) declare ③ merge-risk | high |
| Fork 2 — `we:.eleventy.js` | **(b) declare ③ merge-risk now** (delist later via the already-ratified category-① exit, iff a split proves order-insensitivity) | (a) keep optimistic | med-high |

## Axis-framing

The blacklist is one predicate with two mutually-exclusive states per path: a file in `RESERVED_MERGE_RISK_BY_REPO.we` forces same-lane packing (rule 2c, [we:scripts/readiness/lane-partition.mjs:125](../scripts/readiness/lane-partition.mjs#L125)), pre-lock reservation ([we:scripts/readiness/file-locks.mjs](../scripts/readiness/file-locks.mjs) via `reservedPathsFor`, [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:190](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L190)), and — since #2138 Fork 3 — drain-time denylist-overlap serial-replay. A file off the list rides the optimistic floor (rebase-retry → serial-replay of real conflicts → post-hoc `multiLaneFiles` notice), whose contract is that a wrong "concurrent" call costs **speed, never correctness** ([we:scripts/readiness/lane-partition.mjs:19-21](../scripts/readiness/lane-partition.mjs#L19)). The governing statute is [merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md#merge-risk-optimistic-with-targeted-lock): the denylist is **derived by category** — ① splittable → split and exit; ② purely-derived → regenerate-on-merge; ③ irreducible residual → locked. Findings the prep surfaced:

- **Neither path was ever in the list — "reverses #1952" was imprecise.** `git log -S` over both homes shows no commit ever added or removed an entry for either path; #1952's ratified removals were `we:tsconfig.json` + `we:vite.config.mts`. The two paths are swept in only by the code header's *generalized* "BUILD CONFIG" parenthetical ([we:scripts/readiness/lane-partition.mjs:33-37](../scripts/readiness/lane-partition.mjs#L33)). `we:tsconfig.json`/`we:vite.config.mts` stay optimistic under every branch below.
- **The statute and the code header already disagree — the codify step must reconcile them under any ruling.** The anchor's literal ③ category reads "structured doc / **build config** / hand-curated sweep input / hand-authored prose → locked", while #1952's line-structured demotion lives *only* in the code header — so the statute as written contradicts the ratified #1952 removals. Whatever is ruled here, the anchor body needs the reconciling edit (carve *flat, developer-unique-keyed* config out of ③; state where keyed manifests and registration monoliths fall). Skeptic-surfaced; without it, stacking another note on the same anchor would leave ③ saying three partially-contradictory things.
- **#2138 Fork 3 (ratified 2026-07-02) composes with, but does not settle, this item.** Its amendment whitelists "appending a new `we:package.json` script key; a new per-entry `we:.eleventy.js` registration line" as micro-slice-safe and rules dep adds/version bumps/overrides/ordering-sensitive registrations NOT whitelisted → serial-replay — but the carve is conditional ("iff … on the denylist"): for an unlisted file it goes **dormant, not contradicted**, and its "Composes with … #2149 (declares the irreducible residual)" line is a compositional forward-note to a then-`preparing` item, not authority (citation-scope check). Under Fork 1 (c) the carve's manifest example goes dormant; under Fork 2 (b) its registration-line example stays live.

Evidence base (batch-2026-07-01-wf, the 2nd real multi-lane run): of 7 `multiLaneFiles` flagged, #2018 + #2020 both appended to `we:.eleventy.js` and #2024 + #2087 both appended to `we:package.json` — post-hoc notices, no observed wrong merge. Churn since 2026-06-01: `we:package.json` 47 commits, `we:.eleventy.js` 22, `we:tsconfig.json` 2. Premise check against #2123 (every edit-action session runs in a lane clone): more concurrent lanes touch root config (the live `wrangler` dep-add was a solo-session lane), raising exposure under every branch — it does not discriminate between them.

## Fork 1 — we:package.json: blacklist, or optimistic + a deterministic duplicate-key merge gate

Fork-existence: (b) and (c) are rival mechanisms for the same failure class that cannot both be the rule for one path (co-serialize up front vs detect-at-merge), and (a) — the bare status quo — is the named broken branch: two lanes adding the **same key** at different offsets (both add a `wrangler` dep; both add the same script) git-merge **clean** into a duplicate-key object that JSON parsing / npm resolve silently last-wins, and no current gate parses `we:package.json` for duplicate keys — a silent-wrong state the optimistic floor's own contract forbids.

Crux: for a keyed JSON manifest whose member order is semantically irrelevant, the *entire* clean-but-wrong class is the duplicate key (distinct-key adds merge clean *and* correct; ordering doesn't matter to npm; distinct-dep semantic incompatibility is caught by neither a lock nor serialization). A failure class that is fully enumerable and machine-checkable is hook territory, not judgment/serialization territory.

- (a) **Bare optimistic (status quo).** *Rejected:* leaves the duplicate-key clean-merge silent (the named broken branch above).
- (b) **Declare ③ merge-risk.** npm mandates a single file (no ① split exists; not ② derived), so the category derivation *can* read it as ③, and the entry makes the #2138 whitelist carve operative for script-key appends. *Rejected on merit:* with (c) available, (b)'s only residual benefit over (c) is avoiding a wasted replay — **speed, i.e. prioritization wearing merit's clothes (#1961)** — while it is strictly narrower in coverage: rule 2c + locks guard only orchestrator-packed lanes, whereas the merge gate guards every landing (solo lanes, human merges, the drain). The churn statistic (47/month) is frequency, not shape — it argues urgency, not mechanism.
- (c) **Stay optimistic + a deterministic duplicate-key lint on the merged tree.** A small parser check (reject duplicate keys in `we:package.json`; plain JSON parsing cannot see them) wired into `check:standards` — which the integrator already runs per merge ([gate-on-merged-tree](../docs/agent/platform-decisions.md#gate-on-merged-tree-lane-fast-fail)) — converts the silent class into **gate-red → serial-replay**, exactly the floor's designed recovery. This restores #1952's premise ("a genuine clash is a caught clash") instead of abandoning it, and honors the hookable-vs-judgment rule: a script-decidable failure gets a hook, not a serialization rule. The lint ships **in the ruling's own changeset** (mechanical, ~20 lines), so no unguarded interim window opens.

**Recommended default: (c).** Sketch of the gate check:

```js
// we:scripts/check-standards-rules.mjs — new pure rule (run by check:standards, i.e. per merge)
// JSON.parse is last-wins-silent on duplicate keys, so scan the raw text per object scope.
export function validateNoDuplicateManifestKeys(raw /* package.json text */) {
  const dupes = findDuplicateKeysPerScope(raw); // tiny tokenizer: track key names per {} depth
  return dupes.map((k) => ({ message: `we:package.json duplicate key "${k}" — two merged additions collided (last-wins is silent); rebase one side.` }));
}
```

Sub-decision — `we:package-lock.json`: **no denylist entry either.** It is derived-from-manifest (the npm-merge-driver precedent: regenerate via `npm install` on conflict). Note honestly: the drain has no implemented regenerate-on-merge machinery for it today, so a lockfile clash is a *real* conflict that serial-replays — which is the floor working, not a gap this decision must fill.

Skeptic: REFUTED → flipped from (b) blacklist to (c) optimistic + duplicate-key merge-gate lint — dup-key is the entire clean-but-wrong class for a keyed manifest and is script-decidable, so a gate converts silent-wrong to caught-replay with broader coverage than lane-only serialization; (b)'s residual benefit is replay-speed (#1961 prioritization); the "#2138 leaves machinery vacuous" lean was a citation-scope overreach (the carve is conditional → dormant); the statute's ③ "build config" literal vs the #1952 code header is a pre-existing conflict the codify step must reconcile either way.
Screen: clear — the ruled predicate ("the gate rejects duplicate keys") is boundary-observable; not support-both (belt-and-suspenders would contradict the list's own admission criterion at [we:scripts/readiness/lane-partition.mjs:36-37](../scripts/readiness/lane-partition.mjs#L36) — the blacklist is reserved for what the floor *cannot* catch, and with the lint the floor catches this class); (b)-vs-(c) is resolved by principle (hookable-vs-judgment + coverage), not cost.

## Fork 2 — we:.eleventy.js: optimistic vs ③ merge-risk

Fork-existence: two mutually-exclusive states of one predicate (listed or not — no facade composes them), and the branches do not reduce to one knob's values: they disagree on whether an un-lintable clean-but-wrong class may ride the optimistic floor.

Crux: `we:.eleventy.js` (382 lines, 28 `addFilter`/`addShortcode`/`addWatchTarget`/`addCollection`/… calls) is a **registration monolith**, not flat config — and unlike Fork 1, its failure class is *not* deterministically checkable: two lanes registering the same filter/shortcode name clean-merge into a silent last-wins (a name-duplicate lint over imperative JS is fragile — names can be computed, wrapped, re-exported), and some registrations are **ordering-/side-effect-sensitive**, which no lint can adjudicate. So the Fork 1 (c) route does not transfer; the files are asymmetric, and the pre-emptive entry is the only mechanism that actually closes the window.

- (a) **Keep optimistic.** *Rejected:* same-name and ordering-sensitive registrations clean-merge silently with no possible deterministic gate; #2018/#2020 collided on this file in one 18-item run; #2138's ratified carve treats its registration lines as a ③-file's whitelisted region.
- (b) **Declare ③ merge-risk now.** The category-correct reading of the *current* file shape (an irreducible-today structured registration doc). Cost: touchers co-serialize (rule 2c) — small under the #2138 deferred drain, where landing is serial anyway, and partially recovered by the ratified registration-line micro-slice carve.

**Recommended default: (b) — add the entry in both homes** ([we:scripts/readiness/lane-partition.mjs:42](../scripts/readiness/lane-partition.mjs#L42) + [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:171](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L171), mirror rule):

```js
we: [
  'src/_data/traits.json', 'src/_data/capabilityMatrix.json', 'src/_data/docs.json',
  'src/_data/webhandlers.json', 'src/_data/webportals.json',
  'src/_data/benchmarkCorpus.json', 'src/_data/workbenchTools.json', 'src/_data/workbenchFeatures.json',
  'AGENTS.md',
  '.eleventy.js', // #2149: registration monolith — same-name/ordering-sensitive registrations clean-merge
                  // silently and are NOT deterministically lintable (unlike we:package.json, #2149 Fork 1).
                  // Delist via category ① iff a fragment split proves order-insensitivity (see item).
],
```

A GO must also touch, in the same change: the header rationale at [we:scripts/readiness/lane-partition.mjs:33-37](../scripts/readiness/lane-partition.mjs#L33) (narrow "build config" to flat, developer-unique-keyed config; registration monoliths do not qualify), the probe guidance string at [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js:248](../.claude/skills/batch-backlog-items/parallel-execute.workflow.js#L248) (it currently teaches probes these files are *not* monolithic, so `touchesMonolith` would never name them and `reservedPathsFor` would never lock them), the tests in [we:scripts/readiness/__tests__/lane-partition.test.mjs](../scripts/readiness/__tests__/lane-partition.test.mjs) (line 72's tsconfig-not-merge-risk stays; add the new positive + a Fork-1 negative pinning `we:package.json` NOT merge-risk), and the statute reconciliation (Axis-framing, second bullet).

**The future off-ramp is already statute, not a branch here.** The anchor's category-① rule generically ratifies split-and-exit (`we:src/_data/adapters.json` needed no per-file exit ratification when #1938 split it; #2148 repeated the pattern for the FUI barrels, "strictly better than co-serializing"). A fragment split of `we:.eleventy.js` (a thin root loading `we:eleventy/*.cjs` fragments) is *plausible but not pre-blessed*: its open design question — glob loading makes registration order implicit (Node dir-order; CJS has no Vite-style glob; #2148's entries were order-insensitive by construction) while the thin root retains high-churn residue (plugins, markdown/server config, passthroughs) — decides whether category ① even applies, and is settled *in the split story*, not here. Delist mechanically iff the split lands and proves order-insensitivity (or an explicit ordered index). An earlier draft of this fork pre-ratified that split as the end-state; the skeptic struck it as ordering smuggled into fork shape.

Skeptic: SURVIVES-WITH-AMENDMENT → ③-now stood its strongest attack (a name-duplicate lint over imperative JS is fragile and ordering/side-effect wrongness is un-lintable, so the files are genuinely asymmetric to Fork 1); amended: dropped the "ratify the fragment split as end-state" branch (category ① already blesses split-and-exit generically — pre-blessing a future story is ordering, #1961), and made the delisting conditional on the split proving order-insensitivity rather than automatic.
Screen: clear — listed-vs-unlisted is a single boundary-observable predicate (co-serialize/pre-lock/drain-replay vs the optimistic floor); with both branches free to build, a genuine correctness difference remains (an un-lintable silent-wrong class that (a) leaves open, violating the floor's own contract); the one timing smuggle (pre-ratifying the split) was already excised, and the conditional ①-exit is standing statute, not ordering.

## Supported by default (not decisions)

- **Dynamic double-declaration (dynamic-B)** — already ratified by #1935 Fork 2 ("static ∪ dynamic", B "ships promptly") and still unbuilt in the live partition ([we:scripts/readiness/lane-partition.mjs:123-129](../scripts/readiness/lane-partition.mjs#L123) has only rules b/c/d). A *complement*, not a rival: it would co-lock any file ≥2 probes both name (including `we:package.json`) without a static entry, but it depends on probe accuracy, so it neither replaces Fork 1's gate lint nor Fork 2's static entry.
- **The #2138 whitelist micro-slice** (drain-authored, verbatim cherry-pick) — already ratified; under these defaults its registration-line example stays live (Fork 2) and its script-key example goes dormant (Fork 1 (c) leaves the manifest unlisted).

## Context

**Lineage (why this is a decision at all).** Filed as a size-2 story from batch-2026-07-01-wf ("add two paths to the blacklist"); retyped story→decision during batch-2026-07-02 because the edit contradicts a rule codified only in the target file's own header (#1952 rationale at [we:scripts/readiness/lane-partition.mjs:33-37](../scripts/readiness/lane-partition.mjs#L33)) — a batch story must not silently reverse a codified call. The prep then found the "reversal" is narrower than the retype note claimed (the paths were never listed; the header generalization — and a pre-existing statute/header contradiction — is what the codify step amends). The third irreducible monolith — the orchestrator script itself (#2073/#2071) — is the self-modifying case owned by #2077, not this item. #2148 (the FUI barrel split) resolved 2026-07-02 and is the ①-exit precedent Fork 2's off-ramp leans on.

Original story text (for reference): *"Cheap floor companion to #2148 … add these two paths to the merge-risk (blacklist) file set in `we:scripts/readiness/lane-partition.mjs` plus the inline mirror in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`, non-negotiable rule 2c, so any two items sharing them are forced same-lane."*

**Classification note (why fork-shape, not a validation gate).** A blacklist add can be a one-sided go/no-go, but both forks here weigh **rival mechanisms** (serialize-up-front vs detect-at-merge; optimistic vs pre-lock), each backed by a ratified posture, with a named broken branch — a merit fork, not a candidate-validation gate. Layer: agent-workflow / session-tooling (the #1935/#2123/#2138 cluster) — nothing crosses the WE↔FUI standard boundary; the ruling is observable to the guard's consumers (partition, lock planner, drain, gate) as concurrency and landing behavior.

**Codify target on GO (either fork's ruling):** rewrite the ③ category line under [merge-risk-optimistic-with-targeted-lock](../docs/agent/platform-decisions.md#merge-risk-optimistic-with-targeted-lock) so the statute stops contradicting #1952 (flat developer-unique-keyed config → optimistic; keyed-manifest duplicate-key risk → deterministic merge-gate lint; registration monoliths → ③ until a proven split), and update the code header + probe guidance + tests in the same change. Spin-offs at ratification: the duplicate-key gate lint (Fork 1 (c), lands with the ruling) and the optional `we:.eleventy.js` fragment-split story (ordinary backlog ordering).
